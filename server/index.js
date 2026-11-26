// index.js — KeyForge Express API server
import './env.js'; // must be first — loads project-root .env before anything reads process.env
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID, randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from './db.js';
import { sendEmail, mailerInfo, ADMIN_EMAIL } from './mailer.js';
import * as T from './emailTemplates.js';
import { rateLimit, isEmail, sanitizeDeep, clientIp } from './security.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const JWT_SECRET = process.env.JWT_SECRET || 'keyforge-dev-secret-change-me';
const PORT = process.env.PORT || 4000;
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// Stripe (optional) — only used if STRIPE_SECRET_KEY is set
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  const Stripe = (await import('stripe')).default;
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
}

// Khalti e-payment (optional) — Nepali wallet, used if KHALTI_SECRET_KEY is set.
// Sandbox: https://dev.khalti.com/api/v2  |  Production: https://khalti.com/api/v2
const KHALTI_SECRET_KEY = process.env.KHALTI_SECRET_KEY || null;
const KHALTI_BASE = process.env.KHALTI_BASE_URL || 'https://dev.khalti.com/api/v2';

const fmt = c => `Rs. ${(c / 100).toLocaleString('en-IN')}`;

// ================= MIDDLEWARE =================
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || !req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });
  next();
}

// sanitize all incoming bodies (XSS mitigation)
app.use((req, _res, next) => { if (req.body) req.body = sanitizeDeep(req.body); next(); });

// rate-limit middleware factory
function limit(keyFn, max, windowMs) {
  return (req, res, next) => {
    const r = rateLimit(keyFn(req), max, windowMs);
    if (!r.ok) return res.status(429).json({ error: `Too many attempts. Try again in ${r.retryAfter}s.` });
    next();
  };
}

// ================= HELPERS =================
function getUserById(id) { return db.prepare('SELECT * FROM users WHERE id=?').get(id); }
function logStatus(orderId, status, note = null) {
  db.prepare('INSERT INTO order_status_history (order_id,status,note) VALUES (?,?,?)').run(orderId, status, note);
}
function adjustStock(productId, change, reason, reference = null) {
  db.prepare('UPDATE products SET stock = stock + ? WHERE id=?').run(change, productId);
  db.prepare('INSERT INTO inventory_movements (product_id,change,reason,reference) VALUES (?,?,?,?)')
    .run(productId, change, reason, reference);
}
function unitPrice(base, optionsJson, configJson) {
  let price = base;
  if (optionsJson && configJson) {
    const options = JSON.parse(optionsJson);
    const chosen = JSON.parse(configJson);
    for (const [group, selectedId] of Object.entries(chosen)) {
      const opt = (options[group] || []).find(o => o.id === selectedId);
      if (opt) price += opt.add_cents;
    }
  }
  return price;
}

// ================= AUTH =================
app.post('/api/auth/register',
  limit(req => 'reg:' + clientIp(req), 5, 15 * 60 * 1000),
  async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
    if (!isEmail(email)) return res.status(400).json({ error: 'Invalid email address' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be 6+ characters' });

    const existing = db.prepare('SELECT id FROM users WHERE email=?').get(email.toLowerCase());
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const id = randomUUID();
    const hash = bcrypt.hashSync(password, 10);
    const verifyToken = randomBytes(24).toString('hex');
    db.prepare(`INSERT INTO users (id,name,email,password_hash,is_admin,email_verified,verify_token) VALUES (?,?,?, ?,0,0,?)`)
      .run(id, name, email.toLowerCase(), hash, verifyToken);

    const verifyUrl = `${APP_URL}/verify?token=${verifyToken}`;
    const tpl = T.welcomeEmail(name, verifyUrl);
    const mail = await sendEmail({ to: email.toLowerCase(), ...tpl, template: 'welcome' });

    await sendEmail({
      to: ADMIN_EMAIL, subject: 'New customer registered',
      html: `<p>New customer registered:</p><p><b>${name}</b> — ${email.toLowerCase()}</p>`,
      text: `New registration: ${name} <${email.toLowerCase()}>`, template: 'admin-register'
    });

    const token = jwt.sign({ id, email: email.toLowerCase(), is_admin: 0 }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: { id, name, email: email.toLowerCase(), is_admin: 0, email_verified: 0 },
      email: { sent: mail.ok, mode: mail.mode }
    });
  });

app.post('/api/auth/login',
  limit(req => 'login:' + clientIp(req), 10, 10 * 60 * 1000),
  (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email=?').get((email || '').toLowerCase());
    if (!user || !bcrypt.compareSync(password || '', user.password_hash))
      return res.status(401).json({ error: 'Invalid email or password' });
    if (!user.is_active) return res.status(403).json({ error: 'Account deactivated. Contact support.' });

    const is_admin = user.is_admin ? 1 : 0;
    const token = jwt.sign({ id: user.id, email: user.email, is_admin }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, is_admin, email_verified: user.email_verified ? 1 : 0 }
    });
  });

app.get('/api/auth/verify', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Missing token' });
  const user = db.prepare('SELECT * FROM users WHERE verify_token=?').get(token);
  if (!user) return res.status(400).json({ error: 'Invalid or already-used verification link' });
  db.prepare('UPDATE users SET email_verified=1, verify_token=NULL WHERE id=?').run(user.id);
  res.json({ ok: true, email: user.email });
});

