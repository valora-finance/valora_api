import { buildApp } from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { initScheduler, initialDataFetch } from './utils/scheduler';

async function start() {
  try {
    const app = await buildApp();

    await app.listen({
      port: config.port,
      host: config.host,
    });

    logger.info(
      { port: config.port, host: config.host, env: config.env },
      'Server started successfully'
    );

    // Initialize background scheduler
    initScheduler();

    // Perform initial data fetch (non-blocking)
    initialDataFetch().catch((err) => {
      logger.error({ err }, 'Initial data fetch failed, but server will continue');
    });

    // Graceful shutdown
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        logger.info({ signal }, 'Received shutdown signal');
        await app.close();
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

start();
