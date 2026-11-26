// security.js — lightweight rate limiting, input validation & sanitization helpers
// No external deps; uses an in-memory sliding-window limiter suitable for a single-node app.

// ---- Rate limiter (in-memory sliding window) ----
const buckets = new Map();

/**
 * rateLimit(key, limit, windowMs)
 * Returns { ok, retryAfter } — ok=false when the caller exceeded the limit.
 */
export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  if (!buckets.has(key)) buckets.set(key, []);
  const hits = buckets.get(key).filter(t => now - t < windowMs);
  if (hits.length >= limit) {
    const retryAfter = Math.ceil((windowMs - (now - hits[0])) / 1000);
    buckets.set(key, hits);
    return { ok: false, retryAfter };
  }
  hits.push(now);
  buckets.set(key, hits);
  return { ok: true };
}

// Periodically clear stale buckets to avoid unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of buckets) {
    const recent = hits.filter(t => now - t < 15 * 60 * 1000);
    if (recent.length === 0) buckets.delete(key);
    else buckets.set(key, recent);
  }
}, 10 * 60 * 1000).unref?.();

// ---- Input validation helpers ----
export function isEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export function sanitize(str) {
  if (typeof str !== 'string') return str;
  // Basic XSS mitigation: strip < > and common event-handler patterns
  return str.replace(/[<>]/g, '').replace(/javascript:/gi, '').trim();
}

export function sanitizeDeep(obj) {
  if (typeof obj === 'string') return sanitize(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeDeep);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const k of Object.keys(obj)) out[k] = sanitizeDeep(obj[k]);
    return out;
  }
  return obj;
}

// Client IP from request (behind proxies uses x-forwarded-for)
export function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}