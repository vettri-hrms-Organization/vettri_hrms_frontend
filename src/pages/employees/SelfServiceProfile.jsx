import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase, Camera, Clock, GraduationCap, Heart, Mail, MapPin, Pencil, Phone, Plus, ShieldCheck, Trash2, User, Users,
} from 'lucide-react';
import { profileApi } from '../../api/endpoints/profile';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Dialog from '../../components/ui/Dialog';
import FormField from '../../components/ui/FormField';
import ErrorBanner from '../../components/ui/ErrorBanner';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/ConfirmDialog';

/*
 * Keka-style self-service profile. Employees keep contact, personal, emergency, family, education and
 * experience details current themselves; legal name, date of birth, gender and bank details go to HR for
 * approval. HR editing someone else's record saves everything directly (the backend decides).
 */

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const MARITAL = { SINGLE: 'Single', MARRIED: 'Married', DIVORCED: 'Divorced', WIDOWED: 'Widowed', SEPARATED: 'Separated' };
const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
const RELATIONS = ['Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Brother', 'Sister', 'Father-in-law', 'Mother-in-law', 'Other'];
const SECTION_LABEL = { IDENTITY: 'Personal identity', BANK: 'Bank & tax details' };

const errorText = (error, fallback) => error?.response?.data?.message || fallback;
const formatDate = (value) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null);
const formatMonth = (value) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : null);
const blankToNull = (form) => Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));

function useProfile(employeeId) {
  return useQuery({ queryKey: ['profile', String(employeeId)], queryFn: () => profileApi.get(employeeId) });
}

/** Mutations return the refreshed profile; store it and refresh the employee header/detail too. */
function useProfileMutation(employeeId, mutationFn, successMessage) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn,
    onSuccess: (profile) => {
      if (profile) queryClient.setQueryData(['profile', String(employeeId)], profile);
      queryClient.invalidateQueries({ queryKey: ['employee'] });
      if (successMessage) toast.success(typeof successMessage === 'function' ? successMessage(profile) : successMessage);
    },
  });
}

function Row({ icon: Icon, label, value, hint }) {
  return (
    <div className="d-flex align-items-start gap-2 py-2" style={{ borderBottom: '1px solid var(--hz-divider, var(--hz-border))' }}>
      {Icon ? <Icon size={15} aria-hidden="true" style={{ color: 'var(--hz-text-muted)', marginTop: 3, flexShrink: 0 }} /> : <span style={{ width: 15, flexShrink: 0 }} />}
      <div className="flex-grow-1 min-w-0">
        <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{label}</div>
        <div style={{ fontSize: 'var(--hz-text-sm)', color: value ? 'var(--hz-text-primary)' : 'var(--hz-text-muted)', fontWeight: value ? 600 : 400, overflowWrap: 'anywhere' }}>
          {value || 'Not added'}
        </div>
        {hint}
      </div>
    </div>
  );
}

function EditButton({ onClick, label = 'Edit' }) {
  return <Button size="sm" variant="secondary" icon={Pencil} onClick={onClick}>{label}</Button>;
}

// ---------------------------------------------------------------- main sections

