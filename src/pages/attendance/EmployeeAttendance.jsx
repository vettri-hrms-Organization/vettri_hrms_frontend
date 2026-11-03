import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Clock3, FileText, Home, LogIn, LogOut, MapPin, RefreshCw } from 'lucide-react';
import { attendanceApi } from '../../api/endpoints/attendance';
import { dailyAttendanceApi } from '../../api/endpoints/shifts';
import Dialog from '../../components/ui/Dialog';
import SelfieCapture from '../../components/attendance/SelfieCapture';
import { istToday } from './shiftUtils';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import StatusBadge, { formatStatusLabel } from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { formatDateIST, formatTimeIST } from '../../utils/formatDateTime';
import { useAuth } from '../../hooks/useAuth';
import MyShiftOvertime from './MyShiftOvertime';
import { AttendanceCalendar, AttendanceLog, AttendancePolicyDialog, AttendanceStats, LiveClock, WeekTimings, logPeriods } from './MyAttendanceParts';
import './my-attendance.css';
import { timesheetsApi } from '../../api/endpoints/timesheets';
import LogWorkDialog from '../timesheets/LogWorkDialog';

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
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState('OFFICE');
  const [logTab, setLogTab] = useState('log');
  const [logPeriodKey, setLogPeriodKey] = useState('30');
  const [wfhOpen, setWfhOpen] = useState(false);
  const [regularizeOpen, setRegularizeOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  // Clock format is a per-person display preference, remembered on this device.
  const [use24h, setUse24hState] = useState(() => {
    try { return localStorage.getItem('vettri.attendance.24h') === '1'; } catch { return false; }
  });
  const setUse24h = (value) => {
    setUse24hState(value);
    try { localStorage.setItem('vettri.attendance.24h', value ? '1' : '0'); } catch { /* storage unavailable */ }
  };
  const [workDate, setWorkDate] = useState(localDate(1));
  const [reason, setReason] = useState('');
  const [regularizationDate, setRegularizationDate] = useState(localDate());
  const [regularizationCheckIn, setRegularizationCheckIn] = useState('');
  const [regularizationCheckOut, setRegularizationCheckOut] = useState('');
  const [regularizationReason, setRegularizationReason] = useState('');
  const [message, setMessage] = useState(null);
  // After check-out, offer the quick timesheet form when the company turned that on.
  const [logWork, setLogWork] = useState(false);
  const timesheetSettings = useQuery({ queryKey: ['timesheet-settings'], queryFn: timesheetsApi.settings, staleTime: 10 * 60 * 1000, retry: false });
  const [locationStatus, setLocationStatus] = useState('idle');
  const [selfieOpen, setSelfieOpen] = useState(false);
  // Last confirmed selfie, reused by "Try again" after a location error so the employee isn't asked twice.
  const lastSelfieRef = useRef(null);
  const todayIst = istToday();
  const todayShift = useQuery({
    queryKey: ['attendance-daily-me', todayIst, todayIst],
    queryFn: () => dailyAttendanceApi.mine(todayIst, todayIst),
    retry: false,
  });

  const today = useQuery({ queryKey: ['attendance-today'], queryFn: attendanceApi.today });
  const periods = logPeriods(todayIst);
  const logPeriod = periods.find((option) => option.key === logPeriodKey) || periods[0];
  // Check-in sessions for the log period: they add where the day was worked from (e.g. WFH).
  const history = useQuery({
    queryKey: ['attendance-history', logPeriod.from, logPeriod.to],
    queryFn: () => attendanceApi.myHistory(logPeriod.from, logPeriod.to),
  });
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
    // Selfie travels as a base64 JPEG data URL in the existing JSON body (`selfieImage`),
    // alongside the GPS fields - see AttendanceCheckInRequest on the backend.
    mutationFn: async ({ selfieImage } = {}) => {
      setLocationStatus('locating');
      try {
        const location = mode === 'OFFICE' ? await acquireBestLocation((status) => setLocationStatus(status)) : {};
        setLocationStatus('verifying');
        const payload = { ...location, source: location.source || 'WEB_DESKTOP', workingMode: mode, wfh: mode === 'WFH', officeLocationId: locations.data?.[0]?.id };
        if (selfieImage) payload.selfieImage = selfieImage;
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
      setSelfieOpen(false);
      lastSelfieRef.current = null;
      setMessage({ type: 'success', text: 'You are checked in.' });
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-history'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-daily-me'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-context'] });
    },
    onError: (error) => {
      const serverMessage = error.response?.data?.message;
      const selfieError = selfieErrorMessage(serverMessage);
      if (selfieError) {
        lastSelfieRef.current = null;
        setMessage({ type: 'error', code: 'SELFIE', text: selfieError });
        return;
      }
      setSelfieOpen(false);
      const code = error.response?.data?.code || error.message;
      setMessage({
        type: 'error',
        code,
        text: serverMessage || locationErrorMessage(code, error.response?.data?.accuracyMeters),
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
      if (timesheetSettings.data?.enabled && timesheetSettings.data?.promptOnCheckout) setLogWork(true);
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-history'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-daily-me'] });
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
      queryClient.invalidateQueries({ queryKey: ['attendance-history'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-daily-me'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-context'] });
    },
    onError: (error) => setMessage({ type: 'error', text: error.response?.data?.message || 'Attendance regularization could not be submitted.' }),
  });

  const session = today.data;
  const busy = checkIn.isPending || checkOut.isPending;
  // Same rule as the backend: self check-in/out needs its own permission,
  // unless the user holds attendance or directory access.
  const hasStaffAttendanceAccess = hasPermission('EMPLOYEE_VIEW') || hasPermission('ATTENDANCE_VIEW');
  const canSelfCheckIn = hasStaffAttendanceAccess || hasPermission('SELF_ATTENDANCE_CHECKIN');
  const canSelfCheckOut = hasStaffAttendanceAccess || hasPermission('SELF_ATTENDANCE_CHECKOUT');
  const canWebCheckIn = canSelfCheckIn && context.data?.allowedWebCheckIn
    && (mode !== 'WFH' || context.data.wfhStatus === 'APPROVED');

  const requireSelfie = !!policy.data?.requireSelfieAtCheckIn;
  const shiftToday = todayShift.data?.[0];

  function startCheckIn() {
    setMessage(null);
    if (requireSelfie) {
      setSelfieOpen(true);
      return;
    }
    checkIn.mutate({});
  }

  function confirmSelfie(dataUrl) {
    lastSelfieRef.current = dataUrl;
    checkIn.mutate({ selfieImage: dataUrl });
  }

  function retryCheckIn() {
    if (requireSelfie && !lastSelfieRef.current) {
      setSelfieOpen(true);
      return;
    }
    checkIn.mutate({ selfieImage: lastSelfieRef.current || undefined });
  }

  function selfieErrorMessage(serverMessage) {
    if (typeof serverMessage !== 'string' || !serverMessage.startsWith('SELFIE_')) return null;
    if (serverMessage.startsWith('SELFIE_REQUIRED')) return 'Your organization requires a selfie to check in. Take a selfie and try again.';
    if (serverMessage.startsWith('SELFIE_TOO_LARGE')) return 'The selfie is too large. Retake it and try again.';
    return 'The selfie could not be read. Retake it as a photo and try again.';
  }

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

  const sessionsByDate = new Map((history.data || []).map((record) => [record.attendanceDate, record]));
  const calendarMonth = logPeriod.key === '30' ? todayIst.slice(0, 7) : logPeriod.key;
  const statusTitle = session ? (session.status === 'CHECKED_OUT' ? 'Checked out' : 'Checked in') : context.data?.latestBiometricPunchType ? 'Biometric punch received' : context.data?.requiresBiometric ? 'Awaiting biometric' : 'Not checked in';
  const statusDetail = session
    ? `${session.checkInTime ? `In ${formatTimeIST(session.checkInTime)}` : ''}${session.checkOutTime ? ` · Out ${formatTimeIST(session.checkOutTime)}` : ''}${[session.locationType, session.source].filter(Boolean).length ? ` · ${[session.locationType, session.source].filter(Boolean).map(formatStatusLabel).join(' · ')}` : ''}`
    : context.data?.latestBiometricPunchType ? `${formatStatusLabel(context.data.latestBiometricPunchType)} · ${formatTimeIST(context.data.latestBiometricPunchTime)}` : context.data?.requiresBiometric ? 'Please use your assigned biometric device.' : 'Check in when you are ready.';

  function openRegularize(date) {
    setRegularizationDate(date || localDate());
    setRegularizeOpen(true);
  }

  return (
    <div className="hz-my-att">
      {logWork && <LogWorkDialog onClose={() => setLogWork(false)} />}
      <Dialog
        open={selfieOpen}
        onClose={() => { if (!checkIn.isPending) setSelfieOpen(false); }}
        title="Check-in selfie"
        description="Look at the camera and take a quick selfie. It is sent with your location to confirm your check-in."
        size="sm"
      >
        {selfieOpen && (
          <SelfieCapture
            busy={checkIn.isPending}
            onCapture={confirmSelfie}
            onCancel={() => setSelfieOpen(false)}
          />
        )}
        {selfieOpen && message?.code === 'SELFIE' && <div className="alert alert-danger mt-3 mb-0" role="alert">{message.text}</div>}
      </Dialog>

      <PageHeader eyebrow="Self service" title="My Attendance" description="Check in, see how your week is going, and keep your attendance record right." actions={<Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => { today.refetch(); history.refetch(); context.refetch(); policy.refetch(); wfhRequests.refetch(); regularizations.refetch(); queryClient.invalidateQueries({ queryKey: ['attendance-daily-me'] }); }}>Refresh</Button>} />

      {message && <div className={`alert ${message.type === 'error' ? 'alert-danger' : 'alert-success'} mb-0`} role="status">{message.text}{message.type === 'error' && (message.code?.startsWith('LOCATION_') || message.code === 'SELFIE') && <button type="button" className="btn btn-link p-0 ms-2" onClick={retryCheckIn}>Try again</button>}</div>}

      <section className="hz-my-att__top">
        <div>
          <h2 className="hz-my-att__heading">Attendance stats</h2>
          <AttendanceStats />
        </div>
        <div>
          <h2 className="hz-my-att__heading">Timings</h2>
          <WeekTimings shiftToday={shiftToday} use24h={use24h} />
        </div>
        <div>
          <h2 className="hz-my-att__heading">Actions</h2>
          <div className="hz-my-att__panel hz-my-att__actions">
            <div className="hz-my-att__actions-main">
              <LiveClock use24h={use24h} />
              {(today.isLoading || context.isLoading) && <SkeletonText lines={2} />}
              {(today.isError || context.isError) && <ErrorState description={checkIn.isSuccess ? 'Check-in succeeded, but today’s attendance could not be refreshed.' : 'Couldn’t load today’s attendance policy.'} onRetry={() => { today.refetch(); context.refetch(); }} />}
              {!today.isLoading && !context.isLoading && !today.isError && !context.isError && (
                <div className="hz-my-att__punch">
                  <div className={`hz-my-att__punch-state${session?.status === 'CHECKED_IN' || context.data.latestBiometricPunchType ? ' is-in' : ''}`}>
                    <Clock3 size={18} aria-hidden="true" />
                    <div><strong>{statusTitle}</strong><span>{statusDetail}</span></div>
                  </div>
                  {canWebCheckIn && requireSelfie && !session && <div className="hz-my-att__muted">A selfie is required when you check in.</div>}
                  <div className="hz-my-att__punch-buttons">
                    {canWebCheckIn && <Button icon={LogIn} onClick={startCheckIn} loading={checkIn.isPending} disabled={!!session || busy || context.data.attendanceStatus === 'BIOMETRIC_PUNCHED'}>
                      {checkIn.isPending ? (locationStatus === 'locating' ? 'Getting your location…' : locationStatus === 'improving' ? 'Improving location accuracy…' : 'Verifying location…') : 'Check in'}
                    </Button>}
                    {canSelfCheckOut && <Button variant="secondary" icon={LogOut} onClick={() => checkOut.mutate()} loading={checkOut.isPending} disabled={!session || busy}>Check out</Button>}
                  </div>
                  {context.data.wfhStatus === 'APPROVED' && context.data.allowedWebCheckIn && !session && (
                    <div className="hz-my-att__mode" role="group" aria-label="Where are you working today">
                      <button type="button" className={mode === 'OFFICE' ? 'is-active' : ''} onClick={() => setMode('OFFICE')}><MapPin size={14} aria-hidden="true" /> Office</button>
                      <button type="button" className={mode === 'WFH' ? 'is-active' : ''} onClick={() => setMode('WFH')}><Home size={14} aria-hidden="true" /> Work from home</button>
                    </div>
                  )}
                  {!context.data.allowedWebCheckIn && context.data.requiresBiometric && <div className="hz-my-att__muted">Biometric attendance required. Mark attendance on your assigned device.</div>}
                </div>
              )}
            </div>
            <div className="hz-my-att__links">
              <button type="button" className="hz-my-att__link" onClick={() => setWfhOpen(true)}><Home size={15} aria-hidden="true" /> Request work from home</button>
              {policy.data?.manualRegularizationEnabled && <button type="button" className="hz-my-att__link" onClick={() => openRegularize(localDate())}><Clock3 size={15} aria-hidden="true" /> Regularize attendance</button>}
              <button type="button" className="hz-my-att__link" onClick={() => setPolicyOpen(true)}><FileText size={15} aria-hidden="true" /> Attendance policy</button>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="att-logs">
        <div className="hz-my-att__logs-head">
          <h2 id="att-logs" className="hz-my-att__heading">Logs &amp; requests</h2>
          <label className="hz-my-att__toggle">
            <input type="checkbox" role="switch" checked={use24h} onChange={(event) => setUse24h(event.target.checked)} />
            <span aria-hidden="true" />
            24 hour format
          </label>
        </div>
        <div className="hz-my-att__tabs" role="tablist" aria-label="Logs and requests">
          {[['log', 'Attendance log'], ['calendar', 'Calendar'], ['requests', 'Attendance requests']].map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={logTab === key} className={logTab === key ? 'is-active' : ''} onClick={() => setLogTab(key)}>{label}</button>
          ))}
        </div>

        {logTab !== 'requests' && (
          <div className="hz-my-att__panel hz-my-att__log">
            <div className="hz-my-att__log-head">
              <h3>{logPeriod.key === '30' ? (logTab === 'calendar' ? new Date(`${calendarMonth}-01T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'Last 30 days') : new Date(`${logPeriod.from}T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h3>
              <div className="hz-my-att__periods" role="group" aria-label="Period">
                {periods.map((option) => (
                  <button key={option.key} type="button" className={logPeriod.key === option.key ? 'is-active' : ''} aria-pressed={logPeriod.key === option.key} onClick={() => setLogPeriodKey(option.key)}>{option.label}</button>
                ))}
              </div>
            </div>
            {logTab === 'log' && <AttendanceLog period={logPeriod} use24h={use24h} sessionsByDate={sessionsByDate} onRegularize={openRegularize} canRegularize={!!policy.data?.manualRegularizationEnabled} />}
            {logTab === 'calendar' && <AttendanceCalendar month={calendarMonth} />}
          </div>
        )}
        {logTab === 'log' && <div className="mt-4"><MyShiftOvertime from={logPeriod.from} to={logPeriod.to} /></div>}

        {logTab === 'requests' && (
          <div className="d-flex flex-column gap-4">
            <Card title="Work from home requests" actions={<Button size="sm" variant="secondary" icon={CalendarDays} onClick={() => setWfhOpen(true)}>Request</Button>}><div className="table-responsive">{wfhRequests.isLoading && <SkeletonText lines={3} />}{!wfhRequests.isLoading && (!wfhRequests.data || wfhRequests.data.length === 0) && <EmptyState icon={CalendarDays} title="No WFH requests" description="Approved requests will appear here." />}{wfhRequests.data?.length > 0 && <table className="table mb-0 align-middle"><thead><tr><th>Date</th><th>Reason</th><th>Status</th><th>Manager note</th></tr></thead><tbody>{wfhRequests.data.map((request) => <tr key={request.id}><td>{formatDateIST(`${request.workDate}T12:00:00Z`)}</td><td>{request.reason || '—'}</td><td><StatusBadge status={request.status} variant={request.status === 'APPROVED' ? 'success' : request.status === 'REJECTED' ? 'danger' : 'warning'} dot={false}>{formatStatusLabel(request.status)}</StatusBadge></td><td>{request.managerNote || '—'}</td></tr>)}</tbody></table>}</div></Card>
            {policy.data?.manualRegularizationEnabled && (
              <Card title="Regularization requests" actions={<Button size="sm" variant="secondary" icon={Clock3} onClick={() => openRegularize(localDate())}>Request</Button>}>
                {regularizations.isLoading && <SkeletonText lines={2} />}
                {regularizations.data?.length === 0 && <EmptyState icon={CalendarDays} title="No regularization requests" description="Requests you submit will appear here." />}
                {regularizations.data?.length > 0 && <div className="table-responsive"><table className="table mb-0 align-middle"><thead><tr><th>Date</th><th>Requested time</th><th>Reason</th><th>Status</th><th>Review note</th></tr></thead><tbody>{regularizations.data.map((request) => <tr key={request.id}><td>{formatDateIST(`${request.attendanceDate}T12:00:00Z`)}</td><td>{request.requestedCheckIn}{request.requestedCheckOut ? ` – ${request.requestedCheckOut}` : ''}</td><td>{request.reason}</td><td><StatusBadge status={request.status} variant={request.status === 'APPROVED' ? 'success' : request.status === 'REJECTED' ? 'danger' : 'warning'} dot={false}>{formatStatusLabel(request.status)}</StatusBadge></td><td>{request.reviewNote || '—'}</td></tr>)}</tbody></table></div>}
              </Card>
            )}
          </div>
        )}
      </section>

      <Dialog open={wfhOpen} onClose={() => setWfhOpen(false)} title="Request work from home" description="For a future date; your manager approves it." size="sm">
        <form className="d-flex flex-column gap-3" onSubmit={(event) => { event.preventDefault(); requestWfh.mutate(undefined, { onSuccess: () => setWfhOpen(false) }); }}>
          <div><label className="form-label" htmlFor="wfh-date">Work date</label><input id="wfh-date" className="form-control" type="date" min={localDate(1)} value={workDate} onChange={(event) => setWorkDate(event.target.value)} required /></div>
          <div><label className="form-label" htmlFor="wfh-reason">Reason</label><input id="wfh-reason" className="form-control" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Optional reason" maxLength={500} /></div>
          <div className="d-flex justify-content-end gap-2"><Button type="button" variant="secondary" onClick={() => setWfhOpen(false)}>Cancel</Button><Button type="submit" icon={CalendarDays} loading={requestWfh.isPending} disabled={!workDate}>Request approval</Button></div>
        </form>
      </Dialog>

      <Dialog open={regularizeOpen} onClose={() => setRegularizeOpen(false)} title="Regularize attendance" description="For genuine exceptions such as a biometric, device or network failure. This does not create a normal check-in.">
        <form className="row g-3" onSubmit={(event) => { event.preventDefault(); requestRegularization.mutate(undefined, { onSuccess: () => setRegularizeOpen(false) }); }}>
          <div className="col-12"><label className="form-label" htmlFor="regularization-date">Attendance date</label><input id="regularization-date" className="form-control" type="date" max={localDate()} value={regularizationDate} onChange={(event) => setRegularizationDate(event.target.value)} required /></div>
          <div className="col-6"><label className="form-label" htmlFor="regularization-check-in">Check in</label><input id="regularization-check-in" className="form-control" type="time" value={regularizationCheckIn} onChange={(event) => setRegularizationCheckIn(event.target.value)} required /></div>
          <div className="col-6"><label className="form-label" htmlFor="regularization-check-out">Check out</label><input id="regularization-check-out" className="form-control" type="time" value={regularizationCheckOut} onChange={(event) => setRegularizationCheckOut(event.target.value)} /></div>
          <div className="col-12"><label className="form-label" htmlFor="regularization-reason">Reason</label><input id="regularization-reason" className="form-control" value={regularizationReason} onChange={(event) => setRegularizationReason(event.target.value)} maxLength={500} required /></div>
          <div className="col-12 d-flex justify-content-end gap-2"><Button type="button" variant="secondary" onClick={() => setRegularizeOpen(false)}>Cancel</Button><Button type="submit" loading={requestRegularization.isPending} disabled={!regularizationCheckIn || !regularizationReason.trim()}>Submit request</Button></div>
        </form>
      </Dialog>

      <AttendancePolicyDialog open={policyOpen} onClose={() => setPolicyOpen(false)} policy={policy.data} shiftToday={shiftToday} use24h={use24h} />
    </div>
  );
}
