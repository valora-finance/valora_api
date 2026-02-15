import type { FastifyPluginAsync, FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { db } from '../../config/database';
import { users } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '../../middleware/auth';
import { logger } from '../../utils/logger';

const SALT_ROUNDS = 10;

// JWKS endpoints for social providers
const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

type RegisterBody = {
  email: string;
  password: string;
  displayName?: string;
};

type LoginBody = {
  email: string;
  password: string;
};

type AppleAuthBody = {
  identityToken: string;
  nonce: string;
  fullName?: string;
  email?: string;
};

type GoogleAuthBody = {
  idToken?: string;
  accessToken?: string;
};

type GoogleUserInfo = {
  sub: string;
  email?: string;
  name?: string;
};

async function findOrCreateSocialUser(
  provider: string,
  providerId: string,
  email: string | undefined,
  displayName: string | undefined,
  fastify: FastifyInstance,
) {
  // 1. Try find by provider + providerId
  const existingByProvider = await db.query.users.findFirst({
    where: and(eq(users.provider, provider), eq(users.providerId, providerId)),
  });

  if (existingByProvider) {
    if (!existingByProvider.isActive) {
      throw { statusCode: 403, error: 'FORBIDDEN', message: 'Account is deactivated' };
    }

    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, existingByProvider.id));

    const token = fastify.jwt.sign({ id: existingByProvider.id, email: existingByProvider.email });
    return {
      token,
      user: { id: existingByProvider.id, email: existingByProvider.email, displayName: existingByProvider.displayName },
    };
  }

  // 2. If not found, try find by email (account linking)
  if (email) {
    const existingByEmail = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase().trim()),
    });

    if (existingByEmail) {
      if (!existingByEmail.isActive) {
        throw { statusCode: 403, error: 'FORBIDDEN', message: 'Account is deactivated' };
      }

      // Link the social provider to the existing account
      await db.update(users).set({
        provider,
        providerId,
        lastLoginAt: new Date(),
      }).where(eq(users.id, existingByEmail.id));

      const token = fastify.jwt.sign({ id: existingByEmail.id, email: existingByEmail.email });
      return {
        token,
        user: { id: existingByEmail.id, email: existingByEmail.email, displayName: existingByEmail.displayName },
      };
    }
  }

  // 3. If still not found, create new user
  const userEmail = email?.toLowerCase().trim() ?? `${provider}_${providerId}@noemail.valora`;

  const [newUser] = await db.insert(users).values({
    email: userEmail,
    passwordHash: null,
    provider,
    providerId,
    displayName: displayName?.trim() || null,
  }).returning({ id: users.id, email: users.email, displayName: users.displayName });

  const token = fastify.jwt.sign({ id: newUser.id, email: newUser.email });

  logger.info({ userId: newUser.id, provider }, 'Social user registered');

  return {
    token,
    user: { id: newUser.id, email: newUser.email, displayName: newUser.displayName },
  };
}

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

      // Social auth users don't have a password
      if (!user.passwordHash) {
        return reply.code(400).send({ error: 'SOCIAL_AUTH', message: 'Please use social login' });
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

  // POST /v1/auth/apple
  fastify.post<{ Body: AppleAuthBody }>('/v1/auth/apple', async (request, reply) => {
    const { identityToken, nonce, fullName, email } = request.body;

    if (!identityToken || !nonce) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'identityToken and nonce are required' });
    }

    try {
      const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
        issuer: 'https://appleid.apple.com',
      });

      // Validate nonce: Apple stores SHA256(client_nonce) in the token's nonce claim
      const expectedNonce = createHash('sha256').update(nonce).digest('hex');
      if (payload.nonce !== expectedNonce) {
        return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Invalid nonce' });
      }

      const sub = payload.sub;
      if (!sub) {
        return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Missing sub claim in Apple token' });
      }

      const appleEmail = (payload.email as string | undefined) ?? email;
      const displayName = fullName;

      const result = await findOrCreateSocialUser('apple', sub, appleEmail, displayName, fastify);

      logger.info({ userId: result.user.id }, 'Apple auth successful');

      return result;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'statusCode' in error) {
        const socialError = error as { statusCode: number; error: string; message: string };
        return reply.code(socialError.statusCode).send({ error: socialError.error, message: socialError.message });
      }
      logger.error({ err: error }, 'Apple auth failed');
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Apple authentication failed' });
    }
  });

  // POST /v1/auth/google
  fastify.post<{ Body: GoogleAuthBody }>('/v1/auth/google', async (request, reply) => {
    const { idToken, accessToken } = request.body;

    if (!idToken && !accessToken) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'idToken or accessToken is required' });
    }

    try {
      let sub: string;
      let googleEmail: string | undefined;
      let googleName: string | undefined;

      if (idToken) {
        // Primary path: verify ID token with Google JWKS
        const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
          issuer: ['accounts.google.com', 'https://accounts.google.com'],
        });

        if (!payload.sub) {
          return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Missing sub claim in Google token' });
        }

        sub = payload.sub;
        googleEmail = payload.email as string | undefined;
        googleName = payload.name as string | undefined;
      } else {
        // Fallback path: fetch user info with access token
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
          return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Invalid Google access token' });
        }

        const userInfo: GoogleUserInfo = await response.json() as GoogleUserInfo;

        if (!userInfo.sub) {
          return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Missing sub in Google user info' });
        }

        sub = userInfo.sub;
        googleEmail = userInfo.email;
        googleName = userInfo.name;
      }

      const result = await findOrCreateSocialUser('google', sub, googleEmail, googleName, fastify);

      logger.info({ userId: result.user.id }, 'Google auth successful');

      return result;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'statusCode' in error) {
        const socialError = error as { statusCode: number; error: string; message: string };
        return reply.code(socialError.statusCode).send({ error: socialError.error, message: socialError.message });
      }
      logger.error({ err: error }, 'Google auth failed');
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Google authentication failed' });
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
