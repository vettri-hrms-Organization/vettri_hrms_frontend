import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LocateFixed, MapPin, Pencil, Plus, Search } from 'lucide-react';
import { departmentsApi, designationsApi, teamsApi } from '../api/endpoints/organization';
import { attendanceApi } from '../api/endpoints/attendance';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonText } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import PageHeader from '../components/ui/PageHeader';
import Tabs from '../components/ui/Tabs';
import OfficeLocationMap from '../components/attendance/OfficeLocationMap';

const TABS = [
  { key: 'departments', label: 'Departments' },
  { key: 'designations', label: 'Designations' },
  { key: 'teams', label: 'Teams' },
  { key: 'locations', label: 'Office locations', icon: MapPin },
];

export default function SettingsOrganization() {
  const [tab, setTab] = useState('departments');

  return (
    <div className="hz-admin-page hz-admin-page--organization hz-settings-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Settings" title="Organization" description="The structure your employees, teams, and reporting lines are built on" />

      <Tabs items={TABS} value={tab} onChange={setTab} />

      {tab === 'departments' && <DepartmentsPanel />}
      {tab === 'designations' && <DesignationsPanel />}
      {tab === 'teams' && <TeamsPanel />}
      {tab === 'locations' && <OfficeLocationsPanel />}
    </div>
  );
}

function DepartmentsPanel() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', description: '' });

  const { data: departments, isLoading } = useQuery({ queryKey: ['departments'], queryFn: departmentsApi.list });
  const create = useMutation({
    mutationFn: departmentsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setForm({ name: '', code: '', description: '' });
      setShowForm(false);
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }) => (active ? departmentsApi.deactivate(id) : departmentsApi.activate(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
    onError: (err) => toast.error(err.response?.data?.message || 'Could not update this department.'),
  });

  return (
    <Panel
      title="Departments"
      showForm={showForm}
      onToggleForm={() => setShowForm((s) => !s)}
      form={
        <form
          className="row g-2 align-items-end"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(form);
          }}
        >
          <div className="col-4">
            <input className="form-control" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="col-3">
            <input className="form-control" placeholder="Code (e.g. ENG)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          </div>
          <div className="col-3">
            <input className="form-control" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="col-2">
            <Button type="submit" size="sm" loading={create.isPending} className="w-100 justify-content-center">
              Add
            </Button>
          </div>
        </form>
      }
    >
      {isLoading && <SkeletonText lines={4} />}
      {!isLoading && departments?.length === 0 && <EmptyState title="No departments yet" description="Add your first department above." />}
      {!isLoading &&
        departments?.map((d) => (
          <Row
            key={d.id}
            left={d.name}
            sub={d.code}
            right={`${d.employeeCount} employee${d.employeeCount === 1 ? '' : 's'}`}
            active={d.active}
            onToggleActive={() => toggleActive.mutate({ id: d.id, active: d.active })}
            toggling={toggleActive.isPending}
          />
        ))}
    </Panel>
  );
}

function DesignationsPanel() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', level: '', departmentId: '' });

  const { data: designations, isLoading } = useQuery({ queryKey: ['designations'], queryFn: designationsApi.list });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: departmentsApi.list });
  const create = useMutation({
    mutationFn: designationsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['designations'] });
      setForm({ title: '', level: '', departmentId: '' });
      setShowForm(false);
    },
  });

  return (
    <Panel
      title="Designations"
      showForm={showForm}
      onToggleForm={() => setShowForm((s) => !s)}
      form={
        <form
          className="row g-2 align-items-end"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({ ...form, level: form.level ? Number(form.level) : null, departmentId: form.departmentId || null });
          }}
        >
          <div className="col-4">
            <input className="form-control" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="col-2">
            <input className="form-control" placeholder="Level" type="number" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
          </div>
          <div className="col-4">
            <select className="form-select" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              <option value="">Any department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-2">
            <Button type="submit" size="sm" loading={create.isPending} className="w-100 justify-content-center">
              Add
            </Button>
          </div>
        </form>
      }
    >
      {isLoading && <SkeletonText lines={4} />}
      {!isLoading && designations?.length === 0 && <EmptyState title="No designations yet" description="Add your first designation above." />}
      {!isLoading &&
        designations?.map((d) => (
          <Row key={d.id} left={d.title} sub={d.departmentName || 'Any department'} right={d.level != null ? `Level ${d.level}` : ''} active={d.active} />
        ))}
    </Panel>
  );
}

