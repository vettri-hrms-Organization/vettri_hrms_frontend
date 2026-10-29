import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Play, ShieldAlert, Square } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { monitoringApi, getDeviceName, isDeviceOnline } from '../../api/endpoints/monitoring';
import { useAuth } from '../../hooks/useAuth';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/ui/StatusBadge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

// Actions that interrupt the employee (network drop, screen flicker, restart) ask first.
const DISRUPTIVE = {
  RENEW_IP: 'The laptop goes offline for a few seconds while it gets a new IP address.',
  RESTART_DISPLAY_ADAPTER: "The employee's screen flickers or goes black for a moment while the graphics driver restarts.",
  RESTART_PRINT_SPOOLER: 'Print jobs in progress on this laptop are cancelled.',
  SCHEDULE_RESTART: 'The employee is warned and the laptop restarts in 5 minutes. Unsaved work may be lost.',
};

/**
 * IT actions for one device. Normal use is the approved action catalog (fixed code inside the agent);
 * custom PowerShell/CMD scripts appear only for users holding REMOTE_SCRIPT_RUN and need the password.
 */
export default function VettriCli() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const canRunScripts = hasPermission('REMOTE_SCRIPT_RUN');
  const queryClient = useQueryClient();
  const terminalRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [script, setScript] = useState('');
  const [shellType, setShellType] = useState('POWERSHELL');
  const [password, setPassword] = useState('');

  const deviceQuery = useQuery({ queryKey: ['monitoring-device', id], queryFn: () => monitoringApi.deviceById(id) });
  const actionsQuery = useQuery({ queryKey: ['remote-command-actions', id], queryFn: () => monitoringApi.remoteCommandActions(id), staleTime: 60 * 60 * 1000 });
  const commandsQuery = useQuery({ queryKey: ['remote-commands', id], queryFn: () => monitoringApi.remoteCommands(id), refetchInterval: selected && ['QUEUED', 'RUNNING'].includes(selected.status) ? 1500 : 5000 });
  const create = useMutation({
    mutationFn: (payload) => monitoringApi.createRemoteCommand(id, payload),
    onSuccess: (job) => { setSelected(job); setConfirming(null); setPassword(''); queryClient.invalidateQueries({ queryKey: ['remote-commands', id] }); },
  });
  const cancel = useMutation({ mutationFn: () => monitoringApi.cancelRemoteCommand(id, selected.id), onSuccess: (job) => setSelected(job) });
  const device = deviceQuery.data;
  const online = isDeviceOnline(device);
  const rows = commandsQuery.data || [];

  const groups = useMemo(() => {
    const byCategory = new Map();
    (actionsQuery.data || []).forEach((action) => {
      if (!byCategory.has(action.category)) byCategory.set(action.category, []);
      byCategory.get(action.category).push(action);
    });
    return [...byCategory.entries()];
  }, [actionsQuery.data]);

  useEffect(() => { if (selected) { const latest = rows.find((row) => row.id === selected.id); if (latest) setSelected(latest); } }, [rows, selected]);
  useEffect(() => { terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight }); }, [selected]);

  function runAction(action) {
    if (DISRUPTIVE[action.key]) setConfirming(action);
    else create.mutate({ command: action.key, shellType: 'ACTION' });
  }

  function runScript(event) {
    event.preventDefault();
    if (!script.trim() || !password || create.isPending) return;
    create.mutate({ command: script.trim(), shellType, confirmPassword: password });
  }

  const title = (job) => job.actionLabel || job.command;
  const output = selected
    ? `${selected.stdout || ''}${selected.stderr ? `\n[stderr]\n${selected.stderr}` : ''}${selected.errorMessage ? `\n${selected.errorMessage}` : ''}`
    : 'Run an action, or pick one from the history, to see its output here.';

  return <div className="d-flex flex-column gap-4">
    <Link to={`/monitoring/devices/${id}`} className="text-decoration-none text-secondary-hz">← Back to device</Link>
    <Card>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
        <div><div className="text-secondary-hz" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>TARGET DEVICE</div><h1 className="mb-1" style={{ fontSize: 'var(--hz-text-xl)' }}>{getDeviceName(device)}</h1><StatusBadge status={online ? 'ACTIVE' : 'INACTIVE'} variant={online ? 'success' : 'neutral'} dot>{online ? 'Online' : 'Offline'}</StatusBadge></div>
        <div className="text-secondary-hz" style={{ fontSize: 13, maxWidth: 360 }}>Approved actions run as fixed code inside the Vettri Agent. Every action is recorded in the audit log.</div>
      </div>
    </Card>
    <div className="row g-4">
      <div className="col-12 col-xl-8 d-flex flex-column gap-4">
        <Card title="IT actions" subtitle="Diagnostics and fixes you can run on this laptop.">
          {actionsQuery.isLoading && <p className="text-secondary-hz mb-0">Loading actions…</p>}
          {actionsQuery.isError && <p className="text-danger mb-0">Could not load the action list.</p>}
          <div className="d-flex flex-column gap-4">
            {groups.map(([category, actions]) => <div key={category}>
              <div className="text-secondary-hz mb-2" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>{category.toUpperCase()}</div>
              <div className="row g-2">
                {actions.map((action) => <div key={action.key} className="col-12 col-md-6">
                  <div className="d-flex align-items-start justify-content-between gap-2 h-100 p-3" style={{ border: '1px solid var(--hz-border)', borderRadius: 10 }}>
                    <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600 }}>{action.label}</div><div className="text-secondary-hz" style={{ fontSize: 13 }}>{action.description}</div></div>
                    <Button size="sm" variant="secondary" icon={Play} disabled={!online || create.isPending} onClick={() => runAction(action)} aria-label={`Run ${action.label}`}>Run</Button>
                  </div>
                </div>)}
              </div>
            </div>)}
          </div>
          {!online && <p className="text-secondary-hz mt-3 mb-0">The laptop is offline. Actions can be run when it comes back online.</p>}
          {create.isError && <p className="text-danger mt-3 mb-0">{create.error?.response?.data?.message || 'Could not queue the action.'}</p>}
        </Card>

        <Card title="Output" subtitle={selected ? title(selected) : undefined}>
          <div ref={terminalRef} style={{ minHeight: 260, maxHeight: 500, overflow: 'auto', background: 'var(--hz-gray-950, #111827)', color: '#e5e7eb', padding: 20, borderRadius: 8, fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {output}
          </div>
          {selected && <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-3"><span className="text-secondary-hz">Status: <strong>{selected.status}</strong>{selected.exitCode !== null && selected.exitCode !== undefined ? ` · Exit code ${selected.exitCode}` : ''}</span><div className="d-flex gap-2"><Button size="sm" variant="secondary" icon={Copy} onClick={() => navigator.clipboard.writeText(output)}>Copy output</Button>{['QUEUED', 'RUNNING'].includes(selected.status) && <Button size="sm" variant="danger" icon={Square} onClick={() => cancel.mutate()} loading={cancel.isPending}>Cancel</Button>}</div></div>}
        </Card>

        {canRunScripts && <Card title="Custom script" subtitle="Runs as SYSTEM. Only works on laptops where custom scripts are allowed locally.">
          <div className="d-flex align-items-start gap-2 mb-3 p-3" style={{ background: 'var(--hz-warning-50, #fff7ed)', borderRadius: 8, fontSize: 13 }}>
            <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
            <span>Prefer an approved action. Custom scripts can change anything on the laptop; they need your password and are logged (by fingerprint, not text).</span>
          </div>
          <form onSubmit={runScript} className="d-flex flex-column gap-3">
            <label className="form-label mb-0">Script<textarea className="form-control mt-1" rows={4} value={script} onChange={(event) => setScript(event.target.value)} placeholder="Get-Service | Where-Object Status -eq 'Stopped'" disabled={!online} spellCheck={false} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace' }} /></label>
            <div className="d-flex flex-wrap gap-3 align-items-end">
              <label className="form-label mb-0">Shell<select className="form-select mt-1" style={{ width: 160 }} value={shellType} onChange={(event) => setShellType(event.target.value)}><option value="POWERSHELL">PowerShell</option><option value="CMD">CMD</option></select></label>
              <label className="form-label mb-0 flex-grow-1">Your password<input type="password" className="form-control mt-1" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
              <Button type="submit" variant="danger" icon={Play} loading={create.isPending} disabled={!online || !script.trim() || !password}>Run script</Button>
            </div>
          </form>
        </Card>}
      </div>
      <div className="col-12 col-xl-4"><Card title="History" subtitle="Last actions on this device">
        <div className="d-flex flex-column gap-2">
          {rows.length === 0 && <span className="text-secondary-hz">Nothing has been run on this device yet.</span>}
          {rows.slice(0, 30).map((job) => <button key={job.id} type="button" onClick={() => setSelected(job)} className="btn text-start p-2 d-flex justify-content-between align-items-center gap-2" style={{ border: '1px solid var(--hz-border)', borderRadius: 8, background: selected?.id === job.id ? 'var(--hz-primary-50)' : 'transparent' }}>
            <span style={{ minWidth: 0 }}><span className="d-block text-truncate" style={{ fontWeight: 600 }}>{job.shellType === 'ACTION' ? title(job) : `Custom ${job.shellType === 'CMD' ? 'CMD' : 'PowerShell'} script`}</span><span className="text-secondary-hz" style={{ fontSize: 12 }}>{job.createdAt ? new Date(job.createdAt).toLocaleString() : ''}</span></span>
            <StatusBadge status={job.status} />
          </button>)}
        </div>
      </Card></div>
    </div>
    <ConfirmDialog open={!!confirming} onClose={() => setConfirming(null)} onConfirm={() => create.mutate({ command: confirming.key, shellType: 'ACTION' })} loading={create.isPending} variant="primary" title={confirming ? `${confirming.label}?` : ''} description={confirming ? DISRUPTIVE[confirming.key] : ''} confirmLabel="Run now" />
  </div>;
}
