import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { workLocationApi, settlementApi, formatINR } from '../../api/endpoints/settlement';
import { useAuth } from '../../hooks/useAuth';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

/**
 * Job tab additions: work location (decides location-specific holidays; editable with EMPLOYEE_MANAGE)
 * and an estimated gratuity (HR with SALARY_VIEW only).
 */
export default function WorkLocationGratuityCards({ employee }) {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('EMPLOYEE_MANAGE');
  const showGratuity = hasPermission('SALARY_VIEW');
  return (
    <>
      <div className="col-12 col-lg-6">
        <WorkLocationCard employeeId={employee.id} canEdit={canEdit} />
      </div>
      {showGratuity && (
        <div className="col-12 col-lg-6">
          <GratuityCard employeeId={employee.id} />
        </div>
      )}
    </>
  );
}

function WorkLocationCard({ employeeId, canEdit }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [value, setValue] = useState('');
  const { data, isError } = useQuery({ queryKey: ['work-location', String(employeeId)], queryFn: () => workLocationApi.get(employeeId) });
  useEffect(() => { if (data) setValue(data.officeLocationId ? String(data.officeLocationId) : ''); }, [data]);
  const save = useMutation({
    mutationFn: () => workLocationApi.update(employeeId, value ? Number(value) : null),
    onSuccess: (saved) => {
      queryClient.setQueryData(['work-location', String(employeeId)], saved);
      toast.success('Work location saved');
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Could not save the work location'),
  });

  return (
    <Card title="Work location" subtitle="Location-specific holidays follow this office">
      {isError && <div className="hz-profile-empty-note">Work location is unavailable.</div>}
      {data && !canEdit && (
        <div className="d-flex align-items-center gap-2" style={{ fontSize: 'var(--hz-text-sm)' }}>
          <MapPin size={14} aria-hidden="true" /> {data.officeLocationName || 'Not set (company-wide holidays only)'}
        </div>
      )}
      {data && canEdit && (
        <div className="d-flex gap-2 align-items-center">
          <select className="form-select" aria-label="Work location" value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">Not set (company-wide holidays only)</option>
            {data.options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <Button size="sm" loading={save.isPending} disabled={value === (data.officeLocationId ? String(data.officeLocationId) : '')} onClick={() => save.mutate()}>Save</Button>
        </div>
      )}
    </Card>
  );
}

function GratuityCard({ employeeId }) {
  const { data, isError } = useQuery({ queryKey: ['gratuity-estimate', String(employeeId)], queryFn: () => settlementApi.gratuity(employeeId) });
  return (
    <Card title="Estimated gratuity" subtitle="HR only - Payment of Gratuity Act, 1972, on the current basic salary">
      {isError && <div className="hz-profile-empty-note">Gratuity estimate is unavailable.</div>}
      {data && (
        <div className="d-flex flex-column gap-1" style={{ fontSize: 'var(--hz-text-sm)' }}>
          <div className="d-flex justify-content-between">
            <span>Service as of {data.asOf}</span>
            <strong>{data.serviceYears}y {data.serviceMonths}m {data.serviceDays}d</strong>
          </div>
          <div className="d-flex justify-content-between">
            <span>{data.eligible ? `Payable (${data.yearsCounted} years counted)` : 'Not yet eligible'}</span>
            <strong>{data.eligible ? formatINR(data.amount) : formatINR(0)}</strong>
          </div>
          <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{data.explanation}</div>
        </div>
      )}
    </Card>
  );
}
