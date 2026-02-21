import { db } from '../config/database';
import { quotes, latestQuotes, fetchState } from '../db/schema';
import { TruncgilService } from './data-sources/truncgil.service';
import { TcmbService } from './data-sources/tcmb.service';
import { ExchangeRateService } from './data-sources/exchangerate.service';
import { HaremalAltinService } from './data-sources/haremaltin.service';
import type { NormalizedQuote } from './data-sources/truncgil.service';
import { logger } from '../utils/logger';
import { config } from '../config';
import { eq, and, gte, lte, desc, asc, sql } from 'drizzle-orm';

export class RefreshService {
  private truncgilService = new TruncgilService();
  private tcmbService = new TcmbService();
  private exchangeRateService = new ExchangeRateService();
  private haremalAltinService = new HaremalAltinService();
  private cooldownMs = 10000; // 10 seconds cooldown between refresh attempts

  /**
   * Refresh metals data from Truncgil API
   */
  async refreshMetals(): Promise<{ success: boolean; quotesCount: number }> {
    const category = 'metals';
    logger.info('Starting metals refresh...');

    try {
      // Check cooldown
      if (!(await this.canRefresh(category))) {
        logger.warn('Metals refresh attempted too soon, skipping');
        return { success: false, quotesCount: 0 };
      }

      // Update attempt timestamp
      await this.updateFetchState(category, 'in_progress', null);

      // Fetch current data
      const quotesData = await this.truncgilService.fetchMetals();

      if (quotesData.length === 0) {
        throw new Error('No metals data received from Truncgil');
      }

      // Store in database
      await this.storeQuotes(quotesData);
      await this.updateLatestQuotes(quotesData);

      // Update success state
      await this.updateFetchState(category, 'success', null);

      logger.info({ count: quotesData.length }, 'Metals refresh completed successfully');
      return { success: true, quotesCount: quotesData.length };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: error }, 'Metals refresh failed');

