// API Response Types (Contract with Mobile App)
// These MUST match the mobile app's expectations exactly

export type RateCategory = 'metals' | 'fx';

export type ApiRateItem = {
  instrumentId: string;
  ts: number; // Unix timestamp (seconds)
  price: number;
  price24hAgo?: number | null;
  ts24hAgo?: number | null;
  buy: number | null;
  sell: number | null;
  source: string;
  name?: string;
  code?: string;
};

export type ApiLatestResponse = {
  category: RateCategory;
  source: 'cache' | 'refreshed';
  lastUpdatedTs: number | null;
  items: ApiRateItem[];
};

export type ApiInstrument = {
  id: string;
  category: RateCategory;
  name: string;
  code: string;
  quoteCurrency: string;
  unit?: string;
  sortOrder: number;
};

export type ApiInstrumentsResponse = {
  category: RateCategory;
  items: ApiInstrument[];
};

export type ApiHistoricalPoint = {
  ts: number;
  price: number;
  buy?: number | null;
  sell?: number | null;
};

export type ApiHistoryResponse = {
  instrumentId: string;
  category: RateCategory;
  points: ApiHistoricalPoint[];
};

export type ApiHealthResponse = {
  ok: boolean;
  ts: number;
};

export type ApiErrorResponse = {
  error: string;
  message: string;
  retryAfter?: number;
};
