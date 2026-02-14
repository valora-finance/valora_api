import type { ApiRateItem, ApiLatestResponse } from '../types/api.types';
import type { InferSelectModel } from 'drizzle-orm';
import type { latestQuotes, instruments } from '../db/schema';

type LatestQuoteRow = InferSelectModel<typeof latestQuotes>;
type InstrumentRow = InferSelectModel<typeof instruments>;

/**
 * Maps database records to API contract types
 */
export class MapperService {
  /**
   * Map latest_quotes + instruments to ApiRateItem
   */
  mapToApiRateItem(
    quote: LatestQuoteRow,
    instrument: InstrumentRow | undefined
  ): ApiRateItem {
    return {
      instrumentId: quote.instrumentId,
      ts: quote.ts,
      price: parseFloat(quote.price),
      price24hAgo: quote.price24hAgo ? parseFloat(quote.price24hAgo) : null,
      ts24hAgo: quote.ts24hAgo ?? null,
      buy: quote.buy ? parseFloat(quote.buy) : null,
      sell: quote.sell ? parseFloat(quote.sell) : null,
      source: quote.source,
      name: instrument?.name,
      code: instrument?.code,
    };
  }

  /**
   * Map array of quotes to ApiLatestResponse
   */
  mapToApiLatestResponse(
    category: 'metals' | 'fx',
    items: ApiRateItem[],
    source: 'cache' | 'refreshed',
    lastUpdatedTs: number | null
  ): ApiLatestResponse {
    return {
      category,
      source,
      lastUpdatedTs,
      items,
    };
  }

  /**
   * Calculate percentage change from 24h ago
   */
  calculateChangePercent(current: number, previous: number | null): number | null {
    if (!previous || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  }
}
