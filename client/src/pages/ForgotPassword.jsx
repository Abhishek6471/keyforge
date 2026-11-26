import React, { useState } from 'react';
import { Link } from 'react-router-dom';

// Step 1: request a password-reset email
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const d = await r.json();
      setMsg({ ok: r.ok, text: d.message || d.error || 'Done.' });
    } catch {
      setMsg({ ok: false, text: 'Network error.' });
    } finally { setBusy(false); }
  }

  return (
    <form className="auth" onSubmit={submit}>
      <h1>Forgot password</h1>
      <p className="muted">Enter your email and we'll send you a reset link.</p>
      <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      {msg && <p className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</p>}
      <button className="btn wide" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
      <p className="muted">Remembered it? <Link to="/login">Log in</Link></p>
    </form>
  );
}