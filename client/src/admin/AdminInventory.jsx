import React, { useEffect, useState } from 'react';
import { useAdminApi, fmt } from './adminApi.js';

export default function AdminInventory() {
  const { req } = useAdminApi();
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  const [restock, setRestock] = useState({}); // { productId: amount }
  const [movements, setMovements] = useState(null); // for selected product
  const [selId, setSelId] = useState(null);

  async function load() {
    try { setItems(await req('/api/admin/inventory')); }
    catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, [req]);

  async function doRestock(id) {
    const change = Number(restock[id]);
    if (!change) return;
    try {
      await req(`/api/admin/inventory/${id}/restock`, 'POST', { change });
      setRestock({ ...restock, [id]: '' });
      load();
      if (selId === id) showMovements(id);
    } catch (e) { setErr(e.message); }
  }

  async function toggleAvailability(id, available) {
    try { await req(`/api/admin/products/${id}/availability`, 'PUT', { available }); load(); }
    catch (e) { setErr(e.message); }
  }

  async function showMovements(id) {
    setSelId(selId === id ? null : id);
    if (selId !== id) {
      try { setMovements(await req(`/api/admin/inventory/${id}/movements`)); }
      catch (e) { setErr(e.message); }
    }
  }

  if (err) return <p className="msg err">{err}</p>;
  if (!items) return <p className="muted">Loading…</p>;

  const lowStock = items.filter(p => p.stock <= 10);

  return (
    <div>
      <div className="admin-head">
        <h1>Inventory</h1>
        <span className="muted">{lowStock.length} low-stock product(s)</span>
      </div>

      <table className="admin-table">
        <thead>
          <tr><th>Product</th><th>Stock</th><th>Status</th><th>Restock (+/−)</th><th>Available</th><th></th></tr>
        </thead>
        <tbody>
          {items.map(p => (
            <React.Fragment key={p.id}>
              <tr>
                <td><b>{p.name}</b><br /><small className="muted">{p.slug}</small></td>
                <td><span className={p.stock <= 10 ? 'low-stock' : ''}>{p.stock}</span></td>
                <td>
                  <span className={`status ${p.stock === 0 ? 's-cancelled' : p.stock <= 10 ? 's-shipped' : 's-delivered'}`}>
                    {p.stock === 0 ? 'out of stock' : p.stock <= 10 ? 'low' : 'in stock'}
                  </span>
                </td>
                <td>
                  <div className="restock-row">
                    <input type="number" placeholder="±qty" value={restock[p.id] ?? ''}
                           onChange={e => setRestock({ ...restock, [p.id]: e.target.value })} style={{ width: '80px' }} />
                    <button className="btn sm" onClick={() => doRestock(p.id)}>Apply</button>
                  </div>
                </td>
                <td>
                  <button className="link" onClick={() => toggleAvailability(p.id, !p.available)}>
                    {p.available ? '✅ Available' : '⛔ Hidden'}
                  </button>
                </td>
                <td><button className="btn ghost sm" onClick={() => showMovements(p.id)}>History</button></td>
              </tr>
              {selId === p.id && movements && (
                <tr className="detail-row">
                  <td colSpan="6">
                    <b>Movement history — {p.name}</b>
                    {movements.length ? (
                      <ul>
                        {movements.map(m => (
                          <li key={m.id}>
                            <span className={m.change > 0 ? 'good' : 'bad'}>
                              {m.change > 0 ? '+' : ''}{m.change}
                            </span> — {m.reason}
                            {m.reference ? ` (${m.reference})` : ''} · {new Date(m.created_at + 'Z').toLocaleString()}
                          </li>
                        ))}
                      </ul>
                    ) : <p className="muted">No movements recorded.</p>}
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