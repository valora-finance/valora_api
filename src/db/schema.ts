import { pgTable, varchar, integer, boolean, timestamp, bigint, decimal, text, uuid, index, check, date } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Instruments table - Enstrüman tanımları (metals/forex)
export const instruments = pgTable(
  'instruments',
  {
    id: varchar('id', { length: 50 }).primaryKey(),
    category: varchar('category', { length: 10 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    code: varchar('code', { length: 20 }).notNull(),
    quoteCurrency: varchar('quote_currency', { length: 10 }).notNull().default('TRY'),
    unit: varchar('unit', { length: 20 }),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    categoryIdx: index('idx_instruments_category').on(table.category).where(sql`${table.isActive} = true`),
    categoryCheck: check('category_check', sql`${table.category} IN ('metals', 'fx')`),
  })
);

// Latest quotes table - Güncel cached fiyatlar (hızlı lookup)
export const latestQuotes = pgTable(
  'latest_quotes',
  {
    instrumentId: varchar('instrument_id', { length: 50 }).primaryKey().references(() => instruments.id),
    ts: bigint('ts', { mode: 'number' }).notNull(),
    price: decimal('price', { precision: 18, scale: 6 }).notNull(),
    price24hAgo: decimal('price_24h_ago', { precision: 18, scale: 6 }),
    ts24hAgo: bigint('ts_24h_ago', { mode: 'number' }),
    buy: decimal('buy', { precision: 18, scale: 6 }),
    sell: decimal('sell', { precision: 18, scale: 6 }),
    source: varchar('source', { length: 50 }).notNull(),
    rawData: text('raw_data'), // JSON as text
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    updatedIdx: index('idx_latest_quotes_updated').on(table.updatedAt),
  })
);

// Quotes table - Historical time-series data
export const quotes = pgTable(
  'quotes',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    instrumentId: varchar('instrument_id', { length: 50 }).notNull().references(() => instruments.id),
    ts: bigint('ts', { mode: 'number' }).notNull(),
    price: decimal('price', { precision: 18, scale: 6 }).notNull(),
    buy: decimal('buy', { precision: 18, scale: 6 }),
    sell: decimal('sell', { precision: 18, scale: 6 }),
    source: varchar('source', { length: 50 }).notNull(),
    rawData: text('raw_data'), // JSON as text
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    instrumentTsIdx: index('idx_quotes_instrument_ts').on(table.instrumentId, table.ts),
    tsIdx: index('idx_quotes_ts').on(table.ts),
  })
);

// Fetch state table - Refresh tracking
export const fetchState = pgTable('fetch_state', {
  key: varchar('key', { length: 50 }).primaryKey(),
  lastSuccessTs: bigint('last_success_ts', { mode: 'number' }),
  lastAttemptTs: bigint('last_attempt_ts', { mode: 'number' }),
  lastStatus: varchar('last_status', { length: 20 }),
  lastError: text('last_error'),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Users table - User authentication
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }),
    provider: varchar('provider', { length: 20 }).notNull().default('email'),
    providerId: varchar('provider_id', { length: 255 }),
    displayName: varchar('display_name', { length: 100 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (table) => ({
    emailIdx: index('idx_users_email').on(table.email).where(sql`${table.isActive} = true`),
    providerIdx: index('idx_users_provider_provider_id').on(table.provider, table.providerId),
  })
);

// Portfolios table - User portfolios (birikimler/borçlar)
export const portfolios = pgTable(
  'portfolios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(), // 'birikim' | 'borc'
    icon: varchar('icon', { length: 50 }).notNull().default('💰'),
    color: varchar('color', { length: 20 }).notNull().default('#C6A15B'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('idx_portfolios_user').on(table.userId),
    typeCheck: check('portfolio_type_check', sql`${table.type} IN ('birikim', 'borc')`),
  })
);

// Portfolio holdings table - Individual holdings within a portfolio
export const portfolioHoldings = pgTable(
  'portfolio_holdings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    portfolioId: uuid('portfolio_id').notNull().references(() => portfolios.id, { onDelete: 'cascade' }),
    instrumentId: varchar('instrument_id', { length: 50 }).notNull().references(() => instruments.id),
    quantity: decimal('quantity', { precision: 18, scale: 6 }).notNull(),
    purchasePrice: decimal('purchase_price', { precision: 18, scale: 6 }).notNull(),
    purchaseDate: date('purchase_date').notNull(),
    description: varchar('description', { length: 30 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    portfolioIdx: index('idx_holdings_portfolio').on(table.portfolioId),
    instrumentIdx: index('idx_holdings_instrument').on(table.instrumentId),
  })
);

// Type exports for TypeScript
export type Instrument = typeof instruments.$inferSelect;
export type NewInstrument = typeof instruments.$inferInsert;
export type LatestQuote = typeof latestQuotes.$inferSelect;
export type NewLatestQuote = typeof latestQuotes.$inferInsert;
export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
export type FetchState = typeof fetchState.$inferSelect;
export type NewFetchState = typeof fetchState.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Portfolio = typeof portfolios.$inferSelect;
export type NewPortfolio = typeof portfolios.$inferInsert;
export type PortfolioHolding = typeof portfolioHoldings.$inferSelect;
export type NewPortfolioHolding = typeof portfolioHoldings.$inferInsert;
