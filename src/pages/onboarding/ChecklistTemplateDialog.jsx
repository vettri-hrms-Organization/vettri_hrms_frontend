import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import Dialog from '../../components/ui/Dialog';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../hooks/useAuth';
import { onboardingApi, OWNER_TYPE_LABEL } from '../../api/endpoints/onboarding';
import { apiMessage } from '../../api/endpoints/letters';
import { usersApi } from '../../api/endpoints/users';

const DOCUMENT_TYPES = ['ID_PROOF', 'AADHAAR', 'PAN', 'PASSPORT', 'EMPLOYMENT_CONTRACT', 'EXPERIENCE_LETTER', 'OTHER'];
const LINK_KEYS = [
  { value: '', label: 'None' },
  { value: 'BANK_DETAILS', label: 'Bank & PAN details' },
  { value: 'APPOINTMENT_LETTER', label: 'Letters (appointment)' },
  { value: 'MY_LETTERS', label: "Employee's letters" },
  { value: 'RELIEVING_LETTER', label: 'Letters (relieving)' },
  { value: 'SALARY', label: 'Salary structure' },
];

const blankTask = () => ({ title: '', description: '', ownerType: 'HR', ownerUserId: '', dueOffsetDays: 0, requiresDocument: false, documentType: '', linkKey: '' });

