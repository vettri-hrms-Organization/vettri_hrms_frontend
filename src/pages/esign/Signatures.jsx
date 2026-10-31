import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSignature, Send, ShieldCheck } from 'lucide-react';
import { esignApi, errorText, when } from '../../api/endpoints/workflows';
import { lettersApi } from '../../api/endpoints/letters';
import { useAuth } from '../../hooks/useAuth';
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
import SignaturePad, { useMySignature } from './SignaturePad';
import './esign.css';

const STATUS = { PENDING: ['Waiting for signature', 'warning'], SIGNED: ['Signed', 'success'], DECLINED: ['Declined', 'danger'], CANCELLED: ['Cancelled', 'neutral'] };

/** Click-to-sign: employees sign documents HR sends; HR sends letters and tracks them. */
export default function Signatures() {
  const { hasPermission } = useAuth();
  const isHr = hasPermission('LETTER_MANAGE');
  const [tab, setTab] = useState('mine');
  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Documents" title="E-signatures" description="Read and sign documents online, with a tamper-evident audit trail" />
      {isHr && <Tabs items={[{ key: 'mine', label: 'To sign' }, { key: 'sent', label: 'Sent for signature' }]} value={tab} onChange={setTab} />}
      {tab === 'mine' ? (
        <>
          <Card title="My signature" subtitle="Saved once and added to every document you sign">
            <SignaturePad />
          </Card>
          <Mine />
        </>
      ) : <Sent />}
    </div>
  );
}

