import crypto from 'node:crypto';
import { db } from '../config/database';
import { emailVerifications } from '../db/schema';
import { eq, lt } from 'drizzle-orm';
import { sendVerificationEmail } from './email.service';
import { logger } from '../utils/logger';

const CODE_LENGTH = 6;
const CODE_TTL_MS = 5 * 60 * 1000; // 5 dakika
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 saniye

function generateCode(): string {
  // Kriptografik olarak güvenli 6 haneli kod
  return crypto.randomInt(100_000, 999_999).toString();
}

/**
 * E-postaya doğrulama kodu gönderir.
 * Aynı e-postaya ait eski kodları siler ve yeni kod oluşturur.
 */
export async function sendVerificationCode(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();

  // Cooldown kontrolü — son 60 saniye içinde kod gönderilmişse reddet
  const recent = await db.query.emailVerifications.findFirst({
    where: eq(emailVerifications.email, normalizedEmail),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  if (recent) {
    const elapsed = Date.now() - new Date(recent.createdAt).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const remainingSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      throw new VerificationError(
        `Lütfen ${remainingSec} saniye bekleyip tekrar deneyin`,
        'COOLDOWN'
      );
    }
  }

  // Eski kodları temizle
  await db.delete(emailVerifications).where(eq(emailVerifications.email, normalizedEmail));

  // Yeni kod oluştur
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await db.insert(emailVerifications).values({
    email: normalizedEmail,
    code,
    expiresAt,
  });

  // E-posta gönder
  await sendVerificationEmail(normalizedEmail, code);

  logger.info({ email: normalizedEmail }, 'Doğrulama kodu gönderildi');
}

/**
 * Doğrulama kodunu kontrol eder.
 * Başarılıysa kaydı siler (tek kullanımlık).
 */
export async function verifyCode(email: string, code: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();

  const record = await db.query.emailVerifications.findFirst({
    where: eq(emailVerifications.email, normalizedEmail),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  if (!record) {
    throw new VerificationError('Doğrulama kodu bulunamadı. Yeni kod isteyin', 'NOT_FOUND');
  }

  // Süre kontrolü
  if (new Date() > new Date(record.expiresAt)) {
    await db.delete(emailVerifications).where(eq(emailVerifications.id, record.id));
    throw new VerificationError('Doğrulama kodunun süresi doldu', 'EXPIRED');
  }

  // Deneme sayısı kontrolü
  if (record.attempts >= MAX_ATTEMPTS) {
    await db.delete(emailVerifications).where(eq(emailVerifications.id, record.id));
    throw new VerificationError('Çok fazla yanlış deneme. Yeni kod isteyin', 'TOO_MANY_ATTEMPTS');
  }

  // Kod kontrolü
  if (record.code !== code.trim()) {
    // Deneme sayısını artır
    await db
      .update(emailVerifications)
      .set({ attempts: record.attempts + 1 })
      .where(eq(emailVerifications.id, record.id));

    const remaining = MAX_ATTEMPTS - record.attempts - 1;
    throw new VerificationError(
      `Geçersiz doğrulama kodu. ${remaining} deneme hakkınız kaldı`,
      'INVALID_CODE'
    );
  }

  // Başarılı — kaydı sil (tek kullanımlık)
  await db.delete(emailVerifications).where(eq(emailVerifications.id, record.id));

  logger.info({ email: normalizedEmail }, 'E-posta doğrulaması başarılı');
  return true;
}

/**
 * Süresi dolmuş doğrulama kayıtlarını temizler.
 */
export async function cleanupExpiredVerifications(): Promise<void> {
  await db
    .delete(emailVerifications)
    .where(lt(emailVerifications.expiresAt, new Date()));
}

/**
 * Doğrulama hatası tipi.
 */
export class VerificationError extends Error {
  constructor(
    message: string,
    public code: 'COOLDOWN' | 'NOT_FOUND' | 'EXPIRED' | 'TOO_MANY_ATTEMPTS' | 'INVALID_CODE'
  ) {
    super(message);
    this.name = 'VerificationError';
  }
}
