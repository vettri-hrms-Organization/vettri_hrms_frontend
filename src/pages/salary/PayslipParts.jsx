import { Download } from 'lucide-react';
import { formatCurrency } from '../../utils/formatCurrency';
import { financialYearLabel } from '../../api/endpoints/salary';
import PayrollStatusBadge from './components/PayrollStatusBadge';

/*
 * Building blocks for the payslip page (SalaryDetails): month picker, the selected
 * month's summary + earnings/deductions breakdown, and the year-to-date panel.
 * Everything here renders fields PayrollItemDTO already carries - nothing is estimated.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PICKER_BUTTONS = 6;

// Runs that reached employees: these are the "published" payslips.
export const isPublished = (p) => p.status === 'PROCESSED' || p.status === 'PAID';

/** Newest period first; createdAt order from the API breaks ties (e.g. a re-run month). */
export function sortByPeriod(items = []) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (b.item.periodYear * 12 + b.item.periodMonth) - (a.item.periodYear * 12 + a.item.periodMonth) || a.index - b.index)
    .map(({ item }) => item);
}

/** Indian financial year (Apr-Mar) a payroll period falls in, e.g. Jan 2027 -> 2026. */
export const periodFy = (p) => (p.periodMonth >= 4 ? p.periodYear : p.periodYear - 1);