app.post('/api/auth/resend-verification', auth, async (req, res) => {
  const user = getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.email_verified) return res.json({ ok: true, already: true });
  const verifyToken = randomBytes(24).toString('hex');
  db.prepare('UPDATE users SET verify_token=? WHERE id=?').run(verifyToken, user.id);
  const tpl = T.verifyEmail(user.name, `${APP_URL}/verify?token=${verifyToken}`);
  const mail = await sendEmail({ to: user.email, ...tpl, template: 'verify' });
  res.json({ ok: mail.ok, mode: mail.mode });
});

app.post('/api/auth/forgot-password',
  limit(req => 'forgot:' + clientIp(req), 5, 15 * 60 * 1000),
  async (req, res) => {
    const { email } = req.body;
    if (!isEmail(email)) return res.status(400).json({ error: 'Invalid email' });
    const user = db.prepare('SELECT * FROM users WHERE email=?').get(email.toLowerCase());
    if (user) {
      const resetToken = randomBytes(24).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      db.prepare('UPDATE users SET reset_token=?, reset_token_expires=? WHERE id=?').run(resetToken, expires, user.id);
      const tpl = T.passwordResetEmail(user.name, `${APP_URL}/reset?token=${resetToken}`);
      await sendEmail({ to: user.email, ...tpl, template: 'password-reset' });
    }
    res.json({ ok: true, message: 'If that email exists, a reset link has been sent.' });
  });

app.post('/api/auth/reset-password',
  limit(req => 'reset:' + clientIp(req), 10, 15 * 60 * 1000),
  async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Missing token or password' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be 6+ characters' });
    const user = db.prepare('SELECT * FROM users WHERE reset_token=?').get(token);
    if (!user) return res.status(400).json({ error: 'Invalid reset link' });
    if (user.reset_token_expires && new Date(user.reset_token_expires) < new Date())
      return res.status(400).json({ error: 'Reset link has expired' });

    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password_hash=?, reset_token=NULL, reset_token_expires=NULL WHERE id=?').run(hash, user.id);
    const tpl = T.passwordChangedEmail(user.name);
    await sendEmail({ to: user.email, ...tpl, template: 'password-changed' });
    res.json({ ok: true });
  });

app.post('/api/auth/change-password', auth, async (req, res) => {
  const { current, next } = req.body;
  const user = getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!bcrypt.compareSync(current || '', user.password_hash)) return res.status(401).json({ error: 'Current password incorrect' });
  if (!next || next.length < 6) return res.status(400).json({ error: 'New password must be 6+ characters' });
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(next, 10), user.id);
  const tpl = T.passwordChangedEmail(user.name);
  await sendEmail({ to: user.email, ...tpl, template: 'password-changed' });
  res.json({ ok: true });
});

// ================= PRODUCTS =================
app.get('/api/products', (req, res) => {
  const { category, q, sort, min, max, featured, available } = req.query;
  let rows = db.prepare('SELECT * FROM products WHERE 1=1').all();

  if (category && category !== 'all') rows = rows.filter(p => p.category === category);
  if (featured === '1') rows = rows.filter(p => p.featured);
  if (available === '1') rows = rows.filter(p => p.available);
  if (q) {
    const n = String(q).toLowerCase();
    rows = rows.filter(p => p.name.toLowerCase().includes(n) || p.description.toLowerCase().includes(n));
  }
  if (min) rows = rows.filter(p => p.price_cents >= Number(min) * 100);
  if (max) rows = rows.filter(p => p.price_cents <= Number(max) * 100);

  switch (sort) {
    case 'price-asc': rows.sort((a, b) => a.price_cents - b.price_cents); break;
    case 'price-desc': rows.sort((a, b) => b.price_cents - a.price_cents); break;
    case 'name': rows.sort((a, b) => a.name.localeCompare(b.name)); break;
    case 'newest': rows.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')); break;
    default: rows.sort((a, b) => a.id - b.id);
  }

  const ratingStmt = db.prepare("SELECT ROUND(AVG(rating),1) AS avg, COUNT(*) AS count FROM reviews WHERE product_id=? AND approved=1");
  res.json(rows.map(r => {
    const rt = ratingStmt.get(r.id);
    return { ...r, config: r.config ? JSON.parse(r.config) : null, rating: rt.avg || 0, review_count: rt.count };
  }));
});

app.get('/api/products/:slug', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE slug=?').get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const images = db.prepare('SELECT url FROM product_images WHERE product_id=?').all(row.id).map(i => i.url);
  const rt = db.prepare("SELECT ROUND(AVG(rating),1) AS avg, COUNT(*) AS count FROM reviews WHERE product_id=? AND approved=1").get(row.id);
  res.json({
    ...row, config: row.config ? JSON.parse(row.config) : null,
    images, rating: rt.avg || 0, review_count: rt.count
  });
});

