// db.js — SQLite database setup + seed data for KeyForge
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new DatabaseSync(path.join(__dirname, 'keyforge.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    email_verified INTEGER DEFAULT 0,
    verify_token TEXT,
    reset_token TEXT,
    reset_token_expires TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    compare_at_cents INTEGER,
    image TEXT NOT NULL,
    badge TEXT,
    stock INTEGER DEFAULT 50,
    featured INTEGER DEFAULT 0,
    available INTEGER DEFAULT 1,
    layout TEXT,
    switch_type TEXT,
    switch_brand TEXT,
    keycap_material TEXT,
    connectivity TEXT,
    hot_swap INTEGER DEFAULT 0,
    rgb INTEGER DEFAULT 0,
    color TEXT,
    config TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    price_delta_cents INTEGER DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    config_json TEXT,
    qty INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    label TEXT,
    full_name TEXT NOT NULL,
    phone TEXT,
    street TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'Nepal',
    is_default INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    subtotal_cents INTEGER NOT NULL DEFAULT 0,
    shipping_cents INTEGER DEFAULT 0,
    discount_cents INTEGER DEFAULT 0,
    total_cents INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    payment_method TEXT DEFAULT 'cod',
    payment_status TEXT DEFAULT 'pending',
    shipping_name TEXT,
    shipping_phone TEXT,
    shipping_address TEXT,
    shipping_city TEXT,
    shipping_postal TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    product_id INTEGER,
    product_name TEXT NOT NULL,
    config_json TEXT,
    qty INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS order_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    status TEXT NOT NULL,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    method TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    amount_cents INTEGER NOT NULL,
    reference TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    approved INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS wishlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE (user_id, product_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS inventory_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    change INTEGER NOT NULL,
    reason TEXT NOT NULL,
    reference TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS email_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    template TEXT,
    status TEXT DEFAULT 'queued',
    error TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ============================================================
// MIGRATIONS — add columns to databases created before this update
// ============================================================
function addColumnIfMissing(table, column, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
    console.log(`Migrated ${table}: added ${column}`);
  }
}

addColumnIfMissing('users', 'is_active', 'INTEGER DEFAULT 1');
addColumnIfMissing('users', 'email_verified', 'INTEGER DEFAULT 0');
addColumnIfMissing('users', 'verify_token', 'TEXT');
addColumnIfMissing('users', 'reset_token', 'TEXT');
addColumnIfMissing('users', 'reset_token_expires', 'TEXT');
addColumnIfMissing('products', 'compare_at_cents', 'INTEGER');
addColumnIfMissing('products', 'featured', 'INTEGER DEFAULT 0');
addColumnIfMissing('products', 'available', 'INTEGER DEFAULT 1');
addColumnIfMissing('products', 'layout', 'TEXT');
addColumnIfMissing('products', 'switch_type', 'TEXT');
addColumnIfMissing('products', 'switch_brand', 'TEXT');
addColumnIfMissing('products', 'keycap_material', 'TEXT');
addColumnIfMissing('products', 'connectivity', 'TEXT');
addColumnIfMissing('products', 'hot_swap', 'INTEGER DEFAULT 0');
addColumnIfMissing('products', 'rgb', 'INTEGER DEFAULT 0');
addColumnIfMissing('products', 'color', 'TEXT');
addColumnIfMissing('products', 'created_at', "TEXT DEFAULT (datetime('now'))");
addColumnIfMissing('orders', 'subtotal_cents', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('orders', 'shipping_cents', 'INTEGER DEFAULT 0');
addColumnIfMissing('orders', 'discount_cents', 'INTEGER DEFAULT 0');
addColumnIfMissing('orders', 'payment_method', "TEXT DEFAULT 'cod'");
addColumnIfMissing('orders', 'payment_status', "TEXT DEFAULT 'pending'");
addColumnIfMissing('orders', 'shipping_name', 'TEXT');
addColumnIfMissing('orders', 'shipping_phone', 'TEXT');
addColumnIfMissing('orders', 'shipping_address', 'TEXT');
addColumnIfMissing('orders', 'shipping_city', 'TEXT');
addColumnIfMissing('orders', 'shipping_postal', 'TEXT');

// Backfill subtotal for legacy orders that predate it
db.exec(`UPDATE orders SET subtotal_cents = total_cents WHERE subtotal_cents = 0;`);

// ---- Seed categories ----
const catCount = db.prepare('SELECT COUNT(*) AS c FROM categories').get();
if (catCount.c === 0) {
  const ins = db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)');
  [['Keyboards', 'keyboard'], ['Switches', 'switch'], ['Keycaps', 'keycap'],
   ['Accessories', 'accessory'], ['Custom Parts', 'parts'], ['Peripherals', 'peripheral']]
    .forEach(([n, s]) => ins.run(n, s));
  console.log('Seeded categories.');
}

// ---- Seed products (only if empty) ----
const count = db.prepare('SELECT COUNT(*) AS c FROM products').get();
if (count.c === 0) {
  const insert = db.prepare(
    `INSERT INTO products (slug,name,category,description,price_cents,compare_at_cents,image,badge,stock,
      featured,layout,switch_type,switch_brand,keycap_material,connectivity,hot_swap,rgb,color,config)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );

  const kbConfig = JSON.stringify({
    cases: [
      { id: 'aluminum', name: 'Aluminum', add_cents: 0 },
      { id: 'pc', name: 'Polycarbonate', add_cents: -200000 },
      { id: 'brass', name: 'Brass', add_cents: 600000 }
    ],
    switches: [
      { id: 'linear', name: 'Linear (Red)', add_cents: 0 },
      { id: 'tactile', name: 'Tactile (Brown)', add_cents: 0 },
      { id: 'clicky', name: 'Clicky (Blue)', add_cents: 50000 }
    ],
    keycaps: [
      { id: 'default', name: 'Stock PBT', add_cents: 0 },
      { id: 'premium', name: 'Premium Dye-sub', add_cents: 400000 }
    ]
  });

  const seed = [
    ['nova75', 'Nova75 Wireless', 'keyboard', '75% hot-swap wireless board with gasket mount and knob.', 1890000, 2190000, '/images/nova75.jpg', 'Best Seller', 24, 1, '75%', 'Linear', 'Gateron', 'PBT', 'Wireless', 1, 1, 'Silver', kbConfig],
    ['atlas65', 'Atlas65 Aluminum', 'keyboard', '65% CNC aluminum board, tri-mode connectivity, premium typing feel.', 2290000, null, '/images/atlas65.jpg', 'New', 18, 1, '65%', 'Tactile', 'Cherry', 'PBT', 'Bluetooth', 1, 1, 'Black', kbConfig],
    ['lumen40', 'Lumen40 Macro', 'keyboard', '40% ortholinear macro pad for shortcuts and streaming.', 890000, null, '/images/lumen40.jpg', null, 30, 0, '40%', 'Linear', 'Kailh', 'ABS', 'Wired', 1, 1, 'White', kbConfig],
    ['titan100', 'Titan100 Full', 'keyboard', 'Full-size board with dedicated numpad, heavy aluminum case.', 2590000, 2890000, '/images/titan100.jpg', null, 12, 0, 'Full-size', 'Tactile', 'Cherry', 'PBT', 'Wired', 0, 1, 'Gunmetal', kbConfig],
    ['retro-cream', 'Cream Switches (x70)', 'switch', 'Smooth linear switches, 55g actuation, lubed from factory.', 450000, null, '/images/retro-cream.jpg', 'Fan Fav', 40, 1, null, 'Linear', 'Gateron', null, null, 0, 0, 'Cream', null],
    ['silent-tactile', 'Silent Tactile (x70)', 'switch', 'Quiet tactile bumps for office-friendly typing.', 520000, null, '/images/silent-tactile.jpg', null, 35, 0, null, 'Tactile', 'Cherry', null, null, 0, 0, 'Brown', null],
    ['retro-beige', 'Retro Beige Keycaps', 'keycap', 'Full PBT dye-sub set, classic 80s beige + accent mods.', 690000, null, '/images/retro-beige.jpg', null, 25, 0, null, null, null, 'PBT', null, 0, 0, 'Beige', null],
    ['neon-night', 'Neon Night Keycaps', 'keycap', 'Dark base with cyan/magenta legends. Shine-through.', 790000, 890000, '/images/neon-night.jpg', 'Hot', 20, 1, null, null, null, 'PBT', null, 0, 1, 'Black', null],
    ['artisan-panda', 'Artisan Panda Cap', 'keycap', 'Hand-cast resin artisan for your Esc key. One of a kind.', 350000, null, '/images/artisan-panda.jpg', 'Limited', 8, 0, null, null, null, 'Resin', null, 0, 0, 'Multicolor', null],
    ['desk-mat', 'Forge Desk Mat XL', 'accessory', '900x400mm stitched-edge mat, low-friction cloth surface.', 290000, null, '/images/desk-mat.jpg', null, 50, 0, null, null, null, null, null, 0, 0, 'Grey', null],
    ['switch-lube', 'Switch Lube Kit', 'accessory', 'Everything to lube 100 switches: brush, lube, film, opener.', 190000, null, '/images/switch-lube.jpg', null, 45, 0, null, null, null, null, null, 0, 0, null, null],
    ['coiled-cable', 'Coiled Aviator Cable', 'accessory', 'Braided USB-C coiled cable with metal aviator connector.', 390000, null, '/images/coiled-cable.jpg', null, 30, 0, null, null, null, null, null, 0, 0, 'Red', null]
  ];

  for (const s of seed) insert.run(...s);
  console.log(`Seeded ${seed.length} products.`);
}

// Migration: add is_admin column for databases created before admin feature
const cols = db.prepare("PRAGMA table_info(users)").all();
if (!cols.some(c => c.name === 'is_admin')) {
  db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0");
  console.log('Migrated users table: added is_admin column');
}

// Ensure demo + admin accounts are marked email-verified (backfill)
db.exec(`UPDATE users SET email_verified = 1 WHERE email IN ('demo@keyforge.test','admin@keyforge.test');`);

// Seed a demo user
const uc = db.prepare('SELECT COUNT(*) AS c FROM users').get();
if (uc.c === 0) {
  const hash = bcrypt.hashSync('demo1234', 10);
  db.prepare('INSERT INTO users (id,name,email,password_hash,is_admin,email_verified) VALUES (?,?,?,?,0,1)')
    .run(randomUUID(), 'Demo User', 'demo@keyforge.test', hash);
  console.log('Seeded demo user demo@keyforge.test / demo1234');
}

// Seed an admin user
const ac = db.prepare("SELECT COUNT(*) AS c FROM users WHERE is_admin=1").get();
if (ac.c === 0) {
  const hash = bcrypt.hashSync('admin1234', 10);
  db.prepare('INSERT INTO users (id,name,email,password_hash,is_admin,email_verified) VALUES (?,?,?,?,1,1)')
    .run(randomUUID(), 'Admin', 'admin@keyforge.test', hash);
  console.log('Seeded admin user admin@keyforge.test / admin1234');
}

export default db;