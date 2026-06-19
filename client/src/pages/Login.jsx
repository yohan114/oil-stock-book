import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api.js';
import { Icon } from '../components/ui.jsx';

export default function Login() {
  const { login } = useAuth();
  const { data: settings } = useApi('/settings');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try { await login(username, password); }
    catch (e2) { setErr(e2.message); setBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-oil-light/20 text-oil-light grid place-items-center mb-3">
            <Icon name="oil" className="w-8 h-8" />
          </div>
          <h1 className="text-white font-bold text-xl">{settings?.book_title || 'Oil Stock Book'}</h1>
          <p className="text-slate-400 text-sm mt-1">{settings?.company_name || 'Edward & Christie (Pvt) Ltd'}</p>
        </div>

        <form onSubmit={submit} className="card p-6 space-y-4">
          <div>
            <label className="label">Username</label>
            <input className="input" value={username} autoFocus autoCapitalize="none" autoCorrect="off"
              onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {err && <div className="text-sm text-rose-600">⚠ {err}</div>}
          <button type="submit" className="btn-primary w-full justify-center py-2.5" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-center text-[11px] text-slate-500 mt-4">Fuel &amp; Lubricant Stock Management</p>
      </div>
    </div>
  );
}
