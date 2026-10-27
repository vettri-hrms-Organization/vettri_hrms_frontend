import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Copy, Download, Monitor, RefreshCw, ShieldCheck, Cpu, HardDrive, MemoryStick } from 'lucide-react';
import { monitoringApi } from '../../api/endpoints/monitoring';
import { formatDateTimeIST } from '../../utils/formatDateTime';
import Button from '../../components/ui/Button';
import ErrorBanner from '../../components/ui/ErrorBanner';

export default function DeviceEnrollment() {
  const { token = '' } = useParams();
  const [copied, setCopied] = useState(false);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [inventoryState, setInventoryState] = useState(null);
  const [inventoryError, setInventoryError] = useState('');
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventorySubmitting, setInventorySubmitting] = useState(false);
  const [inventoryRefresh, setInventoryRefresh] = useState(0);
  const [inventoryConsent, setInventoryConsent] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  useEffect(() => {
    setSelectedDeviceId('');
    setInventoryState(null);
    setInventoryError('');
    setInventoryConsent(false);
  }, [token]);

  useEffect(() => {
    const meta = document.querySelector('meta[name="referrer"]');
    const previousContent = meta?.content;
    if (meta) meta.content = 'no-referrer';
    document.title = 'Vettri Windows Agent Enrollment';
    return () => {
      if (meta && previousContent !== undefined) meta.content = previousContent;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let pollTimer;

    async function fetchEnrollment(isInitialRequest) {
      if (isInitialRequest) {
        setLoading(true);
        setLoadError(null);
      }

      if (import.meta.env.DEV) {
        console.info('[DeviceEnrollment] request started', {
          tokenPresent: Boolean(token),
          tokenLength: token.length,
        });
      }

      let shouldPollAgain = false;
      try {
        const response = await monitoringApi.deviceEnrollmentStatus(token);
        if (cancelled) return;

        if (import.meta.env.DEV) {
          console.info('[DeviceEnrollment] response received', {
            status: response?.status,
            fields: response && typeof response === 'object' ? Object.keys(response) : [],
          });
        }

        if (!response || typeof response !== 'object' || typeof response.status !== 'string') {
          throw new Error('The enrollment service returned an invalid response.');
        }

        setDetails(response);
        setLoadError(null);
        shouldPollAgain = response.status === 'PENDING';
        if (import.meta.env.DEV) {
          console.info('[DeviceEnrollment] enrollment state updated', { status: response.status });
        }
      } catch (error) {
        if (cancelled) return;

        const status = error?.response?.status;
        const invalidLink = [400, 404, 409, 410, 422].includes(status);
        setLoadError({
          invalidLink,
          message: invalidLink
            ? 'This enrollment link is invalid, expired, or has already been used. Contact your IT administrator for a new link.'
            : 'We could not check this enrollment link. Check your connection and try again.',
        });
        if (import.meta.env.DEV) {
          console.warn('[DeviceEnrollment] request failed', {
            status: status || null,
            message: error?.message || 'Request failed',
          });
        }
      } finally {
        if (!cancelled) {
          if (isInitialRequest) setLoading(false);
          if (import.meta.env.DEV) {
            console.info('[DeviceEnrollment] request settled', { initialLoading: false });
          }
        }
      }

      if (!cancelled && shouldPollAgain) {
        pollTimer = window.setTimeout(() => fetchEnrollment(false), 5000);
      }
    }

    if (!token) {
      setLoadError({
        invalidLink: true,
        message: 'This enrollment link is missing its security token. Contact your IT administrator for a new link.',
      });
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    void fetchEnrollment(true);
    return () => {
      cancelled = true;
      window.clearTimeout(pollTimer);
    };
  }, [token, retryCount]);

  useEffect(() => {
    if (!['USED', 'PENDING'].includes(details?.status) || !token) return undefined;
    let cancelled = false;
    let pollTimer;

    async function fetchInventory() {
      setInventoryLoading(true);
      try {
        const response = await monitoringApi.deviceEnrollmentInventory(token, selectedDeviceId);
        if (cancelled) return;
        setInventoryState(response);
        setInventoryError('');
        if (response?.scanStatus === 'PENDING' || response?.scanStatus === 'SCANNING') {
          pollTimer = window.setTimeout(fetchInventory, 5000);
        }
      } catch (error) {
        if (cancelled) return;
        setInventoryError(error?.response?.status === 403
          ? 'Sign in with the employee account this device was registered for to view its inventory.'
          : 'We could not load device inventory. Check your connection and try again.');
      } finally {
        if (!cancelled) setInventoryLoading(false);
      }
    }

    void fetchInventory();
    return () => {
      cancelled = true;
      window.clearTimeout(pollTimer);
    };
  }, [details?.status, token, inventoryRefresh, selectedDeviceId]);

  const pending = details?.status === 'PENDING';

  async function requestInventoryScan() {
    if (!inventoryConsent || inventorySubmitting) return;
    setInventorySubmitting(true);
    setInventoryError('');
    try {
      const response = await monitoringApi.requestDeviceEnrollmentInventory(token, selectedDeviceId);
      setInventoryState(response);
      setInventoryConsent(false);
      setInventoryRefresh((count) => count + 1);
    } catch (error) {
      setInventoryError(error?.response?.data?.message || 'We could not request an inventory scan. Confirm the agent is online and try again.');
    } finally {
      setInventorySubmitting(false);
    }
  }

  async function copyEnrollmentToken() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="min-vh-100 d-flex align-items-center justify-content-center p-4" style={{ background: 'var(--hz-bg-canvas)' }}>
      <section className="hz-card w-100" style={{ maxWidth: 560 }}>
        <div className="hz-card__body d-flex flex-column gap-4">
          <div className="d-flex align-items-center gap-3">
            <div className="hz-stat__icon" style={{ background: 'var(--hz-primary-50)', color: 'var(--hz-primary-600)' }}><Monitor size={22} /></div>
            <div><h1 className="h4 mb-1">Vettri Windows Agent</h1><p className="text-secondary-hz mb-0">Secure device enrollment</p></div>
          </div>

          {loading && <p className="mb-0">Checking your enrollment link...</p>}

          {!loading && loadError?.invalidLink && (
            <section role="alert" className="d-flex flex-column gap-2">
              <h2 className="h5 mb-0">Enrollment link is no longer valid</h2>
              <p className="text-secondary-hz mb-0">{loadError.message}</p>
            </section>
          )}

          {!loading && loadError && !loadError.invalidLink && (
            <section role="alert" className="d-flex flex-column gap-3">
              <ErrorBanner>{loadError.message}</ErrorBanner>
              <Button type="button" variant="secondary" icon={RefreshCw} onClick={() => setRetryCount((count) => count + 1)}>
                Try again
              </Button>
            </section>
          )}

          {!loading && details && !loadError?.invalidLink && (
            <>
              <div>
                {details.employeeName && <>
                  <div className="text-secondary-hz small">Employee</div>
                  <div className="fw-semibold">{details.employeeName}</div>
                </>}
                {details.companyName && <>
                  <div className="text-secondary-hz small mt-3">Organization</div>
                  <div className="fw-semibold">{details.companyName}</div>
                </>}
              </div>
              {pending ? (
                <div className="d-flex flex-column gap-3">
                  {inventoryState?.trustedDevices?.length > 0 && (
                    <>
                      <p className="text-secondary-hz small mb-0">You already have an enrolled Vettri Agent. Select the registered device you want to scan; the browser cannot determine which Windows device is currently in use.</p>
                      <InventoryScanPanel
                        inventoryState={inventoryState}
                        inventoryError={inventoryError}
                        inventoryLoading={inventoryLoading}
                        inventorySubmitting={inventorySubmitting}
                        inventoryConsent={inventoryConsent}
                        selectedDeviceId={selectedDeviceId}
                        onConsentChange={setInventoryConsent}
                        onDeviceChange={setSelectedDeviceId}
                        onRequestScan={requestInventoryScan}
                        showDeviceSelector
                      />
                      <div className="text-secondary-hz small text-center">Or continue with the agent enrollment instructions below if this is a new device.</div>
                    </>
                  )}
                  <div>
                    <h2 className="h6">Step 1: Download the Vettri Windows Agent</h2>
                    <p className="mb-0">Download the installer on this Windows computer. The enrollment link expires {formatDateTimeIST(details.expiresAt)}.</p>
                  </div>
                  <div className="hz-enrollment__token">
                    <div className="hz-enrollment__token-label">
                      <span>One-time enrollment token</span>
                      <Button type="button" variant="ghost" size="sm" icon={copied ? Check : Copy} onClick={copyEnrollmentToken}>{copied ? 'Copied' : 'Copy token'}</Button>
                    </div>
                    <div className="hz-enrollment__token-value">{token}</div>
                  </div>
                  <a
                    className="btn btn-primary d-inline-flex align-items-center justify-content-center gap-2"
                    href={monitoringApi.deviceEnrollmentInstallerUrl(token)}
                    referrerPolicy="no-referrer"
                  >
                    <Download size={17} /> Download Windows Agent
                  </a>
                  <div>
                    <h2 className="h6">Step 2: Install the Agent</h2>
                    <p className="mb-0">Run <strong>HaodaOneAgentSetup.exe</strong> on this Windows computer and enter the one-time token above when prompted.</p>
                  </div>
                  <div>
                    <h2 className="h6">Step 3: Connect the device</h2>
                    <p className="mb-0">After installation, the Agent will securely register this computer and report its connection status here.</p>
                  </div>
                  <div className="d-flex align-items-start gap-2 text-secondary-hz small"><ShieldCheck size={16} /><span>The enrollment token is used once to register this computer. After registration, the Agent stores its machine-protected credential locally.</span></div>
                </div>
              ) : details.status === 'USED' ? (
                <div className="d-flex flex-column gap-3">
                  <div className="alert alert-success mb-0"><strong>Device connected.</strong> The existing Vettri Agent is registered to your employee account.</div>
                  {details.device && <div className="border rounded p-3"><div className="fw-semibold">{details.device.deviceName}</div><div className="text-secondary-hz small">{details.device.operatingSystem} · {details.device.agentVersion || 'Agent version pending'}</div></div>}
                  <InventoryScanPanel
                    inventoryState={inventoryState}
                    inventoryError={inventoryError}
                    inventoryLoading={inventoryLoading}
                    inventorySubmitting={inventorySubmitting}
                    inventoryConsent={inventoryConsent}
                    selectedDeviceId={selectedDeviceId}
                    onConsentChange={setInventoryConsent}
                    onDeviceChange={setSelectedDeviceId}
                    onRequestScan={requestInventoryScan}
                  />
                </div>
              ) : (
                <section role="alert" className="d-flex flex-column gap-2">
                  <h2 className="h5 mb-0">Enrollment link is no longer valid</h2>
                  <p className="text-secondary-hz mb-0">This enrollment is {String(details.status).toLowerCase()}. Contact your IT administrator for a new link.</p>
                </section>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function InventoryScanPanel({
  inventoryState,
  inventoryError,
  inventoryLoading,
  inventorySubmitting,
  inventoryConsent,
  selectedDeviceId,
  onConsentChange,
  onDeviceChange,
  onRequestScan,
  showDeviceSelector = false,
}) {
  const activeScan = inventoryState?.scanStatus === 'PENDING' || inventoryState?.scanStatus === 'SCANNING';
  return (
    <section className="border rounded p-3 d-flex flex-column gap-3" aria-labelledby="inventory-title">
      <div>
        <h2 className="h6 mb-1" id="inventory-title">Device hardware inventory</h2>
        <p className="text-secondary-hz small mb-0">The registered Windows Agent collects computer model, serial number, processor, installed memory, physical disk capacity, Windows version, BIOS, and system UUID. It does not collect product keys, passwords, files, browser data, or keystrokes.</p>
      </div>
      {showDeviceSelector && (
        <div>
          <label className="form-label small fw-semibold" htmlFor="trusted-device-select">Registered device</label>
          <select
            id="trusted-device-select"
            className="form-select"
            value={selectedDeviceId}
            onChange={(event) => onDeviceChange(event.target.value)}
          >
            <option value="">Select a device</option>
            {(inventoryState?.trustedDevices || []).map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.deviceName} · {device.online ? 'Online' : 'Offline'}
              </option>
            ))}
          </select>
        </div>
      )}
      {inventoryLoading && !inventoryState && <p className="mb-0">Checking the latest inventory status...</p>}
      {inventoryState && (
        <div role="status" className={`alert mb-0 ${inventoryState.scanStatus === 'COMPLETED' ? 'alert-success' : inventoryState.scanStatus === 'FAILED' || inventoryState.scanStatus === 'OFFLINE' || inventoryState.scanStatus === 'NOT_ENROLLED' ? 'alert-warning' : 'alert-info'}`}>
          <strong>{inventoryState.scanStatus || 'NOT_SCANNED'}</strong>
          <div>{inventoryState.message}</div>
          {inventoryState.lastInventoryScanAt && <div className="small mt-1">Last successful scan: {formatDateTimeIST(inventoryState.lastInventoryScanAt)}</div>}
        </div>
      )}
      {inventoryError && <ErrorBanner>{inventoryError}</ErrorBanner>}
      {inventoryState?.inventory && <HardwareInventorySummary inventory={inventoryState.inventory} />}
      <div className="form-check">
        <input
          id="hardware-inventory-consent"
          className="form-check-input"
          type="checkbox"
          checked={inventoryConsent}
          onChange={(event) => onConsentChange(event.target.checked)}
        />
        <label className="form-check-label small" htmlFor="hardware-inventory-consent">
          I consent to collect and store the hardware details listed above for company asset management.
        </label>
      </div>
      <Button
        type="button"
        variant="secondary"
        icon={RefreshCw}
        disabled={!inventoryConsent || inventorySubmitting || activeScan || (showDeviceSelector && !selectedDeviceId)}
        onClick={onRequestScan}
      >
        {inventorySubmitting ? 'Requesting scan...' : inventoryState?.scanStatus === 'COMPLETED' ? 'Refresh inventory' : inventoryState?.scanStatus === 'FAILED' || inventoryState?.scanStatus === 'OFFLINE' ? 'Retry scan' : 'Start hardware scan'}
      </Button>
    </section>
  );
}

function HardwareInventorySummary({ inventory }) {
  const fields = [
    ['Manufacturer', inventory.manufacturer],
    ['Model', inventory.model],
    ['Serial number', inventory.serialNumber],
    ['Computer name', inventory.computerName],
    ['Windows edition', inventory.windowsEdition],
    ['Windows version / build', [inventory.windowsVersion, inventory.windowsBuild].filter(Boolean).join(' / ')],
    ['Architecture', inventory.architecture],
    ['BIOS', [inventory.biosManufacturer, inventory.biosVersion].filter(Boolean).join(' · ')],
    ['System UUID', inventory.systemUuid],
  ].filter(([, value]) => value);

  return (
    <div className="border rounded p-3">
      <div className="fw-semibold mb-2">Collected specifications</div>
      <div className="row g-2 small">
        {fields.map(([label, value]) => <div className="col-12 col-sm-6" key={label}><span className="text-secondary-hz">{label}: </span><span>{value}</span></div>)}
      </div>
      <div className="d-flex flex-column gap-2 mt-3 small">
        {inventory.processorName && <div className="d-flex align-items-center gap-2"><Cpu size={15} /><span>{inventory.processorName}{inventory.physicalCoreCount ? ` · ${inventory.physicalCoreCount} cores` : ''}{inventory.logicalProcessorCount ? ` · ${inventory.logicalProcessorCount} logical processors` : ''}</span></div>}
        {inventory.installedMemoryBytes && <div className="d-flex align-items-center gap-2"><MemoryStick size={15} /><span>{formatBytes(inventory.installedMemoryBytes)} installed memory</span></div>}
        {Array.isArray(inventory.physicalDisks) && inventory.physicalDisks.map((disk, index) => (
          <div className="d-flex align-items-center gap-2" key={`${disk.model || 'disk'}-${index}`}><HardDrive size={15} /><span>{disk.model || 'Physical disk'}{disk.capacityBytes ? ` · ${formatBytes(disk.capacityBytes)}` : ''}</span></div>
        ))}
      </div>
    </div>
  );
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '—';
  const units = ['B', 'KB', 'GB', 'TB'];
  let unitIndex = 0;
  let display = value;
  while (display >= 1024 && unitIndex < units.length - 1) {
    display /= 1024;
    unitIndex += 1;
  }
  return `${display.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
