import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Tags } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Dialog from '../../components/ui/Dialog';
import FormField from '../../components/ui/FormField';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { expensesApi } from '../../api/endpoints/expenses';
import { formatCurrency } from '../../utils/formatCurrency';
import { apiErrorMessage } from './expenseMeta';

const EMPTY = { name: '', active: true, perClaimLimit: '', limitAction: 'WARN', receiptRequiredAbove: '', receiptAction: 'WARN', mileageRatePerKm: '', sortOrder: '' };

function toForm(category) {
  if (!category) return EMPTY;
  return {
    name: category.name,
    active: category.active,
    perClaimLimit: category.perClaimLimit ?? '',
    limitAction: category.limitAction || 'WARN',
    receiptRequiredAbove: category.receiptRequiredAbove ?? '',
    receiptAction: category.receiptAction || 'WARN',
    mileageRatePerKm: category.mileageRatePerKm ?? '',
    sortOrder: category.sortOrder ?? '',
  };
}

const num = (value) => (value === '' || value == null ? null : Number(value));

export default function ExpenseSettings() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // null | 'new' | category
  const [form, setForm] = useState(EMPTY);

  const categories = useQuery({ queryKey: ['expense-categories', 'all'], queryFn: () => expensesApi.categories(true) });
  const settings = useQuery({ queryKey: ['expense-settings'], queryFn: expensesApi.settings });

  const saveSettings = useMutation({
    mutationFn: (reimbursementMode) => expensesApi.updateSettings({ reimbursementMode }),
    onSuccess: () => { toast.success('Reimbursement setting saved.'); queryClient.invalidateQueries({ queryKey: ['expense-settings'] }); },
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not save the setting.')),
  });

  const saveCategory = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        active: !!form.active,
        perClaimLimit: num(form.perClaimLimit),
        limitAction: form.limitAction,
        receiptRequiredAbove: num(form.receiptRequiredAbove),
        receiptAction: form.receiptAction,
        mileageRatePerKm: num(form.mileageRatePerKm),
        sortOrder: num(form.sortOrder),
      };
      return editing === 'new' ? expensesApi.createCategory(payload) : expensesApi.updateCategory(editing.id, payload);
    },
    onSuccess: () => {
      toast.success('Category saved.');
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
    },
    onError: (error) => toast.error(apiErrorMessage(error, 'Could not save the category.')),
  });

  const openEditor = (category) => { setEditing(category || 'new'); setForm(toForm(category)); };
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  const list = Array.isArray(categories.data) ? categories.data : [];
  const mode = settings.data?.reimbursementMode || 'SEPARATE';

  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Settings" title="Expense settings" description="Categories, per-claim limits, receipt rules, and how approved claims are paid" />

      <Card title="Reimbursement" subtitle="How approved claims reach employees">
        <div className="d-flex flex-column gap-2" role="radiogroup" aria-label="Reimbursement mode">
          {[
            { value: 'PAYROLL', label: 'Reimburse through payroll', hint: 'Approved claims are added to the next payroll run as a non-taxable reimbursement.' },
            { value: 'SEPARATE', label: 'Pay separately', hint: 'Finance pays approved claims outside payroll and records the payment reference.' },
          ].map((option) => (
            <label key={option.value} className="d-flex gap-2 align-items-start" style={{ cursor: 'pointer' }}>
              <input type="radio" name="reimbursementMode" className="form-check-input mt-1" checked={mode === option.value} disabled={settings.isLoading || saveSettings.isPending} onChange={() => saveSettings.mutate(option.value)} />
              <span><strong>{option.label}</strong><br /><small style={{ color: 'var(--hz-text-muted)' }}>{option.hint}</small></span>
            </label>
          ))}
        </div>
      </Card>

      <Card title="Categories" subtitle="WARN lets a claim through with a note for approvers; BLOCK stops submission." actions={<Button size="sm" icon={Plus} onClick={() => openEditor(null)}>Add category</Button>} bodyClassName="p-0">
        {categories.isLoading && <div className="p-4"><SkeletonText lines={5} /></div>}
        {categories.isError && <ErrorState description="Couldn't load expense categories." onRetry={categories.refetch} />}
        {!categories.isLoading && !categories.isError && list.length === 0 && <EmptyState icon={Tags} title="No categories" description="Add a category to start accepting claims." />}
        {list.length > 0 && (
          <div className="table-responsive">
            <table className="table mb-0 align-middle hz-table" aria-label="Expense categories">
              <thead>
                <tr style={{ fontSize: 'var(--hz-text-xs)', color: 'var(--hz-text-muted)', textTransform: 'uppercase' }}>
                  <th className="ps-4">Category</th>
                  <th>Per-claim limit</th>
                  <th>Receipt required above</th>
                  <th>Mileage rate</th>
                  <th>Status</th>
                  <th className="pe-4 text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((category) => (
                  <tr key={category.id}>
                    <td className="ps-4" style={{ fontWeight: 600, fontSize: 'var(--hz-text-sm)' }}>{category.name}</td>
                    <td style={{ fontSize: 'var(--hz-text-sm)' }}>{category.perClaimLimit != null ? `${formatCurrency(category.perClaimLimit)} · ${category.limitAction}` : 'No limit'}</td>
                    <td style={{ fontSize: 'var(--hz-text-sm)' }}>{category.receiptRequiredAbove != null ? `${formatCurrency(category.receiptRequiredAbove)} · ${category.receiptAction}` : 'Not required'}</td>
                    <td style={{ fontSize: 'var(--hz-text-sm)' }}>{category.mileageRatePerKm != null ? `${formatCurrency(category.mileageRatePerKm)}/km` : '—'}</td>
                    <td><StatusBadge status={category.active ? 'ACTIVE' : 'INACTIVE'} /></td>
                    <td className="pe-4 text-end"><Button size="sm" variant="secondary" icon={Pencil} onClick={() => openEditor(category)} aria-label={`Edit ${category.name}`}>Edit</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add expense category' : 'Edit expense category'}>
        <form onSubmit={(event) => { event.preventDefault(); saveCategory.mutate(); }}>
          <div className="row">
            <FormField col={8} label="Name" required maxLength={100} value={form.name} onChange={set('name')} />
            <FormField col={4} type="number" label="Sort order" value={form.sortOrder} onChange={set('sortOrder')} />
            <FormField col={6} type="number" min="0.01" step="0.01" label="Per-claim limit (₹)" hint="Leave blank for no limit" value={form.perClaimLimit} onChange={set('perClaimLimit')} />
            <FormField col={6} as="select" label="When the limit is exceeded" value={form.limitAction} onChange={set('limitAction')}>
              <option value="WARN">Warn approvers</option>
              <option value="BLOCK">Block submission</option>
            </FormField>
            <FormField col={6} type="number" min="0" step="0.01" label="Receipt required above (₹)" hint="Leave blank if receipts are optional" value={form.receiptRequiredAbove} onChange={set('receiptRequiredAbove')} />
            <FormField col={6} as="select" label="When the receipt is missing" value={form.receiptAction} onChange={set('receiptAction')}>
              <option value="WARN">Warn approvers</option>
              <option value="BLOCK">Block submission</option>
            </FormField>
            <FormField col={6} type="number" min="0.01" step="0.01" label="Mileage rate per km (₹)" hint="Optional - fixes the rate for mileage lines" value={form.mileageRatePerKm} onChange={set('mileageRatePerKm')} />
            <div className="col-12 col-md-6 mb-3 d-flex align-items-end">
              <div className="form-check">
                <input id="expense-category-active" type="checkbox" className="form-check-input" checked={!!form.active} onChange={(event) => set('active')(event.target.checked)} />
                <label htmlFor="expense-category-active" className="form-check-label">Active (available on new claims)</label>
              </div>
            </div>
          </div>
          <div className="d-flex justify-content-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" loading={saveCategory.isPending} disabled={!form.name.trim()}>Save category</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
