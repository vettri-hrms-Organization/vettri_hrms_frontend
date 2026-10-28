import { AlertTriangle, Download, Paperclip } from 'lucide-react';
import StatusBadge from '../../components/ui/StatusBadge';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDateIST, formatDateTimeIST } from '../../utils/formatDateTime';
import { useToast } from '../../components/ui/Toast';
import { expensesApi } from '../../api/endpoints/expenses';
import { apiErrorMessage, expenseStatusMeta } from './expenseMeta';

/** Read-only view of a claim: header, workflow trail, policy notes, and lines with receipts. */
export default function ClaimDetail({ claim, showEmployee = false }) {
  const toast = useToast();
  if (!claim) return null;
  const meta = expenseStatusMeta(claim.status);

  const download = async (lineId) => {
    try {
      await expensesApi.downloadReceipt(claim.id, lineId);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not download the receipt.'));
    }
  };

  const trail = [
    claim.submittedAt && { label: 'Submitted', at: claim.submittedAt },
    claim.managerApprovedAt && { label: `Manager approved by ${claim.managerApprovedByName || '—'}`, at: claim.managerApprovedAt, note: claim.managerNote },
    claim.approvedAt && { label: `Approved by ${claim.approvedByName || '—'}`, at: claim.approvedAt, note: claim.approverNote },
    claim.rejectedAt && { label: `Rejected by ${claim.rejectedByName || '—'}`, at: claim.rejectedAt, note: claim.rejectionReason },
    claim.reimbursedAt && {
      label: claim.reimbursementMethod === 'PAYROLL' ? 'Reimbursed with payroll' : 'Reimbursed',
      at: claim.reimbursedAt,
      note: claim.paymentReference ? `Reference: ${claim.paymentReference}` : null,
    },
  ].filter(Boolean);

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          {showEmployee && (
            <div style={{ fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-muted)' }}>
              {claim.employeeName}{claim.employeeCode ? ` · ${claim.employeeCode}` : ''}{claim.departmentName ? ` · ${claim.departmentName}` : ''}
            </div>
          )}
          <div style={{ fontWeight: 600, fontSize: 'var(--hz-text-lg)' }}>{claim.title}</div>
          {claim.purpose && <p className="mb-0" style={{ whiteSpace: 'pre-wrap', color: 'var(--hz-text-secondary)' }}>{claim.purpose}</p>}
        </div>
        <div className="text-end">
          <StatusBadge status={claim.status} variant={meta.variant}>{meta.label}</StatusBadge>
          <div style={{ fontWeight: 700, fontSize: 'var(--hz-text-lg)', marginTop: 4 }}>{formatCurrency(claim.totalAmount)}</div>
        </div>
      </div>

      {claim.policyIssues?.length > 0 && (
        <div className="alert alert-warning mb-0 py-2" role="status">
          <div className="d-flex align-items-center gap-2" style={{ fontWeight: 600 }}><AlertTriangle size={16} aria-hidden="true" /> Policy notes</div>
          <ul className="mb-0 ps-4" style={{ fontSize: 'var(--hz-text-sm)' }}>
            {claim.policyIssues.map((issue, index) => (
              <li key={`${issue.code}-${index}`}>{issue.severity === 'BLOCK' ? 'Blocked: ' : ''}{issue.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="table-responsive">
        <table className="table mb-0 align-middle hz-table" aria-label="Expense lines">
          <thead>
            <tr style={{ fontSize: 'var(--hz-text-xs)', color: 'var(--hz-text-muted)', textTransform: 'uppercase' }}>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th className="text-end">Amount</th>
              <th className="text-end">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {(claim.lines || []).map((line) => (
              <tr key={line.id}>
                <td style={{ fontSize: 'var(--hz-text-sm)' }}>{formatDateIST(line.expenseDate)}</td>
                <td style={{ fontSize: 'var(--hz-text-sm)' }}>{line.categoryName}</td>
                <td style={{ fontSize: 'var(--hz-text-sm)' }}>
                  {line.description || '—'}
                  {line.mileageKm != null && (
                    <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{line.mileageKm} km × {formatCurrency(line.mileageRate)}/km</div>
                  )}
                </td>
                <td className="text-end" style={{ fontSize: 'var(--hz-text-sm)' }}>{formatCurrency(line.amount)}</td>
                <td className="text-end">
                  {line.hasReceipt ? (
                    <button type="button" className="btn btn-sm btn-link p-0 d-inline-flex align-items-center gap-1" onClick={() => download(line.id)} aria-label={`Download receipt ${line.receiptFileName || ''}`}>
                      <Download size={14} aria-hidden="true" /> <Paperclip size={12} aria-hidden="true" />
                    </button>
                  ) : <span style={{ color: 'var(--hz-text-muted)', fontSize: 12 }}>None</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {trail.length > 0 && (
        <ol className="list-unstyled mb-0 d-flex flex-column gap-2" aria-label="Approval history">
          {trail.map((step) => (
            <li key={step.label} style={{ fontSize: 'var(--hz-text-sm)' }}>
              <strong>{step.label}</strong> <span style={{ color: 'var(--hz-text-muted)' }}>· {formatDateTimeIST(step.at)}</span>
              {step.note && <div style={{ color: 'var(--hz-text-secondary)', whiteSpace: 'pre-wrap' }}>{step.note}</div>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
