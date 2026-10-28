import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Dialog from '../../components/ui/Dialog';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { toISTDateInputValue } from '../../utils/formatDateTime';

/** Statuses that end employment - the backend disables login for these. */
export const EXIT_STATUSES = ['Resigned', 'Terminated'];

export function isExitStatus(status) {
  return EXIT_STATUSES.includes(status);
}

/**
 * Confirmation for moving an employee to Resigned / Terminated. Collects an
 * optional last working date (blank = today, IST) and reason, and explains
 * the login consequence: disabled immediately, or on the day after a future
 * last working date (EmployeeExitScheduler on the backend).
 */
export default function ExitStatusDialog({ open, status, employeeName, onClose, onConfirm, loading = false }) {
  const today = toISTDateInputValue();
  const [lastWorkingDate, setLastWorkingDate] = useState(today);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      setLastWorkingDate(toISTDateInputValue());
      setReason('');
    }
  }, [open]);

  const isFuture = !!lastWorkingDate && lastWorkingDate > today;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Mark ${employeeName || 'employee'} as ${status}?`}
      size="sm"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            variant="danger"
            loading={loading}
            onClick={() => onConfirm({ lastWorkingDate: lastWorkingDate || null, reason: reason.trim() || null })}
          >
            Mark as {status}
          </Button>
        </>
      )}
    >
      <FormField
        label="Last working date"
        type="date"
        value={lastWorkingDate}
        onChange={setLastWorkingDate}
        hint="Leave as today if the employee has already left."
      />
      <FormField
        as="textarea"
        label="Reason (optional)"
        rows={2}
        value={reason}
        onChange={setReason}
      />
      <div role="note" className="d-flex align-items-start gap-2" style={{ fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-secondary)' }}>
        <AlertTriangle size={16} aria-hidden="true" className="flex-shrink-0 mt-1" style={{ color: 'var(--hz-warning-600)' }} />
        <span>
          {isFuture
            ? 'Their login stays active until the last working date and is disabled automatically the next day.'
            : 'Their login will be disabled immediately and all active sessions signed out.'}
          {' '}Changing the status back to Active will not re-enable login — use the account action on the profile.
        </span>
      </div>
    </Dialog>
  );
}
