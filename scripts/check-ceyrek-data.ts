import { db } from '../src/config/database';
import { quotes } from '../src/db/schema';
import { eq, gte, desc } from 'drizzle-orm';
import { logger } from '../src/utils/logger';

async function main() {
  const now = Math.floor(Date.now() / 1000);
  const oneDayAgo = now - (24 * 60 * 60);

  const data = await db.select()
    .from(quotes)
    .where(gte(quotes.ts, oneDayAgo))
    .where(eq(quotes.instrumentId, 'ceyrek'))
    .orderBy(desc(quotes.ts))
    .limit(20);

  console.log('\n========== Last 20 ceyrek quotes in last 24 hours ==========');
  console.log(`Total found: ${data.length}\n`);

  data.forEach(q => {
    const date = new Date(q.ts * 1000);
    console.log(`${date.toISOString()} - Price: ${q.price}`);
  });

  // Check for duplicates
  const uniquePrices = new Set(data.map(q => q.price));
  console.log(`\nUnique prices: ${uniquePrices.size} out of ${data.length}`);

  if (uniquePrices.size === 1 && data.length > 1) {
    console.log('⚠️  WARNING: All prices are the same!');
  }

  process.exit(0);
}

main();
