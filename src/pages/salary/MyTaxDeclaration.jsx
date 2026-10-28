import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import { currentFinancialYear, financialYearLabel } from '../../api/endpoints/salary';
import { useAuth } from '../../hooks/useAuth';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import PageHeader from '../../components/ui/PageHeader';
import TaxDeclarationForm from './components/TaxDeclarationForm';

/** Employee self-service: choose the tax regime and declare investments for the current or next FY. */
export default function MyTaxDeclaration() {
  const { user } = useAuth();
  const thisFy = currentFinancialYear();
  const [fy, setFy] = useState(thisFy);

  if (!user?.employeeId) {
    return (
      <Card>
        <EmptyState icon={Receipt} title="No linked employee record" description="This login isn't linked to an employee profile." />
      </Card>
    );
  }

  return (
    <div className="hz-module-page hz-module-page--payroll d-flex flex-column gap-4">
      <PageHeader
        eyebrow="My finances"
        title="Tax declaration"
        description="Choose your income tax regime and declare investments so the right TDS is deducted from your salary"
        actions={(
          <div className="d-flex align-items-center gap-2">
            <select className="form-select" style={{ width: 'auto' }} value={fy} onChange={(e) => setFy(Number(e.target.value))} aria-label="Financial year">
              {[thisFy, thisFy + 1].map((year) => (
                <option key={year} value={year}>{financialYearLabel(year)}</option>
              ))}
            </select>
            <Link to="/my-payslip" className="btn btn-outline-secondary">My pay &amp; Form 16</Link>
          </div>
        )}
      />
      <Card>
        <TaxDeclarationForm key={fy} fy={fy} />
      </Card>
      <p style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>
        Keep proofs (rent receipts, premium receipts, investment statements) ready - HR may ask for them before the financial year closes.
        Estimates use your current salary structure for the rest of the year and exclude income from other employers.
      </p>
    </div>
  );
}