function TeamsPanel() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', departmentId: '' });

  const { data: teams, isLoading } = useQuery({ queryKey: ['teams'], queryFn: teamsApi.list });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: departmentsApi.list });
  const create = useMutation({
    mutationFn: teamsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setForm({ name: '', departmentId: '' });
      setShowForm(false);
    },
  });

  return (
    <Panel
      title="Teams"
      showForm={showForm}
      onToggleForm={() => setShowForm((s) => !s)}
      form={
        <form
          className="row g-2 align-items-end"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({ ...form, departmentId: form.departmentId || null });
          }}
        >
          <div className="col-5">
            <input className="form-control" placeholder="Team name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="col-5">
            <select className="form-select" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              <option value="">Any department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-2">
            <Button type="submit" size="sm" loading={create.isPending} className="w-100 justify-content-center">
              Add
            </Button>
          </div>
        </form>
      }
    >
      {isLoading && <SkeletonText lines={4} />}
      {!isLoading && teams?.length === 0 && <EmptyState title="No teams yet" description="Add your first team above." />}
      {!isLoading &&
        teams?.map((t) => (
          <Row key={t.id} left={t.name} sub={t.departmentName || 'Any department'} right={`${t.memberCount} member${t.memberCount === 1 ? '' : 's'}`} active={t.active} />
        ))}
    </Panel>
  );
}

