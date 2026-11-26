import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const CATS = ['all', 'keyboard', 'switch', 'keycap', 'accessory'];
const fmt = c => `Rs. ${(c / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function Home() {
  const [products, setProducts] = useState([]);
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (cat !== 'all') params.set('category', cat);
    if (q) params.set('q', q);
    setLoading(true);
    fetch(`/api/products?${params}`)
      .then(r => r.json())
      .then(setProducts)
      .finally(() => setLoading(false));
  }, [cat, q]);

  return (
    <>
      <section className="hero">
        <h1>Build your <span className="accent">perfect</span> board.</h1>
        <p>Premium mechanical keyboards, switches, keycaps &amp; accessories — fully customizable.</p>
      </section>

      <div className="toolbar">
        <div className="cats">
          {CATS.map(c => (
            <button key={c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>
              {c[0].toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
        <input className="search" placeholder="Search products…" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : products.length === 0 ? (
        <p className="muted">No products match.</p>
      ) : (
        <div className="grid">
          {products.map(p => (
            <Link to={`/product/${p.slug}`} key={p.id} className="card">
              <div className="card-img"><img src={p.image} alt={p.name} /></div>
              <div className="card-body">
                {p.badge && <span className="pill">{p.badge}</span>}
                <h3>{p.name}</h3>
                <p className="muted">{p.description.slice(0, 60)}…</p>
                <div className="card-foot">
                  <span className="price">{fmt(p.price_cents)}</span>
                  <span className="cat">{p.category}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}