app.get('/api/products/:slug/reviews', (req, res) => {
  const p = db.prepare('SELECT id FROM products WHERE slug=?').get(req.params.slug);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const rows = db.prepare(`
    SELECT r.id, r.rating, r.comment, r.created_at, u.name AS user_name
    FROM reviews r JOIN users u ON u.id=r.user_id
    WHERE r.product_id=? AND r.approved=1 ORDER BY r.created_at DESC
  `).all(p.id);
  res.json(rows);
});

app.post('/api/products/:slug/reviews', auth,
  limit(req => 'review:' + req.user.id, 10, 60 * 60 * 1000),
  async (req, res) => {
    const p = db.prepare('SELECT * FROM products WHERE slug=?').get(req.params.slug);
    if (!p) return res.status(404).json({ error: 'Product not found' });
    const { rating, comment } = req.body;
    const r = Number(rating);
    if (!r || r < 1 || r > 5) return res.status(400).json({ error: 'Rating must be 1-5' });

    const purchased = db.prepare(`
      SELECT COUNT(*) AS c FROM order_items oi
      JOIN orders o ON o.id=oi.order_id
      WHERE o.user_id=? AND oi.product_id=? AND o.status != 'cancelled'
    `).get(req.user.id, p.id).c;
    if (!purchased) return res.status(403).json({ error: 'You can only review products you have purchased' });

    const dup = db.prepare('SELECT id FROM reviews WHERE product_id=? AND user_id=?').get(p.id, req.user.id);
    if (dup) return res.status(409).json({ error: 'You have already reviewed this product' });

    db.prepare('INSERT INTO reviews (product_id,user_id,rating,comment,approved) VALUES (?,?,?,?,0)')
      .run(p.id, req.user.id, r, comment || '');

    const user = getUserById(req.user.id);
    const tpl = T.reviewConfirmationEmail(user.name, p.name);
    await sendEmail({ to: user.email, ...tpl, template: 'review-confirm' });

    await sendEmail({
      to: ADMIN_EMAIL, subject: `New review on ${p.name}`,
      html: `<p>${user.name} reviewed <b>${p.name}</b>: ${r}/5</p><p>${comment || ''}</p>`,
      text: `${user.name} reviewed ${p.name}: ${r}/5 — ${comment || ''}`,
      template: 'admin-review'
    });

    res.json({ ok: true, message: 'Review submitted and pending approval' });
  });

// ================= CART =================
app.get('/api/cart', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT ci.id AS cart_id, ci.qty AS qty, ci.config_json AS config_json,
           p.id AS product_id, p.slug AS slug, p.name AS name,
           p.price_cents AS price_cents, p.image AS image, p.category AS category,
           p.config AS options_json, p.stock AS stock
    FROM cart_items ci JOIN products p ON p.id = ci.product_id
    WHERE ci.user_id=? ORDER BY ci.id
  `).all(req.user.id);

  res.json(rows.map(r => ({
    cartId: r.cart_id, qty: r.qty,
    config: r.config_json ? JSON.parse(r.config_json) : null,
    unit_price: unitPrice(r.price_cents, r.options_json, r.config_json),
    stock: r.stock,
    product: { id: r.product_id, slug: r.slug, name: r.name, price_cents: r.price_cents, image: r.image, category: r.category }
  })));
});

app.post('/api/cart', auth, (req, res) => {
  const { productId, config, qty } = req.body;
  const product = db.prepare('SELECT * FROM products WHERE id=?').get(productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (!product.available) return res.status(400).json({ error: 'Product unavailable' });
  const want = qty || 1;

  const cfgStr = config ? JSON.stringify(config) : null;
  const existing = db.prepare('SELECT * FROM cart_items WHERE user_id=? AND product_id=? AND (config_json IS ? OR config_json=?)')
    .get(req.user.id, productId, cfgStr, cfgStr);
  const newQty = (existing ? existing.qty : 0) + want;
  if (newQty > product.stock) return res.status(400).json({ error: `Only ${product.stock} in stock` });

  if (existing) db.prepare('UPDATE cart_items SET qty=? WHERE id=?').run(newQty, existing.id);
  else db.prepare('INSERT INTO cart_items (user_id,product_id,config_json,qty) VALUES (?,?,?,?)')
    .run(req.user.id, productId, cfgStr, want);
  res.json({ ok: true });
});

app.put('/api/cart/:id', auth, (req, res) => {
  const { qty } = req.body;
  const item = db.prepare('SELECT ci.*, p.stock FROM cart_items ci JOIN products p ON p.id=ci.product_id WHERE ci.id=? AND ci.user_id=?')
    .get(req.params.id, req.user.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (qty < 1) return res.status(400).json({ error: 'Invalid quantity' });
  if (qty > item.stock) return res.status(400).json({ error: `Only ${item.stock} in stock` });
  db.prepare('UPDATE cart_items SET qty=? WHERE id=?').run(qty, item.id);
  res.json({ ok: true });
});

app.delete('/api/cart/:id', auth, (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ================= WISHLIST =================
app.get('/api/wishlist', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, w.id AS wishlist_id FROM wishlists w JOIN products p ON p.id=w.product_id
    WHERE w.user_id=? ORDER BY w.created_at DESC
  `).all(req.user.id);
  res.json(rows.map(r => ({ ...r, config: r.config ? JSON.parse(r.config) : null })));
});

