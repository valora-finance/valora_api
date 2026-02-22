import { RefreshService } from '../services/refresh.service';
import { logger } from '../utils/logger';

async function main() {
  logger.info('Starting full metals historical backfill...');
  const refreshService = new RefreshService();

  const result = await refreshService.backfillHistoricalMetals(5);

  logger.info(
    { success: result.success, quotesCount: result.quotesCount },
    'Backfill completed'
  );
  process.exit(result.success ? 0 : 1);
}

main().catch((error) => {
  logger.error({ err: error }, 'Backfill script failed');
  process.exit(1);
});
