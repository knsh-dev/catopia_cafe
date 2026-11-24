# Catopia Café 🐾☕

A warm, cozy cat café web application built with Django REST Framework and React (Vite).

---

## Tech Stack & Architecture

- **Backend**: Python 3.14+, Django 6.1+, Django REST Framework, SQLite (local development) / PostgreSQL-ready (production)
- **Frontend**: React 19 (Vite) in **plain JavaScript only** (`.jsx`, zero TypeScript), Tailwind CSS, Radix UI & custom cozy theme tokens
- **Integrations**:
  - **Xendit**: Hosted Checkout (Invoice API v2) in Test/Live Mode for Philippine Peso online payments (GCash, Maya, cards, e-wallets)
  - **Mapbox GL JS & Directions API**: Interactive café map with custom paw pin, directions with driving route & bounds fitting, graceful fallback
  - **Resend**: Automated email receipts delivered to customers upon successful payment
- **Currency**: Philippine Peso (PHP) only (`₱150.00` in UI, `PHP 150.00` on printed receipts and emails), zero float math on monetary values (`DecimalField` and `Decimal.quantize` throughout)
- **Authentication**: Django session authentication with CSRF cookie verification, role-based access control (Customer, Staff, Admin)

---

## Project Structure

```
catopia_cafe/
├── backend/
│   ├── config/              # Django project settings & root URLs
│   ├── accounts/            # User auth, profiles, roles & admin business analytics
│   ├── menu/                # Menu categories, items, sizing, reviews & ratings
│   ├── orders/              # Orders, cart checkout, stock control, loyalty rewards
│   ├── catroom/             # 1-hour slots engine, booking, blocks, hold release
│   ├── cats/                # Resident cat profiles & favoriting
│   ├── payments/            # Xendit checkout, webhooks, deduplication & receipts
│   ├── loyalty/             # Paw points, stamp cards & reward vouchers
│   ├── requirements.txt     # Python dependencies
│   ├── manage.py
│   ├── .env.example
│   └── .env                 # (Ignored by git)
├── frontend/
│   ├── src/
│   │   ├── components/      # UI components, admin tabs, landing sections
│   │   ├── context/         # AuthContext & CartContext
│   │   ├── hooks/           # useFetch & utility hooks
│   │   ├── lib/             # api.js client & format.js currency formatter
│   │   └── pages/           # Customer & Admin pages
│   ├── package.json
│   ├── vite.config.js
│   ├── .env.example
│   └── .env                 # (Ignored by git)
├── .gitignore
└── README.md
```

---

## Environment Setup

### 1. Backend Environment Variables (`backend/.env`)

Copy `backend/.env.example` to `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

Key variables configured:

```ini
# Django
SECRET_KEY=change-me-to-a-random-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0,[::1]
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Database (Leave commented for SQLite in development)
# DATABASE_URL=postgres://user:password@localhost:5432/catopia_cafe

# Xendit Test Mode Credentials (Backend ONLY — never expose to frontend)
XENDIT_SECRET_KEY=xnd_development_...
XENDIT_WEBHOOK_TOKEN=your_webhook_verification_token

# Mapbox (public token used for backend metadata)
MAPBOX_PUBLIC_TOKEN=pk.your_token_here

# Cafe Settings (Defaults in config/settings.py, override as needed)
CAFE_NAME=Catopia Café
CAFE_ADDRESS=89-G Barlin St, Sta. Cruz, Naga City, 4400 Camarines Sur
CAFE_PHONE=09123456789
CAFE_EMAIL=catopia.cafe@gmail.com
CAFE_LATITUDE=13.627225580837424
CAFE_LONGITUDE=123.18631853657558
CAFE_OPENING_HOUR=10
CAFE_CLOSING_HOUR=21
CATROOM_HOURLY_RATE=300
CATROOM_MAX_VISITORS=10
CATROOM_MIN_DEPOSIT=150
CATROOM_HOLD_MINUTES=15
CATROOM_CANCEL_CUTOFF_HOURS=24

