import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext.jsx';

const CartCtx = createContext(null);
const API = '/api';

export function CartProvider({ children }) {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) refresh();
    else setItems([]);
  }, [token]);

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/cart`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setItems(await r.json());
    } finally {
      setLoading(false);
    }
  }

  async function add(productId, config = null, qty = 1) {
    if (!token) throw new Error('Please log in to add items');
    await fetch(`${API}/cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ productId, config, qty })
    });
    await refresh();
  }

  async function remove(cartId) {
    await fetch(`${API}/cart/${cartId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    await refresh();
  }

  async function checkout(opts = {}) {
    const r = await fetch(`${API}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(opts)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Checkout failed');
    await refresh();
    return data;
  }

  const count = items.reduce((s, i) => s + i.qty, 0);
  const total = items.reduce((s, i) => s + (i.unit_price ?? i.product.price_cents) * i.qty, 0);

  return (
    <CartCtx.Provider value={{ items, count, total, loading, add, remove, checkout, refresh }}>
      {children}
    </CartCtx.Provider>
  );
}

export const useCart = () => useContext(CartCtx);