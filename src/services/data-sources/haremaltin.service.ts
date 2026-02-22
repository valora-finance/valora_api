import { execSync } from 'child_process';
import { logger } from '../../utils/logger';
import { HAREMALTIN_MAPPINGS } from '../../config/instruments';
import type { NormalizedQuote } from './truncgil.service';

// Response type from haremaltin.com /ajax/cur/history
type HaremalAltinHistoryItem = {
  alis: string;           // Buy price (Turkish decimal: "441,50" or "441.50")
  satis: string;          // Sell price
  kayit_tarihi?: string;  // Date field from API: "2026-02-21 23:59:01"
  tarih?: string;         // Alternate date field: "2021-02-22" or "22.02.2021"
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
      const raw = await this.fetchWithCurl(kod, body.toString(), cfClearance);

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
        const dateStr = item.kayit_tarihi ?? item.tarih ?? '';
        const ts = this.parseDateToTs(dateStr);
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
    return HAREMALTIN_MAPPINGS[kod] ?? kod.toLowerCase();
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
   * Parse price string to number.
   * Haremaltin API returns English decimal format: "7356.1000", "411.4500"
   * Also handles Turkish format just in case: "1.441,50" (dot=thousand, comma=decimal)
   */
  private parsePrice(priceStr: string): number {
    if (!priceStr) return 0;

    // If string contains comma → Turkish format (dot=thousand, comma=decimal)
    if (priceStr.includes(',')) {
      const normalized = priceStr.replace(/\./g, '').replace(',', '.');
      return parseFloat(normalized) || 0;
    }

    // Otherwise English format: dot is decimal separator
    return parseFloat(priceStr) || 0;
  }

  /**
   * Fetch the most recent prices for given instrument codes.
   * Uses the history endpoint with a short date range to get near-live data.
   */
  async fetchLatest(
    kodList: string[],
    cfClearance: string
  ): Promise<NormalizedQuote[]> {
    const allQuotes: NormalizedQuote[] = [];
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 2); // Last 2 days to ensure data

    for (const kod of kodList) {
      try {
        const quotes = await this.fetchHistory(kod, startDate, endDate, cfClearance);
        if (quotes.length > 0) {
          // Take only the most recent data point
          const latest = quotes[quotes.length - 1];
          allQuotes.push(latest);
        }
      } catch (error) {
        logger.warn({ kod, err: error }, 'Failed to fetch latest from haremaltin');
      }
    }

    return allQuotes;
  }

  /**
   * Fetch from haremaltin using curl subprocess.
   * Node.js fetch gets 403 from Cloudflare due to TLS fingerprinting,
   * but curl works fine with the same cf_clearance cookie.
   */
  private async fetchWithCurl(
    kod: string,
    bodyStr: string,
    cfClearance: string
  ): Promise<unknown> {
    const url = `${this.baseUrl}/ajax/cur/history`;
    const curlCmd = [
      'curl', '-s', '-S', '--max-time', '30',
      '-X', 'POST', url,
      '-H', 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8',
      '-H', 'X-Requested-With: XMLHttpRequest',
      '-H', `Origin: ${this.baseUrl}`,
      '-H', `Referer: ${this.baseUrl}/grafik?tip=altin&birim=${kod}`,
      '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
      '-H', 'Accept: application/json, text/javascript, */*; q=0.01',
      '-H', 'sec-ch-ua: "Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
      '-H', 'sec-ch-ua-mobile: ?0',
      '-H', 'sec-ch-ua-platform: "macOS"',
      '-H', 'sec-fetch-dest: empty',
      '-H', 'sec-fetch-mode: cors',
      '-H', 'sec-fetch-site: same-origin',
      '-b', `cf_clearance=${cfClearance}`,
      '-d', bodyStr,
    ];

    // Escape for shell execution
    const escaped = curlCmd.map(arg => {
      if (arg.includes(' ') || arg.includes('"') || arg.includes("'") || arg.includes(';') || arg.includes('&')) {
        return `'${arg.replace(/'/g, "'\\''")}'`;
      }
      return arg;
    }).join(' ');

    try {
      const output = execSync(escaped, {
        encoding: 'utf-8',
        timeout: 35000,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });

      if (!output || output.trim().length === 0) {
        throw new Error('Empty response from haremaltin curl');
      }

      return JSON.parse(output);
    } catch (error) {
      const err = error as Error & { status?: number; stderr?: string };
      logger.error(
        { kod, stderr: err.stderr?.slice(0, 200), message: err.message },
        'curl request to haremaltin failed'
      );
      throw new Error(`haremaltin curl failed for ${kod}: ${err.message}`);
    }
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
