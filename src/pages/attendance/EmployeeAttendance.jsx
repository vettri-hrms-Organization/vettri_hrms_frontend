import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, Clock3, Home, LogIn, LogOut, MapPin, RefreshCw } from 'lucide-react';
import { attendanceApi } from '../../api/endpoints/attendance';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonText } from '../../components/ui/Skeleton';

const GOOD_ACCURACY_METERS = 100;
const MAX_ACCEPTABLE_ACCURACY_METERS = 200;

function acquireBestLocation(onProgress) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('LOCATION_UNAVAILABLE'));
      return;
    }

    const startedAt = Date.now();
    const maxAcquisitionMs = 15000;
    const readings = [];
    let watchId = null;
    let timeoutId = null;
    let settled = false;

    const finalize = (payload, error) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      if (watchId !== null && typeof navigator.geolocation.clearWatch === 'function') {
        navigator.geolocation.clearWatch(watchId);
      }
      if (error) {
        reject(error);
        return;
      }
      resolve(payload);
    };

    const buildPayload = (position) => {
      const latitude = Number(position.coords.latitude);
      const longitude = Number(position.coords.longitude);
      const accuracy = Number(position.coords.accuracy);
      const timestamp = Number(position.timestamp);
      const payload = {
        latitude,
        longitude,
        accuracy,
        timestamp,
        source: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'WEB_MOBILE' : 'WEB_DESKTOP',
      };

      if (import.meta.env.DEV) {
        console.log('CHECK-IN RAW GEOLOCATION', {
          latitude: payload.latitude,
          longitude: payload.longitude,
          accuracy: payload.accuracy,
          timestamp: payload.timestamp,
        });
      }

      return payload;
    };

    const useBestReading = () => {
      if (!readings.length) {
        return null;
      }
      const best = readings.reduce((lowest, reading) => (reading.accuracy < lowest.accuracy ? reading : lowest), readings[0]);
      return best;
    };

    const onSuccess = (position) => {
      const payload = buildPayload(position);
      if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude) || !Number.isFinite(payload.accuracy) || payload.accuracy < 0) {
        return;
      }

      readings.push(payload);
      const bestReading = useBestReading();
      if (import.meta.env.DEV) {
        console.log('CHECK-IN GEOLOCATION', {
          readings: readings.length,
          firstAccuracy: readings[0]?.accuracy,
          bestAccuracy: bestReading?.accuracy,
          durationMs: Date.now() - startedAt,
        });
      }

      if (typeof onProgress === 'function' && bestReading && bestReading.accuracy > GOOD_ACCURACY_METERS) {
        onProgress('improving');
      }

      if (bestReading && bestReading.accuracy <= GOOD_ACCURACY_METERS) {
        finalize(bestReading);
        return;
      }

      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs >= maxAcquisitionMs) {
        if (bestReading && bestReading.accuracy <= MAX_ACCEPTABLE_ACCURACY_METERS) {
          finalize(bestReading);
          return;
        }
        finalize(null, new Error('LOCATION_INACCURATE'));
      }
    };

    const onError = (error) => {
      const code = error && typeof error.code === 'number' ? error.code : null;
      const bestReading = useBestReading();
      if (bestReading && bestReading.accuracy <= MAX_ACCEPTABLE_ACCURACY_METERS) {
        finalize(bestReading);
        return;
      }

      if (code === GeolocationPositionError.PERMISSION_DENIED) {
        finalize(null, new Error('LOCATION_PERMISSION_REQUIRED'));
        return;
      }
      if (code === GeolocationPositionError.TIMEOUT) {
        finalize(null, new Error('LOCATION_TIMEOUT'));
        return;
      }
      if (code === GeolocationPositionError.POSITION_UNAVAILABLE) {
        finalize(null, new Error('LOCATION_UNAVAILABLE'));
        return;
      }
      finalize(null, new Error('LOCATION_UNAVAILABLE'));
    };

    watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });

    timeoutId = setTimeout(() => {
      const bestReading = useBestReading();
      if (bestReading && bestReading.accuracy <= MAX_ACCEPTABLE_ACCURACY_METERS) {
        finalize(bestReading);
      } else {
        finalize(null, new Error('LOCATION_INACCURATE'));
      }
    }, maxAcquisitionMs);
  });
}

