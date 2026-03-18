import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth';
import { notificationService } from '../../services/notification.service';
import { logger } from '../../utils/logger';

const pushTokenRoute: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);

  // POST /v1/user/push-token — Cihaz push token'ını kaydet
  fastify.post<{
    Body: {
      token: string;
      platform: 'ios' | 'android';
      deviceId?: string;
    };
  }>('/v1/user/push-token', async (request, reply) => {
    const { token, platform, deviceId } = request.body;

    if (!token || !platform) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'token and platform are required' });
    }

    if (!['ios', 'android'].includes(platform)) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'platform must be ios or android' });
    }

    try {
      await notificationService.registerToken(request.authUser!.id, token, platform, deviceId);
      return { success: true };
    } catch (error) {
      logger.error({ err: error }, 'Failed to register push token');
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to register push token' });
    }
  });

  // DELETE /v1/user/push-token — Cihaz push token'ını sil
  fastify.delete<{
    Body: { token: string };
  }>('/v1/user/push-token', async (request, reply) => {
    const { token } = request.body ?? {};

    if (!token) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'token is required' });
    }

    try {
      await notificationService.unregisterToken(token, request.authUser!.id);
      return { success: true };
    } catch (error) {
      logger.error({ err: error }, 'Failed to unregister push token');
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to unregister push token' });
    }
  });
};

export default pushTokenRoute;
