import { db } from '../src/config/database';
import { quotes } from '../src/db/schema';
import { logger } from '../src/utils/logger';
import { eq } from 'drizzle-orm';

interface AltinKaynakDataPoint {
  Satis: string; // "491000,00" format
  GuncellenmeZamani: string; // "02.01.1995 00:00:00" format
}

// Mapping: our instrumentId -> altinkaynak product ID
// Only forex - metals come from haremaltin
const INSTRUMENT_MAPPING: Record<string, { id: number; category: string }> = {
  // Forex only
  'USDTRY': { id: 1, category: 'doviz' },
  'EURTRY': { id: 3, category: 'doviz' },
  'GBPTRY': { id: 5, category: 'doviz' },
  'CHFTRY': { id: 4, category: 'doviz' },
  'AUDTRY': { id: 11, category: 'doviz' },
  'CADTRY': { id: 12, category: 'doviz' },
  'SARTRY': { id: 10, category: 'doviz' },
  'JPYTRY': { id: 9, category: 'doviz' },
};

/**
 * Parse Turkish decimal format "491000,00" to number
 */
function parsePrice(priceStr: string): number {
  // Remove thousand separators (.) and replace decimal comma with dot
  return parseFloat(priceStr.replace(/\./g, '').replace(',', '.'));
}

/**
 * Parse Turkish date format "02.01.1995 00:00:00" to Unix timestamp
 */
function parseDate(dateStr: string): number {
  const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!match) {
    throw new Error(`Failed to parse date: ${dateStr}`);
  }

  const [, day, month, year, hour, minute, second] = match;
  const date = new Date(
    parseInt(year),
    parseInt(month) - 1, // JS months are 0-indexed
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second)
  );

  return Math.floor(date.getTime() / 1000);
}

/**
 * Convert Unix timestamp to .NET ticks
 * .NET ticks = 100-nanosecond intervals since 01/01/0001
 * Unix epoch (01/01/1970) in .NET ticks = 621355968000000000
 */
function unixToNetTicks(unixSeconds: number): string {
  const TICKS_AT_UNIX_EPOCH = 621355968000000000n;
  const TICKS_PER_SECOND = 10000000n;

  const ticks = TICKS_AT_UNIX_EPOCH + (BigInt(unixSeconds) * TICKS_PER_SECOND);
  return ticks.toString();
}

/**
 * Fetch historical data from altinkaynak API
 */
async function fetchAltinKaynakData(
  productId: number,
  category: string,
  startTicks: string,
  endTicks: string
): Promise<AltinKaynakDataPoint[] | null> {
  const url = `https://api.altinkaynak.com/kur/getrange/${category}/${productId}/start/${startTicks}/end/${endTicks}`;

  try {
    const response = await fetch(url, {
      headers: {
        'origin': 'https://www.altinkaynak.com',
        'referer': 'https://www.altinkaynak.com/',
        'x-token': 'f5f4a6ac-c1b3-11f0-8de9-0242ac120002_mobil',
      },
    });

    if (!response.ok) {
      logger.error({ status: response.status, url }, 'Failed to fetch from altinkaynak');
      return null;
    }

    const data = await response.json();
    return data as AltinKaynakDataPoint[];
  } catch (error) {
    logger.error({ error, url }, 'Failed to fetch from altinkaynak');
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
async function backfillInstrument(
  instrumentId: string,
  productId: number,
  category: string,
  startTicks: string,
  endTicks: string
) {
  logger.info({ instrumentId, productId, category }, 'Fetching data from altinkaynak');

  const data = await fetchAltinKaynakData(productId, category, startTicks, endTicks);
  if (!data || data.length === 0) {
    logger.warn({ instrumentId, productId }, 'No data returned from API');
    return 0;
  }

  logger.info({ instrumentId, count: data.length }, 'Parsing and preparing data');

  // Parse and prepare data
  const records = [];
  for (const point of data) {
    try {
      const ts = parseDate(point.GuncellenmeZamani);
      const price = parsePrice(point.Satis);

      records.push({
        instrumentId,
        ts,
        price: price.toString(),
        buy: null,
        sell: price.toString(),
        source: 'altinkaynak',
      });
    } catch (error) {
      logger.warn(
        { instrumentId, dateStr: point.GuncellenmeZamani, error },
        'Failed to parse data point, skipping'
      );
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
    // Calculate date range: 10 years of data
    const now = Math.floor(Date.now() / 1000);
    const tenYearsAgo = now - (10 * 365.25 * 24 * 60 * 60);

    const startTicks = unixToNetTicks(tenYearsAgo);
    const endTicks = unixToNetTicks(now);

    logger.info(
      {
        startDate: new Date(tenYearsAgo * 1000).toISOString(),
        endDate: new Date(now * 1000).toISOString(),
        startTicks,
        endTicks,
        instrumentCount: Object.keys(INSTRUMENT_MAPPING).length,
      },
      'Starting backfill for all instruments'
    );

    let totalRecords = 0;

    for (const [instrumentId, { id: productId, category }] of Object.entries(INSTRUMENT_MAPPING)) {
      logger.info(
        { instrumentId, productId, category },
        `\n========== Processing ${instrumentId} ==========`
      );

      // Clear old data
      await clearInstrumentData(instrumentId);

      // Fetch and insert new data
      const recordCount = await backfillInstrument(
        instrumentId,
        productId,
        category,
        startTicks,
        endTicks
      );
      totalRecords += recordCount;

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.info(
      { totalRecords, instrumentCount: Object.keys(INSTRUMENT_MAPPING).length },
      '✅ All instruments backfilled successfully!'
    );
    process.exit(0);
  } catch (error) {
    logger.error({ error }, '❌ Backfill failed');
    process.exit(1);
  }
}

main();
