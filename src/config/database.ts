import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { config } from './index';
import { logger } from '../utils/logger';
import * as schema from '../db/schema';

// Create postgres connection
const queryClient = postgres(config.databaseUrl, {
  max: 3,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false, // Neon pooler (PgBouncer transaction mode) prepared statement desteklemez
});

// Create drizzle instance
export const db = drizzle(queryClient, { schema });

// Test database connection
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await queryClient`SELECT 1`;
    logger.info('Database connection successful');
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Database connection failed');
    return false;
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  await queryClient.end();
  logger.info('Database connection closed');
}
