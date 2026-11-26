import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const fmt = c => `Rs. ${(c / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const CANCELLABLE = ['pending', 'confirmed', 'processing'];

export default function Orders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [msg, setMsg] = useState('');

  async function load() {
    const r = await fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setOrders(await r.json());
  }
  useEffect(() => { if (token) load(); }, [token]);

  async function cancel(id) {
    if (!window.confirm('Cancel this order? Stock will be restored.')) return;
    const r = await fetch(`/api/orders/${id}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    if (!r.ok) return setMsg(d.error || 'Cancel failed');
    setMsg('Order cancelled ✓');
    setTimeout(() => setMsg(''), 2500);
    load();
  }

  if (!token) return <p className="muted">Please <Link to="/login">log in</Link> to see your orders.</p>;
  if (!orders) return <p className="muted">Loading…</p>;
  if (!orders.length) return <p className="muted">No orders yet. <Link to="/">Start shopping →</Link></p>;

  return (
    <div>
      <h1>My Orders</h1>
      {msg && <p className="msg ok">{msg}</p>}
      {orders.map(o => {
        const canCancel = CANCELLABLE.includes(o.status);
        return (
          <div key={o.id} className="order">
            <div className="order-head">
              <b>{o.id}</b>
              <span className={`status s-${o.status}`}>{o.status}</span>
              <span className="muted">{new Date(o.created_at + 'Z').toLocaleString()}</span>
              <span className="muted">Pay: {(o.payment_method || 'cod').toUpperCase()} ({o.payment_status})</span>
              <span className="price">{fmt(o.total_cents)}</span>
            </div>

            <ul>
              {o.items.map((it, i) => (
                <li key={i}>
                  {it.qty}× {it.product_name}
                  {it.config_json && <small> — {Object.values(JSON.parse(it.config_json)).join(' · ')}</small>}
                  <small className="muted"> · {fmt(it.price_cents)}</small>
                </li>
              ))}
            </ul>

            {o.history && o.history.length > 0 && (
              <div className="track">
                <button className="link" onClick={() => setOpenId(openId === o.id ? null : o.id)}>
                  {openId === o.id ? 'Hide tracking ▴' : 'Track order ▾'}
                </button>
                {openId === o.id && (
                  <ol className="timeline">
                    {o.history.map((h, i) => (
                      <li key={i}>
                        <b className={`status s-${h.status}`}>{h.status}</b>
                        <span className="muted"> — {h.note || ''} · {new Date(h.created_at + 'Z').toLocaleString()}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            <div className="order-actions">
              {o.shipping_address && (
                <small className="muted">Ship to: {o.shipping_address}{o.shipping_city ? `, ${o.shipping_city}` : ''}</small>
              )}
              {canCancel && <button className="btn danger sm" onClick={() => cancel(o.id)}>Cancel order</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}