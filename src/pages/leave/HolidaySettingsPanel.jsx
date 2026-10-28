import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, Save } from 'lucide-react';
import { holidayCalendarApi } from '../../api/endpoints/settlement';
import { attendanceApi } from '../../api/endpoints/attendance';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorBanner from '../../components/ui/ErrorBanner';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';

const EMPTY = { name: '', date: '', holidayType: 'MANDATORY', locationIds: [] };

/**
 * Holiday calendar (LEAVE_MANAGE): each holiday is MANDATORY or OPTIONAL (restricted) and applies to
 * all locations or only to the chosen office locations. Plus the optional-holidays-per-year quota.
 */
export default function HolidaySettingsPanel() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState(null); // null = closed; { id?, ...fields }
  const [error, setError] = useState(null);
  const [quota, setQuota] = useState('');

  const { data: holidays, isLoading } = useQuery({ queryKey: ['holidays'], queryFn: holidayCalendarApi.list });
  const { data: locations = [] } = useQuery({ queryKey: ['office-locations'], queryFn: attendanceApi.officeLocations });
  const { data: settings } = useQuery({ queryKey: ['holiday-settings'], queryFn: holidayCalendarApi.getSettings });

  useEffect(() => {
    if (settings) setQuota(String(settings.maxOptionalHolidays));
  }, [settings]);

  const save = useMutation({
    mutationFn: (payload) => (payload.id ? holidayCalendarApi.update(payload.id, payload) : holidayCalendarApi.create(payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      setForm(null);
      setError(null);
      toast.success('Holiday saved');
    },
    onError: (err) => setError(err.response?.data?.message || 'Could not save the holiday'),
  });
  const remove = useMutation({
    mutationFn: holidayCalendarApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['holidays'] }),
  });
  const saveQuota = useMutation({
    mutationFn: () => holidayCalendarApi.updateSettings({ maxOptionalHolidays: Number(quota || 0) }),
    onSuccess: (saved) => {
      queryClient.setQueryData(['holiday-settings'], saved);
      toast.success('Optional holiday limit saved');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not save the limit'),
  });

  const locationList = Array.isArray(locations) ? locations : [];

  function toggleLocation(id) {
    setForm((f) => ({
      ...f,
      locationIds: f.locationIds.includes(id) ? f.locationIds.filter((x) => x !== id) : [...f.locationIds, id],
    }));
  }

  return (
    <div className="d-flex flex-column gap-3">
      <Card title="Optional holidays" subtitle="How many optional (restricted) holidays each employee may pick per calendar year">
        <form
          className="d-flex align-items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveQuota.mutate();
          }}
        >
          <div>
            <label className="form-label" htmlFor="optional-quota" style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 500 }}>Per employee per year</label>
            <input id="optional-quota" className="form-control" type="number" min="0" max="50" style={{ width: 120 }} value={quota} onChange={(e) => setQuota(e.target.value)} />
          </div>
          <Button type="submit" size="sm" icon={Save} loading={saveQuota.isPending}>Save</Button>
        </form>
      </Card>

      <Card
        title="Holiday Calendar"
        subtitle="Mandatory holidays are off for everyone they apply to; optional holidays only for employees who pick them"
        actions={
          <Button size="sm" variant="secondary" icon={Plus} onClick={() => { setError(null); setForm(form ? null : { ...EMPTY }); }}>
            {form ? 'Close' : 'Add'}
          </Button>
        }
      >
        {form && (
          <form
            className="d-flex flex-column gap-2 mb-4 pb-3"
            style={{ borderBottom: '1px solid var(--hz-border)' }}
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(form);
            }}
          >
            {error && <ErrorBanner>{error}</ErrorBanner>}
            <div className="row g-2 align-items-end">
              <div className="col-md-5">
                <input className="form-control" placeholder="Holiday name" aria-label="Holiday name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="col-md-3">
                <input className="form-control" type="date" aria-label="Holiday date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              </div>
              <div className="col-md-2">
                <select className="form-select" aria-label="Holiday type" value={form.holidayType} onChange={(e) => setForm({ ...form, holidayType: e.target.value })}>
                  <option value="MANDATORY">Mandatory</option>
                  <option value="OPTIONAL">Optional</option>
                </select>
              </div>
              <div className="col-md-2">
                <Button type="submit" size="sm" loading={save.isPending} className="w-100 justify-content-center">
                  {form.id ? 'Update' : 'Add'}
                </Button>
              </div>
            </div>
            <div style={{ fontSize: 13 }}>
              <span style={{ color: 'var(--hz-text-muted)' }}>Applies to: </span>
              {locationList.length === 0 && <span>All locations (no office locations set up)</span>}
              {locationList.length > 0 && (
                <span className="d-inline-flex flex-wrap gap-3">
                  <label className="d-inline-flex align-items-center gap-1">
                    <input type="checkbox" checked={form.locationIds.length === 0} onChange={() => setForm({ ...form, locationIds: [] })} />
                    All locations
                  </label>
                  {locationList.map((l) => (
                    <label key={l.id} className="d-inline-flex align-items-center gap-1">
                      <input type="checkbox" checked={form.locationIds.includes(l.id)} onChange={() => toggleLocation(l.id)} />
                      {l.name}
                    </label>
                  ))}
                </span>
              )}
            </div>
          </form>
        )}

        {isLoading && <SkeletonText lines={3} />}
        {!isLoading && holidays?.length === 0 && <EmptyState title="No holidays configured" description="Add your company's holidays so leave-day counting excludes them." />}
        {!isLoading && holidays?.length > 0 && (
          <div className="table-responsive">
            <table className="table mb-0 align-middle hz-table" aria-label="Holidays">
              <thead>
                <tr>
                  <th>Holiday</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Locations</th>
                  <th style={{ width: 90 }} aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {holidays.map((h) => (
                  <tr key={h.id}>
                    <td style={{ fontWeight: 600 }}>{h.name}</td>
                    <td>{new Date(`${h.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</td>
                    <td><Badge variant={h.holidayType === 'OPTIONAL' ? 'info' : 'neutral'}>{h.holidayType === 'OPTIONAL' ? 'Optional' : 'Mandatory'}</Badge></td>
                    <td style={{ fontSize: 13 }}>{h.locationNames?.length ? h.locationNames.join(', ') : 'All locations'}</td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-light border-0"
                        aria-label={`Edit holiday "${h.name}"`}
                        onClick={() => { setError(null); setForm({ id: h.id, name: h.name, date: h.date, holidayType: h.holidayType || 'MANDATORY', locationIds: h.locationIds || [] }); }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button type="button" className="btn btn-sm btn-light border-0" style={{ color: 'var(--hz-danger-600)' }} onClick={() => remove.mutate(h.id)} aria-label={`Delete holiday "${h.name}"`}>
                        <Trash2 size={14} />
                      </button>
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
