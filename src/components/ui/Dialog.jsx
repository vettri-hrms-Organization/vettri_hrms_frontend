import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

const SIZE_WIDTH = { sm: 420, md: 560, lg: 680, xl: 860 };

/**
 * Shared modal primitive. Every modal in the app today (12 in Recruitment
 * alone, plus CreateEmployeeModal, ApplyLeaveModal, AssignSalaryStructure
 * Modal, NewPayrollRunModal) hand-rolls its own backdrop + close button,
 * and none of them close on Escape, trap focus, or lock body scroll. This
 * gives every one of those the same behavior for free once they adopt it -
 * see CreateEmployeeModal for the reference migration.
 *
 * Usage:
 *   <Dialog open={open} onClose={onClose} title="Onboard Employee" size="lg">
 *     <form>...</form>
 *   </Dialog>
 *
 * `footer` is optional - pass it to get a sticky footer bar (typical for
 * Cancel/Submit actions) separated from scrollable body content. Omit it
 * and put your own submit button inline in children if the form doesn't
 * need one (e.g. CreateEmployeeModal keeps its submit button inside the
 * scrollable form, which is also fine).
 */
export default function Dialog({ open, onClose, title, description, size = 'md', footer, children, hasUnsavedChanges = false }) {
  const dialogRef = useRef(null);
  const lastFocusedRef = useRef(null);
  const titleId = useId();
  // Closing with unsaved edits asks inside the dialog instead of a browser prompt.
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const requestCloseRef = useRef(null);
  const discardShowingRef = useRef(false);
  discardShowingRef.current = confirmingDiscard;
  requestCloseRef.current = () => {
    if (hasUnsavedChanges) setConfirmingDiscard(true);
    else onClose();
  };

  useEffect(() => { if (!open) setConfirmingDiscard(false); }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    lastFocusedRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Start at the dialog landmark, not the first field. Focusing a field in
    // a scrollable workflow can silently scroll the header and step context
    // out of view as the dialog opens.
    const body = dialogRef.current?.querySelector('.hz-dialog__body');
    if (body) body.scrollTop = 0;
    dialogRef.current?.focus();

    function handleKeyDown(e) {
      // Only the top-most dialog reacts, so Escape on a confirmation doesn't also close the dialog under it.
      const dialogs = document.querySelectorAll('.hz-dialog');
      if (dialogs.length && dialogs[dialogs.length - 1] !== dialogRef.current) return;
      if (e.key === 'Escape') {
        if (discardShowingRef.current) setConfirmingDiscard(false);
        else requestCloseRef.current();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll(
          'input, select, textarea, button, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      lastFocusedRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="hz-dialog-backdrop position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      onClick={() => requestCloseRef.current()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className="hz-dialog d-flex flex-column"
        style={{ width: '100%', maxWidth: SIZE_WIDTH[size] || SIZE_WIDTH.md }}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || description) && (
          <div className="hz-dialog__header d-flex align-items-start justify-content-between">
            <div>
              {title && (
                  <h3 id={titleId} className="hz-dialog__title">
                  {title}
                </h3>
              )}
              {description && <p className="hz-dialog__description">{description}</p>}
            </div>
            <button type="button" onClick={() => requestCloseRef.current()} className="hz-dialog__close" aria-label="Close dialog">
              <X size={18} />
            </button>
          </div>
        )}

        <div className="hz-dialog__body overflow-auto">{children}</div>

        {confirmingDiscard && (
          <div className="hz-dialog__discard" role="alertdialog" aria-label="Discard unsaved changes">
            <AlertTriangle size={18} aria-hidden="true" />
            <span className="hz-dialog__discard-text"><strong>Discard your changes?</strong> What you entered here hasn&apos;t been saved.</span>
            <span className="hz-dialog__discard-actions">
              <button type="button" className="btn btn-sm btn-light" onClick={() => setConfirmingDiscard(false)}>Keep editing</button>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => { setConfirmingDiscard(false); onClose(); }}>Discard</button>
            </span>
          </div>
        )}

        {footer && <div className="hz-dialog__footer d-flex align-items-center justify-content-end gap-2">{footer}</div>}
      </div>
    </div>
    , document.body
  );
}
