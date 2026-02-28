import { db } from '../config/database';
import { priceAlerts, instruments, latestQuotes } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../utils/logger';

type CreateAlertInput = {
  instrumentId: string;
  alertType: 'percentage' | 'amount' | 'scheduled';
  direction?: 'up' | 'down' | 'any';
  thresholdValue?: number;
  scheduledTimes?: string[];
};

type UpdateAlertInput = {
  isActive?: boolean;
  thresholdValue?: number;
  direction?: 'up' | 'down' | 'any';
  scheduledTimes?: string[];
};

export class AlertsService {
  async getAlerts(userId: string) {
    const alerts = await db.query.priceAlerts.findMany({
      where: eq(priceAlerts.userId, userId),
      orderBy: priceAlerts.createdAt,
    });

    // Enstrüman isimlerini al
    const instrumentIds = [...new Set(alerts.map((a) => a.instrumentId))];
    const instrumentData = instrumentIds.length > 0
      ? await db.query.instruments.findMany({
          where: (table, { inArray }) => inArray(table.id, instrumentIds),
        })
      : [];

    const instrumentMap = new Map(instrumentData.map((i) => [i.id, i]));

    return alerts.map((alert) => {
      const instrument = instrumentMap.get(alert.instrumentId);
      return {
        id: alert.id,
        instrumentId: alert.instrumentId,
        instrumentName: instrument?.name ?? alert.instrumentId,
        alertType: alert.alertType,
        direction: alert.direction,
        thresholdValue: alert.thresholdValue ? parseFloat(alert.thresholdValue) : null,
        scheduledTimes: alert.scheduledTimes ? JSON.parse(alert.scheduledTimes) : null,
        isActive: alert.isActive,
        referencePrice: alert.referencePrice ? parseFloat(alert.referencePrice) : null,
        createdAt: alert.createdAt.toISOString(),
      };
    });
  }

  async createAlert(userId: string, input: CreateAlertInput) {
    // Alarm tipine göre validasyon
    if (input.alertType === 'percentage' || input.alertType === 'amount') {
      if (!input.thresholdValue || input.thresholdValue <= 0) {
        throw new Error('VALIDATION_ERROR: thresholdValue is required and must be positive');
      }
      if (!input.direction || !['up', 'down', 'any'].includes(input.direction)) {
        throw new Error('VALIDATION_ERROR: direction must be up, down, or any');
      }
    }

    if (input.alertType === 'scheduled') {
      if (!input.scheduledTimes || input.scheduledTimes.length === 0) {
        throw new Error('VALIDATION_ERROR: scheduledTimes is required for scheduled alerts');
      }
    }

    // Mevcut fiyatı referans olarak al
    const quote = await db.query.latestQuotes.findFirst({
      where: eq(latestQuotes.instrumentId, input.instrumentId),
    });

    const referencePrice = quote?.sell ?? quote?.price ?? null;

    const [alert] = await db.insert(priceAlerts).values({
      userId,
      instrumentId: input.instrumentId,
      alertType: input.alertType,
      direction: input.alertType === 'scheduled' ? null : (input.direction ?? null),
      thresholdValue: input.thresholdValue != null ? String(input.thresholdValue) : null,
      scheduledTimes: input.scheduledTimes ? JSON.stringify(input.scheduledTimes) : null,
      referencePrice: referencePrice ?? null,
    }).returning();

    const instrument = await db.query.instruments.findFirst({
      where: eq(instruments.id, input.instrumentId),
    });

    logger.info({ alertId: alert.id, userId, instrumentId: input.instrumentId }, 'Price alert created');

    return {
      id: alert.id,
      instrumentId: alert.instrumentId,
      instrumentName: instrument?.name ?? alert.instrumentId,
      alertType: alert.alertType,
      direction: alert.direction,
      thresholdValue: alert.thresholdValue ? parseFloat(alert.thresholdValue) : null,
      scheduledTimes: alert.scheduledTimes ? JSON.parse(alert.scheduledTimes) : null,
      isActive: alert.isActive,
      referencePrice: alert.referencePrice ? parseFloat(alert.referencePrice) : null,
      createdAt: alert.createdAt.toISOString(),
    };
  }

  async updateAlert(alertId: string, userId: string, input: UpdateAlertInput) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.thresholdValue !== undefined) updateData.thresholdValue = String(input.thresholdValue);
    if (input.direction !== undefined) updateData.direction = input.direction;
    if (input.scheduledTimes !== undefined) updateData.scheduledTimes = JSON.stringify(input.scheduledTimes);

    const [updated] = await db.update(priceAlerts)
      .set(updateData)
      .where(and(eq(priceAlerts.id, alertId), eq(priceAlerts.userId, userId)))
      .returning();

    if (!updated) return null;

    const instrument = await db.query.instruments.findFirst({
      where: eq(instruments.id, updated.instrumentId),
    });

    return {
      id: updated.id,
      instrumentId: updated.instrumentId,
      instrumentName: instrument?.name ?? updated.instrumentId,
      alertType: updated.alertType,
      direction: updated.direction,
      thresholdValue: updated.thresholdValue ? parseFloat(updated.thresholdValue) : null,
      scheduledTimes: updated.scheduledTimes ? JSON.parse(updated.scheduledTimes) : null,
      isActive: updated.isActive,
      referencePrice: updated.referencePrice ? parseFloat(updated.referencePrice) : null,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async deleteAlert(alertId: string, userId: string): Promise<boolean> {
    const [deleted] = await db.delete(priceAlerts)
      .where(and(eq(priceAlerts.id, alertId), eq(priceAlerts.userId, userId)))
      .returning({ id: priceAlerts.id });

    return !!deleted;
  }
}