app.post('/api/wishlist', auth, (req, res) => {
  const { productId } = req.body;
  const dup = db.prepare('SELECT id FROM wishlists WHERE user_id=? AND product_id=?').get(req.user.id, productId);
  if (dup) return res.json({ ok: true, already: true });
  db.prepare('INSERT INTO wishlists (user_id,product_id) VALUES (?,?)').run(req.user.id, productId);
  res.json({ ok: true });
});

app.delete('/api/wishlist/:productId', auth, (req, res) => {
  db.prepare('DELETE FROM wishlists WHERE user_id=? AND product_id=?').run(req.user.id, req.params.productId);
  res.json({ ok: true });
});

// ================= ADDRESSES =================
app.get('/api/addresses', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM addresses WHERE user_id=? ORDER BY is_default DESC, id DESC').all(req.user.id));
});

app.post('/api/addresses', auth, (req, res) => {
  const { label, full_name, phone, street, city, state, postal_code, country, is_default } = req.body;
  if (!full_name || !street || !city) return res.status(400).json({ error: 'Name, street and city required' });
  if (is_default) db.prepare('UPDATE addresses SET is_default=0 WHERE user_id=?').run(req.user.id);
  db.prepare(`INSERT INTO addresses (user_id,label,full_name,phone,street,city,state,postal_code,country,is_default)
              VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(req.user.id, label || null, full_name, phone || null, street, city, state || null, postal_code || null, country || 'Nepal', is_default ? 1 : 0);
  res.json({ ok: true });
});

app.delete('/api/addresses/:id', auth, (req, res) => {
  db.prepare('DELETE FROM addresses WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ================= CHECKOUT =================
app.post('/api/checkout', auth,
  limit(req => 'checkout:' + req.user.id, 10, 60 * 60 * 1000),
  async (req, res) => {
    const { addressId, shipping, paymentMethod, discountCode } = req.body;

    const rows = db.prepare(`
      SELECT ci.qty, ci.config_json, p.id AS pid, p.name, p.price_cents, p.stock, p.config AS options_json
      FROM cart_items ci JOIN products p ON p.id = ci.product_id
      WHERE ci.user_id=?`).all(req.user.id);
    if (!rows.length) return res.status(400).json({ error: 'Cart is empty' });

    for (const r of rows) {
      if (r.qty > r.stock) return res.status(400).json({ error: `Only ${r.stock} of ${r.name} left in stock` });
    }

    const subtotal = rows.reduce((s, r) => s + unitPrice(r.price_cents, r.options_json, r.config_json) * r.qty, 0);
    const shipping_cents = subtotal >= 500000 ? 0 : 20000;

    let discount = 0;
    const code = (discountCode || '').toUpperCase();
    if (code === 'KEYFORGE10') discount = Math.round(subtotal * 0.10);
    else if (code) return res.status(400).json({ error: 'Invalid discount code' });

    const total = Math.max(0, subtotal + shipping_cents - discount);
    const method = paymentMethod || 'cod';

    let ship = shipping || {};
    if (addressId) {
      const a = db.prepare('SELECT * FROM addresses WHERE id=? AND user_id=?').get(addressId, req.user.id);
      if (a) ship = { name: a.full_name, phone: a.phone, address: `${a.street}, ${a.city}`, city: a.city, postal: a.postal_code };
    }

    const orderId = 'KF-' + randomUUID().slice(0, 8).toUpperCase();

    if (method === 'stripe') {
      if (!stripe) return res.status(400).json({ error: 'Online payment not configured. Use Cash on Delivery.' });
      try {
        const intent = await stripe.paymentIntents.create({
          amount: total, currency: 'usd', automatic_payment_methods: { enabled: true },
          metadata: { orderId, userId: req.user.id }
        });
        db.prepare(`INSERT INTO orders (id,user_id,subtotal_cents,shipping_cents,discount_cents,total_cents,status,payment_method,payment_status,shipping_name,shipping_phone,shipping_address,shipping_city,shipping_postal) VALUES (?,?,?,?,?,?,'pending','stripe','pending',?,?,?,?,?)`)
          .run(orderId, req.user.id, subtotal, shipping_cents, discount, total, ship.name, ship.phone, ship.address, ship.city, ship.postal);
        logStatus(orderId, 'pending', 'Awaiting payment');
        return res.json({ clientSecret: intent.client_secret, orderId, total });
      } catch (e) {
        return res.status(500).json({ error: 'Payment error: ' + e.message });
      }
    }

    // ---- Khalti e-payment ----
    if (method === 'khalti') {
      if (!KHALTI_SECRET_KEY) return res.status(400).json({ error: 'Khalti not configured. Use Cash on Delivery.' });

      // 1. Create a pending order (stock decremented, cart cleared) — same as COD,
      //    but status stays 'pending' until Khalti confirms payment.
      const insertOrder = db.prepare(`INSERT INTO orders (id,user_id,subtotal_cents,shipping_cents,discount_cents,total_cents,status,payment_method,payment_status,shipping_name,shipping_phone,shipping_address,shipping_city,shipping_postal) VALUES (?,?,?,?,?,?,'pending','khalti','pending',?,?,?,?,?)`);
      const insertItem = db.prepare('INSERT INTO order_items (order_id,product_id,product_name,config_json,qty,price_cents) VALUES (?,?,?,?,?,?)');
      const clearCart = db.prepare('DELETE FROM cart_items WHERE user_id=?');
      db.exec('BEGIN');
      try {
        insertOrder.run(orderId, req.user.id, subtotal, shipping_cents, discount, total, ship.name, ship.phone, ship.address, ship.city, ship.postal);
        for (const r of rows) {
          insertItem.run(orderId, r.pid, r.name, r.config_json, r.qty, unitPrice(r.price_cents, r.options_json, r.config_json));
          adjustStock(r.pid, -r.qty, 'order', orderId);
        }
        logStatus(orderId, 'pending', 'Order placed');
        logStatus(orderId, 'pending', 'Awaiting Khalti payment');
        clearCart.run(req.user.id);
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        return res.status(500).json({ error: 'Checkout failed: ' + e.message });
      }

      // 2. Ask Khalti to initiate the payment
      const user = getUserById(req.user.id);
      try {
        const initRes = await fetch(`${KHALTI_BASE}epayment/initiate/`, {
          method: 'POST',
          headers: {
            Authorization: `Key ${KHALTI_SECRET_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            return_url: `${APP_URL}/api/payments/khalti/return`,
            website_url: APP_URL,
            amount: total, // paisa
            purchase_order_id: orderId,
            purchase_order_name: `KeyForge order ${orderId}`,
            customer_info: {
              name: ship.name || user.name,
              email: user.email,
              phone: (ship.phone || '').replace(/\D/g, '') || '9800000001'
            }
          }),
          signal: AbortSignal.timeout(15000)
        });
        const kd = await initRes.json();
        if (!initRes.ok || !kd.payment_url) {
          logStatus(orderId, 'pending', 'Khalti initiate failed: ' + (kd.detail || kd.error_key || 'unknown'));
          return res.status(500).json({ error: 'Khalti init failed: ' + (kd.detail || 'unknown error') });
        }

        // 3. Record the payment with the Khalti pidx as reference
        db.prepare('INSERT INTO payments (order_id,method,status,amount_cents,reference) VALUES (?,?,?,?,?)')
          .run(orderId, 'khalti', 'pending', total, kd.pidx);

        return res.json({ payment_url: kd.payment_url, orderId, total });
      } catch (e) {
        logStatus(orderId, 'pending', 'Khalti error: ' + e.message);
        return res.status(500).json({ error: 'Khalti error: ' + e.message });
      }
    }

    const insertOrder = db.prepare(`INSERT INTO orders (id,user_id,subtotal_cents,shipping_cents,discount_cents,total_cents,status,payment_method,payment_status,shipping_name,shipping_phone,shipping_address,shipping_city,shipping_postal) VALUES (?,?,?,?,?,?,'confirmed','cod','pending',?,?,?,?,?)`);
    const insertItem = db.prepare('INSERT INTO order_items (order_id,product_id,product_name,config_json,qty,price_cents) VALUES (?,?,?,?,?,?)');
    const clearCart = db.prepare('DELETE FROM cart_items WHERE user_id=?');

    db.exec('BEGIN');
    try {
      insertOrder.run(orderId, req.user.id, subtotal, shipping_cents, discount, total, ship.name, ship.phone, ship.address, ship.city, ship.postal);
      for (const r of rows) {
        insertItem.run(orderId, r.pid, r.name, r.config_json, r.qty, unitPrice(r.price_cents, r.options_json, r.config_json));
        adjustStock(r.pid, -r.qty, 'order', orderId);
      }
      logStatus(orderId, 'pending', 'Order placed');
      logStatus(orderId, 'confirmed', 'Cash on delivery');
      clearCart.run(req.user.id);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      return res.status(500).json({ error: 'Checkout failed: ' + e.message });
    }

    db.prepare('INSERT INTO payments (order_id,method,status,amount_cents) VALUES (?,?,?,?)').run(orderId, 'cod', 'pending', total);

    const user = getUserById(req.user.id);
    const orderForMail = {
      id: orderId, items: rows.map(r => ({ product_name: r.name, qty: r.qty, price_cents: unitPrice(r.price_cents, r.options_json, r.config_json), config: r.config_json ? JSON.parse(r.config_json) : null })),
      subtotal_cents: subtotal, shipping_cents, discount_cents: discount, total_cents: total,
      payment_method: 'cod', payment_status: 'pending',
      shipping_address: ship.address, shipping_city: ship.city
    };
    const tpl = T.orderConfirmationEmail(user.name, orderForMail);
    const mail = await sendEmail({ to: user.email, ...tpl, template: 'order-confirmation' });

    await sendEmail({
      to: ADMIN_EMAIL, subject: `New order ${orderId} — ${fmt(total)}`,
      html: `<p>New order from <b>${user.name}</b> (${user.email})</p><p>Total: <b>${fmt(total)}</b> (COD)</p>`,
      text: `New order ${orderId} from ${user.name} — ${fmt(total)}`,
      template: 'admin-order'
    });

    res.json({ demo: true, orderId, total, email: { sent: mail.ok, mode: mail.mode } });
  });

