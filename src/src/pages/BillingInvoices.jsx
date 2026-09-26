import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Mail, Search, X } from 'lucide-react';
import { billingApi } from '../api/endpoints/billing';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ui/Toast';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import StatusBadge from '../components/ui/StatusBadge';

const filters = ['ALL', 'PAID', 'PENDING', 'FAILED', 'REFUNDED'];

function formatDate(value) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

function formatMoney(invoice) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: invoice.currency || 'INR', maximumFractionDigits: 2 }).format(invoice.total || 0);
}

function typeLabel(invoice) {
  return invoice.invoiceType === 'PAYMENT_VERIFICATION_RECEIPT' ? 'Payment verification' : `${invoice.plan || 'Subscription'} payment`;
}

function documentLabel(invoice) {
  return invoice.invoiceType === 'PAYMENT_VERIFICATION_RECEIPT' ? 'Payment verification receipt' : 'Subscription invoice';
}

export default function BillingInvoices() {
  const { hasAnyRole } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const invoices = useQuery({ queryKey: ['billing-invoices', status, search], queryFn: () => billingApi.invoices({ status, search }), enabled: hasAnyRole(['COMPANY_ADMIN', 'HR_ADMIN', 'SUPER_ADMIN']) });
  const selected = useQuery({ queryKey: ['billing-invoice', selectedId], queryFn: () => billingApi.invoice(selectedId), enabled: !!selectedId });
  const email = useMutation({
    mutationFn: (id) => billingApi.emailInvoice(id),
    onSuccess: () => {
      toast.success('Invoice emailed successfully.');
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['billing-invoice'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Invoice email could not be delivered. The PDF is still available.'),
  });

  async function downloadInvoice(invoice) {
    try {
      const blob = await billingApi.invoicePdf(invoice.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice.invoiceNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invoice PDF could not be generated. Please retry.');
    }
  }

  if (!hasAnyRole(['COMPANY_ADMIN', 'HR_ADMIN', 'SUPER_ADMIN'])) {
    return <EmptyState icon={FileText} title="Billing access unavailable" description="Only company owners, HR administrators, and platform administrators can view billing records." />;
  }

  return (
    <div className="hz-page-shell hz-billing-page">
      <PageHeader eyebrow="Billing & Subscription" title="Billing history" description="Find, download, and email your Vettri HRMS payment records." />
      <Card title="Billing history" subtitle="Payment verification receipts and future subscription invoices for this workspace.">
        <div className="hz-billing-toolbar">
          <label className="hz-billing-search">
            <Search size={16} aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice number" aria-label="Search invoice number" />
          </label>
          <select className="form-select hz-billing-filter" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter invoice status">
            {filters.map((item) => <option key={item} value={item}>{item === 'ALL' ? 'All statuses' : item[0] + item.slice(1).toLowerCase()}</option>)}
          </select>
        </div>
        {invoices.isLoading ? <p className="text-secondary-hz mb-0">Loading invoices...</p> : invoices.isError ? <div className="hz-billing-error">Invoices could not be loaded. Please refresh and try again.</div> : invoices.data?.length ? (
          <div className="table-responsive">
            <table className="table align-middle mb-0 hz-table" aria-label="Billing history">
              <thead><tr><th>Invoice</th><th>Date</th><th>Description</th><th>Billing period</th><th>Amount</th><th>Status</th><th className="text-end">Actions</th></tr></thead>
              <tbody>{invoices.data.map((invoice) => <tr key={invoice.id}>
                <td><button type="button" className="hz-billing-invoice-link" onClick={() => setSelectedId(invoice.id)}>{invoice.invoiceNumber}</button></td>
                <td>{formatDate(invoice.invoiceDate)}</td>
                <td><strong>{documentLabel(invoice)}</strong><small className="d-block text-secondary-hz">{typeLabel(invoice)}</small></td>
                <td>{invoice.billingPeriodStart ? `${formatDate(invoice.billingPeriodStart)} - ${formatDate(invoice.billingPeriodEnd)}` : '—'}</td>
                <td><strong>{formatMoney(invoice)}</strong></td>
                <td><StatusBadge status={invoice.status} /></td>
                <td><div className="d-flex justify-content-end gap-1"><Button size="sm" variant="ghost" icon={FileText} onClick={() => setSelectedId(invoice.id)} aria-label={`View ${invoice.invoiceNumber}`} title={`View ${documentLabel(invoice)}`} /><Button size="sm" variant="ghost" icon={Download} onClick={() => downloadInvoice(invoice)} aria-label={`Download ${invoice.invoiceNumber}`} title="Download PDF" /><Button size="sm" variant="ghost" icon={Mail} onClick={() => email.mutate(invoice.id)} loading={email.isPending && email.variables === invoice.id} aria-label={`Email ${invoice.invoiceNumber}`} title={`Email ${documentLabel(invoice)}`} /></div></td>
              </tr>)}</tbody>
            </table>
          </div>
        ) : <EmptyState icon={FileText} title="No invoices yet" description="Your invoices will appear here after a successful subscription payment." />}
      </Card>

      {selectedId && <div className="hz-billing-drawer-backdrop" role="presentation" onClick={() => setSelectedId(null)}>
        <aside className="hz-billing-drawer" role="dialog" aria-modal="true" aria-label="Invoice details" onClick={(event) => event.stopPropagation()}>
          <div className="hz-billing-drawer__header"><div><span className="hz-dashboard__section-kicker">{selected.data ? documentLabel(selected.data) : 'Billing document'}</span><h2>{selected.data?.invoiceNumber || 'Loading document'}</h2></div><button type="button" className="hz-icon-btn" onClick={() => setSelectedId(null)} aria-label="Close billing details"><X size={18} /></button></div>
          {selected.isLoading ? <p className="text-secondary-hz">Loading invoice details...</p> : selected.data && <>
            <div className="hz-billing-total"><div><span>Total amount</span><strong>{formatMoney(selected.data)}</strong></div><StatusBadge status={selected.data.status} /></div>
            <div className="hz-billing-detail-grid"><div><span>Invoice date</span><strong>{formatDate(selected.data.invoiceDate)}</strong></div><div><span>Type</span><strong>{selected.data.invoiceType === 'PAYMENT_VERIFICATION_RECEIPT' ? 'Payment verification' : 'Subscription invoice'}</strong></div><div><span>Plan</span><strong>{selected.data.plan || '—'}</strong></div><div><span>Billing cycle</span><strong>{selected.data.billingCycle || '—'}</strong></div><div><span>Employees</span><strong>{selected.data.employeeCount || '—'}</strong></div><div><span>Payment method</span><strong>{selected.data.paymentMethod || 'Razorpay'}</strong></div></div>
            <div className="hz-billing-detail-section"><h3>Customer</h3><p><strong>{selected.data.companyLegalName || selected.data.companyName || '—'}</strong><br />{selected.data.billingAddress || 'Billing address not configured'}{selected.data.gstin ? <><br />GSTIN: {selected.data.gstin}</> : null}</p></div>
            <div className="hz-billing-detail-section"><h3>Payment reference</h3><p>Purpose: {selected.data.invoiceType === 'PAYMENT_VERIFICATION_RECEIPT' ? 'Payment method verification for the Vettri HRMS trial' : 'Subscription payment'}<br />Order ID: {selected.data.razorpayOrderId || '—'}<br />Payment ID: {selected.data.razorpayPaymentId || '—'}<br />Email status: {selected.data.emailStatus || 'Not sent'}</p></div>
            <div className="hz-billing-drawer__actions"><Button icon={Download} onClick={() => downloadInvoice(selected.data)}>Download PDF</Button><Button variant="secondary" icon={Mail} onClick={() => email.mutate(selected.data.id)} loading={email.isPending}>{selected.data.invoiceType === 'PAYMENT_VERIFICATION_RECEIPT' ? 'Email receipt' : 'Email invoice'}</Button></div>
          </>}
        </aside>
      </div>}
    </div>
  );
}
