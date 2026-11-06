import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, CalendarCheck2, UserRound, WalletCards } from 'lucide-react';
import Button from '../../components/ui/Button';
import { employeesApi } from '../../api/endpoints/employees';
import { departmentsApi, designationsApi } from '../../api/endpoints/organization';
import { useAuth } from '../../hooks/useAuth';
import { istToday } from '../attendance/shiftUtils';
import './my-profile.css';

/**
 * A workspace admin signs up with a login but no employee record, so My Profile
 * has nothing to show. Creating a record with the login's email links the two
 * (EmployeeService.createWithCode), and the admin then gets their own profile,
 * attendance, leave and payslips like everyone else.
 *
 * The record is created automatically from the sign-up details the first time
 * the page opens; the form only shows when that is not possible or fails.
 */
export default function CreateOwnProfile() {
  const { user, hasPermission, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [first, ...rest] = String(user?.fullName || '').trim().split(/\s+/);
  const [form, setForm] = useState({
    firstName: first || '',
    lastName: rest.join(' '),
    phone: '',
    dateOfJoining: istToday(),
    departmentId: '',
    designationId: '',
  });
  const [error, setError] = useState(null);
  const canCreate = hasPermission('EMPLOYEE_CREATE');

  const departments = useQuery({ queryKey: ['departments'], queryFn: departmentsApi.list, enabled: canCreate });
  const designations = useQuery({ queryKey: ['designations'], queryFn: designationsApi.list, enabled: canCreate });

  const create = useMutation({
    mutationFn: () => employeesApi.create({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: user.email,
      phone: form.phone.trim() || null,
      dateOfJoining: form.dateOfJoining,
      employmentType: 'FULL_TIME',
      departmentId: form.departmentId ? Number(form.departmentId) : null,
      designationId: form.designationId ? Number(form.designationId) : null,
    }),
    onSuccess: async () => {
      const me = await refreshUser();
      if (!me?.employeeId) setError('Your profile was created but isn’t linked to this login yet. Sign out and back in, or contact Vettri support.');
      queryClient.invalidateQueries({ queryKey: ['employees-paged'] });
      queryClient.invalidateQueries({ queryKey: ['home-setup'] });
    },
    onError: (err) => setError(err.response?.data?.message || 'Couldn’t create your profile. Please try again.'),
  });

  const autoTried = useRef(false);
  // Decided from the sign-up details only, so typing in the fallback form never submits it.
  const canAutoCreate = canCreate && !!user?.email && !!first && rest.length > 0;
  useEffect(() => {
    if (!canAutoCreate || autoTried.current) return;
    autoTried.current = true;
    create.mutate();
  }, [canAutoCreate]); // eslint-disable-line react-hooks/exhaustive-deps

  function set(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    setError(null);
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('Enter your first and last name.');
      return;
    }
    create.mutate();
  }

  if (create.isPending || (canAutoCreate && !autoTried.current) || (create.isSuccess && !error)) {
    return (
      <section className="hz-myprofile-setup hz-myprofile-setup--busy" aria-busy="true">
        <div className="hz-myprofile-setup__intro">
          <span className="hz-myprofile-setup__badge" aria-hidden="true"><UserRound size={22} /></span>
          <h1>Setting up your profile</h1>
          <p className="mb-0">Creating your employee profile from your company account details…</p>
        </div>
      </section>
    );
  }

  return (
    <section className="hz-myprofile-setup" aria-labelledby="hz-myprofile-setup-title">
      <div className="hz-myprofile-setup__intro">
        <span className="hz-myprofile-setup__badge" aria-hidden="true"><UserRound size={22} /></span>
        <h1 id="hz-myprofile-setup-title">Create your employee profile</h1>
        <p>
          Your login isn’t linked to an employee record yet. Add a few details and you’ll get your own profile,
          attendance, leave balance and payslips, just like your team.
        </p>
        <ul className="hz-myprofile-setup__perks">
          <li><BadgeCheck size={16} aria-hidden="true" /> Appears in the employee directory and org chart</li>
          <li><CalendarCheck2 size={16} aria-hidden="true" /> Check in, apply for leave and see your balance</li>
          <li><WalletCards size={16} aria-hidden="true" /> Receive payslips when payroll runs</li>
        </ul>
      </div>

      {canCreate ? (
        <form className="hz-myprofile-setup__form" onSubmit={submit} noValidate>
          <div className="row g-3">
            <div className="col-12 col-sm-6">
              <label className="form-label" htmlFor="own-first">First name *</label>
              <input id="own-first" className="form-control" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} maxLength={100} required />
            </div>
            <div className="col-12 col-sm-6">
              <label className="form-label" htmlFor="own-last">Last name *</label>
              <input id="own-last" className="form-control" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} maxLength={100} required />
            </div>
            <div className="col-12 col-sm-6">
              <label className="form-label" htmlFor="own-email">Work email</label>
              <input id="own-email" className="form-control" value={user?.email || ''} readOnly aria-describedby="own-email-help" />
              <small id="own-email-help" className="text-muted-hz">Your sign-in email, so the profile links to your login.</small>
            </div>
            <div className="col-12 col-sm-6">
              <label className="form-label" htmlFor="own-phone">Phone</label>
              <input id="own-phone" className="form-control" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={20} placeholder="Optional" />
            </div>
            <div className="col-12 col-sm-6">
              <label className="form-label" htmlFor="own-doj">Date of joining *</label>
              <input id="own-doj" className="form-control" type="date" value={form.dateOfJoining} onChange={(e) => set('dateOfJoining', e.target.value)} required />
            </div>
            <div className="col-12 col-sm-6">
              <label className="form-label" htmlFor="own-dept">Department</label>
              <select id="own-dept" className="form-select" value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
                <option value="">Not set</option>
                {(departments.data || []).filter((d) => d.active !== false).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="own-desig">Designation</label>
              <select id="own-desig" className="form-select" value={form.designationId} onChange={(e) => set('designationId', e.target.value)}>
                <option value="">Not set</option>
                {(designations.data || []).filter((d) => d.active !== false).map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>
          </div>
          {error && <div className="alert alert-danger mt-3 mb-0" role="alert">{error}</div>}
          <div className="d-flex justify-content-end mt-4">
            <Button type="submit" loading={create.isPending} disabled={!form.dateOfJoining}>Create my profile</Button>
          </div>
        </form>
      ) : (
        <div className="hz-myprofile-setup__form">
          <p className="mb-0">Ask your HR team to add you as an employee using your sign-in email <strong>{user?.email}</strong>. Your profile appears here once they do.</p>
        </div>
      )}
    </section>
  );
}
