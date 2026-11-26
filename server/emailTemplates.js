// emailTemplates.js — branded responsive HTML email templates + plain-text fallbacks
// Every template returns { subject, html, text }

const BRAND = 'KeyForge';
const ACCENT = '#6366f1';
const ACCENT2 = '#8b5cf6';
const BG = '#0b0d12';
const SURFACE = '#141821';
const TEXT = '#e6e9f0';
const MUTED = '#8b93a7';

function layout(title, bodyHtml) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TEXT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${SURFACE};border-radius:14px;overflow:hidden;border:1px solid #262c3d;">
        <tr><td style="padding:22px 28px;border-bottom:1px solid #262c3d;">
          <span style="font-size:22px;font-weight:800;color:${TEXT};">⌨ ${BRAND}<span style="color:${ACCENT};">Forge</span></span>
        </td></tr>
        <tr><td style="padding:28px;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #262c3d;background:#10131b;">
          <span style="font-size:12px;color:${MUTED};">© ${new Date().getFullYear()} ${BRAND} — Premium mechanical keyboards &amp; accessories.<br/>This is an automated message. Do not reply directly.</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const btn = (url, label) =>
  `<a href="${url}" style="display:inline-block;background:linear-gradient(135deg,${ACCENT},${ACCENT2});color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px;margin:8px 0;">${label}</a>`;

const p = (s) => `<p style="margin:0 0 14px;line-height:1.6;color:${TEXT};">${s}</p>`;
const h = (s) => `<h2 style="margin:0 0 16px;font-size:20px;color:${TEXT};">${s}</h2>`;