app.post('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  let event = req.body;
  try {
    if (typeof event === 'string' || Buffer.isBuffer(event)) event = JSON.parse(event.toString());
  } catch { return res.status(400).send('Bad payload'); }
  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    const orderId = intent.metadata?.orderId;
    if (orderId) {
      db.prepare("UPDATE orders SET payment_status='paid', status='confirmed' WHERE id=?").run(orderId);
      db.prepare("UPDATE payments SET status='paid' WHERE order_id=?").run(orderId);
      logStatus(orderId, 'confirmed', 'Payment received (Stripe)');
    }
  }
  res.json({ received: true });
});

// ---- Khalti return/callback ----
// Khalti redirects the user here after payment. We verify via the lookup API
// (never trust the query params alone), mark the order paid if Completed, send
// the confirmation emails, then bounce the user to the frontend orders page.
app.get('/api/payments/khalti/return', async (req, res) => {
  const { pidx, purchase_order_id } = req.query;
  const orderId = purchase_order_id;
  if (!pidx || !orderId) return res.redirect(`${APP_URL}/orders?payment=khalti&status=error&reason=missing`);

  // Verify the transaction server-side via Khalti's lookup API
  let lookup;
  try {
    const lr = await fetch(`${KHALTI_BASE}epayment/lookup/`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${KHALTI_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pidx }),
      signal: AbortSignal.timeout(15000)
    });
    lookup = await lr.json();
  } catch (e) {
    return res.redirect(`${APP_URL}/orders?payment=khalti&status=error&reason=lookup_failed`);
  }

  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
  if (!order) return res.redirect(`${APP_URL}/orders?payment=khalti&status=error&reason=order_not_found`);

  if (lookup.status === 'Completed') {
    // Idempotency: only confirm + email once
    if (order.payment_status !== 'paid') {
      db.prepare("UPDATE orders SET payment_status='paid', status='confirmed' WHERE id=?").run(orderId);
      db.prepare("UPDATE payments SET status='paid' WHERE order_id=?").run(orderId);
      logStatus(orderId, 'confirmed', 'Payment received (Khalti)');

      // Send confirmation emails (best-effort — don't block the redirect)
      try {
        const items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(orderId);
        const user = getUserById(order.user_id);
        const orderForMail = {
          id: orderId,
          items: items.map(it => ({ product_name: it.product_name, qty: it.qty, price_cents: it.price_cents, config: it.config_json ? JSON.parse(it.config_json) : null })),
          subtotal_cents: order.subtotal_cents, shipping_cents: order.shipping_cents,
          discount_cents: order.discount_cents, total_cents: order.total_cents,
          payment_method: 'khalti', payment_status: 'paid',
          shipping_address: order.shipping_address, shipping_city: order.shipping_city
        };
        const tpl = T.orderConfirmationEmail(user.name, orderForMail);
        await sendEmail({ to: user.email, ...tpl, template: 'order-confirmation' });
        await sendEmail({
          to: ADMIN_EMAIL, subject: `New order ${orderId} — ${fmt(order.total_cents)}`,
          html: `<p>New order from <b>${user.name}</b> (${user.email})</p><p>Total: <b>${fmt(order.total_cents)}</b> (paid via Khalti)</p>`,
          text: `New order ${orderId} from ${user.name} — ${fmt(order.total_cents)} (Khalti)`,
          template: 'admin-order'
        });
      } catch (e) {
        console.error('[khalti] email error:', e.message);
      }
    }
    return res.redirect(`${APP_URL}/orders?payment=khalti&status=success&orderId=${orderId}`);
  }

  // Not completed — could be Pending / User canceled / Expired
  const reason = (lookup.status || 'unknown').replace(/\s+/g, '_');
  return res.redirect(`${APP_URL}/orders?payment=khalti&status=failed&reason=${encodeURIComponent(reason)}&orderId=${orderId}`);
});

