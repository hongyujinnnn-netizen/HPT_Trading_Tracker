<p align="center">
  <img src="https://img.shields.io/badge/XAU%2FUSD-GOLD-C9A227?style=for-the-badge&logo=bitcoin&logoColor=white" alt="XAU/USD Gold" />
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite 6" />
  <img src="https://img.shields.io/badge/Supabase-Postgres-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
</p>

# 🥇 TradePulse Gold

> **A premium dark-terminal trading journal & analytics dashboard for XAU/USD (Gold) traders.**
> Built for disciplined execution tracking, real-time market awareness, and high-impact news event correlation.

---

## ✨ Features

### 📊 Overview Dashboard
- **Personalized greeting** with live session countdown pill (e.g. `● London session · 3h 12m left`)
- **5 KPI Stat Cards** — Net P&L, Win Rate, Risk:Reward, Max Drawdown, Total Trades — each with inline SVG sparkline graphs
- **Equity Trajectory** — cumulative USD equity curve (Recharts area chart)
- **Session Performance** — P&L breakdown by trading session (Asian / London / New York / Overlap)
- **Daily P&L Calendar** — 7-column month grid with green/red day cards showing daily profit/loss
- **Win / Loss Split Donut** — Recharts pie chart with center win-rate percentage and breakdown table

### 📈 Live Gold Ticker Bar
- **Real-time XAU/USD spot price** via `gold-api.com` REST with CoinGecko PAXG fallback
- **Active trading session badge** — shows current session (Asian / London / New York / Overlap / Sydney / Weekend Closed) with remaining time

### ➕ Trade Entry & Journal
- Full trade logging: side, entry/exit price, stop loss, take profit, lot size, strategy, session, emotion, market condition
- **Chart screenshot attachment** stored in IndexedDB (via `idb-keyval`)
- **Mistake tagging** — discipline-leak flags auto-detected by rule engine
- **CSV import** from MT4/MT5 trade history exports

### 🔍 Trade Detail Modal
- Comprehensive trade breakdown with realized P&L, R:R, full parameter grid
- **⚠ High-Impact News Badge** — automatically flags when a trade's entry time is within ±30 minutes of a high-impact economic event (e.g. `⚠ Near NFP`, `⚠ Near FOMC`)
- Mistake flags and retrospective notes
- Embedded chart screenshot viewer

### 📰 Economic Calendar Widget
- Live Supabase query for events within **today ±3 days**
- Color-coded impact badges: 🔴 High / 🟠 Medium / ⚪ Low
- Graceful empty state when the Edge Function hasn't populated data yet

### 📰 Market News & Economic Calendar
- Seeded high-impact USD economic releases (NFP, CPI, FOMC, GDP, PMI)
- Impact-level pill badges and forecast vs previous data columns

### 📉 Analytics
- Cumulative P&L curve, win/loss distribution, strategy-level breakdown
- Session-based performance heat map

### ⚔️ Strategy Comparison
- Head-to-head strategy metrics: win rate, avg R:R, total P&L, trade count
- Visual comparison charts

### 🧮 Risk Calculator
- Position sizing based on account balance, risk %, stop loss distance
- Lot size and dollar risk output

### 🚨 Mistake Center
- Aggregated discipline leaks across all trades
- Frequency ranking of most common mistakes

### ⚙️ Settings
- Supabase cloud sync toggle (auth with email/password)
- Account preferences, data management

---

## 🏗️ Architecture

