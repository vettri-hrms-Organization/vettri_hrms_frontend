import { useEffect, useState } from 'react';
import { Check, ExternalLink, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import Button from '../../components/ui/Button';
import { privacyApi } from '../../api/endpoints/privacy';

/** The plain-language "what the monitoring agent collects" notice. */
export function MonitoringNoticeBody({ notice }) {
  if (!notice) return null;
  return (
    <div className="d-flex flex-column gap-3">
      <p className="mb-0">{notice.purpose}</p>
      <div>
        <div className="fw-semibold small mb-1 d-inline-flex align-items-center gap-1"><Eye size={14} /> What is collected</div>
        <ul className="small mb-0 ps-3">{notice.collected?.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
      <div>
        <div className="fw-semibold small mb-1 d-inline-flex align-items-center gap-1"><EyeOff size={14} /> What is never collected</div>
        <ul className="small mb-0 ps-3">{notice.notCollected?.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
      <p className="small text-secondary-hz mb-0">{notice.withdrawal}</p>
      {notice.url && (
        <a href={notice.url} target="_blank" rel="noopener noreferrer" className="small d-inline-flex align-items-center gap-1">
          Full monitoring notice (version {notice.version}) <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}

/**
 * Wraps the agent download steps on the employee enrollment page. When the
 * company requires monitoring consent and the employee hasn't given it yet,
 * shows the notice and an accept button instead of the steps. The backend
 * enforces the same rule, so on any load error this falls back to rendering
 * the steps (the download/enrollment call then explains what is missing).
 */
// Plain state instead of React Query: the enrollment page renders outside the main layout.
export function MonitoringConsentGate({ children }) {
  const [agreed, setAgreed] = useState(false);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => privacyApi.monitoringConsent())
      .then((status) => { if (!cancelled) setData(status); })
      .catch(() => { if (!cancelled) setIsError(true); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function accept() {
    setSaving(true);
    setSaveError('');
    try {
      setData(await privacyApi.grantMonitoringConsent());
    } catch (error) {
      setSaveError(error?.response?.data?.message || 'Could not record your consent. Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <p className="mb-0 text-secondary-hz">Checking monitoring consent...</p>;
  if (isError || !data || !data.required || data.consented) {
    return (
      <>
        {data?.consented && (
          <div className="d-flex align-items-center gap-2 small text-secondary-hz"><Check size={15} /> You accepted the monitoring notice. You can review or withdraw it on the Privacy page.</div>
        )}
        {children}
      </>
    );
  }

  return (
    <section className="border rounded p-3 d-flex flex-column gap-3" aria-labelledby="monitoring-notice-title">
      <h2 className="h6 mb-0 d-flex align-items-center gap-2" id="monitoring-notice-title"><ShieldCheck size={16} /> Before you install: monitoring notice</h2>
      <MonitoringNoticeBody notice={data.notice} />
      <label className="d-flex align-items-start gap-2 small mb-0">
        <input type="checkbox" className="form-check-input mt-0" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>I have read this notice and consent to my employer monitoring this work computer as described.</span>
      </label>
      {saveError && <div className="alert alert-danger mb-0 small" role="alert">{saveError}</div>}
      <Button onClick={accept} disabled={!agreed} loading={saving}>Accept and continue</Button>
    </section>
  );
}
