import type { FastifyPluginAsync } from 'fastify';
import { db } from '../../config/database';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { authenticate } from '../../middleware/auth';
import { logger } from '../../utils/logger';

const authRoute: FastifyPluginAsync = async (fastify) => {
  // GET /v1/auth/me
  // Firebase ID Token ile doğrulama middleware (authenticate) üzerinden yapılır.
  // Kullanıcı DB'de yoksa middleware otomatik oluşturur.
  fastify.get('/v1/auth/me', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, request.authUser!.id),
        columns: { id: true, email: true, displayName: true, createdAt: true },
      });

      if (!user) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'User not found' });
      }

      return { user };
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch user profile');
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to fetch profile' });
    }
  });
};

export default authRoute;
