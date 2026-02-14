import { XMLParser } from 'fast-xml-parser';
import { logger } from '../../utils/logger';
import { FOREX_MAPPINGS } from '../../config/instruments';
import type { NormalizedQuote } from './truncgil.service';

// TCMB XML response types
type TcmbCurrency = {
  '@_CurrencyCode': string;
  '@_Kod': string;
  Unit: string;
  Isim: string;
  CurrencyName: string;
  ForexBuying: string;
  ForexSelling: string;
  BanknoteBuying: string;
  BanknoteSelling: string;
  CrossRateUSD?: string;
  CrossRateOther?: string;
};

type TcmbResponse = {
  Tarih_Date: {
    '@_Tarih': string;
    '@_Date': string;
    '@_Bulten_No': string;
    Currency: TcmbCurrency[];
  };
};

export class TcmbService {
  private baseUrl = 'https://www.tcmb.gov.tr/kurlar';
  private parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });

  /**
   * Fetch current forex rates from TCMB
   */
  async fetchFx(): Promise<NormalizedQuote[]> {
    try {
      logger.debug('Fetching forex from TCMB...');

      const response = await fetch(`${this.baseUrl}/today.xml`, {
        headers: {
          'User-Agent': 'Valora/1.0',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (response.status === 404) {
        // Weekend or holiday - TCMB doesn't publish data
        logger.warn('TCMB data not available (404) - likely weekend/holiday');
        throw new Error('TCMB_NO_DATA_AVAILABLE');
      }

      if (!response.ok) {
        throw new Error(`TCMB API error: ${response.status} ${response.statusText}`);
      }

      const xml = await response.text();
      const quotes = this.parseXml(xml);

      logger.info({ count: quotes.length }, 'TCMB forex fetched successfully');
      return quotes;
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch forex from TCMB');
      throw error;
    }
  }

  /**
   * Fetch historical forex rates for a specific date
   * @param date Format: YYYYMMDD (e.g., "20240101")
   */
  async fetchHistoricalFx(date: Date): Promise<NormalizedQuote[]> {
    try {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      // TCMB URL format: /kurlar/YYMM/DDMMYY.xml
      const yearShort = String(year).slice(-2);
      const url = `${this.baseUrl}/${yearShort}${month}/${day}${month}${yearShort}.xml`;

      logger.debug({ url, date: date.toISOString() }, 'Fetching historical TCMB data');

      const response = await fetch(url, {
        headers: { 'User-Agent': 'Valora/1.0' },
        signal: AbortSignal.timeout(8000),
      });

      if (response.status === 404) {
        // No data for this date (weekend/holiday)
        return [];
      }

      if (!response.ok) {
        throw new Error(`TCMB historical API error: ${response.status}`);
      }

      const xml = await response.text();
      const quotes = this.parseXml(xml);

      // Override timestamp with the historical date
      const historicalTs = Math.floor(date.getTime() / 1000);
      quotes.forEach((q) => (q.ts = historicalTs));

      return quotes;
    } catch (error) {
      logger.warn({ err: error, date }, 'Failed to fetch historical TCMB data');
      return []; // Return empty array for missing dates
    }
  }

  /**
   * Parse TCMB XML to normalized quotes
   */
  private parseXml(xml: string): NormalizedQuote[] {
    const quotes: NormalizedQuote[] = [];
    const now = Math.floor(Date.now() / 1000);

    try {
      const parsed: TcmbResponse = this.parser.parse(xml);
      const currencies = parsed.Tarih_Date.Currency;

      if (!Array.isArray(currencies)) {
        logger.warn('TCMB XML parsing: currencies is not an array');
        return [];
      }

      // Map TCMB currencies to our instrument IDs
      for (const [tcmbCode, instrumentId] of Object.entries(FOREX_MAPPINGS)) {
        const currency = currencies.find((c) => c['@_CurrencyCode'] === tcmbCode);
        if (!currency) continue;

        try {
          const buy = parseFloat(currency.ForexBuying || '0');
          const sell = parseFloat(currency.ForexSelling || '0');
          const price = (buy + sell) / 2;

          quotes.push({
            instrumentId,
            ts: now,
            price,
            buy: buy > 0 ? buy : null,
            sell: sell > 0 ? sell : null,
            source: 'tcmb',
            rawData: currency,
          });
        } catch (error) {
          logger.warn({ tcmbCode, instrumentId, err: error }, 'Failed to parse forex instrument');
        }
      }

      // Calculate EURUSD (EUR / USD)
      const eurTry = quotes.find((q) => q.instrumentId === 'EURTRY');
      const usdTry = quotes.find((q) => q.instrumentId === 'USDTRY');

      if (eurTry && usdTry && usdTry.price > 0) {
        const eurUsdPrice = eurTry.price / usdTry.price;
        const eurUsdBuy = eurTry.buy && usdTry.sell ? eurTry.buy / usdTry.sell : null;
        const eurUsdSell = eurTry.sell && usdTry.buy ? eurTry.sell / usdTry.buy : null;

        quotes.push({
          instrumentId: 'EURUSD',
          ts: now,
          price: eurUsdPrice,
          buy: eurUsdBuy,
          sell: eurUsdSell,
          source: 'tcmb_calculated',
        });
      }

      return quotes;
    } catch (error) {
      logger.error({ err: error }, 'Failed to parse TCMB XML');
      return [];
    }
  }

  /**
   * Backfill historical data for the past N years
   * Fetches data day by day (skips weekends/holidays automatically)
   */
  async backfillHistoricalData(years: number = 10): Promise<NormalizedQuote[]> {
    logger.info({ years }, 'Starting TCMB historical data backfill');
    const allQuotes: NormalizedQuote[] = [];
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - years);

    let currentDate = new Date(startDate);
    let fetchedDays = 0;
    let skippedDays = 0;

    while (currentDate <= endDate) {
      // Skip weekends (TCMB doesn't publish on weekends)
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        currentDate.setDate(currentDate.getDate() + 1);
        skippedDays++;
        continue;
      }

      const quotes = await this.fetchHistoricalFx(currentDate);
      if (quotes.length > 0) {
        allQuotes.push(...quotes);
        fetchedDays++;
      } else {
        skippedDays++;
      }

      // Log progress every 30 days
      if (fetchedDays % 30 === 0) {
        logger.info(
          { fetchedDays, skippedDays, currentDate: currentDate.toISOString() },
          'Historical backfill progress'
        );
      }

      // Rate limiting: Wait 100ms between requests to avoid overwhelming TCMB
      await new Promise((resolve) => setTimeout(resolve, 100));

      currentDate.setDate(currentDate.getDate() + 1);
    }

    logger.info(
      { totalQuotes: allQuotes.length, fetchedDays, skippedDays },
      'TCMB historical backfill completed'
    );

    return allQuotes;
  }
}
