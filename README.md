# ⌨ KeyForge — E-Commerce Store

A full-stack e-commerce website for mechanical keyboards, switches, keycaps and
accessories — built as a college practical-examination project.

**🔗 Live demo:** [https://abhishek-keyforge.onrender.com](https://abhishek-keyforge.onrender.com)

> **Note on the live demo:** hosted on Render's free tier. The store is fully
> functional (browse, register, cart, checkout, admin panel). Because free-tier
> hosting blocks outbound SMTP ports, **email delivery runs in log mode** on the
> live deployment — sent emails are recorded and viewable under **Admin → Emails**
> instead of being delivered. Run locally with Gmail SMTP configured for live delivery.

## Features

- Product catalog with category filtering and search
- Product detail pages
- **Keyboard configurator** — pick case, switches and keycaps; price updates live
- User registration and login (JWT authentication, hashed passwords)
- Email verification & password reset (real emails via Gmail SMTP)
- Persistent shopping cart tied to each user account
- Checkout flow with discount codes (Khalti Nepali-wallet sandbox, Stripe test-mode, plus Cash on Delivery)
- **Live email notifications** — welcome, order confirmation, status updates and
  password-reset emails sent to customers; admin alerts for new orders/registrations/reviews
- Order history with a status-tracking timeline and order cancellation
- Product reviews with a purchase-gate (only buyers can review) and admin moderation
- Wishlist and a saved-address book per user
- **Admin panel** (`/admin`) — dashboard stats, order management with status
  updates, full product CRUD, inventory/restock tracking with movement history,
  review moderation, customer list, and an email-delivery log

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, plain CSS (custom dark theme) |
| Backend | Node.js, Express |
| Database | SQLite (via Node's built-in `node:sqlite`) |
| Auth | JSON Web Tokens (JWT) + bcrypt password hashing |
| Email | Nodemailer over Gmail SMTP (live delivery to any address) |
| Payments | Khalti e-payment (Nepali wallet, sandbox) + Stripe SDK (optional, test mode) + Cash on Delivery |

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

## Environment Variables

The app runs with **zero configuration** — copy `.env.example` to `.env` and it works
offline using a simulated demo checkout and log-only emails. To enable **live email
delivery** and **real Stripe payments**, fill in the values below.

| Variable | Purpose |
|---|---|
| `SMTP_HOST` | SMTP server (e.g. `smtp.gmail.com`) — enables live email |
| `SMTP_PORT` | SMTP port (`587` for Gmail) |
| `SMTP_USER` | Sender Gmail address (e.g. `you@gmail.com`) |
| `SMTP_PASS` | Gmail **App Password** (16 characters — not your normal password) |
| `EMAIL_FROM` | Display name + address shown to recipients |
| `ADMIN_EMAIL` | Where admin alerts (new order/register/review) are sent |
| `RESEND_API_KEY` | *(Alternative to SMTP)* Resend API key for transactional email |
| `JWT_SECRET` | Secret used to sign auth tokens (set a long random string in production) |
| `PORT` | Server port (default `4000`) |
| `APP_URL` | Public URL, used in verification / password-reset email links |
| `KHALTI_SECRET_KEY` | *(Optional)* Enables Khalti e-payment (Nepali wallet). Sandbox key from test-admin.khalti.com |
| `KHALTI_BASE_URL` | *(Optional)* Khalti API base. Defaults to the sandbox `https://dev.khalti.com/api/v2` |
| `STRIPE_SECRET_KEY` | *(Optional)* Enables real Stripe test-mode PaymentIntents |

### Email modes

The mailer picks its mode automatically from the environment:

| Mode | When | Behaviour |
|---|---|---|
| **SMTP** | `SMTP_HOST` + `SMTP_USER` + `SMTP_PASS` set | Sends real email via Gmail to any address |
| **Resend** | `RESEND_API_KEY` set (takes priority) | Sends via the Resend API |
| **Log** | Neither set (default) | Emails recorded to the DB + console only — never claims "sent" unless really sent |

> **Gmail note:** you must enable 2-Step Verification and create an **App Password**
> (myaccount.google.com/apppasswords) — a normal Gmail password will be rejected.
> Every send attempt is recorded in the `email_logs` table and viewable in
> **Admin → Emails**.

## Notes

- The SQLite database file (`server/keyforge.db`) is auto-created and seeded on
  first run — no manual DB setup needed.
- All prices are stored in **paisa** (Nepali Rupees × 100) to avoid floating-point
  rounding issues, and displayed as **Rs.** on the storefront.