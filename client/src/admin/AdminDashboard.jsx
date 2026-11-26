import React, { useEffect, useState } from 'react';
import { useAdminApi, fmt } from './adminApi.js';

export default function AdminDashboard() {
  const { req } = useAdminApi();
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    req('/api/admin/stats').then(setStats).catch(e => setErr(e.message));
  }, [req]);

  if (err) return <p className="msg err">{err}</p>;
  if (!stats) return <p className="muted">Loading…</p>;

  const cards = [
    { label: 'Revenue', value: fmt(stats.revenue), icon: '💰' },
    { label: 'Orders', value: stats.orders, icon: '📦' },
    { label: 'Customers', value: stats.users, icon: '👥' },
    { label: 'Products', value: stats.products, icon: '🏷' },
    { label: 'Reviews', value: stats.reviews, icon: '⭐' },
    { label: 'Pending orders', value: stats.pending, icon: '⏳' },
    { label: 'Completed', value: stats.completed, icon: '✅' },
    { label: 'Low stock', value: stats.lowStock, icon: '⚠️' }
  ];

  // Build a 14-day sales series (fill missing days with 0)
  const days = [];
  const byDay = Object.fromEntries((stats.salesSeries || []).map(d => [d.day, d]));
  for (let i = 13; i >= 0; i--) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    const key = dt.toISOString().slice(0, 10);
    days.push({ day: key, label: dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), ...(byDay[key] || { orders: 0, revenue: 0 }) });
  }
  const maxRev = Math.max(1, ...days.map(d => Number(d.revenue)));

  const bestSellers = stats.bestSellers || [];
  const maxQty = Math.max(1, ...bestSellers.map(b => Number(b.qty)));

  return (
    <div>
      <h1>Dashboard</h1>
      <div className="stat-grid">
        {cards.map(c => (
          <div key={c.label} className="stat-card">
            <div className="stat-icon">{c.icon}</div>
            <div>
              <div className="stat-value">{c.value}</div>
              <div className="stat-label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="charts-grid">
        <section className="panel chart-panel">
          <h2>Sales — last 14 days</h2>
          <div className="bar-chart">
            {days.map(d => (
              <div key={d.day} className="bar-col" title={`${d.label}: ${fmt(Number(d.revenue))} (${d.orders} orders)`}>
                <div className="bar" style={{ height: `${(Number(d.revenue) / maxRev) * 100}%` }} />
                <span className="bar-label">{d.label.split(' ')[1]}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel chart-panel">
          <h2>Best-selling products</h2>
          {bestSellers.length ? (
            <ul className="best-list">
              {bestSellers.map(b => (
                <li key={b.product_name}>
                  <span className="best-name">{b.product_name}</span>
                  <span className="best-bar-wrap">
                    <span className="best-bar" style={{ width: `${(Number(b.qty) / maxQty) * 100}%` }} />
                  </span>
                  <span className="best-qty">{b.qty} sold · {fmt(Number(b.revenue))}</span>
                </li>
              ))}
            </ul>
          ) : <p className="muted">No sales yet.</p>}
        </section>
      </div>

      {stats.pendingReviews > 0 && (
        <div className="warn-banner">
          ⭐ {stats.pendingReviews} review(s) awaiting approval — <a href="/admin/reviews" style={{ color: 'inherit' }}>moderate now →</a>
        </div>
      )}
    </div>
  );
}