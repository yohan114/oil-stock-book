import { useState } from 'react';
import { api, useApi } from '../api.js';
import { useAuth, ROLE_LABEL } from '../auth.jsx';
import { Spinner, ErrorMsg, Icon, Modal, Pill } from '../components/ui.jsx';

const ROLES = ['admin', 'storekeeper', 'manager'];
const ROLE_PILL = {
  admin: 'bg-violet-100 text-violet-700',
  storekeeper: 'bg-brand-100 text-brand-700',
  manager: 'bg-emerald-100 text-emerald-700',
};

export default function Users() {
  const { user: me } = useAuth();
  const { data: users, loading, error, reload } = useApi('/users');
  const { data: projects } = useApi('/projects');
  const [editing, setEditing] = useState(null); // user object or {} for new

  async function remove(u) {
    if (!confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
    try { await api.del(`/users/${u.id}`); reload(); } catch (e) { alert(e.message); }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg error={error} />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage who can sign in and what they can do. Project Managers only issue to their assigned projects.</p>
        <button className="btn-primary" onClick={() => setEditing({})}><Icon name="plus" className="w-4 h-4" /> Add user</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead><tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="th">User</th><th className="th">Role</th><th className="th">Projects</th>
              <th className="th">Status</th><th className="th text-right">Actions</th>
            </tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-50">
                  <td className="td">
                    <div className="font-medium text-ink">{u.full_name || u.username}</div>
                    <div className="text-xs text-slate-400">@{u.username}{u.id === me.id && ' · you'}</div>
                  </td>
                  <td className="td"><Pill className={ROLE_PILL[u.role]}>{ROLE_LABEL[u.role]}</Pill></td>
                  <td className="td text-sm text-slate-500">
                    {u.role === 'manager'
                      ? (u.projects?.length ? u.projects.map((id) => projects?.find((p) => p.id === id)?.name || `#${id}`).join(', ') : <span className="text-amber-600">none assigned</span>)
                      : <span className="text-slate-300">all</span>}
                  </td>
                  <td className="td">{u.active ? <Pill className="bg-emerald-100 text-emerald-700">Active</Pill> : <Pill className="bg-slate-100 text-slate-500">Disabled</Pill>}</td>
                  <td className="td text-right whitespace-nowrap">
                    <button className="text-brand-600 hover:underline text-sm font-semibold mr-3" onClick={() => setEditing(u)}>Edit</button>
                    {u.id !== me.id && <button className="text-rose-500 hover:text-rose-700" onClick={() => remove(u)} title="Delete"><Icon name="trash" className="w-4 h-4 inline" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && <UserForm user={editing} projects={projects || []} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  );
}

function UserForm({ user, projects, onClose, onSaved }) {
  const isNew = !user.id;
  const [username, setUsername] = useState(user.username || '');
  const [fullName, setFullName] = useState(user.full_name || '');
  const [role, setRole] = useState(user.role || 'manager');
  const [password, setPassword] = useState('');
  const [active, setActive] = useState(user.active !== false);
  const [projectIds, setProjectIds] = useState(user.projects || []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  function toggleProject(id) {
    setProjectIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    if (isNew && !username.trim()) return setErr('Enter a username');
    if (isNew && password.length < 6) return setErr('Password must be at least 6 characters');
    setBusy(true);
    try {
      const payload = { full_name: fullName || null, role, projects: role === 'manager' ? projectIds : [] };
      if (password) payload.password = password;
      if (isNew) { payload.username = username.trim(); await api.post('/users', payload); }
      else { payload.active = active; await api.patch(`/users/${user.id}`, payload); }
      onSaved?.();
      onClose();
    } catch (e2) { setErr(e2.message); setBusy(false); }
  }

  return (
    <Modal title={isNew ? 'Add user' : `Edit ${user.username}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Username</label>
            <input className="input disabled:bg-slate-100" value={username} disabled={!isNew} autoCapitalize="none"
              onChange={(e) => setUsername(e.target.value)} placeholder="e.g. bandula" />
          </div>
          <div>
            <label className="label">Full name</label>
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Bandula Ekanayake" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Role</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{isNew ? 'Password' : 'New password (optional)'}</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isNew ? 'min 6 characters' : 'leave blank to keep'} />
          </div>
        </div>

        {role === 'manager' && (
          <div>
            <label className="label">Assigned projects</label>
            {!projects.length ? <p className="text-sm text-slate-400">No projects yet — create some first.</p> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto border border-slate-200 rounded-lg p-2">
                {projects.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={projectIds.includes(p.id)} onChange={() => toggleProject(p.id)} className="rounded" />
                    {p.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {!isNew && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded" /> Account active (can sign in)
          </label>
        )}

        {err && <div className="text-sm text-rose-600">⚠ {err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : isNew ? 'Create user' : 'Save changes'}</button>
        </div>
      </form>
    </Modal>
  );
}
