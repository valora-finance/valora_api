import { db } from '../config/database';
import { portfolios, portfolioHoldings, latestQuotes, instruments } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { logger } from '../utils/logger';

type CreatePortfolioInput = {
  name: string;
  type: 'birikim' | 'borc';
  icon?: string;
  color?: string;
};

type UpdatePortfolioInput = Partial<Pick<CreatePortfolioInput, 'name' | 'icon' | 'color'>> & { sortOrder?: number };

type CreateHoldingInput = {
  instrumentId: string;
  quantity: string;
  purchasePrice: string;
  purchaseDate: string;
  description?: string;
};

type UpdateHoldingInput = Partial<CreateHoldingInput>;

export class PortfolioService {
  async getPortfolios(userId: string) {
    const userPortfolios = await db.query.portfolios.findMany({
      where: eq(portfolios.userId, userId),
      orderBy: portfolios.sortOrder,
    });

    if (userPortfolios.length === 0) {
      return { portfolios: [], summary: { totalValue: 0, totalSavings: 0, totalDebts: 0 } };
    }

    // Get all holdings for all portfolios
    const portfolioIds = userPortfolios.map((p) => p.id);
    const allHoldings = await db.query.portfolioHoldings.findMany({
      where: inArray(portfolioHoldings.portfolioId, portfolioIds),
    });

    // Get current prices for all instruments in holdings
    const instrumentIds = [...new Set(allHoldings.map((h) => h.instrumentId))];
    const currentQuotes = instrumentIds.length > 0
      ? await db.query.latestQuotes.findMany({
          where: inArray(latestQuotes.instrumentId, instrumentIds),
        })
      : [];

    const instrumentData = instrumentIds.length > 0
      ? await db.query.instruments.findMany({
          where: inArray(instruments.id, instrumentIds),
        })
      : [];

    const quoteMap = new Map(currentQuotes.map((q) => [q.instrumentId, q]));
    const instrumentMap = new Map(instrumentData.map((i) => [i.id, i]));

    let totalSavings = 0;
    let totalDebts = 0;

    const enrichedPortfolios = userPortfolios.map((portfolio) => {
      const holdings = allHoldings.filter((h) => h.portfolioId === portfolio.id);
      let totalValue = 0;
      let totalProfitLoss = 0;

      for (const holding of holdings) {
        const quote = quoteMap.get(holding.instrumentId);
        const currentPrice = quote?.buy ? parseFloat(quote.buy) : parseFloat(quote?.price ?? '0');
        const qty = parseFloat(holding.quantity);
        const purchPrice = parseFloat(holding.purchasePrice);

        const currentValue = currentPrice * qty;
        const costBasis = purchPrice * qty;
        totalValue += currentValue;
        totalProfitLoss += currentValue - costBasis;
      }

      if (portfolio.type === 'birikim') {
        totalSavings += totalValue;
      } else {
        totalDebts += totalValue;
      }

      return {
        id: portfolio.id,
        name: portfolio.name,
        type: portfolio.type,
        icon: portfolio.icon,
        color: portfolio.color,
        sortOrder: portfolio.sortOrder,
        holdingCount: holdings.length,
        totalValue: Math.round(totalValue * 100) / 100,
        totalProfitLoss: Math.round(totalProfitLoss * 100) / 100,
        totalProfitLossPercent: totalValue > 0 ? Math.round(((totalProfitLoss / (totalValue - totalProfitLoss)) * 100) * 100) / 100 : 0,
      };
    });

    return {
      portfolios: enrichedPortfolios,
      summary: {
        totalValue: Math.round((totalSavings - totalDebts) * 100) / 100,
        totalSavings: Math.round(totalSavings * 100) / 100,
        totalDebts: Math.round(totalDebts * 100) / 100,
      },
    };
  }

