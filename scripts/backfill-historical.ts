import { RefreshService } from '../src/services/refresh.service';
import { logger } from '../src/utils/logger';

async function backfillHistorical() {
  const refreshService = new RefreshService();
  
  logger.info('Starting 10-year historical forex backfill...');
  
  // Force backfill by calling the method directly
  const result = await refreshService.backfillHistoricalForex(10);
  
  if (result.success) {
    logger.info({ quotesCount: result.quotesCount }, 'Backfill completed successfully!');
  } else {
    logger.error('Backfill failed!');
  }
  
  process.exit(result.success ? 0 : 1);
}

backfillHistorical();
