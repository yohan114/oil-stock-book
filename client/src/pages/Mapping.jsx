import { useState } from 'react';
import { api, useApi } from '../api.js';
import { Spinner, ErrorMsg, Modal, Pill, Icon, Empty } from '../components/ui.jsx';
import AssetCombobox from '../components/AssetCombobox.jsx';

function Resolver({ alias, projects, onClose, onDone }) {
  const [mode, setMode] = useState('machine');
  const [asset, setAsset] = useState(null);
  const [projectId, setProjectId] = useState('');
  const [newProject, setNewProject] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function save() {
    setBusy(true); setErr(null);
    try {
      const body = {};
      if (mode === 'machine') { if (!asset) throw new Error('Pick a machine'); body.asset_id = asset.id; }
      else if (mode === 'project') {
        if (newProject.trim()) body.new_project_name = newProject.trim();
        else if (projectId) { body.project_id = Number(projectId); body.target_type = 'project'; }
        else throw new Error('Pick or name a project');
      } else { body.target_type = 'internal'; }
      const r = await api.post(`/aliases/${alias.id}/resolve`, body);
      onDone(r.updated);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <Modal title={`Map “${alias.raw_text}”`} onClose={onClose}>
      <p className="text-sm text-slate-500 mb-4">Seen <b>{alias.hit_count}</b> time(s). Link it so past and future issues are attributed correctly.</p>
      <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-lg mb-4">
        {[['machine', 'Machine'], ['project', 'Project'], ['internal', 'Internal']].map(([v, l]) => (
          <button key={v} onClick={() => setMode(v)} className={`py-1.5 rounded-md text-sm font-medium ${mode === v ? 'bg-white shadow text-brand-700' : 'text-slate-500'}`}>{l}</button>
        ))}
      </div>
      {mode === 'machine' && <AssetCombobox value={asset} onSelect={setAsset} />}
      {mode === 'project' && (
        <div className="space-y-2">
          <select className="input" value={projectId} onChange={(e) => { setProjectId(e.target.value); setNewProject(''); }}>
            <option value="">Existing project…</option>
            {projects?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="text-center text-xs text-slate-400">or</div>
          <input className="input" placeholder="Create new project name" value={newProject} onChange={(e) => { setNewProject(e.target.value); setProjectId(''); }} />
        </div>
      )}
      {mode === 'internal' && <p className="text-sm text-slate-500">Mark as internal / workshop consumption (lathe, service team, store, etc.).</p>}
      {err && <div className="text-sm text-rose-600 mt-3">⚠ {err}</div>}
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Map & back-fill'}</button>
      </div>
    </Modal>
  );
}

export default function Mapping() {
  const { data: aliases, loading, error, reload } = useApi('/aliases?resolved=0');
  const { data: projects, reload: reloadProjects } = useApi('/projects');
  const [active, setActive] = useState(null);
  const [toast, setToast] = useState(null);

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        These descriptions from the imported book didn’t match a machine or project automatically — usually a typo,
        an off-fleet vehicle, or a site. Map each one and the system relinks its history and learns it for next time.
      </p>

      {toast && <div className="card p-3 bg-emerald-50 border-emerald-200 text-emerald-700 text-sm">✓ Mapped — {toast} past transaction(s) relinked.</div>}

      <div className="card overflow-hidden">
        {loading ? <Spinner /> : error ? <ErrorMsg error={error} /> : !aliases?.length ? <Empty>Everything is mapped 🎉</Empty> : (
          <table className="w-full">
            <thead><tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="th">Description</th><th className="th text-right">Times seen</th><th className="th"></th>
            </tr></thead>
            <tbody>
              {aliases.map((a) => (
                <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="td font-medium text-ink">{a.raw_text}</td>
                  <td className="td text-right"><Pill className="bg-amber-100 text-amber-700">{a.hit_count}×</Pill></td>
                  <td className="td text-right">
                    <button className="btn-ghost py-1" onClick={() => setActive(a)}><Icon name="map" className="w-4 h-4" /> Map</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {active && (
        <Resolver alias={active} projects={projects} onClose={() => setActive(null)}
          onDone={(n) => { setActive(null); setToast(n); reload(); reloadProjects(); setTimeout(() => setToast(null), 4000); }} />
      )}
    </div>
  );
}
