import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, ImagePlus, Plus, Save, Trash2 } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Tabs from '../../components/ui/Tabs';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import {
  lettersApi, LETTER_TYPE_LABEL, apiMessage, placeholdersIn, renderSample, saveBlobResponse, SAMPLE_VALUES,
} from '../../api/endpoints/letters';
import { formatDateTimeIST } from '../../utils/formatDateTime';

const TABS = [
  { key: 'templates', label: 'Templates' },
  { key: 'letterhead', label: 'Letterhead' },
  { key: 'issued', label: 'Issued letters' },
];

/** Settings → Letter templates & letterhead (LETTER_MANAGE). */
export default function SettingsLetters() {
  const [tab, setTab] = useState('templates');
  return (
    <div className="hz-admin-page hz-settings-page d-flex flex-column gap-4">
      <PageHeader
        eyebrow="Settings"
        title="Letter templates"
        description="Templates for offer, appointment, confirmation, relieving and other HR letters, and the letterhead printed on every PDF."
      />
      <Tabs items={TABS} value={tab} onChange={setTab} />
      {tab === 'templates' && <TemplatesPanel />}
      {tab === 'letterhead' && <LetterheadPanel />}
      {tab === 'issued' && <IssuedPanel />}
    </div>
  );
}

const EMPTY_TEMPLATE = { letterType: 'CUSTOM', name: '', title: '', body: '', active: true };

