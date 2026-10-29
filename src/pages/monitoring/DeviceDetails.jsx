import { useEffect, useMemo, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Link,
  useParams,
  useSearchParams,
} from 'react-router-dom';

import {
  ArrowLeft,
  Monitor,
  AppWindow,
  Activity,
  KeyRound,
  Copy,
  Terminal,
  MonitorUp,
  ShieldCheck,
  RefreshCw,
  Ban,
  Network,
  Cpu,
  HardDrive,
  LifeBuoy,
  LayoutDashboard,
  Wifi,
  UserRound,
} from 'lucide-react';

import {
  monitoringApi,
  getDeviceName,
  getDeviceEmployeeName,
  getDeviceEmployeeId,
  isDeviceOnline,
  getDeviceLastSeen,
  getDeviceOS,
  getDeviceAgentVersion,
  getSessionId,
  getSessionApp,
  getSessionWindowTitle,
  getSessionStart,
  getSessionEnd,
  getSessionDurationSeconds,
  aggregateSessionsByApp,
} from '../../api/endpoints/monitoring';

import {
  formatDateTimeIST,
  timeAgoIST,
  formatDurationShort,
} from '../../utils/formatDateTime';
import { useAuth } from '../../hooks/useAuth';

import Card from '../../components/ui/Card';
import StatusBadge from '../../components/ui/StatusBadge';
import Table from '../../components/ui/Table';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonText } from '../../components/ui/Skeleton';
import Dialog from '../../components/ui/Dialog';
import Button from '../../components/ui/Button';
import Tabs from '../../components/ui/Tabs';

const DEVICE_TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'hardware', label: 'Hardware', icon: Cpu },
  { key: 'applications', label: 'Applications', icon: AppWindow },
  { key: 'remote', label: 'Remote support', icon: LifeBuoy },
  { key: 'activity', label: 'Activity', icon: Activity },
];
const DEVICE_TAB_KEYS = new Set(DEVICE_TABS.map((tab) => tab.key));
const DAY_MS = 24 * 60 * 60 * 1000;