```
src/
├── App.jsx                     # Root app — sidebar nav, page router, code-splitting
├── index.css                   # Global styles, Tailwind layers, terminal-card, font-mono-num
│
├── components/
│   ├── AuthGate.jsx            # Supabase auth gate wrapper
│   ├── AuthModal.jsx           # Login/signup modal
│   ├── DailyPnLCalendar.jsx    # 7-col month calendar grid
│   ├── EconomicCalendarWidget.jsx  # Live DB economic events widget
│   ├── ImportModal.jsx         # CSV import modal
│   ├── Pill.jsx                # Shared color-coded pill badge component
│   ├── SectionLabel.jsx        # Section header with right-slot
│   ├── StatCard.jsx            # KPI card with SVG sparkline
│   ├── TickerBar.jsx           # Live gold price + session badge navbar
│   ├── TradeModal.jsx          # Trade detail view with news badge
│   └── WinLossSplit.jsx        # Donut chart win/loss component
│
├── context/
│   └── TradeContext.jsx        # Global trade state (React Context + Supabase sync)
│
├── lib/
│   └── economicEvents.ts       # Typed Supabase queries + isNearHighImpactEvent helper
│
├── pages/
│   ├── Dashboard.jsx           # Overview dashboard (KPIs, equity, calendar, donut)
│   ├── AddTrade.jsx            # Trade entry form
│   ├── TradeHistory.jsx        # Filterable trade log table
│   ├── Analytics.jsx           # Performance analytics charts
│   ├── StrategyCompare.jsx     # Strategy head-to-head
│   ├── RiskCalculator.jsx      # Position sizing calculator
│   ├── MarketNews.jsx          # Seeded economic calendar page
│   ├── MistakeCenter.jsx       # Discipline leak aggregation
│   └── Settings.jsx            # App preferences & Supabase sync
│
├── services/
│   ├── supabaseClient.js       # Supabase client init
│   ├── supabaseStore.js        # Supabase CRUD operations
│   ├── tradeRepository.js      # Unified data access (local + cloud)
│   ├── tradeStore.js           # localStorage trade persistence
│   └── imageStore.js           # IndexedDB screenshot storage (idb-keyval)
│
└── utils/
    ├── calculations.js         # P&L, win rate, drawdown, R:R calculations
    ├── csvParser.js            # MT4/MT5 CSV trade history parser
    ├── mistakeDetector.js      # Rule-based discipline leak detection
    ├── mockData.js             # Seed data for demo mode
    ├── newsCalendar.js         # Static economic events seed data
    ├── sessionDetector.js      # Gold session calculator (UTC-based)
    └── __tests__/              # Vitest unit test suite (28 tests)
        ├── calculations.test.js
        ├── dashboardComponents.test.js
        ├── economicEvents.test.js
        ├── migration.test.js
        ├── mistakeDetector.test.js
        ├── priceFeed.test.js
        └── sessionDetector.test.js

supabase/
├── schema.sql                  # Full Postgres schema (trades, economic_events, RLS)
├── cron_setup.sql              # pg_cron scheduling for Edge Functions
├── README_GOLD_API.md          # Gold price API documentation
└── functions/
    └── fetch-gold-price/       # Edge Function: live XAU/USD price fetcher
        └── index.ts
```

---

## 🎨 Design System

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `bg` | `#0A0C0E` | App background |
| `surface` | `#131619` | Card / panel background (`.terminal-card`) |
| `elevated` | `#1B1F23` | Elevated surfaces, inputs |
| `borderDark` | `#262B30` | Card borders (hover) |
| `borderSoft` | `#1E2226` | Card borders (default), dividers |
| `gold` | `#C9A227` | Primary accent — gold branding |
| `goldBright` | `#E4C468` | Gold highlights, warnings |
| `goldDim` | `#8A7332` | Muted gold accents |
| `profit` | `#3FA88C` | Winning trades, positive values |
| `profitDim` | `#1F4A40` | Profit backgrounds |
| `loss` | `#C1502E` | Losing trades, negative values |
| `lossDim` | `#4A2A1E` | Loss backgrounds |
| `textMain` | `#EDEAE3` | Primary text (warm off-white) |
| `mutedMain` | `#8B8D91` | Secondary text, labels |
| `mutedDim` | `#5A5D61` | Tertiary text, disabled state |

### Typography

| Class | Font | Usage |
|-------|------|-------|
| `font-display` | Space Grotesk | Headings, titles, bold labels |
| `font-body` / default | Inter | Body text, descriptions |
| `font-mono-num` | IBM Plex Mono | Prices, numbers, timestamps, IDs |

