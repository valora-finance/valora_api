import { logger } from '../../utils/logger';
import type { NormalizedQuote } from './truncgil.service';

// ExchangeRate.host API response types
type ExchangeRateResponse = {
  success: boolean;
  base: string;
  date: string;
  rates: Record<string, number>;
};

/**
 * Fallback forex service using ExchangeRate.host
 * Free tier: 250 requests/month, no auth required
 */
export class ExchangeRateService {
  private baseUrl = 'https://api.exchangerate.host';

  /**
   * Fetch forex rates with TRY as base currency
   * This is a fallback when TCMB is unavailable
   */
  async fetchFx(): Promise<NormalizedQuote[]> {
    try {
      logger.debug('Fetching forex from ExchangeRate.host (fallback)...');

      // We need TRY as base to get XXXTR Y pairs
      // But ExchangeRate.host uses EUR as base, so we'll convert
      const symbols = ['USD', 'EUR', 'GBP', 'CHF', 'AUD', 'CAD', 'SAR', 'JPY', 'TRY'];
      const url = `${this.baseUrl}/latest?symbols=${symbols.join(',')}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Valora/1.0',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        throw new Error(`ExchangeRate.host API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as ExchangeRateResponse;

      if (!data.success || !data.rates.TRY) {
        throw new Error('Invalid response from ExchangeRate.host');
      }

      return this.parseRates(data);
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch forex from ExchangeRate.host');
      throw error;
    }
  }

  /**
   * Parse ExchangeRate.host response to normalized quotes
   * Base is EUR, so we need to calculate TRY-based pairs
   */
  private parseRates(data: ExchangeRateResponse): NormalizedQuote[] {
    const quotes: NormalizedQuote[] = [];
    const now = Math.floor(Date.now() / 1000);

    try {
      const rates = data.rates;

      // Get EUR/TRY rate (base is EUR)
      const eurTry = rates.TRY;
      if (!eurTry || eurTry === 0) {
        logger.warn('EUR/TRY rate not available');
        return [];
      }

      // Calculate other pairs relative to TRY
      // Formula: XXX/TRY = (EUR/TRY) / (EUR/XXX)
      const currencyMappings: Record<string, string> = {
        USD: 'USDTRY',
        EUR: 'EURTRY',
        GBP: 'GBPTRY',
        CHF: 'CHFTRY',
        AUD: 'AUDTRY',
        CAD: 'CADTRY',
        SAR: 'SARTRY',
        JPY: 'JPYTRY',
      };

      for (const [currency, instrumentId] of Object.entries(currencyMappings)) {
        const eurToForeign = rates[currency];
        if (!eurToForeign || eurToForeign === 0) {
          logger.warn({ currency }, 'Currency rate not available');
          continue;
        }

        const foreignToTry = eurTry / eurToForeign;

        quotes.push({
          instrumentId,
          ts: now,
          price: foreignToTry,
          buy: null, // ExchangeRate.host doesn't provide buy/sell spreads
          sell: null,
          source: 'exchangerate_host',
        });
      }

      // Calculate EURUSD (EUR / USD)
      const eurQuote = quotes.find((q) => q.instrumentId === 'EURTRY');
      const usdQuote = quotes.find((q) => q.instrumentId === 'USDTRY');

      if (eurQuote && usdQuote && usdQuote.price > 0) {
        const eurUsdPrice = eurQuote.price / usdQuote.price;

        quotes.push({
          instrumentId: 'EURUSD',
          ts: now,
          price: eurUsdPrice,
          buy: null,
          sell: null,
          source: 'exchangerate_host_calculated',
        });
      }

      logger.info({ count: quotes.length }, 'ExchangeRate.host forex fetched successfully');
      return quotes;
    } catch (error) {
      logger.error({ err: error }, 'Failed to parse ExchangeRate.host response');
      return [];
    }
  }
}
