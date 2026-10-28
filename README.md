# PRILLS.AI — Real-Time Telegram Binary Trading Signal Terminal

A real-time binary trading signal intelligence platform that automatically collects, parses, and displays signals from two dedicated Telegram channels:

1. **SOURCE 1: LIVE MARKET PAIRS**
   - **Name:** `QUOTEX OFFICIAL VIP BOT`
   - **Link:** [https://t.me/quotexofficialvipbot](https://t.me/quotexofficialvipbot)
   - **Purpose:** Signals intended for live broker market pairs.
   - **Website Section:** `LIVE MARKET PAIRS` (`/live`)

2. **SOURCE 2: QUOTEX OTC MARKETS**
   - **Name:** `Quotex Vip Bot Signal`
   - **Link:** [https://t.me/quotex0o](https://t.me/quotex0o)
   - **Purpose:** Quotex OTC-market signals specifically.
   - **Website Section:** `QUOTEX OTC MARKETS` (`/otc`)

The two markets are **strictly segregated**. Signals are never mixed or assigned to the wrong market.

---

## Key Features

- **Automated Telegram Ingestion:** Persistent MTProto listener using authorized Telethon client.
- **Sub-Second to < 5–10s Latency Target:** Instant WebSocket broadcasting of signals as soon as they are published on Telegram.
- **Exact Announced Entry Times:** Preserves exact source announced time (e.g. `11:12`, `10:21:00`).
- **Late-Arriving Signal Detection:** Automatically flags messages received past the announced entry time with late duration calculation.
- **Automated Result Matching & Audit Trail:** Matches subsequent result reports (`EURJPY Loss`, `USDJPY Profit`) to earlier pending signals while maintaining a complete immutable audit log.
- **Permanent Database Repository:** SQLite (for zero-setup local execution) & PostgreSQL (for production) backed persistence with search, filters (Asset, Direction, WIN/LOSS/DRAW/PENDING, Date), pagination, and CSV export.
- **Premium Dark Navy Dashboard:** Sleek UI styled in deep navy (`#080D1A`), neon cyan and blue accents, emerald green for wins, and crimson red for losses.
- **Interactive Telegram Setup & Synthetic Testing Lab:** Authorize Telegram MTProto with phone + OTP + 2FA, and test with synthetic message injection templates.

---

## Project Structure

```
PRILLS.AI/
├── backend/
│   ├── app/
│   │   ├── config.py             # Settings, environment variables & channel definitions
│   │   ├── database.py           # Async SQLAlchemy database session manager
│   │   ├── models.py             # TelegramSource, TelegramMessage, ParsedSignal, SignalAuditLog
│   │   ├── parser.py             # Regex & rule parser for signals, results, and late checks
│   │   ├── matcher.py            # Result matcher linking outcomes to pending signals
│   │   ├── telegram_service.py   # Telethon MTProto client, login flow & channel listeners
│   │   ├── websocket_manager.py  # Real-time WebSocket broadcaster
│   │   ├── routes/               # API endpoints (signals, telegram auth, channels)
│   │   └── main.py               # FastAPI application entrypoint
│   ├── tests/                    # Pytest test suite for parser and matcher
│   ├── requirements.txt          # Python dependencies
│   └── venv/                     # Python virtual environment
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          # Homepage with 2 prominent market buttons & live ticker
│   │   │   ├── otc/page.tsx      # Dedicated Quotex OTC Markets view
│   │   │   ├── live/page.tsx     # Dedicated Live Market Pairs view
│   │   │   ├── history/page.tsx  # Permanent signal history archive with CSV export
│   │   │   └── telegram/page.tsx # Telegram API authorization wizard & test simulator
│   │   ├── components/           # Navbar, SignalCard, SignalTable, StatsCards, SignalModal
│   │   └── lib/                  # API client, WebSocket handlers & TypeScript models
│   └── package.json
├── docker-compose.yml            # Multi-container Docker deployment (Postgres, Backend, Frontend)
├── Dockerfile.backend
├── Dockerfile.frontend
├── .env.example
└── README.md
```

---

## Quickstart: Running Locally

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Start the Backend
Open a terminal in the project directory:

```bash
# Activate virtual environment
backend\venv\Scripts\activate   # Windows
# or: source backend/venv/bin/activate  # Linux/Mac

# Install dependencies (if not already installed)
pip install -r backend/requirements.txt

# Run backend on port 8000
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

The backend API will be available at:
- API Base: `http://localhost:8000`
- Swagger Interactive Docs: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`
- WebSocket Feed: `ws://localhost:8000/ws`

### 2. Start the Frontend
In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open your browser at:
- **Terminal UI:** [http://localhost:3000](http://localhost:3000)

---

## How to Authorize Telegram Sources

To listen to real Telegram channels, you need authorized Telegram API credentials:

1. **Get your API credentials:**
   - Visit [https://my.telegram.org](https://my.telegram.org) and log in with your Telegram account phone number.
   - Click on **API development tools**.
   - Create a new application (e.g. `PrillsSignals`) to get your **`api_id`** (numeric) and **`api_hash`** (string).
2. **Configure Credentials:**
   - **Option A (Web Interface):** Navigate to [http://localhost:3000/telegram](http://localhost:3000/telegram).
     - Enter your Phone Number (+CountryCode).
     - Enter your `api_id` and `api_hash`.
     - Click **Request Telegram Verification Code**.
     - Check your Telegram app for the official login code and enter it.
     - If you have 2FA enabled, enter your password.
     - The backend automatically connects and begins listening to both channels!
   - **Option B (.env File):** Add to `.env` or `backend/.env`:
     ```env
     TELEGRAM_API_ID=12345678
     TELEGRAM_API_HASH=abcdef1234567890abcdef1234567890
     TELEGRAM_PHONE_NUMBER=+919876543210
     ```

---

## Verifying Real-Time Updates & Ingestion Latency

You can test the entire pipeline without waiting for the Telegram channels to post:

1. Open the website: [http://localhost:3000](http://localhost:3000) in one browser tab.
2. In another tab, navigate to [http://localhost:3000/telegram](http://localhost:3000/telegram).
3. Under the **Synthetic Message Test Injector**:
   - Click on one of the quick presets (e.g. `EURJPY Call Up`, `AUDCAD-OTC Call`, or `Result: Profit`).
   - Click **Inject & Stream Live to Website**.
4. Observe the first browser tab:
   - The signal immediately appears with a green/red accent and pulse without refreshing the page.
   - Injecting a result (`EURJPY Loss` or `USDJPY Profit`) automatically updates the pending signal to **LOSS** or **WIN**.
   - Notice the reception timestamp, announced entry time, and verification dialog.

---

## Running the Automated Test Suite

Run pytest in the project root:

```bash
backend\venv\Scripts\python -m pytest backend/tests -v
```

Tests verify:
- Live signal parsing (`EURJPY`, `11:12`, `1 Minutes`, `CALL UP`)
- OTC signal parsing (`AUDCAD-OTC`, `10:21:00`, `1 Minutes`, `CALL UP`)
- Direction extraction (`CALL UP`, `PUT DOWN`)
- Win/Loss result parsing (`EURJPY Loss`, `USDJPY Profit`)
- Automatic matching of results with earlier pending signals
- Audit trail creation
- Late signal detection

---

## Production Deployment with Docker

To deploy with PostgreSQL, FastAPI backend, and Next.js frontend containerized:

```bash
docker-compose up -d --build
```

Services started:
- `prills_postgres`: PostgreSQL 15 database on port 5432
- `prills_backend`: FastAPI backend on port 8000 (with health check)
- `prills_frontend`: Next.js web application on port 3000

---

## Deploy Frontend to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Frohiiitwc%2Fprills.ai&root-directory=frontend)

### Quick Steps:
1. Click the **Deploy with Vercel** button above or go to [vercel.com/new](https://vercel.com/new).
2. Import your GitHub repository: `rohiiitwc/prills.ai`.
3. Set **Root Directory** to `frontend`.
4. *(Optional)* Under **Environment Variables**, configure:
   - `NEXT_PUBLIC_API_URL`: Your deployed FastAPI backend URL (e.g., `https://your-backend.railway.app/api/v1`)
   - `NEXT_PUBLIC_WS_URL`: Your deployed WebSocket URL (e.g., `wss://your-backend.railway.app/ws`)
5. Click **Deploy**. Vercel will automatically build the Next.js App Router frontend and assign a live production URL.

