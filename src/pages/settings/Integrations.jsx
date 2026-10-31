import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, MessageSquare, Plus, Trash2, Webhook } from 'lucide-react';
import { integrationsApi, absoluteApiUrl, EVENT_LABELS, SCOPE_LABELS } from '../../api/endpoints/platform';
import { errorText, when } from '../../api/endpoints/workflows';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Dialog from '../../components/ui/Dialog';
import FormField from '../../components/ui/FormField';
import EmptyState from '../../components/ui/EmptyState';
import Tabs from '../../components/ui/Tabs';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/ConfirmDialog';

/** Slack/Teams channel posts, outbound webhooks and API keys for the public API. */
export default function Integrations() {
  const [tab, setTab] = useState('chat');
  return (
    <div className="hz-admin-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Settings" title="Integrations" description="Post updates to Slack or Teams, send events to your systems and read data through the API" />
      <Tabs items={[{ key: 'chat', label: 'Slack & Teams' }, { key: 'webhooks', label: 'Webhooks' }, { key: 'api', label: 'API keys' }]} value={tab} onChange={setTab} />
      {tab === 'chat' && <Chat />}
      {tab === 'webhooks' && <Webhooks />}
      {tab === 'api' && <ApiKeys />}
    </div>
  );
}

function EventPicker({ value, onChange, options }) {
  return (
    <div className="d-flex flex-wrap gap-3">
      {options.map((e) => (
        <label key={e} className="form-check d-inline-flex align-items-center gap-2" style={{ fontSize: 13 }}>
          <input type="checkbox" className="form-check-input m-0" checked={value.includes(e)} onChange={(ev) => onChange(ev.target.checked ? [...value, e] : value.filter((x) => x !== e))} />
          {EVENT_LABELS[e] || e}
        </label>
      ))}
    </div>
  );
}

function CopyButton({ text }) {
  const toast = useToast();
  return (
    <Button size="sm" variant="secondary" icon={Copy} onClick={() => navigator.clipboard?.writeText(text).then(() => toast.success('Copied.'), () => toast.error('Copy failed - select and copy it manually.'))}>Copy</Button>
  );
}

function Chat() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['integrations-chat'], queryFn: integrationsApi.chat });
  const [slack, setSlack] = useState('');
  const [teams, setTeams] = useState('');
  const [events, setEvents] = useState([]);
  useEffect(() => { if (data) setEvents(data.events); }, [data]);
  const save = useMutation({
    mutationFn: (body) => integrationsApi.saveChat(body),
    onSuccess: (v) => { queryClient.setQueryData(['integrations-chat'], v); setSlack(''); setTeams(''); toast.success('Saved.'); },
    onError: (e) => toast.error(errorText(e, 'Could not save.')),
  });
  const test = useMutation({ mutationFn: integrationsApi.testChat, onSuccess: () => toast.success('Test message sent - check the channel in a few seconds.'), onError: (e) => toast.error(errorText(e, 'Could not send.')) });
  if (isLoading || !data) return <Card><SkeletonText lines={4} /></Card>;
  return (
    <Card title="Channel posts" subtitle="Celebrate kudos and new joiners, and share announcements where your team already talks">
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <div className="d-flex align-items-center gap-2 mb-1"><strong>Slack</strong>{data.slackConnected ? <Badge variant="success">Connected</Badge> : <Badge variant="neutral">Not connected</Badge>}</div>
          <FormField label="Incoming webhook URL" value={slack} onChange={setSlack} placeholder={data.slackConnected ? 'Paste a new URL to replace it' : 'https://hooks.slack.com/services/...'} hint="Slack → Apps → Incoming Webhooks → Add to channel" />
          <div className="d-flex gap-2">
            <Button size="sm" disabled={!slack.trim()} loading={save.isPending} onClick={() => save.mutate({ slackWebhookUrl: slack })}>Connect</Button>
            {data.slackConnected && <Button size="sm" variant="secondary" onClick={() => save.mutate({ slackWebhookUrl: '' })}>Disconnect</Button>}
          </div>
        </div>
        <div className="col-12 col-md-6">
          <div className="d-flex align-items-center gap-2 mb-1"><strong>Microsoft Teams</strong>{data.teamsConnected ? <Badge variant="success">Connected</Badge> : <Badge variant="neutral">Not connected</Badge>}</div>
          <FormField label="Incoming webhook URL" value={teams} onChange={setTeams} placeholder={data.teamsConnected ? 'Paste a new URL to replace it' : 'https://….webhook.office.com/...'} hint="Teams channel → ⋯ → Workflows / Connectors → Incoming webhook" />
          <div className="d-flex gap-2">
            <Button size="sm" disabled={!teams.trim()} loading={save.isPending} onClick={() => save.mutate({ teamsWebhookUrl: teams })}>Connect</Button>
            {data.teamsConnected && <Button size="sm" variant="secondary" onClick={() => save.mutate({ teamsWebhookUrl: '' })}>Disconnect</Button>}
          </div>
        </div>
      </div>
      <hr />
      <strong style={{ fontSize: 13 }}>Post these events</strong>
      <div className="my-2"><EventPicker value={events} onChange={setEvents} options={data.availableEvents} /></div>
      <p style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>“Leave approved” posts names and dates to the channel - only turn it on if your team is comfortable with that.</p>
      <div className="d-flex gap-2 align-items-center flex-wrap">
        <Button size="sm" loading={save.isPending} onClick={() => save.mutate({ events })}>Save events</Button>
        {(data.slackConnected || data.teamsConnected) && <Button size="sm" variant="secondary" icon={MessageSquare} loading={test.isPending} onClick={() => test.mutate()}>Send a test</Button>}
        {data.lastPostedAt && <span style={{ fontSize: 12, color: data.lastError ? 'var(--hz-danger-600, #dc2626)' : 'var(--hz-text-muted)' }}>Last post {when(data.lastPostedAt)}{data.lastError ? ` - ${data.lastError}` : ' - delivered'}</span>}
      </div>
    </Card>
  );
}

