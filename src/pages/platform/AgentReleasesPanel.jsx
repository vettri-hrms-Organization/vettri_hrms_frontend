import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, PauseCircle, Rocket } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { adminApi } from '../../api/endpoints/admin';
import { formatDateTimeIST } from '../../utils/formatDateTime';

const errorMessage = (error, fallback) => error?.response?.data?.message || fallback;
const emptyRelease = { version: '', downloadUrl: '', sha256: '', releaseNotes: '' };

/**
 * SUPER_ADMIN: publish Vettri Agent builds. Every enrolled laptop checks every few hours and
 * upgrades to the active release when it is newer, after verifying the SHA-256 shown here.
 */
export default function AgentReleasesPanel() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyRelease);
  const [confirm, setConfirm] = useState(null);
  const releases = useQuery({ queryKey: ['admin-agent-releases'], queryFn: adminApi.agentReleases });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-agent-releases'] });

  const publish = useMutation({
    mutationFn: () => adminApi.publishAgentRelease({ ...form, version: form.version.trim(), sha256: form.sha256.trim(), activate: true }),
    onSuccess: () => { setForm(emptyRelease); setConfirm(null); refresh(); },
  });
  const activate = useMutation({ mutationFn: (id) => adminApi.activateAgentRelease(id), onSuccess: () => { setConfirm(null); refresh(); } });
  const pause = useMutation({ mutationFn: adminApi.pauseAgentReleases, onSuccess: () => { setConfirm(null); refresh(); } });

  const rows = releases.data || [];
  const active = rows.find((row) => row.active);
  const valid = /^\d{1,4}(\.\d{1,5}){1,3}$/.test(form.version.trim())
    && form.downloadUrl.trim().startsWith('https://')
    && /^[0-9a-fA-F]{64}$/.test(form.sha256.trim());
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  return <Card title="Vettri Agent updates" subtitle={active ? `Laptops are upgrading to ${active.version}.` : 'Automatic updates are paused: no release is active.'}
    actions={active && <Button size="sm" variant="secondary" icon={PauseCircle} onClick={() => setConfirm({ kind: 'pause' })}>Pause updates</Button>}>
    <form className="row g-3" onSubmit={(event) => { event.preventDefault(); if (valid) setConfirm({ kind: 'publish' }); }}>
      <div className="col-12 col-md-3"><label className="form-label mb-0">Version<input className="form-control mt-1" placeholder="2.2.0" value={form.version} onChange={update('version')} /></label></div>
      <div className="col-12 col-md-9"><label className="form-label mb-0 w-100">Download URL (https)<input className="form-control mt-1" placeholder="https://…/VettriAgentSetup.exe" value={form.downloadUrl} onChange={update('downloadUrl')} /></label></div>
      <div className="col-12"><label className="form-label mb-0 w-100">SHA-256 of the setup file<input className="form-control mt-1" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace' }} placeholder="Get-FileHash VettriAgentSetup.exe -Algorithm SHA256" value={form.sha256} onChange={update('sha256')} spellCheck={false} /></label>
        <div className="text-secondary-hz mt-1" style={{ fontSize: 12 }}>Laptops refuse the download if its hash differs, so a swapped or corrupted file is never installed.</div></div>
      <div className="col-12"><label className="form-label mb-0 w-100">Release notes (optional)<textarea className="form-control mt-1" rows={2} value={form.releaseNotes} onChange={update('releaseNotes')} /></label></div>
      <div className="col-12 d-flex justify-content-end"><Button type="submit" icon={Rocket} disabled={!valid}>Publish and roll out</Button></div>
    </form>
    {(publish.isError || activate.isError || pause.isError) && <p className="text-danger mt-3 mb-0">{errorMessage(publish.error || activate.error || pause.error, 'Could not update agent releases.')}</p>}

    <div className="table-responsive mt-4"><table className="table align-middle mb-0 hz-table" aria-label="Agent releases">
      <thead><tr><th>Version</th><th>Published</th><th>SHA-256</th><th>Status</th><th /></tr></thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={5} className="text-secondary-hz">No agent release published yet.</td></tr>}
        {rows.map((row) => <tr key={row.id}>
          <td style={{ fontWeight: 600 }}>{row.version}</td>
          <td>{row.createdAt ? formatDateTimeIST(row.createdAt) : '—'}</td>
          <td style={{ fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: 12 }} title={row.sha256}>{row.sha256.slice(0, 12)}…</td>
          <td>{row.active ? <span className="d-inline-flex align-items-center gap-1" style={{ color: 'var(--hz-success-600)', fontWeight: 600 }}><CircleCheck size={14} aria-hidden="true" />Active</span> : <span className="text-secondary-hz">Inactive</span>}</td>
          <td className="text-end">{!row.active && <Button size="sm" variant="secondary" onClick={() => setConfirm({ kind: 'activate', row })}>Make active</Button>}</td>
        </tr>)}
      </tbody>
    </table></div>

    <ConfirmDialog
      open={!!confirm}
      onClose={() => setConfirm(null)}
      variant={confirm?.kind === 'pause' ? 'secondary' : 'primary'}
      loading={publish.isPending || activate.isPending || pause.isPending}
      title={confirm?.kind === 'publish' ? `Roll out Vettri Agent ${form.version.trim()}?` : confirm?.kind === 'activate' ? `Make ${confirm.row.version} active?` : 'Pause automatic updates?'}
      description={confirm?.kind === 'pause'
        ? 'Laptops stay on the version they have until you make a release active again.'
        : 'Every customer laptop with an older agent installs this version within a few hours. Agents never downgrade.'}
      confirmLabel={confirm?.kind === 'pause' ? 'Pause' : 'Roll out'}
      onConfirm={() => {
        if (confirm?.kind === 'publish') publish.mutate();
        else if (confirm?.kind === 'activate') activate.mutate(confirm.row.id);
        else pause.mutate();
      }}
    />
  </Card>;
}
