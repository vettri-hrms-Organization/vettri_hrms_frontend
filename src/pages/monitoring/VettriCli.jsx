import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Check, Copy, Loader2, Play, Power, ShieldAlert, Square, Wifi, Wrench, X } from 'lucide-react';
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
const CATEGORY_ICON = { Diagnostics: Activity, Network: Wifi, Fixes: Wrench, Power };
const FINISHED = ['COMPLETED', 'FAILED', 'TIMEOUT', 'CANCELLED', 'DEVICE_OFFLINE'];
const OUTCOME = {
  COMPLETED: { label: 'Completed', color: 'var(--hz-success-600)', background: 'var(--hz-success-50)' },
  FAILED: { label: 'Failed', color: 'var(--hz-danger-600, #b42318)', background: 'var(--hz-danger-50, #fef3f2)' },
  TIMEOUT: { label: 'Timed out', color: 'var(--hz-warning-600)', background: 'var(--hz-warning-50)' },
  CANCELLED: { label: 'Cancelled', color: 'var(--hz-text-muted)', background: 'var(--hz-gray-100, #f2f4f7)' },
  DEVICE_OFFLINE: { label: 'Laptop offline', color: 'var(--hz-warning-600)', background: 'var(--hz-warning-50)' },
};
const mono = 'ui-monospace, SFMono-Regular, Consolas, monospace';

