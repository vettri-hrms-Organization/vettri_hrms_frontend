import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Coins, Gift, Scale, Wallet } from 'lucide-react';
import { compOffApi, encashmentApi, leavePolicyApi, leaveRequestsApi, leaveTypesApi } from '../../api/endpoints/leave';
import Card from '../../components/ui/Card';
import Tabs from '../../components/ui/Tabs';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Dialog from '../../components/ui/Dialog';
import FormField from '../../components/ui/FormField';
import EmptyState from '../../components/ui/EmptyState';
import ErrorBanner from '../../components/ui/ErrorBanner';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../hooks/useAuth';
import { formatDateIST, toISTDateInputValue } from '../../utils/formatDateTime';
import { leaveStatusMeta } from './leaveStatusMeta';

const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '0');
const inr = (n) => (n === null || n === undefined ? '—' : `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

const LEDGER_KIND_LABEL = {
  ACCRUAL: 'Accrual',
  CARRY_FORWARD: 'Carry forward',
  COMP_OFF: 'Comp-off',
  ADJUSTMENT: 'Adjustment',
  LEAVE: 'Leave',
  ENCASHMENT: 'Encashment',
  LAPSE: 'Lapsed',
  CAP: 'Cap',
};

const MODE_LABEL = { YEARLY_UPFRONT: 'Yearly', MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', COMP_OFF: 'Comp-off' };

/**
 * Policy-aware leave details for one employee: accrual "as of today", the balance ledger, comp-off and
 * encashment requests (self-service), plus HR-only balance adjustment and final-settlement preview.
 */
export default function LeaveSelfServicePanel({ employeeId }) {
  const { user, hasPermission } = useAuth();
  const isSelf = String(user?.employeeId) === String(employeeId);
  const canRequest = isSelf || hasPermission('LEAVE_APPLY');
  const canManage = hasPermission('LEAVE_MANAGE');
  const [tab, setTab] = useState('balances');
  const [year, setYear] = useState(new Date().getFullYear());

  const tabs = [
    { key: 'balances', label: 'Accrual' },
    { key: 'ledger', label: 'Ledger' },
    { key: 'compoff', label: 'Comp-off' },
    { key: 'encash', label: 'Encashment' },
  ];

  return (
    <Card title="Leave balance details" subtitle="Accrual, ledger, comp-off and encashment">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <Tabs items={tabs} value={tab} onChange={setTab} ariaLabel="Leave balance details" />
        {(tab === 'balances' || tab === 'ledger') && (
          <select className="form-select form-select-sm" style={{ width: 110 }} value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Leave year">
            {[0, 1, 2].map((offset) => {
              const y = new Date().getFullYear() - offset;
              return <option key={y} value={y}>{y}</option>;
            })}
          </select>
        )}
      </div>
      {tab === 'balances' && <AccrualTable employeeId={employeeId} year={year} canManage={canManage} />}
      {tab === 'ledger' && <LedgerView employeeId={employeeId} year={year} />}
      {tab === 'compoff' && <CompOffSection employeeId={employeeId} canRequest={canRequest} isSelf={isSelf} />}
      {tab === 'encash' && <EncashmentSection employeeId={employeeId} canRequest={canRequest} isSelf={isSelf} canManage={canManage} />}
    </Card>
  );
}

function AccrualTable({ employeeId, year, canManage }) {
  const [adjusting, setAdjusting] = useState(false);
  const { data: balances, isLoading } = useQuery({
    queryKey: ['leave-balance', String(employeeId), year],
    queryFn: () => leaveRequestsApi.balance(employeeId, year),
    enabled: !!employeeId,
  });
  const rows = Array.isArray(balances) ? balances : [];
  const asOf = rows.find((b) => b.accruedAsOf)?.accruedAsOf;

  if (isLoading) return <SkeletonText lines={4} />;
  if (!rows.length) return <EmptyState icon={Scale} title="No leave types configured" />;
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <span style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{asOf ? `Accrued as of ${formatDateIST(asOf)}` : ''}</span>
        {canManage && <Button size="sm" variant="secondary" icon={Scale} onClick={() => setAdjusting(true)}>Adjust balance</Button>}
      </div>
      <div className="table-responsive">
        <table className="table mb-0 align-middle hz-table" aria-label="Leave accrual">
          <thead>
            <tr style={{ fontSize: 'var(--hz-text-xs)', color: 'var(--hz-text-muted)', textTransform: 'uppercase' }}>
              <th>Type</th><th>Accrual</th><th className="text-end">Accrued</th><th className="text-end">Year total</th><th className="text-end">Carried</th>
              <th className="text-end">Adjusted</th><th className="text-end">Used</th><th className="text-end">Encashed</th><th className="text-end">Lapsed</th><th className="text-end">Available</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.leaveTypeId} style={{ fontSize: 'var(--hz-text-sm)' }}>
                <td style={{ fontWeight: 600 }}>{b.leaveTypeName}</td>
                <td>{MODE_LABEL[b.accrualMode] || '—'}</td>
                <td className="text-end">{fmt(b.allocatedDays)}</td>
                <td className="text-end">{b.accrualMode === 'COMP_OFF' ? '—' : fmt(b.annualEntitlementDays)}</td>
                <td className="text-end">{fmt(b.carriedForwardDays)}</td>
                <td className="text-end">{fmt(b.adjustmentDays)}</td>
                <td className="text-end">{fmt(b.usedDays)}</td>
                <td className="text-end">{fmt(b.encashedDays)}</td>
                <td className="text-end">{fmt(b.lapsedDays)}</td>
                <td className="text-end" style={{ fontWeight: 600 }}>
                  {fmt(b.remainingDays)}
                  {b.negativeAllowanceDays > 0 && <div style={{ fontSize: 11, color: 'var(--hz-text-muted)', fontWeight: 400 }}>can go to −{fmt(b.negativeAllowanceDays)}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adjusting && <AdjustBalanceDialog employeeId={employeeId} year={year} balances={rows} onClose={() => setAdjusting(false)} />}
    </>
  );
}

function AdjustBalanceDialog({ employeeId, year, balances, onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ leaveTypeId: '', direction: 'CREDIT', days: '', reason: '' });
  const [error, setError] = useState(null);
  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const adjust = useMutation({
    mutationFn: leavePolicyApi.adjust,
    onSuccess: (r) => {
      toast.success(`Balance adjusted. ${fmt(r.remainingAfter)} day(s) now available.`);
      queryClient.invalidateQueries({ queryKey: ['leave-balance'] });
      queryClient.invalidateQueries({ queryKey: ['leave-ledger'] });
      onClose();
    },
    onError: (err) => setError(err.response?.data?.message || 'Could not adjust the balance'),
  });
  return (
    <Dialog open onClose={onClose} title="Adjust leave balance" description={`Manual correction for ${year}; recorded in the ledger and audit log.`}>
      <form onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const days = Number(form.days) * (form.direction === 'DEBIT' ? -1 : 1);
        adjust.mutate({ employeeId, leaveTypeId: Number(form.leaveTypeId), year, days, reason: form.reason.trim() });
      }}>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <FormField as="select" label="Leave type" required value={form.leaveTypeId} onChange={(v) => set('leaveTypeId', v)}>
          <option value="">Select leave type</option>
          {balances.map((b) => <option key={b.leaveTypeId} value={b.leaveTypeId}>{b.leaveTypeName} ({fmt(b.remainingDays)} available)</option>)}
        </FormField>
        <div className="row g-3">
          <FormField col={6} as="select" label="Type" value={form.direction} onChange={(v) => set('direction', v)}>
            <option value="CREDIT">Add days (+)</option>
            <option value="DEBIT">Deduct days (−)</option>
          </FormField>
          <FormField col={6} label="Days" type="number" min="0.25" step="0.25" required value={form.days} onChange={(v) => set('days', v)} />
        </div>
        <FormField as="textarea" label="Reason" required rows={2} value={form.reason} onChange={(v) => set('reason', v)} placeholder="e.g. Correction for leave approved offline" />
        <div className="d-flex justify-content-end gap-2 mt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={adjust.isPending}>Save adjustment</Button>
        </div>
      </form>
    </Dialog>
  );
}

function LedgerView({ employeeId, year }) {
  const [typeFilter, setTypeFilter] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['leave-ledger', String(employeeId), year],
    queryFn: () => leavePolicyApi.ledger(employeeId, year),
    enabled: !!employeeId,
  });
  const entries = Array.isArray(data) ? data : [];
  const types = useMemo(() => {
    const map = new Map();
    entries.forEach((e) => map.set(String(e.leaveTypeId), e.leaveTypeName));
    return [...map.entries()];
  }, [entries]);
  const shown = entries.filter((e) => !typeFilter || String(e.leaveTypeId) === typeFilter);

  if (isLoading) return <SkeletonText lines={5} />;
  if (!entries.length) return <EmptyState icon={BookOpen} title="No ledger entries" description="Credits and debits for this year will appear here." />;
  return (
    <>
      <div className="d-flex justify-content-end mb-2">
        <select className="form-select form-select-sm" style={{ width: 200 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter ledger by leave type">
          <option value="">All leave types</option>
          {types.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </div>
      <div className="table-responsive">
        <table className="table mb-0 align-middle hz-table" aria-label="Leave balance ledger">
          <thead>
            <tr style={{ fontSize: 'var(--hz-text-xs)', color: 'var(--hz-text-muted)', textTransform: 'uppercase' }}>
              <th>Date</th><th>Type</th><th>Entry</th><th>Details</th><th className="text-end">Credit</th><th className="text-end">Debit</th><th className="text-end">Balance</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((e, index) => (
              <tr key={`${e.leaveTypeId}-${e.kind}-${e.referenceId ?? ''}-${e.date}-${index}`} style={{ fontSize: 'var(--hz-text-sm)' }}>
                <td style={{ whiteSpace: 'nowrap' }}>{formatDateIST(e.date)}</td>
                <td>{e.leaveTypeName}</td>
                <td><Badge variant={e.direction === 'CREDIT' ? 'success' : e.kind === 'LEAVE' ? 'neutral' : 'warning'}>{LEDGER_KIND_LABEL[e.kind] || e.kind}</Badge></td>
                <td style={{ color: 'var(--hz-text-secondary)' }}>{e.description}</td>
                <td className="text-end">{e.direction === 'CREDIT' ? fmt(e.days) : ''}</td>
                <td className="text-end">{e.direction === 'DEBIT' ? fmt(e.days) : ''}</td>
                <td className="text-end" style={{ fontWeight: 600 }}>{fmt(e.balanceAfter)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CompOffSection({ employeeId, canRequest, isSelf }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['comp-off', String(employeeId)],
    queryFn: () => compOffApi.byEmployee(employeeId),
    enabled: !!employeeId,
  });
  const cancel = useMutation({
    mutationFn: compOffApi.cancel,
    onSuccess: () => { toast.success('Comp-off request cancelled.'); queryClient.invalidateQueries({ queryKey: ['comp-off'] }); },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not cancel the request.'),
  });
  const rows = Array.isArray(data) ? data : [];
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <span style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>Worked on a weekly off or holiday? Claim compensatory off; it is credited after approval.</span>
        {canRequest && <Button size="sm" icon={Gift} onClick={() => setOpen(true)}>Claim comp-off</Button>}
      </div>
      {isLoading && <SkeletonText lines={3} />}
      {!isLoading && rows.length === 0 && <EmptyState icon={Gift} title="No comp-off requests" />}
      {!isLoading && rows.length > 0 && (
        <div className="table-responsive">
          <table className="table mb-0 align-middle hz-table" aria-label="Comp-off requests">
            <thead>
              <tr style={{ fontSize: 'var(--hz-text-xs)', color: 'var(--hz-text-muted)', textTransform: 'uppercase' }}>
                <th>Worked on</th><th>Day</th><th className="text-end">Credit</th><th>Expires</th><th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const meta = leaveStatusMeta(r.status);
                return (
                  <tr key={r.id} style={{ fontSize: 'var(--hz-text-sm)' }}>
                    <td>{formatDateIST(r.workDate)}<div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{r.reason}</div></td>
                    <td>{r.dayType === 'HOLIDAY' ? 'Holiday' : 'Weekly off'}</td>
                    <td className="text-end">{fmt(r.days)} day{r.days === 1 ? '' : 's'}</td>
                    <td>{r.expiresOn ? formatDateIST(r.expiresOn) : '—'}</td>
                    <td><Badge variant={meta.variant} dot>{meta.label}</Badge>{r.decisionNote && <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{r.decisionNote}</div>}</td>
                    <td className="text-end">{isSelf && r.status === 'PENDING' && <Button size="sm" variant="secondary" loading={cancel.isPending && cancel.variables === r.id} onClick={() => cancel.mutate(r.id)}>Cancel</Button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {open && <CompOffDialog employeeId={employeeId} onClose={() => setOpen(false)} />}
    </>
  );
}

export function CompOffDialog({ employeeId, onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ workDate: '', duration: 'FULL_DAY', hours: '', reason: '' });
  const [error, setError] = useState(null);
  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const apply = useMutation({
    mutationFn: compOffApi.apply,
    onSuccess: () => {
      toast.success('Comp-off request submitted for approval.');
      queryClient.invalidateQueries({ queryKey: ['comp-off'] });
      onClose();
    },
    onError: (err) => setError(err.response?.data?.message || 'Could not submit the comp-off request'),
  });
  return (
    <Dialog open onClose={onClose} title="Claim comp-off" description="For a weekly off or company holiday you worked on.">
      <form onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        apply.mutate({
          employeeId,
          workDate: form.workDate,
          duration: form.duration,
          hours: form.duration === 'HOURS' ? Number(form.hours) : null,
          reason: form.reason.trim() || null,
        });
      }}>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <div className="row g-3">
          <FormField col={6} label="Date worked" type="date" required max={toISTDateInputValue()} value={form.workDate} onChange={(v) => set('workDate', v)} />
          <FormField col={6} as="select" label="Worked for" value={form.duration} onChange={(v) => set('duration', v)}>
            <option value="FULL_DAY">Full day (1 day credit)</option>
            <option value="HALF_DAY">Half day (0.5 day credit)</option>
            <option value="HOURS">Specific hours</option>
          </FormField>
        </div>
        {form.duration === 'HOURS' && (
          <FormField label="Hours worked" type="number" min="1" max="24" step="0.5" required value={form.hours} onChange={(v) => set('hours', v)} hint="8+ hours = 1 day, 4 to under 8 hours = 0.5 day" />
        )}
        <FormField as="textarea" label="Reason" required rows={2} value={form.reason} onChange={(v) => set('reason', v)} placeholder="What did you work on?" />
        <div className="d-flex justify-content-end gap-2 mt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={apply.isPending}>Submit</Button>
        </div>
      </form>
    </Dialog>
  );
}

function EncashmentSection({ employeeId, canRequest, isSelf, canManage }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['leave-encashments', String(employeeId)],
    queryFn: () => encashmentApi.byEmployee(employeeId),
    enabled: !!employeeId,
  });
  const cancel = useMutation({
    mutationFn: encashmentApi.cancel,
    onSuccess: () => { toast.success('Encashment request cancelled.'); queryClient.invalidateQueries({ queryKey: ['leave-encashments'] }); },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not cancel the request.'),
  });
  const rows = Array.isArray(data) ? data : [];
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <span style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>Approved encashments are deducted from the balance and paid with payroll.</span>
        <div className="d-flex gap-2">
          {canManage && <Button size="sm" variant="secondary" icon={Wallet} onClick={() => setSettlementOpen(true)}>Final settlement preview</Button>}
          {canRequest && <Button size="sm" icon={Coins} onClick={() => setOpen(true)}>Request encashment</Button>}
        </div>
      </div>
      {isLoading && <SkeletonText lines={3} />}
      {!isLoading && rows.length === 0 && <EmptyState icon={Coins} title="No encashment requests" />}
      {!isLoading && rows.length > 0 && (
        <div className="table-responsive">
          <table className="table mb-0 align-middle hz-table" aria-label="Encashment requests">
            <thead>
              <tr style={{ fontSize: 'var(--hz-text-xs)', color: 'var(--hz-text-muted)', textTransform: 'uppercase' }}>
                <th>Requested</th><th>Leave type</th><th className="text-end">Days</th><th className="text-end">Amount</th><th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const meta = leaveStatusMeta(r.status);
                return (
                  <tr key={r.id} style={{ fontSize: 'var(--hz-text-sm)' }}>
                    <td>{formatDateIST(r.createdAt)}</td>
                    <td>{r.leaveTypeName} <span style={{ color: 'var(--hz-text-muted)' }}>({r.leaveYear})</span></td>
                    <td className="text-end">{fmt(r.days)}</td>
                    <td className="text-end">{inr(r.amount)}{r.perDayRate ? <div style={{ fontSize: 11, color: 'var(--hz-text-muted)' }}>{inr(r.perDayRate)}/day · {r.basis}</div> : null}</td>
                    <td><Badge variant={meta.variant} dot>{meta.label}</Badge></td>
                    <td className="text-end">{isSelf && r.status === 'PENDING' && <Button size="sm" variant="secondary" loading={cancel.isPending && cancel.variables === r.id} onClick={() => cancel.mutate(r.id)}>Cancel</Button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {open && <EncashmentDialog employeeId={employeeId} onClose={() => setOpen(false)} />}
      {settlementOpen && <FinalSettlementDialog employeeId={employeeId} onClose={() => setSettlementOpen(false)} />}
    </>
  );
}

function EncashmentDialog({ employeeId, onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const year = new Date().getFullYear();
  const [form, setForm] = useState({ leaveTypeId: '', days: '', reason: '' });
  const [error, setError] = useState(null);
  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const { data: types = [] } = useQuery({ queryKey: ['leave-types'], queryFn: leaveTypesApi.list });
  const { data: balances = [] } = useQuery({
    queryKey: ['leave-balance', String(employeeId), year],
    queryFn: () => leaveRequestsApi.balance(employeeId, year),
  });
  const encashable = types.filter((t) => t.policy?.encashable && !t.policy?.systemManaged);
  const selected = encashable.find((t) => String(t.id) === String(form.leaveTypeId));
  const balance = balances.find((b) => String(b.leaveTypeId) === String(form.leaveTypeId));
  const request = useMutation({
    mutationFn: encashmentApi.request,
    onSuccess: () => {
      toast.success('Encashment request submitted to HR.');
      queryClient.invalidateQueries({ queryKey: ['leave-encashments'] });
      onClose();
    },
    onError: (err) => setError(err.response?.data?.message || 'Could not submit the encashment request'),
  });
  return (
    <Dialog open onClose={onClose} title="Request leave encashment">
      {encashable.length === 0 ? (
        <EmptyState icon={Coins} title="No encashable leave" description="Your organization has not enabled encashment for any leave type." />
      ) : (
        <form onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          request.mutate({ employeeId, leaveTypeId: Number(form.leaveTypeId), days: Number(form.days), reason: form.reason.trim() || null });
        }}>
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <FormField as="select" label="Leave type" required value={form.leaveTypeId} onChange={(v) => set('leaveTypeId', v)}
            hint={balance ? `${fmt(balance.remainingDays)} day(s) available${selected?.policy?.maxEncashableDaysPerYear ? ` · up to ${fmt(selected.policy.maxEncashableDaysPerYear)} per year` : ''}` : undefined}>
            <option value="">Select leave type</option>
            {encashable.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </FormField>
          <FormField label="Days" type="number" min="0.5" step="0.5" required value={form.days} onChange={(v) => set('days', v)}
            hint={selected ? `Paid at monthly ${selected.policy?.encashmentBasis === 'GROSS' ? 'gross' : 'basic'} salary / 30 per day` : undefined} />
          <FormField as="textarea" label="Reason (optional)" rows={2} value={form.reason} onChange={(v) => set('reason', v)} />
          <div className="d-flex justify-content-end gap-2 mt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={request.isPending}>Submit</Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function FinalSettlementDialog({ employeeId, onClose }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['leave-final-settlement', String(employeeId)],
    queryFn: () => leavePolicyApi.finalSettlement(employeeId),
  });
  return (
    <Dialog open onClose={onClose} title="Final settlement – leave encashment" size="lg" description={data ? `${data.employeeName} · balances as of ${formatDateIST(data.asOf)}` : undefined}>
      {isLoading && <SkeletonText lines={3} />}
      {isError && <ErrorBanner>Couldn't load the settlement preview.</ErrorBanner>}
      {data && (
        <>
          {data.lines.length === 0 ? (
            <EmptyState icon={Wallet} title="No encashable leave types" description="Mark a leave type (e.g. Earned Leave) as encashable in Leave Configuration." />
          ) : (
            <table className="table mb-2 align-middle hz-table" aria-label="Final settlement leave encashment">
              <thead>
                <tr style={{ fontSize: 'var(--hz-text-xs)', color: 'var(--hz-text-muted)', textTransform: 'uppercase' }}>
                  <th>Leave type</th><th className="text-end">Remaining</th><th className="text-end">Encashable</th><th className="text-end">Per day</th><th className="text-end">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((l) => (
                  <tr key={l.leaveTypeId} style={{ fontSize: 'var(--hz-text-sm)' }}>
                    <td>{l.leaveTypeName} <span style={{ color: 'var(--hz-text-muted)' }}>({l.basis})</span></td>
                    <td className="text-end">{fmt(l.remainingDays)}</td>
                    <td className="text-end">{fmt(l.encashableDays)}</td>
                    <td className="text-end">{inr(l.perDayRate)}</td>
                    <td className="text-end">{inr(l.amount)}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 600 }}>
                  <td colSpan={4}>Total</td>
                  <td className="text-end">{inr(data.totalAmount)}</td>
                </tr>
              </tbody>
            </table>
          )}
          <p style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{data.note}</p>
        </>
      )}
    </Dialog>
  );
}
