import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth';
import { AlertsService } from '../../services/alerts.service';
import { logger } from '../../utils/logger';

const alertsService = new AlertsService();

const alertsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);

  // GET /v1/alerts - Tüm alarmları listele
  fastify.get('/v1/alerts', async (request, reply) => {
    try {
      const alerts = await alertsService.getAlerts(request.authUser!.id);
      return { alerts };
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch alerts');
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to fetch alerts' });
    }
  });

  // POST /v1/alerts - Yeni alarm oluştur
  fastify.post<{
    Body: {
      instrumentId: string;
      alertType: 'percentage' | 'amount' | 'scheduled';
      direction?: 'up' | 'down' | 'any';
      thresholdValue?: number;
      scheduledTimes?: string[];
    };
  }>('/v1/alerts', async (request, reply) => {
    const { instrumentId, alertType, direction, thresholdValue, scheduledTimes } = request.body;

    if (!instrumentId || !alertType) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'instrumentId and alertType are required' });
    }

    if (!['percentage', 'amount', 'scheduled'].includes(alertType)) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'alertType must be percentage, amount, or scheduled' });
    }

    try {
      const alert = await alertsService.createAlert(request.authUser!.id, {
        instrumentId,
        alertType,
        direction,
        thresholdValue,
        scheduledTimes,
      });

      return reply.code(201).send(alert);
    } catch (error: any) {
      if (error?.message?.startsWith('VALIDATION_ERROR:')) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', message: error.message.replace('VALIDATION_ERROR: ', '') });
      }
      logger.error({ err: error }, 'Failed to create alert');
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to create alert' });
    }
  });

  // PATCH /v1/alerts/:id - Alarm güncelle
  fastify.patch<{
    Params: { id: string };
    Body: {
      isActive?: boolean;
      thresholdValue?: number;
      direction?: 'up' | 'down' | 'any';
      scheduledTimes?: string[];
    };
  }>('/v1/alerts/:id', async (request, reply) => {
    try {
      const updated = await alertsService.updateAlert(request.params.id, request.authUser!.id, request.body);
      if (!updated) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Alert not found' });
      }
      return updated;
    } catch (error) {
      logger.error({ err: error }, 'Failed to update alert');
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to update alert' });
    }
  });

  // DELETE /v1/alerts/:id - Alarm sil
  fastify.delete<{ Params: { id: string } }>('/v1/alerts/:id', async (request, reply) => {
    try {
      const deleted = await alertsService.deleteAlert(request.params.id, request.authUser!.id);
      if (!deleted) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'Alert not found' });
      }
      return { success: true };
    } catch (error) {
      logger.error({ err: error }, 'Failed to delete alert');
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to delete alert' });
    }
  });
};

export default alertsRoute;
