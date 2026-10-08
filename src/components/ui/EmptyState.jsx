import { Inbox } from 'lucide-react';
import { vettriMicrocopy } from '../../utils/vettriMicrocopy';

export default function EmptyState({
  icon: Icon = Inbox,
  title = vettriMicrocopy.empty.genericTitle,
  description = vettriMicrocopy.empty.genericDescription,
  action,
}) {
  return (
    <div className="hz-state" role="status">
      <div className="hz-state__icon-wrap">
        <Icon size={26} />
      </div>
      <h2 className="hz-state__title">{title}</h2>
      {description && <p className="hz-state__description">{description}</p>}
      {action}
    </div>
  );
}
