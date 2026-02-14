import { db } from '../src/config/database';
import { quotes } from '../src/db/schema';
import { logger } from '../src/utils/logger';
import { eq } from 'drizzle-orm';

interface HaremAltinDataPoint {
  alis: string; // Buy price
  satis: string; // Sell price
  kayit_tarihi: string; // Date in "YYYY-MM-DD HH:mm:ss" format
}

interface HaremAltinResponse {
  message: string;
  error: boolean;
  data: HaremAltinDataPoint[];
}

// Mapping: our instrumentId -> haremaltin product code
const INSTRUMENT_MAPPING: Record<string, string> = {
  // Metals
  'gram': 'KULCEALTIN',
  'has': 'ALTIN',
  'ceyrek': 'CEYREK_YENI',
  'yarim': 'YARIM_YENI',
  'tam': 'TEK_YENI',
  'ata': 'ATA_YENI',
  'gremse': 'GREMESE_YENI',
  '22ayar': 'AYAR22',
  'gumus_gram': 'GUMUSTRY',
  'ons': 'ONS',

  // Forex
  'USDTRY': 'USD',
  'EURTRY': 'EUR',
  'GBPTRY': 'GBP',
  'CHFTRY': 'CHF',
  'JPYTRY': 'JPY',
};

/**
 * Parse date string to Unix timestamp
 */
function parseDate(dateStr: string): number {
  const date = new Date(dateStr);
  return Math.floor(date.getTime() / 1000);
}

/**
 * Fetch historical data from haremaltin API
 *
 * IMPORTANT: Requires valid Cloudflare cookies to bypass protection
 */
async function fetchHaremAltinData(
  productCode: string,
  startDate: string,
  endDate: string,
  cookies: string
): Promise<HaremAltinResponse | null> {
  const url = 'https://www.haremaltin.com/ajax/cur/history';

  const body = new URLSearchParams({
    kod: productCode,
    dil_kodu: 'tr',
    tarih1: startDate,
    tarih2: endDate,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'accept': '*/*',
        'accept-language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'origin': 'https://www.haremaltin.com',
        'referer': 'https://www.haremaltin.com/grafik?tip=altin&birim=ALTIN',
        'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest',
        'cookie': cookies,
      },
      body: body.toString(),
    });

    if (!response.ok) {
      logger.error({ status: response.status, url }, 'Failed to fetch from haremaltin');
      return null;
    }

    const text = await response.text();
    logger.info({ sample: text.slice(0, 500) }, 'Raw response sample');

    const responseData = JSON.parse(text) as HaremAltinResponse;
    return responseData;
  } catch (error) {
    logger.error({ error, url }, 'Failed to fetch from haremaltin');
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
  productCode: string,
  startDate: string,
  endDate: string,
  cookies: string
) {
  logger.info({ instrumentId, productCode }, 'Fetching data from haremaltin');

  const response = await fetchHaremAltinData(productCode, startDate, endDate, cookies);
  if (!response || response.error || !response.data || response.data.length === 0) {
    logger.warn({ instrumentId, productCode, error: response?.message }, 'No data returned from API');
    return 0;
  }

  const data = response.data;
  logger.info({ instrumentId, count: data.length }, 'Parsing and preparing data');

  // Parse and prepare data
  const records: Array<{
    instrumentId: string;
    ts: number;
    price: string;
    buy: null;
    sell: string;
    source: string;
  }> = [];
  for (const point of data) {
    try {
      const ts = parseDate(point.kayit_tarihi);
      const price = parseFloat(point.satis);

      records.push({
        instrumentId,
        ts,
        price: price.toString(),
        buy: null,
        sell: price.toString(),
        source: 'haremaltin',
      });
    } catch (error) {
      logger.warn(
        { instrumentId, dateStr: point.kayit_tarihi, error },
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
    // IMPORTANT: Replace with actual cookies from browser
    const cookies = process.env.HAREMALTIN_COOKIES || '';

    if (!cookies) {
      logger.error('HAREMALTIN_COOKIES environment variable not set');
      logger.info('Please provide cookies from your browser:');
      logger.info('1. Open https://www.haremaltin.com in browser');
      logger.info('2. Open DevTools > Network tab');
      logger.info('3. Make a request to /ajax/cur/history');
      logger.info('4. Copy the Cookie header value');
      logger.info('5. Run: HAREMALTIN_COOKIES="your-cookies-here" npx ts-node scripts/backfill-haremaltin.ts');
      process.exit(1);
    }

    // Calculate date range: 10 years of data
    const now = new Date();
    const tenYearsAgo = new Date(now.getTime() - (10 * 365.25 * 24 * 60 * 60 * 1000));

    const startDate = tenYearsAgo.toISOString().slice(0, 19).replace('T', ' ');
    const endDate = now.toISOString().slice(0, 19).replace('T', ' ');

    logger.info(
      {
        startDate,
        endDate,
        instrumentCount: Object.keys(INSTRUMENT_MAPPING).length,
      },
      'Starting backfill for all instruments from haremaltin'
    );

    let totalRecords = 0;

    for (const [instrumentId, productCode] of Object.entries(INSTRUMENT_MAPPING)) {
      logger.info(
        { instrumentId, productCode },
        `\n========== Processing ${instrumentId} ==========`
      );

      // Clear old data
      await clearInstrumentData(instrumentId);

      // Fetch and insert new data
      const recordCount = await backfillInstrument(
        instrumentId,
        productCode,
        startDate,
        endDate,
        cookies
      );
      totalRecords += recordCount;

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.info(
      { totalRecords, instrumentCount: Object.keys(INSTRUMENT_MAPPING).length },
      '✅ All instruments backfilled successfully from haremaltin!'
    );
    process.exit(0);
  } catch (error) {
    logger.error({ error }, '❌ Backfill failed');
    process.exit(1);
  }
}

main();
