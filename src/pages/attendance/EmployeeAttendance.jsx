import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, Clock3, Home, LogIn, LogOut, MapPin, RefreshCw } from 'lucide-react';
import { attendanceApi } from '../../api/endpoints/attendance';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import StatusBadge, { formatStatusLabel } from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { formatTimeIST } from '../../utils/formatDateTime';

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
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function EmployeeAttendance() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState('OFFICE');
  const [workDate, setWorkDate] = useState(localDate(1));
  const [reason, setReason] = useState('');
  const [regularizationDate, setRegularizationDate] = useState(localDate());
  const [regularizationCheckIn, setRegularizationCheckIn] = useState('');
  const [regularizationCheckOut, setRegularizationCheckOut] = useState('');
  const [regularizationReason, setRegularizationReason] = useState('');
  const [message, setMessage] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle');

  const today = useQuery({ queryKey: ['attendance-today'], queryFn: attendanceApi.today });
  const context = useQuery({ queryKey: ['attendance-context'], queryFn: attendanceApi.context });
  const policy = useQuery({ queryKey: ['attendance-policy'], queryFn: attendanceApi.policy });
  const locations = useQuery({ queryKey: ['attendance-office-locations'], queryFn: attendanceApi.officeLocations });
  const wfhRequests = useQuery({ queryKey: ['attendance-wfh-my'], queryFn: attendanceApi.myWfh });
  const regularizations = useQuery({ queryKey: ['attendance-regularizations-mine'], queryFn: attendanceApi.myRegularizations });

  useEffect(() => {
    if (context.data?.wfhStatus === 'APPROVED' && context.data?.allowedWebCheckIn) {
      setMode('WFH');
    } else if (context.data?.attendanceMethod === 'WEB_APP_ONLY') {
      setMode('OFFICE');
    }
  }, [context.data]);

  const checkIn = useMutation({
    mutationFn: async () => {
      setLocationStatus('locating');
      try {
        const location = mode === 'OFFICE' ? await acquireBestLocation((status) => setLocationStatus(status)) : {};
        setLocationStatus('verifying');
        const payload = { ...location, source: location.source || 'WEB_DESKTOP', workingMode: mode, wfh: mode === 'WFH', officeLocationId: locations.data?.[0]?.id };
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
    onSuccess: () => {
      setMessage({ type: 'success', text: 'You are checked in.' });
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-context'] });
    },
    onError: (error) => {
      const code = error.response?.data?.code || error.message;
      setMessage({
        type: 'error',
        code,
        text: error.response?.data?.message || locationErrorMessage(code, error.response?.data?.accuracyMeters),
      });
    },
  });

  const checkOut = useMutation({
    mutationFn: async () => {
      const location = session?.locationType === 'OFFICE' ? await acquireBestLocation() : {};
      return attendanceApi.checkOut({ ...location, source: location.source || 'WEB_DESKTOP' });
    },
    onSuccess: () => {
      setMessage({ type: 'success', text: 'You are checked out.' });
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-context'] });
    },
    onError: (error) => setMessage({ type: 'error', text: error.response?.data?.message || error.message || 'Check-out could not be completed.' }),
  });

  const requestWfh = useMutation({
    mutationFn: () => attendanceApi.requestWfh({ workDate, reason }),
    onSuccess: () => { setReason(''); setMessage({ type: 'success', text: 'WFH request submitted for manager approval.' }); queryClient.invalidateQueries({ queryKey: ['attendance-wfh-my'] }); },
    onError: (error) => setMessage({ type: 'error', text: error.response?.data?.message || 'WFH request could not be submitted.' }),
  });

  const requestRegularization = useMutation({
    mutationFn: () => attendanceApi.requestRegularization({
      attendanceDate: regularizationDate,
      checkInTime: regularizationCheckIn,
      checkOutTime: regularizationCheckOut || null,
      reason: regularizationReason.trim(),
    }),
    onSuccess: (request) => {
      setRegularizationReason('');
      setMessage({ type: 'success', text: request.status === 'APPROVED' ? 'Attendance regularization applied.' : 'Regularization request submitted for approval.' });
      queryClient.invalidateQueries({ queryKey: ['attendance-regularizations-mine'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-context'] });
    },
    onError: (error) => setMessage({ type: 'error', text: error.response?.data?.message || 'Attendance regularization could not be submitted.' }),
  });

  const session = today.data;
  const busy = checkIn.isPending || checkOut.isPending;
  const canWebCheckIn = context.data?.allowedWebCheckIn
    && (mode !== 'WFH' || context.data.wfhStatus === 'APPROVED');

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
      <PageHeader eyebrow="Self service" title="My attendance" description="Check in when your organization’s attendance policy allows, request WFH, and see today’s status." actions={<Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => { today.refetch(); context.refetch(); policy.refetch(); wfhRequests.refetch(); regularizations.refetch(); }}>Refresh</Button>} />

      {message && <div className={`alert ${message.type === 'error' ? 'alert-danger' : 'alert-success'} mb-0`} role="status">{message.text}{message.type === 'error' && message.code?.startsWith('LOCATION_') && <button type="button" className="btn btn-link p-0 ms-2" onClick={() => checkIn.mutate()}>Try again</button>}</div>}

      <div className="row g-3">
        <div className="col-12 col-lg-7">
          <Card title="Today" subtitle={context.data?.date || session?.attendanceDate || localDate()}>
            {(today.isLoading || context.isLoading) && <SkeletonText lines={3} />}
            {(today.isError || context.isError) && <ErrorState description={checkIn.isSuccess ? 'Check-in succeeded, but today’s attendance could not be refreshed.' : 'Couldn’t load today’s attendance policy.'} onRetry={() => { today.refetch(); context.refetch(); }} />}
            {!today.isLoading && !context.isLoading && !today.isError && !context.isError && (
              <div className="d-flex flex-column gap-4">
                <div className="d-flex flex-wrap gap-2">
                  <StatusBadge status={context.data.workMode === 'WFH' ? 'WFH_APPROVED' : 'OFFICE'} variant={context.data.workMode === 'WFH' ? 'info' : 'neutral'} dot={false}>
                    {context.data.workMode === 'WFH' ? 'WFH · Approved' : 'Office'}
                  </StatusBadge>
                  <StatusBadge status={context.data.attendanceMethod} variant="neutral" dot={false}>
                    {context.data.attendanceMethod?.replaceAll('_', ' ')}
                  </StatusBadge>
                </div>
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                  <div className="d-flex align-items-center gap-3"><div className="rounded-circle d-flex align-items-center justify-content-center" style={{ width: 48, height: 48, background: session || context.data.latestBiometricPunchType ? 'var(--hz-success-50)' : 'var(--hz-gray-100)', color: session || context.data.latestBiometricPunchType ? 'var(--hz-success-600)' : 'var(--hz-text-secondary)' }}><Clock3 size={22} /></div><div><div style={{ fontWeight: 700, fontSize: 18 }}>{session ? (session.status === 'CHECKED_OUT' ? 'Checked out' : 'Checked in') : context.data.latestBiometricPunchType ? 'Biometric punch received' : context.data.requiresBiometric ? 'Awaiting biometric' : 'Not marked'}</div><div className="text-muted-hz" style={{ fontSize: 13 }}>{session ? `${session.locationType} · ${session.source}` : context.data.latestBiometricPunchType ? `${context.data.latestBiometricPunchType} · ${context.data.latestBiometricPunchTime}` : context.data.requiresBiometric ? 'Please use your assigned biometric device.' : 'Use Check in when you are ready.'}</div></div></div>
                  {session && <StatusBadge status={session.status} variant={session.status === 'CHECKED_IN' ? 'success' : 'info'} dot>{formatStatusLabel(session.status)}</StatusBadge>}
                </div>
                <div className="row g-3"><div className="col-6"><div className="text-muted-hz" style={{ fontSize: 12 }}>Check in</div><strong>{session?.checkInTime ? formatTimeIST(session.checkInTime) : '--:--'}</strong></div><div className="col-6"><div className="text-muted-hz" style={{ fontSize: 12 }}>Check out</div><strong>{session?.checkOutTime ? formatTimeIST(session.checkOutTime) : '--:--'}</strong></div></div>
                <div className="d-flex flex-wrap gap-2">
                  {canWebCheckIn && <Button icon={LogIn} onClick={() => checkIn.mutate()} loading={checkIn.isPending} disabled={!!session || busy || context.data.attendanceStatus === 'BIOMETRIC_PUNCHED'}>
                    {checkIn.isPending ? (locationStatus === 'locating' ? 'Getting your location…' : locationStatus === 'improving' ? 'Improving location accuracy…' : 'Verifying location…') : 'Check in'}
                  </Button>}
                  <Button variant="secondary" icon={LogOut} onClick={() => checkOut.mutate()} loading={checkOut.isPending} disabled={!session || busy}>Check out</Button>
                </div>
                {!context.data.allowedWebCheckIn && context.data.requiresBiometric && <div className="alert alert-info mb-0" role="status">Biometric attendance required. Please mark attendance using your assigned biometric device.</div>}
              </div>
            )}
          </Card>
        </div>
        <div className="col-12 col-lg-5"><Card title="Work location" subtitle="Your check-in options follow your organization’s attendance policy."><div className="btn-group w-100 mb-3" role="group"><button type="button" className={`btn ${mode === 'OFFICE' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setMode('OFFICE')}><MapPin size={16} className="me-2" />Office</button><button type="button" className={`btn ${mode === 'WFH' ? 'btn-primary' : 'btn-outline-secondary'}`} disabled={context.data?.wfhStatus !== 'APPROVED' || !context.data?.allowedWebCheckIn} onClick={() => setMode('WFH')}><Home size={16} className="me-2" />WFH</button></div><div className="text-muted-hz" style={{ fontSize: 13 }}>{mode === 'OFFICE' ? `${locations.data?.length || 0} active office location(s) available.` : 'Approved WFH is required before remote check-in.'}</div></Card></div>
      </div>

      <Card title="Request work from home" subtitle="Submit a future-date request for manager approval."><div className="row g-3 align-items-end"><div className="col-12 col-md-3"><label className="form-label" htmlFor="wfh-date">Work date</label><input id="wfh-date" className="form-control" type="date" min={localDate(1)} value={workDate} onChange={(event) => setWorkDate(event.target.value)} /></div><div className="col-12 col-md-6"><label className="form-label" htmlFor="wfh-reason">Reason</label><input id="wfh-reason" className="form-control" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Optional reason" maxLength={500} /></div><div className="col-12 col-md-3"><Button className="w-100" icon={CalendarDays} onClick={() => requestWfh.mutate()} loading={requestWfh.isPending} disabled={!workDate}>Request approval</Button></div></div></Card>

      <Card title="My WFH requests"><div className="table-responsive">{wfhRequests.isLoading && <SkeletonText lines={3} />}{!wfhRequests.isLoading && (!wfhRequests.data || wfhRequests.data.length === 0) && <EmptyState icon={CalendarDays} title="No WFH requests" description="Approved requests will appear here." />}{wfhRequests.data?.length > 0 && <table className="table mb-0 align-middle"><thead><tr><th>Date</th><th>Reason</th><th>Status</th><th>Manager note</th></tr></thead><tbody>{wfhRequests.data.map((request) => <tr key={request.id}><td>{request.workDate}</td><td>{request.reason || '—'}</td><td><StatusBadge status={request.status} variant={request.status === 'APPROVED' ? 'success' : request.status === 'REJECTED' ? 'danger' : 'warning'} dot={false}>{request.status}</StatusBadge></td><td>{request.managerNote || '—'}</td></tr>)}</tbody></table>}</div></Card>

      {policy.data?.manualRegularizationEnabled && (
        <>
          <Card title="Request attendance regularization" subtitle="Use this for genuine exceptions such as a biometric, device, or network failure. This does not create a normal check-in.">
            <form className="row g-3 align-items-end" onSubmit={(event) => { event.preventDefault(); requestRegularization.mutate(); }}>
              <div className="col-12 col-md-3"><label className="form-label" htmlFor="regularization-date">Attendance date</label><input id="regularization-date" className="form-control" type="date" max={localDate()} value={regularizationDate} onChange={(event) => setRegularizationDate(event.target.value)} required /></div>
              <div className="col-6 col-md-2"><label className="form-label" htmlFor="regularization-check-in">Check in</label><input id="regularization-check-in" className="form-control" type="time" value={regularizationCheckIn} onChange={(event) => setRegularizationCheckIn(event.target.value)} required /></div>
              <div className="col-6 col-md-2"><label className="form-label" htmlFor="regularization-check-out">Check out</label><input id="regularization-check-out" className="form-control" type="time" value={regularizationCheckOut} onChange={(event) => setRegularizationCheckOut(event.target.value)} /></div>
              <div className="col-12 col-md-3"><label className="form-label" htmlFor="regularization-reason">Reason</label><input id="regularization-reason" className="form-control" value={regularizationReason} onChange={(event) => setRegularizationReason(event.target.value)} maxLength={500} required /></div>
              <div className="col-12 col-md-2"><Button type="submit" className="w-100" loading={requestRegularization.isPending} disabled={!regularizationCheckIn || !regularizationReason.trim()}>Submit request</Button></div>
            </form>
          </Card>
          <Card title="My regularization requests">
            {regularizations.isLoading && <SkeletonText lines={2} />}
            {regularizations.data?.length === 0 && <EmptyState icon={CalendarDays} title="No regularization requests" description="Requests you submit will appear here." />}
            {regularizations.data?.length > 0 && <div className="table-responsive"><table className="table mb-0 align-middle"><thead><tr><th>Date</th><th>Requested time</th><th>Reason</th><th>Status</th><th>Review note</th></tr></thead><tbody>{regularizations.data.map((request) => <tr key={request.id}><td>{request.attendanceDate}</td><td>{request.requestedCheckIn}{request.requestedCheckOut ? ` – ${request.requestedCheckOut}` : ''}</td><td>{request.reason}</td><td><StatusBadge status={request.status} variant={request.status === 'APPROVED' ? 'success' : request.status === 'REJECTED' ? 'danger' : 'warning'} dot={false}>{request.status}</StatusBadge></td><td>{request.reviewNote || '—'}</td></tr>)}</tbody></table></div>}
          </Card>
        </>
      )}
    </div>
  );
}
