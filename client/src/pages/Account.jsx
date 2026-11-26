import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const fmt = c => `Rs. ${(c / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function Account() {
  const { token, user, logout } = useAuth();
  const [acct, setAcct] = useState(null);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [msg, setMsg] = useState(null);
  const [resendMsg, setResendMsg] = useState(null);

  useEffect(() => {
    if (!token) return;
    fetch('/api/account', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setAcct);
  }, [token]);

  function set(k) { return e => setPw({ ...pw, [k]: e.target.value }); }

  async function changePw(e) {
    e.preventDefault(); setMsg(null);
    const r = await fetch('/api/auth/change-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ current: pw.current, next: pw.next })
    });
    const d = await r.json();
    setMsg({ ok: r.ok, text: r.ok ? 'Password changed. A confirmation email was sent.' : (d.error || 'Failed.') });
    if (r.ok) setPw({ current: '', next: '' });
  }

  async function resendVerification() {
    const r = await fetch('/api/auth/resend-verification', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }
    });
    const d = await r.json();
    setResendMsg(d.already ? 'Email already verified.' : (d.ok ? 'Verification email sent!' : 'Could not send.'));
  }

  if (!token) return <p className="muted">Please <Link to="/login">log in</Link> to view your account.</p>;
  if (!acct) return <p className="muted">Loading…</p>;

  return (
    <div>
      <h1>My Account</h1>
      <div className="acct-grid">
        <div className="stat-card">
          <div className="stat-icon">👤</div>
          <div>
            <div className="stat-value">{acct.name}</div>
            <div className="stat-label">{acct.email}</div>
            <div className="muted sm">Member since {new Date(acct.created_at + 'Z').toLocaleDateString()}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div><div className="stat-value">{acct.order_count}</div><div className="stat-label">Orders placed</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div><div className="stat-value">{fmt(acct.total_spent)}</div><div className="stat-label">Total spent</div></div>
        </div>
      </div>

      {!acct.email_verified && (
        <div className="warn-banner">
          ⚠ Your email isn't verified yet.
          <button className="btn ghost sm" onClick={resendVerification} style={{ marginLeft: '.5rem' }}>Resend verification</button>
          {resendMsg && <span className="muted"> {resendMsg}</span>}
        </div>
      )}

      <div className="acct-sections">
        <section className="panel">
          <h2>Change password</h2>
          <form className="stack" onSubmit={changePw}>
            <input placeholder="Current password" type="password" value={pw.current} onChange={set('current')} required />
            <input placeholder="New password (6+ chars)" type="password" value={pw.next} onChange={set('next')} required minLength={6} />
            <button className="btn">Update password</button>
            {msg && <p className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</p>}
          </form>
        </section>

        <section className="panel">
          <h2>Quick links</h2>
          <ul className="link-list">
            <li><Link to="/orders">My orders</Link></li>
            <li><Link to="/wishlist">My wishlist</Link></li>
            <li><Link to="/addresses">My addresses</Link></li>
          </ul>
          <button className="btn ghost" onClick={logout}>Log out</button>
        </section>
      </div>
    </div>
  );
}