export function ProfileSections({ employee, isOwnRecord, canManage }) {
  const { data: profile, isLoading, isError } = useProfile(employee.id);
  const [dialog, setDialog] = useState(null);
  const canEdit = isOwnRecord || canManage;
  const editsNeedApproval = !(canManage && !isOwnRecord);

  if (isLoading) return <div className="col-12"><Card><SkeletonText lines={4} /></Card></div>;
  if (isError || !profile) return null;

  const pending = profile.changeRequests.filter((r) => r.status === 'PENDING');
  const pendingIdentity = pending.some((r) => r.section === 'IDENTITY');
  const lastDecision = profile.changeRequests.find((r) => r.status === 'REJECTED' || r.status === 'APPROVED');

  return (
    <>
      {(pending.length > 0 || (isOwnRecord && lastDecision?.status === 'REJECTED')) && (
        <div className="col-12">
          <ChangeRequestStatus employeeId={employee.id} pending={pending} lastDecision={isOwnRecord ? lastDecision : null} canWithdraw={isOwnRecord} />
        </div>
      )}

      <div className="col-12 col-lg-6">
        <Card title="Contact" subtitle="How the company reaches you" actions={canEdit && <EditButton onClick={() => setDialog('contact')} />}>
          <Row icon={Mail} label="Work email" value={profile.workEmail} />
          <Row icon={Phone} label="Mobile" value={profile.phone} />
          <Row icon={Mail} label="Personal email" value={profile.personalEmail} />
          <Row icon={MapPin} label="Current address" value={profile.address} />
          <Row icon={MapPin} label="Permanent address" value={profile.permanentAddress} />
        </Card>
      </div>

      <div className="col-12 col-lg-6">
        <Card
          title="Personal"
          subtitle={editsNeedApproval ? 'Name, date of birth and gender change after HR approval' : 'Identity details'}
          actions={canEdit && <EditButton onClick={() => setDialog('personal')} />}
        >
          <Row icon={User} label="Legal name" value={`${profile.firstName || ''} ${profile.lastName || ''}`.trim()} hint={pendingIdentity && <Badge variant="warning">Change waiting for HR</Badge>} />
          <Row label="Date of birth" value={formatDate(profile.dateOfBirth)} />
          <Row label="Gender" value={profile.gender} />
          <Row icon={Heart} label="Blood group" value={profile.bloodGroup} />
          <Row label="Marital status" value={MARITAL[profile.maritalStatus] || profile.maritalStatus} />
        </Card>
      </div>

      <div className="col-12 col-lg-6">
        <Card title="Emergency contact" subtitle="Who we call if something happens at work" actions={canEdit && <EditButton onClick={() => setDialog('emergency')} />}>
          <Row icon={User} label="Name" value={profile.emergencyContactName} />
          <Row label="Relation" value={profile.emergencyContactRelation} />
          <Row icon={Phone} label="Phone" value={profile.emergencyContactPhone} />
        </Card>
      </div>

      <div className="col-12 col-lg-6">
        <Card title="About" subtitle="A short introduction your colleagues see" actions={canEdit && <EditButton onClick={() => setDialog('about')} />}>
          <p className="mb-0" style={{ whiteSpace: 'pre-line', fontSize: 'var(--hz-text-sm)', color: profile.aboutMe ? 'var(--hz-text-primary)' : 'var(--hz-text-muted)' }}>
            {profile.aboutMe || (isOwnRecord ? 'Tell your team a little about yourself - your role, what you work on, or what you enjoy.' : 'Nothing added yet.')}
          </p>
        </Card>
      </div>

      <div className="col-12">
        <EntryListCard employeeId={employee.id} kind="family" canEdit={canEdit} items={profile.family} />
      </div>
      <div className="col-12 col-lg-6">
        <EntryListCard employeeId={employee.id} kind="education" canEdit={canEdit} items={profile.education} />
      </div>
      <div className="col-12 col-lg-6">
        <EntryListCard employeeId={employee.id} kind="experience" canEdit={canEdit} items={profile.experience} />
      </div>

      {dialog === 'contact' && <ContactDialog profile={profile} onClose={() => setDialog(null)} />}
      {dialog === 'personal' && <PersonalDialog profile={profile} needsApproval={editsNeedApproval} onClose={() => setDialog(null)} />}
      {dialog === 'emergency' && <EmergencyDialog profile={profile} onClose={() => setDialog(null)} />}
      {dialog === 'about' && <AboutDialog profile={profile} onClose={() => setDialog(null)} />}
    </>
  );
}

