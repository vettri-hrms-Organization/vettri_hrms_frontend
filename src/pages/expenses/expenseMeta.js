export const EXPENSE_STATUS = {
  DRAFT: { label: 'Draft', variant: 'neutral' },
  SUBMITTED: { label: 'Awaiting manager', variant: 'warning' },
  MANAGER_APPROVED: { label: 'Awaiting finance', variant: 'info' },
  APPROVED: { label: 'Approved', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  REIMBURSED: { label: 'Reimbursed', variant: 'success' },
};

export const EXPENSE_STATUS_OPTIONS = Object.entries(EXPENSE_STATUS).map(([value, meta]) => ({ value, label: meta.label }));

export function expenseStatusMeta(status) {
  return EXPENSE_STATUS[status] || { label: status || 'Unknown', variant: 'neutral' };
}

export function apiErrorMessage(error, fallback) {
  return error?.response?.data?.message || fallback;
}

/** A line's identity used to re-attach pending receipt files after the claim is saved. */
export function lineSignature(line) {
  return [
    line.expenseDate || '',
    String(line.categoryId ?? ''),
    (line.description || '').trim(),
    line.mileageKm != null && line.mileageKm !== '' ? `km:${Number(line.mileageKm)}` : `amt:${Number(line.amount || 0)}`,
  ].join('|');
}

/** Client-side mirror of the backend file rule: PDF/JPG/PNG up to 10 MB. */
export function receiptFileError(file) {
  if (!file) return null;
  const name = file.name?.toLowerCase() || '';
  if (!/\.(pdf|jpe?g|png)$/.test(name)) return 'Only PDF, JPG or PNG receipts are accepted.';
  if (file.size > 10 * 1024 * 1024) return 'Receipts must be 10 MB or smaller.';
  return null;
}
