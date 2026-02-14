# Valora API - Node.js

Production-ready Node.js API for Valora mobile app. Provides precious metals (gold/silver) and forex rates from Turkish financial markets.

## Tech Stack

- **Framework**: Fastify 5.x (TypeScript)
- **Database**: PostgreSQL with Drizzle ORM
- **Caching**: In-memory (60s TTL)
- **Security**: Helmet, rate limiting, API key auth
- **Data Sources**:
  - Metals: Truncgil Finans API
  - Forex: TCMB (Turkish Central Bank) + fallbacks
- **Deployment**: Railway.app

## Project Structure

```
src/
├── app.ts                          # Fastify app setup with middleware
├── server.ts                       # Entry point with scheduler
├── config/
│   ├── index.ts                    # Environment configuration
│   ├── database.ts                 # PostgreSQL connection pool
│   └── instruments.ts              # Instrument ID mappings
├── routes/
│   ├── index.ts                    # Route registration
│   ├── health.ts                   # GET /health
│   └── v1/
│       ├── metals.ts               # GET /v1/metals/latest
│       ├── fx.ts                   # GET /v1/fx/latest
│       ├── instruments.ts          # GET /v1/instruments
│       └── history.ts              # GET /v1/history
├── services/
│   ├── refresh.service.ts          # Data refresh orchestration
│   ├── mapper.service.ts           # DB → API contract mapping
│   ├── cache.service.ts            # In-memory cache with TTL
│   └── data-sources/
│       ├── truncgil.service.ts     # Metals data (Truncgil API)
│       ├── tcmb.service.ts         # Forex data (TCMB XML) + 10yr backfill
│       └── exchangerate.service.ts # Forex fallback (ExchangeRate.host)
├── db/
│   ├── schema.ts                   # 5 tables: instruments, quotes, latest_quotes, fetch_state, users
│   ├── migrations/                 # SQL migrations
│   └── migrate.ts                  # Migration runner
├── utils/
│   ├── logger.ts                   # Pino logger
│   └── scheduler.ts                # Cron jobs + initial backfill
└── types/
    └── api.types.ts                # API contract types (mobile app compatibility)

scripts/
└── seed.ts                         # Database seeding (20 instruments)
```

## Development Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ (local or Railway)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your DATABASE_URL
```

### Database Setup

```bash
# Generate migrations (already done)
npm run db:generate

# Run migrations
npm run db:migrate

# Seed instruments
npm run db:seed
```

### Run Development Server

```bash
npm run dev
```

Server will start at http://localhost:5050

### Test Health Endpoint

```bash
curl http://localhost:5050/health
# Expected: {"ok":true,"ts":1673987654}
```

## Production Build

```bash
# Build TypeScript
npm run build

# Run production server
npm start
```

## Railway Deployment

### Option 1: Railway CLI (Recommended)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add PostgreSQL
railway add postgres

# Set environment variables
railway variables set NODE_ENV=production
railway variables set API_KEY=vla_YOUR_API_KEY_HERE

# Deploy
railway up
```

### Option 2: GitHub Integration

1. Push code to GitHub
2. Connect repository in Railway dashboard
3. Add PostgreSQL service
4. Set environment variables
5. Auto-deploy on push

### Environment Variables (Railway)

Required:
- `NODE_ENV=production`
- `DATABASE_URL` (auto-populated by Railway)
- `API_KEY` (generate with: `openssl rand -hex 32`)

Optional:
- `PORT` (Railway sets automatically)
- `SENTRY_DSN` (for error tracking)

### Post-Deployment

```bash
# Run migrations (one-time)
railway run npm run db:migrate

# Seed instruments (one-time)
railway run npm run db:seed

# View logs
railway logs --tail

# Test health
curl https://your-app.railway.app/health
```

## API Endpoints

### Health Check
```
GET /health
Response: { "ok": true, "ts": 1673987654 }
```

### Metals (Gold/Silver)
```
GET /v1/metals/latest
Response: {
  "category": "metals",
  "source": "cache",
  "lastUpdatedTs": 1707341234,
  "items": [
    {
      "instrumentId": "gram",
      "ts": 1707341234,
      "price": 2550.50,
      "price24hAgo": 2540.00,
      "ts24hAgo": 1707254834,
      "buy": 2548.00,
      "sell": 2553.00,
      "source": "truncgil",
      "name": "Gram Altın",
      "code": "XAU/TRY"
    }
  ]
}
```

### Forex
```
GET /v1/fx/latest
Response: {
  "category": "fx",
  "source": "cache",
  "lastUpdatedTs": 1707341234,
  "items": [
    {
      "instrumentId": "USDTRY",
      "ts": 1707341234,
      "price": 35.15,
      "price24hAgo": 35.10,
      "ts24hAgo": 1707254834,
      "buy": 35.12,
      "sell": 35.18,
      "source": "tcmb",
      "name": "Dolar",
      "code": "USD/TRY"
    }
  ]
}
```

### Instruments
```
GET /v1/instruments?category=metals
Response: {
  "category": "metals",
  "items": [
    {
      "id": "gram",
      "name": "Gram Altın",
      "code": "XAU/TRY",
      "category": "metals",
      "unit": "gram",
      "sortOrder": 1
    }
  ]
}
```

### Historical Data
```
GET /v1/history?instrumentId=gram&from=1704067200&to=1707341234&limit=1000
Response: {
  "instrumentId": "gram",
  "category": "metals",
  "points": [
    {
      "ts": 1707341234,
      "price": 2550.50,
      "buy": 2548.00,
      "sell": 2553.00
    }
  ]
}
```

## Database Schema

### Tables
- `instruments` - Metal/forex instrument definitions
- `latest_quotes` - Current cached prices (fast lookups)
- `quotes` - Historical time-series data
- `fetch_state` - Refresh operation tracking
- `users` - Future user registration

## Security

- **API Key Authentication**: X-API-KEY header required
- **Rate Limiting**: 100 req/min per IP, 300 per API key
- **Security Headers**: Helmet (XSS, CSP, HSTS)
- **Request Timeouts**: 10 seconds max
- **Input Validation**: JSON Schema on all endpoints

## Monitoring

- **Logs**: Pino logger → Railway logs
- **Uptime**: Better Uptime (free tier)
- **Errors**: Sentry (5k events/month free)

## Development Phases

- ✅ **Phase 1**: Core API + Database - **COMPLETED**
- ✅ **Phase 2**: Data Source Integration (Truncgil, TCMB, ExchangeRate.host) - **COMPLETED**
- ✅ **Phase 3**: API Endpoints & Caching - **COMPLETED**
- ✅ **Phase 4**: Security & Rate Limiting - **COMPLETED**
- ⏳ **Phase 5**: Testing & Initial Deployment - Next
- ⏳ **Phase 6**: Mobile App Integration & Production Launch

## Background Jobs

The API automatically:
- Refreshes metal prices every 5 minutes (Truncgil)
- Refreshes forex rates every 10 minutes (TCMB with fallback)
- Performs 10-year historical backfill on first startup
- Cleans up expired cache entries hourly

## License

MIT
