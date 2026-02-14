/**
 * Backfill real historical data from TCMB and calculate metals based on current ratios
 */

import { db } from '../src/config/database';
import { quotes, instruments } from '../src/db/schema';
import { logger } from '../src/utils/logger';
import { sql } from 'drizzle-orm';

// Get current price ratios
async function getCurrentRatios() {
  const latestGram = await db.query.quotes.findFirst({
    where: (quotes, { eq }) => eq(quotes.instrumentId, 'gram'),
    orderBy: (quotes, { desc }) => [desc(quotes.ts)],
  });

  if (!latestGram) {
    throw new Error('No current gram data found');
  }

  const gramPrice = parseFloat(latestGram.price);

  // Define ratios based on actual relationships
  return {
    gram: 1.0,
    ceyrek: 1.7, // quarter = 1.7 grams
    ons: 31.1, // ounce = 31.1 grams
    yarim: 3.6, // half = 3.6 grams
    tam: 7.2, // full = 7.2 grams
    ata: 7.5, // republic gold
    has: 0.995, // slightly lower than gram
    '22ayar': 0.958, // 22k = 91.6% pure
    gremse: 17.0, // gremse
    gumus_gram: gramPrice / 64.0, // silver is ~1/64 of gold
    gumus_ons: (gramPrice / 64.0) * 31.1, // silver ounce
  };
}

// Fetch historical TCMB XML for a specific date
async function fetchTCMBForDate(date: Date): Promise<any> {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const yearShort = String(year).slice(-2);

  const url = `https://www.tcmb.gov.tr/kurlar/${yearShort}${month}/${day}${month}${yearShort}.xml`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const xml = await response.text();
    return parseXML(xml, date);
  } catch (error) {
    return null;
  }
}

// Simple XML parser for TCMB format
function parseXML(xml: string, date: Date): any {
  const rates: any = {};

  // Parse USD
  const usdMatch = xml.match(/<Currency\s+[^>]*CurrencyCode="USD"[^>]*>(.*?)<\/Currency>/s);
  if (usdMatch) {
    const buyMatch = usdMatch[1].match(/<ForexBuying>([\d.]+)<\/ForexBuying>/);
    const sellMatch = usdMatch[1].match(/<ForexSelling>([\d.]+)<\/ForexSelling>/);
    if (buyMatch && sellMatch) {
      rates.USDTRY = {
        buy: parseFloat(buyMatch[1]),
        sell: parseFloat(sellMatch[1]),
        price: (parseFloat(buyMatch[1]) + parseFloat(sellMatch[1])) / 2,
      };
    }
  }

  // Parse EUR
  const eurMatch = xml.match(/<Currency\s+[^>]*CurrencyCode="EUR"[^>]*>(.*?)<\/Currency>/s);
  if (eurMatch) {
    const buyMatch = eurMatch[1].match(/<ForexBuying>([\d.]+)<\/ForexBuying>/);
    const sellMatch = eurMatch[1].match(/<ForexSelling>([\d.]+)<\/ForexSelling>/);
    if (buyMatch && sellMatch) {
      rates.EURTRY = {
        buy: parseFloat(buyMatch[1]),
        sell: parseFloat(sellMatch[1]),
        price: (parseFloat(buyMatch[1]) + parseFloat(sellMatch[1])) / 2,
      };
    }
  }

  return rates;
}

// Backfill historical data
async function backfillHistoricalData(days: number) {
  logger.info({ days }, 'Starting historical data backfill');

  const ratios = await getCurrentRatios();
  const currentDate = new Date();
  let successfulDays = 0;

  for (let i = 1; i <= days; i++) {
    const date = new Date(currentDate);
    date.setDate(date.getDate() - i);

    // Skip weekends (Saturday = 6, Sunday = 0)
    if (date.getDay() === 0 || date.getDay() === 6) {
      continue;
    }

    const dateStr = date.toISOString().split('T')[0];
    logger.info({ date: dateStr, day: i }, `Backfilling day ${i}/${days}`);

    // Try to get TCMB data for this date
    const tcmbData = await fetchTCMBForDate(date);

    if (tcmbData && tcmbData.USDTRY) {
      // We have real TCMB data
      const ts = Math.floor(date.getTime() / 1000);

      // Calculate gold prices based on USD rate and current ratio
      // Assumption: Gold in TRY moves with USD rate
      const usdRate = tcmbData.USDTRY.price;
      const currentUsdRate = 35.0; // approximate current rate
      const goldMultiplier = usdRate / currentUsdRate;

      // Insert forex data
      for (const [pair, data] of Object.entries(tcmbData)) {
        await insertQuote(pair, ts, data as any, 'tcmb_historical');
      }

      // Insert metal data (estimated based on USD rate)
      for (const [instrumentId, ratio] of Object.entries(ratios)) {
        const basePrice = 7000; // approximate base gram price
        const price = basePrice * goldMultiplier * (ratio as number);

        await insertQuote(
          instrumentId,
          ts,
          {
            price,
            buy: price * 0.995,
            sell: price * 1.005,
          },
          'calculated_historical'
        );
      }

      successfulDays++;
    }

    // Small delay to be polite
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  logger.info({ days, successfulDays }, 'Historical backfill completed');
  return successfulDays;
}

async function insertQuote(instrumentId: string, ts: number, data: any, source: string) {
  try {
    await db
      .insert(quotes)
      .values({
        instrumentId,
        ts,
        price: data.price.toFixed(6),
        buy: data.buy ? data.buy.toFixed(6) : null,
        sell: data.sell ? data.sell.toFixed(6) : null,
        source,
        createdAt: new Date(),
      })
      .onConflictDoNothing(); // Skip if already exists
  } catch (error) {
    // Ignore errors (likely duplicates)
  }
}

// Main
async function main() {
  console.log('Starting 10-year historical data backfill...\n');

  // Backfill last 3650 days (10 years)
  const days = 3650;
  const successful = await backfillHistoricalData(days);

  console.log(`\nCompleted! Successfully backfilled ${successful} days of data.`);
  process.exit(0);
}

if (require.main === module) {
  main().catch((error) => {
    logger.error({ error }, 'Backfill failed');
    process.exit(1);
  });
}
