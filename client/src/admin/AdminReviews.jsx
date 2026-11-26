import React, { useEffect, useState } from 'react';
import { useAdminApi } from './adminApi.js';

export default function AdminReviews() {
  const { req } = useAdminApi();
  const [reviews, setReviews] = useState(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('');

  async function load() {
    try {
      const q = filter ? `?rating=${filter}` : '';
      setReviews(await req(`/api/admin/reviews${q}`));
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, [req, filter]);

  async function moderate(id, approved) {
    try { await req(`/api/admin/reviews/${id}`, 'PUT', { approved }); load(); }
    catch (e) { setErr(e.message); }
  }
  async function remove(id) {
    if (!window.confirm('Delete this review?')) return;
    try { await req(`/api/admin/reviews/${id}`, 'DELETE'); load(); }
    catch (e) { setErr(e.message); }
  }

  if (err) return <p className="msg err">{err}</p>;
  if (!reviews) return <p className="muted">Loading…</p>;

  const pending = reviews.filter(r => !r.approved).length;

  return (
    <div>
      <div className="admin-head">
        <h1>Reviews</h1>
        <div className="filters">
          <span className="muted">{pending} pending approval</span>
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">All ratings</option>
            {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} ★</option>)}
          </select>
        </div>
      </div>

      {!reviews.length ? <p className="muted">No reviews yet.</p> : (
        <table className="admin-table">
          <thead>
            <tr><th>Product</th><th>User</th><th>Rating</th><th>Comment</th><th>Status</th><th>Date</th><th></th></tr>
          </thead>
          <tbody>
            {reviews.map(r => (
              <tr key={r.id}>
                <td>{r.product_name}</td>
                <td>{r.user_name}</td>
                <td><span className="stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span></td>
                <td style={{ maxWidth: '280px' }}>{r.comment || <span className="muted">—</span>}</td>
                <td>
                  <span className={`status ${r.approved ? 's-delivered' : 's-cancelled'}`}>
                    {r.approved ? 'approved' : 'pending'}
                  </span>
                </td>
                <td><small className="muted">{new Date(r.created_at + 'Z').toLocaleDateString()}</small></td>
                <td className="actions">
                  {!r.approved && <button className="btn sm" onClick={() => moderate(r.id, true)}>Approve</button>}
                  {r.approved && <button className="btn ghost sm" onClick={() => moderate(r.id, false)}>Unpublish</button>}
                  <button className="btn danger sm" onClick={() => remove(r.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}