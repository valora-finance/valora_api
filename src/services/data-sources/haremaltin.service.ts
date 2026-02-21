import { logger } from '../../utils/logger';
import type { NormalizedQuote } from './truncgil.service';

// Response type from haremaltin.com /ajax/cur/history
// NOTE: Verify this against actual response if parsing fails
type HaremalAltinHistoryItem = {
  tarih: string;  // Date string, e.g. "2021-02-22" or "22.02.2021"
  alis: string;   // Buy price (Turkish decimal: "441,50" or "441.50")
  satis: string;  // Sell price
};

type HaremalAltinResponse = {
  data?: HaremalAltinHistoryItem[];
  // Some APIs wrap data differently — log raw response on first failure
};

export class HaremalAltinService {
  private baseUrl = 'https://www.haremaltin.com';

  /**
   * Fetch historical price data from haremaltin.com
   * Requires a valid cf_clearance cookie (get from browser DevTools)
   *
   * @param kod   Instrument code, e.g. 'AYAR14', 'AYAR22'
   * @param startDate  Range start
   * @param endDate    Range end
   * @param cfClearance  Value of the cf_clearance cookie
   */
  async fetchHistory(
    kod: string,
    startDate: Date,
    endDate: Date,
    cfClearance: string
  ): Promise<NormalizedQuote[]> {
    const tarih1 = this.formatDate(startDate);
    const tarih2 = this.formatDate(endDate);

    const body = new URLSearchParams({
      kod,
      dil_kodu: 'tr',
      tarih1,
      tarih2,
    });

    logger.info({ kod, tarih1, tarih2 }, 'Fetching historical data from haremaltin.com');

    try {
      const response = await fetch(`${this.baseUrl}/ajax/cur/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': this.baseUrl,
          'Referer': `${this.baseUrl}/grafik?tip=altin&birim=${kod}`,
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
          'Cookie': `cf_clearance=${cfClearance}`,
        },
        body: body.toString(),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`haremaltin API error: ${response.status} ${response.statusText}`);
      }

      const raw = await response.json();

      // Log raw response structure on first run to verify parsing
      logger.debug({ sample: JSON.stringify(raw).slice(0, 200) }, 'haremaltin raw response sample');

      const items = this.extractItems(raw);
      const quotes = this.parseToQuotes(kod, items);

      logger.info({ kod, count: quotes.length }, 'haremaltin history fetched successfully');
      return quotes;
    } catch (error) {
      logger.error({ err: error, kod }, 'Failed to fetch history from haremaltin.com');
      throw error;
    }
  }

  /**
   * Extract array of history items from the response.
   * Handles common wrapper patterns.
   */
  private extractItems(raw: unknown): HaremalAltinHistoryItem[] {
    if (Array.isArray(raw)) return raw as HaremalAltinHistoryItem[];

    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj['data'])) return obj['data'] as HaremalAltinHistoryItem[];
    if (Array.isArray(obj['sonuc'])) return obj['sonuc'] as HaremalAltinHistoryItem[];

    logger.error({ keys: Object.keys(obj) }, 'Unknown haremaltin response shape — check raw response');
    return [];
  }

  /**
   * Convert haremaltin history items to NormalizedQuote array
   */
  private parseToQuotes(kod: string, items: HaremalAltinHistoryItem[]): NormalizedQuote[] {
    // Map haremaltin kod → our instrument id
    const instrumentId = this.kodToInstrumentId(kod);
    const quotes: NormalizedQuote[] = [];

    for (const item of items) {
      try {
        const ts = this.parseDateToTs(item.tarih);
        if (!ts) continue;

        const buy = this.parsePrice(item.alis);
        const sell = this.parsePrice(item.satis);

        if (!buy && !sell) continue;

        quotes.push({
          instrumentId,
          ts,
          price: (buy + sell) / 2,
          buy: buy > 0 ? buy : null,
          sell: sell > 0 ? sell : null,
          source: 'haremaltin',
          rawData: item,
        });
      } catch (error) {
        logger.warn({ item, err: error }, 'Failed to parse haremaltin history item');
      }
    }

    return quotes;
  }

  /**
   * Map haremaltin instrument codes to our internal IDs
   */
  private kodToInstrumentId(kod: string): string {
    const map: Record<string, string> = {
      AYAR14: '14ayar',
      AYAR22: '22ayar',
    };
    return map[kod] ?? kod.toLowerCase();
  }

  /**
   * Parse Turkish date strings to Unix timestamp (seconds)
   * Handles: "2021-02-22", "22.02.2021", "22/02/2021"
   */
  private parseDateToTs(dateStr: string): number | null {
    if (!dateStr) return null;

    let date: Date | null = null;

    // ISO-like: "2021-02-22" or "2021-02-22 00:00:00"
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      date = new Date(dateStr.slice(0, 10) + 'T12:00:00Z');
    }
    // Turkish: "22.02.2021"
    else if (/^\d{2}\.\d{2}\.\d{4}/.test(dateStr)) {
      const [d, m, y] = dateStr.split('.');
      date = new Date(`${y}-${m}-${d}T12:00:00Z`);
    }
    // Slash: "22/02/2021"
    else if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
      const [d, m, y] = dateStr.split('/');
      date = new Date(`${y}-${m}-${d}T12:00:00Z`);
    }

    if (!date || isNaN(date.getTime())) {
      logger.warn({ dateStr }, 'Could not parse haremaltin date');
      return null;
    }

    return Math.floor(date.getTime() / 1000);
  }

  /**
   * Parse Turkish decimal price string to number
   * Handles: "441,50", "1.441,50", "441.50"
   */
  private parsePrice(priceStr: string): number {
    if (!priceStr) return 0;
    // Remove thousand separators (.) and replace decimal comma (,) with dot
    const normalized = priceStr.replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized) || 0;
  }

  /**
   * Format date as "YYYY-MM-DD HH:mm:ss" (haremaltin tarih1/tarih2 format)
   */
  private formatDate(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
      `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    );
  }
}
