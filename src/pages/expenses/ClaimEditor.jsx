import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Paperclip, Send, Save, Camera } from 'lucide-react';
import Dialog from '../../components/ui/Dialog';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { useToast } from '../../components/ui/Toast';
import { expensesApi } from '../../api/endpoints/expenses';
import { formatCurrency } from '../../utils/formatCurrency';
import { toISTDateInputValue } from '../../utils/formatDateTime';
import { apiErrorMessage, lineSignature, receiptFileError } from './expenseMeta';

let tempKeySeed = 0;
const newKey = () => `new-${Date.now()}-${tempKeySeed++}`;

function emptyLine(categoryId) {
  return { key: newKey(), id: null, expenseDate: toISTDateInputValue(), categoryId: categoryId ?? '', description: '', amount: '', useMileage: false, mileageKm: '', mileageRate: '', hasReceipt: false, receiptFileName: null, pendingFile: null };
}

function fromClaimLine(line) {
  return {
    key: `line-${line.id}`,
    id: line.id,
    expenseDate: line.expenseDate,
    categoryId: line.categoryId,
    description: line.description || '',
    amount: line.mileageKm != null ? '' : String(line.amount ?? ''),
    useMileage: line.mileageKm != null,
    mileageKm: line.mileageKm != null ? String(line.mileageKm) : '',
    mileageRate: line.mileageRate != null ? String(line.mileageRate) : '',
    hasReceipt: line.hasReceipt,
    receiptFileName: line.receiptFileName,
    pendingFile: null,
  };
}

/** Line amount as the backend will compute it (mileage uses the category rate when one is set). */
export function previewAmount(line, category) {
  if (line.useMileage) {
    const rate = category?.mileageRatePerKm != null ? Number(category.mileageRatePerKm) : Number(line.mileageRate || 0);
    return Math.round(Number(line.mileageKm || 0) * rate * 100) / 100;
  }
  return Number(line.amount || 0);
}

