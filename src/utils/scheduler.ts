import cron from 'node-cron';
import { RefreshService } from '../services/refresh.service';
import { cacheService } from '../services/cache.service';
import { logger } from './logger';

const refreshService = new RefreshService();

/**
 * Initialize background cron jobs for data refresh
 */
export function initScheduler() {
  logger.info('Initializing background scheduler...');

  // Metals: Refresh every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    logger.info('Running scheduled metals refresh...');
    try {
      await refreshService.refreshIfStale('metals');
    } catch (error) {
      logger.error({ err: error }, 'Scheduled metals refresh failed');
    }
  });

  // Forex: Refresh every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    logger.info('Running scheduled forex refresh...');
    try {
      await refreshService.refreshIfStale('fx');
    } catch (error) {
      logger.error({ err: error }, 'Scheduled forex refresh failed');
    }
  });

  // Cache cleanup: Every hour
  cron.schedule('0 * * * *', () => {
    logger.info('Running cache cleanup...');
    cacheService.cleanup();
  });

  logger.info('Background scheduler initialized successfully');
}

/**
 * Perform initial data fetch on startup
 */
export async function initialDataFetch() {
  logger.info('Starting initial data fetch...');

  try {
    // Fetch current metals data
    logger.info('Fetching initial metals data...');
    const metalsResult = await refreshService.refreshMetals();
    if (metalsResult.success) {
      logger.info({ count: metalsResult.quotesCount }, 'Initial metals data fetched');
    } else {
      logger.warn('Initial metals fetch failed');
    }

    // Fetch current forex data
    logger.info('Fetching initial forex data...');
    const fxResult = await refreshService.refreshForex();
    if (fxResult.success) {
      logger.info({ count: fxResult.quotesCount }, 'Initial forex data fetched');
    } else {
      logger.warn('Initial forex fetch failed');
    }

    // Backfill historical forex data (3 years)
    // This will check if data already exists and skip if present
    logger.info('Checking for historical forex backfill...');
    const backfillResult = await refreshService.backfillHistoricalForex(3);
    if (backfillResult.quotesCount > 0) {
      logger.info(
        { count: backfillResult.quotesCount },
        'Historical forex data backfilled successfully'
      );
    } else {
      logger.info('Historical forex backfill skipped (data already exists or failed)');
    }

    // Backfill ALL metals historical data (5 years) from haremaltin.com
    // Requires HAREMALTIN_CF_CLEARANCE env var — skipped silently if not set
    logger.info('Checking for metals historical backfill...');
    const metalsBackfillResult = await refreshService.backfillHistoricalMetals(5);
    if (metalsBackfillResult.quotesCount > 0) {
      logger.info(
        { count: metalsBackfillResult.quotesCount },
        'Metals historical data backfilled successfully'
      );
    } else {
      logger.info('Metals historical backfill skipped (data already exists, no cookie, or failed)');
    }

    logger.info('Initial data fetch completed');
  } catch (error) {
    logger.error({ err: error }, 'Initial data fetch failed');
    // Don't throw - allow server to start even if initial fetch fails
  }
}
