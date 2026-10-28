const EARNING_FIELDS = [
  { key: 'basicSalary', label: 'Basic Salary' },
  { key: 'hra', label: 'HRA' },
  { key: 'specialAllowance', label: 'Special Allowance' },
  { key: 'medicalAllowance', label: 'Medical Allowance' },
  { key: 'travelAllowance', label: 'Travel Allowance' },
  { key: 'bonus', label: 'Bonus' },
  { key: 'incentives', label: 'Incentives' },
  { key: 'overtime', label: 'Overtime' },
];

const DEDUCTION_FIELDS = [
  { key: 'pf', label: 'PF' },
  { key: 'esi', label: 'ESI' },
  { key: 'professionalTax', label: 'Professional Tax' },
  { key: 'tds', label: 'TDS' },
  { key: 'otherDeductions', label: 'Other Deductions' },
];

/** Deductions payroll computes itself when a structure has "auto-calculate statutory deductions" on. */
export const STATUTORY_KEYS = ['pf', 'esi', 'professionalTax', 'tds'];

function AmountField({ label, value, onChange, disabled, hint }) {
  return (
    <div className="col-6 col-md-4">
      <label className="hz-form-label" style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 500 }}>
        {label}
        {hint && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--hz-text-muted)', fontWeight: 400 }}>{hint}</span>}
      </label>
      <div className="input-group">
        <span className="input-group-text" style={{ background: 'var(--hz-gray-50)', color: 'var(--hz-text-muted)', fontSize: 13 }}>
          ₹
        </span>
        <input
          type="number"
          min="0"
          step="0.01"
          className="form-control"
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      </div>
    </div>
  );
}

/**
 * Renders the 13 earning/deduction fields and calls onChange(key, value) as they're edited. `components` is a flat { key: number } object.
 * With `autoStatutory`, PF/ESI/PT/TDS are read-only: payroll calculates them from the company's statutory settings.
 */
export default function SalaryComponentsFields({ components, onChange, autoStatutory = false }) {
  return (
    <div className="d-flex flex-column gap-4">
      <div>
        <p className="text-uppercase mb-2" style={{ fontSize: 11, letterSpacing: '0.06em', color: 'var(--hz-text-muted)', fontWeight: 600 }}>
          Earnings
        </p>
        <div className="row g-3">
          {EARNING_FIELDS.map((f) => (
            <AmountField key={f.key} label={f.label} value={components[f.key] ?? 0} onChange={(v) => onChange(f.key, v)} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-uppercase mb-2" style={{ fontSize: 11, letterSpacing: '0.06em', color: 'var(--hz-text-muted)', fontWeight: 600 }}>
          Deductions
        </p>
        <div className="row g-3">
          {DEDUCTION_FIELDS.map((f) => {
            const auto = autoStatutory && STATUTORY_KEYS.includes(f.key);
            return (
              <AmountField
                key={f.key}
                label={f.label}
                value={auto ? 0 : components[f.key] ?? 0}
                disabled={auto}
                hint={auto ? '(auto at payroll)' : undefined}
                onChange={(v) => onChange(f.key, v)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function computeTotals(components, autoStatutory = false) {
  const gross = EARNING_FIELDS.reduce((sum, f) => sum + Number(components[f.key] || 0), 0);
  const deductions = DEDUCTION_FIELDS
    .filter((f) => !(autoStatutory && STATUTORY_KEYS.includes(f.key)))
    .reduce((sum, f) => sum + Number(components[f.key] || 0), 0);
  return { gross, deductions, net: gross - deductions };
}

export const EMPTY_COMPONENTS = Object.fromEntries([...EARNING_FIELDS, ...DEDUCTION_FIELDS].map((f) => [f.key, 0]));
