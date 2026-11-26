import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [emailInfo, setEmailInfo] = useState(null);

  function set(k) { return e => setForm({ ...form, [k]: e.target.value }); }

  async function submit(e) {
    e.preventDefault();
    setErr('');
    const r = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const data = await r.json();
    if (!r.ok) return setErr(data.error);
    login(data);
    if (data.email) setEmailInfo(data.email);
    if (!data.email || data.email.mode !== 'smtp') nav('/');
  }

  return (
    <form className="auth" onSubmit={submit}>
      <h1>Create account</h1>
      <input placeholder="Name" value={form.name} onChange={set('name')} required />
      <input placeholder="Email" type="email" value={form.email} onChange={set('email')} required />
      <input placeholder="Password (6+ chars)" type="password" value={form.password} onChange={set('password')} required />
      {err && <p className="msg err">{err}</p>}
      {emailInfo && (
        <p className="msg ok">
          Account created! A welcome email has been {emailInfo.mode === 'smtp' ? 'sent' : 'queued (log mode)'} — check your inbox to verify.
        </p>
      )}
      <button className="btn wide">Sign up</button>
      <p className="muted">Already registered? <Link to="/login">Log in</Link></p>
    </form>
  );
}