function Webhooks() {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['integrations-webhooks'], queryFn: integrationsApi.webhooks });
  const [editing, setEditing] = useState(null);
  const [secret, setSecret] = useState(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['integrations-webhooks'] });
  const save = useMutation({
    mutationFn: (w) => (w.id ? integrationsApi.updateWebhook(w.id, w) : integrationsApi.createWebhook(w)),
    onSuccess: (w) => { refresh(); setEditing(null); if (w.signingSecret) setSecret(w.signingSecret); toast.success('Webhook saved.'); },
    onError: (e) => toast.error(errorText(e, 'Could not save.')),
  });
  const test = useMutation({ mutationFn: integrationsApi.testWebhook, onSuccess: (w) => { refresh(); w.lastError ? toast.error(`Test failed: ${w.lastError}`) : toast.success(`Delivered (HTTP ${w.lastStatus}).`); }, onError: (e) => toast.error(errorText(e, 'Could not send.')) });
  const remove = useMutation({ mutationFn: integrationsApi.deleteWebhook, onSuccess: () => { refresh(); toast.success('Webhook removed.'); } });
  return (
    <Card title="Webhooks" subtitle="We POST a signed JSON payload to your URL when these events happen"
      actions={<Button size="sm" icon={Plus} onClick={() => setEditing({ url: '', description: '', events: ['LEAVE_APPROVED', 'EMPLOYEE_JOINED'], active: true })}>Add webhook</Button>}>
      {isLoading ? <SkeletonText lines={3} /> : !(data || []).length ? <EmptyState icon={Webhook} title="No webhooks" description="Add an https endpoint to receive events in your own systems." /> : (
        <div className="d-flex flex-column gap-2">{data.map((w) => (
          <div key={w.id} className="d-flex flex-wrap align-items-center justify-content-between gap-2 p-3" style={{ border: '1px solid var(--hz-border)', borderRadius: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div className="d-flex gap-2 align-items-center"><code style={{ fontSize: 12, wordBreak: 'break-all' }}>{w.url}</code>{w.active ? <Badge variant="success">On</Badge> : <Badge variant="neutral">Off</Badge>}</div>
              <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{w.description ? `${w.description} · ` : ''}{w.events.map((e) => EVENT_LABELS[e] || e).join(', ')}</div>
              {w.lastDeliveryAt && <div style={{ fontSize: 12, color: w.lastError ? 'var(--hz-danger-600, #dc2626)' : 'var(--hz-text-muted)' }}>Last delivery {when(w.lastDeliveryAt)} - {w.lastError || `HTTP ${w.lastStatus}`}{w.failureCount > 0 ? ` (${w.failureCount} failures in a row)` : ''}</div>}
            </div>
            <div className="d-flex gap-2">
              <Button size="sm" variant="secondary" loading={test.isPending} onClick={() => test.mutate(w.id)}>Send test</Button>
              <Button size="sm" variant="secondary" onClick={() => setEditing(w)}>Edit</Button>
              <button type="button" className="btn btn-sm btn-light border-0" aria-label="Delete webhook" onClick={async () => { if (await confirm({ title: 'Delete this webhook?', confirmLabel: 'Delete' })) remove.mutate(w.id); }}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}</div>
      )}
      <details className="mt-3" style={{ fontSize: 13 }}>
        <summary>Verifying the signature</summary>
        <p className="mt-2 mb-1">Each request has <code>X-Vettri-Timestamp</code> and <code>X-Vettri-Signature: sha256=&lt;hex&gt;</code>. Compute HMAC-SHA256 of <code>timestamp + "." + rawBody</code> with your signing secret and compare. Reject requests older than 5 minutes.</p>
        <pre style={{ fontSize: 12, background: 'var(--hz-surface-muted, var(--hz-gray-50))', padding: 10, borderRadius: 8 }}>{`{ "id": "…", "event": "LEAVE_APPROVED", "occurredAt": "2026-11-03T09:12:00Z", "data": { … } }`}</pre>
      </details>
      {editing && (
        <Dialog open onClose={() => setEditing(null)} title={editing.id ? 'Edit webhook' : 'Add webhook'}
          footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button disabled={!editing.url.trim() || !editing.events.length} loading={save.isPending} onClick={() => save.mutate(editing)}>Save</Button></>}>
          <FormField label="Endpoint URL (https)" value={editing.url} onChange={(v) => setEditing((w) => ({ ...w, url: v }))} placeholder="https://example.com/hooks/vettri" maxLength={500} />
          <FormField label="Description (optional)" value={editing.description || ''} onChange={(v) => setEditing((w) => ({ ...w, description: v }))} maxLength={200} />
          <div className="mb-2"><strong style={{ fontSize: 13 }}>Events</strong></div>
          <EventPicker value={editing.events} onChange={(v) => setEditing((w) => ({ ...w, events: v }))} options={Object.keys(EVENT_LABELS)} />
          {editing.id && <label className="form-check d-inline-flex align-items-center gap-2 mt-3"><input type="checkbox" className="form-check-input m-0" checked={editing.active} onChange={(e) => setEditing((w) => ({ ...w, active: e.target.checked }))} /> Active</label>}
        </Dialog>
      )}
      {secret && (
        <Dialog open onClose={() => setSecret(null)} title="Signing secret" footer={<Button onClick={() => setSecret(null)}>I've saved it</Button>}>
          <p style={{ fontSize: 13 }}>Copy this now - it won't be shown again.</p>
          <div className="d-flex gap-2 align-items-center"><code style={{ wordBreak: 'break-all' }}>{secret}</code><CopyButton text={secret} /></div>
        </Dialog>
      )}
    </Card>
  );
}

function ApiKeys() {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['integrations-keys'], queryFn: integrationsApi.keys });
  const [creating, setCreating] = useState(null);
  const [created, setCreated] = useState(null);
  const create = useMutation({
    mutationFn: () => integrationsApi.createKey({ ...creating, expiresOn: creating.expiresOn || null }),
    onSuccess: (k) => { queryClient.invalidateQueries({ queryKey: ['integrations-keys'] }); setCreating(null); setCreated(k); },
    onError: (e) => toast.error(errorText(e, 'Could not create the key.')),
  });
  const revoke = useMutation({ mutationFn: integrationsApi.revokeKey, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['integrations-keys'] }); toast.success('Key revoked.'); } });
  const base = absoluteApiUrl('/api/public/v1');
  return (
    <Card title="API keys" subtitle="Read-only access for your BI, ERP or access-control systems" actions={<Button size="sm" icon={Plus} onClick={() => setCreating({ name: '', scopes: ['employees:read'], expiresOn: '' })}>Create key</Button>}>
      {isLoading ? <SkeletonText lines={3} /> : !(data || []).length ? <EmptyState icon={KeyRound} title="No API keys" description="Create a key for each system that needs data, so you can revoke them separately." /> : (
        <table className="table table-sm align-middle mb-0" style={{ fontSize: 13 }}>
          <thead><tr><th>Name</th><th>Key</th><th>Can read</th><th>Last used</th><th>Status</th><th aria-label="Actions" /></tr></thead>
          <tbody>{data.map((k) => (
            <tr key={k.id}>
              <td><strong>{k.name}</strong><div style={{ fontSize: 11, color: 'var(--hz-text-muted)' }}>by {k.createdByName}</div></td>
              <td><code>{k.prefix}_…</code></td>
              <td>{k.scopes.map((s) => SCOPE_LABELS[s] || s).join(', ')}</td>
              <td>{k.lastUsedAt ? when(k.lastUsedAt) : 'Never'}</td>
              <td>{k.revokedAt ? <Badge variant="neutral">Revoked</Badge> : k.expiresOn ? <Badge variant="info">Until {k.expiresOn}</Badge> : <Badge variant="success">Active</Badge>}</td>
              <td className="text-end">{!k.revokedAt && <Button size="sm" variant="secondary" onClick={async () => { if (await confirm({ title: `Revoke ${k.name}?`, description: 'Systems using it stop working immediately.', confirmLabel: 'Revoke', irreversible: true })) revoke.mutate(k.id); }}>Revoke</Button>}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
      <details className="mt-3" style={{ fontSize: 13 }}>
        <summary>How to call the API</summary>
        <pre className="mt-2" style={{ fontSize: 12, background: 'var(--hz-surface-muted, var(--hz-gray-50))', padding: 10, borderRadius: 8, whiteSpace: 'pre-wrap' }}>{`curl -H "X-API-Key: <your key>" ${base}/employees
GET ${base}/leave?from=2026-11-01&to=2026-11-30
GET ${base}/attendance?from=2026-11-01&to=2026-11-07&employeeCode=E001
GET ${base}/holidays?year=2026`}</pre>
        <p className="mb-0" style={{ color: 'var(--hz-text-muted)' }}>Limits: 120 requests a minute per key; leave up to 93 days and attendance up to 31 days per call.</p>
      </details>
      {creating && (
        <Dialog open onClose={() => setCreating(null)} title="Create API key"
          footer={<><Button variant="secondary" onClick={() => setCreating(null)}>Cancel</Button><Button disabled={!creating.name.trim() || !creating.scopes.length} loading={create.isPending} onClick={() => create.mutate()}>Create</Button></>}>
          <FormField label="Name" value={creating.name} onChange={(v) => setCreating((c) => ({ ...c, name: v }))} placeholder="e.g. Power BI" maxLength={100} />
          <div className="mb-2"><strong style={{ fontSize: 13 }}>Can read</strong></div>
          <div className="d-flex flex-wrap gap-3 mb-3">{Object.entries(SCOPE_LABELS).map(([s, l]) => (
            <label key={s} className="form-check d-inline-flex align-items-center gap-2" style={{ fontSize: 13 }}>
              <input type="checkbox" className="form-check-input m-0" checked={creating.scopes.includes(s)} onChange={(e) => setCreating((c) => ({ ...c, scopes: e.target.checked ? [...c.scopes, s] : c.scopes.filter((x) => x !== s) }))} /> {l}
            </label>
          ))}</div>
          <FormField type="date" label="Expires (optional)" value={creating.expiresOn} onChange={(v) => setCreating((c) => ({ ...c, expiresOn: v }))} />
        </Dialog>
      )}
      {created && (
        <Dialog open onClose={() => setCreated(null)} title={`Key for ${created.name}`} footer={<Button onClick={() => setCreated(null)}>I've saved it</Button>}>
          <p style={{ fontSize: 13 }}>Copy the key now - for your security it won't be shown again.</p>
          <div className="d-flex gap-2 align-items-center"><code style={{ wordBreak: 'break-all' }}>{created.key}</code><CopyButton text={created.key} /></div>
        </Dialog>
      )}
    </Card>
  );
}
