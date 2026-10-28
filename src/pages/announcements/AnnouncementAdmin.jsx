import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Send, Trash2, ListChecks, Download, BellRing, Megaphone, Pin } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Dialog from '../../components/ui/Dialog';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import FormField from '../../components/ui/FormField';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { announcementsApi } from '../../api/endpoints/announcements';
import { departmentsApi } from '../../api/endpoints/organization';
import { formatDateIST, formatDateTimeIST } from '../../utils/formatDateTime';
import AnnouncementBody from './AnnouncementBody';
import { ANNOUNCEMENT_CATEGORIES, categoryMeta, toDateTimeLocal } from './announcementMeta';

const errorMessage = (error, fallback) => error?.response?.data?.message || fallback;

function toForm(item) {
  return {
    title: item?.title || '',
    body: item?.body || '',
    category: item?.category || 'GENERAL',
    audienceType: item?.audienceType || 'ALL',
    departmentIds: (item?.departmentIds || []).map(String),
    publishMode: item?.status === 'SCHEDULED' ? 'SCHEDULE' : 'DRAFT',
    publishAt: toDateTimeLocal(item?.publishAt),
    expiresAt: toDateTimeLocal(item?.expiresAt),
    pinned: !!item?.pinned,
    requiresAcknowledgement: !!item?.requiresAcknowledgement,
    acknowledgementDueDate: item?.acknowledgementDueDate || '',
  };
}

function statusLabel(item) {
  if (item.status === 'PUBLISHED' && item.expired) return { status: 'EXPIRED', label: 'Expired' };
  if (item.status === 'SCHEDULED') return { status: 'SCHEDULED', label: `Scheduled · ${formatDateTimeIST(item.publishAt)}` };
  return { status: item.status, label: item.status === 'PUBLISHED' ? 'Published' : 'Draft' };
}

