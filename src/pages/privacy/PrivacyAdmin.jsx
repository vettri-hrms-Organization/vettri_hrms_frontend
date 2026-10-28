import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ClipboardList, Download, FileCheck2, Settings2, ShieldCheck, Trash2, UserX } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Dialog from '../../components/ui/Dialog';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import FormField from '../../components/ui/FormField';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Tabs from '../../components/ui/Tabs';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../hooks/useAuth';
import { formatDateIST, formatDateTimeIST } from '../../utils/formatDateTime';
import { privacyApi } from '../../api/endpoints/privacy';

const STATUS_VARIANT = {
  SUBMITTED: 'warning', IN_PROGRESS: 'info', READY: 'success', COMPLETED: 'success', REJECTED: 'danger',
  GRANTED: 'success', WITHDRAWN: 'neutral', PENDING: 'warning', CANCELLED: 'neutral',
};
const errorMessage = (error, fallback) => error?.response?.data?.message || fallback;

/** HR / admin privacy console: request queue, settings, registers, company export & deletion. */
export default function PrivacyAdmin() {
  const { hasPermission, hasRole } = useAuth();
  const canManage = hasPermission('PRIVACY_MANAGE');
  const isCompanyAdmin = hasRole('COMPANY_ADMIN');
  const isSuperAdmin = hasRole('SUPER_ADMIN');
  const tabs = [
    canManage && { key: 'requests', label: 'Requests', icon: ClipboardList },
    canManage && { key: 'settings', label: 'Settings', icon: Settings2 },
    canManage && { key: 'consents', label: 'Monitoring consent', icon: ShieldCheck },
    canManage && { key: 'acceptances', label: 'Legal acceptance', icon: FileCheck2 },
    isCompanyAdmin && { key: 'account', label: 'Export & deletion', icon: Archive },
    isSuperAdmin && { key: 'platform', label: 'All deletions', icon: Trash2 },
  ].filter(Boolean);
  const [tab, setTab] = useState(tabs[0]?.key || 'requests');

  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader
        eyebrow="Settings"
        title="Privacy & data"
        description="Handle employee data requests within 30 days, publish your grievance officer, set retention and monitoring-consent rules (DPDP Act 2023)."
      />
      <Tabs items={tabs} value={tab} onChange={setTab} ariaLabel="Privacy sections" />
      {tab === 'requests' && canManage && <RequestQueue />}
      {tab === 'settings' && canManage && <SettingsForm />}
      {tab === 'consents' && canManage && <ConsentRegister />}
      {tab === 'acceptances' && canManage && <AcceptanceRegister />}
      {tab === 'account' && isCompanyAdmin && <AccountTools />}
      {tab === 'platform' && isSuperAdmin && <AllDeletions />}
    </div>
  );
}

