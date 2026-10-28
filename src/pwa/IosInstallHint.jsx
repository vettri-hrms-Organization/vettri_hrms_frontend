import { PlusSquare, Share, X } from 'lucide-react';

/** iOS Safari has no install prompt API: explain the Share > Add to Home Screen steps instead. */
export default function IosInstallHint({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="hz-pwa-sheet" role="dialog" aria-modal="false" aria-labelledby="ios-install-title">
      <div className="d-flex align-items-start justify-content-between gap-2">
        <strong id="ios-install-title">Install Vettri on your iPhone</strong>
        <button type="button" className="btn btn-sm btn-link text-reset p-0" aria-label="Close install instructions" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <ol className="mb-0 ps-3 small">
        <li>Tap <Share size={14} aria-label="Share" className="mx-1" /> <strong>Share</strong> in Safari’s toolbar.</li>
        <li>Choose <PlusSquare size={14} aria-hidden="true" className="mx-1" /> <strong>Add to Home Screen</strong>.</li>
        <li>Open Vettri from your home screen to check in with one tap.</li>
      </ol>
    </div>
  );
}