/** Sent → laptop running it → finished, so an admin always knows where an action is. */
function ProgressSteps({ status }) {
  const finished = FINISHED.includes(status);
  const failed = finished && status !== 'COMPLETED';
  const steps = [
    { label: 'Sent', state: 'done' },
    { label: 'Laptop running it', state: status === 'QUEUED' ? 'waiting' : status === 'RUNNING' ? 'current' : 'done' },
    { label: finished ? OUTCOME[status]?.label || 'Finished' : 'Finished', state: finished ? (failed ? 'failed' : 'done') : 'waiting' },
  ];
  if (status === 'QUEUED') steps[0].state = 'current';
  return <ol className="d-flex align-items-start gap-2 mb-0 p-0" style={{ listStyle: 'none' }} aria-label="Action progress">
    {steps.map((step, index) => {
      const colors = {
        done: { dot: 'var(--hz-success-600)', text: 'var(--hz-text)' },
        current: { dot: 'var(--hz-primary-500)', text: 'var(--hz-text)' },
        failed: { dot: 'var(--hz-danger-600, #b42318)', text: 'var(--hz-danger-600, #b42318)' },
        waiting: { dot: 'var(--hz-border-strong, #d0d5dd)', text: 'var(--hz-text-muted)' },
      }[step.state];
      const Icon = step.state === 'done' ? Check : step.state === 'failed' ? X : step.state === 'current' ? Loader2 : null;
      return <li key={step.label} className="d-flex flex-column align-items-center text-center" style={{ flex: 1, minWidth: 0 }}>
        <div className="d-flex align-items-center w-100">
          <span style={{ flex: 1, height: 2, background: index === 0 ? 'transparent' : colors.dot }} />
          <span className="d-inline-flex align-items-center justify-content-center" style={{ width: 30, height: 30, borderRadius: '50%', background: step.state === 'waiting' ? 'transparent' : colors.dot, border: `2px solid ${colors.dot}`, color: '#fff', flexShrink: 0 }}>
            {Icon && <Icon size={16} aria-hidden="true" className={step.state === 'current' ? 'hz-spin' : undefined} style={step.state === 'current' ? { animation: 'spin 1s linear infinite' } : undefined} />}
          </span>
          <span style={{ flex: 1, height: 2, background: index === steps.length - 1 ? 'transparent' : (steps[index + 1].state === 'waiting' ? 'var(--hz-border-strong, #d0d5dd)' : steps[index + 1].state === 'failed' ? 'var(--hz-danger-600, #b42318)' : 'var(--hz-success-600)') }} />
        </div>
        <span className="mt-2" style={{ fontSize: 13, fontWeight: step.state === 'current' ? 700 : 500, color: colors.text }}>{step.label}</span>
      </li>;
    })}
  </ol>;
}

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
  const resultRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [script, setScript] = useState('');
  const [shellType, setShellType] = useState('POWERSHELL');
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const deviceQuery = useQuery({ queryKey: ['monitoring-device', id], queryFn: () => monitoringApi.deviceById(id) });
  const actionsQuery = useQuery({ queryKey: ['remote-command-actions', id], queryFn: () => monitoringApi.remoteCommandActions(id), staleTime: 60 * 60 * 1000 });
  const commandsQuery = useQuery({ queryKey: ['remote-commands', id], queryFn: () => monitoringApi.remoteCommands(id), refetchInterval: selected && ['QUEUED', 'RUNNING'].includes(selected.status) ? 1500 : 5000 });
  const create = useMutation({
    mutationFn: (payload) => monitoringApi.createRemoteCommand(id, payload),
    onSuccess: (job) => {
      setSelected(job); setConfirming(null); setPassword(''); setCopied(false);
      queryClient.invalidateQueries({ queryKey: ['remote-commands', id] });
      // On narrow screens the result panel sits above the actions: bring it into view.
      requestAnimationFrame(() => {
        const box = resultRef.current?.getBoundingClientRect();
        if (box && (box.top < 0 || box.top > window.innerHeight * 0.6)) resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
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

  const title = (job) => (job.shellType === 'ACTION' ? job.actionLabel || job.command : `Custom ${job.shellType === 'CMD' ? 'CMD' : 'PowerShell'} script`);
  const inProgress = (job) => ['QUEUED', 'RUNNING'].includes(job?.status);
  const activeKeys = new Set(rows.filter((job) => job.shellType === 'ACTION' && inProgress(job)).map((job) => job.command));
  const result = selected
    ? `${selected.stdout || ''}${selected.stderr ? `\n[stderr]\n${selected.stderr}` : ''}${selected.errorMessage ? `\n${selected.errorMessage}` : ''}`.trim()
    : '';
  const waitingText = selected?.status === 'QUEUED'
    ? 'Waiting for the laptop to pick this up… This usually takes under 10 seconds while the laptop is online.'
    : selected?.status === 'RUNNING' ? 'The laptop is running this action…' : 'Finished with no output.';
  const outcome = selected && OUTCOME[selected.status];

  return <div className="d-flex flex-column gap-4">
    <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    <Link to={`/monitoring/devices/${id}`} className="text-decoration-none text-secondary-hz">← Back to device</Link>
    <Card>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
        <div><div className="text-secondary-hz" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>TARGET DEVICE</div><h1 className="mb-1" style={{ fontSize: 'var(--hz-text-xl)' }}>{getDeviceName(device)}</h1><StatusBadge status={online ? 'ACTIVE' : 'INACTIVE'} variant={online ? 'success' : 'neutral'} dot>{online ? 'Online' : 'Offline'}</StatusBadge></div>
        <div className="text-secondary-hz" style={{ fontSize: 13, maxWidth: 360 }}>Pick an action, press <strong>Run</strong>, and watch the result on the right. Every action is recorded in the audit log.</div>
      </div>
    </Card>

    <div className="row g-4 align-items-start">
      {/* Result + history: right on wide screens (sticky), on top on phones once something runs. */}
      <div className={`col-12 col-xl-5 ${selected ? 'order-first' : 'order-last'} order-xl-last`}>
        <div className="d-flex flex-column gap-4" style={{ position: 'sticky', top: 88 }}>
          <div ref={resultRef} style={{ scrollMarginTop: 96 }}>
            <Card title="Result" subtitle={selected ? title(selected) : 'Run an action to see what happens'}>
              {!selected && <div className="d-flex flex-column align-items-center text-center gap-2 py-4">
                <span className="d-inline-flex align-items-center justify-content-center" style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--hz-primary-50)', color: 'var(--hz-primary-600)' }}><Play size={26} aria-hidden="true" /></span>
                <strong>Nothing running yet</strong>
                <span className="text-secondary-hz" style={{ fontSize: 14, maxWidth: 320 }}>Press <strong>Run</strong> on any action. Its progress and output appear here.</span>
              </div>}
              {selected && <div className="d-flex flex-column gap-3">
                <ProgressSteps status={selected.status} />
                {outcome && <div className="d-flex align-items-center gap-2 px-3 py-2" style={{ borderRadius: 10, background: outcome.background, color: outcome.color, fontWeight: 600, fontSize: 14 }}>
                  {selected.status === 'COMPLETED' ? <Check size={18} aria-hidden="true" /> : <X size={18} aria-hidden="true" />}
                  {outcome.label}{selected.exitCode !== null && selected.exitCode !== undefined ? ` · exit code ${selected.exitCode}` : ''}
                </div>}
                <div ref={terminalRef} aria-live="polite" style={{ minHeight: 220, maxHeight: 420, overflow: 'auto', background: 'var(--hz-gray-950, #111827)', color: result ? '#e5e7eb' : '#9ca3af', padding: 18, borderRadius: 10, fontFamily: mono, fontSize: 13, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {result || waitingText}
                </div>
                <div className="d-flex justify-content-end gap-2">
                  {inProgress(selected) && <Button size="sm" variant="danger" icon={Square} onClick={() => cancel.mutate()} loading={cancel.isPending}>Cancel</Button>}
                  <Button size="sm" variant="secondary" icon={copied ? Check : Copy} disabled={!result} onClick={() => { navigator.clipboard.writeText(result); setCopied(true); }}>{copied ? 'Copied' : 'Copy output'}</Button>
                </div>
              </div>}
            </Card>
          </div>

          <Card title="History" subtitle="Last actions on this laptop">
            <div className="d-flex flex-column gap-2" style={{ maxHeight: 320, overflow: 'auto' }}>
              {rows.length === 0 && <span className="text-secondary-hz">Nothing has been run on this laptop yet.</span>}
              {rows.slice(0, 30).map((job) => <button key={job.id} type="button" onClick={() => { setSelected(job); setCopied(false); }} className="btn text-start p-2 d-flex justify-content-between align-items-center gap-2" style={{ border: `1px solid ${selected?.id === job.id ? 'var(--hz-primary-300)' : 'var(--hz-border)'}`, borderRadius: 8, background: selected?.id === job.id ? 'var(--hz-primary-50)' : 'transparent' }}>
                <span style={{ minWidth: 0 }}><span className="d-block text-truncate" style={{ fontWeight: 600 }}>{title(job)}</span><span className="text-secondary-hz" style={{ fontSize: 12 }}>{job.createdAt ? new Date(job.createdAt).toLocaleString() : ''}</span></span>
                <StatusBadge status={job.status} />
              </button>)}
            </div>
          </Card>
        </div>
      </div>

      <div className="col-12 col-xl-7 d-flex flex-column gap-4">
        <Card title="IT actions" subtitle="Diagnostics and fixes you can run on this laptop.">
          {actionsQuery.isLoading && <p className="text-secondary-hz mb-0">Loading actions…</p>}
          {actionsQuery.isError && <p className="text-danger mb-0">Could not load the action list.</p>}
          {!online && <div className="mb-3 px-3 py-2" style={{ borderRadius: 10, background: 'var(--hz-warning-50)', color: 'var(--hz-warning-600)', fontSize: 14 }}>The laptop is offline. Actions can be run when it comes back online.</div>}
          <div className="d-flex flex-column gap-4">
            {groups.map(([category, actions]) => {
              const CategoryIcon = CATEGORY_ICON[category] || Activity;
              return <section key={category} aria-label={category}>
                <div className="d-flex align-items-center gap-2 mb-2 text-secondary-hz" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1 }}><CategoryIcon size={15} aria-hidden="true" />{category.toUpperCase()}</div>
                <div style={{ border: '1px solid var(--hz-border)', borderRadius: 12, overflow: 'hidden' }}>
                  {actions.map((action, index) => {
                    const running = activeKeys.has(action.key) || (create.isPending && create.variables?.command === action.key);
                    const isSelected = selected?.shellType === 'ACTION' && selected?.command === action.key;
                    return <div key={action.key} className="d-flex align-items-center justify-content-between gap-3 px-3 py-3" style={{ borderTop: index === 0 ? 'none' : '1px solid var(--hz-border)', background: isSelected ? 'var(--hz-primary-50)' : 'transparent' }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="d-flex align-items-center gap-2 flex-wrap" style={{ fontWeight: 600 }}>{action.label}{DISRUPTIVE[action.key] && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'var(--hz-warning-50)', color: 'var(--hz-warning-600)' }}>Interrupts user</span>}</div>
                        <div className="text-secondary-hz" style={{ fontSize: 13 }}>{action.description}</div>
                      </div>
                      <Button size="sm" variant={running ? 'secondary' : 'primary'} icon={Play} loading={running} disabled={!online || create.isPending || activeKeys.has(action.key)} onClick={() => runAction(action)} aria-label={`Run ${action.label}`} style={{ minWidth: 104, flexShrink: 0 }}>{running ? 'Running' : 'Run'}</Button>
                    </div>;
                  })}
                </div>
              </section>;
            })}
          </div>
          {create.isError && <p className="text-danger mt-3 mb-0">{create.error?.response?.data?.message || 'Could not queue the action.'}</p>}
        </Card>

        {canRunScripts && <Card title="Custom script" subtitle="Runs as SYSTEM. Only works on laptops where custom scripts are allowed locally.">
          <div className="d-flex align-items-start gap-2 mb-3 p-3" style={{ background: 'var(--hz-warning-50, #fff7ed)', borderRadius: 8, fontSize: 13 }}>
            <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
            <span>Prefer an approved action. Custom scripts can change anything on the laptop; they need your password and are logged (by fingerprint, not text).</span>
          </div>
          <form onSubmit={runScript} className="d-flex flex-column gap-3">
            <label className="form-label mb-0">Script<textarea className="form-control mt-1" rows={4} value={script} onChange={(event) => setScript(event.target.value)} placeholder="Get-Service | Where-Object Status -eq 'Stopped'" disabled={!online} spellCheck={false} style={{ fontFamily: mono }} /></label>
            <div className="d-flex flex-wrap gap-3 align-items-end">
              <label className="form-label mb-0">Shell<select className="form-select mt-1" style={{ width: 160 }} value={shellType} onChange={(event) => setShellType(event.target.value)}><option value="POWERSHELL">PowerShell</option><option value="CMD">CMD</option></select></label>
              <label className="form-label mb-0 flex-grow-1">Your password<input type="password" className="form-control mt-1" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
              <Button type="submit" variant="danger" icon={Play} loading={create.isPending && create.variables?.shellType !== 'ACTION'} disabled={!online || !script.trim() || !password}>Run script</Button>
            </div>
          </form>
        </Card>}
      </div>
    </div>
    <ConfirmDialog open={!!confirming} onClose={() => setConfirming(null)} onConfirm={() => create.mutate({ command: confirming.key, shellType: 'ACTION' })} loading={create.isPending} variant="primary" title={confirming ? `${confirming.label}?` : ''} description={confirming ? DISRUPTIVE[confirming.key] : ''} confirmLabel="Run now" />
  </div>;
}
