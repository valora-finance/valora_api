import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth';
import { PreferencesService } from '../../services/preferences.service';
import { logger } from '../../utils/logger';

const preferencesService = new PreferencesService();

const preferencesRoute: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);

  // GET /v1/preferences - Favori ve pin listesi
  fastify.get('/v1/preferences', async (request, reply) => {
    try {
      const result = await preferencesService.getPreferences(request.authUser!.id);
      return result;
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch preferences');
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to fetch preferences' });
    }
  });

  // POST /v1/favorites/:instrumentId - Toggle favori
  fastify.post<{ Params: { instrumentId: string } }>(
    '/v1/favorites/:instrumentId',
    async (request, reply) => {
      try {
        const result = await preferencesService.toggleFavorite(request.authUser!.id, request.params.instrumentId);
        return result;
      } catch (error) {
        logger.error({ err: error }, 'Failed to toggle favorite');
        return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to toggle favorite' });
      }
    }
  );

  // DELETE /v1/favorites/:instrumentId - Favori kaldır
  fastify.delete<{ Params: { instrumentId: string } }>(
    '/v1/favorites/:instrumentId',
    async (request, reply) => {
      try {
        const deleted = await preferencesService.removeFavorite(request.authUser!.id, request.params.instrumentId);
        if (!deleted) {
          return reply.code(404).send({ error: 'NOT_FOUND', message: 'Favorite not found' });
        }
        return { success: true };
      } catch (error) {
        logger.error({ err: error }, 'Failed to remove favorite');
        return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to remove favorite' });
      }
    }
  );

  // POST /v1/pins/:instrumentId - Toggle pin
  fastify.post<{ Params: { instrumentId: string } }>(
    '/v1/pins/:instrumentId',
    async (request, reply) => {
      try {
        const result = await preferencesService.togglePin(request.authUser!.id, request.params.instrumentId);
        return result;
      } catch (error) {
        logger.error({ err: error }, 'Failed to toggle pin');
        return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to toggle pin' });
      }
    }
  );

  // DELETE /v1/pins/:instrumentId - Pin kaldır
  fastify.delete<{ Params: { instrumentId: string } }>(
    '/v1/pins/:instrumentId',
    async (request, reply) => {
      try {
        const deleted = await preferencesService.removePin(request.authUser!.id, request.params.instrumentId);
        if (!deleted) {
          return reply.code(404).send({ error: 'NOT_FOUND', message: 'Pin not found' });
        }
        return { success: true };
      } catch (error) {
        logger.error({ err: error }, 'Failed to remove pin');
        return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to remove pin' });
      }
    }
  );

  // POST /v1/preferences/sync - Bulk sync (login sonrası local verileri gönder)
  fastify.post<{ Body: { favorites?: string[]; pins?: string[] } }>(
    '/v1/preferences/sync',
    async (request, reply) => {
      try {
        const { favorites, pins } = request.body;
        const userId = request.authUser!.id;

        await Promise.all([
          favorites ? preferencesService.bulkAddFavorites(userId, favorites) : Promise.resolve(),
          pins ? preferencesService.bulkAddPins(userId, pins) : Promise.resolve(),
        ]);

        const result = await preferencesService.getPreferences(userId);
        return result;
      } catch (error) {
        logger.error({ err: error }, 'Failed to sync preferences');
        return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to sync preferences' });
      }
    }
  );
};

export default preferencesRoute;
