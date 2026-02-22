import https from 'https';
import { logger } from '../../utils/logger';
import type { NormalizedQuote } from './truncgil.service';

// altin.in instrument codes → our instrument IDs
const KUR_MAPPINGS: Record<string, string> = {
  Y14: '14ayar',
  Y22: '22ayar',
  ALTIN: 'gram',
  KULCE: 'has',
  ONS: 'ons',
  CEYREK: 'ceyrek',
  YARIM: 'yarim',
  TAM: 'tam',
  ATA: 'ata',
  GUMUS: 'gumus_gram',
};

// Turkish month names → month index (0-based)
const TR_MONTHS: Record<string, number> = {
  'Ocak': 0, 'Subat': 1, 'Mart': 2, 'Nisan': 3, 'Mayis': 4, 'Haziran': 5,
  'Temmuz': 6, 'Agustos': 7, 'Eylul': 8, 'Ekim': 9, 'Kasim': 10, 'Aralik': 11,
  // Also handle common encodings/variations
  'Şubat': 1, 'Mayıs': 4, 'Ağustos': 7, 'Eylül': 8, 'Kasım': 10, 'Aralık': 11,
};

export class AltinInService {
  private baseUrl = 'https://altin.in';

  /**
   * Fetch historical daily prices from altin.in
   * @param kur  Instrument code e.g. 'Y14', 'ALTIN', 'CEYREK'
   * @param days Number of days of history (max ~1825 = 5 years)
   */
  async fetchHistory(kur: string, days: number = 1825): Promise<NormalizedQuote[]> {
    const url = `${this.baseUrl}/grafikur.asp?did=flash_grafik&ca=1&islem=gunluk&gun=${days}&sa=sat&kur=${kur}&banka=altin&k=`;
    logger.info({ kur, days }, 'Fetching history from altin.in');

    const raw = await this.fetchUrl(url);
    return this.parse(kur, raw);
  }

  private parse(kur: string, raw: string): NormalizedQuote[] {
    const instrumentId = KUR_MAPPINGS[kur] ?? kur.toLowerCase();

    const satisMatch = raw.match(/satis:\[([^\]]+)\]/);
    const tarihMatch = raw.match(/tarih:\[([^\]]+)\]/);

    if (!satisMatch || !tarihMatch) {
      logger.error({ kur }, 'altin.in: could not parse satis or tarih from response');
      return [];
    }

    const satisPrices = satisMatch[1].split(',').map(Number);
    // Dates come as: "23 Şubat 2023" — strip quotes and parse
    const dateStrings = tarihMatch[1]
      .split('","')
      .map(s => s.replace(/^"|"$/g, '').trim());

    if (satisPrices.length !== dateStrings.length) {
      logger.warn({ kur, priceCount: satisPrices.length, dateCount: dateStrings.length }, 'altin.in: price/date count mismatch');
    }

    const quotes: NormalizedQuote[] = [];
    const count = Math.min(satisPrices.length, dateStrings.length);

    for (let i = 0; i < count; i++) {
      const ts = this.parseTurkishDate(dateStrings[i]);
      if (!ts) continue;

      const sell = satisPrices[i];
      if (!sell || isNaN(sell) || sell <= 0) continue;

      quotes.push({
        instrumentId,
        ts,
        price: sell,          // Only sell price available from this endpoint
        buy: null,
        sell,
        source: 'altin_in',
        rawData: { tarih: dateStrings[i], satis: sell },
      });
    }

    logger.info({ kur, instrumentId, count: quotes.length }, 'altin.in history parsed');
    return quotes;
  }

  /**
   * Parse Turkish date string like "23 Şubat 2023" or "23 Subat 2023"
   * Handles encoding issues by normalizing accented chars
   */
  private parseTurkishDate(dateStr: string): number | null {
    // Normalize: remove accents / replace with ASCII equivalents
    const normalized = dateStr
      .replace(/\u015e|\u0053/g, 'S')   // Ş → S
      .replace(/\u015f/g, 's')           // ş → s
      .replace(/\u0131/g, 'i')           // ı → i
      .replace(/\u0130/g, 'I')           // İ → I
      .replace(/\u011e|\u011f/g, 'g')   // Ğ/ğ → g
      .replace(/\u00fc|\u00dc/g, 'u')   // ü/Ü → u
      .replace(/\u00f6|\u00d6/g, 'o')   // ö/Ö → o
      .replace(/\u00e7|\u00c7/g, 'c')   // ç/Ç → c
      // Handle windows-1254 garbled bytes common in curl
      .replace(/[^\x20-\x7E]/g, '');    // Strip non-ASCII

    const parts = normalized.trim().split(/\s+/);
    if (parts.length !== 3) return null;

    const [dayStr, monthStr, yearStr] = parts;
    const day = parseInt(dayStr, 10);
    const year = parseInt(yearStr, 10);

    // Try direct match first, then try stripping to first 3 chars
    let month = TR_MONTHS[monthStr];
    if (month === undefined) {
      // Try prefix match
      for (const [key, val] of Object.entries(TR_MONTHS)) {
        if (key.startsWith(monthStr.slice(0, 3)) || monthStr.startsWith(key.slice(0, 3))) {
          month = val;
          break;
        }
      }
    }

    if (month === undefined || isNaN(day) || isNaN(year)) {
      logger.warn({ dateStr, normalized }, 'altin.in: could not parse date');
      return null;
    }

    const date = new Date(Date.UTC(year, month, day, 12, 0, 0));
    return Math.floor(date.getTime() / 1000);
  }

  private fetchUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          // Response may be windows-1254 encoded — decode properly
          try {
            const decoder = new TextDecoder('windows-1254');
            resolve(decoder.decode(Buffer.concat(chunks)));
          } catch {
            resolve(Buffer.concat(chunks).toString('latin1'));
          }
        });
        res.on('error', reject);
      }).on('error', reject);
    });
  }
}