function RequestQueue() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const queue = useQuery({ queryKey: ['privacy-queue'], queryFn: privacyApi.queue });
  const [active, setActive] = useState(null);
  const [note, setNote] = useState('');
  const [confirmErase, setConfirmErase] = useState(null);
  const eligibility = useQuery({
    queryKey: ['privacy-erasure-eligibility', confirmErase?.id],
    queryFn: () => privacyApi.requestErasureEligibility(confirmErase.id),
    enabled: !!confirmErase,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['privacy-queue'] });

  const update = useMutation({
    mutationFn: ({ id, status }) => privacyApi.updateRequest(id, status, note),
    onSuccess: () => { refresh(); setActive(null); setNote(''); toast.success('Request updated.'); },
    onError: (error) => toast.error(errorMessage(error, 'Could not update the request.')),
  });
  const erase = useMutation({
    mutationFn: (id) => privacyApi.erase(id),
    onSuccess: (result) => { refresh(); setConfirmErase(null); toast.success(`Employee anonymised; ${result.documentsDeleted} document(s) deleted.`); },
    onError: (error) => toast.error(errorMessage(error, 'Could not anonymise the employee.')),
  });

  const list = queue.data || [];
  return (
    <Card bodyClassName="p-0">
      {queue.isLoading && <div className="p-4"><SkeletonText lines={5} /></div>}
      {queue.isError && <ErrorState description="Couldn't load privacy requests." onRetry={queue.refetch} />}
      {!queue.isLoading && !queue.isError && list.length === 0 && (
        <EmptyState icon={ClipboardList} title="No privacy requests" description="Employee access, correction and erasure requests appear here with their 30-day due date." />
      )}
      {list.length > 0 && (
        <div className="table-responsive">
          <table className="table mb-0 align-middle hz-table" aria-label="Privacy requests">
            <thead><tr><th>Employee</th><th>Type</th><th>Raised</th><th>Due</th><th>Status</th><th>Details</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {list.map((r) => {
                const open = !['COMPLETED', 'REJECTED', 'READY'].includes(r.status);
                return (
                  <tr key={r.id}>
                    <td><strong>{r.employeeName}</strong><div className="small text-secondary-hz">{r.employeeCode}</div></td>
                    <td>{r.requestType}</td>
                    <td>{formatDateIST(r.createdAt)}</td>
                    <td className={r.overdue ? 'text-danger fw-semibold' : ''}>{formatDateIST(r.dueDate)}{r.overdue && ' (overdue)'}</td>
                    <td><StatusBadge variant={STATUS_VARIANT[r.status] || 'neutral'}>{r.status.replace('_', ' ')}</StatusBadge></td>
                    <td className="small" style={{ maxWidth: 320 }}>{r.details || r.resolutionNote || '-'}</td>
                    <td className="text-end text-nowrap">
                      {open && r.requestType === 'ERASURE' && (
                        <Button size="sm" variant="danger" icon={UserX} onClick={() => setConfirmErase(r)}>Anonymise</Button>
                      )}
                      {open && <Button size="sm" variant="secondary" className="ms-2" onClick={() => { setActive(r); setNote(''); }}>Respond</Button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={!!active}
        onClose={() => setActive(null)}
        title={active ? `${active.requestType} request - ${active.employeeName}` : ''}
        description={active?.details}
        footer={active && (
          <>
            <Button variant="secondary" onClick={() => update.mutate({ id: active.id, status: 'REJECTED' })} loading={update.isPending}>Reject</Button>
            <Button variant="secondary" onClick={() => update.mutate({ id: active.id, status: 'IN_PROGRESS' })} loading={update.isPending}>Mark in progress</Button>
            {active.requestType !== 'ERASURE' && <Button onClick={() => update.mutate({ id: active.id, status: 'COMPLETED' })} loading={update.isPending}>Complete</Button>}
          </>
        )}
      >
        <FormField as="textarea" rows={4} label="Response to the employee" hint="Required when rejecting. For corrections, say what you changed." value={note} onChange={setNote} />
      </Dialog>

      <ConfirmDialog
        open={!!confirmErase}
        onClose={() => setConfirmErase(null)}
        onConfirm={() => erase.mutate(confirmErase.id)}
        loading={erase.isPending}
        title="Anonymise this employee?"
        confirmLabel="Anonymise permanently"
        description={eligibility.isLoading ? 'Checking eligibility...'
          : eligibility.data && !eligibility.data.eligible ? eligibility.data.reason
            : 'Name, email, phone, PAN, bank details and address are replaced with placeholders, uploaded documents are deleted and the login is disabled. Payroll and statutory records are kept as required by law. This cannot be undone.'}
      />
    </Card>
  );
}

function SettingsForm() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['privacy-settings'], queryFn: privacyApi.settings });
  const [form, setForm] = useState(null);
  useEffect(() => { if (settings.data) setForm(settings.data); }, [settings.data]);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const save = useMutation({
    mutationFn: () => privacyApi.updateSettings({
      ...form,
      payrollRetentionYears: Number(form.payrollRetentionYears),
      otherDataRetentionMonths: Number(form.otherDataRetentionMonths),
    }),
    onSuccess: (data) => { queryClient.setQueryData(['privacy-settings'], data); toast.success('Privacy settings saved.'); },
    onError: (error) => toast.error(errorMessage(error, 'Could not save settings.')),
  });

  if (settings.isLoading || !form) return <Card><SkeletonText lines={6} /></Card>;
  if (settings.isError) return <ErrorState description="Couldn't load privacy settings." onRetry={settings.refetch} />;
  return (
    <Card title="Privacy settings" actions={<Button onClick={() => save.mutate()} loading={save.isPending}>Save</Button>}>
      <div className="row g-3">
        <div className="col-12"><h4 className="h6 mb-0">Grievance officer (shown to employees on their Privacy page)</h4></div>
        <div className="col-md-4"><FormField label="Name" value={form.grievanceOfficerName || ''} onChange={(v) => set('grievanceOfficerName', v)} /></div>
        <div className="col-md-4"><FormField label="Email" type="email" value={form.grievanceOfficerEmail || ''} onChange={(v) => set('grievanceOfficerEmail', v)} /></div>
        <div className="col-md-4"><FormField label="Phone" value={form.grievanceOfficerPhone || ''} onChange={(v) => set('grievanceOfficerPhone', v)} /></div>
        <div className="col-12"><h4 className="h6 mb-0 mt-2">Personal data breach contact (who Vettri notifies)</h4></div>
        <div className="col-md-4"><FormField label="Name" value={form.breachContactName || ''} onChange={(v) => set('breachContactName', v)} /></div>
        <div className="col-md-4"><FormField label="Email" type="email" value={form.breachContactEmail || ''} onChange={(v) => set('breachContactEmail', v)} /></div>
        <div className="col-md-4"><FormField label="Phone" value={form.breachContactPhone || ''} onChange={(v) => set('breachContactPhone', v)} /></div>
        <div className="col-12"><h4 className="h6 mb-0 mt-2">Retention for exited employees</h4></div>
        <div className="col-md-6"><FormField type="number" min={7} label="Payroll & statutory records (years)" hint="Minimum 7 years (tax and labour law)." value={form.payrollRetentionYears} onChange={(v) => set('payrollRetentionYears', v)} /></div>
        <div className="col-md-6"><FormField type="number" min={0} label="Other personal data (months)" hint="After this, exited employees may request erasure." value={form.otherDataRetentionMonths} onChange={(v) => set('otherDataRetentionMonths', v)} /></div>
        <div className="col-12"><h4 className="h6 mb-0 mt-2">Device monitoring</h4></div>
        <div className="col-12">
          <label className="d-flex align-items-start gap-2 mb-2">
            <input type="checkbox" className="form-check-input mt-1" checked={!!form.monitoringConsentRequired} onChange={(e) => set('monitoringConsentRequired', e.target.checked)} />
            <span>Require employee consent before a device is enrolled<br /><small className="text-secondary-hz">Employees see a notice of what the agent collects and must accept it before the agent can be installed or a device assigned to them.</small></span>
          </label>
          <label className="d-flex align-items-start gap-2 mb-0">
            <input type="checkbox" className="form-check-input mt-1" checked={!!form.stopMonitoringOnWithdrawal} onChange={(e) => set('stopMonitoringOnWithdrawal', e.target.checked)} />
            <span>Pause monitoring automatically when an employee withdraws consent<br /><small className="text-secondary-hz">Off: admins are notified and decide the next step; monitoring continues until you act.</small></span>
          </label>
        </div>
      </div>
    </Card>
  );
}

function ConsentRegister() {
  const consents = useQuery({ queryKey: ['privacy-consents'], queryFn: privacyApi.consents });
  return (
    <Card bodyClassName="p-0">
      {consents.isLoading && <div className="p-4"><SkeletonText lines={4} /></div>}
      {consents.isError && <ErrorState description="Couldn't load consents." onRetry={consents.refetch} />}
      {consents.data?.length === 0 && <EmptyState icon={ShieldCheck} title="No monitoring consents yet" description="Consents appear here when employees accept the monitoring notice." />}
      {consents.data?.length > 0 && (
        <div className="table-responsive">
          <table className="table mb-0 align-middle hz-table" aria-label="Monitoring consents">
            <thead><tr><th>Employee</th><th>Notice</th><th>Status</th><th>Accepted</th><th>Withdrawn</th><th>Reason</th></tr></thead>
            <tbody>
              {consents.data.map((c) => (
                <tr key={c.id}>
                  <td>{c.employeeName}</td><td>v{c.noticeVersion}</td>
                  <td><StatusBadge variant={STATUS_VARIANT[c.status] || 'neutral'}>{c.status}</StatusBadge></td>
                  <td>{formatDateTimeIST(c.grantedAt)}</td><td>{c.withdrawnAt ? formatDateTimeIST(c.withdrawnAt) : '-'}</td>
                  <td className="small">{c.withdrawalReason || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function AcceptanceRegister() {
  const rows = useQuery({ queryKey: ['privacy-acceptances'], queryFn: privacyApi.acceptances });
  return (
    <Card bodyClassName="p-0">
      {rows.isLoading && <div className="p-4"><SkeletonText lines={4} /></div>}
      {rows.isError && <ErrorState description="Couldn't load acceptances." onRetry={rows.refetch} />}
      {rows.data?.length === 0 && <EmptyState icon={FileCheck2} title="No acceptances recorded" description="Acceptance of Terms, Privacy Policy and DPA is recorded here." />}
      {rows.data?.length > 0 && (
        <div className="table-responsive">
          <table className="table mb-0 align-middle hz-table" aria-label="Legal acceptances">
            <thead><tr><th>User</th><th>Document</th><th>Version</th><th>Accepted</th><th>IP address</th></tr></thead>
            <tbody>
              {rows.data.map((a) => (
                <tr key={a.id}>
                  <td>{a.userName}<div className="small text-secondary-hz">{a.userEmail}</div></td>
                  <td>{a.docType}{a.onBehalfOfCompany && <div className="small text-secondary-hz">on behalf of the organization</div>}</td>
                  <td>{a.version}</td><td>{formatDateTimeIST(a.acceptedAt)}</td><td className="small">{a.ipAddress || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function AccountTools() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const deletion = useQuery({ queryKey: ['privacy-deletion'], queryFn: privacyApi.deletionStatus });
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmName, setConfirmName] = useState('');

  const exportAll = useMutation({
    mutationFn: privacyApi.companyExport,
    onError: (error) => toast.error(errorMessage(error, 'Could not build the export.')),
  });
  const request = useMutation({
    mutationFn: () => privacyApi.requestDeletion(reason, confirmName),
    onSuccess: (data) => { queryClient.setQueryData(['privacy-deletion'], data); setOpen(false); toast.success('Deletion scheduled. You can cancel within 30 days.'); },
    onError: (error) => toast.error(errorMessage(error, 'Could not schedule deletion.')),
  });
  const cancel = useMutation({
    mutationFn: privacyApi.cancelDeletion,
    onSuccess: () => { queryClient.setQueryData(['privacy-deletion'], null); toast.success('Deletion cancelled.'); },
    onError: (error) => toast.error(errorMessage(error, 'Could not cancel deletion.')),
  });
  const pending = deletion.data;

  return (
    <div className="d-flex flex-column gap-4">
      <Card title="Export all company data" subtitle="A ZIP with one CSV per module (employees, attendance, leave, payroll, assets, ...). Credentials are never included.">
        <Button icon={Download} onClick={() => exportAll.mutate()} loading={exportAll.isPending}>Download company export</Button>
      </Card>
      <Card title="Delete organization account" subtitle="Scheduled 30 days after the request; cancellable until then.">
        {pending ? (
          <div className="d-flex flex-column gap-3">
            <div className="alert alert-warning mb-0">Deletion scheduled for <strong>{formatDateTimeIST(pending.scheduledFor)}</strong>. Export your data before then. After that date employee and user data are anonymised and the account is removed.</div>
            <div><Button variant="secondary" onClick={() => cancel.mutate()} loading={cancel.isPending}>Cancel deletion</Button></div>
          </div>
        ) : (
          <Button variant="danger" icon={Trash2} onClick={() => setOpen(true)}>Request account deletion</Button>
        )}
      </Card>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete organization account"
        description="Export your data first. Vettri keeps its own billing and tax invoices as required by GST law."
        footer={(
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => request.mutate()} loading={request.isPending} disabled={!confirmName.trim()}>Schedule deletion</Button>
          </>
        )}
      >
        <div className="d-flex flex-column gap-3">
          <FormField label={`Type "${user?.companyName || 'your organization name'}" to confirm`} value={confirmName} onChange={setConfirmName} required />
          <FormField as="textarea" rows={3} label="Reason (optional)" value={reason} onChange={setReason} />
        </div>
      </Dialog>
    </div>
  );
}

function AllDeletions() {
  const rows = useQuery({ queryKey: ['privacy-all-deletions'], queryFn: privacyApi.allDeletions });
  return (
    <Card bodyClassName="p-0">
      {rows.isLoading && <div className="p-4"><SkeletonText lines={4} /></div>}
      {rows.isError && <ErrorState description="Couldn't load deletion requests." onRetry={rows.refetch} />}
      {rows.data?.length === 0 && <EmptyState icon={Trash2} title="No deletion requests" description="Company account deletion requests across all tenants appear here." />}
      {rows.data?.length > 0 && (
        <div className="table-responsive">
          <table className="table mb-0 align-middle hz-table" aria-label="Company deletion requests">
            <thead><tr><th>Company</th><th>Status</th><th>Requested</th><th>Scheduled</th><th>Note</th></tr></thead>
            <tbody>
              {rows.data.map((d) => (
                <tr key={d.id}>
                  <td>{d.companyName} <span className="small text-secondary-hz">#{d.companyId}</span></td>
                  <td><StatusBadge variant={STATUS_VARIANT[d.status] || 'neutral'}>{d.status}</StatusBadge></td>
                  <td>{formatDateTimeIST(d.requestedAt)}</td><td>{formatDateTimeIST(d.scheduledFor)}</td>
                  <td className="small">{d.completionNote || d.reason || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