/** Create / edit a draft claim with lines and receipts, then save or submit. */
export default function ClaimEditor({ claim, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useQuery({ queryKey: ['expense-categories'], queryFn: () => expensesApi.categories() });
  const [title, setTitle] = useState(claim?.title || '');
  const [purpose, setPurpose] = useState(claim?.purpose || '');
  const [lines, setLines] = useState(() => (claim?.lines?.length ? claim.lines.map(fromClaimLine) : [emptyLine()]));
  const [claimId, setClaimId] = useState(claim?.id ?? null);
  const [dirty, setDirty] = useState(false);

  const categoryById = useMemo(() => Object.fromEntries(categories.map((category) => [String(category.id), category])), [categories]);
  const total = lines.reduce((sum, line) => sum + previewAmount(line, categoryById[String(line.categoryId)]), 0);

  const updateLine = (key, patch) => {
    setDirty(true);
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const payload = () => ({
    title: title.trim(),
    purpose: purpose.trim() || null,
    lines: lines.map((line) => ({
      id: line.id,
      expenseDate: line.expenseDate,
      categoryId: line.categoryId ? Number(line.categoryId) : null,
      description: line.description.trim() || null,
      amount: line.useMileage ? null : (line.amount === '' ? null : Number(line.amount)),
      mileageKm: line.useMileage && line.mileageKm !== '' ? Number(line.mileageKm) : null,
      mileageRate: line.useMileage && line.mileageRate !== '' ? Number(line.mileageRate) : null,
    })),
  });

  const save = useMutation({
    mutationFn: async ({ thenSubmit }) => {
      const body = payload();
      let saved = claimId ? await expensesApi.update(claimId, body) : await expensesApi.create(body);
      // Attach receipts chosen before the line existed on the server.
      const pending = lines.filter((line) => line.pendingFile);
      let unmatched = 0;
      for (const line of pending) {
        const target = line.id
          ? saved.lines.find((candidate) => candidate.id === line.id)
          : saved.lines.find((candidate) => lineSignature(candidate) === lineSignature(payload().lines[lines.indexOf(line)]));
        if (!target) { unmatched += 1; continue; }
        saved = await expensesApi.uploadReceipt(saved.id, target.id, line.pendingFile);
      }
      if (thenSubmit) saved = await expensesApi.submit(saved.id);
      return { saved, unmatched, thenSubmit };
    },
    onSuccess: ({ saved, unmatched, thenSubmit }) => {
      queryClient.invalidateQueries({ queryKey: ['expense-claims-my'] });
      setClaimId(saved.id);
      setLines(saved.lines.length ? saved.lines.map(fromClaimLine) : [emptyLine()]);
      setDirty(false);
      if (unmatched) toast.error('Some receipts could not be matched to their lines. Please attach them again.');
      if (thenSubmit) {
        const warnings = saved.policyIssues?.length || 0;
        toast.success(warnings ? `Claim submitted with ${warnings} policy note(s) for your approver.` : 'Claim submitted for approval.');
        onClose();
      } else {
        toast.success('Draft saved.');
      }
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ['expense-claims-my'] });
      toast.error(apiErrorMessage(error, 'Could not save the claim.'));
    },
  });

  const chooseFile = (line, file) => {
    const problem = receiptFileError(file);
    if (problem) { toast.error(problem); return; }
    updateLine(line.key, { pendingFile: file });
  };

  const canSave = title.trim() && lines.length > 0 && !save.isPending;

  return (
    <Dialog open onClose={onClose} size="xl" title={claimId ? 'Edit expense claim' : 'New expense claim'} description="Add each expense as a line. Receipts can be PDF, JPG or PNG up to 10 MB." hasUnsavedChanges={dirty}>
      <form onSubmit={(event) => { event.preventDefault(); if (canSave) save.mutate({ thenSubmit: false }); }}>
        <div className="row">
          <FormField col={6} label="Title" required value={title} maxLength={200} onChange={(value) => { setTitle(value); setDirty(true); }} placeholder="e.g. Client visit – Chennai" />
          <FormField col={6} label="Purpose" value={purpose} maxLength={1000} onChange={(value) => { setPurpose(value); setDirty(true); }} placeholder="Business reason for these expenses" />
        </div>

        <div className="d-flex flex-column gap-3">
          {lines.map((line, index) => {
            const category = categoryById[String(line.categoryId)];
            const companyRate = category?.mileageRatePerKm;
            return (
              <fieldset key={line.key} className="border rounded p-3" aria-label={`Expense line ${index + 1}`}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <legend className="fs-6 mb-0" style={{ fontWeight: 600, width: 'auto' }}>Line {index + 1}</legend>
                  <button type="button" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" disabled={lines.length === 1} onClick={() => { setDirty(true); setLines((current) => current.filter((item) => item.key !== line.key)); }} aria-label={`Remove line ${index + 1}`}>
                    <Trash2 size={14} aria-hidden="true" /> Remove
                  </button>
                </div>
                <div className="row">
                  <FormField col={3} type="date" label="Date" required value={line.expenseDate} max={toISTDateInputValue()} onChange={(value) => updateLine(line.key, { expenseDate: value })} />
                  <FormField col={3} as="select" label="Category" required value={line.categoryId} onChange={(value) => updateLine(line.key, { categoryId: value })}>
                    <option value="">Select…</option>
                    {categories.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                  </FormField>
                  <FormField col={6} label="Description" value={line.description} maxLength={500} onChange={(value) => updateLine(line.key, { description: value })} placeholder="What was this for?" />
                </div>
                <div className="form-check mb-2">
                  <input className="form-check-input" type="checkbox" id={`mileage-${line.key}`} checked={line.useMileage} onChange={(event) => updateLine(line.key, { useMileage: event.target.checked })} />
                  <label className="form-check-label" htmlFor={`mileage-${line.key}`}>Mileage claim (distance × rate)</label>
                </div>
                <div className="row align-items-end">
                  {line.useMileage ? (
                    <>
                      <FormField col={3} type="number" min="0.1" step="0.1" label="Distance (km)" required value={line.mileageKm} onChange={(value) => updateLine(line.key, { mileageKm: value })} />
                      {companyRate != null ? (
                        <div className="col-12 col-md-3 mb-3" style={{ fontSize: 'var(--hz-text-sm)' }}>Company rate: <strong>{formatCurrency(companyRate)}/km</strong></div>
                      ) : (
                        <FormField col={3} type="number" min="0.01" step="0.01" label="Rate per km (₹)" required value={line.mileageRate} onChange={(value) => updateLine(line.key, { mileageRate: value })} />
                      )}
                    </>
                  ) : (
                    <FormField col={3} type="number" min="0.01" step="0.01" label="Amount (₹)" required value={line.amount} onChange={(value) => updateLine(line.key, { amount: value })} />
                  )}
                  <div className="col-12 col-md-3 mb-3" style={{ fontSize: 'var(--hz-text-sm)' }}>
                    Line total: <strong>{formatCurrency(previewAmount(line, category))}</strong>
                    {category?.receiptRequiredAbove != null && previewAmount(line, category) > Number(category.receiptRequiredAbove) && !line.hasReceipt && !line.pendingFile && (
                      <div style={{ color: 'var(--hz-warning-600, #b45309)', fontSize: 12 }}>Receipt needed above {formatCurrency(category.receiptRequiredAbove)}</div>
                    )}
                  </div>
                  <div className="col-12 col-md-3 mb-3">
                    <label className="hz-form-label d-flex align-items-center gap-1" htmlFor={`receipt-${line.key}`}><Paperclip size={14} aria-hidden="true" /> Receipt</label>
                    <input id={`receipt-${line.key}`} type="file" className="form-control form-control-sm" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => chooseFile(line, event.target.files?.[0])} />
                    {/* Phones: open the rear camera straight away to photograph the receipt. */}
                    <label className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1 mt-1" htmlFor={`receipt-camera-${line.key}`}>
                      <Camera size={14} aria-hidden="true" /> Photograph receipt
                    </label>
                    <input id={`receipt-camera-${line.key}`} type="file" className="d-none" accept="image/*" capture="environment" onChange={(event) => chooseFile(line, event.target.files?.[0])} />
                    <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>
                      {line.pendingFile ? `Will upload: ${line.pendingFile.name}` : line.hasReceipt ? `Attached: ${line.receiptFileName || 'receipt'}` : 'No receipt attached'}
                    </div>
                  </div>
                </div>
              </fieldset>
            );
          })}
        </div>

        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-3">
          <Button variant="secondary" icon={Plus} onClick={() => { setDirty(true); setLines((current) => [...current, emptyLine(current[current.length - 1]?.categoryId)]); }} disabled={lines.length >= 50}>Add line</Button>
          <div style={{ fontWeight: 700 }}>Total: {formatCurrency(total)}</div>
        </div>

        <div className="d-flex justify-content-end gap-2 mt-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="secondary" icon={Save} loading={save.isPending && !save.variables?.thenSubmit} disabled={!canSave}>Save draft</Button>
          <Button icon={Send} loading={save.isPending && !!save.variables?.thenSubmit} disabled={!canSave} onClick={() => save.mutate({ thenSubmit: true })}>Submit for approval</Button>
        </div>
      </form>
    </Dialog>
  );
}