function ChangeRequestStatus({ employeeId, pending, lastDecision, canWithdraw }) {
  const withdraw = useProfileMutation(employeeId, (id) => profileApi.withdraw(employeeId, id), 'Request withdrawn.');
  return (
    <div className="d-flex flex-column gap-2">
      {pending.map((r) => (
        <div key={r.id} className="d-flex align-items-center gap-3 flex-wrap p-3" style={{ borderRadius: 14, border: '1px solid var(--hz-warning-500)', background: 'var(--hz-warning-50)' }}>
          <Clock size={18} aria-hidden="true" style={{ color: 'var(--hz-warning-700)' }} />
          <div className="flex-grow-1 min-w-0">
            <div style={{ fontWeight: 700, color: 'var(--hz-text-primary)' }}>{SECTION_LABEL[r.section] || r.section} change is waiting for HR approval</div>
            <div style={{ fontSize: 13, color: 'var(--hz-text-secondary)' }}>
              {r.changes.map((c) => c.label).join(', ')} · requested {formatDate(r.requestedAt?.slice(0, 10))}
            </div>
          </div>
          {canWithdraw && <Button size="sm" variant="secondary" loading={withdraw.isPending} onClick={() => withdraw.mutate(r.id)}>Withdraw</Button>}
        </div>
      ))}
      {lastDecision?.status === 'REJECTED' && pending.length === 0 && (
        <div className="d-flex align-items-start gap-3 p-3" style={{ borderRadius: 14, border: '1px solid var(--hz-border)', background: 'var(--hz-danger-50)' }}>
          <ShieldCheck size={18} aria-hidden="true" style={{ color: 'var(--hz-danger-700)', marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 700, color: 'var(--hz-text-primary)' }}>Your {(SECTION_LABEL[lastDecision.section] || '').toLowerCase()} change was declined</div>
            <div style={{ fontSize: 13, color: 'var(--hz-text-secondary)' }}>{lastDecision.reviewNote || 'Contact HR for details.'}{lastDecision.reviewedByName ? ` - ${lastDecision.reviewedByName}` : ''}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- edit dialogs

function FormDialog({ title, description, onClose, onSubmit, saving, error, children, submitLabel = 'Save' }) {
  return (
    <Dialog open onClose={onClose} title={title} description={description} size="md"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="hz-profile-form" loading={saving}>{submitLabel}</Button>
        </>
      )}
    >
      <form id="hz-profile-form" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <div className="row g-3">{children}</div>
      </form>
    </Dialog>
  );
}

function useForm(initial) {
  const [form, setForm] = useState(initial);
  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  return [form, set, setForm];
}

function ContactDialog({ profile, onClose }) {
  const [form, set] = useForm({
    phone: profile.phone || '', personalEmail: profile.personalEmail || '',
    address: profile.address || '', permanentAddress: profile.permanentAddress || '',
  });
  const [same, setSame] = useState(!!profile.address && profile.address === profile.permanentAddress);
  const save = useProfileMutation(profile.employeeId, (body) => profileApi.updateDetails(profile.employeeId, body), 'Contact details saved.');
  const submit = () => save.mutate(blankToNull({ ...form, permanentAddress: same ? form.address : form.permanentAddress }), { onSuccess: onClose });
  return (
    <FormDialog title="Contact details" onClose={onClose} onSubmit={submit} saving={save.isPending} error={save.isError && errorText(save.error, 'Could not save your contact details.')}>
      <FormField col={6} label="Mobile" type="tel" value={form.phone} onChange={(v) => set('phone', v)} placeholder="+91 98765 43210" />
      <FormField col={6} label="Personal email" type="email" value={form.personalEmail} onChange={(v) => set('personalEmail', v)} />
      <FormField col={12} as="textarea" rows={2} label="Current address" value={form.address} onChange={(v) => set('address', v)} maxLength={300} />
      <div className="col-12">
        <label className="form-check d-inline-flex align-items-center gap-2" style={{ fontSize: 'var(--hz-text-sm)' }}>
          <input type="checkbox" className="form-check-input m-0" checked={same} onChange={(e) => setSame(e.target.checked)} />
          Permanent address is the same as current
        </label>
      </div>
      {!same && <FormField col={12} as="textarea" rows={2} label="Permanent address" value={form.permanentAddress} onChange={(v) => set('permanentAddress', v)} maxLength={300} />}
    </FormDialog>
  );
}

function PersonalDialog({ profile, needsApproval, onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const identity = { firstName: profile.firstName || '', lastName: profile.lastName || '', dateOfBirth: profile.dateOfBirth || '', gender: profile.gender || '' };
  const [form, set] = useForm({ ...identity, bloodGroup: profile.bloodGroup || '', maritalStatus: profile.maritalStatus || '', reason: '' });
  const identityChanged = Object.keys(identity).filter((k) => (form[k] || '').trim() !== (identity[k] || ''));
  const save = useMutation({
    mutationFn: async () => {
      let result = await profileApi.updateDetails(profile.employeeId, { bloodGroup: form.bloodGroup, maritalStatus: form.maritalStatus });
      if (identityChanged.length) {
        const values = Object.fromEntries(identityChanged.map((k) => [k, form[k].trim()]));
        result = await profileApi.requestChange(profile.employeeId, 'IDENTITY', values, form.reason.trim() || null);
      }
      return result;
    },
    onSuccess: (result) => {
      queryClient.setQueryData(['profile', String(profile.employeeId)], result);
      queryClient.invalidateQueries({ queryKey: ['employee'] });
      toast.success(identityChanged.length && needsApproval ? 'Saved. Your name/date of birth change has been sent to HR for approval.' : 'Personal details saved.');
      onClose();
    },
  });
  return (
    <FormDialog title="Personal details" onClose={onClose} onSubmit={() => save.mutate()} saving={save.isPending}
      error={save.isError && errorText(save.error, 'Could not save your personal details.')}
      submitLabel={identityChanged.length && needsApproval ? 'Save & send for approval' : 'Save'}
    >
      <FormField col={6} as="select" label="Blood group" value={form.bloodGroup} onChange={(v) => set('bloodGroup', v)}>
        <option value="">Not specified</option>
        {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
      </FormField>
      <FormField col={6} as="select" label="Marital status" value={form.maritalStatus} onChange={(v) => set('maritalStatus', v)}>
        <option value="">Not specified</option>
        {Object.entries(MARITAL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </FormField>
      <div className="col-12">
        <div className="d-flex align-items-center gap-2 mt-2" style={{ fontWeight: 700, fontSize: 'var(--hz-text-sm)' }}>
          <ShieldCheck size={16} aria-hidden="true" style={{ color: 'var(--hz-primary-600)' }} /> Identity
          {needsApproval && <Badge variant="warning">Needs HR approval</Badge>}
        </div>
        {needsApproval && <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>These must match your official documents. HR checks the change before it appears on payslips and letters.</div>}
      </div>
      <FormField col={6} label="First name" value={form.firstName} onChange={(v) => set('firstName', v)} required maxLength={100} />
      <FormField col={6} label="Last name" value={form.lastName} onChange={(v) => set('lastName', v)} required maxLength={100} />
      <FormField col={6} type="date" label="Date of birth" value={form.dateOfBirth} onChange={(v) => set('dateOfBirth', v)} />
      <FormField col={6} as="select" label="Gender" value={GENDERS.includes(form.gender) || !form.gender ? form.gender : '__other'} onChange={(v) => set('gender', v === '__other' ? form.gender : v)}>
        <option value="">Not specified</option>
        {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
        {form.gender && !GENDERS.includes(form.gender) && <option value="__other">{form.gender}</option>}
      </FormField>
      {needsApproval && identityChanged.length > 0 && (
        <FormField col={12} label="Reason for the change (optional)" value={form.reason} onChange={(v) => set('reason', v)} placeholder="e.g. Name updated after marriage" maxLength={500} />
      )}
    </FormDialog>
  );
}

function EmergencyDialog({ profile, onClose }) {
  const [form, set] = useForm({
    emergencyContactName: profile.emergencyContactName || '',
    emergencyContactRelation: profile.emergencyContactRelation || '',
    emergencyContactPhone: profile.emergencyContactPhone || '',
  });
  const save = useProfileMutation(profile.employeeId, (body) => profileApi.updateDetails(profile.employeeId, body), 'Emergency contact saved.');
  return (
    <FormDialog title="Emergency contact" onClose={onClose} onSubmit={() => save.mutate(blankToNull(form), { onSuccess: onClose })} saving={save.isPending}
      error={save.isError && errorText(save.error, 'Could not save the emergency contact.')}>
      <FormField col={12} label="Name" value={form.emergencyContactName} onChange={(v) => set('emergencyContactName', v)} maxLength={150} />
      <FormField col={6} as="select" label="Relation" value={form.emergencyContactRelation} onChange={(v) => set('emergencyContactRelation', v)}>
        <option value="">Choose</option>
        {[...RELATIONS, 'Friend'].map((r) => <option key={r} value={r}>{r}</option>)}
      </FormField>
      <FormField col={6} type="tel" label="Phone" value={form.emergencyContactPhone} onChange={(v) => set('emergencyContactPhone', v)} />
    </FormDialog>
  );
}

function AboutDialog({ profile, onClose }) {
  const [form, set] = useForm({ aboutMe: profile.aboutMe || '' });
  const save = useProfileMutation(profile.employeeId, (body) => profileApi.updateDetails(profile.employeeId, body), 'Saved.');
  return (
    <FormDialog title="About" onClose={onClose} onSubmit={() => save.mutate(blankToNull(form), { onSuccess: onClose })} saving={save.isPending}
      error={save.isError && errorText(save.error, 'Could not save.')}>
      <FormField col={12} as="textarea" rows={5} label="About me" value={form.aboutMe} onChange={(v) => set('aboutMe', v)} maxLength={1000} hint={`${form.aboutMe.length}/1000`} />
    </FormDialog>
  );
}

// ---------------------------------------------------------------- family / education / experience

const ENTRY = {
  family: {
    title: 'Family', subtitle: 'Family members and dependants', icon: Users, noun: 'family member',
    empty: { name: '', relation: '', dateOfBirth: '', phone: '', dependent: false },
    primary: (e) => e.name,
    secondary: (e) => [e.relation, e.dateOfBirth && `Born ${formatDate(e.dateOfBirth)}`, e.phone].filter(Boolean).join(' · '),
    badge: (e) => e.dependent && <Badge variant="info">Dependant</Badge>,
  },
  education: {
    title: 'Education', subtitle: 'Degrees and certifications', icon: GraduationCap, noun: 'qualification',
    empty: { qualification: '', institution: '', specialization: '', startYear: '', endYear: '', grade: '' },
    primary: (e) => `${e.qualification}${e.specialization ? `, ${e.specialization}` : ''}`,
    secondary: (e) => [e.institution, [e.startYear, e.endYear].filter(Boolean).join(' – '), e.grade && `Grade ${e.grade}`].filter(Boolean).join(' · '),
  },
  experience: {
    title: 'Previous experience', subtitle: 'Work before joining', icon: Briefcase, noun: 'previous job',
    empty: { companyName: '', jobTitle: '', location: '', startDate: '', endDate: '', description: '' },
    primary: (e) => `${e.jobTitle} · ${e.companyName}`,
    secondary: (e) => [[formatMonth(e.startDate), formatMonth(e.endDate)].filter(Boolean).join(' – '), e.location].filter(Boolean).join(' · '),
  },
};

function EntryListCard({ employeeId, kind, canEdit, items }) {
  const config = ENTRY[kind];
  const Icon = config.icon;
  const [editing, setEditing] = useState(null);
  const confirm = useConfirm();
  const remove = useProfileMutation(employeeId, (id) => profileApi.deleteEntry(employeeId, kind, id), 'Removed.');
  const toast = useToast();
  const onRemove = async (entry) => {
    if (await confirm({ title: `Remove this ${config.noun}?`, description: config.primary(entry), confirmLabel: 'Remove' })) {
      remove.mutate(entry.id, { onError: (err) => toast.error(errorText(err, 'Could not remove it.')) });
    }
  };
  return (
    <Card title={config.title} subtitle={config.subtitle} actions={canEdit && <Button size="sm" variant="secondary" icon={Plus} onClick={() => setEditing({ ...config.empty })}>Add</Button>}>
      {items.length === 0 ? (
        <div className="d-flex align-items-center gap-2 py-2" style={{ fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-muted)' }}>
          <Icon size={16} aria-hidden="true" /> No {config.noun}s added yet.
        </div>
      ) : (
        <ul className="list-unstyled mb-0 d-flex flex-column gap-2">
          {items.map((entry) => (
            <li key={entry.id} className="d-flex align-items-center gap-3 p-2 pe-2" style={{ borderRadius: 12, border: '1px solid var(--hz-border)' }}>
              <span className="d-inline-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--hz-primary-50)', color: 'var(--hz-primary-600)' }}>
                <Icon size={17} aria-hidden="true" />
              </span>
              <div className="flex-grow-1 min-w-0">
                <div className="d-flex align-items-center gap-2 flex-wrap" style={{ fontWeight: 700, fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-primary)' }}>
                  {config.primary(entry)} {config.badge?.(entry)}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--hz-text-muted)' }}>{config.secondary(entry)}</div>
              </div>
              {canEdit && (
                <div className="d-flex gap-1 flex-shrink-0">
                  <button type="button" className="btn btn-sm btn-light border-0" aria-label={`Edit ${config.primary(entry)}`} onClick={() => setEditing({ ...config.empty, ...nullsToBlank(entry) })}><Pencil size={14} /></button>
                  <button type="button" className="btn btn-sm btn-light border-0" aria-label={`Remove ${config.primary(entry)}`} onClick={() => onRemove(entry)}><Trash2 size={14} /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && <EntryDialog employeeId={employeeId} kind={kind} entry={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

const nullsToBlank = (entry) => Object.fromEntries(Object.entries(entry).map(([k, v]) => [k, v ?? '']));

function EntryDialog({ employeeId, kind, entry, onClose }) {
  const config = ENTRY[kind];
  const [form, set] = useForm(entry);
  const save = useProfileMutation(employeeId, (body) => profileApi.saveEntry(employeeId, kind, body), entry.id ? 'Saved.' : 'Added.');
  const submit = () => {
    const body = blankToNull(form);
    for (const key of ['dateOfBirth', 'startDate', 'endDate']) if (key in body && !body[key]) body[key] = null;
    for (const key of ['startYear', 'endYear']) if (key in body) body[key] = body[key] ? Number(body[key]) : null;
    save.mutate(body, { onSuccess: onClose });
  };
  const thisYear = new Date().getFullYear();
  return (
    <FormDialog title={`${entry.id ? 'Edit' : 'Add'} ${config.noun}`} onClose={onClose} onSubmit={submit} saving={save.isPending}
      error={save.isError && errorText(save.error, 'Could not save.')}>
      {kind === 'family' && (
        <>
          <FormField col={6} label="Full name" value={form.name} onChange={(v) => set('name', v)} required maxLength={150} />
          <FormField col={6} as="select" label="Relation" value={form.relation} onChange={(v) => set('relation', v)} required>
            <option value="">Choose</option>
            {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </FormField>
          <FormField col={6} type="date" label="Date of birth" value={form.dateOfBirth} onChange={(v) => set('dateOfBirth', v)} />
          <FormField col={6} type="tel" label="Phone" value={form.phone} onChange={(v) => set('phone', v)} />
          <div className="col-12">
            <label className="form-check d-inline-flex align-items-center gap-2" style={{ fontSize: 'var(--hz-text-sm)' }}>
              <input type="checkbox" className="form-check-input m-0" checked={!!form.dependent} onChange={(e) => set('dependent', e.target.checked)} />
              Dependant (for insurance and benefits)
            </label>
          </div>
        </>
      )}
      {kind === 'education' && (
        <>
          <FormField col={6} label="Qualification" value={form.qualification} onChange={(v) => set('qualification', v)} required placeholder="e.g. B.E., MBA, 12th" maxLength={120} />
          <FormField col={6} label="Specialization" value={form.specialization} onChange={(v) => set('specialization', v)} placeholder="e.g. Computer Science" maxLength={150} />
          <FormField col={12} label="College / University / School" value={form.institution} onChange={(v) => set('institution', v)} required maxLength={200} />
          <FormField col={4} type="number" label="Start year" value={form.startYear} onChange={(v) => set('startYear', v)} min={1950} max={thisYear + 6} />
          <FormField col={4} type="number" label="End year" value={form.endYear} onChange={(v) => set('endYear', v)} min={1950} max={thisYear + 6} />
          <FormField col={4} label="Grade / %" value={form.grade} onChange={(v) => set('grade', v)} maxLength={30} />
        </>
      )}
      {kind === 'experience' && (
        <>
          <FormField col={6} label="Company" value={form.companyName} onChange={(v) => set('companyName', v)} required maxLength={200} />
          <FormField col={6} label="Job title" value={form.jobTitle} onChange={(v) => set('jobTitle', v)} required maxLength={150} />
          <FormField col={6} type="date" label="From" value={form.startDate} onChange={(v) => set('startDate', v)} />
          <FormField col={6} type="date" label="To" value={form.endDate} onChange={(v) => set('endDate', v)} />
          <FormField col={12} label="Location" value={form.location} onChange={(v) => set('location', v)} maxLength={150} />
          <FormField col={12} as="textarea" rows={3} label="What you did (optional)" value={form.description} onChange={(v) => set('description', v)} maxLength={1000} />
        </>
      )}
    </FormDialog>
  );
}

// ---------------------------------------------------------------- bank change request (employee)

const BANK_FIELDS = [
  ['bankName', 'Bank name', {}],
  ['bankAccountNumber', 'Account number', { autoComplete: 'off' }],
  ['bankIfsc', 'IFSC', { placeholder: 'HDFC0001234', maxLength: 11 }],
  ['panNumber', 'PAN', { placeholder: 'ABCDE1234F', maxLength: 10 }],
  ['uanNumber', 'UAN (PF)', { maxLength: 12 }],
];

export function BankChangeDialog({ employee, onClose }) {
  const initial = Object.fromEntries(BANK_FIELDS.map(([key]) => [key, employee[key] || '']));
  const [form, set] = useForm({ ...initial, reason: '' });
  const changed = BANK_FIELDS.map(([key]) => key).filter((key) => form[key].trim() !== initial[key]);
  const save = useProfileMutation(employee.id,
    () => profileApi.requestChange(employee.id, 'BANK', Object.fromEntries(changed.map((k) => [k, form[k].trim()])), form.reason.trim() || null),
    'Sent to HR. Your bank details update once they approve.');
  return (
    <FormDialog title="Request bank & tax details change" description="HR verifies these before salary is paid to a new account." onClose={onClose}
      onSubmit={() => save.mutate(undefined, { onSuccess: onClose })} saving={save.isPending} submitLabel="Send for approval"
      error={save.isError && errorText(save.error, 'Could not send the request.')}>
      {BANK_FIELDS.map(([key, label, extra]) => (
        <FormField key={key} col={6} label={label} value={form[key]} onChange={(v) => set(key, ['bankIfsc', 'panNumber'].includes(key) ? v.toUpperCase() : v)} {...extra} />
      ))}
      <FormField col={12} label="Reason (optional)" value={form.reason} onChange={(v) => set('reason', v)} placeholder="e.g. Moved my salary account to another bank" maxLength={500} />
      {changed.length === 0 && <div className="col-12" style={{ fontSize: 12.5, color: 'var(--hz-text-muted)' }}>Change at least one field to send a request.</div>}
    </FormDialog>
  );
}

// ---------------------------------------------------------------- photo

/** Centre-crops to a square and scales to 512px JPEG so uploads stay small (well under the 1 MB limit). */
function toSquareJpeg(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const side = Math.min(image.width, image.height);
      const size = Math.min(512, side);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      canvas.getContext('2d').drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.86));
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
    image.src = url;
  });
}

export function PhotoControls({ employee }) {
  const input = useRef(null);
  const toast = useToast();
  const confirm = useConfirm();
  const upload = useProfileMutation(employee.id, (image) => profileApi.uploadPhoto(employee.id, image), 'Profile photo updated.');
  const remove = useProfileMutation(employee.id, () => profileApi.removePhoto(employee.id), 'Profile photo removed.');
  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.warning('Choose a JPG or PNG image.'); return; }
    try {
      upload.mutate(await toSquareJpeg(file), { onError: (err) => toast.error(errorText(err, 'Could not upload the photo.')) });
    } catch {
      toast.warning('That image could not be read. Try a JPG or PNG.');
    }
  };
  return (
    <div className="d-flex gap-2 flex-wrap">
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="d-none" onChange={onFile} />
      <Button size="sm" variant="secondary" icon={Camera} loading={upload.isPending} onClick={() => input.current?.click()}>
        {employee.profilePhotoUrl ? 'Change photo' : 'Add photo'}
      </Button>
      {employee.profilePhotoUrl && (
        <Button size="sm" variant="ghost" loading={remove.isPending}
          onClick={async () => { if (await confirm({ title: 'Remove profile photo?', description: 'Your initials will show instead.', confirmLabel: 'Remove' })) remove.mutate(); }}>
          Remove
        </Button>
      )}
    </div>
  );
}
