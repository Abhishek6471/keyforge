import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    const r = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await r.json();
    if (!r.ok) return setErr(data.error);
    login(data);
    nav('/');
  }

  return (
    <form className="auth" onSubmit={submit}>
      <h1>Log in</h1>
      <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
      {err && <p className="msg err">{err}</p>}
      <button className="btn wide">Log in</button>
      <p className="muted"><Link to="/forgot-password">Forgot password?</Link></p>
      <p className="muted">No account? <Link to="/register">Sign up</Link></p>
      <p className="muted sm">Demo: demo@keyforge.test / demo1234</p>
    </form>
  );
}