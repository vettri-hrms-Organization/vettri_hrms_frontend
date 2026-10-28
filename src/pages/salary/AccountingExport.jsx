import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileDown, Save } from 'lucide-react';
import { payrollApi } from '../../api/endpoints/salary';
import { accountingApi, formatINR } from '../../api/endpoints/settlement';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import ErrorBanner from '../../components/ui/ErrorBanner';
import PageHeader from '../../components/ui/PageHeader';
import { useToast } from '../../components/ui/Toast';

const LEDGER_FIELDS = [
  ['salariesLedger', 'Salaries & wages (Dr)'],
  ['employerPfLedger', 'Employer PF contribution (Dr)'],
  ['employerEsiLedger', 'Employer ESI contribution (Dr)'],
  ['reimbursementExpenseLedger', 'Reimbursement expense (Dr)'],
  ['salaryPayableLedger', 'Salary payable (Cr)'],
  ['pfPayableLedger', 'PF payable (Cr)'],
  ['esiPayableLedger', 'ESI payable (Cr)'],
  ['ptPayableLedger', 'Professional tax payable (Cr)'],
  ['tdsPayableLedger', 'TDS payable (Cr)'],
  ['reimbursementPayableLedger', 'Reimbursements payable (Cr)'],
  ['otherDeductionsLedger', 'Other deductions (Cr)'],
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Payroll -> accounting: summary journal CSV, Tally XML, Zoho Books CSV, and ledger name mapping. */
export default function AccountingExport() {
  const toast = useToast();
  const [runId, setRunId] = useState('');
  const [error, setError] = useState(null);
  const { data: runs = [] } = useQuery({ queryKey: ['payroll-runs'], queryFn: payrollApi.listRuns });
  const finalized = runs.filter((r) => r.status === 'PROCESSED' || r.status === 'PAID');
  const { data: preview, isFetching } = useQuery({
    queryKey: ['payroll-journal', runId],
    queryFn: () => accountingApi.preview(runId),
    enabled: !!runId,
  });

  useEffect(() => {
    if (!runId && finalized.length) setRunId(String(finalized[0].id));
  }, [finalized, runId]);

  async function download(format) {
    const run = finalized.find((r) => String(r.id) === String(runId));
    const label = run ? `${run.periodYear}-${String(run.periodMonth).padStart(2, '0')}` : runId;
    const names = { journal: `payroll-${label}-journal.csv`, tally: `payroll-${label}-tally.xml`, zoho: `payroll-${label}-zoho-journal.csv` };
    try {
      setError(null);
      await accountingApi.download(runId, format, names[format]);
    } catch (err) {
      setError(err?.response?.status === 400 ? 'This run cannot be exported yet - process it first.' : 'Export failed');
      toast.error('Export failed');
    }
  }

  return (
    <div className="hz-module-page hz-module-page--payroll d-flex flex-column gap-4">
      <PageHeader eyebrow="Payroll" title="Accounting export" description="Post a processed payroll run to your books as one balanced journal voucher" />

      <Card
        title="Export a payroll run"
        actions={(
          <select className="form-select form-select-sm" style={{ width: 'auto' }} aria-label="Payroll run" value={runId} onChange={(e) => setRunId(e.target.value)}>
            {!finalized.length && <option value="">No processed runs</option>}
            {finalized.map((r) => <option key={r.id} value={r.id}>{MONTHS[r.periodMonth - 1]} {r.periodYear} ({r.status})</option>)}
          </select>
        )}
      >
        {error && <ErrorBanner>{error}</ErrorBanner>}
        {runId && preview && (
          <>
            <div className="table-responsive">
              <table className="table table-sm mb-2" aria-label="Journal preview">
                <thead><tr><th>Ledger</th><th className="text-end">Debit</th><th className="text-end">Credit</th></tr></thead>
                <tbody>
                  {preview.entries.map((e) => (
                    <tr key={e.ledger}>
                      <td>{e.ledger}</td>
                      <td className="text-end">{Number(e.debit) > 0 ? formatINR(e.debit) : ''}</td>
                      <td className="text-end">{Number(e.credit) > 0 ? formatINR(e.credit) : ''}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700 }}>
                    <td>Total ({preview.employees} employees)</td>
                    <td className="text-end">{formatINR(preview.totalDebit)}</td>
                    <td className="text-end">{formatINR(preview.totalCredit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{preview.narration} - dated {preview.date}. Held employees are excluded.</p>
          </>
        )}
        {runId && isFetching && !preview && <p>Loading journal...</p>}
        <div className="d-flex flex-wrap gap-2">
          <Button icon={FileDown} variant="secondary" disabled={!runId} onClick={() => download('journal')}>Journal CSV</Button>
          <Button icon={FileDown} variant="secondary" disabled={!runId} onClick={() => download('tally')}>Tally XML</Button>
          <Button icon={FileDown} variant="secondary" disabled={!runId} onClick={() => download('zoho')}>Zoho Books CSV</Button>
        </div>
        <p className="mb-0 mt-2" style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>
          Tally: Gateway of Tally &rarr; Import &rarr; Vouchers (TallyPrime) or Import of Data &rarr; Vouchers (ERP 9). Every ledger below must already exist in Tally with exactly the same name.
          Zoho Books: Accountant &rarr; Manual Journals &rarr; Import, then map the columns.
        </p>
      </Card>

      <LedgerSettings />
    </div>
  );
}

function LedgerSettings() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const { data } = useQuery({ queryKey: ['payroll-ledgers'], queryFn: accountingApi.getLedgers });
  useEffect(() => { if (data) setForm({ ...data, tallyCompanyName: data.tallyCompanyName || '' }); }, [data]);
  const save = useMutation({
    mutationFn: () => accountingApi.updateLedgers(form),
    onSuccess: (saved) => {
      queryClient.setQueryData(['payroll-ledgers'], saved);
      queryClient.invalidateQueries({ queryKey: ['payroll-journal'] });
      setError(null);
      toast.success('Ledger mapping saved');
    },
    onError: (err) => setError(err?.response?.data?.message || 'Could not save the ledger mapping'),
  });
  if (!form) return <Card title="Ledger mapping"><p className="mb-0">Loading...</p></Card>;
  return (
    <Card title="Ledger mapping" subtitle="Ledger / account names exactly as they appear in Tally or Zoho Books">
      {error && <ErrorBanner>{error}</ErrorBanner>}
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="row g-2">
          {LEDGER_FIELDS.map(([key, label]) => (
            <FormField key={key} col={4} label={label} value={form[key] || ''} onChange={(v) => setForm({ ...form, [key]: v })} required />
          ))}
          <FormField col={4} label="Tally voucher type" value={form.voucherType || ''} onChange={(v) => setForm({ ...form, voucherType: v })} hint="Usually Journal" />
          <FormField col={4} label="Tally company name" value={form.tallyCompanyName} onChange={(v) => setForm({ ...form, tallyCompanyName: v })} hint="Blank = the company open in Tally" />
        </div>
        <div className="d-flex justify-content-end mt-2">
          <Button type="submit" icon={Save} loading={save.isPending}>Save mapping</Button>
        </div>
      </form>
    </Card>
  );
}
