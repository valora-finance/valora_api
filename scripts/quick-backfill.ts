import { TcmbService } from '../src/services/data-sources/tcmb.service';
import { db } from '../src/config/database';
import { quotes } from '../src/db/schema';
import { logger } from '../src/utils/logger';

async function quickBackfill() {
  const tcmbService = new TcmbService();
  const allQuotes: any[] = [];
  
  // Fetch last 30 days for quick testing
  const daysToFetch = 30;
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysToFetch);
  
  logger.info({ daysToFetch }, 'Starting quick backfill...');
  
  let currentDate = new Date(startDate);
  let fetchedDays = 0;
  
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    
    // Skip weekends
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      try {
        const dayQuotes = await tcmbService.fetchHistoricalFx(currentDate);
        if (dayQuotes.length > 0) {
          allQuotes.push(...dayQuotes);
          fetchedDays++;
          logger.info({ 
            date: currentDate.toISOString().split('T')[0],
            quotes: dayQuotes.length 
          }, 'Fetched historical data');
        }
      } catch (error) {
        logger.warn({ 
          date: currentDate.toISOString().split('T')[0],
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 'Failed to fetch day');
      }
      
      // Small delay to be nice to TCMB
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Insert in database
  if (allQuotes.length > 0) {
    logger.info({ totalQuotes: allQuotes.length }, 'Inserting into database...');
    
    const batchSize = 100;
    for (let i = 0; i < allQuotes.length; i += batchSize) {
      const batch = allQuotes.slice(i, i + batchSize);
      await db.insert(quotes).values(
        batch.map(q => ({
          instrumentId: q.instrumentId,
          ts: q.ts,
          price: q.price.toFixed(6),
          buy: q.buy ? q.buy.toFixed(6) : null,
          sell: q.sell ? q.sell.toFixed(6) : null,
          source: q.source,
        }))
      ).onConflictDoNothing();
    }
    
    logger.info({ fetchedDays, totalQuotes: allQuotes.length }, 'Quick backfill completed!');
  } else {
    logger.warn('No historical data fetched');
  }
  
  process.exit(0);
}

quickBackfill().catch(err => {
  logger.error({ err }, 'Quick backfill failed');
  process.exit(1);
});
