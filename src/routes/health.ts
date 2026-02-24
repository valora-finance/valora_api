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

      let migrations = null;
      try {
        migrations = await db.execute(
          sql`SELECT * FROM "__drizzle_migrations" ORDER BY created_at`
        );
      } catch { migrations = 'table_not_found'; }

      const tables = await db.execute(
        sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
      );

      return { columns, migrations, tables };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ error: msg });
    }
  });

  // Eksik kolonları ekle — tek seferlik migration
  fastify.get('/health/fix-schema', async (request, reply) => {
    const results: string[] = [];
    try {
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(128) UNIQUE`);
      results.push('firebase_uid added');
    } catch (e) { results.push(`firebase_uid: ${(e as Error).message}`); }

    try {
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS provider VARCHAR(20) NOT NULL DEFAULT 'email'`);
      results.push('provider added');
    } catch (e) { results.push(`provider: ${(e as Error).message}`); }

    try {
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_id VARCHAR(255)`);
      results.push('provider_id added');
    } catch (e) { results.push(`provider_id: ${(e as Error).message}`); }

    try {
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid) WHERE firebase_uid IS NOT NULL`);
      results.push('firebase_uid index created');
    } catch (e) { results.push(`firebase_uid index: ${(e as Error).message}`); }

    try {
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_provider_provider_id ON users USING btree (provider, provider_id)`);
      results.push('provider index created');
    } catch (e) { results.push(`provider index: ${(e as Error).message}`); }

    // Verify
    const columns = await db.execute(
      sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position`
    );

    return { results, columns };
  });
};

export default healthRoute;
