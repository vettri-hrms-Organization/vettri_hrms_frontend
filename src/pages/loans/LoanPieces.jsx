import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { INSTALLMENT_STATUS, loansApi, monthLabel, rupees } from '../../api/endpoints/loans';
import Badge from '../../components/ui/Badge';

/** Repayment progress bar: recovered vs total payable. */
export function LoanProgress({ loan }) {
  const total = Number(loan.recovered || 0) + Number(loan.outstanding || 0);
  const pct = total ? Math.round((Number(loan.recovered) / total) * 100) : 0;
  return (
    <div>
      <div className="d-flex justify-content-between" style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>
        <span>{rupees(loan.recovered)} repaid</span><span>{rupees(loan.outstanding)} left</span>
      </div>
      <div role="progressbar" aria-label="Repaid" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
        style={{ height: 6, borderRadius: 99, background: 'var(--hz-gray-100)', overflow: 'hidden', marginTop: 4 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--hz-success-500)' }} />
      </div>
    </div>
  );
}

/** Month-by-month schedule; renderAction adds a per-row button (HR defer). */
export function ScheduleTable({ schedule, renderAction }) {
  return (
    <div className="table-responsive" style={{ maxHeight: 320 }}>
      <table className="table table-sm align-middle mb-0" style={{ fontSize: 13 }}>
        <thead><tr><th>#</th><th>Month</th><th className="text-end">Principal</th><th className="text-end">Interest</th><th className="text-end">EMI</th><th>Status</th>{renderAction && <th aria-label="Action" />}</tr></thead>
        <tbody>
          {schedule.map((i) => {
            const status = INSTALLMENT_STATUS[i.status] || INSTALLMENT_STATUS.PENDING;
            return (
              <tr key={i.id || i.sequenceNo} style={{ opacity: i.status === 'DEFERRED' ? 0.7 : 1 }}>
                <td>{i.sequenceNo}</td>
                <td>{monthLabel(i.dueMonth)}{i.note && <div style={{ fontSize: 11, color: 'var(--hz-text-muted)' }}>{i.note}</div>}</td>
                <td className="text-end">{rupees(i.principal)}</td>
                <td className="text-end">{rupees(i.interest)}</td>
                <td className="text-end"><strong>{rupees(i.amount)}</strong></td>
                <td><Badge variant={status.variant}>{status.label}</Badge></td>
                {renderAction && <td className="text-end">{renderAction(i)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Live EMI preview for the terms being typed (debounced). */
export function EmiPreview({ amount, months, rate, firstMonth }) {
  const [terms, setTerms] = useState(null);
  useEffect(() => {
    const t = setTimeout(() => setTerms(Number(amount) > 0 && Number(months) > 0 ? { amount, months, rate, firstMonth } : null), 350);
    return () => clearTimeout(t);
  }, [amount, months, rate, firstMonth]);
  const { data, isError } = useQuery({
    queryKey: ['loan-preview', terms],
    queryFn: () => loansApi.preview(terms.amount, terms.months, terms.rate, terms.firstMonth),
    enabled: !!terms,
    retry: false,
  });
  if (!terms || isError || !data) return null;
  return (
    <div className="d-flex gap-4 flex-wrap p-3" style={{ background: 'var(--hz-primary-50)', borderRadius: 12 }}>
      <div><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>Monthly deduction</div><div style={{ fontSize: 20, fontWeight: 800 }}>{rupees(data.emi)}</div></div>
      <div><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>Total interest</div><div style={{ fontSize: 20, fontWeight: 800 }}>{rupees(data.totalInterest)}</div></div>
      <div><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>Total repayable</div><div style={{ fontSize: 20, fontWeight: 800 }}>{rupees(data.totalPayable)}</div></div>
      <div className="align-self-end" style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>
        {monthLabel(data.schedule[0]?.dueMonth)} – {monthLabel(data.schedule[data.schedule.length - 1]?.dueMonth)}
      </div>
    </div>
  );
}
