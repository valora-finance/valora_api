import type { FastifyPluginAsync } from 'fastify';
import { db } from '../../config/database';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { authenticate } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { sendVerificationCode, verifyCode, VerificationError } from '../../services/verification.service';
import admin from 'firebase-admin';

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

  // POST /v1/auth/send-code — E-posta doğrulama kodu gönderir (public)
  fastify.post('/v1/auth/send-code', async (request, reply) => {
    const { email } = request.body as { email?: string };

    if (!email || !email.trim()) {
      return reply.code(400).send({ error: 'VALIDATION', message: 'E-posta adresi gereklidir' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // E-posta format kontrolü
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return reply.code(400).send({ error: 'VALIDATION', message: 'Geçersiz e-posta adresi' });
    }

    try {
      // Firebase'de bu e-posta zaten kayıtlı mı kontrol et
      try {
        await admin.auth().getUserByEmail(normalizedEmail);
        // Kullanıcı bulundu → zaten kayıtlı
        return reply.code(409).send({
          error: 'EMAIL_EXISTS',
          message: 'Bu e-posta adresi zaten kullanılıyor',
        });
      } catch (firebaseErr: unknown) {
        const fbError = firebaseErr as { code?: string };
        // auth/user-not-found beklenen durum — devam et
        if (fbError.code !== 'auth/user-not-found') {
          throw firebaseErr;
        }
      }

      await sendVerificationCode(normalizedEmail);
      return { success: true };
    } catch (error) {
      if (error instanceof VerificationError) {
        const statusMap: Record<string, number> = {
          COOLDOWN: 429,
        };
        return reply
          .code(statusMap[error.code] || 400)
          .send({ error: error.code, message: error.message });
      }
      logger.error({ err: error, email: normalizedEmail }, 'send-code hatası');
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Kod gönderilemedi' });
    }
  });

  // POST /v1/auth/verify-code — Doğrulama kodunu kontrol eder (public)
  fastify.post('/v1/auth/verify-code', async (request, reply) => {
    const { email, code } = request.body as { email?: string; code?: string };

    if (!email?.trim() || !code?.trim()) {
      return reply.code(400).send({ error: 'VALIDATION', message: 'E-posta ve kod gereklidir' });
    }

    try {
      await verifyCode(email, code);
      return { verified: true };
    } catch (error) {
      if (error instanceof VerificationError) {
        const statusMap: Record<string, number> = {
          NOT_FOUND: 404,
          EXPIRED: 410,
          TOO_MANY_ATTEMPTS: 429,
          INVALID_CODE: 400,
        };
        return reply
          .code(statusMap[error.code] || 400)
          .send({ error: error.code, message: error.message });
      }
      logger.error({ err: error }, 'verify-code hatası');
      return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Doğrulama başarısız' });
    }
  });
};

export default authRoute;
