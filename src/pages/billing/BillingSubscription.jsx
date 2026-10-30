import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, FileText, Receipt, Save, Wallet } from 'lucide-react';
import { billingApi } from '../../api/endpoints/billing';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import StatusBadge from '../../components/ui/StatusBadge';
import FormField from '../../components/ui/FormField';
import { usePayNow } from '../../components/billing/usePayNow';
import { GST_STATES, isValidGstin, normalizeGstin } from '../../utils/gstin';

const CYCLES = [
  { value: 'MONTHLY', label: 'Monthly', key: 'monthlyRate' },
  { value: 'QUARTERLY', label: 'Quarterly', key: 'quarterlyRate' },
  { value: 'ANNUAL', label: 'Annual', key: 'annualRate' },
];
const STATE_OPTIONS = Object.entries(GST_STATES)
  .map(([code, name]) => [String(code).padStart(2, '0'), name])
  .sort((a, b) => a[1].localeCompare(b[1]));

function inr(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatDate(value) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

const emptyProfile = { legalName: '', gstin: '', billingAddress: '', stateCode: '', poNumber: '' };

export default function BillingSubscription() {
  const { hasAnyRole, hasRole } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const canView = hasAnyRole(['COMPANY_ADMIN', 'HR_ADMIN', 'SUPER_ADMIN']);
  const isOwner = hasRole('COMPANY_ADMIN');
  const overview = useQuery({ queryKey: ['billing-subscription'], queryFn: billingApi.subscription, enabled: canView });
  const { payNow, paying } = usePayNow();
  const [plan, setPlan] = useState('STARTER');
  const [cycle, setCycle] = useState('MONTHLY');
  const [profile, setProfile] = useState(emptyProfile);

  const data = overview.data;
  useEffect(() => {
    if (!data) return;
    setPlan(data.pendingPlan || (data.plan && data.plan !== 'TRIAL' && data.plan !== 'VETTRI_HRMS' ? data.plan : 'STARTER'));
    setCycle(data.pendingBillingCycle || data.billingCycle || 'MONTHLY');
    const p = data.profile || {};
    setProfile({ legalName: p.legalName || '', gstin: p.gstin || '', billingAddress: p.billingAddress || '', stateCode: p.stateCode || '', poNumber: p.poNumber || '' });
  }, [data]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['billing-subscription'] });
    queryClient.invalidateQueries({ queryKey: ['billing-status'] });
  };
  const onError = (error) => toast.error(error.userMessage || error.message || 'We could not update your subscription. Please try again, or write to customersupport@vettrihrms.in.');
  const changePlan = useMutation({ mutationFn: billingApi.changePlan, onSuccess: (res) => { toast.success(res.message); refresh(); }, onError });
  const cancel = useMutation({ mutationFn: billingApi.cancelSubscription, onSuccess: (res) => { toast.success(res.message); refresh(); }, onError });
  const resume = useMutation({ mutationFn: billingApi.resumeSubscription, onSuccess: (res) => { toast.success(res.message); refresh(); }, onError });
  const autoDebit = useMutation({
    mutationFn: billingApi.startAutoDebit,
    onSuccess: (res) => {
      if (res.shortUrl) window.open(res.shortUrl, '_blank', 'noopener');
      toast.info('Complete the auto-debit authorisation in the Razorpay window that just opened.');
      refresh();
    },
    onError,
  });
  const stopAutoDebit = useMutation({ mutationFn: billingApi.cancelAutoDebit, onSuccess: (res) => { toast.success(res.message); refresh(); }, onError });
  const saveProfile = useMutation({ mutationFn: billingApi.updateProfile, onSuccess: () => { toast.success('Billing profile saved.'); refresh(); }, onError });

  if (!canView) {
    return <EmptyState icon={Wallet} title="Billing access unavailable" description="Only company owners, HR administrators and platform administrators can view billing." />;
  }
  if (overview.isLoading) return <div className="hz-page-shell"><p className="text-secondary-hz">Loading subscription...</p></div>;
  if (overview.isError) return <div className="hz-page-shell"><ErrorState title="Billing could not be loaded" description={overview.error?.userMessage || 'Please refresh and try again.'} onRetry={() => overview.refetch()} /></div>;

  const due = data.dueInvoice;
  const selectedPlan = (data.plans || []).find((item) => item.plan === plan);
  const cycleInfo = CYCLES.find((item) => item.value === cycle);
  const estimate = selectedPlan ? Number(selectedPlan[cycleInfo.key]) * Math.max(1, data.billableSeats || 1) : 0;
  const gstinValue = normalizeGstin(profile.gstin);
  const gstinError = gstinValue && !isValidGstin(gstinValue) ? 'Invalid GSTIN (check the 15 characters and the check digit).' : null;
  const readOnly = ['SUSPENDED', 'EXPIRED', 'CANCELLED'].includes(data.status);
  const payable = ['TRIALING', 'TRIAL', 'PAST_DUE', 'SUSPENDED', 'EXPIRED', 'CANCELLED'].includes(data.status) || !!due;

  return (
    <div className="hz-page-shell hz-billing-page">
      <PageHeader eyebrow="Billing & Subscription" title="Subscription" description="Your plan, seats, renewal and GST billing details."
        actions={<Link to="/billing/invoices" className="btn btn-outline-secondary btn-sm"><FileText size={14} className="me-1" />Billing history</Link>} />

      <div className="row g-3">
        <div className="col-lg-7">
          <Card title="Current plan" subtitle={readOnly ? 'The workspace is read-only until the due invoice is paid.' : undefined}
            actions={<StatusBadge status={data.status} />}>
            <div className="hz-billing-detail-grid">
              <div><span>Plan</span><strong>{data.plan || '—'}</strong></div>
              <div><span>Billing cycle</span><strong>{data.billingCycle || '—'}</strong></div>
              <div><span>Rate per seat / cycle</span><strong>{data.rate != null ? inr(data.rate) : '—'}</strong></div>
              <div><span>Paid seats</span><strong>{data.paidSeats ?? '—'}</strong></div>
              <div><span>Active employees (billable)</span><strong>{data.billableSeats}</strong></div>
              <div><span>{data.status === 'TRIALING' ? 'Trial ends' : 'Renews on'}</span><strong>{formatDate(data.renewalDate)}</strong></div>
              {data.graceEndsOn ? <div><span>Grace period ends</span><strong>{formatDate(data.graceEndsOn)}</strong></div> : null}
              {data.pendingPlan ? <div><span>Scheduled change</span><strong>{data.pendingPlan} · {data.pendingBillingCycle}</strong></div> : null}
              {Number(data.unbilledAddOns) > 0 ? <div><span>Prorated add-ons (next invoice)</span><strong>{inr(data.unbilledAddOns)}</strong></div> : null}
            </div>
            {data.billableSeats > (data.paidSeats || 0) && data.status === 'ACTIVE' ? (
              <p className="text-secondary-hz small mt-2 mb-0">You have more active employees than paid seats. The extra seats are charged pro rata on your next invoice.</p>
            ) : null}
            {data.cancelAtPeriodEnd ? <p className="small mt-2 mb-0">Your subscription is set to end on {formatDate(data.renewalDate)}.</p> : null}
            {isOwner ? (
              <div className="d-flex gap-2 flex-wrap mt-3">
                {data.cancelAtPeriodEnd
                  ? <Button variant="secondary" size="sm" onClick={() => resume.mutate()} loading={resume.isPending}>Keep my subscription</Button>
                  : ['ACTIVE', 'TRIALING'].includes(data.status) && <Button variant="ghost" size="sm" onClick={async () => { if (await confirm({ title: 'Cancel your subscription?', description: 'Your plan stays active until the end of the current billing period. After that date the workspace becomes read-only until you subscribe again.', confirmLabel: 'Cancel subscription', cancelLabel: 'Keep subscription' })) cancel.mutate(); }} loading={cancel.isPending}>Cancel subscription</Button>}
                {data.autoDebitAvailable && data.status === 'ACTIVE' && (data.autoDebitActive
                  ? <Button variant="ghost" size="sm" onClick={() => stopAutoDebit.mutate()} loading={stopAutoDebit.isPending}>Turn off auto-debit</Button>
                  : <Button variant="secondary" size="sm" icon={CreditCard} onClick={() => autoDebit.mutate()} loading={autoDebit.isPending}>Set up auto-debit</Button>)}
              </div>
            ) : null}
          </Card>
        </div>

        <div className="col-lg-5">
          <Card title="Amount due" subtitle={due ? `For ${formatDate(due.billingPeriodStart)} - ${formatDate(due.billingPeriodEnd)}` : 'Nothing is due right now.'}>
            {due ? (
              <>
                <table className="table table-sm mb-2" aria-label="Amount due breakdown"><tbody>
                  <tr><td>{due.plan} · {due.employeeCount} seat(s) × {inr(due.unitRate)}</td><td className="text-end">{inr(due.baseAmount ?? due.subtotal)}</td></tr>
                  {Number(due.seatAddonAmount) > 0 ? <tr><td>Prorated add-ons</td><td className="text-end">{inr(due.seatAddonAmount)}</td></tr> : null}
                  <tr><td>Taxable value</td><td className="text-end">{inr(due.taxableValue ?? due.subtotal)}</td></tr>
                  {Number(due.cgstAmount) > 0 ? <><tr><td>CGST {due.cgstRate}%</td><td className="text-end">{inr(due.cgstAmount)}</td></tr><tr><td>SGST {due.sgstRate}%</td><td className="text-end">{inr(due.sgstAmount)}</td></tr></> : null}
                  {Number(due.igstAmount) > 0 ? <tr><td>IGST {due.igstRate}%</td><td className="text-end">{inr(due.igstAmount)}</td></tr> : null}
                  <tr><th>Total</th><th className="text-end">{inr(due.total)}</th></tr>
                </tbody></table>
                {due.taxNote ? <p className="small text-secondary-hz">{due.taxNote}</p> : null}
              </>
            ) : <p className="text-secondary-hz small">Your renewal invoice is generated 7 days before the renewal date.</p>}
            {isOwner && payable && data.status !== 'PENDING_PAYMENT' ? (
              <Button icon={Receipt} onClick={payNow} loading={paying}>{due ? `Pay ${inr(due.total)}` : 'Pay now'}</Button>
            ) : !isOwner && due ? <p className="small mb-0">Only the company admin can make payments.</p> : null}
          </Card>
        </div>

        <div className="col-lg-6">
          <Card title="Change plan" subtitle="Upgrades apply now (difference charged pro rata); downgrades and cycle changes apply at the next renewal.">
            <div className="row g-2">
              <div className="col-sm-6">
                <label className="hz-form-label w-100">Plan
                  <select className="form-select" value={plan} onChange={(e) => setPlan(e.target.value)} disabled={!isOwner}>
                    {(data.plans || []).map((item) => <option key={item.plan} value={item.plan}>{item.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="col-sm-6">
                <label className="hz-form-label w-100">Billing cycle
                  <select className="form-select" value={cycle} onChange={(e) => setCycle(e.target.value)} disabled={!isOwner}>
                    {CYCLES.map((item) => <option key={item.value} value={item.value}>{item.label}{selectedPlan ? ` - ${inr(selectedPlan[item.key])}/seat` : ''}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <p className="small text-secondary-hz mt-2">Estimate for {Math.max(1, data.billableSeats || 1)} seat(s): {inr(estimate)} per {cycle.toLowerCase().replace('ly', '').replace('annual', 'year')} + GST.</p>
            {isOwner ? <Button size="sm" onClick={() => changePlan.mutate({ plan, billingCycle: cycle })} loading={changePlan.isPending}>Apply plan</Button> : null}
          </Card>
        </div>

        <div className="col-lg-6">
          <Card title="GST billing profile" subtitle="Printed on your tax invoices. Place of supply follows the billing state.">
            <form onSubmit={(event) => { event.preventDefault(); if (!gstinError) saveProfile.mutate({ ...profile, gstin: gstinValue, state: GST_STATES[Number(profile.stateCode)] || GST_STATES[profile.stateCode] || null }); }}>
              <div className="row g-2">
                <FormField col={12} label="Legal name" value={profile.legalName} onChange={(v) => setProfile({ ...profile, legalName: v })} disabled={!isOwner} maxLength={255} />
                <FormField col={6} label="GSTIN (optional)" value={profile.gstin} onChange={(v) => setProfile({ ...profile, gstin: v.toUpperCase() })} error={gstinError} disabled={!isOwner} maxLength={15} />
                <div className="col-sm-6">
                  <label className="hz-form-label w-100">State
                    <select className="form-select" value={profile.stateCode} onChange={(e) => setProfile({ ...profile, stateCode: e.target.value })} disabled={!isOwner}>
                      <option value="">Select state</option>
                      {STATE_OPTIONS.map(([code, name]) => <option key={code} value={code}>{name} ({code})</option>)}
                    </select>
                  </label>
                </div>
                <FormField col={12} as="textarea" rows={2} label="Billing address" value={profile.billingAddress} onChange={(v) => setProfile({ ...profile, billingAddress: v })} disabled={!isOwner} maxLength={1000} />
                <FormField col={6} label="PO number (optional)" value={profile.poNumber} onChange={(v) => setProfile({ ...profile, poNumber: v })} disabled={!isOwner} maxLength={60} />
              </div>
              {isOwner ? <Button type="submit" size="sm" icon={Save} className="mt-2" loading={saveProfile.isPending} disabled={!!gstinError}>Save billing profile</Button> : null}
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