function orderTable(items) {
  const rows = items.map(it => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #262c3d;color:${TEXT};">
        ${it.qty}× ${it.product_name}
        ${it.config ? `<div style="font-size:12px;color:${MUTED};">${Object.values(it.config).join(' · ')}</div>` : ''}
      </td>
      <td align="right" style="padding:8px 0;border-bottom:1px solid #262c3d;color:${TEXT};">Rs. ${(it.price_cents / 100).toLocaleString('en-IN')}</td>
    </tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;">${rows}</table>`;
}

// ---------------- TEMPLATES ----------------

export function welcomeEmail(name, verifyUrl) {
  const subject = `Welcome to ${BRAND}Forge!`;
  let body = h(`Welcome aboard, ${name}! 👋`);
  body += p(`Thanks for creating an account at <b>${BRAND}Forge</b> — your home for premium mechanical keyboards, switches, keycaps and accessories.`);
  if (verifyUrl) {
    body += p(`Please confirm your email address to unlock your account and start shopping:`);
    body += btn(verifyUrl, 'Verify my email');
    body += p(`<span style="font-size:13px;color:${MUTED};">Or copy this link: ${verifyUrl}</span>`);
  }
  return {
    subject,
    html: layout('Welcome', body),
    text: `Welcome to ${BRAND}Forge, ${name}!${verifyUrl ? `\n\nVerify your email: ${verifyUrl}` : ''}\n\nHappy shopping!`
  };
}

export function verifyEmail(name, verifyUrl) {
  const subject = `Verify your ${BRAND}Forge email`;
  let body = h(`Hi ${name}, confirm your email`);
  body += p(`Tap the button below to verify your email address. If you didn't create an account, you can ignore this message.`);
  body += btn(verifyUrl, 'Verify email');
  body += p(`<span style="font-size:13px;color:${MUTED};">Link: ${verifyUrl}</span>`);
  return { subject, html: layout('Verify email', body), text: `Verify your email: ${verifyUrl}` };
}

export function passwordResetEmail(name, resetUrl) {
  const subject = `Reset your ${BRAND}Forge password`;
  let body = h(`Hi ${name}, reset your password`);
  body += p(`We received a request to reset the password for your account. Click below to choose a new password. This link expires in 1 hour.`);
  body += btn(resetUrl, 'Reset password');
  body += p(`<span style="font-size:13px;color:${MUTED};">Link: ${resetUrl}</span><br/><span style="font-size:13px;color:${MUTED};">If you didn't request this, your account is safe — just ignore this email.</span>`);
  return { subject, html: layout('Reset password', body), text: `Reset your password: ${resetUrl}\n(This link expires in 1 hour.)` };
}

export function passwordChangedEmail(name) {
  const subject = `Your ${BRAND}Forge password was changed`;
  let body = h(`Password updated`);
  body += p(`Hi ${name}, your account password was just changed successfully.`);
  body += p(`<span style="color:#ef4444;">If you didn't do this, please contact support immediately.</span>`);
  return { subject, html: layout('Password changed', body), text: `Your ${BRAND}Forge password was changed. If this wasn't you, contact support immediately.` };
}

export function orderConfirmationEmail(name, order) {
  const { id, items, total_cents, payment_method, payment_status, shipping_address, shipping_city } = order;
  const subject = `Order confirmed — ${id}`;
  let body = h(`Thanks for your order, ${name}! 🎉`);
  body += p(`Your order <b>${id}</b> has been placed. Here's a summary:`);
  body += orderTable(items);
  body += `<p style="margin:0 0 4px;color:${MUTED};">Subtotal: Rs. ${(order.subtotal_cents / 100).toLocaleString('en-IN')}</p>`;
  if (order.shipping_cents) body += `<p style="margin:0 0 4px;color:${MUTED};">Shipping: Rs. ${(order.shipping_cents / 100).toLocaleString('en-IN')}</p>`;
  if (order.discount_cents) body += `<p style="margin:0 0 4px;color:#10b981;">Discount: -Rs. ${(order.discount_cents / 100).toLocaleString('en-IN')}</p>`;
  body += `<p style="margin:8px 0 16px;font-size:18px;font-weight:700;color:${TEXT};">Total: Rs. ${(total_cents / 100).toLocaleString('en-IN')}</p>`;
  body += p(`Payment: <b>${(payment_method || 'cod').toUpperCase()}</b> (${payment_status})<br/>Ship to: ${shipping_address || '—'}, ${shipping_city || ''}`);
  body += p(`<span style="color:${MUTED};">We'll email you when your order ships.</span>`);
  return { subject, html: layout('Order confirmed', body), text: `Order ${id} confirmed. Total Rs. ${(total_cents / 100).toLocaleString('en-IN')}. Payment ${payment_method} (${payment_status}).` };
}

const STATUS_COPY = {
  pending: { title: 'Order received', msg: 'Your order has been placed and is awaiting confirmation.' },
  confirmed: { title: 'Order confirmed', msg: 'We\'ve confirmed your order and it\'s being prepared.' },
  processing: { title: 'Order processing', msg: 'Your order is being packed and processed.' },
  shipped: { title: 'Your order has shipped! 🚚', msg: 'Your order is on its way. Keep an eye out for delivery.' },
  delivered: { title: 'Order delivered ✅', msg: 'Your order has been delivered. Enjoy your new gear! We\'d love a review.' },
  cancelled: { title: 'Order cancelled', msg: 'Your order has been cancelled. If you paid online, a refund will be processed.' },
  refunded: { title: 'Refund issued 💸', msg: 'A refund has been issued for your order and should appear shortly.' }
};

export function orderStatusEmail(name, order, newStatus) {
  const copy = STATUS_COPY[newStatus] || { title: `Order ${newStatus}`, msg: `Your order status is now "${newStatus}".` };
  const subject = `${copy.title} — ${order.id}`;
  let body = h(copy.title);
  body += p(`Hi ${name}, ${copy.msg}`);
  body += p(`Order <b>${order.id}</b> · Total Rs. ${(order.total_cents / 100).toLocaleString('en-IN')}`);
  body += btn(`${process.env.APP_URL || 'http://localhost:5173'}/orders`, 'View my orders');
  return { subject, html: layout(copy.title, body), text: `${copy.title} — order ${order.id}. ${copy.msg}` };
}

export function reviewConfirmationEmail(name, productName) {
  const subject = `Thanks for your review!`;
  let body = h(`Review submitted ✅`);
  body += p(`Hi ${name}, thanks for reviewing <b>${productName}</b>. Your review is pending approval and will appear on the product page once published.`);
  return { subject, html: layout('Review submitted', body), text: `Thanks for reviewing ${productName}. Your review is pending approval.` };
}

export function adminAlertEmail(subject, htmlBody, textBody) {
  return { subject: `[${BRAND}Forge Admin] ${subject}`, html: layout(subject, htmlBody), text: textBody };
}