FRONTEND_BASE_URL=http://localhost:5173
LOYALTY_POINTS_PER_PESO=10

# Resend Email API
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Catopia Café <receipts@yourdomain.com>
```

### 2. Frontend Environment Variables (`frontend/.env`)

Copy `frontend/.env.example` to `frontend/.env`:

```bash
cp frontend/.env.example frontend/.env
```

```ini
# Leave empty when using Vite dev proxy to localhost:8000
VITE_API_URL=

# Public Mapbox token (MUST begin with pk.)
VITE_MAPBOX_TOKEN=pk.your_public_token_here
VITE_MAPBOX_STYLE=mapbox://styles/mapbox/streets-v12
```

---

## Running the Application

### 1. Backend Setup & Run

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run database migrations
python manage.py migrate

# Seed initial categories, menu items, resident cats, and sample accounts
python manage.py seed_demo

# Start the Django development server
python manage.py runserver 8000
```

### 2. Frontend Setup & Run

```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

- Frontend URL: `http://localhost:5173`
- Backend API URL: `http://localhost:8000`

---

## Xendit Payment Integration & Testing

Catopia Café implements Xendit's **Hosted Checkout (Invoice API v2)** with full deduplication and synchronization:

1. **Checkout Upsert / Reuse**:
   - Initiating payment for an order or reservation checks for existing active transactions.
   - If an active `Pending` Xendit invoice exists, its `invoice_url` is reused rather than spawning duplicate rows.
   - If a new invoice is required, the transaction record is updated in place.
2. **Payment Confirmation Deduplication**:
   - Webhook callback (`POST /api/payments/xendit/webhook/`), redirect verification (`POST /api/orders/:id/verify-payment/`), and polling status (`GET /api/payments/:id/status/`) update transaction status to `paid` and delete any orphaned `pending` rows.
3. **Admin Live Sync**:
   - The **Refresh** button on `/admin?tab=payments` triggers `POST /api/payments/sync/`, which queries Xendit for any unsettled transactions, confirms them, and deduplicates the database.

### Testing Webhooks Locally

```bash
# Using ngrok
ngrok http 8000

# Set callback URL in Xendit Dashboard -> Settings -> Callbacks:
# https://<your-subdomain>.ngrok-free.app/api/payments/xendit/webhook/
```

In the Xendit Dashboard:
- Enter your Webhook Verification Token in `backend/.env` under `XENDIT_WEBHOOK_TOKEN`.
- Use the **Test and Save** button to send a simulation ping.

---

## Mapbox Integration Notes

1. **Token Security**:
   - Frontend uses **only** a public token beginning with `pk.`.
   - Never use a secret token (`sk.`) on the client.
2. **Cooperative Gestures**:
   - Scroll-zoom is disabled by default to prevent mouse-scroll trapping while scrolling through the home page.
   - Users can focus the map or click to enable scroll-zoom.
3. **Graceful Fallback**:
   - If Mapbox fails to load, is offline, or an invalid token is provided, a `FallbackCard` displays the café address, business hours, and a direct Google Maps directions link.
   - Geolocation rejection during directions displays a clear error note without breaking the UI.

---

## Running the Automated Test Suite

Catopia Café includes 131 automated unit and integration tests covering all apps:

```bash
cd backend
python manage.py test catroom accounts menu cats orders payments loyalty --verbosity=2
```

