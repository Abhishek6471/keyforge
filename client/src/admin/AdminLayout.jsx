import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  function handleLogout() {
    logout();
    nav('/');
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">⌨ Key<span>Forge</span> <em>Admin</em></div>
        <nav>
          <NavLink to="/admin" end>📊 Dashboard</NavLink>
          <NavLink to="/admin/orders">📦 Orders</NavLink>
          <NavLink to="/admin/products">🏷 Products</NavLink>
          <NavLink to="/admin/inventory">📋 Inventory</NavLink>
          <NavLink to="/admin/reviews">⭐ Reviews</NavLink>
          <NavLink to="/admin/users">👥 Users</NavLink>
          <NavLink to="/admin/emails">✉️ Emails</NavLink>
        </nav>
        <div className="admin-side-foot">
          <span>{user?.email}</span>
          <button className="btn ghost sm" onClick={handleLogout}>Log out</button>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}