      await this.updateFetchState(category, 'error', errorMsg);
      return { success: false, quotesCount: 0 };
    }
  }

  /**
   * Refresh forex data from TCMB API with fallback to ExchangeRate.host
   */
  async refreshForex(): Promise<{ success: boolean; quotesCount: number }> {
    const category = 'fx';
    logger.info('Starting forex refresh...');

    try {
      // Check cooldown
      if (!(await this.canRefresh(category))) {
        logger.warn('Forex refresh attempted too soon, skipping');
        return { success: false, quotesCount: 0 };
      }

      // Update attempt timestamp
      await this.updateFetchState(category, 'in_progress', null);

      let quotesData: NormalizedQuote[] = [];
      let primaryFailed = false;

      // Try primary source: TCMB
      try {
        quotesData = await this.tcmbService.fetchFx();

        if (quotesData.length === 0) {
          throw new Error('No forex data received from TCMB');
        }

        logger.info({ source: 'tcmb', count: quotesData.length }, 'Forex fetched from primary source');
      } catch (tcmbError) {
        primaryFailed = true;
        logger.warn({ err: tcmbError }, 'TCMB (primary) failed, trying fallback...');

        // Fallback to ExchangeRate.host
        try {
          quotesData = await this.exchangeRateService.fetchFx();

          if (quotesData.length === 0) {
            throw new Error('No forex data received from ExchangeRate.host');
          }

          logger.info({ source: 'exchangerate_host', count: quotesData.length }, 'Forex fetched from fallback source');
        } catch (fallbackError) {
          logger.error({ err: fallbackError }, 'All forex sources failed');
          throw new Error('All forex sources failed');
        }
      }

      // Store in database
      await this.storeQuotes(quotesData);
      await this.updateLatestQuotes(quotesData);

      // Update success state
      await this.updateFetchState(category, 'success', null);

      logger.info(
        { count: quotesData.length, usedFallback: primaryFailed },
        'Forex refresh completed successfully'
      );
      return { success: true, quotesCount: quotesData.length };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ err: error }, 'Forex refresh failed');

      await this.updateFetchState(category, 'error', errorMsg);
      return { success: false, quotesCount: 0 };
    }
  }

  /**
   * Backfill 10 years of historical forex data
   * Should only be run once on initial setup
   */
  async backfillHistoricalForex(years: number = 10): Promise<{ success: boolean; quotesCount: number }> {
    logger.info({ years }, 'Starting historical forex backfill...');

    try {
      // Check if we already have historical data
      const hasHistoricalData = await this.hasHistoricalData('fx', years);
      if (hasHistoricalData) {
        logger.info('Historical forex data already exists, skipping backfill');
        return { success: true, quotesCount: 0 };
      }

      // Fetch historical data
      const historicalQuotes = await this.tcmbService.backfillHistoricalData(years);

      if (historicalQuotes.length === 0) {
        logger.warn('No historical forex data received');
        return { success: false, quotesCount: 0 };
      }

      // Store in database (batch insert)
      await this.storeQuotesBatch(historicalQuotes);

      logger.info(
        { totalQuotes: historicalQuotes.length },
        'Historical forex backfill completed successfully'
      );
      return { success: true, quotesCount: historicalQuotes.length };
    } catch (error) {
      logger.error({ err: error }, 'Historical forex backfill failed');
      return { success: false, quotesCount: 0 };
    }
  }

  /**
   * Backfill N years of historical metals data from haremaltin.com
   * Run once on initial setup. Requires HAREMALTIN_CF_CLEARANCE env var.
   *
   * How to get cf_clearance:
   *   1. Open https://www.haremaltin.com/grafik?tip=altin&birim=AYAR14 in Chrome
   *   2. Open DevTools → Application → Cookies
   *   3. Copy the value of the cf_clearance cookie
   *   4. Set HAREMALTIN_CF_CLEARANCE=<value> in .env
   */
  async backfillHistoricalMetals(
    years: number = 5
  ): Promise<{ success: boolean; quotesCount: number }> {
    const cfClearance = config.haremaltin.cfClearance;

    if (!cfClearance) {
      logger.warn(
        'HAREMALTIN_CF_CLEARANCE is not set — skipping metals historical backfill. ' +
        'See refresh.service.ts for instructions.'
      );
      return { success: false, quotesCount: 0 };
    }

    logger.info({ years }, 'Starting historical metals backfill from haremaltin.com...');

    try {
      // Check if 14ayar already has sufficient historical data
      const cutoffTs = Math.floor(Date.now() / 1000) - years * 365 * 24 * 60 * 60;
      const oldest14ayar = await db.query.quotes.findFirst({
        where: (q, { eq, lte }) => and(eq(q.instrumentId, '14ayar'), lte(q.ts, cutoffTs + 30 * 24 * 60 * 60)),
        orderBy: quotes.ts,
      });

      if (oldest14ayar) {
        logger.info('14ayar historical data already exists, skipping backfill');
        return { success: true, quotesCount: 0 };
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - years);

      const historicalQuotes = await this.haremalAltinService.fetchHistory(
        'AYAR14',
        startDate,
        endDate,
        cfClearance
      );

      if (historicalQuotes.length === 0) {
        logger.warn('No 14ayar historical data received from haremaltin.com');
        return { success: false, quotesCount: 0 };
      }

      await this.storeQuotesBatch(historicalQuotes);

      logger.info(
        { count: historicalQuotes.length },
        'Historical metals (14ayar) backfill completed successfully'
      );
      return { success: true, quotesCount: historicalQuotes.length };
    } catch (error) {
      logger.error({ err: error }, 'Historical metals backfill failed');
      return { success: false, quotesCount: 0 };
    }
  }

  /**
   * Refresh all categories if stale
   */
  async refreshIfStale(category: 'metals' | 'fx'): Promise<void> {
    const staleThresholdMs = 15 * 60 * 1000; // 15 minutes
    const now = Math.floor(Date.now() / 1000);

    try {
      // Get last successful fetch
      const state = await db.query.fetchState.findFirst({
        where: eq(fetchState.key, category),
      });

      const lastSuccessTs = state?.lastSuccessTs ?? 0;
      const ageMs = (now - lastSuccessTs) * 1000;

      if (ageMs >= staleThresholdMs) {
        logger.info({ category, ageMinutes: Math.floor(ageMs / 60000) }, 'Data is stale, refreshing...');

        if (category === 'metals') {
          await this.refreshMetals();
        } else {
          await this.refreshForex();
        }
      } else {
        logger.debug({ category, ageMinutes: Math.floor(ageMs / 60000) }, 'Data is fresh, skipping refresh');
      }
    } catch (error) {
      logger.error({ err: error, category }, 'Failed to check staleness and refresh');
    }
  }

  /**
   * Check if enough time has passed since last attempt (cooldown)
   */
  private async canRefresh(category: string): Promise<boolean> {
    const state = await db.query.fetchState.findFirst({
      where: eq(fetchState.key, category),
    });

    if (!state?.lastAttemptTs) return true;

    const now = Math.floor(Date.now() / 1000);
    const timeSinceLastAttemptMs = (now - state.lastAttemptTs) * 1000;

    return timeSinceLastAttemptMs >= this.cooldownMs;
  }

  /**
   * Check if we already have historical data for the given period
   * We check if the OLDEST quote is close to our target years ago
   */
  private async hasHistoricalData(category: string, years: number): Promise<boolean> {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - years);
    const cutoffTs = Math.floor(cutoffDate.getTime() / 1000);

    // Add 30 days buffer (if oldest data is within 30 days of target, consider it complete)
    const bufferTs = cutoffTs + (30 * 24 * 60 * 60);

    // Get OLDEST quote (not newest)
    const oldestQuote = await db.query.quotes.findFirst({
      orderBy: quotes.ts, // Ascending order = oldest first
    });

    if (!oldestQuote) {
      return false; // No data at all
    }

    // Check if oldest quote is old enough (within buffer of target)
    return oldestQuote.ts <= bufferTs;
  }

  /**
   * Store quotes in historical table
   */
  private async storeQuotes(quotesData: NormalizedQuote[]): Promise<void> {
    for (const quote of quotesData) {
      await db.insert(quotes).values({
        instrumentId: quote.instrumentId,
        ts: quote.ts,
        price: quote.price.toFixed(6),
        buy: quote.buy ? quote.buy.toFixed(6) : null,
        sell: quote.sell ? quote.sell.toFixed(6) : null,
        source: quote.source,
        rawData: quote.rawData ? JSON.stringify(quote.rawData) : null,
      });
    }
  }

  /**
   * Store quotes in batch (for historical backfill)
   */
  private async storeQuotesBatch(quotesData: NormalizedQuote[]): Promise<void> {
    const batchSize = 500;
    const batches = [];

    for (let i = 0; i < quotesData.length; i += batchSize) {
      batches.push(quotesData.slice(i, i + batchSize));
    }

    logger.info({ totalBatches: batches.length, batchSize }, 'Inserting quotes in batches');

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      await db.insert(quotes).values(
        batch.map((quote) => ({
          instrumentId: quote.instrumentId,
          ts: quote.ts,
          price: quote.price.toFixed(6),
          buy: quote.buy ? quote.buy.toFixed(6) : null,
          sell: quote.sell ? quote.sell.toFixed(6) : null,
          source: quote.source,
          rawData: quote.rawData ? JSON.stringify(quote.rawData) : null,
        }))
      );

      if ((i + 1) % 10 === 0) {
        logger.info({ completed: i + 1, total: batches.length }, 'Batch progress');
      }
    }
  }

  /**
   * Update latest_quotes table with current data
   */
  private async updateLatestQuotes(quotesData: NormalizedQuote[]): Promise<void> {
    for (const quote of quotesData) {
      // Get 24h ago price for comparison
      const ts24hAgo = quote.ts - 24 * 60 * 60; // 24 hours ago
      const ts24hRangeStart = ts24hAgo - 12 * 60 * 60; // 12 hour window (±12h = 24h total range)
      const ts24hRangeEnd = ts24hAgo + 12 * 60 * 60;

      // Find quote closest to 24h ago (prefer older quotes, closer to actual 24h target)
      const quote24h = await db.query.quotes.findFirst({
        where: and(
          eq(quotes.instrumentId, quote.instrumentId),
          gte(quotes.ts, ts24hRangeStart),
          lte(quotes.ts, ts24hRangeEnd)
        ),
        orderBy: [asc(quotes.ts)], // Ascending to get oldest quote in window (closest to 24h ago)
      });

      // Upsert latest quote
      await db
        .insert(latestQuotes)
        .values({
          instrumentId: quote.instrumentId,
          ts: quote.ts,
          price: quote.price.toFixed(6),
          price24hAgo: quote24h?.price ?? null,
          ts24hAgo: quote24h?.ts ?? null,
          buy: quote.buy ? quote.buy.toFixed(6) : null,
          sell: quote.sell ? quote.sell.toFixed(6) : null,
          source: quote.source,
          rawData: quote.rawData ? JSON.stringify(quote.rawData) : null,
        })
        .onConflictDoUpdate({
          target: latestQuotes.instrumentId,
          set: {
            ts: quote.ts,
            price: quote.price.toFixed(6),
            price24hAgo: quote24h?.price ?? null,
            ts24hAgo: quote24h?.ts ?? null,
            buy: quote.buy ? quote.buy.toFixed(6) : null,
            sell: quote.sell ? quote.sell.toFixed(6) : null,
            source: quote.source,
            rawData: quote.rawData ? JSON.stringify(quote.rawData) : null,
            updatedAt: sql`NOW()`,
          },
        });
    }
  }

  /**
   * Update fetch state tracking
   */
  private async updateFetchState(
    category: string,
    status: 'success' | 'error' | 'in_progress',
    errorMsg: string | null
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    const existingState = await db.query.fetchState.findFirst({
      where: eq(fetchState.key, category),
    });

    const consecutiveFailures =
      status === 'error'
        ? (existingState?.consecutiveFailures ?? 0) + 1
        : 0;

    await db
      .insert(fetchState)
      .values({
        key: category,
        lastSuccessTs: status === 'success' ? now : existingState?.lastSuccessTs ?? null,
        lastAttemptTs: now,
        lastStatus: status,
        lastError: errorMsg,
        consecutiveFailures,
      })
      .onConflictDoUpdate({
        target: fetchState.key,
        set: {
          lastSuccessTs: status === 'success' ? now : existingState?.lastSuccessTs ?? null,
          lastAttemptTs: now,
          lastStatus: status,
          lastError: errorMsg,
          consecutiveFailures,
          updatedAt: sql`NOW()`,
        },
      });

    // Alert if too many consecutive failures
    if (consecutiveFailures >= 5) {
      logger.error(
        { category, consecutiveFailures },
        'ALERT: Too many consecutive fetch failures!'
      );
    }
  }
}