function openBlob(blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function Mine() {
  const { data, isLoading } = useQuery({ queryKey: ['esign-mine'], queryFn: esignApi.mine });
  const [signing, setSigning] = useState(null);
  const toast = useToast();
  const view = (r) => esignApi.document(r.id).then(openBlob).catch((e) => toast.error(errorText(e, 'Could not open the document.')));
  return (
    <Card title="Documents for you">
      {isLoading ? <SkeletonText lines={3} /> : !(data || []).length ? (
        <EmptyState icon={FileSignature} title="Nothing to sign" description="When HR sends you a document to sign, it appears here." />
      ) : (
        <div className="d-flex flex-column gap-2">
          {data.map((r) => (
            <div key={r.id} className="d-flex flex-wrap align-items-center justify-content-between gap-3 p-3" style={{ border: '1px solid var(--hz-border)', borderRadius: 10 }}>
              <div>
                <strong>{r.title}</strong> <Badge variant={STATUS[r.status][1]}>{STATUS[r.status][0]}</Badge>
                <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>
                  From {r.requestedByName || 'HR'} · {when(r.requestedAt)}{r.dueDate ? ` · sign by ${r.dueDate}` : ''}
                  {r.signedAt && ` · signed ${when(r.signedAt)}`}
                </div>
                {r.message && <div style={{ fontSize: 13 }}>{r.message}</div>}
              </div>
              <div className="d-flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => view(r)}>{r.status === 'SIGNED' ? 'Signed copy' : 'Read'}</Button>
                {r.canSign && <Button size="sm" onClick={() => setSigning(r)}>Review & sign</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {signing && <SignDialog request={signing} onView={() => view(signing)} onClose={() => setSigning(null)} />}
    </Card>
  );
}

function SignDialog({ request, onView, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [opened, setOpened] = useState(false);
  const { saved: hasSignature } = useMySignature();
  const done = (msg) => { queryClient.invalidateQueries({ queryKey: ['esign-mine'] }); toast.success(msg); onClose(); };
  const sign = useMutation({ mutationFn: () => esignApi.sign(request.id, { fullName: name, consent }), onSuccess: () => done('Signed. A signed copy with the certificate is saved.'), onError: (e) => toast.error(errorText(e, 'Could not sign.')) });
  const decline = useMutation({ mutationFn: () => esignApi.decline(request.id, reason), onSuccess: () => done('Declined. HR has been told.'), onError: (e) => toast.error(errorText(e, 'Could not decline.')) });
  if (declining) {
    return (
      <Dialog open onClose={onClose} title={`Decline · ${request.title}`} size="sm"
        footer={<><Button variant="secondary" onClick={() => setDeclining(false)}>Back</Button><Button variant="danger" disabled={!reason.trim()} loading={decline.isPending} onClick={() => decline.mutate()}>Decline</Button></>}>
        <FormField as="textarea" rows={3} label="Tell HR why" value={reason} onChange={setReason} maxLength={500} />
      </Dialog>
    );
  }
  return (
    <Dialog open onClose={onClose} title={`Sign · ${request.title}`}
      footer={<><Button variant="secondary" onClick={() => setDeclining(true)}>Decline</Button><Button icon={FileSignature} disabled={!opened || !consent || !name.trim() || !hasSignature} loading={sign.isPending} onClick={() => sign.mutate()}>Sign</Button></>}>
      <Button variant="secondary" size="sm" onClick={() => { onView(); setOpened(true); }}>{opened ? 'Open the document again' : 'Open the document to read it'}</Button>
      {!opened && <p className="mt-2 mb-0" style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>Please read the document before you sign.</p>}
      <div className="mt-3">
        <div className="form-label" style={{ fontSize: 13, fontWeight: 600 }}>Your signature</div>
        <SignaturePad compact />
      </div>
      <div className="mt-3">
        <FormField label="Type your full name to sign" value={name} onChange={setName} placeholder={user?.fullName || 'Your full name'} hint="Must match the name on your employee profile" maxLength={150} />
        <label className="form-check d-flex gap-2 align-items-start mt-2" style={{ fontSize: 13 }}>
          <input type="checkbox" className="form-check-input mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>{request.consentText}</span>
        </label>
      </div>
      <p className="mt-3 mb-0 d-flex gap-2" style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>
        <ShieldCheck size={14} aria-hidden="true" /> We record the time, your IP address and browser, and a fingerprint of the exact document, and add a signature certificate page.
      </p>
    </Dialog>
  );
}

function Sent() {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['esign-sent'], queryFn: esignApi.list });
  const [sending, setSending] = useState(false);
  const cancel = useMutation({ mutationFn: esignApi.cancel, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['esign-sent'] }); toast.success('Request cancelled.'); }, onError: (e) => toast.error(errorText(e, 'Could not cancel.')) });
  const view = (r) => esignApi.document(r.id).then(openBlob).catch((e) => toast.error(errorText(e, 'Could not open the document.')));
  return (
    <Card title="Sent for signature" actions={<Button size="sm" icon={Send} onClick={() => setSending(true)}>Send a letter</Button>}>
      {isLoading ? <SkeletonText lines={4} /> : !(data || []).length ? (
        <EmptyState icon={FileSignature} title="Nothing sent yet" description="Generate a letter under Letters, then send it here for the employee to sign." />
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0" style={{ fontSize: 13 }}>
            <thead><tr><th>Employee</th><th>Document</th><th>Status</th><th>Sent</th><th>Signed</th><th aria-label="Actions" /></tr></thead>
            <tbody>{data.map((r) => (
              <tr key={r.id}>
                <td><strong>{r.employeeName}</strong></td>
                <td>{r.title}{r.declineReason && <div style={{ fontSize: 11, color: 'var(--hz-text-muted)' }}>Declined: {r.declineReason}</div>}</td>
                <td><Badge variant={STATUS[r.status][1]}>{STATUS[r.status][0]}</Badge>{r.status === 'PENDING' && r.viewedAt && <div style={{ fontSize: 11, color: 'var(--hz-text-muted)' }}>Opened {when(r.viewedAt)}</div>}</td>
                <td>{when(r.requestedAt)}</td>
                <td>{r.signedAt ? <span title={`IP ${r.signerIp || '—'} · SHA-256 ${r.documentSha256}`}>{when(r.signedAt)}</span> : '—'}</td>
                <td className="text-end"><div className="d-flex gap-2 justify-content-end">
                  <Button size="sm" variant="secondary" onClick={() => view(r)}>{r.status === 'SIGNED' ? 'Signed copy' : 'View'}</Button>
                  {r.status === 'PENDING' && <Button size="sm" variant="secondary" loading={cancel.isPending} onClick={async () => { if (await confirm({ title: 'Cancel this request?', confirmLabel: 'Cancel request' })) cancel.mutate(r.id); }}>Cancel</Button>}
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {sending && <SendDialog onClose={() => setSending(false)} />}
    </Card>
  );
}

function SendDialog({ onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: letters = [], isLoading } = useQuery({ queryKey: ['letters-recent'], queryFn: lettersApi.recent });
  const [form, setForm] = useState({ letterId: '', message: '', dueDate: '' });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const employeeLetters = letters.filter((l) => l.employeeId);
  useEffect(() => { if (!form.letterId && employeeLetters.length) setForm((f) => ({ ...f, letterId: String(employeeLetters[0].id) })); }, [employeeLetters, form.letterId]);
  const send = useMutation({
    mutationFn: () => esignApi.send({ letterId: Number(form.letterId), message: form.message, dueDate: form.dueDate || null }),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ['esign-sent'] }); toast.success(`Sent to ${r.employeeName} for signature.`); onClose(); },
    onError: (e) => toast.error(errorText(e, 'Could not send.')),
  });
  return (
    <Dialog open onClose={onClose} title="Send a letter for signature"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={Send} disabled={!form.letterId} loading={send.isPending} onClick={() => send.mutate()}>Send</Button></>}>
      {isLoading ? <SkeletonText lines={2} /> : !employeeLetters.length ? (
        <p style={{ fontSize: 13 }}>No letters issued to employees yet. Generate one under Letters first.</p>
      ) : (
        <>
          <FormField as="select" label="Letter" value={form.letterId} onChange={set('letterId')}>
            {employeeLetters.map((l) => <option key={l.id} value={l.id}>{l.employeeName} · {l.title}</option>)}
          </FormField>
          <FormField as="textarea" rows={2} label="Message (optional)" value={form.message} onChange={set('message')} maxLength={1000} />
          <FormField type="date" label="Sign by (optional)" value={form.dueDate} onChange={set('dueDate')} />
        </>
      )}
    </Dialog>
  );
}
