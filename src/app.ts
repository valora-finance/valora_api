import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { logger } from './utils/logger';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.env === 'production' ? 'info' : 'debug',
    },
    trustProxy: true,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId',
  });

  // Security middleware
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  });

  // CORS middleware
  await app.register(cors, {
    origin: config.env === 'production' ? false : true, // Configure properly in production
    credentials: true,
  });

  // Rate limiting middleware
  await app.register(rateLimit, {
    max: config.rateLimit.ipPoints,
    timeWindow: '1 minute',
    cache: 10000,
    allowList: ['127.0.0.1'], // Allow localhost during development
    skipOnError: false,
    ban: 3, // Ban after 3 consecutive rate limit violations
    continueExceeding: false,
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });

  // Request logging
  app.addHook('onRequest', async (request, reply) => {
    request.log.info({ req: request }, 'Incoming request');
  });

  app.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        req: request,
        res: reply,
      },
      'Request completed'
    );
  });

  // Register routes
  await app.register(import('./routes'), { prefix: '/' });

  // Global error handler
  app.setErrorHandler((error: Error, request, reply) => {
    request.log.error({ err: error }, 'Unhandled error');
    reply.status(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message: config.env === 'production' ? 'Internal server error' : error.message,
    });
  });

  // 404 handler
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: 'NOT_FOUND',
      message: 'Route not found',
    });
  });

  return app;
}
