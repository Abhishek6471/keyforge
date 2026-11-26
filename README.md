# ⌨ KeyForge — E-Commerce Store

A full-stack e-commerce website for mechanical keyboards, switches, keycaps and
accessories — built as a college practical-examination project.

## Features

- Product catalog with category filtering and search
- Product detail pages
- **Keyboard configurator** — pick case, switches and keycaps; price updates live
- User registration and login (JWT authentication, hashed passwords)
- Persistent shopping cart tied to each user account
- Checkout flow (Stripe test-mode ready, with a demo/simulated payment fallback)
- Order history per user
- **Admin panel** (`/admin`) — dashboard stats, order management with status
  updates, full product CRUD (create/edit/delete), and a customer list

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, plain CSS (custom dark theme) |
| Backend | Node.js, Express |
| Database | SQLite (via Node's built-in `node:sqlite`) |
| Auth | JSON Web Tokens (JWT) + bcrypt password hashing |
| Payments | Stripe SDK (optional, test mode) |

## Project Structure

```
keyforge-project/
├── client/          # React frontend (Vite)
│   └── src/
│       ├── pages/       # Home, ProductDetail, Cart, Login, Register, Orders
│       ├── components/  # Navbar
│       └── context/     # AuthContext, CartContext (global state)
├── server/          # Express API + SQLite database
│   ├── db.js            # Schema + seed data
│   └── index.js         # API routes
├── screenshots/     # Website screenshots (for the report)
├── package.json     # Root scripts
└── render.yaml      # Deployment config (Render.com)
```

## Running Locally

**Prerequisites:** Node.js 18+ (tested on Node 26).

```bash
# 1. Install dependencies (both client and server)
cd client  && npm install && cd ..
cd server  && npm install && cd ..

# 2. Build the frontend
cd client && npm run build && cd ..

# 3. Start the server (serves API + built frontend on one port)
cd server && npm start
```

Open **http://localhost:4000**

### Development mode (hot reload)

```bash
# Terminal 1 — API on :4000
cd server && npm run dev

# Terminal 2 — frontend on :5173 (proxies /api to :4000)
cd client && npm run dev
```

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Customer | `demo@keyforge.test` | `demo1234` |
| **Admin** | `admin@keyforge.test` | `admin1234` |

Log in as the admin, then open **`/admin`** (or click **Admin** in the navbar) to
access the dashboard, orders, products and users management.

## Environment Variables (optional)

Copy `.env.example` to `server/.env` and fill in if you want live Stripe payments:

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Enables real Stripe test-mode PaymentIntents |
| `JWT_SECRET` | Secret used to sign auth tokens (set in production) |
| `PORT` | Server port (default 4000) |

Without `STRIPE_SECRET_KEY` the app uses a **simulated demo checkout** so the
full flow can be demonstrated offline.

## Notes

- The SQLite database file (`server/keyforge.db`) is auto-created and seeded on
  first run — no manual DB setup needed.
- All prices are stored in **paisa** (Nepali Rupees × 100) to avoid floating-point
  rounding issues, and displayed as **Rs.** on the storefront.