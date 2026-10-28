import { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { applyUpdate, usePwa } from './pwa';

/** Persistent "Update available - reload" toast shown when a new service worker is waiting. */
export default function PwaUpdatePrompt() {
  const { updateAvailable } = usePwa();
  const [dismissed, setDismissed] = useState(false);
  if (!updateAvailable || dismissed) return null;
  return (
    <div className="hz-pwa-toast" role="status" aria-live="polite">
      <span>Update available</span>
      <button type="button" className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1" onClick={applyUpdate}>
        <RefreshCw size={14} aria-hidden="true" /> Reload
      </button>
      <button type="button" className="btn btn-sm btn-link text-reset p-1" aria-label="Dismiss update notice" onClick={() => setDismissed(true)}>
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
