import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Play, Save, Table2, Trash2 } from 'lucide-react';
import { reportBuilderApi } from '../../api/endpoints/platform';
import { errorText } from '../../api/endpoints/workflows';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Dialog from '../../components/ui/Dialog';
import FormField from '../../components/ui/FormField';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';

const fmt = (v, type) => {
  if (v == null || v === '') return '—';
  if (type === 'NUMBER') return Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return String(v);
};

/** Build a report from a dataset: pick columns, filter, group, save and export. */
export default function ReportBuilder() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: datasets = [], isLoading } = useQuery({ queryKey: ['rb-datasets'], queryFn: reportBuilderApi.datasets });
  const { data: saved = [] } = useQuery({ queryKey: ['rb-saved'], queryFn: reportBuilderApi.saved });
  const [def, setDef] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const dataset = datasets.find((d) => d.key === def?.dataset);

  useEffect(() => {
    if (!def && datasets.length) pick(datasets[0]);
  }, [datasets]); // eslint-disable-line react-hooks/exhaustive-deps

  function pick(ds) {
    setSavedId(null);
    setResult(null);
    setDef({ dataset: ds.key, columns: ds.fields.slice(0, 6).map((f) => f.key), filters: { from: '', to: '', search: '', departments: [], statuses: [] }, groupBy: '', sortBy: '', sortDir: 'ASC' });
  }

  const payload = useMemo(() => def && ({
    ...def,
    groupBy: def.groupBy || null,
    sortBy: def.sortBy || null,
    filters: { ...def.filters, from: def.filters.from || null, to: def.filters.to || null, search: def.filters.search || null },
  }), [def]);

  const run = useMutation({ mutationFn: () => reportBuilderApi.run(payload), onSuccess: setResult, onError: (e) => toast.error(errorText(e, 'Could not run the report.')) });
  const exportCsv = useMutation({
    mutationFn: () => reportBuilderApi.export(payload),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${def.dataset.toLowerCase()}-report.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    },
    onError: (e) => toast.error(errorText(e, 'Could not export.')),
  });
  const remove = useMutation({ mutationFn: reportBuilderApi.remove, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rb-saved'] }); setSavedId(null); toast.success('Report deleted.'); } });

  const setFilter = (k, v) => setDef((d) => ({ ...d, filters: { ...d.filters, [k]: v } }));
  const toggleColumn = (key) => setDef((d) => ({ ...d, columns: d.columns.includes(key) ? d.columns.filter((c) => c !== key) : [...d.columns, key] }));

  if (isLoading) return <Card><SkeletonText lines={5} /></Card>;
  if (!datasets.length) {
    return (
      <div className="hz-module-page d-flex flex-column gap-4">
        <PageHeader eyebrow="Insights" title="Report builder" description="Build your own reports" />
        <Card><EmptyState icon={Table2} title="No data you can report on" description="Ask an admin for access to employees, leave, attendance, expenses or timesheets." /></Card>
      </div>
    );
  }
  const current = saved.find((s) => s.id === savedId);
  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="Insights" title="Report builder" description="Pick a dataset and columns, filter and group, then save or export to Excel (CSV)" />
      <div className="row g-3">
        <div className="col-12 col-lg-4">
          <Card title="Report">
            {saved.length > 0 && (
              <FormField as="select" label="Saved reports" value={savedId || ''} onChange={(v) => {
                const s = saved.find((x) => String(x.id) === v);
                if (!s) { setSavedId(null); return; }
                setSavedId(s.id);
                setResult(null);
                const ds = datasets.find((d) => d.key === s.dataset);
                setDef({ columns: ds ? ds.fields.map((f) => f.key) : [], groupBy: '', sortBy: '', sortDir: 'ASC', ...s.definition, dataset: s.dataset,
                  filters: { from: '', to: '', search: '', departments: [], statuses: [], ...(s.definition.filters || {}) } });
              }}>
                <option value="">New report</option>
                {saved.map((s) => <option key={s.id} value={s.id}>{s.name}{s.shared && !s.mine ? ` (by ${s.createdByName})` : ''}</option>)}
              </FormField>
            )}
            <FormField as="select" label="Data" value={def?.dataset || ''} onChange={(v) => pick(datasets.find((d) => d.key === v))}>
              {datasets.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </FormField>
            {dataset && (
              <>
                <div className="row g-2">
                  <FormField col={6} type="date" label={`From${dataset.maxRangeDays ? ' *' : ''}`} value={def.filters.from || ''} onChange={(v) => setFilter('from', v)} />
                  <FormField col={6} type="date" label={`To${dataset.maxRangeDays ? ' *' : ''}`} value={def.filters.to || ''} onChange={(v) => setFilter('to', v)} />
                </div>
                {dataset.maxRangeDays > 0 && <p style={{ fontSize: 11, color: 'var(--hz-text-muted)' }}>Up to {dataset.maxRangeDays} days.</p>}
                <FormField label="Contains text" value={def.filters.search || ''} onChange={(v) => setFilter('search', v)} placeholder="Name, code, anything…" />
                <FormField as="select" label="Group by" value={def.groupBy || ''} onChange={(v) => setDef((d) => ({ ...d, groupBy: v }))} hint="Shows a count and totals per group">
                  <option value="">No grouping</option>
                  {dataset.fields.filter((f) => f.type !== 'NUMBER').map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </FormField>
                <div className="row g-2">
                  <FormField col={7} as="select" label="Sort by" value={def.sortBy || ''} onChange={(v) => setDef((d) => ({ ...d, sortBy: v }))}>
                    <option value="">First column</option>
                    {(def.groupBy ? [{ key: def.groupBy, label: dataset.fields.find((f) => f.key === def.groupBy)?.label }, { key: 'count', label: 'Count' }] : dataset.fields.filter((f) => def.columns.includes(f.key)))
                      .map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </FormField>
                  <FormField col={5} as="select" label="Order" value={def.sortDir} onChange={(v) => setDef((d) => ({ ...d, sortDir: v }))}>
                    <option value="ASC">A → Z / low → high</option>
                    <option value="DESC">Z → A / high → low</option>
                  </FormField>
                </div>
                {!def.groupBy && (
                  <>
                    <div className="mt-2 mb-1"><strong style={{ fontSize: 13 }}>Columns</strong></div>
                    <div className="d-flex flex-column gap-1">
                      {dataset.fields.map((f) => (
                        <label key={f.key} className="form-check d-flex align-items-center gap-2" style={{ fontSize: 13 }}>
                          <input type="checkbox" className="form-check-input m-0" checked={def.columns.includes(f.key)} onChange={() => toggleColumn(f.key)} /> {f.label}
                        </label>
                      ))}
                    </div>
                  </>
                )}
                <div className="d-flex flex-wrap gap-2 mt-3">
                  <Button icon={Play} loading={run.isPending} disabled={!def.groupBy && !def.columns.length} onClick={() => run.mutate()}>Run</Button>
                  <Button variant="secondary" icon={Download} loading={exportCsv.isPending} onClick={() => exportCsv.mutate()}>Export</Button>
                  <Button variant="secondary" icon={Save} onClick={() => setSaving(true)}>Save</Button>
                  {current?.mine && <button type="button" className="btn btn-sm btn-light border-0" aria-label="Delete saved report" onClick={() => remove.mutate(current.id)}><Trash2 size={14} /></button>}
                </div>
              </>
            )}
          </Card>
        </div>
        <div className="col-12 col-lg-8">
          <Card title={result ? `${result.totalRows.toLocaleString('en-IN')} row${result.totalRows === 1 ? '' : 's'}` : 'Results'}
            subtitle={result?.truncated ? 'Showing the first 5,000 rows - export to get everything' : undefined}>
            {run.isPending ? <SkeletonText lines={6} /> : !result ? (
              <EmptyState icon={Table2} title="Run the report" description="Choose what you want on the left, then press Run." />
            ) : !result.rows.length ? <EmptyState icon={Table2} title="No rows" description="Nothing matches these filters." /> : (
              <div className="table-responsive" style={{ maxHeight: 600 }}>
                <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--hz-surface, #fff)' }}>
                    <tr>{result.columns.map((c) => <th key={c.key} className={c.type === 'NUMBER' ? 'text-end' : ''}>{c.label}</th>)}</tr>
                  </thead>
                  <tbody>{result.rows.map((r, i) => (
                    <tr key={i}>{result.columns.map((c) => <td key={c.key} className={c.type === 'NUMBER' ? 'text-end' : ''}>{fmt(r[c.key], c.type)}</td>)}</tr>
                  ))}</tbody>
                  {Object.keys(result.totals || {}).length > 0 && (
                    <tfoot><tr>{result.columns.map((c, i) => <th key={c.key} className={c.type === 'NUMBER' ? 'text-end' : ''}>{i === 0 && !(c.key in result.totals) ? 'Total' : c.key in result.totals ? fmt(result.totals[c.key], 'NUMBER') : ''}</th>)}</tr></tfoot>
                  )}
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
      {saving && <SaveDialog def={payload} current={current} onClose={() => setSaving(false)} onSaved={(s) => { setSavedId(s.id); setSaving(false); }} />}
    </div>
  );
}

function SaveDialog({ def, current, onClose, onSaved }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState(current?.mine ? current.name : '');
  const [shared, setShared] = useState(current?.mine ? current.shared : false);
  const save = useMutation({
    mutationFn: (asNew) => reportBuilderApi.save(asNew || !current?.mine ? null : current.id, { name, shared, definition: def }),
    onSuccess: (s) => { queryClient.invalidateQueries({ queryKey: ['rb-saved'] }); toast.success('Report saved.'); onSaved(s); },
    onError: (e) => toast.error(errorText(e, 'Could not save.')),
  });
  return (
    <Dialog open onClose={onClose} title="Save report" size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        {current?.mine && <Button variant="secondary" disabled={!name.trim()} onClick={() => save.mutate(true)}>Save as new</Button>}
        <Button disabled={!name.trim()} loading={save.isPending} onClick={() => save.mutate(false)}>Save</Button>
      </>}>
      <FormField label="Name" value={name} onChange={setName} maxLength={120} />
      <label className="form-check d-inline-flex align-items-center gap-2" style={{ fontSize: 13 }}>
        <input type="checkbox" className="form-check-input m-0" checked={shared} onChange={(e) => setShared(e.target.checked)} /> Share with colleagues who can see this data
      </label>
    </Dialog>
  );
}
