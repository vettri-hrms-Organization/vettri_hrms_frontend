import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, Fingerprint, Pencil, Check, X, Plus } from 'lucide-react';
import { devicesApi } from '../../api/endpoints/attendance';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useAuth } from '../../hooks/useAuth';

export default function Devices() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [deviceName, setDeviceName] = useState('');

  const { data: devices, isLoading, isError, refetch } = useQuery({ queryKey: ['devices'], queryFn: devicesApi.list });

  const rename = useMutation({
    mutationFn: ({ id, deviceName }) => devicesApi.rename(id, deviceName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setEditingId(null);
    },
  });

  const register = useMutation({
    mutationFn: devicesApi.register,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setSerialNumber('');
      setDeviceName('');
    },
  });

  return (
    <div className="hz-module-page hz-module-page--attendance-devices d-flex flex-column gap-4">
      <Link to="/attendance" className="d-inline-flex align-items-center gap-1 text-decoration-none" style={{ color: 'var(--hz-text-secondary)', fontSize: 'var(--hz-text-sm)', width: 'fit-content' }}>
        <ArrowLeft size={15} /> Back to Attendance
      </Link>

      <div>
        <h1 style={{ fontSize: 'var(--hz-text-2xl)', fontWeight: 700 }}>Biometric Devices</h1>
        <p className="text-secondary-hz" style={{ fontSize: 'var(--hz-text-sm)' }}>
          Register each device before configuring its ADMS connection.
        </p>
      </div>

      {hasPermission('DEVICE_MANAGE') && (
        <form className="d-flex gap-2 flex-wrap" onSubmit={(event) => {
          event.preventDefault();
          register.mutate({ serialNumber: serialNumber.trim(), deviceName: deviceName.trim() });
        }}>
          <input className="form-control" value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} placeholder="Device serial number" aria-label="Device serial number" required maxLength={50} />
          <input className="form-control" value={deviceName} onChange={(event) => setDeviceName(event.target.value)} placeholder="Device name" aria-label="Device name" required maxLength={100} />
          <Button type="submit" icon={Plus} loading={register.isPending} disabled={register.isPending}>Register Device</Button>
          {register.isError && <p className="text-danger w-100 mb-0" role="alert">{register.error?.response?.data?.message || 'Could not register this device.'}</p>}
        </form>
      )}

      <Card bodyClassName="p-0">
        {isLoading && (
          <div className="p-4">
            <SkeletonText lines={4} />
          </div>
        )}
        {isError && <ErrorState description="Couldn't load devices." onRetry={refetch} />}
        {!isLoading && !isError && devices?.length === 0 && (
          <EmptyState
            icon={Fingerprint}
            title="No biometric devices registered"
            description="Register a device, then configure its ADMS server address and an allowed source IP."
          />
        )}
        {!isLoading && !isError && devices?.length > 0 && (
          <div className="table-responsive">
            <table className="table mb-0 align-middle">
            <thead>
              <tr style={{ fontSize: 'var(--hz-text-xs)', color: 'var(--hz-text-muted)', textTransform: 'uppercase' }}>
                <th className="ps-4">Device Name</th>
                <th>Serial Number</th>
                <th>Last IP</th>
                <th>Last Seen</th>
                <th className="pe-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id}>
                  <td className="ps-4">
                    {editingId === d.id ? (
                      <div className="d-flex align-items-center gap-1">
                        <input
                          className="form-control form-control-sm"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          style={{ width: 160 }}
                          autoFocus
                        />
                        <button className="btn btn-sm btn-light border-0" onClick={() => rename.mutate({ id: d.id, deviceName: editValue })} aria-label="Save device name">
                          <Check size={14} />
                        </button>
                        <button className="btn btn-sm btn-light border-0" onClick={() => setEditingId(null)} aria-label="Cancel renaming device">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="d-flex align-items-center gap-2">
                        <span style={{ fontWeight: 600, fontSize: 'var(--hz-text-sm)' }}>{d.deviceName}</span>
                        <button
                          className="btn btn-sm btn-light border-0 p-1"
                          onClick={() => {
                            setEditingId(d.id);
                            setEditValue(d.deviceName);
                          }}
                          aria-label={`Rename device "${d.deviceName}"`}
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-secondary)' }}>{d.serialNumber}</td>
                  <td style={{ fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-secondary)' }}>{d.lastIpAddress || '—'}</td>
                  <td style={{ fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-secondary)' }}>
                    {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="pe-4">
                    <Badge variant={d.online ? 'success' : 'neutral'} dot>
                      {d.online ? 'Online' : 'Offline'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
