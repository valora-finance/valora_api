import { FastifyPluginAsync } from 'fastify';
import type { ApiHealthResponse } from '../types/api.types';

const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Reply: ApiHealthResponse }>('/health', async (request, reply) => {
    return {
      ok: true,
      ts: Math.floor(Date.now() / 1000),
    };
  });
};

export default healthRoute;
