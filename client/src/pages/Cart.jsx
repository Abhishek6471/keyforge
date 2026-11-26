import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const fmt = c => `Rs. ${(c / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function Cart() {
  const { items, total, remove, checkout } = useCart();
  const { token, user } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState('');

  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState('');
  const [ship, setShip] = useState({ name: '', phone: '', address: '', city: '', postal: '' });
  const [useSaved, setUseSaved] = useState(!!addresses.length);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [discountCode, setDiscountCode] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch('/api/addresses', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(a => {
        setAddresses(a);
        if (a.length) { setAddressId(a[0].id); setUseSaved(true); }
      })
      .catch(() => {});
  }, [token]);

  function pickSaved(id) {
    setAddressId(id);
    const a = addresses.find(x => x.id === id);
    if (a) setShip({ name: a.full_name, phone: a.phone || '', address: `${a.street}, ${a.city}`, city: a.city, postal: a.postal_code || '' });
  }

  function setS(k) { return e => setShip({ ...ship, [k]: e.target.value }); }

  async function handleCheckout() {
    setBusy(true); setErr('');
    try {
      const payload = { paymentMethod, discountCode: discountCode || null };
      if (useSaved && addressId) payload.addressId = addressId;
      else payload.shipping = ship;
      const res = await checkout(payload);
      setDone(res);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!user) return <p className="muted">Please <Link to="/login">log in</Link> to view your cart.</p>;
  if (done) return (
    <div className="success">
      <h2>🎉 Order placed!</h2>
      <p>Order ID: <b>{done.orderId}</b></p>
      <p>Total: <b>{fmt(done.total)}</b></p>
      <p className="muted">Payment method: {paymentMethod.toUpperCase()}</p>
      <p className="muted">A confirmation email has been {done.email?.mode === 'smtp' ? 'sent' : 'queued (log mode)'} to your inbox.</p>
      <Link to="/orders" className="btn">View my orders</Link>
    </div>
  );
  if (!items.length) return <p className="muted">Your cart is empty. <Link to="/">Go shopping →</Link></p>;

  const shipping = total >= 500000 ? 0 : 20000;
  const discount = discountCode.toUpperCase() === 'KEYFORGE10' ? Math.round(total * 0.10) : 0;
  const grand = Math.max(0, total + shipping - discount);

  return (
    <div>
      <h1>Your Cart</h1>
      <div className="cart-list">
        {items.map(it => (
          <div key={it.cartId} className="cart-item">
            <img src={it.product.image} alt={it.product.name} />
            <div className="ci-info">
              <b>{it.product.name}</b>
              {it.config && <small>{Object.values(it.config).join(' · ')}</small>}
              <span className="muted">Qty {it.qty}</span>
            </div>
            <div className="ci-right">
              <span className="price">{fmt((it.unit_price ?? it.product.price_cents) * it.qty)}</span>
              <button className="btn ghost sm" onClick={() => remove(it.cartId)}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      <div className="checkout-grid">
        <section className="panel">
          <h2>Shipping details</h2>
          {addresses.length > 0 && (
            <div className="saved-picker">
              <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                <input type="checkbox" checked={useSaved} onChange={e => setUseSaved(e.target.checked)} />
                Use a saved address
              </label>
              {useSaved && (
                <select value={addressId} onChange={e => pickSaved(e.target.value)}>
                  {addresses.map(a => <option key={a.id} value={a.id}>{a.label || 'Address'} — {a.full_name}, {a.city}</option>)}
                </select>
              )}
            </div>
          )}
          {(!useSaved || !addresses.length) && (
            <div className="stack">
              <div className="form-row">
                <input placeholder="Full name" value={ship.name} onChange={setS('name')} />
                <input placeholder="Phone" value={ship.phone} onChange={setS('phone')} />
              </div>
              <input placeholder="Street address" value={ship.address} onChange={setS('address')} />
              <div className="form-row">
                <input placeholder="City" value={ship.city} onChange={setS('city')} />
                <input placeholder="Postal code" value={ship.postal} onChange={setS('postal')} />
              </div>
            </div>
          )}

          <h2 style={{ marginTop: '1.5rem' }}>Payment method</h2>
          <div className="pay-options">
            <label className={`pay-opt ${paymentMethod === 'cod' ? 'active' : ''}`}>
              <input type="radio" name="pay" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
              <span>💵 Cash on Delivery</span>
            </label>
            <label className={`pay-opt ${paymentMethod === 'stripe' ? 'active' : ''}`}>
              <input type="radio" name="pay" checked={paymentMethod === 'stripe'} onChange={() => setPaymentMethod('stripe')} />
              <span>💳 Card (Stripe test mode)</span>
            </label>
          </div>
        </section>

        <div className="cart-summary">
          <div><span>Subtotal</span><b>{fmt(total)}</b></div>
          <div><span>Shipping</span><b>{shipping === 0 ? 'FREE' : fmt(shipping)}</b></div>
          {discount > 0 && <div className="good"><span>Discount (KEYFORGE10)</span><b>−{fmt(discount)}</b></div>}
          <div className="grand"><span>Total</span><b>{fmt(grand)}</b></div>

          <div className="discount-row">
            <input placeholder="Discount code" value={discountCode} onChange={e => setDiscountCode(e.target.value)} />
          </div>
          <p className="muted sm">Try code <b>KEYFORGE10</b> for 10% off.</p>

          <button className="btn wide" onClick={handleCheckout} disabled={busy}>
            {busy ? 'Placing order…' : paymentMethod === 'stripe' ? 'Pay with Card (test)' : 'Place order (COD)'}
          </button>
          {err && <p className="msg err">{err}</p>}
          {paymentMethod === 'stripe' && <p className="muted sm">Card payments run in Stripe test mode — no real charge.</p>}
        </div>
      </div>
    </div>
  );
}