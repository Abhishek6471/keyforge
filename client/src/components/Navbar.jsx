import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();

  return (
    <nav className="navbar">
      <Link to="/" className="brand">⌨ Key<span>Forge</span></Link>
      <div className="nav-links">
        <NavLink to="/" end>Shop</NavLink>
        <NavLink to="/cart">Cart{count > 0 && <span className="badge">{count}</span>}</NavLink>
        {user && <NavLink to="/orders">Orders</NavLink>}
        {user && <NavLink to="/wishlist">Wishlist</NavLink>}
        {user?.is_admin ? <NavLink to="/admin">Admin</NavLink> : null}
      </div>
      <div className="nav-right">
        {user ? (
          <>
            <Link to="/account" className="who">Hi, {user.name.split(' ')[0]}</Link>
            <button className="btn ghost sm" onClick={logout}>Log out</button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn ghost sm">Log in</Link>
            <Link to="/register" className="btn sm">Sign up</Link>
          </>
        )}
      </div>
    </nav>
  );
}