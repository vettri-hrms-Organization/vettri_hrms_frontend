import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Pencil, Plus } from 'lucide-react';
import { axiosClient } from '../../../api/axiosClient';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import Dialog from '../../../components/ui/Dialog';
import FormField from '../../../components/ui/FormField';
import { SkeletonText } from '../../../components/ui/Skeleton';
import { useToast } from '../../../components/ui/Toast';
import { formatCurrency } from '../../../utils/formatCurrency';

const lwfApi = {
  rules: () => axiosClient.get('/api/salary/lwf/rules').then((res) => res.data),
  states: () => axiosClient.get('/api/salary/lwf/states').then((res) => res.data),
  add: (stateCode) => axiosClient.post('/api/salary/lwf/rules', { stateCode }).then((res) => res.data),
  update: (rule) => axiosClient.put(`/api/salary/lwf/rules/${rule.id}`, rule).then((res) => res.data),
  summary: (period) => axiosClient.get('/api/salary/lwf/return', { params: { period } }).then((res) => res.data),
  downloadReturn: async (period) => {
    const res = await axiosClient.get('/api/salary/lwf/return.csv', { params: { period }, responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lwf-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthsLabel = (m) => (m === 'ALL' ? 'Every month' : m.split(',').map((x) => MONTHS[Number(x) - 1]).join(', '));
const employeeShare = (r) => (Number(r.employeeFixed) > 0 ? formatCurrency(r.employeeFixed)
  : `${r.employeePercent}% of wages${r.employeeMax ? ` (max ${formatCurrency(r.employeeMax)})` : ''}`);
const employerShare = (r) => (Number(r.employerFixed) > 0 ? formatCurrency(r.employerFixed) : `${r.employerMultiplier}× employee share`);
const lastMonth = () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

/** Labour Welfare Fund: per-state rules (editable) and the monthly return. */
export default function LwfCard() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const rules = useQuery({ queryKey: ['lwf-rules'], queryFn: lwfApi.rules });
  const states = useQuery({ queryKey: ['lwf-states'], queryFn: lwfApi.states });
  const [adding, setAdding] = useState('');
  const [editing, setEditing] = useState(null);
  const [period, setPeriod] = useState(lastMonth());
  const summary = useQuery({ queryKey: ['lwf-return', period], queryFn: () => lwfApi.summary(period), enabled: /^\d{4}-\d{2}$/.test(period) });
  const add = useMutation({
    mutationFn: lwfApi.add,
    onSuccess: (r) => { ['lwf-rules', 'lwf-states'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] })); setAdding(''); toast.success(`${r.stateName} added. Check the amounts against the current notification.`); },
    onError: (err) => toast.error(err?.response?.data?.message || 'Could not add the state.'),
  });
  const available = (states.data || []).filter((s) => !s.added);
  return (
    <Card title="Labour Welfare Fund (LWF)" subtitle="Deducted in each state's contribution months from employees whose office is in that state">
      <div className="p-2 mb-3" style={{ fontSize: 12.5, background: 'var(--hz-warning-50)', borderRadius: 10 }}>
        Rates are pre-filled from published state rules but are revised from time to time. Check each state against its latest Labour Welfare Board notification before the first deduction, and edit if needed.
      </div>
      {rules.isLoading ? <SkeletonText lines={3} /> : (rules.data || []).length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--hz-text-muted)' }}>No states added - LWF isn't deducted. Add the states where you have employees.</p>
      ) : (
        <div className="table-responsive mb-3">
          <table className="table table-sm align-middle mb-0" style={{ fontSize: 13 }}>
            <thead><tr><th>State</th><th>Deducted in</th><th>Employee</th><th>Employer</th><th>Status</th><th aria-label="Edit" /></tr></thead>
            <tbody>
              {rules.data.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.stateName}</strong></td>
                  <td>{monthsLabel(r.deductionMonths)}</td>
                  <td>{employeeShare(r)}</td>
                  <td>{employerShare(r)}</td>
                  <td><Badge variant={r.active ? 'success' : 'neutral'}>{r.active ? 'On' : 'Off'}</Badge></td>
                  <td className="text-end"><button type="button" className="btn btn-sm btn-light border-0" aria-label={`Edit ${r.stateName}`} onClick={() => setEditing(r)}><Pencil size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {available.length > 0 && (
        <div className="d-flex gap-2 align-items-end flex-wrap mb-3">
          <FormField as="select" label="Add a state" value={adding} onChange={setAdding}>
            <option value="">Choose…</option>
            {available.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </FormField>
          <Button className="mb-3" icon={Plus} disabled={!adding} loading={add.isPending} onClick={() => add.mutate(adding)}>Add</Button>
        </div>
      )}
      <div className="d-flex gap-3 align-items-end flex-wrap pt-2" style={{ borderTop: '1px solid var(--hz-border)' }}>
        <FormField type="month" label="LWF return for" value={period} onChange={setPeriod} />
        {summary.data && (
          <div className="mb-3" style={{ fontSize: 13 }}>
            {summary.data.employees} employee{summary.data.employees === 1 ? '' : 's'} · employee {formatCurrency(summary.data.employeeTotal)} · employer {formatCurrency(summary.data.employerTotal)}
          </div>
        )}
        <Button className="mb-3" variant="secondary" icon={Download} disabled={!summary.data?.employees}
          onClick={() => lwfApi.downloadReturn(period).catch(() => toast.error('Could not download the LWF return.'))}>Download return</Button>
      </div>
      {editing && <RuleDialog rule={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function RuleDialog({ rule, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...rule, employeeMax: rule.employeeMax ?? '', minWages: rule.minWages ?? '', maxWages: rule.maxWages ?? '' });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const num = (v) => (v === '' || v === null ? null : Number(v));
  const save = useMutation({
    mutationFn: () => lwfApi.update({ ...form, employeeFixed: num(form.employeeFixed) ?? 0, employeePercent: num(form.employeePercent) ?? 0, employeeMax: num(form.employeeMax),
      employerFixed: num(form.employerFixed) ?? 0, employerMultiplier: num(form.employerMultiplier) ?? 0, minWages: num(form.minWages), maxWages: num(form.maxWages) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lwf-rules'] }); toast.success('LWF rule saved.'); onClose(); },
    onError: (err) => toast.error(err?.response?.data?.message || 'Could not save.'),
  });
  return (
    <Dialog open onClose={onClose} title={`LWF - ${rule.stateName}`} size="md"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
      <div className="row g-3">
        <FormField col={12} label="Deduction months" value={form.deductionMonths} onChange={(v) => set('deductionMonths', v)} hint='"ALL" or month numbers, e.g. 6,12 for June and December' />
        <FormField col={4} type="number" label="Employee ₹ (fixed)" value={form.employeeFixed} onChange={(v) => set('employeeFixed', v)} min={0} step="0.01" />
        <FormField col={4} type="number" label="or % of wages" value={form.employeePercent} onChange={(v) => set('employeePercent', v)} min={0} step="0.01" />
        <FormField col={4} type="number" label="Max ₹" value={form.employeeMax} onChange={(v) => set('employeeMax', v)} min={0} step="0.01" />
        <FormField col={6} type="number" label="Employer ₹ (fixed)" value={form.employerFixed} onChange={(v) => set('employerFixed', v)} min={0} step="0.01" />
        <FormField col={6} type="number" label="or × employee share" value={form.employerMultiplier} onChange={(v) => set('employerMultiplier', v)} min={0} step="0.1" />
        <FormField col={6} type="number" label="Only if wages at least ₹" value={form.minWages} onChange={(v) => set('minWages', v)} min={0} />
        <FormField col={6} type="number" label="Only if wages at most ₹" value={form.maxWages} onChange={(v) => set('maxWages', v)} min={0} />
        <div className="col-12">
          <label className="form-check d-inline-flex align-items-center gap-2"><input type="checkbox" className="form-check-input m-0" checked={form.active} onChange={(e) => set('active', e.target.checked)} /> Deduct LWF for this state</label>
        </div>
      </div>
    </Dialog>
  );
}