export default function DeviceDetails() {

  const { id } = useParams();

  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canRequestInventoryScan = hasPermission('IT_MANAGEMENT_ACCESS')
    && hasPermission('MONITORING_MANAGE');


  // ============================================================
  // STATE
  // ============================================================

  const [otpOpen, setOtpOpen] = useState(false);

  const [otp, setOtp] = useState('');

  const [reason, setReason] = useState('');

  const [newToken, setNewToken] = useState('');
  const [revealedPassword, setRevealedPassword] = useState('');

  // Recent Activity Sessions pagination
  const [sessionPage, setSessionPage] = useState(1);


  // ============================================================
  // CONSTANTS
  // ============================================================

  const SESSION_PAGE_SIZE = 5;

  const supportKey = [
    'remote-support-jobs',
    id,
  ];


  // ============================================================
  // DEVICE QUERY
  // ============================================================

  const {
    data: device,
    isLoading: deviceLoading,
    isError: deviceError,
    refetch: refetchDevice,
  } = useQuery({
    queryKey: [
      'monitoring-device',
      id,
    ],

    queryFn: () =>
      monitoringApi.deviceById(id),

    enabled: Boolean(id),

    // Keep live heartbeat
    refetchInterval: (query) =>
      ['PENDING', 'SCANNING'].includes(query.state.data?.inventoryStatus)
        ? 3_000
        : 30_000,

    // Avoid unnecessary request when browser gets focus
    refetchOnWindowFocus: false,

    // Refresh after reconnecting
    refetchOnReconnect: true,
  });

  const inventoryScan = useMutation({
    mutationFn: () => monitoringApi.requestDeviceInventoryScan(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['monitoring-device', id] });
    },
  });


  // ============================================================
  // TABS (persisted in ?tab= so links and the back button work)
  // ============================================================

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab = DEVICE_TAB_KEYS.has(requestedTab) ? requestedTab : 'overview';

  const changeTab = (key) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (key === 'overview') next.delete('tab');
      else next.set('tab', key);
      return next;
    });
  };


  // ============================================================
  // FLEET (shares the Devices page cache; used only to compare
  // this device's agent version with the newest one in the fleet)
  // ============================================================

  const fleetQuery = useQuery({
    queryKey: ['monitoring-devices'],
    queryFn: monitoringApi.devices,
    enabled: Boolean(id),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const health = useMemo(
    () => buildDeviceHealth(device, Array.isArray(fleetQuery.data) ? fleetQuery.data : null),
    [device, fleetQuery.data]
  );


  // ============================================================
  // DEVICE SESSIONS QUERY
  // ============================================================

  const {
    data: sessions,
    isLoading: sessionsLoading,
    isError: sessionsError,
    refetch: refetchSessions,
  } = useQuery({
    queryKey: [
      'monitoring-sessions-device',
      id,
    ],

    queryFn: () =>
      monitoringApi.sessionsByDevice(id),

    enabled: Boolean(id),

    refetchOnWindowFocus: false,
  });


  // ============================================================
  // REQUEST TOKEN OTP
  // ============================================================

  const requestOtp = useMutation({
    mutationFn: () =>
      monitoringApi.requestTokenOtp(id),
  });


  // ============================================================
  // CONFIRM TOKEN OTP
  // ============================================================

  const confirmOtp = useMutation({

    mutationFn: () =>
      monitoringApi.confirmTokenOtp(
        id,
        otp,
        reason
      ),

    onSuccess: (result) => {

      setNewToken(
        result?.newToken || ''
      );

      setOtp('');

      queryClient.invalidateQueries({
        queryKey: [
          'monitoring-token-history',
          id,
        ],
      });
    },
  });


  // ============================================================
  // REMOTE SUPPORT QUERY
  // ============================================================

  const supportQuery = useQuery({

    queryKey: supportKey,

    queryFn: () =>
      monitoringApi.remoteSupportJobs(id),

    enabled: Boolean(id),

    /*
     * Remote support polling:
     *
     * No job        -> STOP
     * READY         -> STOP
     * FAILED        -> STOP
     * PROVISIONING  -> poll every 3 seconds
     */
    refetchInterval: (query) => {

      const data =
        query.state.data;

      const jobs =
        Array.isArray(data)
          ? data
          : Array.isArray(data?.content)
            ? data.content
            : [];

      // No remote support job.
      // IMPORTANT: Do NOT poll forever.
      if (jobs.length === 0) {
        return false;
      }

      const latest =
        [...jobs].sort(
          (a, b) =>
            new Date(
              b.updatedAt ||
              b.createdAt ||
              0
            ) -
            new Date(
              a.updatedAt ||
              a.createdAt ||
              0
            )
        )[0];

      if (!latest) {
        return false;
      }

      // Provisioning completed successfully
      if (
        latest.status === 'READY'
      ) {
        return false;
      }

      // Provisioning failed
      if (
        latest.status === 'FAILED'
      ) {
        return false;
      }

      // Still provisioning
      return 3000;
    },

    refetchOnWindowFocus: false,

    refetchOnReconnect: true,
  });


  // ============================================================
  // REMOTE SUPPORT MUTATION
  // ============================================================

  const supportMutation =
    useMutation({

      mutationFn: (operation) => {

        const operations = {

          configure:
            monitoringApi.configureRemoteSupport,

          detect:
            monitoringApi.detectRemoteSupport,

          rotate:
            monitoringApi.rotateRemoteSupport,

          disable:
            monitoringApi.disableRemoteSupport,
        };

        const action =
          operations[operation];

        if (!action) {
          throw new Error(
            `Unsupported remote support operation: ${operation}`
          );
        }

        return action(id);
      },

      onSuccess: () => {

        queryClient.invalidateQueries({
          queryKey: supportKey,
        });
      },
    });


  // ============================================================
  // LATEST REMOTE SUPPORT JOB
  // ============================================================

  const latestSupport = useMemo(
    () => {

      const data =
        supportQuery.data;

      const jobs =
        Array.isArray(data)
          ? data
          : Array.isArray(data?.content)
            ? data.content
            : [];

      return [...jobs].sort(
        (a, b) =>
          new Date(
            b.updatedAt ||
            b.createdAt ||
            0
          ) -
          new Date(
            a.updatedAt ||
            a.createdAt ||
            0
          )
      )[0];

    },
    [
      supportQuery.data,
    ]
  );


  // ============================================================
  // RUSTDESK CONNECT URL
  // ============================================================

  const rustDeskConnectUrl =
    latestSupport?.status === 'READY' &&
    latestSupport?.rustDeskId
      ? `rustdesk://connect/${encodeURIComponent(
          latestSupport.rustDeskId.trim()
        )}`
      : null;

  const credentialMutation = useMutation({
    mutationFn: () => monitoringApi.remoteSupportCredential(id, latestSupport?.jobId),
    onSuccess: (data) => setRevealedPassword(data.password || ''),
  });

  useEffect(() => {
    setRevealedPassword('');
    credentialMutation.reset();
  }, [id, latestSupport?.jobId]);


  // ============================================================
  // REMOTE SUPPORT SUMMARY STATUS
  // ============================================================

  const supportSummaryStatus =
    latestSupport?.status === 'READY'
      ? 'READY'
      : latestSupport?.status === 'FAILED'
        ? 'FAILED'
        : latestSupport
          ? 'PROVISIONING'
          : 'NOT_CONFIGURED';


  // ============================================================
  // REMOTE SUPPORT STAGES
  // ============================================================

  const supportStages = [
    'CONFIGURE_CLICKED',
    'BACKEND_RECEIVED',
    'JOB_CREATED',
    'AGENT_REACHED',
    'AGENT_STARTED',
    'CREDENTIAL_READY',
    'RUSTDESK_PROVISIONING',
    'PASSWORD_CONFIGURED',
    'SERVER_CONFIGURED',
    'SERVICE_READY',
    'ID_VERIFIED',
    'RESULT_SENT',
    'BACKEND_RESULT_ACCEPTED',
  ];


  const terminalStage =
    latestSupport?.status === 'FAILED'
      ? 'FAILED'
      : latestSupport?.status === 'READY'
        ? 'READY'
        : null;


  const displayedStages =
    terminalStage
      ? [
          ...supportStages,
          terminalStage,
        ]
      : supportStages;


  const currentStageIndex =
    latestSupport?.provisioningStage
      ? displayedStages.indexOf(
          latestSupport.provisioningStage
        )
      : -1;


  // ============================================================
  // RUSTDESK CONNECT
  // ============================================================

  const handleRustDeskConnect = () => {

    if (!rustDeskConnectUrl) {
      return;
    }

    window.location.href =
      rustDeskConnectUrl;
  };


  // ============================================================
  // SORT ALL SESSIONS
  //
  // Latest session first.
  // ============================================================

  const sortedSessions = useMemo(
    () => {

      return [...(sessions || [])].sort(
        (a, b) =>
          new Date(
            getSessionStart(b)
          ) -
          new Date(
            getSessionStart(a)
          )
      );

    },
    [sessions]
  );


  // ============================================================
  // SESSION PAGINATION
  // ============================================================

  const totalSessionPages =
    Math.max(
      1,
      Math.ceil(
        sortedSessions.length /
          SESSION_PAGE_SIZE
      )
    );


  /*
   * Protect against current page becoming
   * invalid when new session data arrives.
   */
  const safeSessionPage =
    Math.min(
      sessionPage,
      totalSessionPages
    );


  /*
   * Only 5 records displayed at a time.
   *
   * Page 1 = latest 5
   * Page 2 = next 5
   * Page 3 = next 5
   */
  const recentSessions =
    useMemo(() => {

      const start =
        (safeSessionPage - 1) *
        SESSION_PAGE_SIZE;

      return sortedSessions.slice(
        start,
        start + SESSION_PAGE_SIZE
      );

    }, [
      sortedSessions,
      safeSessionPage,
    ]);


  // ============================================================
  // PAGINATION DISPLAY COUNTS
  // ============================================================

  const sessionStartIndex =
    sortedSessions.length === 0
      ? 0
      : (
          (safeSessionPage - 1) *
            SESSION_PAGE_SIZE
        ) + 1;


  const sessionEndIndex =
    Math.min(
      safeSessionPage *
        SESSION_PAGE_SIZE,
      sortedSessions.length
    );


  // ============================================================
  // SESSION PAGE HANDLER
  // ============================================================

  const goToSessionPage =
    (page) => {

      const nextPage =
        Math.max(
          1,
          Math.min(
            page,
            totalSessionPages
          )
        );

      setSessionPage(
        nextPage
      );
    };


  // ============================================================
  // APPLICATION USAGE
  // ============================================================

  const appUsage =
    useMemo(
      () =>
        aggregateSessionsByApp(
          sessions,
          8
        ),
      [sessions]
    );


  const maxAppSeconds =
    appUsage[0]?.seconds || 1;


  // ============================================================
  // SESSION TABLE COLUMNS
  // ============================================================

  const sessionColumns = [

    {
      key: 'application',

      label: 'Application',

      headerClassName: 'ps-3',

      className: 'ps-3',

      render: (s) => (
        <span
          style={{
            fontWeight: 600,
            color:
              'var(--hz-text-primary)',
          }}
        >
          {getSessionApp(s)}
        </span>
      ),
    },


    {
      key: 'windowTitle',

      label: 'Window Title',

      render: (s) => (
        <span
          style={{
            display: 'block',
            maxWidth: 320,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={
            getSessionWindowTitle(s)
          }
        >
          {getSessionWindowTitle(s)}
        </span>
      ),
    },


    {
      key: 'start',

      label: 'Start Time',

      render: (s) =>
        formatDateTimeIST(
          getSessionStart(s)
        ),
    },


    {
      key: 'end',

      label: 'End Time',

      render: (s) =>
        formatDateTimeIST(
          getSessionEnd(s)
        ),
    },


    {
      key: 'duration',

      label: 'Duration',

      headerClassName: 'pe-3',

      className: 'pe-3',

      render: (s) => (
        <span
          style={{
            fontWeight: 600,
          }}
        >
          {formatDurationShort(
            getSessionDurationSeconds(s)
          )}
        </span>
      ),
    },
  ];


  // ============================================================
  // RENDER
  // ============================================================

  return (

  <div className="hz-device-details-page d-flex flex-column gap-4">

      {/* ========================================================
          BACK BUTTON
          ======================================================== */}

      <Link
        to="/monitoring/devices"
        className="d-inline-flex align-items-center gap-1 text-decoration-none"
        style={{
          color:
            'var(--hz-text-secondary)',
          fontSize:
            'var(--hz-text-sm)',
          width: 'fit-content',
        }}
      >
        <ArrowLeft size={15} />

        Back to Devices
      </Link>


      {/* ========================================================
          DEVICE ERROR
          ======================================================== */}

      {deviceError && (
        <ErrorState
          description="Couldn't load this device."
          onRetry={refetchDevice}
        />
      )}


      {/* ========================================================
          DEVICE LOADING
          ======================================================== */}

      {deviceLoading && (
        <Card>
          <SkeletonText lines={4} />
        </Card>
      )}


      {/* ========================================================
          DEVICE INFORMATION
          ======================================================== */}

      {!deviceLoading &&
        !deviceError &&
        device && (

          <Card>

            <div
              className="d-flex align-items-start justify-content-between flex-wrap gap-3"
            >

              {/* DEVICE TITLE */}

              <div
                className="d-flex align-items-center gap-3"
              >

                <div
                  className="hz-stat__icon"
                  style={{
                    width: 48,
                    height: 48,
                    background:
                      'var(--hz-primary-50)',
                    color:
                      'var(--hz-primary-600)',
                  }}
                >
                  <Monitor size={22} />
                </div>


                <div>

                  <h1
                    style={{
                      fontSize:
                        'var(--hz-text-xl)',
                      fontWeight: 700,
                      marginBottom: 2,
                    }}
                  >
                    {getDeviceName(device)}
                  </h1>


                  <div
                    className="d-flex align-items-center gap-2"
                  >

                    <StatusBadge
                      status={
                        isDeviceOnline(device)
                          ? 'ACTIVE'
                          : 'INACTIVE'
                      }
                      variant={
                        isDeviceOnline(device)
                          ? 'success'
                          : 'neutral'
                      }
                      dot
                    >
                      {isDeviceOnline(device)
                        ? 'Online'
                        : 'Offline'}
                    </StatusBadge>


                    <span
                      style={{
                        fontSize: 12,
                        color:
                          'var(--hz-text-muted)',
                      }}
                    >
                      Last heartbeat{' '}
                      {timeAgoIST(
                        getDeviceLastSeen(
                          device
                        )
                      )}
                    </span>

                  </div>

                </div>

              </div>


              {/* EMPLOYEE LINK */}

              {getDeviceEmployeeId(
                device
              ) && (

                <Link
                  to={`/employees/${getDeviceEmployeeId(
                    device
                  )}`}
                  className="text-decoration-none"
                >

                  <span
                    style={{
                      fontSize:
                        'var(--hz-text-sm)',
                      fontWeight: 600,
                      color:
                        'var(--hz-primary-600)',
                    }}
                  >
                    View{' '}
                    {getDeviceEmployeeName(
                      device
                    ) || 'employee'}{' '}
                    →
                  </span>

                </Link>
              )}


              {/* ROTATE TOKEN */}

              <Button
                size="sm"
                icon={KeyRound}
                onClick={() => {

                  setOtpOpen(true);

                  requestOtp.mutate();

                }}
              >
                Rotate token
              </Button>


              {/* CLI */}

              <Link
                to={`/monitoring/devices/${id}/cli`}
                className="text-decoration-none"
              >

                <Button
                  size="sm"
                  variant="secondary"
                  icon={Terminal}
                >
                  IT actions
                </Button>

              </Link>


              {/* REMOTE DESKTOP */}

              <Link
                to={`/monitoring/devices/${id}/remote-desktop`}
                className="text-decoration-none"
              >

                <Button
                  size="sm"
                  variant="secondary"
                  icon={MonitorUp}
                >
                  Remote Desktop
                </Button>

              </Link>

            </div>

          </Card>
        )}


      {/* ========================================================
          DEVICE HEALTH
          ======================================================== */}

      {!deviceLoading &&
        !deviceError &&
        device && (
          <section aria-label="Device health">
            <div className="row g-3">
              {health.map((item) => (
                <div className="col-12 col-sm-6 col-xl-3" key={item.key}>
                  <HealthCard item={item} />
                </div>
              ))}
            </div>
          </section>
        )}


      {/* ========================================================
          TABS
          ======================================================== */}

      <Tabs
        items={DEVICE_TABS}
        value={activeTab}
        onChange={changeTab}
        ariaLabel="Device sections"
      />


      {/* ========================================================
          OVERVIEW: DEVICE DETAILS
          ======================================================== */}

      {activeTab === 'overview' &&
        !deviceLoading &&
        !deviceError &&
        device && (

          <Card title="Device details">

            {/* DEVICE DETAILS */}

            <div
              className="row g-3"
            >

              <div
                className="col-6 col-md-3"
              >

                <p
                  className="text-secondary-hz mb-1"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  Employee
                </p>

                <p
                  style={{
                    fontSize:
                      'var(--hz-text-sm)',
                    fontWeight: 600,
                    marginBottom: 0,
                  }}
                >
                  {getDeviceEmployeeName(
                    device
                  ) || '—'}
                </p>

              </div>


              <div
                className="col-6 col-md-3"
              >

                <p
                  className="text-secondary-hz mb-1"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  Operating System
                </p>

                <p
                  style={{
                    fontSize:
                      'var(--hz-text-sm)',
                    fontWeight: 600,
                    marginBottom: 0,
                  }}
                >
                  {getDeviceOS(device)}
                </p>

              </div>


              <div
                className="col-6 col-md-3"
              >

                <p
                  className="text-secondary-hz mb-1"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  Agent Version
                </p>

                <p
                  style={{
                    fontSize:
                      'var(--hz-text-sm)',
                    fontWeight: 600,
                    marginBottom: 0,
                  }}
                >
                  {getDeviceAgentVersion(
                    device
                  )}
                </p>

              </div>


              <div
                className="col-6 col-md-3"
              >

                <p
                  className="text-secondary-hz mb-1"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  Last Heartbeat (IST)
                </p>

                <p
                  style={{
                    fontSize:
                      'var(--hz-text-sm)',
                    fontWeight: 600,
                    marginBottom: 0,
                  }}
                >
                  {formatDateTimeIST(
                    getDeviceLastSeen(
                      device
                    )
                  )}
                </p>

              </div>

              {[
                ['Hostname', device.hostname],
                ['IP address', device.ipAddress],
                ['Serial number', device.serialNumber || device.hardwareInventory?.serialNumber],
                ['Department', device.departmentName],
              ]
                .filter(([, value]) => value !== null && value !== undefined && value !== '')
                .map(([label, value]) => (
                  <div className="col-6 col-md-3" key={label}>
                    <p className="text-secondary-hz mb-1" style={{ fontSize: 12, fontWeight: 500 }}>
                      {label}
                    </p>
                    <p className="text-break" style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 600, marginBottom: 0 }}>
                      {value}
                    </p>
                  </div>
                ))}

            </div>

          </Card>
        )}

      {activeTab === 'hardware' && !deviceLoading && !deviceError && device && (
        <Card title="Hardware Inventory" subtitle="Specifications reported by the authenticated Vettri Agent. Missing firmware fields are left blank.">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
            <div className="d-flex align-items-center flex-wrap gap-2">
              <StatusBadge
                status={device.inventoryStatus === 'PENDING' ? 'SCAN_QUEUED' : device.inventoryStatus || 'NOT_SCANNED'}
                variant={device.inventoryStatus === 'COMPLETED' ? 'success' : device.inventoryStatus === 'FAILED' ? 'warning' : 'neutral'}
              >
                {device.inventoryStatus === 'PENDING' ? 'SCAN_QUEUED' : device.inventoryStatus || 'NOT_SCANNED'}
              </StatusBadge>
              <span className="text-secondary-hz small">
                {device.lastInventoryScanAt
                  ? `Last successful scan ${formatDateTimeIST(device.lastInventoryScanAt)}`
                  : 'No successful inventory scan yet'}
              </span>
            </div>
            {canRequestInventoryScan && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                icon={RefreshCw}
                loading={inventoryScan.isPending}
                disabled={
                  inventoryScan.isPending ||
                  ['PENDING', 'SCANNING'].includes(device.inventoryStatus) ||
                  device.active === false
                }
                onClick={() => inventoryScan.mutate()}
              >
                Scan Specifications
              </Button>
            )}
          </div>
          {device.inventoryStatus === 'PENDING' && !isDeviceOnline(device) && (
            <p className="text-secondary-hz small mb-3" role="status">
              The agent is offline. This scan is queued and will run when it reconnects. Requests expire after 24 hours.
            </p>
          )}
          {device.inventoryStatus === 'PENDING' && isDeviceOnline(device) && (
            <p className="text-secondary-hz small mb-3" role="status">
              The scan is queued and will start when the agent checks in.
            </p>
          )}
          {device.inventoryStatus === 'SCANNING' && (
            <p className="text-secondary-hz small mb-3" role="status">
              The agent is collecting hardware specifications.
            </p>
          )}
          {inventoryScan.isError && (
            <p className="text-danger small mb-3" role="alert">
              {inventoryScan.error?.response?.data?.message || 'The inventory scan could not be queued. Please try again.'}
            </p>
          )}
          {device.hardwareInventory
            ? <AdminHardwareInventory inventory={device.hardwareInventory} />
            : <p className="text-secondary-hz mb-0">No hardware specifications have been submitted by this device.</p>}
        </Card>
      )}

      {/* ========================================================
          MAIN CONTENT
          ======================================================== */}

      <div className="row g-3">


        {/* ======================================================
            REMOTE SUPPORT
            ====================================================== */}

        {activeTab === 'remote' && (
        <div className="col-12">

          <Card
            title="Remote Support"
            subtitle="RustDesk Remote Support is separate from the existing Vettri Remote Desktop WebRTC flow. The Agent provisions and manages RustDesk locally, and this screen shows the RustDesk ID plus the configured password for the current READY session."
          >

            <div
              className="d-flex align-items-center justify-content-between flex-wrap gap-3"
            >

              <div>


                {/* STATUS */}

                <div
                  className="d-flex align-items-center gap-2"
                >

                  <ShieldCheck size={18} />

                  <strong>
                    {supportSummaryStatus}
                  </strong>

                </div>


                {/* CURRENT STAGE */}

                <div
                  className="text-secondary-hz"
                  style={{
                    fontSize: 13,
                  }}
                >

                  {latestSupport?.provisioningStage
                    ? `Current stage: ${latestSupport.provisioningStage}`
                    : latestSupport?.version
                      ? `RustDesk ${latestSupport.version}`
                      : 'RustDesk version not verified'}

                </div>


                {/* ERROR */}

                {latestSupport?.errorMessage && (

                  <div
                    className="text-danger mt-2"
                    style={{
                      fontSize: 13,
                    }}
                  >
                    Error:{' '}
                    {latestSupport.errorMessage}
                  </div>

                )}


                {/* STAGES */}

                {currentStageIndex >= 0 && (

                  <div
                    className="mt-3 d-flex flex-column gap-2"
                  >

                    {displayedStages.map(
                      (
                        stage,
                        index
                      ) => {

                        const completed =
                          currentStageIndex >=
                            index &&
                          stage !== 'FAILED';

                        const active =
                          currentStageIndex ===
                          index;

                        const failed =
                          latestSupport?.status ===
                            'FAILED' &&
                          stage === 'FAILED';


                        return (

                          <div
                            key={stage}
                            className="d-flex align-items-center gap-2"
                            style={{
                              fontSize: 12,
                            }}
                          >

                            <span
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius:
                                  '50%',
                                background:
                                  failed
                                    ? 'var(--hz-danger-500)'
                                    : completed
                                      ? 'var(--hz-success-500)'
                                      : active
                                        ? 'var(--hz-warning-500)'
                                        : 'var(--hz-border)',
                                display:
                                  'inline-block',
                                boxShadow:
                                  active
                                    ? '0 0 0 4px rgba(245, 158, 11, 0.15)'
                                    : 'none',
                              }}
                            />


                            <span
                              style={{
                                color:
                                  failed
                                    ? 'var(--hz-danger-600)'
                                    : completed
                                      ? 'var(--hz-success-700)'
                                      : active
                                        ? 'var(--hz-warning-700)'
                                        : 'var(--hz-text-secondary)',
                              }}
                            >
                              {stage}
                            </span>

                          </div>

                        );

                      }
                    )}

                  </div>

                )}


                {/* RUSTDESK INFORMATION */}

                {latestSupport?.rustDeskId &&
                  latestSupport?.status ===
                    'READY' && (

                    <div className="mt-2">


                      {/* RUSTDESK ID */}

                      <div
                        className="text-secondary-hz"
                        style={{
                          fontSize: 13,
                          marginBottom: 6,
                        }}
                      >
                        RustDesk ID
                      </div>


                      <div
                        className="d-flex align-items-center gap-2"
                      >

                        <code
                          style={{
                            fontSize: 13,
                            padding:
                              '4px 8px',
                            background:
                              'var(--hz-gray-50)',
                            borderRadius: 4,
                            fontFamily:
                              'monospace',
                            fontWeight: 600,
                          }}
                        >
                          {latestSupport.rustDeskId.replace(
                            /(\d{3})(?=\d)/g,
                            '$1 '
                          )}
                        </code>


                        <Button
                          size="xs"
                          variant="secondary"
                          icon={Copy}
                          onClick={() => {

                            navigator.clipboard.writeText(
                              latestSupport.rustDeskId
                            );

                          }}
                          aria-label="Copy RustDesk ID"
                        >
                          Copy
                        </Button>

                      </div>


                      <div className="mt-3">
                        <div className="text-secondary-hz" style={{ fontSize: 13, marginBottom: 6 }}>
                          RustDesk Password
                        </div>
                        {revealedPassword ? (
                          <div className="d-flex align-items-center gap-2">
                            <code style={{ fontSize: 13, padding: '4px 8px', background: 'var(--hz-gray-50)', borderRadius: 4, fontFamily: 'monospace', fontWeight: 600 }}>
                              {revealedPassword}
                            </code>
                            <Button size="xs" variant="secondary" icon={Copy} onClick={() => navigator.clipboard.writeText(revealedPassword)} aria-label="Copy RustDesk Password">
                              Copy
                            </Button>
                            <Button size="xs" variant="secondary" onClick={() => setRevealedPassword('')}>
                              Hide
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={KeyRound}
                            loading={credentialMutation.isPending}
                            disabled={credentialMutation.isPending}
                            onClick={() => credentialMutation.mutate()}
                          >
                            Reveal password
                          </Button>
                        )}
                        {credentialMutation.isError && (
                          <div className="text-danger mt-2" role="alert">
                            {credentialMutation.error?.response?.data?.message || 'Could not retrieve the password.'}
                          </div>
                        )}
                      </div>


                      <div
                        className="text-secondary-hz mt-2"
                        style={{
                          fontSize: 12,
                          lineHeight: 1.5,
                        }}
                      >
                        This opens the installed
                        RustDesk client using the
                        current READY RustDesk ID
                        and password shown above.
                      </div>

                    </div>

                  )}


                {/* ERROR */}

                {latestSupport?.errorMessage && (

                  <div
                    className="text-danger mt-2"
                    style={{
                      fontSize: 13,
                    }}
                  >
                    Error:{' '}
                    {latestSupport.errorMessage}
                  </div>

                )}

              </div>


              {/* REMOTE SUPPORT BUTTONS */}

              <div
                className="d-flex gap-2 flex-wrap"
              >


                {/* CONNECT */}

                {latestSupport?.status ===
                  'READY' &&
                  latestSupport?.rustDeskId && (

                    <Button
                      size="sm"
                      icon={Network}
                      disabled={
                        !isDeviceOnline(device) ||
                        supportMutation.isPending ||
                        !rustDeskConnectUrl
                      }
                      onClick={
                        handleRustDeskConnect
                      }
                    >
                      Connect via RustDesk
                    </Button>

                  )}


                {/* READY */}

                {latestSupport?.status ===
                'READY' ? (

                  <>

                    <Button
                      size="sm"
                      variant="secondary"
                      icon={ShieldCheck}
                      disabled={
                        !isDeviceOnline(device) ||
                        supportMutation.isPending
                      }
                      onClick={() =>
                        supportMutation.mutate(
                          'configure'
                        )
                      }
                    >
                      Reconfigure
                    </Button>


                    <Button
                      size="sm"
                      variant="secondary"
                      icon={KeyRound}
                      disabled={
                        !isDeviceOnline(device) ||
                        supportMutation.isPending
                      }
                      onClick={() =>
                        supportMutation.mutate(
                          'rotate'
                        )
                      }
                    >
                      Rotate password
                    </Button>


                    <Button
                      size="sm"
                      variant="secondary"
                      icon={Ban}
                      disabled
                      title="Remote support disable is not supported by the current RustDesk automation adapter."
                    >
                      Disable (unsupported)
                    </Button>

                  </>

                ) : latestSupport?.status ===
                  'FAILED' ? (

                  /* FAILED */

                  <Button
                    size="sm"
                    icon={ShieldCheck}
                    disabled={
                      !isDeviceOnline(device) ||
                      supportMutation.isPending
                    }
                    onClick={() =>
                      supportMutation.mutate(
                        'configure'
                      )
                    }
                  >
                    Retry Configure
                  </Button>

                ) : (

                  /* NOT CONFIGURED / PROVISIONING */

                  <>

                    <Button
                      size="sm"
                      icon={ShieldCheck}
                      disabled={
                        !isDeviceOnline(device) ||
                        supportMutation.isPending
                      }
                      onClick={() =>
                        supportMutation.mutate(
                          'configure'
                        )
                      }
                    >
                      Configure
                    </Button>


                    <Button
                      size="sm"
                      variant="secondary"
                      icon={RefreshCw}
                      disabled={
                        !isDeviceOnline(device) ||
                        supportMutation.isPending
                      }
                      onClick={() =>
                        supportMutation.mutate(
                          'detect'
                        )
                      }
                    >
                      Detect
                    </Button>

                  </>

                )}

              </div>

            </div>

          </Card>

        </div>
        )}


        {/* ======================================================
            APPLICATION USAGE SUMMARY
            ====================================================== */}

        {activeTab === 'applications' && (
        <div className="col-12">

          <Card
            hoverable
            title="Application Usage Summary"
            subtitle="Most recent sessions on this device"
          >

            {sessionsLoading && (
              <SkeletonText lines={4} />
            )}


            {sessionsError && (

              <ErrorState
                description="Couldn't load application usage."
                onRetry={refetchSessions}
              />

            )}


            {!sessionsLoading &&
              !sessionsError &&
              appUsage.length === 0 && (

                <div className="hz-state">

                  <div
                    className="hz-state__icon-wrap"
                  >
                    <AppWindow size={26} />
                  </div>

                  <p
                    className="hz-state__title"
                  >
                    No activity recorded yet
                  </p>

                </div>

              )}


            {!sessionsLoading &&
              !sessionsError &&
              appUsage.length > 0 && (

                <div
                  className="d-flex flex-column gap-3"
                >

                  {appUsage.map(
                    (app) => {

                      const pct =
                        Math.round(
                          (
                            app.seconds /
                            maxAppSeconds
                          ) * 100
                        );


                      return (

                        <div
                          key={
                            app.applicationName
                          }
                        >

                          <div
                            className="d-flex justify-content-between mb-1"
                          >

                            <span
                              style={{
                                fontSize:
                                  'var(--hz-text-sm)',
                                fontWeight: 500,
                              }}
                            >
                              {
                                app.applicationName
                              }
                            </span>


                            <span
                              style={{
                                fontSize:
                                  'var(--hz-text-sm)',
                                color:
                                  'var(--hz-text-secondary)',
                                fontWeight: 600,
                              }}
                            >
                              {formatDurationShort(
                                app.seconds
                              )}
                            </span>

                          </div>


                          <div
                            style={{
                              height: 8,
                              borderRadius: 999,
                              background:
                                'var(--hz-gray-100)',
                              overflow: 'hidden',
                            }}
                          >

                            <div
                              style={{
                                height: 8,
                                borderRadius: 999,
                                width: `${pct}%`,
                                background:
                                  'var(--hz-primary-500)',
                                transition:
                                  'width 500ms ease',
                              }}
                            />

                          </div>

                        </div>

                      );

                    }
                  )}

                </div>

              )}

          </Card>

        </div>
        )}


        {/* ======================================================
            RECENT ACTIVITY SESSIONS
            ====================================================== */}

        {activeTab === 'activity' && (
        <div className="col-12">

          <Card
            hoverable
            title="Recent Activity Sessions"
            subtitle={
              sortedSessions.length > 0
                ? `Showing ${sessionStartIndex}-${sessionEndIndex} of ${sortedSessions.length} sessions`
                : 'Latest activity sessions from this device'
            }
            bodyClassName="p-0"
          >

            {/* ==================================================
                LOADING
                ================================================== */}

            {sessionsLoading && (

              <div className="p-4">

                <SkeletonText lines={5} />

              </div>

            )}


            {/* ==================================================
                ERROR
                ================================================== */}

            {sessionsError && (

              <div className="p-4">

                <ErrorState
                  description="Couldn't load activity sessions."
                  onRetry={refetchSessions}
                />

              </div>

            )}


            {/* ==================================================
                EMPTY
                ================================================== */}

            {!sessionsLoading &&
              !sessionsError &&
              recentSessions.length === 0 && (

                <div className="hz-state p-4">

                  <div
                    className="hz-state__icon-wrap"
                  >
                    <Activity size={26} />
                  </div>


                  <p
                    className="hz-state__title"
                  >
                    No activity sessions yet
                  </p>


                  <p
                    className="hz-state__description"
                  >
                    Sessions reported by the
                    Windows Agent for this device
                    will show up here.
                  </p>

                </div>

              )}


            {/* ==================================================
                TABLE
                ================================================== */}

            {!sessionsLoading &&
              !sessionsError &&
              recentSessions.length > 0 && (

                <>

                  <div
                    className="table-responsive"
                    style={{
                      borderTop:
                        '1px solid var(--hz-border)',
                      borderBottom:
                        '1px solid var(--hz-border)',
                    }}
                  >

                    <Table
                      columns={sessionColumns}
                      rows={recentSessions}
                      getRowKey={(s) =>
                        getSessionId(s)
                      }
                      isLoading={false}
                      isError={false}
                      emptyIcon={Activity}
                      emptyTitle="No activity sessions yet"
                      emptyDescription=""
                    />

                  </div>


                  {/* ==========================================
                      PAGINATION
                      ========================================== */}

                  <div
                    className="d-flex align-items-center justify-content-between flex-wrap gap-2 px-3 py-2"
                    style={{
                      background:
                        'var(--hz-surface-subtle)',
                      borderTop:
                        '1px solid var(--hz-border)',
                      minHeight: 48,
                    }}
                  >


                    {/* RECORD INFORMATION */}

                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--hz-text-secondary)',
                      }}
                    >

                      Showing{' '}

                      <strong>
                        {sessionStartIndex}
                      </strong>

                      {' - '}

                      <strong>
                        {sessionEndIndex}
                      </strong>

                      {' of '}

                      <strong>
                        {sortedSessions.length}
                      </strong>

                    </div>


                    {/* PAGINATION */}

                    <div
                      className="d-flex align-items-center gap-1"
                    >


                      {/* PREVIOUS */}

                      <button
                        type="button"
                        onClick={() =>
                          goToSessionPage(
                            safeSessionPage - 1
                          )
                        }
                        disabled={
                          safeSessionPage === 1
                        }
                        className="hz-session-page-btn"
                      >
                        Previous
                      </button>


                      {/* PAGE NUMBERS */}

                      {Array.from(
                        {
                          length:
                            totalSessionPages,
                        },
                        (_, index) =>
                          index + 1
                      ).map((page) => (

                        <button
                          key={page}
                          type="button"
                          onClick={() =>
                            goToSessionPage(
                              page
                            )
                          }
                          className={
                            `hz-session-page-btn ${
                              safeSessionPage ===
                              page
                                ? 'active'
                                : ''
                            }`
                          }
                        >
                          {page}
                        </button>

                      ))}


                      {/* NEXT */}

                      <button
                        type="button"
                        onClick={() =>
                          goToSessionPage(
                            safeSessionPage + 1
                          )
                        }
                        disabled={
                          safeSessionPage ===
                          totalSessionPages
                        }
                        className="hz-session-page-btn"
                      >
                        Next
                      </button>

                    </div>

                  </div>

                </>

              )}

          </Card>

        </div>
        )}

      </div>


      {/* ========================================================
          TOKEN ROTATION DIALOG
          ======================================================== */}

      <Dialog
        open={otpOpen}

        onClose={() => {

          setOtpOpen(false);

          setNewToken('');

          setOtp('');

          setReason('');

          requestOtp.reset();

          confirmOtp.reset();

        }}

        title="Rotate agent token"

        description="A verification code will be sent to your registered email."

        footer={

          <Button
            variant="secondary"
            onClick={() =>
              setOtpOpen(false)
            }
          >
            Close
          </Button>

        }
      >


        {/* OTP REQUEST LOADING */}

        {requestOtp.isPending && (

          <p className="text-secondary-hz">
            Sending verification code...
          </p>

        )}


        {/* OTP REQUEST ERROR */}

        {requestOtp.isError && (

          <p className="text-danger">

            {
              requestOtp.error?.response?.data
                ?.message ||
              'Could not send the verification code.'
            }

          </p>

        )}


        {/* ======================================================
            OTP FORM
            ====================================================== */}

        {!newToken ? (

          <form
            onSubmit={(event) => {

              event.preventDefault();

              confirmOtp.mutate();

            }}

            className="d-flex flex-column gap-3"
          >


            {/* VERIFICATION CODE */}

            <label
              className="form-label mb-0"
            >

              Verification code

              <input
                className="form-control mt-1"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(event) =>
                  setOtp(
                    event.target.value
                  )
                }
                required
              />

            </label>


            {/* REASON */}

            <label
              className="form-label mb-0"
            >

              Reason (optional)

              <input
                className="form-control mt-1"
                value={reason}
                onChange={(event) =>
                  setReason(
                    event.target.value
                  )
                }
                maxLength={255}
              />

            </label>


            {/* CONFIRM ERROR */}

            {confirmOtp.isError && (

              <p
                className="text-danger mb-0"
              >

                {
                  confirmOtp.error?.response
                    ?.data?.message ||
                  'Invalid verification code.'
                }

              </p>

            )}


            {/* CONFIRM */}

            <Button
              type="submit"
              loading={
                confirmOtp.isPending
              }
              disabled={
                otp.length !== 6
              }
            >
              Confirm rotation
            </Button>

          </form>

        ) : (

          /* ====================================================
             NEW TOKEN
             ==================================================== */

          <div
            className="d-flex flex-column gap-3"
          >

            <p className="mb-0">
              Copy this token now. It
              will not be shown again.
            </p>


            <div
              className="input-group"
            >

              <input
                className="form-control"
                value={newToken}
                readOnly
                aria-label="New agent token"
              />


              <Button
                icon={Copy}
                variant="secondary"
                aria-label="Copy token"
                onClick={() =>
                  navigator.clipboard.writeText(
                    newToken
                  )
                }
              >
                Copy
              </Button>

            </div>

          </div>

        )}

      </Dialog>

    </div>
  );
}

