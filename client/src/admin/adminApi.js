import { useAuth } from '../context/AuthContext.jsx';

// Helper hook returning an authenticated fetch bound to the logged-in admin token.
export function useAdminApi() {
  const { token, logout } = useAuth();

  async function req(path, method = 'GET', body = null) {
    const res = await fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : null
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error('Not authorized');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  return { req, logout };
}

export const fmt = c => `Rs. ${(c / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;