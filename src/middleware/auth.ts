import type { FastifyRequest, FastifyReply } from 'fastify';
import { admin } from '../config/firebaseAdmin';
import { db } from '../config/database';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';

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
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Missing authorization header' });
    }

    const idToken = authHeader.slice(7);
    const decoded = await admin.auth().verifyIdToken(idToken);

    // 1. Önce firebaseUid ile ara
    let user = await db.query.users.findFirst({
      where: eq(users.firebaseUid, decoded.uid),
    });

    if (!user) {
      // 2. Email ile mevcut kullanıcı bağlama (eski kayıtlar için)
      if (decoded.email) {
        const existingByEmail = await db.query.users.findFirst({
          where: eq(users.email, decoded.email.toLowerCase()),
        });

        if (existingByEmail) {
          await db.update(users)
            .set({ firebaseUid: decoded.uid })
            .where(eq(users.id, existingByEmail.id));
          user = { ...existingByEmail, firebaseUid: decoded.uid };
        }
      }

      // 3. Yeni kullanıcı otomatik oluştur
      if (!user) {
        const email = decoded.email?.toLowerCase() ?? `firebase_${decoded.uid}@noemail.valora`;
        const signInProvider = (decoded.firebase as { sign_in_provider?: string } | undefined)?.sign_in_provider ?? 'firebase';

        // onConflictDoNothing: eş zamanlı kayıt isteklerinde (race condition) unique hata fırlatmaz
        const [newUser] = await db.insert(users).values({
          email,
          firebaseUid: decoded.uid,
          displayName: decoded.name ?? null,
          provider: signInProvider,
        }).onConflictDoNothing().returning();

        if (newUser) {
          logger.info({ userId: newUser.id, provider: signInProvider }, 'New user auto-created via Firebase');
          user = newUser;
        } else {
          // Race condition: başka bir istek aynı anda insert yaptı, yeniden sorgula
          user = await db.query.users.findFirst({ where: eq(users.firebaseUid, decoded.uid) })
            ?? await db.query.users.findFirst({ where: eq(users.email, email) });
        }
      }
    }

    if (!user) {
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to resolve user' });
    }

    if (!user.isActive) {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Account is deactivated' });
    }

    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    request.authUser = { id: user.id, email: user.email };
  } catch (err) {
    logger.warn({ err }, 'Authentication failed');
    reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' });
  }
}
