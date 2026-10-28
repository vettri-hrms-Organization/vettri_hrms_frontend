import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { salaryStructuresApi } from '../../../api/endpoints/salary';
import Button from '../../../components/ui/Button';
import Dialog from '../../../components/ui/Dialog';
import FormField from '../../../components/ui/FormField';
import ErrorBanner from '../../../components/ui/ErrorBanner';
import { useToast } from '../../../components/ui/Toast';
import { formatCurrency } from '../../../utils/formatCurrency';
import { toISTDateInputValue } from '../../../utils/formatDateTime';
import SalaryComponentsFields, { EMPTY_COMPONENTS, STATUTORY_KEYS, computeTotals } from './SalaryComponentsFields';

/**
 * Defines a new salary structure for an employee, or revises an existing
 * one. A revision is submitted as a brand-new structure (see
 * SalaryStructureService.upsert on the backend) - it never edits history,
 * so past payroll runs stay exactly as they were.
 *
 * `employee` only needs { employeeId | id, employeeName | fullName,
 * employeeCode? } - the modal fetches the current structure itself so
 * callers (list, details, structure pages) don't each need to know it.
 */
export default function AssignSalaryStructureModal({ employee, onClose }) {
  const employeeId = employee.employeeId ?? employee.id;
  const queryClient = useQueryClient();
  const toast = useToast();
  const [effectiveFrom, setEffectiveFrom] = useState(toISTDateInputValue());
  const [components, setComponents] = useState(EMPTY_COMPONENTS);
  const [notes, setNotes] = useState('');
  // New structures default to auto-calculated PF/ESI/PT/TDS; existing ones keep whatever they had.
  const [autoStatutory, setAutoStatutory] = useState(true);
  const [error, setError] = useState(null);
  const [touched, setTouched] = useState(false);

  const { data: currentStructure, isLoading: loadingCurrent } = useQuery({
    queryKey: ['salary-structure-current', employeeId],
    queryFn: () => salaryStructuresApi.getCurrent(employeeId),
    enabled: !!employeeId,
  });

  useEffect(() => {
    if (!touched && currentStructure?.components) {
      setComponents({ ...currentStructure.components });
      setNotes(currentStructure.notes || '');
      setAutoStatutory(!!currentStructure.autoStatutory);
    }
  }, [currentStructure, touched]);

  const totals = computeTotals(components, autoStatutory);

  const upsert = useMutation({
    mutationFn: salaryStructuresApi.upsert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-employees'] });
      queryClient.invalidateQueries({ queryKey: ['salary-structure-current', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['salary-employee-detail', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['salary-dashboard-summary'] });
      toast.success(`Salary structure saved for ${employee.employeeName ?? employee.fullName}`);
      onClose(true);
    },
    onError: (err) => setError(err.response?.data?.message || 'Could not save the salary structure'),
  });

  function set(key, value) {
    setTouched(true);
    setComponents((c) => ({ ...c, [key]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!components.basicSalary || Number(components.basicSalary) <= 0) {
      setError('Basic salary must be greater than zero');
      return;
    }
    const payload = { ...components };
    if (autoStatutory) STATUTORY_KEYS.forEach((key) => { payload[key] = 0; });
    upsert.mutate({
      employeeId,
      effectiveFrom,
      notes,
      autoStatutory,
      components: payload,
    });
  }

  const employeeName = employee.employeeName ?? employee.fullName;
  const employeeCode = employee.employeeCode;

  return (
    <Dialog
      open
      onClose={() => onClose(false)}
      title={currentStructure ? 'Revise Salary Structure' : loadingCurrent ? 'Salary Structure' : 'Define Salary Structure'}
      description={`${employeeName}${employeeCode ? ` · ${employeeCode}` : ''}`}
      size="xl"
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <ErrorBanner>{error}</ErrorBanner>
        )}

        {loadingCurrent ? (
          <div className="py-5 text-center" style={{ color: 'var(--hz-text-muted)', fontSize: 13 }}>
            Loading current structure…
          </div>
        ) : (
          <>
            <div className="row g-3 mb-3">
              <FormField col={6} label="Effective From" type="date" required value={effectiveFrom} onChange={setEffectiveFrom} />
              <FormField col={6} label="Notes (optional)" placeholder="e.g. Annual appraisal revision" value={notes} onChange={setNotes} />
            </div>

            <div
              className="d-flex align-items-start gap-2 mb-3 p-3"
              style={{ background: 'var(--hz-gray-50)', border: '1px solid var(--hz-border)', borderRadius: 'var(--hz-radius-lg)' }}
            >
              <input
                id="auto-statutory"
                type="checkbox"
                className="form-check-input mt-1"
                checked={autoStatutory}
                onChange={(e) => { setTouched(true); setAutoStatutory(e.target.checked); }}
              />
              <label htmlFor="auto-statutory" style={{ fontSize: 13, cursor: 'pointer' }}>
                <strong>Auto-calculate statutory deductions</strong>
                <span className="d-block" style={{ color: 'var(--hz-text-muted)' }}>
                  PF, ESI, professional tax and TDS are computed each payroll run from the company&apos;s payroll settings,
                  paid days and the employee&apos;s tax declaration. Turn off to enter fixed amounts.
                </span>
              </label>
            </div>

            <SalaryComponentsFields components={components} onChange={set} autoStatutory={autoStatutory} />

            <div
              className="d-flex align-items-center justify-content-between mt-4 p-3"
              style={{ background: 'var(--hz-gradient-surface)', border: '1px solid var(--hz-border)', borderRadius: 'var(--hz-radius-lg)' }}
            >
              <TotalTile label="Gross Salary" value={totals.gross} />
              <TotalTile label="Total Deductions" value={totals.deductions} muted />
              <TotalTile label="Net Salary" value={totals.net} emphasize />
            </div>

            <div className="d-flex justify-content-end gap-2 mt-4">
              <Button variant="secondary" type="button" onClick={() => onClose(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={upsert.isPending}>
                {currentStructure ? 'Save Revision' : 'Save Structure'}
              </Button>
            </div>
          </>
        )}
      </form>
    </Dialog>
  );
}

function TotalTile({ label, value, muted, emphasize }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--hz-text-muted)', fontWeight: 600, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
      <p
        style={{
          fontSize: emphasize ? 'var(--hz-text-xl)' : 'var(--hz-text-lg)',
          fontWeight: 700,
          margin: 0,
          color: muted ? 'var(--hz-danger-600)' : emphasize ? 'var(--hz-primary-700)' : 'var(--hz-text-primary)',
        }}
      >
        {formatCurrency(value)}
      </p>
    </div>
  );
}
