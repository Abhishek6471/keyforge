// mailer.js — central email notification service
// Supports three modes, chosen automatically from environment variables:
//
//   1. RESEND MODE — if RESEND_API_KEY is set, sends via the Resend HTTP API
//      (https://resend.com). Uses EMAIL_FROM as the verified sender address.
//   2. SMTP MODE  — else if SMTP_HOST/SMTP_USER/SMTP_PASS are set, sends via
//      nodemailer SMTP (Gmail/custom).
//   3. LOG MODE   — else records emails to the DB + console only, so the app
//      works offline. Never claims an email was "sent" unless it really was.
//
// Every attempt is recorded in the email_logs table.

import nodemailer from 'nodemailer';
import db from './db.js';

// ---- Resend config ----
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// ---- SMTP config (fallback) ----
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465;

// ---- Shared config ----
const FROM_NAME = process.env.MAIL_FROM_NAME || 'KeyForge';
// EMAIL_FROM is the canonical sender (e.g. "onboarding@resend.dev").
// Fall back to MAIL_FROM_EMAIL (legacy), then SMTP user, then a dev default.
const FROM_EMAIL =
  process.env.EMAIL_FROM ||
  process.env.MAIL_FROM_EMAIL ||
  SMTP_USER ||
  'no-reply@keyforge.test';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@keyforge.test';

let transporter = null;
let mode = 'log'; // 'resend' | 'smtp' | 'log'

if (RESEND_API_KEY) {
  mode = 'resend';
  console.log(`[mailer] RESEND mode → sending as ${FROM_EMAIL}`);
} else if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  try {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
    mode = 'smtp';
    console.log(`[mailer] SMTP mode → ${SMTP_HOST}:${SMTP_PORT} as ${SMTP_USER}`);
  } catch (e) {
    console.error('[mailer] Failed to create transporter, falling back to log mode:', e.message);
    mode = 'log';
  }
} else {
  console.log('[mailer] No RESEND_API_KEY or SMTP credentials set — running in LOG MODE (emails recorded to DB only).');
}

function logEmail(to, subject, template, status, error = null) {
  try {
    db.prepare('INSERT INTO email_logs (to_email, subject, template, status, error) VALUES (?,?,?,?,?)')
      .run(to, subject, template, status, error);
  } catch (e) {
    console.error('[mailer] Failed to write email log:', e.message);
  }
}

// Build a "From" value. Resend accepts either "Name <email>" or a bare email.
// EMAIL_FROM may already be a full "Name <email>" string — don't double-wrap it.
function fromHeader() {
  const fe = FROM_EMAIL.trim();
  // Already in "Name <email>" form (or any form containing angle brackets) → use as-is
  if (fe.includes('<') && fe.includes('>')) return fe;
  // Bare email → attach the display name
  return `"${FROM_NAME}" <${fe}>`;
}

// Send via Resend HTTP API
async function sendViaResend({ to, subject, html, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: fromHeader(),
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || '',
      text: text || ''
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Resend returns { message } or { error: { message } } on failure
    const msg = data.message || data.error?.message || `Resend API error (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return data; // { id: "..." }
}

/**
 * sendEmail({ to, subject, html, text, template })
 * Returns { ok, mode, error?, logged? }
 */
export async function sendEmail({ to, subject, html, text, template = 'custom' }) {
  if (!to || !subject) return { ok: false, mode, error: 'Missing recipient or subject' };

  // RESEND MODE
  if (mode === 'resend') {
    try {
      await sendViaResend({ to, subject, html, text });
      logEmail(to, subject, template, 'sent');
      return { ok: true, mode };
    } catch (e) {
      logEmail(to, subject, template, 'failed', e.message);
      console.error(`[mailer] Resend send failed to ${to}:`, e.message);
      return { ok: false, mode, error: e.message };
    }
  }

  // SMTP MODE
  if (mode === 'smtp' && transporter) {
    try {
      await transporter.sendMail({
        from: fromHeader(),
        to,
        subject,
        html,
        text: text || ''
      });
      logEmail(to, subject, template, 'sent');
      return { ok: true, mode };
    } catch (e) {
      logEmail(to, subject, template, 'failed', e.message);
      console.error(`[mailer] Send failed to ${to}:`, e.message);
      return { ok: false, mode, error: e.message };
    }
  }

  // LOG MODE — record only; do not pretend it was sent
  logEmail(to, subject, template, 'logged');
  console.log(`[mailer:log] To:${to} | Subject:"${subject}" | template:${template}`);
  return { ok: true, mode, logged: true };
}

export const mailerInfo = () => ({ mode, from: FROM_EMAIL, adminEmail: ADMIN_EMAIL });
export { ADMIN_EMAIL, FROM_EMAIL, FROM_NAME };