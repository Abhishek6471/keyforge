import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

// Step 2: set a new password using the token from the reset email
export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      const d = await r.json();
      if (r.ok) {
        setMsg({ ok: true, text: 'Password updated! Redirecting to login…' });
        setTimeout(() => nav('/login'), 1500);
      } else setMsg({ ok: false, text: d.error || 'Reset failed.' });
    } catch {
      setMsg({ ok: false, text: 'Network error.' });
    } finally { setBusy(false); }
  }

  return (
    <form className="auth" onSubmit={submit}>
      <h1>Reset password</h1>
      {!token ? (
        <>
          <p className="msg err">Missing reset token. Use the link from your email.</p>
          <Link to="/forgot-password" className="btn ghost">Request a new link</Link>
        </>
      ) : (
        <>
          <input placeholder="New password (6+ chars)" type="password" value={password}
                 onChange={e => setPassword(e.target.value)} required minLength={6} />
          {msg && <p className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</p>}
          <button className="btn wide" disabled={busy}>{busy ? 'Updating…' : 'Set new password'}</button>
        </>
      )}
    </form>
  );
}