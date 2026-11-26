import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const EMPTY = { label: '', full_name: '', phone: '', street: '', city: '', state: '', postal_code: '', country: 'Nepal', is_default: false };

export default function Addresses() {
  const { token } = useAuth();
  const [list, setList] = useState(null);
  const [form, setForm] = useState(null); // null = closed
  const [err, setErr] = useState('');

  async function load() {
    const r = await fetch('/api/addresses', { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setList(await r.json());
  }
  useEffect(() => { if (token) load(); }, [token]);

  function set(k) { return e => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }); }

  async function save(e) {
    e.preventDefault(); setErr('');
    const r = await fetch('/api/addresses', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form)
    });
    const d = await r.json();
    if (!r.ok) return setErr(d.error || 'Save failed');
    setForm(null); load();
  }

  async function remove(id) {
    await fetch(`/api/addresses/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    load();
  }

  if (!token) return <p className="muted">Please <Link to="/login">log in</Link> to manage addresses.</p>;

  return (
    <div>
      <div className="admin-head">
        <h1>My Addresses</h1>
        <button className="btn" onClick={() => setForm(form ? null : { ...EMPTY })}>
          {form ? 'Cancel' : '+ Add address'}
        </button>
      </div>

      {form && (
        <form className="admin-form" onSubmit={save}>
          <h2>New address</h2>
          <div className="form-row">
            <label>Label <input value={form.label} onChange={set('label')} placeholder="Home / Office" /></label>
            <label>Full name <input value={form.full_name} onChange={set('full_name')} required /></label>
            <label>Phone <input value={form.phone} onChange={set('phone')} /></label>
          </div>
          <label>Street <input value={form.street} onChange={set('street')} required /></label>
          <div className="form-row">
            <label>City <input value={form.city} onChange={set('city')} required /></label>
            <label>State <input value={form.state} onChange={set('state')} /></label>
            <label>Postal code <input value={form.postal_code} onChange={set('postal_code')} /></label>
          </div>
          <div className="form-row">
            <label>Country <input value={form.country} onChange={set('country')} /></label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <input type="checkbox" checked={form.is_default} onChange={set('is_default')} /> Set as default
            </label>
          </div>
          {err && <p className="msg err">{err}</p>}
          <div className="form-actions">
            <button className="btn" type="submit">Save address</button>
          </div>
        </form>
      )}

      {!list ? <p className="muted">Loading…</p> : !list.length ? (
        <p className="muted">No saved addresses yet.</p>
      ) : (
        <div className="addr-grid">
          {list.map(a => (
            <div key={a.id} className="addr-card">
              {a.is_default ? <span className="pill">Default</span> : null}
              {a.label ? <b>{a.label}</b> : null}
              <div>{a.full_name}</div>
              <div className="muted">{a.street}, {a.city}{a.state ? `, ${a.state}` : ''} {a.postal_code || ''}</div>
              <div className="muted">{a.country}{a.phone ? ` · ${a.phone}` : ''}</div>
              <button className="btn danger sm" onClick={() => remove(a.id)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}