const parseDay = (value) => new Date(`${String(value).slice(0, 10)}T00:00:00`);
export const longDate = (value) => (value ? parseDay(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtDays = (n) => String(Number(Number(n).toFixed(2)));

function payPeriod(p) {
  const last = new Date(p.periodYear, p.periodMonth, 0).getDate();
  const month = MONTHS[p.periodMonth - 1];
  return `1 ${month} – ${last} ${month} ${p.periodYear}`;
}

/** Segmented month buttons for the latest payslips; older ones stay reachable from a select. */
export function PayslipPicker({ items, selectedId, onSelect }) {
  const recent = items.slice(0, PICKER_BUTTONS);
  const showYear = new Set(recent.map((p) => p.periodYear)).size > 1;
  return (
    <div className="hz-payslip__picker">
      <div className="hz-payslip__months" role="group" aria-label="Payslip month">
        {recent.map((p) => (
          <button
            key={p.id}
            type="button"
            className={p.id === selectedId ? 'is-active' : ''}
            aria-pressed={p.id === selectedId}
            title={p.periodLabel}
            onClick={() => onSelect(p.id)}
          >
            {MONTHS[p.periodMonth - 1]?.toUpperCase()}{showYear ? ` ${String(p.periodYear).slice(2)}` : ''}
          </button>
        ))}
      </div>
      {items.length > PICKER_BUTTONS && (
        <select className="form-select form-select-sm hz-payslip__older" value={selectedId ?? ''} onChange={(e) => onSelect(Number(e.target.value))} aria-label="All payslips">
          {items.map((p) => <option key={p.id} value={p.id}>{p.periodLabel}</option>)}
        </select>
      )}
    </div>
  );
}

/** The selected month: net pay up front, the figures behind it, then the line-by-line breakdown. */
export function PayslipSummary({ item, canDownload, downloading, onDownload }) {
  const gross = Number(item.grossSalary) || 0;
  const deductions = Number(item.totalDeductions) || 0;
  const deductionShare = gross > 0 ? Math.min(100, Math.max(0, (deductions / gross) * 100)) : 0;
  return (
    <>
      <div className="hz-payslip__summary-head">
        <div className="min-w-0">
          <h2 className="hz-payslip__heading mb-1">{item.periodLabel} payslip</h2>
          <PayrollStatusBadge status={item.status} />
        </div>
        {canDownload && (
          <button type="button" className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1" onClick={onDownload} disabled={downloading}>
            <Download size={14} aria-hidden="true" /> {downloading ? 'Downloading…' : 'Download PDF'}
          </button>
        )}
      </div>

      <div className="hz-payslip__net">
        <span className="hz-payslip__label">Net pay</span>
        <strong data-testid="payslip-net">{formatCurrency(item.netSalary)}</strong>
      </div>

      <dl className="hz-payslip__figures">
        <div><dt>Gross earnings</dt><dd>{formatCurrency(item.grossSalary)}</dd></div>
        <div><dt>Total deductions</dt><dd className="is-deduction">{formatCurrency(item.totalDeductions)}</dd></div>
        <div><dt>Paid days</dt><dd>{item.paidDays != null ? `${fmtDays(item.paidDays)} / ${item.daysInPeriod}` : '—'}</dd></div>
        <div><dt>LOP days</dt><dd>{Number(item.lopDays) > 0 ? fmtDays(item.lopDays) : '0'}</dd></div>
        <div><dt>Pay period</dt><dd className="is-text">{payPeriod(item)}</dd></div>
        <div><dt>Payment date</dt><dd className="is-text">{item.paymentDate ? longDate(item.paymentDate) : 'Not paid yet'}</dd></div>
      </dl>

      {gross > 0 && (
        <div className="hz-payslip__split">
          <div className="hz-payslip__split-bar" aria-hidden="true">
            <span className="is-net" style={{ width: `${100 - deductionShare}%` }} />
            <span className="is-deduction" style={{ width: `${deductionShare}%` }} />
          </div>
          <ul className="hz-payslip__legend">
            <li><i className="is-net" />Take-home {Math.round(100 - deductionShare)}% of gross</li>
            <li><i className="is-deduction" />Deductions {Math.round(deductionShare)}%</li>
          </ul>
        </div>
      )}

      <PayslipBreakdown item={item} />
    </>
  );
}

const EARNING_LINES = [
  ['basicSalary', 'Basic salary'], ['hra', 'HRA'], ['specialAllowance', 'Special allowance'], ['medicalAllowance', 'Medical allowance'],
  ['travelAllowance', 'Travel allowance'], ['bonus', 'Bonus'], ['incentives', 'Incentives'], ['overtime', 'Overtime'],
];
const DEDUCTION_LINES = [
  ['pf', 'Provident fund (PF)'], ['esi', 'ESI'], ['professionalTax', 'Professional tax'], ['tds', 'Income tax (TDS)'], ['otherDeductions', 'Other deductions'],
];

/** One payslip's earnings (incl. additional earnings), deductions and employer contributions. */
export function PayslipBreakdown({ item }) {
  const c = item.components || {};
  const earnings = [
    ...EARNING_LINES.filter(([key]) => Number(c[key]) > 0).map(([key, label]) => [label, c[key]]),
    ...(item.adjustments || []).map((a) => [`${a.label}${a.taxable ? '' : ' (non-taxable)'}`, a.amount]),
  ];
  const deductions = [
    ...DEDUCTION_LINES.filter(([key]) => Number(c[key]) > 0).map(([key, label]) => [label, c[key]]),
    ...(item.deductionLines || []).map((d) => [d.label, d.amount]),
  ];
  const employer = [
    ['Employer EPF', item.employerEpf],
    ['Employer EPS (pension)', item.employerEps],
    ['Employer ESI', item.employerEsi],
  ].filter(([, value]) => Number(value) > 0);
  return (
    <>
      <div className="hz-payslip__breakdown">
        <BreakdownColumn title="Earnings" rows={earnings} total={['Gross earnings', item.grossSalary]} />
        <BreakdownColumn title="Deductions" rows={deductions} total={['Total deductions', item.totalDeductions]} />
      </div>
      <div className="hz-payslip__netline">
        <span>Net pay <small>(gross earnings − total deductions)</small></span>
        <strong>{formatCurrency(item.netSalary)}</strong>
      </div>
      <div className="hz-payslip__employer">
        <BreakdownColumn
          title="Employer contributions"
          note="Paid by the company on top of your salary - not deducted."
          rows={employer}
          total={employer.length ? ['Total', item.employerContributions] : null}
          empty="None this month"
        />
      </div>
    </>
  );
}

function BreakdownColumn({ title, rows, total, note, empty = '—' }) {
  return (
    <div className="hz-payslip__column">
      <h3 className="hz-payslip__label">{title}</h3>
      {note && <p className="hz-payslip__note">{note}</p>}
      {rows.length === 0 && <p className="hz-payslip__note mb-0">{empty}</p>}
      {rows.length > 0 && (
        <ul>
          {rows.map(([label, value]) => (
            <li key={label}><span>{label}</span><span>{formatCurrency(value)}</span></li>
          ))}
        </ul>
      )}
      {total && (
        <div className="hz-payslip__total">
          <span>{total[0]}</span>
          <span>{formatCurrency(total[1])}</span>
        </div>
      )}
    </div>
  );
}

/** Sums of the published payslips in the selected payslip's financial year, up to and including it. */
export function YearToDate({ items, selected }) {
  const fy = periodFy(selected);
  const upTo = selected.periodYear * 12 + selected.periodMonth;
  const rows = items.filter((p) => isPublished(p) && periodFy(p) === fy && p.periodYear * 12 + p.periodMonth <= upTo);
  const sum = (key) => rows.reduce((total, p) => total + (Number(p[key]) || 0), 0);
  return (
    <section className="hz-payslip__panel" aria-labelledby="hz-payslip-ytd">
      <h2 className="hz-payslip__heading" id="hz-payslip-ytd">Year to date</h2>
      <p className="hz-payslip__muted">
        {financialYearLabel(fy)} up to {selected.periodLabel} · {rows.length} {rows.length === 1 ? 'payslip' : 'payslips'}
      </p>
      {rows.length === 0 ? (
        <p className="hz-payslip__muted mt-2">No published payslips in this financial year yet.</p>
      ) : (
        <dl className="hz-payslip__ytd">
          <div><dt>Gross earnings</dt><dd>{formatCurrency(sum('grossSalary'))}</dd></div>
          <div><dt>Deductions</dt><dd className="is-deduction">{formatCurrency(sum('totalDeductions'))}</dd></div>
          <div><dt>Net pay</dt><dd className="is-net">{formatCurrency(sum('netSalary'))}</dd></div>
        </dl>
      )}
    </section>
  );
}