  async getPortfolioDetail(portfolioId: string, userId: string) {
    const portfolio = await db.query.portfolios.findFirst({
      where: and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)),
    });

    if (!portfolio) return null;

    const holdings = await db.query.portfolioHoldings.findMany({
      where: eq(portfolioHoldings.portfolioId, portfolioId),
    });

    const instrumentIds = [...new Set(holdings.map((h) => h.instrumentId))];
    const currentQuotes = instrumentIds.length > 0
      ? await db.query.latestQuotes.findMany({
          where: inArray(latestQuotes.instrumentId, instrumentIds),
        })
      : [];

    const instrumentData = instrumentIds.length > 0
      ? await db.query.instruments.findMany({
          where: inArray(instruments.id, instrumentIds),
        })
      : [];

    const quoteMap = new Map(currentQuotes.map((q) => [q.instrumentId, q]));
    const instrumentMap = new Map(instrumentData.map((i) => [i.id, i]));

    let totalValue = 0;
    let totalProfitLoss = 0;

    const enrichedHoldings = holdings.map((holding) => {
      const quote = quoteMap.get(holding.instrumentId);
      const instrument = instrumentMap.get(holding.instrumentId);
      const currentPrice = quote?.buy ? parseFloat(quote.buy) : parseFloat(quote?.price ?? '0');
      const qty = parseFloat(holding.quantity);
      const purchPrice = parseFloat(holding.purchasePrice);

      const currentValue = currentPrice * qty;
      const costBasis = purchPrice * qty;
      const profitLoss = currentValue - costBasis;

      totalValue += currentValue;
      totalProfitLoss += profitLoss;

      return {
        id: holding.id,
        instrumentId: holding.instrumentId,
        instrumentName: instrument?.name ?? holding.instrumentId,
        quantity: holding.quantity,
        purchasePrice: holding.purchasePrice,
        currentPrice: String(Math.round(currentPrice * 100) / 100),
        currentValue: Math.round(currentValue * 100) / 100,
        profitLoss: Math.round(profitLoss * 100) / 100,
        profitLossPercent: costBasis > 0 ? Math.round((profitLoss / costBasis) * 10000) / 100 : 0,
        purchaseDate: holding.purchaseDate,
        description: holding.description,
      };
    });

    return {
      id: portfolio.id,
      name: portfolio.name,
      type: portfolio.type,
      icon: portfolio.icon,
      color: portfolio.color,
      holdingCount: holdings.length,
      totalValue: Math.round(totalValue * 100) / 100,
      totalProfitLoss: Math.round(totalProfitLoss * 100) / 100,
      totalProfitLossPercent: totalValue > 0 ? Math.round(((totalProfitLoss / (totalValue - totalProfitLoss)) * 100) * 100) / 100 : 0,
      holdings: enrichedHoldings,
    };
  }

  async createPortfolio(userId: string, input: CreatePortfolioInput) {
    const [portfolio] = await db.insert(portfolios).values({
      userId,
      name: input.name,
      type: input.type,
      icon: input.icon || '💰',
      color: input.color || '#C6A15B',
    }).returning();

    logger.info({ portfolioId: portfolio.id, userId }, 'Portfolio created');
    return portfolio;
  }

  async updatePortfolio(portfolioId: string, userId: string, input: UpdatePortfolioInput) {
    const [updated] = await db.update(portfolios)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)))
      .returning();

    return updated ?? null;
  }

  async deletePortfolio(portfolioId: string, userId: string) {
    const [deleted] = await db.delete(portfolios)
      .where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)))
      .returning({ id: portfolios.id });

    return !!deleted;
  }

  async addHolding(portfolioId: string, userId: string, input: CreateHoldingInput) {
    // Verify portfolio belongs to user
    const portfolio = await db.query.portfolios.findFirst({
      where: and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)),
    });

    if (!portfolio) return null;

    const [holding] = await db.insert(portfolioHoldings).values({
      portfolioId,
      instrumentId: input.instrumentId,
      quantity: input.quantity,
      purchasePrice: input.purchasePrice,
      purchaseDate: input.purchaseDate,
      description: input.description?.slice(0, 30) || null,
    }).returning();

    logger.info({ holdingId: holding.id, portfolioId }, 'Holding added');
    return holding;
  }

  async updateHolding(portfolioId: string, holdingId: string, userId: string, input: UpdateHoldingInput) {
    // Verify portfolio belongs to user
    const portfolio = await db.query.portfolios.findFirst({
      where: and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)),
    });

    if (!portfolio) return null;

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.quantity !== undefined) updateData.quantity = input.quantity;
    if (input.purchasePrice !== undefined) updateData.purchasePrice = input.purchasePrice;
    if (input.purchaseDate !== undefined) updateData.purchaseDate = input.purchaseDate;
    if (input.description !== undefined) updateData.description = input.description?.slice(0, 30) || null;
    if (input.instrumentId !== undefined) updateData.instrumentId = input.instrumentId;

    const [updated] = await db.update(portfolioHoldings)
      .set(updateData)
      .where(and(eq(portfolioHoldings.id, holdingId), eq(portfolioHoldings.portfolioId, portfolioId)))
      .returning();

    return updated ?? null;
  }

  async deleteHolding(portfolioId: string, holdingId: string, userId: string) {
    // Verify portfolio belongs to user
    const portfolio = await db.query.portfolios.findFirst({
      where: and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)),
    });

    if (!portfolio) return false;

    const [deleted] = await db.delete(portfolioHoldings)
      .where(and(eq(portfolioHoldings.id, holdingId), eq(portfolioHoldings.portfolioId, portfolioId)))
      .returning({ id: portfolioHoldings.id });

    return !!deleted;
  }
}
