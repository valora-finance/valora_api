import type { FastifyPluginAsync } from 'fastify';
import { db } from '../../config/database';
import { quotes } from '../../db/schema';
import { and, eq, gte, lte, desc } from 'drizzle-orm';
import { cacheService } from '../../services/cache.service';
import { logger } from '../../utils/logger';

type HistoryQuery = {
  instrumentId: string;
  from?: number; // Unix timestamp (seconds)
  to?: number; // Unix timestamp (seconds)
  limit?: number; // Max points to return
};

type HistoryResponse = {
  instrumentId: string;
  category: string;
  points: Array<{
    ts: number;
    price: number;
    buy?: number | null;
    sell?: number | null;
  }>;
};

const historyRoute: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/history
   * Returns historical price data for an instrument
   * Query params: ?instrumentId=gram&from=1234567890&to=1234567890&limit=1000
   */
  fastify.get<{
    Querystring: HistoryQuery;
    Reply: HistoryResponse;
  }>('/v1/history', async (request, reply) => {
    const { instrumentId, from, to, limit = 1000 } = request.query;

    if (!instrumentId) {
      return reply.code(400).send({
        error: 'MISSING_PARAMETER',
        message: 'instrumentId is required',
      } as any);
    }

    // Validate limit
    const validLimit = Math.min(Math.max(1, limit), 10000); // Max 10k points

    const cacheKey = `api:history:${instrumentId}:${from}:${to}:${validLimit}`;

    try {
      // Try cache first (5 minute TTL)
      const cached = cacheService.get<HistoryResponse>(cacheKey);
      if (cached) {
        logger.debug({ instrumentId }, 'Serving history from cache');
        return cached;
      }

      // Verify instrument exists
      const instrument = await db.query.instruments.findFirst({
        where: (instruments, { eq }) => eq(instruments.id, instrumentId),
      });

      if (!instrument) {
        return reply.code(404).send({
          error: 'INSTRUMENT_NOT_FOUND',
          message: `Instrument ${instrumentId} not found`,
        } as any);
      }

      // Build query conditions
      const conditions = [eq(quotes.instrumentId, instrumentId)];

      if (from) {
        conditions.push(gte(quotes.ts, from));
      }

      if (to) {
        conditions.push(lte(quotes.ts, to));
      }

      // Fetch historical quotes
      const historicalQuotes = await db.query.quotes.findMany({
        where: and(...conditions),
        orderBy: [desc(quotes.ts)],
        limit: validLimit,
      });

      if (historicalQuotes.length === 0) {
        logger.warn({ instrumentId, from, to }, 'No historical data found');
        return reply.code(404).send({
          error: 'NO_DATA',
          message: 'No historical data found for the specified range',
        } as any);
      }

      // Deduplicate: keep one record per calendar day.
      // Records are ordered desc(ts), so the first seen for a day is the latest timestamp.
      const seenDays = new Set<string>();
      const deduped = historicalQuotes.filter((q) => {
        const day = new Date(q.ts * 1000).toISOString().slice(0, 10); // YYYY-MM-DD
        if (seenDays.has(day)) return false;
        seenDays.add(day);
        return true;
      });

      const response: HistoryResponse = {
        instrumentId,
        category: instrument.category,
        points: deduped.map((q) => ({
          ts: q.ts,
          price: parseFloat(q.price),
          buy: q.buy ? parseFloat(q.buy) : null,
          sell: q.sell ? parseFloat(q.sell) : null,
        })),
      };

      // Cache for 5 minutes
      cacheService.set(cacheKey, response, 5 * 60 * 1000);

      logger.info(
        { instrumentId, from, to, count: response.points.length },
        'Served historical data'
      );
      return response;
    } catch (error) {
      logger.error({ err: error, instrumentId }, 'Failed to fetch historical data');
      return reply.code(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch historical data',
      } as any);
    }
  });
};

export default historyRoute;
