import type { FastifyPluginAsync } from 'fastify';
import { db } from '../../config/database';
import { instruments } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { cacheService } from '../../services/cache.service';
import { logger } from '../../utils/logger';

type InstrumentsQuery = {
  category?: 'metals' | 'fx';
};

type InstrumentsResponse = {
  category: 'metals' | 'fx' | 'all';
  items: Array<{
    id: string;
    name: string;
    code: string;
    category: string;
    unit?: string | null;
    sortOrder: number;
  }>;
};

const instrumentsRoute: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/instruments
   * Returns list of available instruments (metals, forex)
   * Query params: ?category=metals|fx
   */
  fastify.get<{
    Querystring: InstrumentsQuery;
    Reply: InstrumentsResponse;
  }>('/v1/instruments', async (request, reply) => {
    const { category } = request.query;
    const cacheKey = `api:instruments:${category || 'all'}`;

    try {
      // Try cache first
      const cached = cacheService.get<InstrumentsResponse>(cacheKey);
      if (cached) {
        logger.debug({ category }, 'Serving instruments from cache');
        return cached;
      }

      // Fetch from database
      let instrumentsList;
      if (category) {
        instrumentsList = await db.query.instruments.findMany({
          where: eq(instruments.category, category),
          orderBy: instruments.sortOrder,
        });
      } else {
        instrumentsList = await db.query.instruments.findMany({
          orderBy: [instruments.category, instruments.sortOrder],
        });
      }

      if (instrumentsList.length === 0) {
        logger.warn({ category }, 'No instruments found');
        return reply.code(404).send({
          error: 'NO_INSTRUMENTS',
          message: 'No instruments found',
        } as any);
      }

      const response: InstrumentsResponse = {
        category: category || 'all',
        items: instrumentsList.map((i) => ({
          id: i.id,
          name: i.name,
          code: i.code,
          category: i.category,
          unit: i.unit,
          sortOrder: i.sortOrder,
        })),
      };

      // Cache for 1 hour (instruments rarely change)
      cacheService.set(cacheKey, response, 60 * 60 * 1000);

      logger.info({ category, count: response.items.length }, 'Served instruments data');
      return response;
    } catch (error) {
      logger.error({ err: error, category }, 'Failed to fetch instruments');
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch instruments',
      } as any);
    }
  });
};

export default instrumentsRoute;
