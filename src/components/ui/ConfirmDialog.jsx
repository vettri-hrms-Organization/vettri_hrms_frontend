import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import Dialog from './Dialog';
import Button from './Button';

/**
 * Confirmation modal. `description` explains the consequence in plain words;
 * `irreversible` adds a "can't be undone" note - only set it when that is true,
 * so the warning keeps its meaning.
 */
export default function ConfirmDialog({ open, onClose, onConfirm, title = 'Are you sure?', description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'danger', loading = false, irreversible = false }) {
  const danger = variant === 'danger';
  const Icon = danger ? AlertTriangle : HelpCircle;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      )}
    >
      <div className={`hz-confirm-dialog__body${danger ? ' hz-confirm-dialog__body--danger' : ''}`}>
        <span className="hz-confirm-dialog__icon" aria-hidden="true"><Icon size={20} /></span>
        <div>
          <p className="hz-confirm-dialog__text">{description || 'Please confirm you want to continue.'}</p>
          {irreversible && <p className="hz-confirm-dialog__note">This can&apos;t be undone.</p>}
        </div>
      </div>
    </Dialog>
  );
}

const ConfirmContext = createContext(null);

/**
 * App-wide replacement for window.confirm: `await confirm({ title, description, confirmLabel })`
 * resolves true when the user confirms. Outside the provider (isolated tests) it falls back to
 * window.confirm so callers never need to care.
 */
export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setRequest(options);
  }), []);

  const settle = (value) => {
    resolver.current?.(value);
    resolver.current = null;
    setRequest(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={!!request}
        onClose={() => settle(false)}
        onConfirm={() => settle(true)}
        title={request?.title}
        description={request?.description}
        confirmLabel={request?.confirmLabel}
        cancelLabel={request?.cancelLabel}
        variant={request?.variant}
        irreversible={request?.irreversible}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  return confirm || (async ({ title, description } = {}) => window.confirm([title, description].filter(Boolean).join('\n\n')));
}
