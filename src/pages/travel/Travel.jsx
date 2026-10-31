import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plane, Plus } from 'lucide-react';
import { travelApi, errorText, inr } from '../../api/endpoints/workflows';
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

const STATUS = { PENDING: ['Waiting for approval', 'warning'], APPROVED: ['Approved', 'success'], REJECTED: ['Not approved', 'danger'], CANCELLED: ['Cancelled', 'neutral'], COMPLETED: ['Completed', 'info'] };
const ADVANCE = { NONE: null, REQUESTED: ['Advance requested', 'warning'], PAID: ['Advance paid', 'info'], SETTLED: ['Advance settled', 'success'], RECOVERY: ['Recovering in payroll', 'warning'], RECOVERED: ['Recovered', 'success'] };
const MODES = { FLIGHT: 'Flight', TRAIN: 'Train', BUS: 'Bus', CAB: 'Cab', OWN_VEHICLE: 'Own vehicle', OTHER: 'Other' };

/** Travel requests and advances: my trips, and approvals / advances for managers and finance. */
export default function Travel() {
  const { hasPermission } = useAuth();
  const canReview = hasPermission('EXPENSE_APPROVE') || hasPermission('EXPENSE_MANAGE') || hasPermission('LEAVE_APPROVE');
  const [tab, setTab] = useState('mine');
  const [creating, setCreating] = useState(false);
  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Expenses" title="Travel" description="Plan business trips, get them approved and take a cash advance"
        actions={<Button icon={Plus} onClick={() => setCreating(true)}>New trip</Button>} />
      {canReview && <Tabs items={[{ key: 'mine', label: 'My trips' }, { key: 'review', label: 'Approvals & advances' }]} value={tab} onChange={setTab} />}
      {tab === 'mine' ? <MyTrips onCreate={() => setCreating(true)} /> : <Review finance={hasPermission('EXPENSE_MANAGE')} />}
      {creating && <TripDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function TripRow({ t, children, showEmployee = false }) {
  const adv = ADVANCE[t.advanceStatus];
  return (
    <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 p-3" style={{ border: '1px solid var(--hz-border)', borderRadius: 10 }}>
      <div style={{ minWidth: 0 }}>
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <strong>{showEmployee && `${t.employeeName} · `}{t.fromCity} → {t.toCity}</strong>
          <Badge variant={STATUS[t.status][1]}>{STATUS[t.status][0]}</Badge>
          {adv && <Badge variant={adv[1]}>{adv[0]}</Badge>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>
          {t.departDate} – {t.returnDate} ({t.nights} night{t.nights === 1 ? '' : 's'}) · {MODES[t.travelMode]}{t.needsAccommodation ? ' · stay needed' : ''}
          {t.estimatedCost != null && ` · est. ${inr(t.estimatedCost)}`}{Number(t.advanceAmount) > 0 && ` · advance ${inr(t.advanceAmount)}`}
        </div>
        <div style={{ fontSize: 13 }}>{t.purpose}</div>
        {t.decisionNote && <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{t.decidedByName}: {t.decisionNote}</div>}
        {t.spentAmount != null && <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>Spent {inr(t.spentAmount)}{t.recoveryAmount ? ` · ${inr(t.recoveryAmount)} recovered via payroll` : ''}</div>}
      </div>
      <div className="d-flex gap-2">{children}</div>
    </div>
  );
}

function useTravel(fn, message, after) {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { ['travel-mine', 'travel-queue'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] })); toast.success(message); after?.(); },
    onError: (e) => toast.error(errorText(e, 'Could not save.')),
  });
}

function MyTrips({ onCreate }) {
  const { data, isLoading } = useQuery({ queryKey: ['travel-mine'], queryFn: travelApi.mine });
  const cancel = useTravel((id) => travelApi.cancel(id), 'Trip cancelled.');
  return (
    <Card title="My trips">
      {isLoading ? <SkeletonText lines={3} /> : !(data || []).length ? (
        <EmptyState icon={Plane} title="No trips yet" description="Request a trip before you book, so your manager can approve it and finance can arrange an advance." action={<Button icon={Plus} onClick={onCreate}>New trip</Button>} />
      ) : <div className="d-flex flex-column gap-2">{data.map((t) => (
        <TripRow key={t.id} t={t}>
          {['PENDING', 'APPROVED'].includes(t.status) && t.advanceStatus !== 'PAID' && <Button size="sm" variant="secondary" loading={cancel.isPending} onClick={() => cancel.mutate(t.id)}>Cancel</Button>}
        </TripRow>
      ))}</div>}
    </Card>
  );
}

