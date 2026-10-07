import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Copy, Download, Monitor, RefreshCw, ShieldCheck } from 'lucide-react';
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

  const pending = details?.status === 'PENDING';

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
                <div className="alert alert-success mb-0"><strong>Device connected.</strong> This computer has been enrolled successfully. You can close this page.</div>
              ) : (
                <section role="alert" className="d-flex flex-column gap-2">
                  <h2 className="h5 mb-0">Enrollment link is no longer valid</h2>
                  <p className="text-secondary-hz mb-0">This enrollment is {String(details.status).toLowerCase()}. Contact your IT administrator for a new link.</p>
                </section>
              )}
              {details.device && <div className="border rounded p-3"><div className="fw-semibold">{details.device.deviceName}</div><div className="text-secondary-hz small">{details.device.operatingSystem} · {details.device.agentVersion || 'Agent version pending'}</div></div>}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
