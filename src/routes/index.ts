import { FastifyPluginAsync } from 'fastify';
import healthRoute from './health';
import metalsRoute from './v1/metals';
import fxRoute from './v1/fx';
import instrumentsRoute from './v1/instruments';
import historyRoute from './v1/history';
import authRoute from './v1/auth';
import portfoliosRoute from './v1/portfolios';

const routes: FastifyPluginAsync = async (fastify) => {
  // Health check (no auth required)
  await fastify.register(healthRoute);

  // v1 API routes
  await fastify.register(metalsRoute);
  await fastify.register(fxRoute);
  await fastify.register(instrumentsRoute);
  await fastify.register(historyRoute);

  // Auth & portfolio routes
  await fastify.register(authRoute);
  await fastify.register(portfoliosRoute);
};

export default routes;