function Review({ finance }) {
  const [filter, setFilter] = useState('PENDING');
  const { data, isLoading } = useQuery({ queryKey: ['travel-queue', filter], queryFn: () => travelApi.queue(filter) });
  const [action, setAction] = useState(null);
  const approve = useTravel((id) => travelApi.decide(id, true), 'Trip approved.');
  const filters = [['PENDING', 'To approve'], ...(finance ? [['ADVANCES', 'Advances'], ['APPROVED', 'Approved trips']] : []), ['ALL', 'All']];
  return (
    <Card title="Approvals & advances" actions={(
      <div className="btn-group" role="group">{filters.map(([k, l]) => <button key={k} type="button" className={`btn btn-sm ${filter === k ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setFilter(k)}>{l}</button>)}</div>
    )}>
      {isLoading ? <SkeletonText lines={3} /> : !(data || []).length ? <EmptyState icon={Plane} title="Nothing here" description="Trips waiting on you appear here." /> : (
        <div className="d-flex flex-column gap-2">{data.map((t) => (
          <TripRow key={t.id} t={t} showEmployee>
            {t.canDecide && <><Button size="sm" variant="secondary" onClick={() => setAction({ kind: 'reject', t })}>Reject</Button><Button size="sm" loading={approve.isPending} onClick={() => approve.mutate(t.id)}>Approve</Button></>}
            {t.canPay && t.status === 'APPROVED' && t.advanceStatus === 'REQUESTED' && <Button size="sm" onClick={() => setAction({ kind: 'pay', t })}>Pay advance</Button>}
            {t.canPay && t.status === 'APPROVED' && <Button size="sm" variant="secondary" onClick={() => setAction({ kind: 'settle', t })}>Settle trip</Button>}
          </TripRow>
        ))}</div>
      )}
      {action && <ActionDialog action={action} onClose={() => setAction(null)} />}
    </Card>
  );
}

function ActionDialog({ action, onClose }) {
  const { kind, t } = action;
  const [text, setText] = useState('');
  const [spent, setSpent] = useState('');
  const [handling, setHandling] = useState('RETURNED');
  const save = useTravel(() => (kind === 'reject' ? travelApi.decide(t.id, false, text)
    : kind === 'pay' ? travelApi.payAdvance(t.id, text)
      : travelApi.settle(t.id, { spentAmount: Number(spent), excessHandling: handling })),
  kind === 'reject' ? 'Trip rejected.' : kind === 'pay' ? 'Advance marked paid.' : 'Trip settled.', onClose);
  const excess = Number(t.advanceAmount) - Number(spent || 0);
  const advancePaid = t.advanceStatus === 'PAID';
  const title = kind === 'reject' ? 'Reject trip' : kind === 'pay' ? `Pay advance · ${inr(t.advanceAmount)}` : 'Settle trip';
  const ready = kind === 'settle' ? spent !== '' : text.trim();
  return (
    <Dialog open onClose={onClose} title={title} size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!ready} loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
      <p style={{ fontSize: 13 }}>{t.employeeName} · {t.fromCity} → {t.toCity}</p>
      {kind === 'reject' && <FormField as="textarea" rows={3} label="Reason" value={text} onChange={setText} maxLength={500} />}
      {kind === 'pay' && <FormField label="Payment reference (UTR / cheque no.)" value={text} onChange={setText} maxLength={100} />}
      {kind === 'settle' && (
        <>
          <FormField type="number" min={0} label="Amount actually spent ₹" value={spent} onChange={setSpent} hint="From the approved bills" />
          {advancePaid && spent !== '' && excess > 0 && (
            <FormField as="select" label={`Unspent advance ${inr(excess)}`} value={handling} onChange={setHandling}>
              <option value="RETURNED">Employee returned it</option>
              <option value="PAYROLL">Recover it in the next payroll</option>
            </FormField>
          )}
          {advancePaid && spent !== '' && excess < 0 && <p style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>They spent {inr(-excess)} more than the advance - they can claim it through Expenses.</p>}
        </>
      )}
    </Dialog>
  );
}

function TripDialog({ onClose }) {
  const [form, setForm] = useState({ purpose: '', tripType: 'DOMESTIC', fromCity: '', toCity: '', departDate: '', returnDate: '', travelMode: 'FLIGHT', needsAccommodation: false, estimatedCost: '', advanceAmount: '', notes: '' });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const save = useTravel(() => travelApi.create({
    ...form,
    estimatedCost: form.estimatedCost === '' ? null : Number(form.estimatedCost),
    advanceAmount: form.advanceAmount === '' ? 0 : Number(form.advanceAmount),
  }), 'Trip sent for approval.', onClose);
  const ready = form.purpose.trim() && form.fromCity.trim() && form.toCity.trim() && form.departDate && form.returnDate;
  return (
    <Dialog open onClose={onClose} title="New trip" size="lg" hasUnsavedChanges={!!form.purpose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!ready} loading={save.isPending} onClick={() => save.mutate()}>Send for approval</Button></>}>
      <div className="row g-2">
        <FormField col={12} label="Purpose" value={form.purpose} onChange={set('purpose')} placeholder="e.g. Client workshop at Acme, Pune" maxLength={300} />
        <FormField col={6} label="From" value={form.fromCity} onChange={set('fromCity')} maxLength={80} />
        <FormField col={6} label="To" value={form.toCity} onChange={set('toCity')} maxLength={80} />
        <FormField col={6} type="date" label="Leaving" value={form.departDate} onChange={set('departDate')} />
        <FormField col={6} type="date" label="Returning" value={form.returnDate} onChange={set('returnDate')} min={form.departDate || undefined} />
        <FormField col={6} as="select" label="Travel by" value={form.travelMode} onChange={set('travelMode')}>
          {Object.entries(MODES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </FormField>
        <FormField col={6} as="select" label="Trip type" value={form.tripType} onChange={set('tripType')}>
          <option value="DOMESTIC">Domestic</option>
          <option value="INTERNATIONAL">International</option>
        </FormField>
        <FormField col={6} type="number" min={0} label="Estimated cost ₹" value={form.estimatedCost} onChange={set('estimatedCost')} />
        <FormField col={6} type="number" min={0} label="Advance needed ₹ (optional)" value={form.advanceAmount} onChange={set('advanceAmount')} hint="Settled against bills after the trip" />
        <div className="col-12">
          <label className="form-check d-inline-flex align-items-center gap-2"><input type="checkbox" className="form-check-input m-0" checked={form.needsAccommodation} onChange={(e) => set('needsAccommodation')(e.target.checked)} /> I need accommodation</label>
        </div>
        <FormField col={12} as="textarea" rows={2} label="Notes (optional)" value={form.notes} onChange={set('notes')} maxLength={1000} />
      </div>
    </Dialog>
  );
}
