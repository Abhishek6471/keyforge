import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import Navbar from './components/Navbar.jsx';
import './admin/admin.css';
import Home from './pages/Home.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Cart from './pages/Cart.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Orders from './pages/Orders.jsx';
import Wishlist from './pages/Wishlist.jsx';
import Addresses from './pages/Addresses.jsx';
import Account from './pages/Account.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import AdminLayout from './admin/AdminLayout.jsx';
import AdminDashboard from './admin/AdminDashboard.jsx';
import AdminOrders from './admin/AdminOrders.jsx';
import AdminProducts from './admin/AdminProducts.jsx';
import AdminUsers from './admin/AdminUsers.jsx';
import AdminReviews from './admin/AdminReviews.jsx';
import AdminInventory from './admin/AdminInventory.jsx';
import AdminEmailLogs from './admin/AdminEmailLogs.jsx';

// Guard: only allow logged-in admins into /admin
function RequireAdmin({ children }) {
  const { user, restoring } = useAuth();
  const location = useLocation();
  if (restoring) return <p className="muted" style={{ padding: '2rem' }}>Loading…</p>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!user.is_admin) return <Navigate to="/" replace />;
  return children;
}

function Storefront() {
  return (
    <>
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/product/:slug" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/addresses" element={<Addresses />} />
          <Route path="/account" element={<Account />} />
          <Route path="/verify" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset" element={<ResetPassword />} />
        </Routes>
      </main>
      <footer className="footer">
        <span>⌨ KeyForge — College project demo. Payments run in Stripe <b>test mode</b>; no real charges.</span>
      </footer>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            {/* Admin panel — own layout, guarded */}
            <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
              <Route index element={<AdminDashboard />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="reviews" element={<AdminReviews />} />
              <Route path="inventory" element={<AdminInventory />} />
              <Route path="emails" element={<AdminEmailLogs />} />
            </Route>

            {/* Storefront */}
            <Route path="*" element={<Storefront />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}