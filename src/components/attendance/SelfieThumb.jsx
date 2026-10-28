import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { attendanceApi } from '../../api/endpoints/attendance';
import Dialog from '../ui/Dialog';

/**
 * Check-in selfie thumbnail for HR attendance views. The image is streamed from an
 * authorised endpoint (ATTENDANCE_VIEW scope or self), so it is fetched as a blob and
 * shown through an object URL that is revoked on unmount. Renders "—" when the session
 * has no selfie or the viewer isn't allowed to see it.
 */
export default function SelfieThumb({ session, label }) {
  const [open, setOpen] = useState(false);
  const enabled = !!session?.hasSelfie && !!session?.id;
  const selfie = useQuery({
    queryKey: ['attendance-session-selfie', session?.id],
    queryFn: () => attendanceApi.sessionSelfie(session.id),
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!selfie.data) return undefined;
    const objectUrl = URL.createObjectURL(selfie.data);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selfie.data]);

  if (!enabled) return <span className="text-muted-hz">—</span>;
  if (selfie.isError) return <span className="text-muted-hz" title="Selfie unavailable">—</span>;
  if (!url) return <span className="hz-selfie-thumb d-inline-block" aria-label="Loading selfie" />;

  const alt = `Check-in selfie${label ? ` of ${label}` : ''}`;
  return (
    <>
      <button type="button" className="btn p-0 border-0" onClick={() => setOpen(true)} aria-label={`View ${alt.toLowerCase()}`}>
        <img src={url} alt={alt} className="hz-selfie-thumb" />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Check-in selfie" description={label} size="sm">
        <img src={url} alt={alt} className="w-100 rounded-3" />
      </Dialog>
    </>
  );
}
