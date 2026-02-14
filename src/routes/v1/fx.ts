import type { FastifyPluginAsync } from 'fastify';
import { db } from '../../config/database';
import { latestQuotes, instruments } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { MapperService } from '../../services/mapper.service';
import { cacheService } from '../../services/cache.service';
import type { ApiLatestResponse } from '../../types/api.types';
import { logger } from '../../utils/logger';

const fxRoute: FastifyPluginAsync = async (fastify) => {
  const mapper = new MapperService();

  /**
   * GET /v1/fx/latest
   * Returns latest forex rates
   */
  fastify.get<{ Reply: ApiLatestResponse }>('/v1/fx/latest', async (request, reply) => {
    const cacheKey = 'api:fx:latest';

    try {
      // Try cache first
      const cached = cacheService.get<ApiLatestResponse>(cacheKey);
      if (cached) {
        logger.debug('Serving forex from cache');
        return cached;
      }

      // Fetch from database
      const fxInstruments = await db.query.instruments.findMany({
        where: eq(instruments.category, 'fx'),
        orderBy: instruments.sortOrder,
      });

      if (fxInstruments.length === 0) {
        logger.warn('No forex instruments found in database');
        return reply.code(503).send({
          error: 'NO_DATA',
          message: 'No forex instruments configured',
        } as any);
      }

      const instrumentIds = fxInstruments.map((i) => i.id);
      const quotes = await db.query.latestQuotes.findMany({
        where: (latestQuotes, { inArray }) => inArray(latestQuotes.instrumentId, instrumentIds),
      });

      if (quotes.length === 0) {
        logger.warn('No forex quotes found in database');
        return reply.code(503).send({
          error: 'NO_DATA',
          message: 'No forex data available. Data fetch may be in progress.',
        } as any);
      }

      // Map to API format
      const items = quotes.map((quote) => {
        const instrument = fxInstruments.find((i) => i.id === quote.instrumentId);
        return mapper.mapToApiRateItem(quote, instrument);
      });

      // Find most recent update timestamp
      const lastUpdatedTs = Math.max(...quotes.map((q) => q.ts));

      const response = mapper.mapToApiLatestResponse(
        'fx',
        items,
        'cache', // From database cache
        lastUpdatedTs
      );

      // Cache for 60 seconds
      cacheService.set(cacheKey, response, 60 * 1000);

      logger.info({ count: items.length }, 'Served forex data from database');
      return response;
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch forex data');
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch forex data',
      } as any);
    }
  });
};

export default fxRoute;
