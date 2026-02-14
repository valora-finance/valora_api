import { db } from '../src/config/database';
import { quotes } from '../src/db/schema';
import { logger } from '../src/utils/logger';
import { eq } from 'drizzle-orm';

// Turkish month mapping (full names)
const TR_MONTHS: Record<string, number> = {
  'Ocak': 0, 'Şubat': 1, 'Mart': 2, 'Nisan': 3, 'Mayıs': 4, 'Haziran': 5,
  'Temmuz': 6, 'Ağustos': 7, 'Eylül': 8, 'Ekim': 9, 'Kasım': 10, 'Aralık': 11,
  // Handle encoding issues
  '�ubat': 1, 'A�ustos': 7, 'May�s': 4, 'Eyl�l': 8, 'Aral�k': 11
};

interface AltinInResponse {
  satis: number[];
  tarih: string[];
}

/**
 * Parse Turkish date format "09 Şubat 2023" to Unix timestamp
 */
function parseTurkishDate(dateStr: string): number {
  const match = dateStr.match(/(\d+)\s+([^\s]+)\s+(\d{4})/);
  if (!match) {
    throw new Error(`Failed to parse date: ${dateStr}`);
  }

  const [, day, monthStr, year] = match;
  const month = TR_MONTHS[monthStr];

  if (month === undefined) {
    throw new Error(`Unknown month: ${monthStr}`);
  }

  // Use noon as the time (12:00) for consistency
  const date = new Date(parseInt(year), month, parseInt(day), 12, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

/**
 * Fetch historical data from altin.in
 */
async function fetchAltinInData(days: number, kur: string): Promise<AltinInResponse | null> {
  const url = `https://altin.in/grafikur.asp?did=flash_grafik&ca=1&islem=gunluk&gun=${days}&sa=sat&kur=${kur}&banka=altin&k=`;

  try {
    const response = await fetch(url);
    const text = await response.text();

    // Extract JSON from JavaScript code
    const match = text.match(/window\['flash_grafik'\]\s*=\s*{kur:({[^}]+})}/);
    if (!match) {
      logger.error({ text }, 'Failed to parse altin.in response');
      return null;
    }

    // Parse the extracted JSON (with eval for simplicity, in controlled environment)
    const jsonStr = match[1];
    const data = eval(`(${jsonStr})`);

    return data as AltinInResponse;
  } catch (error) {
    logger.error({ error, url }, 'Failed to fetch from altin.in');
    return null;
  }
}

/**
 * Clear all historical metals data
 */
async function clearHistoricalData() {
  logger.info('Clearing existing historical metals data...');

  // Delete all historical data for gram (we'll re-populate it)
  await db.delete(quotes)
    .where(eq(quotes.instrumentId, 'gram'));

  logger.info('Historical data cleared');
}

/**
 * Backfill gram altın data from altin.in
 */
async function backfillGramAltin(days: number) {
  logger.info({ days }, 'Fetching gram altın data from altin.in...');

  const data = await fetchAltinInData(days, 'GA');
  if (!data) {
    throw new Error('Failed to fetch data');
  }

  const { satis, tarih } = data;

  if (satis.length !== tarih.length) {
    throw new Error('Data length mismatch');
  }

  logger.info({ count: satis.length }, 'Parsing and inserting data...');

  // Parse and prepare data
  const records = [];
  for (let i = 0; i < satis.length; i++) {
    try {
      const ts = parseTurkishDate(tarih[i]);
      const price = satis[i];

      records.push({
        instrumentId: 'gram',
        ts,
        price: price.toString(),
        buy: null,
        sell: price.toString(),
        source: 'altin_in',
      });
    } catch (error) {
      logger.warn({ dateStr: tarih[i], error }, 'Failed to parse date, skipping');
    }
  }

  // Sort by timestamp (oldest first)
  records.sort((a, b) => a.ts - b.ts);

  // Insert in batches
  const BATCH_SIZE = 100;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    await db.insert(quotes).values(batch);
    logger.info({ inserted: Math.min(i + BATCH_SIZE, records.length), total: records.length }, 'Batch inserted');
  }

  logger.info({ totalRecords: records.length }, 'Gram altın backfill complete');
  return records.length;
}

/**
 * Main backfill function
 */
async function main() {
  try {
    // Clear old data
    await clearHistoricalData();

    // Fetch 3 years of data (1095 days)
    const recordsInserted = await backfillGramAltin(1095);

    logger.info({ recordsInserted }, '✅ Backfill completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, '❌ Backfill failed');
    process.exit(1);
  }
}

main();
