import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import { db } from '../../config/database';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { authenticate } from '../../middleware/auth';
import { logger } from '../../utils/logger';

const SALT_ROUNDS = 10;

type RegisterBody = {
  email: string;
  password: string;
  displayName?: string;
};

type LoginBody = {
  email: string;
  password: string;
};

const authRoute: FastifyPluginAsync = async (fastify) => {
  // POST /v1/auth/register
  fastify.post<{ Body: RegisterBody }>('/v1/auth/register', async (request, reply) => {
    const { email, password, displayName } = request.body;

    if (!email || !password) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Email and password are required' });
    }

    if (password.length < 6) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Password must be at least 6 characters' });
    }

    try {
      // Check if user exists
      const existing = await db.query.users.findFirst({
        where: eq(users.email, email.toLowerCase().trim()),
      });

      if (existing) {
        return reply.code(409).send({ error: 'CONFLICT', message: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      const [user] = await db.insert(users).values({
        email: email.toLowerCase().trim(),
        passwordHash,
        displayName: displayName?.trim() || null,
      }).returning({ id: users.id, email: users.email, displayName: users.displayName });

      const token = fastify.jwt.sign({ id: user.id, email: user.email });

      logger.info({ userId: user.id }, 'User registered');

      return reply.code(201).send({
        token,
        user: { id: user.id, email: user.email, displayName: user.displayName },
      });
    } catch (error) {
      logger.error({ err: error }, 'Registration failed');
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Registration failed' });
    }
  });

  // POST /v1/auth/login
  fastify.post<{ Body: LoginBody }>('/v1/auth/login', async (request, reply) => {
    const { email, password } = request.body;

    if (!email || !password) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Email and password are required' });
    }

    try {
      const user = await db.query.users.findFirst({
        where: eq(users.email, email.toLowerCase().trim()),
      });

      if (!user) {
        return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Invalid email or password' });
      }

      if (!user.isActive) {
        return reply.code(403).send({ error: 'FORBIDDEN', message: 'Account is deactivated' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Invalid email or password' });
      }

      // Update last login
      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

      const token = fastify.jwt.sign({ id: user.id, email: user.email });

      logger.info({ userId: user.id }, 'User logged in');

      return { token, user: { id: user.id, email: user.email, displayName: user.displayName } };
    } catch (error) {
      logger.error({ err: error }, 'Login failed');
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Login failed' });
    }
  });

  // GET /v1/auth/me
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
