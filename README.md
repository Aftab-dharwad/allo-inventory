# Allo Inventory — Take-Home Exercise

A Next.js inventory reservation platform for multi-warehouse retail. Solves the checkout race condition by holding stock units during the payment window.

## Live Demo

> [Deploy URL here after deploying to Vercel]

## Quick Start (Local)

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) (or Neon) Postgres project
- An [Upstash](https://upstash.com) Redis database

### 1. Clone and install
```bash
git clone <your-repo-url>
cd allo-inventory
npm install
```

### 2. Environment variables
```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Supabase → Settings → Database → Connection string (Transaction pooler) |
| `DIRECT_URL` | Supabase → Settings → Database → Connection string (Direct) |
| `UPSTASH_REDIS_REST_URL` | Upstash console → Redis DB → REST API |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash console → Redis DB → REST API |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally, your Vercel URL in production |
| `CRON_SECRET` | Any random string (also set in Vercel env vars) |

### 3. Run migrations and seed
```bash
npx prisma db push
npm run db:seed
```

### 4. Run the dev server
```bash
npm run dev
```

---

## How Concurrency-Safe Reservations Work

The core challenge: two simultaneous POST `/api/reservations` requests for the last unit must result in exactly one success and one 409.

### Two-layer protection

**Layer 1 — Redis distributed lock** (`SET NX EX`):
When a reservation request arrives, the server atomically sets `lock:stock:{stockId}` with `NX` (only if not exists) and a 10s TTL. If the lock is already held by another in-flight request, the server returns 429. This is the fast outer guard.

**Layer 2 — `SELECT FOR UPDATE` in a Postgres transaction**:
Inside the lock, the stock row is read with `FOR UPDATE`, which holds a row-level lock until the transaction commits. The available count is checked *after* acquiring this lock. A second concurrent request that somehow passed Redis will block here until the first commits, then read the updated reserved count and correctly return 409.

### Why both layers?
Redis alone is best-effort — it can fail or restart. Postgres `FOR UPDATE` is the authoritative serialisation point. Redis reduces DB contention under load.

---

## Reservation Expiry

### Production approach: Vercel Cron
`vercel.json` schedules `/api/cron/expire-reservations` every minute. The handler queries all `PENDING` reservations where `expiresAt <= now()` and releases each atomically (decrements `reserved`, flips status to `RELEASED`).

### Lazy cleanup on confirm
The confirm endpoint also performs lazy expiry: if a confirm arrives for an expired reservation, it releases the stock before returning 410.

### Trade-offs
- Cron runs at 1-minute minimum on Vercel; up to 59s of dead stock between sweep cycles. Acceptable for a 10-minute window.
- A per-reservation delayed job (BullMQ) would give exact expiry but adds infrastructure.

---

## Bonus: Idempotency

`POST /api/reservations` and `POST /api/reservations/:id/confirm` support `Idempotency-Key` header.

**Flow**: On first request, the result is stored in Redis at `idempotency:{key}` with 24h TTL. On retry, the cached `{statusCode, body}` is returned immediately with no DB writes. This handles network-timeout retries safely.

---

## API Reference

| Method | Path | Success | Errors |
|---|---|---|---|
| `GET` | `/api/products` | 200 | 500 |
| `GET` | `/api/warehouses` | 200 | 500 |
| `POST` | `/api/reservations` | 201 | 400, 404, 409, 429 |
| `GET` | `/api/reservations?id=` | 200 | 404 |
| `POST` | `/api/reservations/:id/confirm` | 200 | 404, 409, 410 |
| `POST` | `/api/reservations/:id/release` | 200 | 404, 409 |

---

## Trade-offs and What I'd Do Differently

- **Optimistic UI**: Revalidate product stock counts after a reservation without full page reload (SWR/React Query).
- **Queue-based expiry**: Per-reservation delayed job for exact-time expiry rather than periodic sweeping.
- **Auth**: Tie reservations to user sessions.
- **Quantity picker**: UI hardcodes qty=1; API supports arbitrary quantities.
- **Payment simulation**: Confirm button is a stub — in production this is gated behind a payment provider callback.
