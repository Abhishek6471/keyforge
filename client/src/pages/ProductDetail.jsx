import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const fmt = c => `Rs. ${(c / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function ProductDetail() {
  const { slug } = useParams();
  const nav = useNavigate();
  const { add } = useCart();
  const { user } = useAuth();
  const [p, setP] = useState(null);
  const [choices, setChoices] = useState({});
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState('');
  const [reviews, setReviews] = useState([]);
  const [revForm, setRevForm] = useState({ rating: 5, comment: '' });
  const [revMsg, setRevMsg] = useState(null);

  useEffect(() => {
    fetch(`/api/products/${slug}`)
      .then(r => r.json())
      .then(prod => {
        setP(prod);
        if (prod.config) {
          const init = {};
          for (const [k, opts] of Object.entries(prod.config)) init[k] = opts[0].id;
          setChoices(init);
        }
      });
    fetch(`/api/products/${slug}/reviews`)
      .then(r => r.json())
      .then(setReviews)
      .catch(() => setReviews([]));
  }, [slug]);

  if (!p) return <p className="muted">Loading…</p>;

  const extra = () => {
    if (!p.config) return 0;
    let s = 0;
    for (const [k, opts] of Object.entries(p.config)) {
      const opt = opts.find(o => o.id === choices[k]);
      if (opt) s += opt.add_cents;
    }
    return s;
  };
  const unit = p.price_cents + extra();

  async function handleAdd() {
    if (!user) { nav('/login'); return; }
    try {
      await add(p.id, p.config ? choices : null, qty);
      setMsg('Added to cart ✓');
      setTimeout(() => setMsg(''), 2000);
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function submitReview(e) {
    e.preventDefault();
    setRevMsg(null);
    const r = await fetch(`/api/products/${slug}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token || localStorage.getItem('kf_token')}` },
      body: JSON.stringify(revForm)
    });
    const d = await r.json();
    setRevMsg({ ok: r.ok, text: d.message || d.error || 'Done.' });
    if (r.ok) setRevForm({ rating: 5, comment: '' });
  }

  return (
    <>
    <div className="detail">
      <div className="detail-img"><img src={p.image} alt={p.name} /></div>
      <div className="detail-info">
        {p.badge && <span className="pill">{p.badge}</span>}
        <h1>{p.name}</h1>
        <p className="cat-line">{p.category}</p>
        <p className="desc">{p.description}</p>
        <p className="price big">{fmt(unit)}</p>

        {p.config && (
          <div className="configurator">
            <h3>Configure your board</h3>
            {Object.entries(p.config).map(([key, opts]) => (
              <div key={key} className="opt-group">
                <label>{key[0].toUpperCase() + key.slice(1)}</label>
                <div className="opts">
                  {opts.map(o => (
                    <button
                      key={o.id}
                      className={`chip ${choices[key] === o.id ? 'active' : ''}`}
                      onClick={() => setChoices({ ...choices, [key]: o.id })}
                    >
                      {o.name}{o.add_cents ? ` (${o.add_cents > 0 ? '+' : ''}${fmt(o.add_cents)})` : ''}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="buy-row">
          <div className="qty">
            <button onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
            <span>{qty}</span>
            <button onClick={() => setQty(qty + 1)}>+</button>
          </div>
          <button className="btn" onClick={handleAdd}>Add to cart · {fmt(unit * qty)}</button>
        </div>
        {msg && <p className="msg">{msg}</p>}
      </div>
    </div>

    <section className="reviews">
      <h2>Reviews {p.review_count ? `(${p.review_count})` : ''}</h2>
      {p.rating ? <p className="muted">Average rating: {'★'.repeat(Math.round(p.rating))}{'☆'.repeat(5 - Math.round(p.rating))} {p.rating}/5</p> : <p className="muted">No ratings yet.</p>}

      {user && (
        <form className="review-form" onSubmit={submitReview}>
          <h3>Write a review</h3>
          <div className="star-picker">
            {[1, 2, 3, 4, 5].map(n => (
              <button type="button" key={n} className={`star ${revForm.rating >= n ? 'on' : ''}`}
                      onClick={() => setRevForm({ ...revForm, rating: n })}>★</button>
            ))}
          </div>
          <textarea rows="3" placeholder="Share your thoughts (purchased items only)…"
                    value={revForm.comment} onChange={e => setRevForm({ ...revForm, comment: e.target.value })} />
          <button className="btn sm">Submit review</button>
          {revMsg && <p className={`msg ${revMsg.ok ? 'ok' : 'err'}`}>{revMsg.text}</p>}
        </form>
      )}

      {reviews.length ? (
        <ul className="review-list">
          {reviews.map(r => (
            <li key={r.id} className="review">
              <div className="rev-head">
                <b>{r.user_name}</b>
                <span className="stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                <span className="muted sm">{new Date(r.created_at + 'Z').toLocaleDateString()}</span>
              </div>
              {r.comment && <p>{r.comment}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No reviews yet. Be the first to review!</p>
      )}
    </section>
    </>
  );
}