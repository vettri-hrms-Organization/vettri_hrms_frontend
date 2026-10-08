import { AlertTriangle } from 'lucide-react';
import { vettriMicrocopy } from '../../utils/vettriMicrocopy';

export default function ErrorBanner({
  children = vettriMicrocopy.error.generic,
  title = vettriMicrocopy.error.genericTitle,
  className = '',
}) {
  return (
    <div className={`hz-error-banner ${className}`.trim()} role="alert">
      <AlertTriangle size={16} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <span>{children}</span>
      </div>
    </div>
  );
}
