import { logger } from '../../utils/logger';
import { METAL_MAPPINGS } from '../../config/instruments';

// Truncgil API response type
export type TruncgilMetalData = {
  Alış: string; // Buy price (Turkish decimal: "6.942,61")
  Satış: string; // Sell price
  Değişim: string; // Change percentage
  Tür: string; // Type
};

export type TruncgilResponse = Record<string, TruncgilMetalData>;

export type NormalizedQuote = {
  instrumentId: string;
  ts: number; // Unix timestamp (seconds)
  price: number;
  buy: number | null;
  sell: number | null;
  source: string;
  rawData?: unknown;
};

export class TruncgilService {
  private baseUrl = 'https://finans.truncgil.com';

  /**
   * Fetch current metals data from Truncgil API
   */
  async fetchMetals(): Promise<NormalizedQuote[]> {
    try {
      logger.debug('Fetching metals from Truncgil...');

      const response = await fetch(`${this.baseUrl}/today.json`, {
        headers: {
          'User-Agent': 'Valora/1.0',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000), // 8 second timeout
      });

      if (!response.ok) {
        throw new Error(`Truncgil API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as TruncgilResponse;
      const quotes = this.parseToQuotes(data);

      logger.info({ count: quotes.length }, 'Truncgil metals fetched successfully');
      return quotes;
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch metals from Truncgil');
      throw error;
    }
  }

  /**
   * Parse Truncgil response to normalized quotes
   */
  parseToQuotes(data: TruncgilResponse): NormalizedQuote[] {
    const quotes: NormalizedQuote[] = [];
    const now = Math.floor(Date.now() / 1000);

    for (const [truncgilKey, instrumentId] of Object.entries(METAL_MAPPINGS)) {
      const raw = data[truncgilKey];
      if (!raw) continue;

      try {
        const buy = this.parsePrice(raw.Alış);
        const sell = this.parsePrice(raw.Satış);
        const price = (buy + sell) / 2; // Average price

        quotes.push({
          instrumentId,
          ts: now,
          price,
          buy,
          sell,
          source: 'truncgil',
          rawData: raw,
        });
      } catch (error) {
        logger.warn({ truncgilKey, instrumentId, err: error }, 'Failed to parse metal instrument');
      }
    }

    // Calculate 14ayar (14-karat gold) from gram altın (24k) using 14/24 ratio
    const gramAltin = quotes.find((q) => q.instrumentId === 'gram');
    if (gramAltin) {
      const ratio = 14 / 24;
      quotes.push({
        instrumentId: '14ayar',
        ts: now,
        price: gramAltin.price * ratio,
        buy: gramAltin.buy ? gramAltin.buy * ratio : null,
        sell: gramAltin.sell ? gramAltin.sell * ratio : null,
        source: 'truncgil_calculated',
      });
    }

    // Calculate gumus_ons (silver ounce) from gumus (silver gram)
    const gumusGram = quotes.find((q) => q.instrumentId === 'gumus_gram');
    if (gumusGram) {
      quotes.push({
        instrumentId: 'gumus_ons',
        ts: now,
        price: gumusGram.price * 28.3495, // 1 oz = 28.3495 grams
        buy: gumusGram.buy ? gumusGram.buy * 28.3495 : null,
        sell: gumusGram.sell ? gumusGram.sell * 28.3495 : null,
        source: 'truncgil_calculated',
      });
    }

    return quotes;
  }

  /**
   * Parse Turkish decimal format to number
   * Example: "6.942,61" → 6942.61
   */
  parsePrice(priceStr: string): number {
    if (!priceStr) return 0;
    // Remove thousand separators (.) and replace decimal comma (,) with dot (.)
    const normalized = priceStr.replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized);
  }
}
