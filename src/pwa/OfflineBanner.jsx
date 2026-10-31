import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/** Thin banner while the device is offline, so people know why saves fail and what still works. */
export default function OfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  if (online) return null;
  return (
    <div role="status" className="d-flex align-items-center gap-2 px-3 py-2" style={{ background: 'var(--hz-warning-100, #fef3c7)', color: 'var(--hz-warning-800, #92400e)', fontSize: 13 }}>
      <WifiOff size={15} aria-hidden="true" /> You're offline. Pages you've opened still show, but changes can't be saved until you're back online.
    </div>
  );
}

/** Shows the unread count on the installed app icon where the platform supports it (Badging API). */
export function syncAppBadge(count) {
  try {
    if (typeof navigator === 'undefined') return;
    if (count > 0 && navigator.setAppBadge) navigator.setAppBadge(count).catch(() => {});
    else if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
  } catch {
    // Not supported - nothing to do.
  }
}