// ================= CUSTOMER ORDERS =================
app.get('/api/orders', auth, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC').all(req.user.id);
  const items = db.prepare('SELECT * FROM order_items WHERE order_id=?');
  const hist = db.prepare('SELECT status, note, created_at FROM order_status_history WHERE order_id=? ORDER BY created_at ASC');
  res.json(orders.map(o => ({ ...o, items: items.all(o.id), history: hist.all(o.id) })));
});

app.post('/api/orders/:id/cancel', auth, async (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  if (['shipped', 'delivered', 'cancelled', 'refunded'].includes(o.status))
    return res.status(400).json({ error: 'This order can no longer be cancelled' });

  const items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id);
  db.exec('BEGIN');
  try {
    for (const it of items) if (it.product_id) adjustStock(it.product_id, it.qty, 'cancel', o.id);
    db.prepare("UPDATE orders SET status='cancelled' WHERE id=?").run(o.id);
    logStatus(o.id, 'cancelled', 'Cancelled by customer');
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); return res.status(500).json({ error: e.message }); }

  const user = getUserById(req.user.id);
  const tpl = T.orderStatusEmail(user.name, o, 'cancelled');
  await sendEmail({ to: user.email, ...tpl, template: 'order-cancelled' });
  res.json({ ok: true });
});

