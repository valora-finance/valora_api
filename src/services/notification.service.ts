import { admin } from '../config/firebaseAdmin';
import { db } from '../config/database';
import { deviceTokens, priceAlerts, latestQuotes, instruments, notificationPreferences } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { logger } from '../utils/logger';

export class NotificationService {
  /**
   * Kullanıcının cihaz token'larını kaydet veya güncelle
   */
  async registerToken(userId: string, token: string, platform: 'ios' | 'android', deviceId?: string) {
    // Aynı token varsa güncelle, yoksa ekle
    const existing = await db.query.deviceTokens.findFirst({
      where: eq(deviceTokens.token, token),
    });

    if (existing) {
      if (existing.userId !== userId) {
        // Token başka bir kullanıcıya ait — sahipliği transfer et
        await db.update(deviceTokens)
          .set({ userId, platform, deviceId: deviceId ?? null, updatedAt: new Date() })
          .where(eq(deviceTokens.id, existing.id));
      } else {
        await db.update(deviceTokens)
          .set({ platform, deviceId: deviceId ?? null, updatedAt: new Date() })
          .where(eq(deviceTokens.id, existing.id));
      }
      return;
    }

    await db.insert(deviceTokens).values({
      userId,
      token,
      platform,
      deviceId: deviceId ?? null,
    });

    logger.info({ userId, platform }, 'Device token registered');
  }

  /**
   * Token sil (logout veya unregister)
   */
  async unregisterToken(token: string) {
    const [deleted] = await db.delete(deviceTokens)
      .where(eq(deviceTokens.token, token))
      .returning({ id: deviceTokens.id });

    return !!deleted;
  }

  /**
   * Kullanıcıya push notification gönder
   */
  async sendToUser(userId: string, title: string, body: string, data?: Record<string, string>) {
    const tokens = await db.query.deviceTokens.findMany({
      where: eq(deviceTokens.userId, userId),
    });

    if (tokens.length === 0) return;

    const message: admin.messaging.MulticastMessage = {
      tokens: tokens.map((t) => t.token),
      notification: { title, body },
      data,
      android: {
        priority: 'high',
        notification: { channelId: 'price_alerts' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);

      // Geçersiz token'ları temizle
      if (response.failureCount > 0) {
        const invalidTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const code = resp.error?.code;
            if (
              code === 'messaging/invalid-registration-token' ||
              code === 'messaging/registration-token-not-registered'
            ) {
              invalidTokens.push(tokens[idx].token);
            }
          }
        });

        if (invalidTokens.length > 0) {
          await db.delete(deviceTokens).where(inArray(deviceTokens.token, invalidTokens));
          logger.info({ count: invalidTokens.length, userId }, 'Removed invalid device tokens');
        }
      }

