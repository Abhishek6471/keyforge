import React, { useEffect, useState } from 'react';
import { useAdminApi, fmt } from './adminApi.js';

export default function AdminUsers() {
  const { req } = useAdminApi();
  const [users, setUsers] = useState(null);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');

  async function load() {
    try {
      const q = search ? `?q=${encodeURIComponent(search)}` : '';
      setUsers(await req(`/api/admin/users${q}`));
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { const t = setTimeout(load, search ? 300 : 0); return () => clearTimeout(t); }, [req, search]);

  async function toggleActive(u) {
    try { await req(`/api/admin/users/${u.id}/active`, 'PUT', { active: !u.is_active }); load(); }
    catch (e) { setErr(e.message); }
  }

  if (err) return <p className="msg err">{err}</p>;
  if (!users) return <p className="muted">Loading…</p>;

  return (
    <div>
      <div className="admin-head">
        <h1>Users</h1>
        <div className="filters">
          <input placeholder="Search name / email…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <table className="admin-table">
        <thead>
          <tr><th>Name</th><th>Email</th><th>Role</th><th>Verified</th><th>Orders</th><th>Total spent</th><th>Joined</th><th>Status</th></tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td><b>{u.name}</b></td>
              <td>{u.email}</td>
              <td>{u.is_admin ? <span className="role-admin">Admin</span> : 'Customer'}</td>
              <td>{u.email_verified ? '✅' : '⚠️'}</td>
              <td>{u.order_count}</td>
              <td>{fmt(u.total_spent)}</td>
              <td><small className="muted">{new Date(u.created_at + 'Z').toLocaleDateString()}</small></td>
              <td>
                {u.is_admin ? <span className="muted">—</span> : (
                  <button className={`btn sm ${u.is_active ? 'ghost' : ''}`} onClick={() => toggleActive(u)}>
                    {u.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}