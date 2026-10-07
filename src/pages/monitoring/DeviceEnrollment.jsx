import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Download, Monitor, ShieldCheck } from 'lucide-react';
import { monitoringApi } from '../../api/endpoints/monitoring';
import { formatDateTimeIST } from '../../utils/formatDateTime';
import Button from '../../components/ui/Button';
import ErrorBanner from '../../components/ui/ErrorBanner';

export default function DeviceEnrollment() {
  const { token = '' } = useParams();
  const [copied, setCopied] = useState(false);
  const enrollment = useQuery({
    queryKey: ['public-device-enrollment', token],
    queryFn: () => monitoringApi.deviceEnrollmentStatus(token),
    enabled: Boolean(token),
    refetchInterval: (query) => query.state.data?.status === 'PENDING' ? 5000 : false,
    retry: false,
  });

  useEffect(() => {
    const meta = document.querySelector('meta[name="referrer"]');
    const previousContent = meta?.content;
    if (meta) meta.content = 'no-referrer';
    document.title = 'Vettri Windows Agent Enrollment';
    return () => {
      if (meta && previousContent !== undefined) meta.content = previousContent;
    };
  }, []);

  const details = enrollment.data;
  const pending = details?.status === 'PENDING';
  async function copyEnrollmentToken() {
    await navigator.clipboard.writeText(token);
    setCopied(true);
  }

  return (
    <main className="min-vh-100 d-flex align-items-center justify-content-center p-4" style={{ background: 'var(--hz-bg-canvas)' }}>
      <section className="hz-card w-100" style={{ maxWidth: 560 }}>
        <div className="hz-card__body d-flex flex-column gap-4">
          <div className="d-flex align-items-center gap-3">
            <div className="hz-stat__icon" style={{ background: 'var(--hz-primary-50)', color: 'var(--hz-primary-600)' }}><Monitor size={22} /></div>
            <div><h1 className="h4 mb-1">Vettri Windows Agent</h1><p className="text-secondary-hz mb-0">Secure device enrollment</p></div>
          </div>

          {enrollment.isLoading && <p className="mb-0">Checking your enrollment link…</p>}
          {enrollment.isError && <ErrorBanner>This enrollment link is invalid or no longer available. Contact your IT administrator for a new link.</ErrorBanner>}

          {details && (
            <>
              <div>
                <div className="text-secondary-hz small">Organization</div>
                <div className="fw-semibold">{details.companyName}</div>
                <div className="text-secondary-hz small mt-3">Employee</div>
                <div className="fw-semibold">{details.employeeName}</div>
              </div>
              {pending ? (
                <div className="d-flex flex-column gap-3">
                  <p className="mb-0">Download and run the installer on your Windows computer. When prompted, enter this single-use token. It expires {formatDateTimeIST(details.expiresAt)}.</p>
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
                  <div className="d-flex align-items-start gap-2 text-secondary-hz small"><ShieldCheck size={16} /><span>The enrollment token is used once to register this computer. After registration, the Agent stores its machine-protected credential locally.</span></div>
                </div>
              ) : details.status === 'USED' ? (
                <div className="alert alert-success mb-0">This computer has been enrolled successfully. You can close this page.</div>
              ) : (
                <ErrorBanner>This enrollment is {details.status.toLowerCase()}. Contact your IT administrator for a new link.</ErrorBanner>
              )}
              {details.device && <div className="border rounded p-3"><div className="fw-semibold">{details.device.deviceName}</div><div className="text-secondary-hz small">{details.device.operatingSystem} · {details.device.agentVersion || 'Agent version pending'}</div></div>}
              {details.status === 'PENDING' && details.device?.online && <Button type="button" variant="secondary" disabled>Device connected</Button>}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
