import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Download, Settings } from 'lucide-react';
import { axiosClient } from '../../../api/axiosClient';
import Dialog from '../../../components/ui/Dialog';
import Button from '../../../components/ui/Button';
import FormField from '../../../components/ui/FormField';
import ErrorBanner from '../../../components/ui/ErrorBanner';
import { SkeletonText } from '../../../components/ui/Skeleton';
import { useToast } from '../../../components/ui/Toast';
import { formatCurrency } from '../../../utils/formatCurrency';

export const bankTransferApi = {
  preview: (runId) => axiosClient.get(`/api/salary/payroll-runs/${runId}/bank-transfer`).then((res) => res.data),
  settings: () => axiosClient.get('/api/salary/bank-settings').then((res) => res.data),
  saveSettings: (body) => axiosClient.put('/api/salary/bank-settings', body).then((res) => res.data),
  download: async (runId, format, valueDate) => {
    const res = await axiosClient.get(`/api/salary/payroll-runs/${runId}/bank-transfer/file`, { params: { format, valueDate: valueDate || undefined }, responseType: 'blob' });
    const name = /filename="?([^"]+)"?/.exec(res.headers?.['content-disposition'] || '')?.[1] || `salary-${runId}.csv`;
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  },
};

const FORMAT_LABEL = {
  GENERIC: 'Generic NEFT/IMPS (CSV, any bank)',
  HDFC: 'HDFC Bank - ENet bulk upload',
  ICICI: 'ICICI Bank - CIB bulk payment',
};

/** Bank transfer file for a processed run: who will be paid, who is missing bank details, and the download. */
export default function BankTransferDialog({ runId, onClose }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['bank-transfer', runId], queryFn: () => bankTransferApi.preview(runId), retry: false });
  const [format, setFormat] = useState(null);
  const [valueDate, setValueDate] = useState(new Date().toISOString().slice(0, 10));
  const [editingSettings, setEditingSettings] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const chosen = format || data?.defaultFormat || 'GENERIC';

  const download = async () => {
    setDownloading(true);
    try {
      await bankTransferApi.download(runId, chosen, valueDate);
      toast.success('Bank file downloaded. Upload it in your bank’s bulk payment section, then mark the run as paid.');
    } catch (err) {
      let message = 'Could not create the bank file.';
      try { message = JSON.parse(await err.response.data.text()).message || message; } catch { /* keep default */ }
      toast.error(message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open onClose={onClose} size="lg" title="Bank transfer file"
      description={data ? `${data.period} · ${data.payable} payment${data.payable === 1 ? '' : 's'} · ${formatCurrency(data.totalAmount)}` : undefined}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button icon={Download} loading={downloading} disabled={!data || data.payable === 0 || (chosen !== 'GENERIC' && !data.debitAccountSet)} onClick={download}>Download file</Button>
        </>
      )}>
      {isLoading ? <SkeletonText lines={4} /> : isError ? <ErrorBanner>{error?.response?.data?.message || 'Could not load the run.'}</ErrorBanner> : (
        <div className="d-flex flex-column gap-3">
          <div className="row g-3">
            <FormField col={7} as="select" label="Bank format" value={chosen} onChange={setFormat}>
              {data.formats.map((f) => <option key={f} value={f}>{FORMAT_LABEL[f] || f}</option>)}
            </FormField>
            <FormField col={5} type="date" label="Payment (value) date" value={valueDate} onChange={setValueDate} />
          </div>
          {chosen !== 'GENERIC' && !data.debitAccountSet && (
            <ErrorBanner>Add the company&apos;s salary debit account below to use a bank-specific format.</ErrorBanner>
          )}
          {chosen !== 'GENERIC' && (
            <div style={{ fontSize: 12.5, color: 'var(--hz-text-muted)' }}>
              Bank layouts change from time to time. Before the first real payment, upload a test file or compare it with a sample from your corporate banking portal. If yours differs, use the generic file (every portal can map its columns) and tell us.
            </div>
          )}
          {data.problems.length > 0 && (
            <div className="p-3" style={{ border: '1px solid var(--hz-warning-500)', background: 'var(--hz-warning-50)', borderRadius: 12 }}>
              <div className="d-flex align-items-center gap-2" style={{ fontWeight: 700 }}><AlertTriangle size={16} aria-hidden="true" /> {data.problems.length} employee{data.problems.length === 1 ? '' : 's'} left out - pay them separately or fix their bank details and download again</div>
              <ul className="mb-0 mt-2" style={{ fontSize: 13 }}>
                {data.problems.map((p) => <li key={p.employeeId}>{p.employeeName} ({p.employeeCode}) - {p.issue}</li>)}
              </ul>
            </div>
          )}
          <div className="table-responsive" style={{ maxHeight: 260 }}>
            <table className="table table-sm align-middle mb-0" style={{ fontSize: 13 }}>
              <thead><tr><th>Employee</th><th>Account</th><th>IFSC</th><th>Mode</th><th className="text-end">Amount</th></tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.employeeId}><td>{r.employeeName} <span style={{ color: 'var(--hz-text-muted)' }}>{r.employeeCode}</span></td><td>{r.accountMasked}</td><td>{r.ifsc}</td><td>{r.mode === 'IFT' ? 'Same bank' : 'NEFT'}</td><td className="text-end">{formatCurrency(r.amount)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <button type="button" className="btn btn-link btn-sm p-0 d-inline-flex align-items-center gap-1" onClick={() => setEditingSettings((v) => !v)}>
              <Settings size={14} aria-hidden="true" /> {editingSettings ? 'Hide' : 'Company debit account & narration'}
            </button>
            {editingSettings && <BankSettingsForm onSaved={() => queryClient.invalidateQueries({ queryKey: ['bank-transfer', runId] })} />}
          </div>
        </div>
      )}
    </Dialog>
  );
}

