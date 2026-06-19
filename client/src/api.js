import { useEffect, useState, useCallback } from 'react';

const TOKEN_KEY = 'osb_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function J(url, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(url, { ...opts, headers });
  if (r.status === 401 && !url.endsWith('/auth/login')) {
    // Session expired or missing — drop the token and let the app show login.
    setToken(null);
    window.dispatchEvent(new Event('osb-unauthorized'));
  }
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error || r.statusText);
  }
  return r.json();
}

const body = (b) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

export const api = {
  get: (p) => J('/api' + p),
  post: (p, b) => J('/api' + p, { method: 'POST', ...body(b) }),
  patch: (p, b) => J('/api' + p, { method: 'PATCH', ...body(b) }),
  put: (p, b) => J('/api' + p, { method: 'PUT', ...body(b) }),
  del: (p) => J('/api' + p, { method: 'DELETE' }),
};

/** GET hook with loading/error and a reload() trigger. */
export function useApi(path, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!path) { setLoading(false); return; }
    let live = true;
    setLoading(true);
    api.get(path)
      .then((d) => { if (live) { setData(d); setError(null); } })
      .catch((e) => { if (live) setError(e.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps]);

  return { data, error, loading, reload };
}
