import type { FastifyRequest, FastifyReply } from 'fastify';

export interface AuthUser {
  id: string;
  email: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const decoded = await request.jwtVerify<AuthUser>();
    request.authUser = decoded;
  } catch (err) {
    reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' });
  }
}
