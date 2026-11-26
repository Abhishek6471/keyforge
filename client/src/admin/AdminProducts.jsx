import React, { useEffect, useState } from 'react';
import { useAdminApi, fmt } from './adminApi.js';

const CATEGORIES = ['keyboard', 'switch', 'keycap', 'accessory'];
const CAT_LABELS = { keyboard: 'Keyboard', switch: 'Switches', keycap: 'Keycaps', accessory: 'Accessories' };
const LAYOUTS = ['60%', '65%', '75%', 'TKL', 'Full-size'];

const EMPTY = {
  slug: '', name: '', category: 'keyboard', description: '',
  price: '', compare_at: '', image: '', badge: '', stock: 50,
  featured: false, available: true,
  layout: '', switch_type: '', switch_brand: '', keycap_material: '',
  connectivity: '', hot_swap: false, rgb: false, color: '', config: ''
};

export default function AdminProducts() {
  const { req } = useAdminApi();
  const [products, setProducts] = useState(null);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');

  async function load() {
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (catFilter !== 'all') params.set('category', catFilter);
      setProducts(await req(`/api/admin/products?${params.toString()}`));
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { const t = setTimeout(load, search ? 300 : 0); return () => clearTimeout(t); }, [req, search, catFilter]);

  function startNew() { setEditing({ ...EMPTY }); setIsNew(true); }
  function startEdit(p) {
    setEditing({
      ...EMPTY, ...p,
      price: (p.price_cents / 100).toString(),
      compare_at: p.compare_at_cents ? (p.compare_at_cents / 100).toString() : '',
      config: p.config ? JSON.stringify(p.config, null, 2) : '',
      hot_swap: !!p.hot_swap, rgb: !!p.rgb, featured: !!p.featured, available: !!p.available
    });
    setIsNew(false);
  }

  function set(k) { return e => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setEditing({ ...editing, [k]: v });
  };}

  async function save(e) {
    e.preventDefault(); setErr('');
    const b = editing;
    let config = null;
    if (b.config.trim()) {
      try { config = JSON.parse(b.config); }
      catch { return setErr('Config must be valid JSON.'); }
    }
    const payload = {
      slug: b.slug, name: b.name, category: b.category, description: b.description,
      price_cents: Math.round(parseFloat(b.price) * 100),
      compare_at_cents: b.compare_at ? Math.round(parseFloat(b.compare_at) * 100) : null,
      image: b.image, badge: b.badge || null, stock: Number(b.stock),
      featured: b.featured, available: b.available,
      layout: b.layout || null, switch_type: b.switch_type || null, switch_brand: b.switch_brand || null,
      keycap_material: b.keycap_material || null, connectivity: b.connectivity || null,
      hot_swap: b.hot_swap, rgb: b.rgb, color: b.color || null, config
    };
    try {
      if (isNew) await req('/api/admin/products', 'POST', payload);
      else await req(`/api/admin/products/${editing.id}`, 'PUT', payload);
      setEditing(null); load();
    } catch (er) { setErr(er.message); }
  }

  async function remove(p) {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try { await req(`/api/admin/products/${p.id}`, 'DELETE'); load(); }
    catch (er) { setErr(er.message); }
  }

  async function toggleAvail(p) {
    try { await req(`/api/admin/products/${p.id}/availability`, 'PUT', { available: !p.available }); load(); }
    catch (er) { setErr(er.message); }
  }

  if (!products && !editing) return <p className="muted">Loading…</p>;

  return (
    <div>
      <div className="admin-head">
        <h1>Products</h1>
        <div className="filters">
          <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="all">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
          </select>
          <button className="btn" onClick={startNew}>+ Add product</button>
        </div>
      </div>

      {editing && (
        <form className="admin-form" onSubmit={save}>
          <h2>{isNew ? 'New product' : `Edit: ${editing.name}`}</h2>
          <div className="form-row">
            <label>Slug <input value={editing.slug} onChange={set('slug')} disabled={!isNew} required placeholder="nova75" /></label>
            <label>Name <input value={editing.name} onChange={set('name')} required /></label>
          </div>
          <div className="form-row">
            <label>Category
              <select value={editing.category} onChange={set('category')}>
                {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
              </select>
            </label>
            <label>Price (Rs.) <input type="number" min="0" step="0.01" value={editing.price} onChange={set('price')} required /></label>
            <label>Compare-at (Rs.) <input type="number" min="0" step="0.01" value={editing.compare_at} onChange={set('compare_at')} placeholder="optional" /></label>
          </div>
          <div className="form-row">
            <label>Stock <input type="number" min="0" value={editing.stock} onChange={set('stock')} /></label>
            <label>Image URL <input value={editing.image} onChange={set('image')} placeholder="/images/nova75.jpg" /></label>
            <label>Badge <input value={editing.badge || ''} onChange={set('badge')} placeholder="New / Hot (optional)" /></label>
          </div>
          <label>Description <textarea rows="2" value={editing.description} onChange={set('description')} /></label>

          <h3 style={{ margin: '.5rem 0 .3rem', fontSize: '.95rem' }}>Keyboard attributes (optional)</h3>
          <div className="form-row">
            <label>Layout
              <select value={editing.layout || ''} onChange={set('layout')}>
                <option value="">—</option>
                {LAYOUTS.map(l => <option key={l}>{l}</option>)}
              </select>
            </label>
            <label>Switch type <input value={editing.switch_type || ''} onChange={set('switch_type')} placeholder="Linear / Tactile / Clicky" /></label>
            <label>Switch brand <input value={editing.switch_brand || ''} onChange={set('switch_brand')} /></label>
          </div>
          <div className="form-row">
            <label>Keycap material <input value={editing.keycap_material || ''} onChange={set('keycap_material')} placeholder="PBT / ABS" /></label>
            <label>Connectivity <input value={editing.connectivity || ''} onChange={set('connectivity')} placeholder="Wired / 2.4G / Bluetooth" /></label>
            <label>Color <input value={editing.color || ''} onChange={set('color')} /></label>
          </div>
          <div className="form-row" style={{ gap: '1.5rem', alignItems: 'center' }}>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: '.4rem' }}>
              <input type="checkbox" checked={editing.hot_swap} onChange={set('hot_swap')} /> Hot-swap
            </label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: '.4rem' }}>
              <input type="checkbox" checked={editing.rgb} onChange={set('rgb')} /> RGB
            </label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: '.4rem' }}>
              <input type="checkbox" checked={editing.featured} onChange={set('featured')} /> Featured
            </label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: '.4rem' }}>
              <input type="checkbox" checked={editing.available} onChange={set('available')} /> Available
            </label>
          </div>

          <label>Configurator options (JSON, optional)
            <textarea rows="4" value={editing.config} onChange={set('config')}
                      placeholder='{"switch":[{"id":"linear","name":"Linear","add_cents":0}]}' />
          </label>

          {err && <p className="msg err">{err}</p>}
          <div className="form-actions">
            <button className="btn" type="submit">Save</button>
            <button className="btn ghost" type="button" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      {!products ? <p className="muted">Loading…</p> : !products.length ? <p className="muted">No products match.</p> : (
        <table className="admin-table">
          <thead>
            <tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Flags</th><th>Available</th><th></th></tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id}>
                <td><img className="thumb" src={p.image} alt="" /></td>
                <td><b>{p.name}</b><br /><small className="muted">{p.slug}</small></td>
                <td>{CAT_LABELS[p.category] || p.category}</td>
                <td>{fmt(p.price_cents)}</td>
                <td className={p.stock <= 10 ? 'low-stock' : ''}>{p.stock}</td>
                <td>
                  {p.featured ? '⭐' : ''} {p.hot_swap ? '🔥' : ''} {p.rgb ? '🌈' : ''} {p.badge ? <span className="pill">{p.badge}</span> : ''}
                </td>
                <td>
                  <button className="link" onClick={() => toggleAvail(p)}>{p.available ? '✅' : '⛔'}</button>
                </td>
                <td className="actions">
                  <button className="btn ghost sm" onClick={() => startEdit(p)}>Edit</button>
                  <button className="btn danger sm" onClick={() => remove(p)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}