export default function AnnouncementAdmin() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // null | 'new' | item
  const [form, setForm] = useState(toForm(null));
  const [file, setFile] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [tracking, setTracking] = useState(null);

  const list = useQuery({ queryKey: ['announcements-admin'], queryFn: announcementsApi.adminList });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: departmentsApi.list, retry: false });
  const items = Array.isArray(list.data) ? list.data : [];
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['announcements-admin'] });
    queryClient.invalidateQueries({ queryKey: ['announcements-feed'] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        departmentIds: form.audienceType === 'DEPARTMENTS' ? form.departmentIds.map(Number) : [],
        publishAt: form.publishMode === 'SCHEDULE' && form.publishAt ? form.publishAt : null,
        expiresAt: form.expiresAt || null,
        acknowledgementDueDate: form.requiresAcknowledgement && form.acknowledgementDueDate ? form.acknowledgementDueDate : null,
      };
      let saved = editing === 'new' ? await announcementsApi.create(payload) : await announcementsApi.update(editing.id, payload);
      if (file) saved = await announcementsApi.uploadAttachment(saved.id, file);
      return saved;
    },
    onSuccess: (saved) => {
      refresh();
      setEditing(null);
      toast.success(saved.status === 'PUBLISHED' ? 'Announcement published.' : saved.status === 'SCHEDULED' ? 'Announcement scheduled.' : 'Draft saved.');
    },
    onError: (error) => { refresh(); toast.error(errorMessage(error, 'Could not save the announcement.')); },
  });

  const publish = useMutation({
    mutationFn: (id) => announcementsApi.publish(id),
    onSuccess: () => { refresh(); toast.success('Announcement published and audience notified.'); },
    onError: (error) => toast.error(errorMessage(error, 'Could not publish.')),
  });

  const remove = useMutation({
    mutationFn: (id) => announcementsApi.remove(id),
    onSuccess: () => { refresh(); setDeleting(null); toast.success('Announcement deleted.'); },
    onError: (error) => toast.error(errorMessage(error, 'Could not delete.')),
  });

  const removeAttachment = useMutation({
    mutationFn: (id) => announcementsApi.removeAttachment(id),
    onSuccess: (saved) => { refresh(); setEditing(saved); toast.success('Attachment removed.'); },
    onError: (error) => toast.error(errorMessage(error, 'Could not remove the attachment.')),
  });

  const openEditor = (item) => { setEditing(item || 'new'); setForm(toForm(item)); setFile(null); };
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  const isPublished = editing && editing !== 'new' && editing.status === 'PUBLISHED';

  const chooseFile = (chosen) => {
    if (!chosen) { setFile(null); return; }
    if (!/\.(pdf|jpe?g|png)$/i.test(chosen.name) || chosen.size > 10 * 1024 * 1024) {
      toast.error('Attachments must be PDF, JPG or PNG up to 10 MB.');
      return;
    }
    setFile(chosen);
  };

  const toggleDepartment = (id) => setForm((current) => ({
    ...current,
    departmentIds: current.departmentIds.includes(id) ? current.departmentIds.filter((value) => value !== id) : [...current.departmentIds, id],
  }));

  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Company" title="Manage announcements" description="Publish news and policies, schedule posts, and track acknowledgements" actions={<Button icon={Plus} onClick={() => openEditor(null)}>New announcement</Button>} />

      <Card bodyClassName="p-0">
        {list.isLoading && <div className="p-4"><SkeletonText lines={6} /></div>}
        {list.isError && <ErrorState description="Couldn't load announcements." onRetry={list.refetch} />}
        {!list.isLoading && !list.isError && items.length === 0 && (
          <EmptyState icon={Megaphone} title="No announcements yet" description="Create your first announcement for the whole company or selected departments." action={<Button icon={Plus} onClick={() => openEditor(null)}>New announcement</Button>} />
        )}
        {items.length > 0 && (
          <div className="table-responsive">
            <table className="table mb-0 align-middle hz-table" aria-label="Announcements">
              <thead>
                <tr style={{ fontSize: 'var(--hz-text-xs)', color: 'var(--hz-text-muted)', textTransform: 'uppercase' }}>
                  <th className="ps-4">Announcement</th>
                  <th>Audience</th>
                  <th>Status</th>
                  <th>Read</th>
                  <th>Acknowledged</th>
                  <th className="pe-4 text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const status = statusLabel(item);
                  const category = categoryMeta(item.category);
                  return (
                    <tr key={item.id}>
                      <td className="ps-4">
                        <div className="d-flex align-items-center gap-2" style={{ fontWeight: 600, fontSize: 'var(--hz-text-sm)' }}>
                          {item.pinned && <Pin size={13} aria-label="Pinned" />}{item.title}
                        </div>
                        <div className="d-flex gap-2 align-items-center" style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>
                          <Badge variant={category.variant}>{category.label}</Badge>
                          {item.publishedAt ? formatDateTimeIST(item.publishedAt) : `Created ${formatDateIST(item.createdAt)}`}
                        </div>
                      </td>
                      <td style={{ fontSize: 'var(--hz-text-sm)' }}>{item.audienceType === 'ALL' ? 'Everyone' : item.departmentNames.join(', ')}<div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{item.audienceCount} people</div></td>
                      <td><StatusBadge status={status.status}>{status.label}</StatusBadge></td>
                      <td style={{ fontSize: 'var(--hz-text-sm)' }}>{item.status === 'PUBLISHED' ? `${item.readCount}/${item.audienceCount}` : '—'}</td>
                      <td style={{ fontSize: 'var(--hz-text-sm)' }}>{item.requiresAcknowledgement ? (item.status === 'PUBLISHED' ? `${item.acknowledgedCount}/${item.audienceCount}` : 'Required') : '—'}</td>
                      <td className="pe-4 text-end">
                        <div className="d-flex justify-content-end gap-2 flex-wrap">
                          <Button size="sm" variant="secondary" icon={Pencil} onClick={() => openEditor(item)} aria-label={`Edit ${item.title}`}>Edit</Button>
                          {item.status !== 'PUBLISHED' && <Button size="sm" icon={Send} loading={publish.isPending && publish.variables === item.id} onClick={() => publish.mutate(item.id)}>Publish now</Button>}
                          {item.status === 'PUBLISHED' && <Button size="sm" variant="secondary" icon={ListChecks} onClick={() => setTracking(item)}>Tracker</Button>}
                          <Button size="sm" variant="secondary" icon={Trash2} onClick={() => setDeleting(item)} aria-label={`Delete ${item.title}`} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!editing} onClose={() => setEditing(null)} size="lg" title={editing === 'new' ? 'New announcement' : 'Edit announcement'} description={isPublished ? 'Already published - edits update the post but do not notify again.' : 'Plain text; line breaks and links are kept.'}>
        <form onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
          <div className="row">
            <FormField col={8} label="Title" required maxLength={200} value={form.title} onChange={set('title')} />
            <FormField col={4} as="select" label="Category" value={form.category} onChange={set('category')}>
              {ANNOUNCEMENT_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
            </FormField>
          </div>
          <FormField as="textarea" rows={8} label="Message" required maxLength={20000} value={form.body} onChange={set('body')} placeholder="Write the announcement. Paste links as https://..." />

          <fieldset className="mb-3">
            <legend className="hz-form-label">Audience</legend>
            <div className="d-flex gap-3">
              {[['ALL', 'Everyone'], ['DEPARTMENTS', 'Selected departments']].map(([value, label]) => (
                <label key={value} className="d-flex gap-2 align-items-center"><input type="radio" name="audienceType" className="form-check-input mt-0" checked={form.audienceType === value} onChange={() => set('audienceType')(value)} /> {label}</label>
              ))}
            </div>
            {form.audienceType === 'DEPARTMENTS' && (
              <div className="d-flex flex-wrap gap-3 mt-2">
                {(Array.isArray(departments) ? departments : []).map((department) => (
                  <label key={department.id} className="d-flex gap-1 align-items-center" style={{ fontSize: 'var(--hz-text-sm)' }}>
                    <input type="checkbox" className="form-check-input mt-0" checked={form.departmentIds.includes(String(department.id))} onChange={() => toggleDepartment(String(department.id))} /> {department.name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          {!isPublished && (
            <fieldset className="mb-3">
              <legend className="hz-form-label">Publishing</legend>
              <div className="d-flex gap-3 flex-wrap">
                {[['DRAFT', 'Save as draft'], ['NOW', 'Publish now'], ['SCHEDULE', 'Schedule']].map(([value, label]) => (
                  <label key={value} className="d-flex gap-2 align-items-center"><input type="radio" name="publishMode" className="form-check-input mt-0" checked={form.publishMode === value} onChange={() => set('publishMode')(value)} /> {label}</label>
                ))}
              </div>
              {form.publishMode === 'SCHEDULE' && (
                <div className="mt-2" style={{ maxWidth: 280 }}>
                  <FormField type="datetime-local" label="Publish at (IST)" required value={form.publishAt} onChange={set('publishAt')} hint="Scheduled posts go live within 5 minutes of this time." />
                </div>
              )}
            </fieldset>
          )}

          <div className="row">
            <FormField col={6} type="datetime-local" label="Expires at (IST, optional)" value={form.expiresAt} onChange={set('expiresAt')} />
            <div className="col-12 col-md-6 mb-3 d-flex flex-column justify-content-end gap-1">
              <label className="d-flex gap-2 align-items-center"><input type="checkbox" className="form-check-input mt-0" checked={form.pinned} onChange={(event) => set('pinned')(event.target.checked)} /> Pin to top of the feed</label>
              <label className="d-flex gap-2 align-items-center"><input type="checkbox" className="form-check-input mt-0" checked={form.requiresAcknowledgement} onChange={(event) => set('requiresAcknowledgement')(event.target.checked)} /> Requires acknowledgement</label>
            </div>
            {form.requiresAcknowledgement && <FormField col={6} type="date" label="Acknowledge by" value={form.acknowledgementDueDate} onChange={set('acknowledgementDueDate')} />}
            <div className="col-12 col-md-6 mb-3">
              <label className="hz-form-label" htmlFor="announcement-attachment">Attachment (PDF/JPG/PNG, optional)</label>
              <input id="announcement-attachment" type="file" className="form-control" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => chooseFile(event.target.files?.[0])} />
              {editing && editing !== 'new' && editing.hasAttachment && !file && (
                <div className="d-flex align-items-center gap-2 mt-1" style={{ fontSize: 12 }}>
                  Current: {editing.attachmentFileName}
                  <button type="button" className="btn btn-link btn-sm p-0" onClick={() => removeAttachment.mutate(editing.id)}>Remove</button>
                </div>
              )}
            </div>
          </div>

          {form.body && (
            <details className="mb-3">
              <summary style={{ fontSize: 'var(--hz-text-sm)' }}>Preview</summary>
              <div className="border rounded p-3 mt-2"><strong>{form.title}</strong><AnnouncementBody text={form.body} /></div>
            </details>
          )}

          <div className="d-flex justify-content-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" loading={save.isPending} disabled={!form.title.trim() || !form.body.trim()}>
              {isPublished ? 'Save changes' : form.publishMode === 'NOW' ? 'Publish' : form.publishMode === 'SCHEDULE' ? 'Schedule' : 'Save draft'}
            </Button>
          </div>
        </form>
      </Dialog>

      {tracking && <AcknowledgementTracker announcement={tracking} onClose={() => setTracking(null)} />}

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id)} loading={remove.isPending} title="Delete announcement?" description={deleting ? `"${deleting.title}" will be removed from everyone's feed.` : ''} confirmLabel="Delete" />
    </div>
  );
}

function AcknowledgementTracker({ announcement, onClose }) {
  const toast = useToast();
  const [view, setView] = useState('pending');
  const report = useQuery({ queryKey: ['announcement-acks', announcement.id], queryFn: () => announcementsApi.acknowledgements(announcement.id) });
  const remind = useMutation({
    mutationFn: () => announcementsApi.remind(announcement.id),
    onSuccess: (result) => toast.success(result.reminded ? `Reminder sent to ${result.reminded} employee(s).` : 'Everyone has acknowledged or was already reminded today.'),
    onError: (error) => toast.error(errorMessage(error, 'Could not send reminders.')),
  });
  const exportCsv = async () => {
    try {
      await announcementsApi.exportAcknowledgements(announcement.id);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not export.'));
    }
  };
  const data = report.data;
  const rows = (data?.rows || []).filter((row) => (view === 'pending'
    ? (data.requiresAcknowledgement ? !row.acknowledgedAt : !row.readAt)
    : true));

  return (
    <Dialog open onClose={onClose} size="lg" title="Acknowledgement tracker" description={announcement.title}>
      {report.isLoading && <SkeletonText lines={5} />}
      {report.isError && <ErrorState description="Couldn't load the tracker." onRetry={report.refetch} />}
      {data && (
        <div className="d-flex flex-column gap-3">
          <div className="hz-inline-summary" aria-label="Acknowledgement summary">
            <div className="hz-inline-summary__item hz-inline-summary__item--neutral"><strong>{data.audienceCount}</strong><span>Audience</span></div>
            <div className="hz-inline-summary__item hz-inline-summary__item--neutral"><strong>{data.readCount}</strong><span>Read</span></div>
            {data.requiresAcknowledgement && <div className="hz-inline-summary__item hz-inline-summary__item--success"><strong>{data.acknowledgedCount}</strong><span>Acknowledged</span></div>}
            {data.requiresAcknowledgement && <div className="hz-inline-summary__item hz-inline-summary__item--warning"><strong>{data.pendingCount}</strong><span>Pending{data.acknowledgementDueDate ? ` (due ${formatDateIST(data.acknowledgementDueDate)})` : ''}</span></div>}
          </div>
          <div className="d-flex justify-content-between flex-wrap gap-2">
            <div className="btn-group btn-group-sm" role="group" aria-label="Tracker filter">
              <button type="button" className={`btn ${view === 'pending' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setView('pending')}>{data.requiresAcknowledgement ? 'Pending' : 'Unread'}</button>
              <button type="button" className={`btn ${view === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setView('all')}>Everyone</button>
            </div>
            <div className="d-flex gap-2">
              <Button size="sm" variant="secondary" icon={Download} onClick={exportCsv}>Export CSV</Button>
              {data.requiresAcknowledgement && <Button size="sm" icon={BellRing} loading={remind.isPending} disabled={!data.pendingCount} onClick={() => remind.mutate()}>Remind pending</Button>}
            </div>
          </div>
          <div className="table-responsive" style={{ maxHeight: 360 }}>
            <table className="table mb-0 align-middle hz-table" aria-label="Acknowledgements">
              <thead>
                <tr style={{ fontSize: 'var(--hz-text-xs)', color: 'var(--hz-text-muted)', textTransform: 'uppercase' }}>
                  <th>Employee</th><th>Department</th><th>Read</th>{data.requiresAcknowledgement && <th>Acknowledged</th>}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={4} className="text-center" style={{ color: 'var(--hz-text-muted)' }}>Nobody here.</td></tr>}
                {rows.map((row) => (
                  <tr key={row.employeeId} style={{ fontSize: 'var(--hz-text-sm)' }}>
                    <td>{row.employeeName}{row.employeeCode ? <small style={{ color: 'var(--hz-text-muted)' }}> · {row.employeeCode}</small> : null}</td>
                    <td>{row.departmentName || '—'}</td>
                    <td>{row.readAt ? formatDateTimeIST(row.readAt) : '—'}</td>
                    {data.requiresAcknowledgement && <td>{row.acknowledgedAt ? formatDateTimeIST(row.acknowledgedAt) : 'Pending'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Dialog>
  );
}
