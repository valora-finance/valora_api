import { db } from '../src/config/database';
import { quotes } from '../src/db/schema';
import { logger } from '../src/utils/logger';
import { eq } from 'drizzle-orm';

// Turkish month mapping (full names)
const TR_MONTHS: Record<string, number> = {
  'Ocak': 0, 'Mart': 2, 'Nisan': 3, 'Haziran': 5,
  'Temmuz': 6, 'Ekim': 9,
  // Handle encoding issues from API
  'Şubat': 1, '�ubat': 1,
  'Mayıs': 4, 'May�s': 4,
  'Ağustos': 7, 'A�ustos': 7,
  'Eylül': 8, 'Eyl�l': 8,
  'Kasım': 10, 'Kas�m': 10,
  'Aralık': 11, 'Aral�k': 11
};

interface AltinInResponse {
  satis: number[];
  tarih: string[];
}

// Mapping: our instrumentId -> altin.in kur code
const INSTRUMENT_MAPPING: Record<string, string> = {
  // Metals
  'gram': 'GA',           // Gram Altın
  'ceyrek': 'C',          // Çeyrek Altın
  'yarim': 'Y',           // Yarım Altın
  'tam': 'T2',            // Tam Altın
  'ata': 'A',             // Ata Lira
  'has': 'HA',            // Has Altın
  '22ayar': '22A',        // 22 Ayar
  'gremse': 'GR',         // Gremse
  'gumus_gram': 'G',      // Gümüş
  // Forex - altin.in uses different codes for forex
  'USDTRY': 'D',          // Dolar
  'EURTRY': 'E',          // Euro
  'GBPTRY': 'S',          // Sterlin
};

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
      logger.error({ text: text.substring(0, 200) }, 'Failed to parse altin.in response');
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
 * Clear historical data for a specific instrument
 */
async function clearInstrumentData(instrumentId: string) {
  logger.info({ instrumentId }, 'Clearing historical data for instrument');

  await db.delete(quotes)
    .where(eq(quotes.instrumentId, instrumentId));

  logger.info({ instrumentId }, 'Historical data cleared');
}

/**
 * Backfill data for a single instrument
 */
async function backfillInstrument(instrumentId: string, altinInCode: string, days: number) {
  logger.info({ instrumentId, altinInCode, days }, 'Fetching data from altin.in');

  const data = await fetchAltinInData(days, altinInCode);
  if (!data) {
    logger.error({ instrumentId, altinInCode }, 'Failed to fetch data, skipping');
    return 0;
  }

  const { satis, tarih } = data;

  if (satis.length !== tarih.length) {
    logger.error({ instrumentId, satisLen: satis.length, tarihLen: tarih.length }, 'Data length mismatch');
    return 0;
  }

  if (satis.length === 0) {
    logger.warn({ instrumentId }, 'No data returned from API');
    return 0;
  }

  logger.info({ instrumentId, count: satis.length }, 'Parsing and preparing data');

  // Parse and prepare data
  const records = [];
  for (let i = 0; i < satis.length; i++) {
    try {
      const ts = parseTurkishDate(tarih[i]);
      const price = satis[i];

      records.push({
        instrumentId,
        ts,
        price: price.toString(),
        buy: null,
        sell: price.toString(),
        source: 'altin_in',
      });
    } catch (error) {
      logger.warn({ instrumentId, dateStr: tarih[i], error }, 'Failed to parse date, skipping');
    }
  }

  if (records.length === 0) {
    logger.warn({ instrumentId }, 'No valid records after parsing');
    return 0;
  }

  // Sort by timestamp (oldest first)
  records.sort((a, b) => a.ts - b.ts);

  // Insert in batches
  const BATCH_SIZE = 100;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    await db.insert(quotes).values(batch);
  }

  logger.info({ instrumentId, totalRecords: records.length }, 'Instrument backfill complete');
  return records.length;
}

/**
 * Main backfill function for all instruments
 */
async function main() {
  try {
    const days = 1095; // 3 years
    let totalRecords = 0;

    logger.info({ instrumentCount: Object.keys(INSTRUMENT_MAPPING).length }, 'Starting backfill for all instruments');

    for (const [instrumentId, altinInCode] of Object.entries(INSTRUMENT_MAPPING)) {
      logger.info({ instrumentId, altinInCode }, `\n========== Processing ${instrumentId} ==========`);

      // Clear old data
      await clearInstrumentData(instrumentId);

      // Fetch and insert new data
      const recordCount = await backfillInstrument(instrumentId, altinInCode, days);
      totalRecords += recordCount;

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.info({ totalRecords, instrumentCount: Object.keys(INSTRUMENT_MAPPING).length }, '✅ All instruments backfilled successfully!');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, '❌ Backfill failed');
    process.exit(1);
  }
}

main();