### Component Primitives

- **`.terminal-card`** — Dark glass panel with subtle border, hover glow transition
- **`<Pill tone="profit|loss|gold|warning|neutral">`** — Color-coded badge with `font-mono-num`
- **`<SectionLabel>`** — Section header with optional right-slot (pill, badge, action)
- **`<StatCard>`** — KPI card with title, value, delta badge, and inline SVG sparkline
- **Glow classes**: `.gold-glow`, `.profit-glow`, `.loss-glow` — subtle colored box-shadows

---

## 🗄️ Database Schema (Supabase)

### `trades` table
Core trade journal storage with full entry/exit parameters, P&L, strategy tags, and emotion logging. Row Level Security (RLS) enabled — users can only access their own trades.

### `economic_events` table
| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key |
| `event_time` | `timestamptz` | When the event occurs |
| `title` | `text` | Event name (e.g. "Non-Farm Payrolls") |
| `currency` | `text` | Currency code, default `'USD'` |
| `impact` | `news_impact` enum | `'high'` \| `'medium'` \| `'low'` |
| `note` | `text` | Optional description / commentary |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** ≥ 18
- **npm** ≥ 9
- A **Supabase** project (free tier works)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/tradepulse-gold.git
cd tradepulse-gold

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase project URL and anon key:
#   VITE_SUPABASE_URL=https://your-project.supabase.co
#   VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### Database Setup

```bash
# Apply the schema to your Supabase project
# Option 1: Via Supabase Dashboard → SQL Editor → paste supabase/schema.sql
# Option 2: Via Supabase CLI
supabase db push
```

### Development

```bash
# Start dev server (hot reload)
npm run dev

# Run unit tests
npm run test

# Production build
npm run build

# Preview production build
npm run preview
```

---

## 🧪 Testing

**28 unit tests** across 7 test files, powered by [Vitest](https://vitest.dev/).

```
 ✓ calculations.test.js          4 tests — P&L, win rate, drawdown, R:R
 ✓ dashboardComponents.test.js   2 tests — Calendar/donut render validation
 ✓ economicEvents.test.js       11 tests — isNearHighImpactEvent boundaries
 ✓ migration.test.js             1 test  — Schema migration integrity
 ✓ mistakeDetector.test.js       5 tests — Discipline leak rule engine
 ✓ priceFeed.test.js             2 tests — Gold API response parsing
 ✓ sessionDetector.test.js       3 tests — UTC session detection logic
```

```bash
npm run test
```

---

## 📦 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | React 18.3 | Component-based UI |
| **Build Tool** | Vite 6 | Lightning-fast HMR & bundling |
| **Styling** | Tailwind CSS 3.4 | Utility-first CSS |
| **Charts** | Recharts 2.15 | Area, bar, pie charts |
| **Icons** | Lucide React | Consistent icon system |
| **Backend** | Supabase (Postgres + Auth + Edge Functions) | Database, auth, serverless |
| **Local Storage** | localStorage + IndexedDB (`idb-keyval`) | Offline-first trade data + screenshots |
| **Testing** | Vitest 3 | Fast unit testing |
| **Types** | TypeScript (selective — `src/lib/`) | Type safety for data access layer |

---

## 📋 Roadmap

- [ ] Deploy `fetch-economic-events` Edge Function (align with live schema)
- [ ] Wire `EconomicCalendarWidget` into Dashboard layout
- [ ] Real-time WebSocket gold price streaming (replace REST polling)
- [ ] Trade replay / time-based chart annotations
- [ ] Mobile-responsive sidebar (hamburger menu)
- [ ] PWA support (offline mode + install prompt)
- [ ] Export trade history to PDF/Excel
- [ ] Multi-instrument support (XAG, Forex pairs)

---

## 📄 License

This project is private and proprietary. All rights reserved.

---

<p align="center">
  <sub>Built with ☕ and 🥇 by <strong>Bun</strong> — <em>Trade with discipline, not emotion.</em></sub>
</p>
