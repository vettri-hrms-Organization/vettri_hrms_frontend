import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import CustomFieldInputs from '../../components/customFields/CustomFieldInputs';
import { customFieldsApi, formatCustomFieldValue, missingRequired } from '../../api/endpoints/customFields';
import { useToast } from '../../components/ui/Toast';

/** Company custom fields on the employee profile. Hidden when the company defined none. */
export default function CustomFieldsCard({ employeeId }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const queryKey = ['custom-fields', 'employee', String(employeeId)];
  const data = useQuery({ queryKey, queryFn: () => customFieldsApi.employeeValues(employeeId), enabled: !!employeeId });
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});

  const fields = data.data?.fields || [];
  const editable = fields.filter((field) => field.editable);

  const save = useMutation({
    mutationFn: () => {
      const payload = {};
      editable.forEach((field) => { payload[field.definition.key] = values[field.definition.key] ?? null; });
      return customFieldsApi.saveEmployeeValues(employeeId, payload);
    },
    onSuccess: (result) => {
      queryClient.setQueryData(queryKey, result);
      setEditing(false);
      toast.success('Details saved.');
    },
    onError: (error) => toast.error(error?.response?.data?.message || 'Could not save these details.'),
  });

  if (data.isLoading || data.isError || fields.length === 0) return null;

  function startEdit() {
    const initial = {};
    fields.forEach((field) => { initial[field.definition.key] = field.value; });
    setValues(initial);
    setErrors({});
    setEditing(true);
  }

  function submit(event) {
    event.preventDefault();
    const missing = missingRequired(editable.map((f) => f.definition), values);
    setErrors(missing);
    if (Object.keys(missing).length) return;
    save.mutate();
  }

  return (
    <Card title="Additional details" subtitle="Fields defined by your company"
      actions={editable.length > 0 && !editing
        ? <Button size="sm" variant="secondary" icon={Pencil} onClick={startEdit}>Edit</Button> : null}>
      {editing ? (
        <form onSubmit={submit}>
          <CustomFieldInputs
            definitions={fields.map((f) => f.definition)}
            values={values}
            errors={errors}
            readOnlyKeys={fields.filter((f) => !f.editable).map((f) => f.definition.key)}
            onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
          />
          <div className="d-flex justify-content-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>Save</Button>
          </div>
        </form>
      ) : (
        <dl className="row mb-0">
          {fields.map((field) => (
            <div key={field.definition.key} className="col-12 col-md-6 mb-2">
              <dt style={{ fontSize: 'var(--hz-text-xs)', color: 'var(--hz-text-muted)', fontWeight: 500 }}>{field.definition.label}</dt>
              <dd className="mb-0" style={{ fontSize: 'var(--hz-text-sm)' }}>{formatCustomFieldValue(field.definition.type, field.value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}
