import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

const fmt = c => `Rs. ${(c / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function Wishlist() {
  const { token } = useAuth();
  const { add } = useCart();
  const [items, setItems] = useState(null);
  const [msg, setMsg] = useState('');

  async function load() {
    const r = await fetch('/api/wishlist', { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setItems(await r.json());
  }
  useEffect(() => { if (token) load(); }, [token]);

  async function toggleWish(productId) {
    await fetch(`/api/wishlist/${productId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    load();
  }
  async function moveToCart(p) {
    try {
      await add(p.id, null, 1);
      await toggleWish(p.id);
      setMsg(`Moved "${p.name}" to cart ✓`);
      setTimeout(() => setMsg(''), 2000);
    } catch (e) { setMsg(e.message); }
  }

  if (!token) return <p className="muted">Please <Link to="/login">log in</Link> to view your wishlist.</p>;
  if (!items) return <p className="muted">Loading…</p>;
  if (!items.length) return <p className="muted">Your wishlist is empty. <Link to="/">Browse products →</Link></p>;

  return (
    <div>
      <h1>My Wishlist</h1>
      {msg && <p className="msg ok">{msg}</p>}
      <div className="grid">
        {items.map(p => (
          <div key={p.id} className="card">
            <Link to={`/product/${p.slug}`}><img src={p.image} alt={p.name} /></Link>
            <h3><Link to={`/product/${p.slug}`}>{p.name}</Link></h3>
            <p className="price">{fmt(p.price_cents)}</p>
            <div className="card-actions">
              <button className="btn sm" onClick={() => moveToCart(p)}>Add to cart</button>
              <button className="btn ghost sm" onClick={() => toggleWish(p.id)}>Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}