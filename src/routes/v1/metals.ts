import type { FastifyPluginAsync } from 'fastify';
import { db } from '../../config/database';
import { latestQuotes, instruments } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { MapperService } from '../../services/mapper.service';
import { cacheService } from '../../services/cache.service';
import type { ApiLatestResponse } from '../../types/api.types';
import { logger } from '../../utils/logger';

const metalsRoute: FastifyPluginAsync = async (fastify) => {
  const mapper = new MapperService();

  /**
   * GET /v1/metals/latest
   * Returns latest metal prices (gold, silver)
   */
  fastify.get<{ Reply: ApiLatestResponse }>('/v1/metals/latest', async (request, reply) => {
    const cacheKey = 'api:metals:latest';

    try {
      // Try cache first
      const cached = cacheService.get<ApiLatestResponse>(cacheKey);
      if (cached) {
        logger.debug('Serving metals from cache');
        return cached;
      }

      // Fetch from database
      const metalInstruments = await db.query.instruments.findMany({
        where: eq(instruments.category, 'metals'),
        orderBy: instruments.sortOrder,
      });

      if (metalInstruments.length === 0) {
        logger.warn('No metal instruments found in database');
        return reply.code(503).send({
          error: 'NO_DATA',
          message: 'No metal instruments configured',
        } as any);
      }

      const instrumentIds = metalInstruments.map((i) => i.id);
      const quotes = await db.query.latestQuotes.findMany({
        where: (latestQuotes, { inArray }) => inArray(latestQuotes.instrumentId, instrumentIds),
      });

      if (quotes.length === 0) {
        logger.warn('No metal quotes found in database');
        return reply.code(503).send({
          error: 'NO_DATA',
          message: 'No metal data available. Data fetch may be in progress.',
        } as any);
      }

      // Map to API format
      const items = quotes.map((quote) => {
        const instrument = metalInstruments.find((i) => i.id === quote.instrumentId);
        return mapper.mapToApiRateItem(quote, instrument);
      });

      // Find most recent update timestamp
      const lastUpdatedTs = Math.max(...quotes.map((q) => q.ts));

      const response = mapper.mapToApiLatestResponse(
        'metals',
        items,
        'cache', // From database cache
        lastUpdatedTs
      );

      // Cache for 60 seconds
      cacheService.set(cacheKey, response, 60 * 1000);

      logger.info({ count: items.length }, 'Served metals data from database');
      return response;
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch metals data');
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch metals data',
      } as any);
    }
  });
};

export default metalsRoute;
