import React, { useEffect, useState } from 'react';
import { useAdminApi, fmt } from './adminApi.js';

const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

export default function AdminOrders() {
  const { req } = useAdminApi();
  const [orders, setOrders] = useState(null);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  async function load() {
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      setOrders(await req(`/api/admin/orders?${params.toString()}`));
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { const t = setTimeout(load, search ? 300 : 0); return () => clearTimeout(t); }, [req, search, statusFilter]);

  async function setStatus(id, status) {
    try { await req(`/api/admin/orders/${id}`, 'PUT', { status }); load(); }
    catch (e) { setErr(e.message); }
  }

  if (err) return <p className="msg err">{err}</p>;
  if (!orders) return <p className="muted">Loading…</p>;
  if (!orders.length) return <p className="muted">No orders match.</p>;

  return (
    <div>
      <div className="admin-head">
        <h1>Orders</h1>
        <div className="filters">
          <input placeholder="Search ID / name / email…" value={search} onChange={e => setSearch(e.target.value)} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <table className="admin-table">
        <thead>
          <tr><th>Order ID</th><th>Customer</th><th>Items</th><th>Payment</th><th>Total</th><th>Status</th><th>Change</th></tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <React.Fragment key={o.id}>
              <tr>
                <td><b>{o.id}</b><br /><small className="muted">{new Date(o.created_at + 'Z').toLocaleDateString()}</small></td>
                <td>{o.customer_name}<br /><small className="muted">{o.customer_email}</small></td>
                <td>
                  <button className="link" onClick={() => setOpenId(openId === o.id ? null : o.id)}>
                    {o.items.reduce((s, i) => s + i.qty, 0)} item(s) ▾
                  </button>
                </td>
                <td><small>{(o.payment_method || 'cod').toUpperCase()}<br />{o.payment_status}</small></td>
                <td>{fmt(o.total_cents)}</td>
                <td><span className={`status s-${o.status}`}>{o.status}</span></td>
                <td>
                  <select value={o.status} onChange={e => setStatus(o.id, e.target.value)}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
              {openId === o.id && (
                <tr className="detail-row">
                  <td colSpan="7">
                    <div className="detail-cols">
                      <div>
                        <b>Items</b>
                        <ul>
                          {o.items.map((it, i) => (
                            <li key={i}>
                              {it.qty}× {it.product_name} — {fmt(it.price_cents)}
                              {it.config_json && <small> ({Object.values(JSON.parse(it.config_json)).join(', ')})</small>}
                            </li>
                          ))}
                        </ul>
                        {o.shipping_address && <small className="muted">Ship to: {o.shipping_address}{o.shipping_city ? `, ${o.shipping_city}` : ''}</small>}
                      </div>
                      <div>
                        <b>Status history</b>
                        <ol className="timeline">
                          {(o.history || []).map((h, i) => (
                            <li key={i}>
                              <b className={`status s-${h.status}`}>{h.status}</b>
                              <small className="muted"> {h.note || ''} · {new Date(h.created_at + 'Z').toLocaleString()}</small>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}