function OfficeLocationsPanel() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [form, setForm] = useState(emptyOfficeLocation());
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');
  const [reverseGeocoding, setReverseGeocoding] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const { data: locations, isLoading } = useQuery({ queryKey: ['attendance-office-locations'], queryFn: attendanceApi.officeLocations });
  const save = useMutation({
    mutationFn: ({ id, payload }) => id ? attendanceApi.updateOfficeLocation(id, payload) : attendanceApi.createOfficeLocation(payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['attendance-office-locations'] }); resetForm(); },
    onError: (error) => toast.error(error.response?.data?.message || 'Could not save this office location.'),
  });
  const toggle = useMutation({
    mutationFn: ({ id, active }) => attendanceApi.setOfficeLocationStatus(id, !active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance-office-locations'] }),
    onError: (error) => toast.error(error.response?.data?.message || 'Could not update this office location.'),
  });

  useEffect(() => {
    if (search.trim().length < 3) {
      setSuggestions([]);
      setSearchMessage(search.trim() ? 'Enter at least 3 characters to search.' : '');
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchMessage('');
      try {
        const results = await attendanceApi.searchOfficeLocations(search.trim(), controller.signal);
        setSuggestions(results);
        setSearchMessage(results.length ? '' : 'No locations found. Try a nearby landmark or street.');
      } catch (error) {
        if (error.code !== 'ERR_CANCELED' && error.name !== 'CanceledError') {
          setSuggestions([]);
          setSearchMessage('Location search is unavailable. Please try again or use your current location.');
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 450);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [search]);

  function searchLocation(value) {
    setSearch(value);
  }

  function selectLocation(location) {
    setSearch(location.displayName);
    setSuggestions([]);
    setSearchMessage('');
    applyGeocodeResult(location);
  }

  function applyGeocodeResult(result) {
    setForm((current) => ({ ...current, address: result.address || result.displayName || '', city: result.city || '', state: result.state || '', country: result.country || '', latitude: String(result.latitude), longitude: String(result.longitude) }));
  }

  async function reverseGeocode(latitude, longitude) {
    setReverseGeocoding(true);
    setLocationMessage('');
    try {
      const result = await attendanceApi.reverseGeocode(latitude, longitude);
      setForm((current) => ({ ...current, ...(result ? { address: result.address || result.displayName || '', city: result.city || '', state: result.state || '', country: result.country || '' } : {}), latitude: String(latitude), longitude: String(longitude) }));
      if (!result) setLocationMessage('Address details were not found, but the selected coordinates are ready to save.');
    } catch {
      setForm((current) => ({ ...current, latitude: String(latitude), longitude: String(longitude) }));
      setLocationMessage('Address lookup failed. The selected coordinates are still ready to save.');
    } finally {
      setReverseGeocoding(false);
    }
  }

  function useCurrentLocation() {
    setLocationMessage('');
    if (!navigator.geolocation) {
      setLocationMessage('Unable to determine your current location. Please search for the office instead.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (coords.accuracy > 150) setLocationMessage('Location found with limited accuracy. Drag the pin to the office entrance if needed.');
        reverseGeocode(coords.latitude, coords.longitude);
      },
      () => setLocationMessage('Unable to determine your current location. Please search for the office instead.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  function resetForm() {
    setForm(emptyOfficeLocation());
    setEditingLocation(null);
    setSearch('');
    setSuggestions([]);
    setSearchMessage('');
    setLocationMessage('');
    setShowForm(false);
  }

  function editLocation(location) {
    setEditingLocation(location);
    setForm({ name: location.name || '', address: location.address || '', city: location.city || '', state: location.state || '', country: location.country || '', latitude: String(location.latitude), longitude: String(location.longitude), allowedRadiusMeters: location.allowedRadiusMeters || 150 });
    setSearch(location.address || '');
    setShowForm(true);
  }

  function submit(event) {
    event.preventDefault();
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    const radius = Number(form.allowedRadiusMeters);
    if (!form.name.trim() || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isInteger(radius) || radius < 10 || radius > 5000) {
      toast.error('Enter an office name, valid map location, and a radius between 10 and 5,000 meters.');
      return;
    }
    save.mutate({ id: editingLocation?.id, payload: { ...form, name: form.name.trim(), latitude, longitude, allowedRadiusMeters: radius } });
  }

  return (
    <Panel title="Office locations" showForm={showForm} onToggleForm={() => { if (showForm) resetForm(); else setShowForm(true); }} form={(
      <form className="office-location-form" onSubmit={submit}>
        <div className="office-location-form__section">
          <div className="office-location-form__section-heading">
            <span className="office-location-form__step">01</span>
            <div>
              <h4>{editingLocation ? 'Edit office location' : 'Add office location'}</h4>
              <p>Name this workplace and find its address.</p>
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="office-name">Office Name</label>
            <input id="office-name" className="form-control" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Kilpauk Office" required />
          </div>
          <div className="position-relative">
            <label className="form-label" htmlFor="office-search">Search location</label>
            <div className="office-location-search-input">
              <Search size={17} aria-hidden="true" />
              <input id="office-search" value={search} onChange={(event) => searchLocation(event.target.value)} placeholder="Search company address..." autoComplete="off" />
              {searching && <span className="office-location-search-status">Searching</span>}
            </div>
            {searching && <div className="office-location-status">Searching locations...</div>}
            {!searching && searchMessage && <div className="office-location-status">{searchMessage}</div>}
            {suggestions.length > 0 && <div className="office-location-suggestions">{suggestions.map((location, index) => <button type="button" key={`${location.displayName}-${index}`} className="office-location-suggestion" onClick={() => selectLocation(location)}><MapPin size={15} /><span><strong>{location.city || location.displayName}</strong><small>{location.displayName}</small></span></button>)}</div>}
          </div>
        </div>

        <div className="office-location-form__section">
          <div className="office-location-form__section-heading">
            <span className="office-location-form__step">02</span>
            <div>
              <h4>Location preview</h4>
              <p>Review the address and coordinates before saving.</p>
            </div>
          </div>
          <div className="row g-3 mb-3">
            <div className="col-12 col-lg-7"><label className="form-label" htmlFor="office-address">Address</label><input id="office-address" className="form-control" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Automatically populated" /></div>
            <div className="col-12 col-lg-5"><label className="form-label" htmlFor="office-city">City</label><input id="office-city" className="form-control" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} placeholder="Chennai" /></div>
            <div className="col-12 col-md-6"><label className="form-label" htmlFor="office-state">State</label><input id="office-state" className="form-control" value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} placeholder="Tamil Nadu" /></div>
            <div className="col-12 col-md-6"><label className="form-label" htmlFor="office-country">Country</label><input id="office-country" className="form-control" value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} placeholder="India" /></div>
          </div>
          <div className="office-location-map-wrap">
            {form.latitude && form.longitude ? <OfficeLocationMap latitude={Number(form.latitude)} longitude={Number(form.longitude)} onPositionChange={({ latitude, longitude }) => reverseGeocode(latitude, longitude)} /> : <div className="office-location-map office-location-map--empty"><MapPin size={28} /><span>Select a search result to preview the location</span></div>}
            <Button type="button" size="sm" variant="secondary" icon={LocateFixed} onClick={useCurrentLocation} className="office-location-current">Use my current location</Button>
          </div>
          {reverseGeocoding && <div className="office-location-status">Updating address from the selected pin...</div>}
          {locationMessage && <div className="office-location-status office-location-status--warning">{locationMessage}</div>}
          <div className="row g-3">
            <div className="col-12 col-md-4"><label className="form-label" htmlFor="office-latitude">Latitude</label><input id="office-latitude" className="form-control" value={form.latitude} placeholder="Selected on map" readOnly required /></div>
            <div className="col-12 col-md-4"><label className="form-label" htmlFor="office-longitude">Longitude</label><input id="office-longitude" className="form-control" value={form.longitude} placeholder="Selected on map" readOnly required /></div>
            <div className="col-12 col-md-4"><label className="form-label" htmlFor="office-radius">Allowed radius</label><div className="input-group"><input id="office-radius" className="form-control" type="number" min="10" max="5000" value={form.allowedRadiusMeters} onChange={(event) => setForm({ ...form, allowedRadiusMeters: event.target.value })} required /><span className="input-group-text">meters</span></div></div>
          </div>
        </div>

        <div className="office-location-form__actions"><Button type="submit" icon={MapPin} loading={save.isPending} className="office-location-save">{editingLocation ? 'Update Location' : 'Save Location'}</Button></div>
      </form>
    )}>
    {isLoading && <SkeletonText lines={4} />}
    {!isLoading && locations?.length === 0 && <EmptyState icon={MapPin} title="No office locations yet" description="Add your first office and its GPS coordinates above." />}
    {!isLoading && locations?.map((location) => <Row key={location.id} left={location.name} sub={`${location.latitude}, ${location.longitude} · ${location.allowedRadiusMeters}m radius`} right={location.address || 'No address'} active={location.active} onEdit={() => editLocation(location)} onToggleActive={() => toggle.mutate({ id: location.id, active: location.active })} toggling={toggle.isPending} />)}
  </Panel>
  );
}

function emptyOfficeLocation() {
  return { name: '', address: '', city: '', state: '', country: '', latitude: '', longitude: '', allowedRadiusMeters: 150 };
}

function Panel({ title, showForm, onToggleForm, form, children }) {
  return (
    <Card
      title={title}
      actions={
        <Button size="sm" variant="secondary" icon={Plus} onClick={onToggleForm}>
          {showForm ? 'Close' : 'Add'}
        </Button>
      }
    >
      {showForm && <div className="mb-4 pb-3" style={{ borderBottom: '1px solid var(--hz-border)' }}>{form}</div>}
      <div className="d-flex flex-column gap-1">{children}</div>
    </Card>
  );
}

function Row({ left, sub, right, active, onEdit, onToggleActive, toggling }) {
  return (
    <div className="d-flex align-items-center justify-content-between py-2" style={{ borderBottom: '1px solid var(--hz-border)' }}>
      <div>
        <div style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 600 }}>{left}</div>
        <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{sub}</div>
      </div>
      <div className="d-flex align-items-center gap-2">
        <span style={{ fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-secondary)' }}>{right}</span>
        {onEdit && <button type="button" className="btn btn-sm btn-light border-0" onClick={onEdit} title="Edit office location" aria-label="Edit office location"><Pencil size={14} /></button>}
        {!active && <Badge variant="neutral">Inactive</Badge>}
        {onToggleActive && (
          <button
            type="button"
            className="btn btn-sm btn-light border-0"
            onClick={onToggleActive}
            disabled={toggling}
            style={{ fontSize: 12, color: active ? 'var(--hz-danger-600)' : 'var(--hz-success-600)' }}
          >
            {active ? 'Deactivate' : 'Activate'}
          </button>
        )}
      </div>
    </div>
  );
}