function TemplatesPanel() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const textareaRef = useRef(null);
  const { data: templates, isLoading, isError, refetch } = useQuery({ queryKey: ['letters', 'templates'], queryFn: lettersApi.templates });
  const { data: placeholders } = useQuery({ queryKey: ['letters', 'placeholders'], queryFn: lettersApi.placeholders, staleTime: Infinity });
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(EMPTY_TEMPLATE);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selected = templates?.find((t) => t.id === selectedId) || null;

  useEffect(() => {
    if (selectedId == null && templates?.length) setSelectedId(templates[0].id);
  }, [templates, selectedId]);

  useEffect(() => {
    if (selected) {
      setForm({ letterType: selected.letterType, name: selected.name, title: selected.title, body: selected.body, active: selected.active });
      setDirty(false);
    }
    // Only reset the form when a different template (or a newly saved version) is selected.
  },[selected?.id, selected?.updatedAt]);

  const set = (key, value) => { setForm((f) => ({ ...f, [key]: value })); setDirty(true); };

  const save = useMutation({
    mutationFn: () => (selectedId === 'new' ? lettersApi.createTemplate(form) : lettersApi.updateTemplate(selectedId, form)),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['letters', 'templates'] });
      setSelectedId(saved.id);
      setDirty(false);
      toast.success('Template saved.');
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
  const remove = useMutation({
    mutationFn: () => lettersApi.deleteTemplate(selectedId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['letters', 'templates'] });
      setSelectedId(null);
      setConfirmDelete(false);
      toast.success('Template deleted.');
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  function insertPlaceholder(key) {
    const token = `{{${key}}}`;
    const el = textareaRef.current;
    const body = form.body || '';
    if (!el) { set('body', body + token); return; }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    set('body', body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const known = new Set(Object.keys(SAMPLE_VALUES));
  const unknown = placeholdersIn(`${form.title} ${form.body}`).filter((p) => !known.has(p) && !/^custom\.[A-Za-z][A-Za-z0-9_]*$/.test(p));
  const grouped = (placeholders || []).reduce((acc, p) => {
    (acc[p.group] = acc[p.group] || []).push(p.key);
    return acc;
  }, {});

  if (isLoading) return <Card><SkeletonText lines={8} /></Card>;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="row g-3">
      <div className="col-12 col-lg-3">
        <Card title="Templates" actions={<Button size="sm" variant="secondary" icon={Plus} onClick={() => { setSelectedId('new'); setForm(EMPTY_TEMPLATE); setDirty(false); }}>New</Button>}>
          <div className="list-group list-group-flush">
            {(templates || []).map((t) => (
              <button
                key={t.id}
                type="button"
                className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${t.id === selectedId ? 'active' : ''}`}
                onClick={() => setSelectedId(t.id)}
              >
                <span>
                  {t.name}
                  <div className="small opacity-75">{LETTER_TYPE_LABEL[t.letterType] || t.letterType}</div>
                </span>
                {!t.active && <Badge variant="neutral">Off</Badge>}
              </button>
            ))}
            {selectedId === 'new' && <div className="list-group-item active">New template</div>}
          </div>
        </Card>
      </div>

      <div className="col-12 col-lg-9">
        {selectedId == null ? (
          <Card><EmptyState icon={FileText} title="Select a template" description="Pick a template on the left or create a new one." /></Card>
        ) : (
          <Card
            title={selectedId === 'new' ? 'New template' : form.name || 'Template'}
            subtitle={selected?.builtIn ? 'Built-in template - you can edit or deactivate it.' : undefined}
            actions={(
              <div className="d-flex gap-2">
                {selected && !selected.builtIn && (
                  <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setConfirmDelete(true)}>Delete</Button>
                )}
                <Button size="sm" icon={Save} loading={save.isPending} disabled={!dirty || unknown.length > 0} onClick={() => save.mutate()}>Save</Button>
              </div>
            )}
          >
            <div className="row g-3">
              <div className="col-12 col-md-4"><FormField label="Name" value={form.name} onChange={(v) => set('name', v)} required /></div>
              <div className="col-12 col-md-4">
                <FormField as="select" label="Letter type" value={form.letterType} onChange={(v) => set('letterType', v)}>
                  {Object.entries(LETTER_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </FormField>
              </div>
              <div className="col-12 col-md-4 d-flex align-items-end">
                <div className="form-check mb-2">
                  <input id="tpl-active" className="form-check-input" type="checkbox" checked={!!form.active} onChange={(e) => set('active', e.target.checked)} />
                  <label className="form-check-label" htmlFor="tpl-active">Active</label>
                </div>
              </div>
              <div className="col-12"><FormField label="Letter heading" value={form.title} onChange={(v) => set('title', v)} required /></div>

              <div className="col-12 col-xl-7">
                <label className="form-label" htmlFor="letter-body" style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 500 }}>Body</label>
                <textarea
                  id="letter-body"
                  ref={textareaRef}
                  className="form-control"
                  rows={18}
                  value={form.body}
                  onChange={(e) => set('body', e.target.value)}
                  style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}
                />
                {unknown.length > 0 && (
                  <div className="small mt-1" style={{ color: 'var(--hz-danger-600)' }} role="alert">
                    Unknown placeholders: {unknown.join(', ')}. Use the picker, or prefix free-text fields with custom. (for example custom.purpose).
                  </div>
                )}
                <div className="small text-muted mt-1">
                  Use custom.anything for values typed in at generation time. The signatory block and letterhead are added automatically.
                </div>
              </div>
              <div className="col-12 col-xl-5">
                <div className="small fw-semibold mb-1">Insert placeholder</div>
                <div className="d-flex flex-column gap-2 mb-3" style={{ maxHeight: 180, overflow: 'auto' }}>
                  {Object.entries(grouped).map(([group, keys]) => (
                    <div key={group}>
                      <div className="small text-muted text-capitalize">{group}</div>
                      <div className="d-flex flex-wrap gap-1">
                        {keys.map((key) => (
                          <button key={key} type="button" className="btn btn-sm btn-light py-0" onClick={() => insertPlaceholder(key)}>
                            {key}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="small fw-semibold mb-1">Live preview (sample data)</div>
                <div
                  className="p-3 rounded"
                  style={{ border: '1px solid var(--hz-border)', whiteSpace: 'pre-wrap', maxHeight: 360, overflow: 'auto', fontFamily: 'Georgia, serif', fontSize: 13 }}
                  aria-live="polite"
                >
                  <strong className="d-block text-center mb-2">{renderSample(form.title)}</strong>
                  {renderSample(form.body)}
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete template?"
        description="Letters already issued from it are kept."
        confirmLabel="Delete"
        irreversible
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}

function LetterheadPanel() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fileRef = useRef(null);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['letters', 'letterhead'], queryFn: lettersApi.letterhead });
  const [form, setForm] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);

  useEffect(() => {
    if (data) {
      setForm({
        address: data.address || '',
        signatoryName: data.signatoryName || '',
        signatoryDesignation: data.signatoryDesignation || '',
        footer: data.footer || '',
      });
    }
  }, [data]);

  useEffect(() => {
    let url = null;
    let cancelled = false;
    if (data?.hasLogo) {
      lettersApi.logo().then((res) => {
        if (cancelled) return;
        url = window.URL.createObjectURL(res.data);
        setLogoUrl(url);
      }).catch(() => setLogoUrl(null));
    } else {
      setLogoUrl(null);
    }
    return () => {
      cancelled = true;
      if (url) window.URL.revokeObjectURL(url);
    };
  }, [data?.hasLogo]);

  const onSuccess = (message) => (result) => {
    queryClient.setQueryData(['letters', 'letterhead'], result);
    toast.success(message);
  };
  const onError = (error) => toast.error(apiMessage(error));
  const save = useMutation({ mutationFn: () => lettersApi.updateLetterhead(form), onSuccess: onSuccess('Letterhead saved.'), onError });
  const upload = useMutation({ mutationFn: lettersApi.uploadLogo, onSuccess: onSuccess('Logo uploaded.'), onError });
  const removeLogo = useMutation({ mutationFn: lettersApi.removeLogo, onSuccess: onSuccess('Logo removed.'), onError });

  if (isLoading || !form) return isError ? <ErrorState onRetry={refetch} /> : <Card><SkeletonText lines={6} /></Card>;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="row g-3">
      <div className="col-12 col-lg-7">
        <Card title="Letterhead" subtitle={`Company name on letters: ${data.companyName || '-'} (from organization settings)`}>
          <div className="d-flex flex-column gap-3">
            <FormField as="textarea" rows={3} label="Address" value={form.address} onChange={(v) => set('address', v)} hint="Printed under the company name; one line per row. Also used for {{company.address}}." />
            <div className="row g-3">
              <div className="col-12 col-md-6"><FormField label="Signatory name" value={form.signatoryName} onChange={(v) => set('signatoryName', v)} /></div>
              <div className="col-12 col-md-6"><FormField label="Signatory designation" value={form.signatoryDesignation} onChange={(v) => set('signatoryDesignation', v)} /></div>
            </div>
            <FormField label="Footer" value={form.footer} onChange={(v) => set('footer', v)} hint="E.g. registered office, CIN, website." />
            <div><Button icon={Save} loading={save.isPending} onClick={() => save.mutate()}>Save letterhead</Button></div>
          </div>
        </Card>
      </div>
      <div className="col-12 col-lg-5">
        <Card title="Logo" subtitle="PNG or JPG, up to 1 MB">
          <div className="d-flex flex-column gap-3 align-items-start">
            {logoUrl
              ? <img src={logoUrl} alt="Company logo" style={{ maxHeight: 80, maxWidth: '100%' }} />
              : <span className="text-muted small">No logo uploaded.</span>}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg"
              className="d-none"
              aria-label="Upload logo"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload.mutate(file);
                e.target.value = '';
              }}
            />
            <div className="d-flex gap-2">
              <Button variant="secondary" icon={ImagePlus} loading={upload.isPending} onClick={() => fileRef.current?.click()}>
                {data.hasLogo ? 'Replace logo' : 'Upload logo'}
              </Button>
              {data.hasLogo && <Button variant="ghost" loading={removeLogo.isPending} onClick={() => removeLogo.mutate()}>Remove</Button>}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function IssuedPanel() {
  const toast = useToast();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['letters', 'recent'], queryFn: lettersApi.recent });

  async function download(letter) {
    try {
      saveBlobResponse(await lettersApi.download(letter.id), letter.fileName || 'letter.pdf');
    } catch (error) {
      toast.error(apiMessage(error, 'Could not download the letter.'));
    }
  }

  if (isLoading) return <Card><SkeletonText lines={6} /></Card>;
  if (isError) return <ErrorState onRetry={refetch} />;
  const letters = data || [];

  return (
    <Card title="Recently issued letters" subtitle="Generate new letters from an employee's profile (Letters tab).">
      {letters.length === 0 ? (
        <EmptyState icon={FileText} title="No letters issued yet" />
      ) : (
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th scope="col">Letter</th>
                <th scope="col">Issued to</th>
                <th scope="col">Issued</th>
                <th scope="col">Email</th>
                <th scope="col" className="text-end">File</th>
              </tr>
            </thead>
            <tbody>
              {letters.map((l) => (
                <tr key={l.id}>
                  <td className="fw-semibold">{l.title}<div className="small text-muted">{LETTER_TYPE_LABEL[l.letterType] || l.letterType}</div></td>
                  <td>
                    {l.employeeId
                      ? <Link to={`/employees/${l.employeeId}?tab=letters`}>{l.employeeName}</Link>
                      : <span>Candidate #{l.candidateId}</span>}
                  </td>
                  <td className="small">{formatDateTimeIST(l.issuedAt)}<div className="text-muted">{l.issuedBy}</div></td>
                  <td>{l.emailStatus ? <Badge variant={l.emailStatus === 'SENT' ? 'success' : 'danger'}>{l.emailStatus === 'SENT' ? 'Sent' : 'Failed'}</Badge> : <span className="text-muted small">-</span>}</td>
                  <td className="text-end">
                    {l.employeeId && <Button size="sm" variant="ghost" icon={Download} onClick={() => download(l)}>Download</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
