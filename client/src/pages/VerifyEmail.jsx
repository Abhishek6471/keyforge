import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

// Email verification landing page (opened from the verification email link)
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState({ loading: true, ok: false, msg: '' });

  useEffect(() => {
    if (!token) { setState({ loading: false, ok: false, msg: 'Missing verification token.' }); return; }
    fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) setState({ loading: false, ok: true, msg: `Your email ${d.email} is now verified!` });
        else setState({ loading: false, ok: false, msg: d.error || 'Verification failed.' });
      })
      .catch(() => setState({ loading: false, ok: false, msg: 'Network error.' }));
  }, [token]);

  return (
    <div className="auth" style={{ textAlign: 'center' }}>
      <h1>Email Verification</h1>
      {state.loading ? <p className="muted">Verifying…</p> : (
        <>
          <p className={`msg ${state.ok ? 'ok' : 'err'}`}>{state.msg}</p>
          <Link to="/" className="btn">Continue shopping</Link>
        </>
      )}
    </div>
  );
}