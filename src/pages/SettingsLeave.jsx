import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Zap, SlidersHorizontal } from 'lucide-react';
import { leaveTypesApi, leavePolicyApi } from '../api/endpoints/leave';
import LeavePolicyDialog from './leave/LeavePolicyDialog';
import HolidaySettingsPanel from './leave/HolidaySettingsPanel';
import YearEndProcessing from './leave/YearEndProcessing';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonText } from '../components/ui/Skeleton';
import PageHeader from '../components/ui/PageHeader';
import Tabs from '../components/ui/Tabs';

const TABS = [
  { key: 'types', label: 'Leave Types' },
  { key: 'holidays', label: 'Holiday Calendar' },
  { key: 'yearend', label: 'Year-end Processing' },
];

export default function SettingsLeave() {
  const [tab, setTab] = useState('types');

  return (
    <div className="hz-admin-page hz-admin-page--leave-settings hz-settings-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Settings" title="Leave Configuration" description="Leave types set default allocations; the holiday calendar keeps leave-day counting accurate" />

      <Tabs items={TABS} value={tab} onChange={setTab} />

      {tab === 'types' && <LeaveTypesPanel />}
      {tab === 'holidays' && <HolidaySettingsPanel />}
      {tab === 'yearend' && <YearEndProcessing />}
    </div>
  );
}

function LeaveTypesPanel() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [policyType, setPolicyType] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', defaultDaysPerYear: '', carryForward: false, autoApprove: false, unpaid: false });

  const { data: types, isLoading } = useQuery({ queryKey: ['leave-types'], queryFn: leaveTypesApi.list });
  const create = useMutation({
    mutationFn: leaveTypesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
      setForm({ name: '', code: '', defaultDaysPerYear: '', carryForward: false, autoApprove: false, unpaid: false });
      setShowForm(false);
    },
  });
  const update = useMutation({
    mutationFn: ({ id, payload }) => leaveTypesApi.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave-types'] }),
  });
  const enableCompOff = useMutation({
    mutationFn: leavePolicyApi.ensureCompOffType,
    onSuccess: (type) => { queryClient.invalidateQueries({ queryKey: ['leave-types'] }); setPolicyType(type); },
  });
  const hasCompOff = types?.some((t) => t.policy?.systemManaged);

  return (
    <Card
      title="Leave Types"
      actions={
        <div className="d-flex gap-2">
          {!isLoading && !hasCompOff && (
            <Button size="sm" variant="secondary" loading={enableCompOff.isPending} onClick={() => enableCompOff.mutate()}>Enable comp-off</Button>
          )}
          <Button size="sm" variant="secondary" icon={Plus} onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Close' : 'Add'}
          </Button>
        </div>
      }
    >
      {showForm && (
        <form
          className="row g-2 align-items-end mb-4 pb-3"
          style={{ borderBottom: '1px solid var(--hz-border)' }}
          onSubmit={(e) => {
            e.preventDefault();
            const { unpaid, ...rest } = form;
            create.mutate({ ...rest, paid: !unpaid, defaultDaysPerYear: Number(form.defaultDaysPerYear) });
          }}
        >
          <div className="col-3">
            <input className="form-control" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="col-2">
            <input className="form-control" placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          </div>
          <div className="col-2">
            <input
              className="form-control"
              type="number"
              placeholder="Days/year"
              value={form.defaultDaysPerYear}
              onChange={(e) => setForm({ ...form, defaultDaysPerYear: e.target.value })}
              required
            />
          </div>
          <div className="col-3 d-flex align-items-center gap-2 pb-2">
            <input
              type="checkbox"
              className="form-check-input"
              id="carryForward"
              checked={form.carryForward}
              onChange={(e) => setForm({ ...form, carryForward: e.target.checked })}
            />
            <label htmlFor="carryForward" style={{ fontSize: 'var(--hz-text-sm)' }}>
              Carry forward
            </label>
          </div>
          <div className="col-3 d-flex align-items-center gap-2 pb-2">
            <input type="checkbox" className="form-check-input" id="autoApprove" checked={form.autoApprove} onChange={(e) => setForm({ ...form, autoApprove: e.target.checked })} />
            <label htmlFor="autoApprove" style={{ fontSize: 'var(--hz-text-sm)' }}>Auto-approve</label>
          </div>
          {/* Approved days of an unpaid type are deducted from salary in the next payroll run. */}
          <div className="col-3 d-flex align-items-center gap-2 pb-2">
            <input type="checkbox" className="form-check-input" id="unpaidLeave" checked={form.unpaid} onChange={(e) => setForm({ ...form, unpaid: e.target.checked })} />
            <label htmlFor="unpaidLeave" style={{ fontSize: 'var(--hz-text-sm)' }}>Unpaid leave (loss of pay)</label>
          </div>
          <div className="col-2">
            <Button type="submit" size="sm" loading={create.isPending} className="w-100 justify-content-center">
              Add
            </Button>
          </div>
        </form>
      )}

      {isLoading && <SkeletonText lines={3} />}
      {!isLoading && types?.length === 0 && <EmptyState title="No leave types yet" />}
      {!isLoading &&
        types?.map((t) => (
          <div key={t.id} className="d-flex align-items-center justify-content-between py-2" style={{ borderBottom: '1px solid var(--hz-border)' }}>
            <div>
              <div style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 600 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{t.code}</div>
            </div>
            <div className="d-flex align-items-center gap-2">
              {t.policy?.systemManaged ? (
                <span style={{ fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-secondary)' }}>Credited by approved comp-off · expires after {t.policy?.creditExpiryDays ?? 90} days</span>
              ) : (
                <span style={{ fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-secondary)' }}>{t.defaultDaysPerYear} days/year</span>
              )}
              {t.policy?.accrualMode && t.policy.accrualMode !== 'YEARLY_UPFRONT' && !t.policy?.systemManaged && <Badge variant="neutral">{t.policy.accrualMode === 'MONTHLY' ? 'Monthly accrual' : 'Quarterly accrual'}</Badge>}
              {t.policy?.encashable && <Badge variant="success">Encashable</Badge>}
              {t.carryForward && <Badge variant="info">Carries forward</Badge>}
              {t.paid === false && <Badge variant="warning">Loss of pay</Badge>}
              <Button size="sm" variant="secondary" icon={SlidersHorizontal} onClick={() => setPolicyType(t)} aria-label={`Edit ${t.name} policy`}>Policy</Button>
              {!t.policy?.systemManaged && <button
                type="button"
                className={`btn btn-sm d-inline-flex align-items-center gap-1 ${t.autoApprove ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => update.mutate({
                  id: t.id,
                  payload: {
                    name: t.name,
                    code: t.code,
                    defaultDaysPerYear: t.defaultDaysPerYear,
                    carryForward: t.carryForward,
                    autoApprove: !t.autoApprove,
                  },
                })}
                disabled={update.isPending && update.variables?.id === t.id}
                aria-pressed={Boolean(t.autoApprove)}
                title={t.autoApprove ? 'Disable automatic approval' : 'Enable automatic approval'}
              >
                <Zap size={13} /> {t.autoApprove ? 'Auto-approve' : 'Manual approval'}
              </button>}
            </div>
          </div>
        ))}
      {policyType && <LeavePolicyDialog type={policyType} onClose={() => setPolicyType(null)} />}
    </Card>
  );
}
