import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Dialog from '../../components/ui/Dialog';
import FormField from '../../components/ui/FormField';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { CUSTOM_FIELD_TYPES, customFieldsApi } from '../../api/endpoints/customFields';

const EMPTY = {
  label: '', key: '', type: 'TEXT', options: '', required: false, section: '',
  visibleToEmployee: true, editableByEmployee: false,
};

const errorMessage = (error, fallback) => error?.response?.data?.message || fallback;
const typeLabel = (type) => CUSTOM_FIELD_TYPES.find((t) => t.value === type)?.label || type;

export default function SettingsCustomFields() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // null | 'new' | definition
  const [form, setForm] = useState(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const definitions = useQuery({ queryKey: ['custom-fields', 'definitions'], queryFn: customFieldsApi.definitions });
  const list = Array.isArray(definitions.data) ? definitions.data : [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['custom-fields'] });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        label: form.label.trim(),
        key: editing === 'new' ? (form.key.trim() || null) : editing.key,
        type: form.type,
        options: ['SELECT', 'MULTISELECT'].includes(form.type)
          ? form.options.split('\n').map((o) => o.trim()).filter(Boolean)
          : [],
        required: !!form.required,
        section: form.section.trim() || null,
        visibleToEmployee: !!form.visibleToEmployee,
        editableByEmployee: !!form.visibleToEmployee && !!form.editableByEmployee,
      };
      return editing === 'new'
        ? customFieldsApi.createDefinition(payload)
        : customFieldsApi.updateDefinition(editing.id, payload);
    },
    onSuccess: () => { toast.success('Custom field saved.'); setEditing(null); refresh(); },
    onError: (error) => toast.error(errorMessage(error, 'Could not save the custom field.')),
  });

  const remove = useMutation({
    mutationFn: (id) => customFieldsApi.deleteDefinition(id),
    onSuccess: () => { toast.success('Custom field deleted.'); setConfirmDelete(null); refresh(); },
    onError: (error) => toast.error(errorMessage(error, 'Could not delete the custom field.')),
  });

  const reorder = useMutation({
    mutationFn: (ids) => customFieldsApi.reorder(ids),
    onSuccess: (data) => queryClient.setQueryData(['custom-fields', 'definitions'], data),
    onError: (error) => toast.error(errorMessage(error, 'Could not change the order.')),
  });

  function move(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const ids = list.map((d) => d.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(ids);
  }

  function openEditor(definition) {
    setEditing(definition || 'new');
    setForm(definition ? {
      label: definition.label,
      key: definition.key,
      type: definition.type,
      options: (definition.options || []).join('\n'),
      required: definition.required,
      section: definition.section || '',
      visibleToEmployee: definition.visibleToEmployee,
      editableByEmployee: definition.editableByEmployee,
    } : EMPTY);
  }

  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  const hasOptions = ['SELECT', 'MULTISELECT'].includes(form.type);

  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Settings" title="Employee custom fields"
        description="Extra details your company tracks on every employee. They appear on the employee profile, the add-employee form, CSV export and Excel import (match a column by the field's label or key)." />

      <Card title="Fields" subtitle="Use the arrows to change the order shown on profiles."
        actions={<Button size="sm" icon={Plus} onClick={() => openEditor(null)}>Add field</Button>} bodyClassName="p-0">
        {definitions.isLoading && <div className="p-4"><SkeletonText lines={4} /></div>}
        {definitions.isError && <ErrorState description="Couldn't load custom fields." onRetry={definitions.refetch} />}
        {!definitions.isLoading && !definitions.isError && list.length === 0 && (
          <EmptyState icon={ListChecks} title="No custom fields yet" description="Add fields such as blood group, T-shirt size or vehicle number." />
        )}
        {list.length > 0 && (
          <div className="table-responsive">
            <table className="table mb-0 align-middle hz-table" aria-label="Custom fields">
              <thead>
                <tr style={{ fontSize: 'var(--hz-text-xs)', color: 'var(--hz-text-muted)', textTransform: 'uppercase' }}>
                  <th className="ps-4">Order</th>
                  <th>Label</th>
                  <th>Key</th>
                  <th>Type</th>
                  <th>Section</th>
                  <th>Employee</th>
                  <th className="pe-4 text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((definition, index) => (
                  <tr key={definition.id}>
                    <td className="ps-4">
                      <div className="d-flex gap-1">
                        <Button size="sm" variant="secondary" icon={ArrowUp} aria-label={`Move ${definition.label} up`}
                          disabled={index === 0 || reorder.isPending} onClick={() => move(index, -1)} />
                        <Button size="sm" variant="secondary" icon={ArrowDown} aria-label={`Move ${definition.label} down`}
                          disabled={index === list.length - 1 || reorder.isPending} onClick={() => move(index, 1)} />
                      </div>
                    </td>
                    <td style={{ fontWeight: 600, fontSize: 'var(--hz-text-sm)' }}>
                      {definition.label}{definition.required && <span className="text-danger ms-1" title="Required">*</span>}
                    </td>
                    <td><code>{definition.key}</code></td>
                    <td style={{ fontSize: 'var(--hz-text-sm)' }}>{typeLabel(definition.type)}</td>
                    <td style={{ fontSize: 'var(--hz-text-sm)' }}>{definition.section || '—'}</td>
                    <td style={{ fontSize: 'var(--hz-text-sm)' }}>
                      {!definition.visibleToEmployee ? 'Hidden' : definition.editableByEmployee ? 'Can edit' : 'View only'}
                    </td>
                    <td className="pe-4 text-end">
                      <div className="d-inline-flex gap-2">
                        <Button size="sm" variant="secondary" icon={Pencil} onClick={() => openEditor(definition)} aria-label={`Edit ${definition.label}`}>Edit</Button>
                        <Button size="sm" variant="secondary" icon={Trash2} onClick={() => setConfirmDelete(definition)} aria-label={`Delete ${definition.label}`}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add custom field' : 'Edit custom field'}>
        <form onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
          <div className="row">
            <FormField col={6} label="Label" required maxLength={120} value={form.label} onChange={set('label')} />
            <FormField col={6} label="Key" maxLength={60} value={form.key} onChange={set('key')}
              disabled={editing !== 'new'} hint={editing === 'new' ? 'Optional - generated from the label (e.g. blood_group). Cannot be changed later.' : 'Keys cannot be changed.'} />
            <FormField col={6} as="select" label="Type" value={form.type} onChange={set('type')}>
              {CUSTOM_FIELD_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </FormField>
            <FormField col={6} label="Section" maxLength={80} value={form.section} onChange={set('section')} hint="Groups fields on the profile, e.g. Personal" />
            {hasOptions && (
              <FormField col={12} as="textarea" rows={4} label="Options (one per line)" required value={form.options} onChange={set('options')} />
            )}
            <div className="col-12 mb-3 d-flex flex-column gap-2">
              <label className="form-check-label d-flex gap-2">
                <input type="checkbox" className="form-check-input" checked={!!form.required} onChange={(e) => set('required')(e.target.checked)} />
                Required
              </label>
              <label className="form-check-label d-flex gap-2">
                <input type="checkbox" className="form-check-input" checked={!!form.visibleToEmployee} onChange={(e) => set('visibleToEmployee')(e.target.checked)} />
                Visible to the employee
              </label>
              <label className="form-check-label d-flex gap-2">
                <input type="checkbox" className="form-check-input" checked={!!form.editableByEmployee && !!form.visibleToEmployee}
                  disabled={!form.visibleToEmployee} onChange={(e) => set('editableByEmployee')(e.target.checked)} />
                Employee can edit it
              </label>
            </div>
          </div>
          <div className="d-flex justify-content-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" loading={save.isPending} disabled={!form.label.trim()}>Save field</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete custom field?"
        description={confirmDelete ? `"${confirmDelete.label}" and every employee's value for it will be removed.` : ''}>
        <div className="d-flex justify-content-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate(confirmDelete.id)}>Delete</Button>
        </div>
      </Dialog>
    </div>
  );
}
