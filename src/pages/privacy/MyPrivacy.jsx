import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, ExternalLink, FileDown, Mail, PencilLine, Phone, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Dialog from '../../components/ui/Dialog';
import FormField from '../../components/ui/FormField';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../hooks/useAuth';
import { formatDateIST, formatDateTimeIST } from '../../utils/formatDateTime';
import { LEGAL_LINKS, legalApi, privacyApi } from '../../api/endpoints/privacy';
import { MonitoringNoticeBody } from './MonitoringNotice';

const REQUEST_TYPES = {
  ACCESS: { label: 'Copy of my data', icon: FileDown },
  CORRECTION: { label: 'Correction', icon: PencilLine },
  ERASURE: { label: 'Erasure', icon: Trash2 },
};

const STATUS_VARIANT = {
  SUBMITTED: 'warning', IN_PROGRESS: 'info', READY: 'success', COMPLETED: 'success', REJECTED: 'danger',
  GRANTED: 'success', WITHDRAWN: 'neutral',
};

const errorMessage = (error, fallback) => error?.response?.data?.message || fallback;

/** Employee self-service privacy page (DPDP Act 2023). */
export default function MyPrivacy() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const hasEmployee = !!user?.employeeId;
  const [requestType, setRequestType] = useState(null);
  const [details, setDetails] = useState('');
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');

  const contact = useQuery({ queryKey: ['privacy-contact'], queryFn: privacyApi.contact, retry: false });
  const consent = useQuery({ queryKey: ['privacy-monitoring-consent'], queryFn: privacyApi.monitoringConsent, enabled: hasEmployee });
  const requests = useQuery({ queryKey: ['privacy-requests'], queryFn: privacyApi.myRequests, enabled: hasEmployee });
  const acceptances = useQuery({ queryKey: ['legal-acceptances-me'], queryFn: legalApi.myAcceptances });

  const createRequest = useMutation({
    mutationFn: () => privacyApi.createRequest(requestType, details),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['privacy-requests'] });
      setRequestType(null);
      setDetails('');
      if (created.status === 'REJECTED') toast.error(created.resolutionNote || 'The request could not be accepted.');
      else if (created.status === 'READY') toast.success('Your data export is ready to download.');
      else toast.success('Request sent to HR. You will be notified of updates.');
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not submit the request.')),
  });

  const download = useMutation({
    mutationFn: (id) => privacyApi.downloadExport(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['privacy-requests'] }),
    onError: (error) => toast.error(errorMessage(error, 'Could not download the export.')),
  });

  const grant = useMutation({
    mutationFn: privacyApi.grantMonitoringConsent,
    onSuccess: (data) => { queryClient.setQueryData(['privacy-monitoring-consent'], data); toast.success('Consent recorded.'); },
    onError: (error) => toast.error(errorMessage(error, 'Could not record consent.')),
  });

  const withdraw = useMutation({
    mutationFn: () => privacyApi.withdrawMonitoringConsent(withdrawReason),
    onSuccess: (data) => {
      queryClient.setQueryData(['privacy-monitoring-consent'], data);
      setWithdrawOpen(false);
      setWithdrawReason('');
      toast.success('Consent withdrawn. Your employer has been notified.');
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not withdraw consent.')),
  });

  const c = contact.data;
  const consentData = consent.data;

  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader
        eyebrow="My workspace"
        title="Privacy"
        description="See how your personal data is handled, manage monitoring consent, and exercise your rights under the Digital Personal Data Protection Act, 2023."
      />

      <div className="row g-4">
        <div className="col-lg-6">
          <Card title="Grievance officer" subtitle="Contact for questions or complaints about your personal data">
            {contact.isLoading && <SkeletonText lines={3} />}
            {!contact.isLoading && (
              c?.grievanceOfficerName || c?.grievanceOfficerEmail ? (
                <div className="d-flex flex-column gap-2">
                  <div className="d-flex align-items-center gap-2"><UserRound size={15} /> <strong>{c.grievanceOfficerName || 'Grievance officer'}</strong>{c.companyName && <span className="text-secondary-hz">· {c.companyName}</span>}</div>
                  {c.grievanceOfficerEmail && <a href={`mailto:${c.grievanceOfficerEmail}`} className="d-inline-flex align-items-center gap-2"><Mail size={15} /> {c.grievanceOfficerEmail}</a>}
                  {c.grievanceOfficerPhone && <span className="d-inline-flex align-items-center gap-2"><Phone size={15} /> {c.grievanceOfficerPhone}</span>}
                </div>
              ) : (
                <p className="text-secondary-hz mb-0">Your organization has not published a grievance officer yet. Contact HR, or Vettri at <a href="mailto:privacy@vettrihrms.in">privacy@vettrihrms.in</a>.</p>
              )
            )}
            {c && (
              <p className="small text-secondary-hz mt-3 mb-0">
                Retention: payroll and statutory records are kept for {c.payrollRetentionYears} years after exit; other personal data for {c.otherDataRetentionMonths} months after exit.
              </p>
            )}
          </Card>
        </div>
        <div className="col-lg-6">
          <Card title="Legal documents" subtitle="Vettri's policies that apply to your account">
            <ul className="list-unstyled d-flex flex-column gap-2 mb-3">
              <li><a href={LEGAL_LINKS.privacy} target="_blank" rel="noopener noreferrer" className="d-inline-flex align-items-center gap-1">Privacy Policy <ExternalLink size={12} /></a></li>
              <li><a href={LEGAL_LINKS.terms} target="_blank" rel="noopener noreferrer" className="d-inline-flex align-items-center gap-1">Terms of Service <ExternalLink size={12} /></a></li>
              <li><a href={LEGAL_LINKS.dpa} target="_blank" rel="noopener noreferrer" className="d-inline-flex align-items-center gap-1">Data Processing Agreement <ExternalLink size={12} /></a></li>
              <li><a href={LEGAL_LINKS.security} target="_blank" rel="noopener noreferrer" className="d-inline-flex align-items-center gap-1">Security <ExternalLink size={12} /></a></li>
            </ul>
            {(acceptances.data || []).length > 0 && (
              <div className="small text-secondary-hz">
                {acceptances.data.slice(0, 6).map((a) => (
                  <div key={a.id}>Accepted {a.docType.replace('_', ' ').toLowerCase()} v{a.version} on {formatDateTimeIST(a.acceptedAt)}</div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {hasEmployee && (
        <Card title="Device monitoring" subtitle="The Vettri agent on your work computer">
          {consent.isLoading && <SkeletonText lines={4} />}
          {consent.isError && <ErrorState description="Couldn't load your monitoring consent." onRetry={consent.refetch} />}
          {consentData && (
            <div className="d-flex flex-column gap-3">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <StatusBadge variant={consentData.consented ? 'success' : 'neutral'}>
                  {consentData.consented ? 'Consent given' : 'No active consent'}
                </StatusBadge>
                {consentData.current && <span className="small text-secondary-hz">Notice v{consentData.current.noticeVersion}, accepted {formatDateTimeIST(consentData.current.grantedAt)}</span>}
                {consentData.required && <span className="small text-secondary-hz">· Your organization requires consent before a device is enrolled.</span>}
              </div>
              <MonitoringNoticeBody notice={consentData.notice} />
              <p className="small mb-0">
                {consentData.stopMonitoringOnWithdrawal
                  ? 'If you withdraw, monitoring on your devices is paused immediately and your employer is notified.'
                  : 'If you withdraw, your employer is notified and decides the next step. Withdrawal does not uninstall the agent by itself.'}
              </p>
              <div className="d-flex gap-2">
                {consentData.consented
                  ? <Button variant="secondary" onClick={() => setWithdrawOpen(true)}>Withdraw consent</Button>
                  : <Button icon={ShieldCheck} onClick={() => grant.mutate()} loading={grant.isPending}>I consent</Button>}
              </div>
            </div>
          )}
        </Card>
      )}

      {hasEmployee ? (
        <Card
          title="My privacy requests"
          subtitle="Responses are due within 30 days"
          actions={(
            <div className="d-flex gap-2 flex-wrap">
              {Object.entries(REQUEST_TYPES).map(([type, meta]) => (
                <Button key={type} size="sm" variant={type === 'ACCESS' ? 'primary' : 'secondary'} icon={meta.icon} onClick={() => setRequestType(type)}>{meta.label}</Button>
              ))}
            </div>
          )}
          bodyClassName="p-0"
        >
          {requests.isLoading && <div className="p-4"><SkeletonText lines={3} /></div>}
          {requests.isError && <ErrorState description="Couldn't load your requests." onRetry={requests.refetch} />}
          {requests.data && requests.data.length === 0 && (
            <EmptyState icon={ShieldCheck} title="No requests yet" description="Download a copy of your data, ask HR to correct something, or request erasure after you leave." />
          )}
          {requests.data && requests.data.length > 0 && (
            <div className="table-responsive">
              <table className="table mb-0 align-middle hz-table" aria-label="My privacy requests">
                <thead>
                  <tr><th>Type</th><th>Raised</th><th>Due</th><th>Status</th><th>Response</th><th aria-label="Actions" /></tr>
                </thead>
                <tbody>
                  {requests.data.map((r) => (
                    <tr key={r.id}>
                      <td>{REQUEST_TYPES[r.requestType]?.label || r.requestType}</td>
                      <td>{formatDateIST(r.createdAt)}</td>
                      <td>{formatDateIST(r.dueDate)}</td>
                      <td><StatusBadge variant={STATUS_VARIANT[r.status] || 'neutral'}>{r.status.replace('_', ' ')}</StatusBadge></td>
                      <td className="small" style={{ maxWidth: 360 }}>{r.resolutionNote || r.details || '-'}</td>
                      <td className="text-end">
                        {r.requestType === 'ACCESS' && r.status === 'READY' && (
                          <Button size="sm" variant="secondary" icon={Download} loading={download.isPending && download.variables === r.id} onClick={() => download.mutate(r.id)}>Download ZIP</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card title="My privacy requests">
          <p className="text-secondary-hz mb-0">Privacy requests are available for employee profiles. Your login is not linked to one - contact <a href="mailto:privacy@vettrihrms.in">privacy@vettrihrms.in</a> for account-level requests.</p>
        </Card>
      )}

      <Dialog
        open={!!requestType}
        onClose={() => setRequestType(null)}
        title={REQUEST_TYPES[requestType]?.label || 'Privacy request'}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setRequestType(null)}>Cancel</Button>
            <Button onClick={() => createRequest.mutate()} loading={createRequest.isPending}>Submit request</Button>
          </>
        )}
      >
        {requestType === 'ACCESS' && <p className="mb-0">We'll prepare a ZIP with your profile, documents list, attendance, leave, payslip summaries, assets and consents (JSON and CSV). It is available to download for 7 days.</p>}
        {requestType === 'CORRECTION' && (
          <FormField as="textarea" rows={4} label="What is incorrect, and what should it say?" value={details} onChange={setDetails} required />
        )}
        {requestType === 'ERASURE' && (
          <div className="d-flex flex-column gap-3">
            <p className="mb-0">Erasure is available after you leave the organization and its retention period has ended. Payroll and statutory records are kept as required by law. If you are still employed, the request will be declined with an explanation.</p>
            <FormField as="textarea" rows={3} label="Anything HR should know (optional)" value={details} onChange={setDetails} />
          </div>
        )}
      </Dialog>

      <Dialog
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        title="Withdraw monitoring consent"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => withdraw.mutate()} loading={withdraw.isPending}>Withdraw</Button>
          </>
        )}
      >
        <FormField as="textarea" rows={3} label="Reason (optional, shared with your employer)" value={withdrawReason} onChange={setWithdrawReason} />
      </Dialog>
    </div>
  );
}