function AdminHardwareInventory({ inventory }) {
  const rows = [
    ['Computer name', inventory.computerName],
    ['Manufacturer', inventory.manufacturer],
    ['Model', inventory.model],
    ['Serial number', inventory.serialNumber],
    ['Processor', inventory.processorName],
    ['Processor manufacturer', inventory.processorManufacturer],
    ['Physical cores', inventory.physicalCoreCount],
    ['Logical processors', inventory.logicalProcessorCount],
    ['Installed RAM', formatInventoryBytes(inventory.installedMemoryBytes)],
    ['Windows edition', inventory.windowsEdition],
    ['Windows version', inventory.windowsVersion],
    ['Windows build', inventory.windowsBuild],
    ['Architecture', inventory.architecture],
    ['BIOS manufacturer', inventory.biosManufacturer],
    ['BIOS version', inventory.biosVersion],
    ['BIOS release date', inventory.biosReleaseDate],
    ['System UUID', inventory.systemUuid],
    ['Inventory collected', inventory.collectedAt],
    ['Agent version', inventory.agentVersion],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');

  return (
    <div>
      <div className="row g-3">
        {rows.map(([label, value]) => (
          <div className="col-12 col-sm-6 col-lg-4" key={label}>
            <div className="text-secondary-hz small">{label}</div>
            <div className="fw-semibold text-break">{value}</div>
          </div>
        ))}
      </div>
      {Array.isArray(inventory.physicalDisks) && inventory.physicalDisks.length > 0 && (
        <div className="mt-4">
          <h3 className="h6">Physical disks</h3>
          <ul className="mb-0">
            {inventory.physicalDisks.map((disk, index) => (
              <li key={`${disk.model || 'disk'}-${index}`}>
                {disk.model || 'Physical disk'}{disk.capacityBytes ? ` · ${formatInventoryBytes(disk.capacityBytes)}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatInventoryBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let display = value;
  while (display >= 1024 && unitIndex < units.length - 1) {
    display /= 1024;
    unitIndex += 1;
  }
  return `${display.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

// ============================================================
// DEVICE HEALTH
// ============================================================

const HEALTH_TONES = {
  success: { label: 'var(--hz-success-700)', background: 'var(--hz-success-50)', accent: 'var(--hz-success-500)' },
  warning: { label: 'var(--hz-warning-700)', background: 'var(--hz-warning-50)', accent: 'var(--hz-warning-500)' },
  danger: { label: 'var(--hz-danger-700)', background: 'var(--hz-danger-50)', accent: 'var(--hz-danger-500)' },
};

function HealthCard({ item }) {
  const tone = HEALTH_TONES[item.tone] || HEALTH_TONES.warning;
  const Icon = item.icon;
  return (
    <div
      className="h-100 d-flex flex-column gap-2"
      data-testid={`device-health-${item.key}`}
      style={{
        padding: '12px 14px',
        border: '1px solid var(--hz-border)',
        borderLeft: `4px solid ${tone.accent}`,
        borderRadius: 'var(--hz-radius-md)',
        background: 'var(--hz-bg-surface)',
        minWidth: 0,
      }}
    >
      <div className="d-flex align-items-center justify-content-between gap-2">
        <span className="d-inline-flex align-items-center gap-2 text-secondary-hz" style={{ fontSize: 12, fontWeight: 600 }}>
          {Icon && (
            <span
              aria-hidden="true"
              className="d-inline-flex align-items-center justify-content-center"
              style={{ width: 24, height: 24, borderRadius: 6, background: tone.background, color: tone.label }}
            >
              <Icon size={14} />
            </span>
          )}
          {item.title}
        </span>
        <StatusBadge status={item.status} variant={item.tone} dot>
          {item.status}
        </StatusBadge>
      </div>
      <div className="text-break" style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 600, color: 'var(--hz-text-primary)' }}>
        {item.value}
      </div>
      {item.detail && (
        <div className="text-secondary-hz text-break" style={{ fontSize: 12 }}>
          {item.detail}
        </div>
      )}
    </div>
  );
}

function parseAgentVersion(value) {
  const match = typeof value === 'string' ? value.trim().match(/^v?(\d+(?:\.\d+)*)/i) : null;
  return match ? match[1].split('.').map(Number) : null;
}

function compareAgentVersions(a, b) {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function toTimestamp(value) {
  if (!value) return null;
  // Backend LocalDateTime values are UTC without an offset (see utils/formatDateTime).
  const normalized = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value) ? `${value}Z` : value;
  const time = new Date(normalized).getTime();
  return Number.isNaN(time) ? null : time;
}

function buildDeviceHealth(device, fleet) {
  if (!device) return [];
  const online = isDeviceOnline(device);
  const lastSeen = getDeviceLastSeen(device);
  const lastSeenAt = toTimestamp(lastSeen);
  const offlineMs = lastSeenAt === null ? Infinity : Date.now() - lastSeenAt;

  const connection = online
    ? { tone: 'success', status: 'Online', value: 'Connected', detail: `Last heartbeat ${timeAgoIST(lastSeen)}` }
    : {
        tone: offlineMs >= DAY_MS ? 'danger' : 'warning',
        status: 'Offline',
        value: lastSeenAt === null ? 'Never connected' : `Offline since ${timeAgoIST(lastSeen)}`,
        detail: lastSeenAt === null ? 'No heartbeat received yet' : `Last heartbeat ${formatDateTimeIST(lastSeen)}`,
      };

  // The agent reports disk capacity only (no free space), so this card
  // reflects the hardware inventory scan instead of a free-space reading.
  const inventory = device.hardwareInventory;
  const disks = Array.isArray(inventory?.physicalDisks) ? inventory.physicalDisks : [];
  const totalDiskBytes = disks.reduce((sum, disk) => sum + (Number(disk?.capacityBytes) || 0), 0);
  const hardwareSummary = [
    inventory?.installedMemoryBytes ? `${formatInventoryBytes(inventory.installedMemoryBytes)} RAM` : null,
    disks.length > 0 ? `${disks.length} disk${disks.length === 1 ? '' : 's'}${totalDiskBytes > 0 ? `, ${formatInventoryBytes(totalDiskBytes)}` : ''}` : null,
  ].filter(Boolean).join(' · ');
  const scanStatus = device.inventoryStatus || 'NOT_SCANNED';
  const lastScan = device.lastInventoryScanAt ? `Last scan ${timeAgoIST(device.lastInventoryScanAt)}` : 'No successful scan yet';
  const inventoryCard = {
    COMPLETED: { tone: 'success', status: 'Scanned' },
    PENDING: { tone: 'warning', status: 'Scan queued' },
    SCANNING: { tone: 'warning', status: 'Scanning' },
    FAILED: { tone: 'danger', status: 'Scan failed' },
    OFFLINE: { tone: 'warning', status: 'Agent offline' },
  }[scanStatus] || { tone: 'warning', status: 'Not scanned' };

  const version = getDeviceAgentVersion(device);
  const parsedVersion = parseAgentVersion(version);
  let newestVersion = null;
  let newestParsed = null;
  (fleet || []).forEach((item) => {
    const candidate = getDeviceAgentVersion(item);
    const parsed = parseAgentVersion(candidate);
    if (parsed && (!newestParsed || compareAgentVersions(parsed, newestParsed) > 0)) {
      newestParsed = parsed;
      newestVersion = candidate;
    }
  });
  let agent;
  if (!parsedVersion) {
    agent = { tone: 'warning', status: 'Unknown', value: version || '—', detail: 'The agent has not reported a version' };
  } else if (newestParsed && compareAgentVersions(parsedVersion, newestParsed) < 0) {
    agent = { tone: 'warning', status: 'Update pending', value: version, detail: `Newest in fleet: ${newestVersion}` };
  } else if (newestParsed) {
    agent = { tone: 'success', status: 'Up to date', value: version, detail: 'Newest version in your fleet' };
  } else {
    agent = { tone: 'success', status: 'Reporting', value: version, detail: 'Fleet comparison unavailable' };
  }

  const employeeName = getDeviceEmployeeName(device);
  const employeeId = getDeviceEmployeeId(device);
  const assigned = Boolean(employeeId || employeeName);
  const employee = assigned
    ? {
        tone: 'success',
        status: 'Assigned',
        value: employeeName || `Employee #${employeeId}`,
        detail: [device.employeeCode, device.departmentName].filter(Boolean).join(' · ') || null,
      }
    : { tone: 'warning', status: 'Unassigned', value: 'No employee mapped', detail: 'Map this device from the Devices list' };

  return [
    { key: 'connection', title: 'Connection', icon: Wifi, ...connection },
    {
      key: 'inventory',
      title: 'Hardware inventory',
      icon: HardDrive,
      ...inventoryCard,
      value: hardwareSummary || (inventory ? 'Specifications reported' : 'No specifications yet'),
      detail: lastScan,
    },
    { key: 'agent', title: 'Agent version', icon: ShieldCheck, ...agent },
    { key: 'employee', title: 'Assigned employee', icon: UserRound, ...employee },
  ];
}