function BankSettingsForm({ onSaved }) {
  const toast = useToast();
  const { data } = useQuery({ queryKey: ['bank-settings'], queryFn: bankTransferApi.settings });
  const [form, setForm] = useState(null);
  const current = form || (data && { ...data, debitAccountNumber: data.debitAccountNumber || '', debitIfsc: data.debitIfsc || '', bankName: data.bankName || '', narration: data.narration || '' });
  const save = useMutation({
    mutationFn: () => bankTransferApi.saveSettings(current),
    onSuccess: () => { toast.success('Bank file settings saved.'); setForm(null); onSaved(); },
    onError: (err) => toast.error(err?.response?.data?.message || 'Could not save.'),
  });
  if (!current) return <SkeletonText lines={2} />;
  const set = (k, v) => setForm({ ...current, [k]: v });
  return (
    <div className="row g-2 mt-2 p-3" style={{ border: '1px solid var(--hz-border)', borderRadius: 12 }}>
      <FormField col={6} label="Salary debit account number" value={current.debitAccountNumber} onChange={(v) => set('debitAccountNumber', v)} autoComplete="off" />
      <FormField col={6} label="Debit account IFSC" value={current.debitIfsc} onChange={(v) => set('debitIfsc', v.toUpperCase())} maxLength={11} />
      <FormField col={6} label="Bank" value={current.bankName} onChange={(v) => set('bankName', v)} />
      <FormField col={6} as="select" label="Default format" value={current.defaultFormat} onChange={(v) => set('defaultFormat', v)}>
        {Object.entries(FORMAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </FormField>
      <FormField col={12} label="Narration on the transfer" value={current.narration} onChange={(v) => set('narration', v)} maxLength={30} placeholder="SALARY {MONTH}" hint="{MONTH} becomes e.g. OCT 2026" />
      <div className="col-12 d-flex justify-content-end"><Button size="sm" loading={save.isPending} disabled={!form} onClick={() => save.mutate()}>Save settings</Button></div>
    </div>
  );
}