// ================= CUSTOMER ACCOUNT =================
app.get('/api/account', auth, (req, res) => {
  const u = getUserById(req.user.id);
  if (!u) return res.status(404).json({ error: 'Not found' });
  const spend = db.prepare("SELECT COALESCE(SUM(total_cents),0) AS s FROM orders WHERE user_id=? AND status != 'cancelled'").get(u.id).s;
  const orderCount = db.prepare('SELECT COUNT(*) AS c FROM orders WHERE user_id=?').get(u.id).c;
  res.json({
    id: u.id, name: u.name, email: u.email, email_verified: u.email_verified ? 1 : 0,
    created_at: u.created_at, total_spent: spend, order_count: orderCount
  });
});

// ================= ADMIN =================
app.get('/api/admin/stats', auth, adminOnly, (req, res) => {
  const products = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  const users = db.prepare("SELECT COUNT(*) AS c FROM users WHERE is_admin=0").get().c;
  const orders = db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;
  const reviews = db.prepare('SELECT COUNT(*) AS c FROM reviews').get().c;
  const revenue = db.prepare("SELECT COALESCE(SUM(total_cents),0) AS s FROM orders WHERE status NOT IN ('cancelled','refunded')").get().s;
  const pending = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE status IN ('pending','confirmed','processing')").get().c;
  const completed = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE status='delivered'").get().c;
  const lowStock = db.prepare('SELECT COUNT(*) AS c FROM products WHERE stock <= 10').get().c;
  const pendingReviews = db.prepare('SELECT COUNT(*) AS c FROM reviews WHERE approved=0').get().c;

  const salesSeries = db.prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS orders, COALESCE(SUM(total_cents),0) AS revenue
    FROM orders WHERE created_at >= date('now','-13 days')
    GROUP BY date(created_at) ORDER BY day ASC
  `).all();

  const bestSellers = db.prepare(`
    SELECT product_name, SUM(qty) AS qty, SUM(qty*price_cents) AS revenue
    FROM order_items GROUP BY product_name ORDER BY qty DESC LIMIT 5
  `).all();

  res.json({ products, users, orders, reviews, revenue, pending, completed, lowStock, pendingReviews, salesSeries, bestSellers });
});

app.get('/api/admin/orders', auth, adminOnly, (req, res) => {
  const { status, q } = req.query;
  let orders = db.prepare(`
    SELECT o.*, u.name AS customer_name, u.email AS customer_email
    FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC
  `).all();
  if (status && status !== 'all') orders = orders.filter(o => o.status === status);
  if (q) {
    const n = String(q).toLowerCase();
    orders = orders.filter(o => o.id.toLowerCase().includes(n) || (o.customer_name || '').toLowerCase().includes(n) || (o.customer_email || '').toLowerCase().includes(n));
  }
  const items = db.prepare('SELECT * FROM order_items WHERE order_id=?');
  const hist = db.prepare('SELECT * FROM order_status_history WHERE order_id=? ORDER BY created_at ASC');
  res.json(orders.map(o => ({ ...o, items: items.all(o.id), history: hist.all(o.id) })));
});

app.put('/api/admin/orders/:id', auth, adminOnly, async (req, res) => {
  const { status } = req.body;
  const allowed = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const o = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found' });
  if (o.status === status) return res.json({ ok: true, status });

  db.exec('BEGIN');
  try {
    if ((status === 'cancelled' || status === 'refunded') && !['cancelled', 'refunded'].includes(o.status)) {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id);
      for (const it of items) if (it.product_id) adjustStock(it.product_id, it.qty, status === 'refunded' ? 'refund' : 'cancel', o.id);
    }
    db.prepare('UPDATE orders SET status=? WHERE id=?').run(status, o.id);
    logStatus(o.id, status, 'Updated by admin');
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); return res.status(500).json({ error: e.message }); }

  const user = getUserById(o.user_id);
  if (user) {
    const tpl = T.orderStatusEmail(user.name, o, status);
    await sendEmail({ to: user.email, ...tpl, template: 'order-status' });
  }
  res.json({ ok: true, status });
});

app.get('/api/admin/users', auth, adminOnly, (req, res) => {
  const { q } = req.query;
  let users = db.prepare(`
    SELECT u.id, u.name, u.email, u.is_admin, u.is_active, u.email_verified, u.created_at,
      (SELECT COUNT(*) FROM orders o WHERE o.user_id=u.id) AS order_count,
      (SELECT COALESCE(SUM(total_cents),0) FROM orders o WHERE o.user_id=u.id AND o.status NOT IN ('cancelled','refunded')) AS total_spent
    FROM users u ORDER BY u.created_at DESC
  `).all();
  if (q) {
    const n = String(q).toLowerCase();
    users = users.filter(u => u.name.toLowerCase().includes(n) || u.email.toLowerCase().includes(n));
  }
  res.json(users);
});

app.put('/api/admin/users/:id/active', auth, adminOnly, (req, res) => {
  const { active } = req.body;
  const target = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Not found' });
  if (target.is_admin) return res.status(400).json({ error: 'Cannot deactivate an admin' });
  db.prepare('UPDATE users SET is_active=? WHERE id=?').run(active ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/reviews', auth, adminOnly, (req, res) => {
  const { rating } = req.query;
  let rows = db.prepare(`
    SELECT r.*, u.name AS user_name, p.name AS product_name
    FROM reviews r JOIN users u ON u.id=r.user_id JOIN products p ON p.id=r.product_id
    ORDER BY r.created_at DESC
  `).all();
  if (rating) rows = rows.filter(r => r.rating === Number(rating));
  res.json(rows);
});

app.put('/api/admin/reviews/:id', auth, adminOnly, (req, res) => {
  const { approved } = req.body;
  db.prepare('UPDATE reviews SET approved=? WHERE id=?').run(approved ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/admin/reviews/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM reviews WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/inventory', auth, adminOnly, (req, res) => {
  res.json(db.prepare('SELECT id, slug, name, stock, available FROM products ORDER BY stock ASC').all());
});

app.get('/api/admin/inventory/:id/movements', auth, adminOnly, (req, res) => {
  res.json(db.prepare('SELECT * FROM inventory_movements WHERE product_id=? ORDER BY created_at DESC LIMIT 50').all(req.params.id));
});

app.post('/api/admin/inventory/:id/restock', auth, adminOnly, (req, res) => {
  const { change } = req.body;
  const n = Number(change);
  if (!n || n === 0) return res.status(400).json({ error: 'Invalid quantity' });
  const p = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  if (p.stock + n < 0) return res.status(400).json({ error: 'Cannot reduce below zero' });
  adjustStock(p.id, n, 'restock', 'manual');
  res.json({ ok: true, stock: p.stock + n });
});

app.put('/api/admin/products/:id/availability', auth, adminOnly, (req, res) => {
  const { available } = req.body;
  db.prepare('UPDATE products SET available=? WHERE id=?').run(available ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/products', auth, adminOnly, (req, res) => {
  const { q, category } = req.query;
  let rows = db.prepare('SELECT * FROM products ORDER BY id DESC').all();
  if (category && category !== 'all') rows = rows.filter(p => p.category === category);
  if (q) { const n = String(q).toLowerCase(); rows = rows.filter(p => p.name.toLowerCase().includes(n) || p.slug.toLowerCase().includes(n)); }
  res.json(rows.map(r => ({ ...r, config: r.config ? JSON.parse(r.config) : null })));
});

app.post('/api/admin/products', auth, adminOnly, (req, res) => {
  const b = req.body;
  if (!b.slug || !b.name || !b.category || b.price_cents == null)
    return res.status(400).json({ error: 'slug, name, category, price_cents required' });
  const exists = db.prepare('SELECT id FROM products WHERE slug=?').get(b.slug);
  if (exists) return res.status(409).json({ error: 'Slug already exists' });
  db.prepare(`INSERT INTO products (slug,name,category,description,price_cents,compare_at_cents,image,badge,stock,featured,available,layout,switch_type,switch_brand,keycap_material,connectivity,hot_swap,rgb,color,config)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(b.slug, b.name, b.category, b.description || '', b.price_cents, b.compare_at_cents || null, b.image || '', b.badge || null,
      b.stock ?? 50, b.featured ? 1 : 0, b.available === false ? 0 : 1, b.layout || null, b.switch_type || null, b.switch_brand || null,
      b.keycap_material || null, b.connectivity || null, b.hot_swap ? 1 : 0, b.rgb ? 1 : 0, b.color || null, b.config ? JSON.stringify(b.config) : null);
  const p = db.prepare('SELECT id FROM products WHERE slug=?').get(b.slug);
  if (b.stock != null) db.prepare('INSERT INTO inventory_movements (product_id,change,reason,reference) VALUES (?,?,?,?)').run(p.id, b.stock, 'restock', 'initial');
  res.json({ ok: true, id: p.id });
});

