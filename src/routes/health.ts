import { FastifyPluginAsync } from 'fastify';
import type { ApiHealthResponse } from '../types/api.types';
import { db } from '../config/database';
import { sql } from 'drizzle-orm';

const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Reply: ApiHealthResponse }>('/health', async (request, reply) => {
    return {
      ok: true,
      ts: Math.floor(Date.now() / 1000),
    };
  });

  // Geçici diagnostic endpoint — users tablosunun şemasını kontrol et
  fastify.get('/health/db', async (request, reply) => {
    try {
      const columns = await db.execute(
        sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position`
      );
      const migrations = await db.execute(
        sql`SELECT * FROM __drizzle_migrations ORDER BY created_at`
      );
      return { columns, migrations };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ error: msg });
    }
  });
};

export default healthRoute;