### Verified Test Areas:
- **Accounts**: CSRF token retrieval, user registration, authentication, role permissions (`IsStaffOrAdmin`, `IsAdmin`).
- **Menu**: Category management, toggle visibility, reordering, item pricing, size/temperature options, review aggregation.
- **Cats**: Resident cat profiles, adoption stories, personality tags, authenticated favoriting.
- **Cat Room**: Opening hours slot generation, real-time availability calculation, capacity bounding, double-booking prevention under concurrency, 15-minute hold expiration (`release_expired_holds`).
- **Orders**: Creation, atomic stock reservation, discount calculations (treats, vouchers, perks), cancellation, status transitions.
- **Payments**: Webhook token rejection (`403 Forbidden`), webhook idempotency, Xendit invoice reuse, payment confirmation deduplication, admin sync endpoint, pagination and sorting.
- **Loyalty**: Tier earn multiplier (Kitten 1.0x, Tabby 1.25x, Tubby 1.5x), stamp cards, voucher unlocking and redemption.

---

## Known Limitations

1. **Xendit Test Mode Simulation**:
   - In local development, webhooks require an active tunneling service (e.g., ngrok or Cloudflare Tunnel) to reach `localhost:8000`.
2. **SQLite vs PostgreSQL**:
   - Local development uses SQLite by default. Under extremely high concurrent write volume, SQLite may encounter file locks; production deployments must configure PostgreSQL.
3. **Background Hold Expiration**:
   - 15-minute reservation holds are released automatically during slot queries and can be run on a scheduled cron/worker via `python manage.py release_expired_holds`.

---

## 🚀 Before Going Live Checklist

Prior to launching in a production environment, complete the following items:

### 1. Mapbox
- [ ] Create a URL-restricted public token (`pk.`) in your [Mapbox Account](https://account.mapbox.com/access-tokens/).
- [ ] Add your production domain (e.g., `https://catopiacafe.ph/*`, `https://*.catopiacafe.ph/*`) to the token's allowed URLs.
- [ ] Add a payment method to ensure uninterrupted tile rendering.
- [ ] Replace the trial token in `frontend/.env` with your URL-restricted token.
- [ ] Set up a monthly usage alert in the Mapbox billing console.

### 2. Xendit Payment Gateway
- [ ] Complete business verification & KYC activation on the [Xendit Dashboard](https://dashboard.xendit.co/).
- [ ] Switch dashboard toggle to **Live Mode**.
- [ ] Generate a live secret key (`xnd_production_...`) and update `XENDIT_SECRET_KEY` in production environment.
- [ ] Copy the Live Webhook Verification Token and set `XENDIT_WEBHOOK_TOKEN`.
- [ ] Set the live callback URL to `https://yourdomain.com/api/payments/xendit/webhook/`.
- [ ] Execute one real, low-value test transaction (e.g., ₱10.00 pastry or coffee) to verify end-to-end settlement, order transition, and receipt generation.

### 3. Django Backend & Infrastructure
- [ ] Set `DEBUG=False` in production environment variables.
- [ ] Generate a cryptographically secure `SECRET_KEY` (minimum 50 random characters).
- [ ] Update `ALLOWED_HOSTS` to include your production domain and server IPs.
- [ ] Configure `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` with your production frontend URL (`https://...`).
- [ ] Enforce HTTPS: `SECURE_SSL_REDIRECT = True`, `SESSION_COOKIE_SECURE = True`, and `CSRF_COOKIE_SECURE = True`.
- [ ] Provision a managed PostgreSQL instance and set `DATABASE_URL`.
- [ ] Configure static and media file serving (e.g., AWS S3, Cloudflare R2, or WhiteNoise with Nginx reverse proxy).
- [ ] Schedule `python manage.py release_expired_holds` as a cron job or Celery task (recommended every 5 minutes).

### 4. Café Business Settings
- [ ] Confirm real café physical address in `CAFE_ADDRESS`.
- [ ] Confirm exact café GPS coordinates in `CAFE_LATITUDE` and `CAFE_LONGITUDE`.
- [ ] Verify store operating hours (`CAFE_OPENING_HOUR`, `CAFE_CLOSING_HOUR`).
- [ ] Verify Cat Room hourly fee (`CATROOM_HOURLY_RATE`) and visitor capacity (`CATROOM_MAX_VISITORS`).