app.put('/api/admin/products/:id', auth, adminOnly, (req, res) => {
  const b = req.body;
  const existing = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare(`UPDATE products SET name=?, category=?, description=?, price_cents=?, compare_at_cents=?, image=?, badge=?, stock=?, featured=?, available=?, layout=?, switch_type=?, switch_brand=?, keycap_material=?, connectivity=?, hot_swap=?, rgb=?, color=?, config=? WHERE id=?`)
    .run(b.name, b.category, b.description || '', b.price_cents, b.compare_at_cents || null, b.image || '', b.badge || null,
      b.stock ?? existing.stock, b.featured ? 1 : 0, b.available === false ? 0 : 1, b.layout || null, b.switch_type || null, b.switch_brand || null,
      b.keycap_material || null, b.connectivity || null, b.hot_swap ? 1 : 0, b.rgb ? 1 : 0, b.color || null, b.config ? JSON.stringify(b.config) : null, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/admin/products/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/email-logs', auth, adminOnly, (req, res) => {
  res.json(db.prepare('SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 100').all());
});

app.get('/api/admin/mailer-status', auth, adminOnly, (req, res) => {
  res.json(mailerInfo());
});

// ============ Serve built frontend in production ============
const dist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(dist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(dist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`KeyForge API running on http://localhost:${PORT}`);
  console.log(`Mailer: ${mailerInfo().mode} mode`);
});