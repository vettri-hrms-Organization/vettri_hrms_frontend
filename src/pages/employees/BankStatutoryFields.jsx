import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Landmark, Pencil } from 'lucide-react';
import { employeesApi } from '../../api/endpoints/employees';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Dialog from '../../components/ui/Dialog';
import FormField from '../../components/ui/FormField';
import ErrorBanner from '../../components/ui/ErrorBanner';

/**
 * Salary bank account + statutory identifiers (PAN, UAN for PF, ESI).
 * Shared by the onboarding modal and the profile's "Bank & statutory" card.
 * The backend re-validates the same formats and only returns full values to
 * the employee themself or SALARY_VIEW / EMPLOYEE_MANAGE holders
 * (statutoryVisible); everyone else sees the masked account number only.
 */
export const EMPTY_BANK_STATUTORY = {
  bankName: '',
  bankAccountNumber: '',
  bankIfsc: '',
  panNumber: '',
  uanNumber: '',
  esiNumber: '',
};

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** Same rules as EmployeeService#applyBankAndStatutoryFields; returns a message or null. */
export function validateBankStatutory(form) {
  const ifsc = (form.bankIfsc || '').trim().toUpperCase();
  const pan = (form.panNumber || '').trim().toUpperCase();
  const account = (form.bankAccountNumber || '').replace(/\s/g, '');
  if (account && !/^[0-9A-Za-z]{6,34}$/.test(account)) return 'Bank account number must be 6-34 letters or digits';
  if (ifsc && !IFSC_PATTERN.test(ifsc)) return 'IFSC must be 11 characters: 4 letters, 0, then 6 letters/digits (e.g. HDFC0001234)';
  if (pan && !PAN_PATTERN.test(pan)) return 'PAN must be 10 characters in the format ABCDE1234F';
  if (form.uanNumber && !/^[0-9]{12}$/.test(form.uanNumber.trim())) return 'UAN must be 12 digits';
  if (form.esiNumber && !/^[0-9]{10,17}$/.test(form.esiNumber.trim())) return 'ESI number must be 10-17 digits';
  return null;
}

/** Upper-cases the coded fields so "hdfc0001234" is accepted the way it's printed on a cheque. */
export function normalizeBankStatutory(form) {
  return {
    bankName: form.bankName?.trim() ?? '',
    bankAccountNumber: (form.bankAccountNumber || '').replace(/\s/g, ''),
    bankIfsc: (form.bankIfsc || '').trim().toUpperCase(),
    panNumber: (form.panNumber || '').trim().toUpperCase(),
    uanNumber: (form.uanNumber || '').trim(),
    esiNumber: (form.esiNumber || '').trim(),
  };
}

export function BankStatutoryFields({ form, set }) {
  return (
    <div className="row g-3 mb-1">
      <FormField col={6} label="Bank Name" value={form.bankName} onChange={(v) => set('bankName', v)} />
      <FormField col={6} label="Account Number" value={form.bankAccountNumber} onChange={(v) => set('bankAccountNumber', v)} autoComplete="off" />
      <FormField col={6} label="IFSC" value={form.bankIfsc} onChange={(v) => set('bankIfsc', v.toUpperCase())} placeholder="HDFC0001234" maxLength={11} />
      <FormField col={6} label="PAN" value={form.panNumber} onChange={(v) => set('panNumber', v.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} />
      <FormField col={6} label="UAN (PF)" value={form.uanNumber} onChange={(v) => set('uanNumber', v)} hint="12-digit EPFO Universal Account Number" maxLength={12} />
      <FormField col={6} label="ESI Number" value={form.esiNumber} onChange={(v) => set('esiNumber', v)} maxLength={17} />
    </div>
  );
}

/** Profile card; the Edit button only shows for EMPLOYEE_MANAGE holders who can see the full values. */
export function BankStatutoryCard({ employee, canEdit, InfoRow }) {
  const [editing, setEditing] = useState(false);
  const account = employee.statutoryVisible ? employee.bankAccountNumber : employee.bankAccountNumberMasked;
  return (
    <Card
      title="Bank & statutory"
      subtitle={employee.statutoryVisible ? 'Used for salary transfer and statutory filings' : 'Restricted - account number is masked'}
      actions={
        canEdit && employee.statutoryVisible ? (
          <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
            Edit
          </Button>
        ) : null
      }
    >
      <InfoRow icon={Landmark} label="Bank" value={employee.bankName} />
      <InfoRow label="Account Number" value={account} />
      {employee.statutoryVisible && (
        <>
          <InfoRow label="IFSC" value={employee.bankIfsc} />
          <InfoRow label="PAN" value={employee.panNumber} />
          <InfoRow label="UAN (PF)" value={employee.uanNumber} />
          <InfoRow label="ESI Number" value={employee.esiNumber} />
        </>
      )}
      {editing && <BankStatutoryDialog employee={employee} onClose={() => setEditing(false)} />}
    </Card>
  );
}

/**
 * PUT /api/employees/{id} takes the whole profile, so the rest of it is sent
 * back unchanged from the loaded detail alongside the edited bank fields.
 */
function BankStatutoryDialog({ employee, onClose }) {
  const queryClient = useQueryClient();
  const initial = {
    bankName: employee.bankName || '',
    bankAccountNumber: employee.bankAccountNumber || '',
    bankIfsc: employee.bankIfsc || '',
    panNumber: employee.panNumber || '',
    uanNumber: employee.uanNumber || '',
    esiNumber: employee.esiNumber || '',
  };
  const [form, setForm] = useState(initial);
  const [error, setError] = useState(null);

  const save = useMutation({
    mutationFn: (bank) =>
      employeesApi.update(employee.id, {
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone,
        dateOfBirth: employee.dateOfBirth || null,
        gender: employee.gender,
        dateOfJoining: employee.dateOfJoining,
        employmentType: employee.employmentType,
        departmentId: employee.departmentId ?? null,
        designationId: employee.designationId ?? null,
        teamId: employee.teamId ?? null,
        reportingManagerId: employee.reportingManagerId ?? null,
        address: employee.address,
        emergencyContactName: employee.emergencyContactName,
        emergencyContactPhone: employee.emergencyContactPhone,
        ...bank,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee'] });
      onClose();
    },
    onError: (err) => setError(err.response?.data?.message || 'Could not save bank details'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    const message = validateBankStatutory(form);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    save.mutate(normalizeBankStatutory(form));
  }

  return (
    <Dialog open onClose={onClose} title="Bank & statutory details" description={employee.fullName} size="lg" hasUnsavedChanges={JSON.stringify(form) !== JSON.stringify(initial) && !save.isSuccess}>
      <form onSubmit={handleSubmit}>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <BankStatutoryFields form={form} set={(field, value) => setForm((f) => ({ ...f, [field]: value }))} />
        <div className="d-flex justify-content-end gap-2 mt-4">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
