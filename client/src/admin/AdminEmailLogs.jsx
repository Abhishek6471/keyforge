import React, { useEffect, useState } from 'react';
import { useAdminApi } from './adminApi.js';

export default function AdminEmailLogs() {
  const { req } = useAdminApi();
  const [logs, setLogs] = useState(null);
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    req('/api/admin/email-logs').then(setLogs).catch(e => setErr(e.message));
    req('/api/admin/mailer-status').then(setStatus).catch(() => {});
  }, [req]);

  if (err) return <p className="msg err">{err}</p>;
  if (!logs) return <p className="muted">Loading…</p>;

  const badge = (s) => {
    if (s === 'sent') return <span className="status s-delivered">sent</span>;
    if (s === 'failed') return <span className="status s-cancelled">failed</span>;
    return <span className="status s-shipped">logged</span>;
  };

  return (
    <div>
      <div className="admin-head">
        <h1>Email Notifications</h1>
        <div className="filters">
          {status && (
            <span className={`status ${status.mode === 'smtp' ? 's-delivered' : 's-shipped'}`}>
              {status.mode === 'smtp' ? `SMTP active — ${status.from}` : 'LOG MODE (no SMTP configured)'}
            </span>
          )}
        </div>
      </div>

      {status?.mode !== 'smtp' && (
        <div className="warn-banner">
          ⚠ Emails are being <b>recorded, not delivered</b>. Set <code>SMTP_HOST</code>, <code>SMTP_USER</code>,
          <code> SMTP_PASS</code> (and optionally <code>MAIL_FROM_EMAIL</code>) in the server environment to send real email.
        </div>
      )}

      {!logs.length ? <p className="muted">No emails recorded yet.</p> : (
        <table className="admin-table">
          <thead>
            <tr><th>To</th><th>Subject</th><th>Template</th><th>Status</th><th>Error</th><th>When</th></tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id}>
                <td>{l.to_email}</td>
                <td>{l.subject}</td>
                <td><code>{l.template}</code></td>
                <td>{badge(l.status)}</td>
                <td style={{ maxWidth: '200px' }}>{l.error ? <small className="bad">{l.error}</small> : <span className="muted">—</span>}</td>
                <td><small className="muted">{new Date(l.created_at + 'Z').toLocaleString()}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}