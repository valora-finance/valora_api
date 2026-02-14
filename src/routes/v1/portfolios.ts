import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth';
import { PortfolioService } from '../../services/portfolio.service';
import { logger } from '../../utils/logger';

const portfolioService = new PortfolioService();

const portfoliosRoute: FastifyPluginAsync = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  // GET /v1/portfolios - List all portfolios with summary
  fastify.get('/v1/portfolios', async (request, reply) => {
    try {
      const result = await portfolioService.getPortfolios(request.authUser!.id);
      return result;
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch portfolios');
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to fetch portfolios' });
    }
  });

  // POST /v1/portfolios - Create a portfolio
  fastify.post<{ Body: { name: string; type: 'birikim' | 'borc'; icon?: string; color?: string } }>(
    '/v1/portfolios',
    async (request, reply) => {
      const { name, type, icon, color } = request.body;

      if (!name || !type) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Name and type are required' });
      }

      if (type !== 'birikim' && type !== 'borc') {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Type must be birikim or borc' });
      }

      try {
        const portfolio = await portfolioService.createPortfolio(request.authUser!.id, { name, type, icon, color });
        return reply.code(201).send(portfolio);
      } catch (error) {
        logger.error({ err: error }, 'Failed to create portfolio');
        return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to create portfolio' });
      }
    }
  );

  // GET /v1/portfolios/:id - Get portfolio detail with holdings
  fastify.get<{ Params: { id: string } }>('/v1/portfolios/:id', async (request, reply) => {
    try {
      const result = await portfolioService.getPortfolioDetail(request.params.id, request.authUser!.id);
      if (!result) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Portfolio not found' });
      }
      return result;
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch portfolio detail');
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to fetch portfolio' });
    }
  });

  // PATCH /v1/portfolios/:id - Update portfolio
  fastify.patch<{ Params: { id: string }; Body: { name?: string; icon?: string; color?: string; sortOrder?: number } }>(
    '/v1/portfolios/:id',
    async (request, reply) => {
      try {
        const updated = await portfolioService.updatePortfolio(request.params.id, request.authUser!.id, request.body);
        if (!updated) {
          return reply.code(404).send({ error: 'NOT_FOUND', message: 'Portfolio not found' });
        }
        return updated;
      } catch (error) {
        logger.error({ err: error }, 'Failed to update portfolio');
        return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to update portfolio' });
      }
    }
  );

  // DELETE /v1/portfolios/:id - Delete portfolio
  fastify.delete<{ Params: { id: string } }>('/v1/portfolios/:id', async (request, reply) => {
    try {
      const deleted = await portfolioService.deletePortfolio(request.params.id, request.authUser!.id);
      if (!deleted) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Portfolio not found' });
      }
      return { success: true };
    } catch (error) {
      logger.error({ err: error }, 'Failed to delete portfolio');
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to delete portfolio' });
    }
  });

  // POST /v1/portfolios/:id/holdings - Add holding
  fastify.post<{
    Params: { id: string };
    Body: { instrumentId: string; quantity: string; purchasePrice: string; purchaseDate: string; description?: string };
  }>('/v1/portfolios/:id/holdings', async (request, reply) => {
    const { instrumentId, quantity, purchasePrice, purchaseDate, description } = request.body;

    if (!instrumentId || !quantity || !purchasePrice || !purchaseDate) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'instrumentId, quantity, purchasePrice, and purchaseDate are required' });
    }

    try {
      const holding = await portfolioService.addHolding(request.params.id, request.authUser!.id, {
        instrumentId,
        quantity,
        purchasePrice,
        purchaseDate,
        description,
      });

      if (!holding) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Portfolio not found' });
      }

      return reply.code(201).send(holding);
    } catch (error) {
      logger.error({ err: error }, 'Failed to add holding');
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to add holding' });
    }
  });

  // PATCH /v1/portfolios/:id/holdings/:holdingId - Update holding
  fastify.patch<{
    Params: { id: string; holdingId: string };
    Body: { instrumentId?: string; quantity?: string; purchasePrice?: string; purchaseDate?: string; description?: string };
  }>('/v1/portfolios/:id/holdings/:holdingId', async (request, reply) => {
    try {
      const updated = await portfolioService.updateHolding(
        request.params.id,
        request.params.holdingId,
        request.authUser!.id,
        request.body
      );

      if (!updated) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Portfolio or holding not found' });
      }

      return updated;
    } catch (error) {
      logger.error({ err: error }, 'Failed to update holding');
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to update holding' });
    }
  });

  // DELETE /v1/portfolios/:id/holdings/:holdingId - Delete holding
  fastify.delete<{ Params: { id: string; holdingId: string } }>(
    '/v1/portfolios/:id/holdings/:holdingId',
    async (request, reply) => {
      try {
        const deleted = await portfolioService.deleteHolding(
          request.params.id,
          request.params.holdingId,
          request.authUser!.id
        );

        if (!deleted) {
          return reply.code(404).send({ error: 'NOT_FOUND', message: 'Portfolio or holding not found' });
        }

        return { success: true };
      } catch (error) {
        logger.error({ err: error }, 'Failed to delete holding');
        return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to delete holding' });
      }
    }
  );
};

export default portfoliosRoute;