/** Create / edit an onboarding or exit checklist template and its task list. */
export default function ChecklistTemplateDialog({ template, onClose, onSaved }) {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [form, setForm] = useState(() => ({
    name: template?.name || '',
    templateType: template?.templateType || 'ONBOARDING',
    description: template?.description || '',
    defaultTemplate: template?.defaultTemplate ?? false,
    autoStart: template?.autoStart ?? true,
    active: template?.active ?? true,
    tasks: template?.tasks?.length
      ? template.tasks.map((t) => ({
        title: t.title,
        description: t.description || '',
        ownerType: t.ownerType,
        ownerUserId: t.ownerUserId ? String(t.ownerUserId) : '',
        dueOffsetDays: t.dueOffsetDays,
        requiresDocument: t.requiresDocument,
        documentType: t.documentType || '',
        linkKey: t.linkKey || '',
      }))
      : [blankTask()],
  }));
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: usersApi.list, enabled: hasPermission('USER_VIEW') });

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setTask = (index, key, value) => setForm((f) => ({
    ...f,
    tasks: f.tasks.map((t, i) => (i === index ? { ...t, [key]: value } : t)),
  }));
  const move = (index, delta) => setForm((f) => {
    const tasks = [...f.tasks];
    const target = index + delta;
    if (target < 0 || target >= tasks.length) return f;
    [tasks[index], tasks[target]] = [tasks[target], tasks[index]];
    return { ...f, tasks };
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        tasks: form.tasks.map((t) => ({
          ...t,
          ownerUserId: t.ownerUserId ? Number(t.ownerUserId) : null,
          dueOffsetDays: Number(t.dueOffsetDays) || 0,
          documentType: t.requiresDocument ? (t.documentType || 'OTHER') : null,
          linkKey: t.linkKey || null,
        })),
      };
      return template ? onboardingApi.updateTemplate(template.id, payload) : onboardingApi.createTemplate(payload);
    },
    onSuccess: () => {
      toast.success('Template saved.');
      onSaved();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const anchorWord = form.templateType === 'EXIT' ? 'last working day' : 'joining';

  return (
    <Dialog
      open
      size="xl"
      onClose={onClose}
      title={template ? 'Edit checklist template' : 'New checklist template'}
      hasUnsavedChanges
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>Save template</Button>
        </>
      )}
    >
      <div className="row g-3">
        <div className="col-12 col-md-6"><FormField label="Name" value={form.name} onChange={(v) => set('name', v)} required /></div>
        <div className="col-12 col-md-6">
          <FormField as="select" label="Type" value={form.templateType} onChange={(v) => set('templateType', v)}>
            <option value="ONBOARDING">Onboarding (new hire)</option>
            <option value="EXIT">Offboarding (exit)</option>
          </FormField>
        </div>
        <div className="col-12"><FormField label="Description" value={form.description} onChange={(v) => set('description', v)} /></div>
        <div className="col-12 d-flex flex-wrap gap-4">
          {[
            ['defaultTemplate', 'Default template for this type'],
            ['autoStart', form.templateType === 'EXIT' ? 'Start automatically on resignation / termination' : 'Start automatically for new employees'],
            ['active', 'Active'],
          ].map(([key, label]) => (
            <div className="form-check" key={key}>
              <input id={`tpl-${key}`} className="form-check-input" type="checkbox" checked={!!form[key]} onChange={(e) => set(key, e.target.checked)} />
              <label className="form-check-label" htmlFor={`tpl-${key}`}>{label}</label>
            </div>
          ))}
        </div>
      </div>

      <h3 className="h6 mt-4 mb-2">Tasks</h3>
      <div className="d-flex flex-column gap-2">
        {form.tasks.map((task, index) => (
          <div key={index} className="p-2 rounded" style={{ border: '1px solid var(--hz-border)' }}>
            <div className="row g-2 align-items-end">
              <div className="col-12 col-lg-4"><FormField label="Task" value={task.title} onChange={(v) => setTask(index, 'title', v)} required /></div>
              <div className="col-6 col-lg-2">
                <FormField as="select" label="Owner" value={task.ownerType} onChange={(v) => setTask(index, 'ownerType', v)}>
                  {Object.entries(OWNER_TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{value === 'NEW_HIRE' ? (form.templateType === 'EXIT' ? 'Exiting employee' : 'New hire') : label}</option>
                  ))}
                </FormField>
              </div>
              {(task.ownerType === 'USER' || task.ownerType === 'IT') && (
                <div className="col-6 col-lg-2">
                  <FormField as="select" label={task.ownerType === 'IT' ? 'IT owner (optional)' : 'User'} value={task.ownerUserId} onChange={(v) => setTask(index, 'ownerUserId', v)}>
                    <option value="">{task.ownerType === 'IT' ? 'Any IT administrator' : 'Select user'}</option>
                    {(users || []).map((u) => <option key={u.id} value={u.id}>{u.fullName || u.username}</option>)}
                  </FormField>
                </div>
              )}
              <div className="col-6 col-lg-2">
                <FormField type="number" label={`Days from ${anchorWord}`} value={task.dueOffsetDays} onChange={(v) => setTask(index, 'dueOffsetDays', v)} />
              </div>
              <div className="col-6 col-lg-2 d-flex gap-1 justify-content-end">
                <Button size="sm" variant="ghost" icon={ArrowUp} disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move up" />
                <Button size="sm" variant="ghost" icon={ArrowDown} disabled={index === form.tasks.length - 1} onClick={() => move(index, 1)} aria-label="Move down" />
                <Button size="sm" variant="ghost" icon={Trash2} disabled={form.tasks.length === 1}
                  onClick={() => setForm((f) => ({ ...f, tasks: f.tasks.filter((_, i) => i !== index) }))} aria-label="Remove task" />
              </div>
              <div className="col-12 col-lg-6"><FormField label="Description" value={task.description} onChange={(v) => setTask(index, 'description', v)} /></div>
              <div className="col-6 col-lg-2">
                <div className="form-check mt-4">
                  <input id={`req-doc-${index}`} className="form-check-input" type="checkbox" checked={task.requiresDocument} onChange={(e) => setTask(index, 'requiresDocument', e.target.checked)} />
                  <label className="form-check-label" htmlFor={`req-doc-${index}`}>Needs document</label>
                </div>
              </div>
              {task.requiresDocument && (
                <div className="col-6 col-lg-2">
                  <FormField as="select" label="Document type" value={task.documentType} onChange={(v) => setTask(index, 'documentType', v)}>
                    <option value="">Other</option>
                    {DOCUMENT_TYPES.map((d) => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
                  </FormField>
                </div>
              )}
              <div className="col-6 col-lg-2">
                <FormField as="select" label="Link" value={task.linkKey} onChange={(v) => setTask(index, 'linkKey', v)}>
                  {LINK_KEYS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </FormField>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Button className="mt-2" size="sm" variant="secondary" icon={Plus} onClick={() => setForm((f) => ({ ...f, tasks: [...f.tasks, blankTask()] }))}>
        Add task
      </Button>
    </Dialog>
  );
}