      logger.info(
        { userId, successCount: response.successCount, failureCount: response.failureCount },
        'Push notification sent'
      );
    } catch (error) {
      logger.error({ err: error, userId }, 'Failed to send push notification');
    }
  }

  /**
   * Aktif fiyat alarmlarını kontrol et ve tetikle
   */
  async evaluateAlerts() {
    // Tüm aktif alarmları al
    const activeAlerts = await db.query.priceAlerts.findMany({
      where: eq(priceAlerts.isActive, true),
    });

    if (activeAlerts.length === 0) return;

    // İlgili enstrümanların güncel fiyatlarını al
    const instrumentIds = [...new Set(activeAlerts.map((a) => a.instrumentId))];
    const currentQuotes = await db.query.latestQuotes.findMany({
      where: inArray(latestQuotes.instrumentId, instrumentIds),
    });

    const quoteMap = new Map(currentQuotes.map((q) => [q.instrumentId, q]));

    // Enstrüman isimlerini al
    const instrumentData = await db.query.instruments.findMany({
      where: inArray(instruments.id, instrumentIds),
    });
    const instrumentMap = new Map(instrumentData.map((i) => [i.id, i.name]));

    // Kullanıcı bildirim tercihlerini al
    const userIds = [...new Set(activeAlerts.map((a) => a.userId))];
    const userPrefs = await db.query.notificationPreferences.findMany({
      where: inArray(notificationPreferences.userId, userIds),
    });
    const prefsMap = new Map(userPrefs.map((p) => [p.userId, p]));

    const now = new Date();

    for (const alert of activeAlerts) {
      try {
        const quote = quoteMap.get(alert.instrumentId);
        if (!quote) continue;

        // Kullanıcı bildirim tercihini kontrol et
        const userPref = prefsMap.get(alert.userId);
        // Tercih kaydı yoksa varsayılan: priceAlertNotifications = false
        if (userPref && !userPref.priceAlertNotifications) continue;
        if (!userPref) continue; // Tercih kaydı olmayan kullanıcılara gönderme

        const currentPrice = parseFloat(quote.sell ?? quote.price);
        const instrumentName = instrumentMap.get(alert.instrumentId) ?? alert.instrumentId;

        if (alert.alertType === 'scheduled') {
          await this.evaluateScheduledAlert(alert, currentPrice, instrumentName, now);
        } else {
          await this.evaluatePriceAlert(alert, currentPrice, instrumentName, now);
        }
      } catch (error) {
        logger.error({ err: error, alertId: alert.id }, 'Alert evaluation failed');
      }
    }
  }

  private async evaluatePriceAlert(
    alert: typeof priceAlerts.$inferSelect,
    currentPrice: number,
    instrumentName: string,
    now: Date
  ) {
    if (!alert.referencePrice || !alert.thresholdValue) return;

    const referencePrice = parseFloat(alert.referencePrice);
    const threshold = parseFloat(alert.thresholdValue);

    // Spam'ı önle: son 1 saat içinde tetiklenmişse atla
    if (alert.lastTriggeredAt) {
      const cooldownMs = 60 * 60 * 1000; // 1 saat
      if (now.getTime() - alert.lastTriggeredAt.getTime() < cooldownMs) return;
    }

    let triggered = false;
    let changeText = '';

    if (alert.alertType === 'percentage') {
      const changePercent = ((currentPrice - referencePrice) / referencePrice) * 100;

      if (alert.direction === 'up' && changePercent >= threshold) {
        triggered = true;
        changeText = `%${changePercent.toFixed(1)} yükseldi`;
      } else if (alert.direction === 'down' && changePercent <= -threshold) {
        triggered = true;
        changeText = `%${Math.abs(changePercent).toFixed(1)} düştü`;
      } else if (alert.direction === 'any' && Math.abs(changePercent) >= threshold) {
        triggered = true;
        changeText = changePercent > 0
          ? `%${changePercent.toFixed(1)} yükseldi`
          : `%${Math.abs(changePercent).toFixed(1)} düştü`;
      }
    } else if (alert.alertType === 'amount') {
      const changeAmount = currentPrice - referencePrice;

      if (alert.direction === 'up' && changeAmount >= threshold) {
        triggered = true;
        changeText = `₺${changeAmount.toFixed(2)} yükseldi`;
      } else if (alert.direction === 'down' && changeAmount <= -threshold) {
        triggered = true;
        changeText = `₺${Math.abs(changeAmount).toFixed(2)} düştü`;
      } else if (alert.direction === 'any' && Math.abs(changeAmount) >= threshold) {
        triggered = true;
        changeText = changeAmount > 0
          ? `₺${changeAmount.toFixed(2)} yükseldi`
          : `₺${Math.abs(changeAmount).toFixed(2)} düştü`;
      }
    }

    if (triggered) {
      await this.sendToUser(
        alert.userId,
        `${instrumentName} Fiyat Alarmı`,
        `${instrumentName} ${changeText}. Güncel: ₺${currentPrice.toFixed(2)}`,
        { type: 'price_alert', alertId: alert.id, instrumentId: alert.instrumentId }
      );

      // Referans fiyatını güncelle ve lastTriggeredAt'i kaydet
      await db.update(priceAlerts)
        .set({
          lastTriggeredAt: now,
          referencePrice: String(currentPrice),
          updatedAt: now,
        })
        .where(eq(priceAlerts.id, alert.id));

      logger.info({ alertId: alert.id, instrumentName, changeText }, 'Price alert triggered');
    }
  }

  private async evaluateScheduledAlert(
    alert: typeof priceAlerts.$inferSelect,
    currentPrice: number,
    instrumentName: string,
    now: Date
  ) {
    if (!alert.scheduledTimes) return;

    const scheduledTimes: string[] = JSON.parse(alert.scheduledTimes);
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Son 5 dakikada tetiklenmişse atla (cron her 5 dk çalışıyor)
    if (alert.lastTriggeredAt) {
      const cooldownMs = 5 * 60 * 1000;
      if (now.getTime() - alert.lastTriggeredAt.getTime() < cooldownMs) return;
    }

    // Şu anki saat zamanlanmış saatlerden birine denk geliyor mu?
    const isScheduledNow = scheduledTimes.some((time) => {
      const [h, m] = time.split(':').map(Number);
      const nowH = now.getHours();
      const nowM = now.getMinutes();
      // 5 dakikalık pencere (cron interval'ı ile eşleşir)
      return h === nowH && Math.abs(m - nowM) < 5;
    });

    if (isScheduledNow) {
      await this.sendToUser(
        alert.userId,
        `${instrumentName} Fiyat Bildirimi`,
        `${instrumentName}: ₺${currentPrice.toFixed(2)}`,
        { type: 'scheduled_alert', alertId: alert.id, instrumentId: alert.instrumentId }
      );

      await db.update(priceAlerts)
        .set({ lastTriggeredAt: now, updatedAt: now })
        .where(eq(priceAlerts.id, alert.id));

      logger.info({ alertId: alert.id, instrumentName, currentTime }, 'Scheduled alert triggered');
    }
  }
}

export const notificationService = new NotificationService();
