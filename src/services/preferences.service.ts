import { db } from '../config/database';
import { userFavorites, userPins } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../utils/logger';

export class PreferencesService {
  async getPreferences(userId: string) {
    const [favorites, pins] = await Promise.all([
      db.query.userFavorites.findMany({
        where: eq(userFavorites.userId, userId),
      }),
      db.query.userPins.findMany({
        where: eq(userPins.userId, userId),
        orderBy: userPins.sortOrder,
      }),
    ]);

    return {
      favorites: favorites.map((f) => f.instrumentId),
      pins: pins.map((p) => p.instrumentId),
    };
  }

  async toggleFavorite(userId: string, instrumentId: string): Promise<{ added: boolean }> {
    const existing = await db.query.userFavorites.findFirst({
      where: and(eq(userFavorites.userId, userId), eq(userFavorites.instrumentId, instrumentId)),
    });

    if (existing) {
      await db.delete(userFavorites).where(eq(userFavorites.id, existing.id));
      logger.info({ userId, instrumentId }, 'Favorite removed');
      return { added: false };
    }

    await db.insert(userFavorites).values({ userId, instrumentId });
    logger.info({ userId, instrumentId }, 'Favorite added');
    return { added: true };
  }

  async removeFavorite(userId: string, instrumentId: string): Promise<boolean> {
    const [deleted] = await db.delete(userFavorites)
      .where(and(eq(userFavorites.userId, userId), eq(userFavorites.instrumentId, instrumentId)))
      .returning({ id: userFavorites.id });

    return !!deleted;
  }

  async togglePin(userId: string, instrumentId: string): Promise<{ added: boolean }> {
    const existing = await db.query.userPins.findFirst({
      where: and(eq(userPins.userId, userId), eq(userPins.instrumentId, instrumentId)),
    });

    if (existing) {
      await db.delete(userPins).where(eq(userPins.id, existing.id));
      logger.info({ userId, instrumentId }, 'Pin removed');
      return { added: false };
    }

    await db.insert(userPins).values({ userId, instrumentId });
    logger.info({ userId, instrumentId }, 'Pin added');
    return { added: true };
  }

  async removePin(userId: string, instrumentId: string): Promise<boolean> {
    const [deleted] = await db.delete(userPins)
      .where(and(eq(userPins.userId, userId), eq(userPins.instrumentId, instrumentId)))
      .returning({ id: userPins.id });

    return !!deleted;
  }

  async bulkAddFavorites(userId: string, instrumentIds: string[]) {
    if (instrumentIds.length === 0) return;

    const existing = await db.query.userFavorites.findMany({
      where: eq(userFavorites.userId, userId),
    });
    const existingSet = new Set(existing.map((f) => f.instrumentId));
    const toAdd = instrumentIds.filter((id) => !existingSet.has(id));

    if (toAdd.length > 0) {
      await db.insert(userFavorites).values(
        toAdd.map((instrumentId) => ({ userId, instrumentId }))
      );
    }
  }

  async bulkAddPins(userId: string, instrumentIds: string[]) {
    if (instrumentIds.length === 0) return;

    const existing = await db.query.userPins.findMany({
      where: eq(userPins.userId, userId),
    });
    const existingSet = new Set(existing.map((p) => p.instrumentId));
    const toAdd = instrumentIds.filter((id) => !existingSet.has(id));

    if (toAdd.length > 0) {
      await db.insert(userPins).values(
        toAdd.map((instrumentId) => ({ userId, instrumentId }))
      );
    }
  }
}