function localDate(daysFromToday = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

export default function EmployeeAttendance() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState('OFFICE');
  const [workDate, setWorkDate] = useState(localDate(1));
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle');

  const today = useQuery({ queryKey: ['attendance-today'], queryFn: attendanceApi.today });
  const locations = useQuery({ queryKey: ['attendance-office-locations'], queryFn: attendanceApi.officeLocations });
  const wfhRequests = useQuery({ queryKey: ['attendance-wfh-my'], queryFn: attendanceApi.myWfh });

  const checkIn = useMutation({
    mutationFn: async () => {
      setLocationStatus('locating');
      try {
        const location = mode === 'OFFICE' ? await acquireBestLocation((status) => setLocationStatus(status)) : {};
        setLocationStatus('verifying');
        const payload = { ...location, source: location.source || 'WEB_DESKTOP', workingMode: mode, officeLocationId: locations.data?.[0]?.id };
        if (import.meta.env.DEV) {
          console.debug('[attendance] check-in location diagnostics', {
            latitude: payload.latitude,
            longitude: payload.longitude,
            accuracy: payload.accuracy,
            timestamp: payload.timestamp,
            source: payload.source,
          });
        }
        return attendanceApi.checkIn(payload);
      } finally {
        setLocationStatus('idle');
      }
    },
    onSuccess: () => { setMessage({ type: 'success', text: 'You are checked in.' }); queryClient.invalidateQueries({ queryKey: ['attendance-today'] }); },
    onError: (error) => setMessage({ type: 'error', code: error.response?.data?.code || error.message, text: locationErrorMessage(error.response?.data?.code || error.message, error.response?.data?.accuracyMeters) }),
  });

  const checkOut = useMutation({
    mutationFn: async () => {
      const location = mode === 'OFFICE' ? await acquireBestLocation() : {};
      return attendanceApi.checkOut({ ...location, source: location.source || 'WEB_DESKTOP' });
    },
    onSuccess: () => { setMessage({ type: 'success', text: 'You are checked out.' }); queryClient.invalidateQueries({ queryKey: ['attendance-today'] }); },
    onError: (error) => setMessage({ type: 'error', text: error.response?.data?.message || error.message || 'Check-out could not be completed.' }),
  });

  const requestWfh = useMutation({
    mutationFn: () => attendanceApi.requestWfh({ workDate, reason }),
    onSuccess: () => { setReason(''); setMessage({ type: 'success', text: 'WFH request submitted for manager approval.' }); queryClient.invalidateQueries({ queryKey: ['attendance-wfh-my'] }); },
    onError: (error) => setMessage({ type: 'error', text: error.response?.data?.message || 'WFH request could not be submitted.' }),
  });

  const session = today.data;
  const busy = checkIn.isPending || checkOut.isPending;

  function locationErrorMessage(code, accuracyMeters) {
    if (code === 'LOCATION_PERMISSION_REQUIRED') return 'Location permission required. Enable location access for Vettri and try again.';
    if (code === 'LOCATION_INACCURATE') {
      const accuracyText = Number.isFinite(accuracyMeters) ? `${Math.round(accuracyMeters)} meters` : 'the browser reported';
      return `Location accuracy is too low. Your device reported an accuracy of ${accuracyText}. Move near a window or enable precise location, then try again.`;
    }
    if (code === 'OUTSIDE_GEOFENCE') return "You're outside the office area. Check-in is available when you're within the configured office area.";
    if (code === 'LOCATION_STALE') return 'Your location fix is out of date. Try again to get a fresh location.';
    if (code === 'LOCATION_TIMEOUT') return 'Location request timed out. Check your location settings and try again.';
    if (code === 'LOCATION_UNAVAILABLE') return 'Your device could not provide a location. Check your location settings and try again.';
    return code || 'Check-in could not be completed.';
  }

  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Self service" title="My attendance" description="Check in from your browser or phone, request WFH, and see today’s status." actions={<Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => { today.refetch(); wfhRequests.refetch(); }}>Refresh</Button>} />

      {message && <div className={`alert ${message.type === 'error' ? 'alert-danger' : 'alert-success'} mb-0`} role="status">{message.text}{message.type === 'error' && message.code?.startsWith('LOCATION_') && <button type="button" className="btn btn-link p-0 ms-2" onClick={() => checkIn.mutate()}>Try again</button>}</div>}

      <div className="row g-3">
        <div className="col-12 col-lg-7">
          <Card title="Today" subtitle={session?.attendanceDate || localDate()}>
            {today.isLoading && <SkeletonText lines={3} />}
            {today.isError && <ErrorState description="Couldn’t load today’s attendance." onRetry={today.refetch} />}
            {!today.isLoading && !today.isError && (
              <div className="d-flex flex-column gap-4">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                  <div className="d-flex align-items-center gap-3"><div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 48, height: 48, background: session ? 'var(--hz-success-50)' : 'var(--hz-gray-100)', color: session ? 'var(--hz-success-600)' : 'var(--hz-text-secondary)' }}><Clock3 size={22} /></div><div><div style={{ fontWeight: 700, fontSize: 18 }}>{session ? 'Checked in' : 'Not checked in'}</div><div className="text-muted-hz" style={{ fontSize: 13 }}>{session ? `${session.locationType} · ${session.source}` : 'Choose a work location to begin'}</div></div></div>
                  {session && <StatusBadge status={session.status} variant={session.status === 'CHECKED_IN' ? 'success' : 'info'} dot>{session.status.replace('_', ' ')}</StatusBadge>}
                </div>
                <div className="row g-3"><div className="col-6"><div className="text-muted-hz" style={{ fontSize: 12 }}>Check in</div><strong>{session?.checkInTime ? new Date(session.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</strong></div><div className="col-6"><div className="text-muted-hz" style={{ fontSize: 12 }}>Check out</div><strong>{session?.checkOutTime ? new Date(session.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</strong></div></div>
                <div className="d-flex flex-wrap gap-2">
                  <Button icon={LogIn} onClick={() => checkIn.mutate()} loading={checkIn.isPending} disabled={!!session || busy}>
                    {checkIn.isPending ? (locationStatus === 'locating' ? 'Getting your location…' : locationStatus === 'improving' ? 'Improving location accuracy…' : 'Verifying location…') : 'Check in'}
                  </Button>
                  <Button variant="secondary" icon={LogOut} onClick={() => checkOut.mutate()} loading={checkOut.isPending} disabled={!session || busy}>Check out</Button>
                </div>
              </div>
            )}
          </Card>
        </div>
        <div className="col-12 col-lg-5"><Card title="Work location" subtitle="Office check-in uses your device location."><div className="btn-group w-100 mb-3" role="group"><button type="button" className={`btn ${mode === 'OFFICE' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setMode('OFFICE')}><MapPin size={16} className="me-2" />Office</button><button type="button" className={`btn ${mode === 'WFH' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setMode('WFH')}><Home size={16} className="me-2" />WFH</button></div><div className="text-muted-hz" style={{ fontSize: 13 }}>{mode === 'OFFICE' ? `${locations.data?.length || 0} active office location(s) available.` : 'WFH check-in is enabled only after manager approval for today.'}</div></Card></div>
      </div>

      <Card title="Request work from home" subtitle="Submit a future-date request for manager approval."><div className="row g-3 align-items-end"><div className="col-12 col-md-3"><label className="form-label" htmlFor="wfh-date">Work date</label><input id="wfh-date" className="form-control" type="date" min={localDate(1)} value={workDate} onChange={(event) => setWorkDate(event.target.value)} /></div><div className="col-12 col-md-6"><label className="form-label" htmlFor="wfh-reason">Reason</label><input id="wfh-reason" className="form-control" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Optional reason" maxLength={500} /></div><div className="col-12 col-md-3"><Button className="w-100" icon={CalendarDays} onClick={() => requestWfh.mutate()} loading={requestWfh.isPending} disabled={!workDate}>Request approval</Button></div></div></Card>

      <Card title="My WFH requests"><div className="table-responsive">{wfhRequests.isLoading && <SkeletonText lines={3} />}{!wfhRequests.isLoading && (!wfhRequests.data || wfhRequests.data.length === 0) && <EmptyState icon={CalendarDays} title="No WFH requests" description="Approved requests will appear here." />}{wfhRequests.data?.length > 0 && <table className="table mb-0 align-middle"><thead><tr><th>Date</th><th>Reason</th><th>Status</th><th>Manager note</th></tr></thead><tbody>{wfhRequests.data.map((request) => <tr key={request.id}><td>{request.workDate}</td><td>{request.reason || '—'}</td><td><StatusBadge status={request.status} variant={request.status === 'APPROVED' ? 'success' : request.status === 'REJECTED' ? 'danger' : 'warning'} dot={false}>{request.status}</StatusBadge></td><td>{request.managerNote || '—'}</td></tr>)}</tbody></table>}</div></Card>
    </div>
  );
}
