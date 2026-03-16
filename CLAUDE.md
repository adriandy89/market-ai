# Market AI — Project Context

## Overview

Plataforma de analisis de criptomonedas con IA. Full-stack: NestJS 11 (backend) + Angular 21 (frontend) + PostgreSQL + Redis + Anthropic Claude AI.

## Stack

- **Backend:** NestJS 11, TypeScript 5.7, Prisma 7, BullMQ, Redis, Passport (sessions)
- **Frontend:** Angular 21 (standalone components, signals), Tailwind CSS 4, lightweight-charts (TradingView), @jsverse/transloco (i18n ES/EN), marked (markdown rendering)
- **AI:** Anthropic Claude Sonnet via @anthropic-ai/sdk — reportes en markdown
- **Data:** CoinGecko (precios, top coins, search), Binance (klines/velas OHLCV), CryptoCompare (noticias), Alternative.me (Fear & Greed Index)
- **DB:** PostgreSQL con Prisma ORM, Redis para cache y sesiones
- **Deploy:** Docker multi-stage, docker-compose con network externo

## Architecture

```
src/
  modules/
    auth/        — Login, signup, sessions, password reset, email verification
    user/        — User CRUD, language preference, session management
    crypto/      — CoinGecko + Binance integration, watchlists, search
    analysis/    — Technical indicators (RSI, MACD, BB, EMA, SMA, Stoch, ADX),
                   candlestick patterns, support/resistance, multi-timeframe analysis
    market-context/ — News (CryptoCompare), Sentiment (Fear & Greed + Global Market),
                      Macro context (regulatory/macro keyword filtering, market regime)
    ai/          — Report generation with Claude, markdown output, find-or-clone cache (15min)
    verifications/ — Email tokens, password reset tokens
  libs/
    cache/       — Redis cache service
    db/          — Prisma database service
    common/      — Pagination, filters, interceptors

frontend/src/app/
  core/
    auth/        — AuthService, guards, interceptor, models
    services/    — CryptoApiService, AnalysisApiService, AiApiService,
                   MarketContextApiService, LanguageService, TranslocoHttpLoader
  features/
    landing/     — Public landing page
    auth/        — Login, Signup, ForgotPassword
    dashboard/   — Top 200 coins table with sort, search bar
    coin-detail/ — Price, sentiment, chart, indicators, S/R, patterns, news, report history
    ai-reports/  — Reports list + report detail (markdown viewer + legacy JSON)
    profile/     — Language selector (ES/EN), account info
  shared/
    components/search-bar/ — Crypto search with CoinGecko API, debounce, dropdown
    trading-chart/         — Candlestick chart with indicators, WebSocket realtime
    pipes/markdown.pipe.ts — Marked markdown rendering
    utils/format.ts        — Price, percentage, compact number formatting
  layouts/
    dashboard-layout/ — Sidebar (desktop) + hamburger drawer (mobile), responsive
    auth-layout/      — Centered auth card
```

## Database Schema

- **User** — id, email, password (bcrypt), name, role (USER/ADMIN), language (es/en), is_email_verified
- **SessionLogs** — session_id, user_id, ip, attributes (jsonb), login/logout timestamps
- **Watchlist** — user_id, symbol, name (unique per user+symbol)
- **AnalysisReport** — user_id, symbol, timeframe, report_type (full/comprehensive), content (jsonb), created_at
  - Indexed: user_id, symbol, created_at, composite (symbol+timeframe+report_type+created_at) for fresh report lookup
- **VerificationToken**, **PasswordResetToken** — email, token, expires

## AI Report System

### Two report types:
1. **Standard** (`POST /ai/report/:symbol?timeframe=4h`) — single timeframe, 2000 tokens
2. **Comprehensive** (`POST /ai/report/:symbol/comprehensive`) — multi-timeframe (4h+1d+1w) + news + sentiment + macro, 4096 tokens

### Data pipeline for comprehensive report:
1. Price from CoinGecko
2. Technical indicators for 3 timeframes (4h, 1d, 1w) — 9 parallel Binance calls
3. Confluence calculation server-side (trend alignment, strength, observations)
4. News from CryptoCompare (keyword-based sentiment classification)
5. Fear & Greed Index from Alternative.me
6. Global market data from CoinGecko /global
7. Macro context: regulatory/economic keyword filtering + market regime derivation

### Report caching:
- Before calling Claude, searches for fresh report (<15min) matching symbol + timeframe + report_type + language
- If found → clones for current user (no Claude call, instant response)
- Different languages generate separate reports

### Output:
- Claude generates **markdown** (not JSON) following a structured template
- Stored as string in `content.aiAnalysis`, with `content.aiSummary` extracted for list views
- Frontend renders with `marked` library + custom `.prose` styles

## API Endpoints

### Auth (`/api/v1/auth/`)
- POST signin, POST signup, GET profile, POST logout
- GET activate-email/:token, PUT change-password
- POST forgot-password, POST reset-password

### Crypto (`/api/v1/crypto/`)
- GET search?q= (CoinGecko search)
- GET top?limit=200, GET trending, GET price/:symbol
- GET klines/:symbol?interval=&limit=, GET history/:symbol?days=
- GET/POST/DELETE watchlist (SessionGuard)

### Analysis (`/api/v1/analysis/`)
- GET /:symbol/indicators?timeframe=, GET /:symbol/patterns?timeframe=
- GET /:symbol/levels?timeframe=

### Market Context (`/api/v1/market-context/`)
- GET :symbol/news, GET sentiment, GET :symbol/full

### AI (`/api/v1/ai/`)
- POST report/:symbol?timeframe= (standard)
- POST report/:symbol/comprehensive
- GET reports?page=&limit=&symbol= (filterable by symbol)
- GET reports/:id

### Users (`/api/v1/users/`)
- PUT language (update user language)
- GET sessions/active, DELETE sessions/others
- Admin: GET, GET/:id, DELETE/:id, PUT disable/many, PUT enable/many

## Key Patterns

- **Cache strategy:** Redis with TTLs — price 30s, klines 60-300s, indicators 300s, news 300s, sentiment 600s, macro 900s, search 300s
- **Error handling:** Promise.allSettled everywhere — graceful degradation if any API fails
- **Auth:** Passport local strategy + express-session + Redis session store (3-day TTL)
- **i18n:** @jsverse/transloco with HTTP loader, localStorage persistence, synced to backend user.language
- **Responsive:** Mobile-first with hamburger drawer, hidden columns on mobile, responsive chart heights

## Environment Variables

```
NODE_ENV, API_PORT, SWAGGER_ENABLE, COOKIE_DOMAIN
DATABASE_URL (PostgreSQL)
REDIS_URL, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
SESSION_SECRET
PUBLIC_APP_URL, EMAIL_USER, EMAIL_PASS
ANTHROPIC_API_KEY
COINGECKO_API_KEY
```

## Dev Commands

```bash
# Backend
pnpm install
npx prisma migrate dev
npx prisma generate
npm run start:dev

# Frontend
cd frontend
pnpm install
npx ng serve --proxy-config proxy.conf.json  # dev con proxy a :3001

# Build
npm run build          # backend
cd frontend && npx ng build  # frontend

# Docker
docker compose up --build
```

## Conventions

- Angular: standalone components, OnPush change detection, signals (no NgRx)
- NestJS: modular architecture, services injected via constructor
- Templates: inline in .ts files (no separate .html)
- Styling: Tailwind CSS utility classes with CSS custom properties for theme
- i18n keys: nested by feature (nav.*, dashboard.*, coin.*, reports.*, auth.*, profile.*)
- Translation files: public/i18n/es.json, public/i18n/en.json
