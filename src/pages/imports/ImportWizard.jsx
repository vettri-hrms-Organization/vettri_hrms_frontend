import { useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, FileSpreadsheet, UploadCloud, XCircle } from 'lucide-react';
import { importsApi } from '../../api/endpoints/imports';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ErrorBanner from '../../components/ui/ErrorBanner';

const ROW_BG = {
  error: 'var(--hz-danger-50)',
  warning: 'var(--hz-warning-50)',
  skip: 'var(--hz-gray-50)',
};

/**
 * Reusable four-step import flow: download template -> upload -> preview with per-row errors -> confirm.
 *
 * Props: type (backend slug), title, description, supportsReplace (show "Replace existing"),
 * supportsLeaveMode (show "adjustment vs carried-forward"), api (override for tests), onImported(result).
 */
export default function ImportWizard({
  type,
  title,
  description,
  supportsReplace = false,
  supportsLeaveMode = false,
  api = importsApi,
  onImported,
}) {
  const inputRef = useRef(null);
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [replace, setReplace] = useState(false);
  const [leaveMode, setLeaveMode] = useState('ADJUSTMENT');
  const [allOrNothing, setAllOrNothing] = useState(false);
  const [onlyProblems, setOnlyProblems] = useState(false);

  const options = { replace: supportsReplace && replace, leaveMode: supportsLeaveMode ? leaveMode : undefined };

  const previewMutation = useMutation({
    mutationFn: () => api.preview(type, file, options),
    onSuccess: (data) => { setPreview(data); setResult(null); setError(''); },
    onError: showError,
  });
  const commitMutation = useMutation({
    mutationFn: () => api.commit(type, file, { ...options, allOrNothing }),
    onSuccess: (data) => {
      setResult(data);
      setError('');
      queryClient.invalidateQueries({ queryKey: ['import-batches'] });
      onImported?.(data);
    },
    onError: (err) => {
      showError(err);
      queryClient.invalidateQueries({ queryKey: ['import-batches'] });
    },
  });
  const templateMutation = useMutation({ mutationFn: () => api.downloadTemplate(type), onError: showError });

  function showError(err) {
    setError(err?.response?.data?.message || err?.message || 'We could not process this workbook.');
  }

  function choose(list) {
    const candidate = list?.[0];
    if (!candidate) return;
    if (!/\.(xlsx|xls)$/i.test(candidate.name)) { setError('Choose an .xlsx or .xls workbook.'); return; }
    setFile(candidate);
    setPreview(null);
    setResult(null);
    setError('');
  }

  function resetPreview() { setPreview(null); setResult(null); }

  const columns = useMemo(() => {
    if (!preview) return [];
    const base = [...(preview.columns || [])];
    for (const row of preview.rows || []) {
      for (const key of Object.keys(row.values || {})) if (!base.includes(key)) base.push(key);
    }
    // Hide columns that are empty in every row (optional columns not used in this file).
    return base.filter((column) => (preview.rows || []).some((row) => (row.values?.[column] ?? '') !== ''));
  }, [preview]);

  const rows = useMemo(() => {
    const list = result?.rows || preview?.rows || [];
    return onlyProblems ? list.filter((row) => !row.valid || row.warnings?.length || row.skip) : list;
  }, [preview, result, onlyProblems]);

  const importable = preview ? preview.validRows : 0;
  const blockedByErrors = allOrNothing && preview?.invalidRows > 0;

  return (
    <div className="d-flex flex-column gap-4" data-testid="import-wizard">
      <div className="row g-4">
        <div className="col-12 col-xl-4">
          <div className="hz-card h-100"><div className="hz-card__body">
            <h3 className="hz-card__title mb-1">{title}</h3>
            {description && <p className="small text-secondary-hz">{description}</p>}

            <Step number="1" label="Download the template" hint="Includes an Instructions sheet and example rows" />
            <Button variant="secondary" icon={Download} onClick={() => templateMutation.mutate()} loading={templateMutation.isPending} className="mb-4">
              Download template
            </Button>

            <Step number="2" label="Upload your workbook" hint=".xlsx or .xls, first sheet is read" />
            <div
              role="button"
              tabIndex={0}
              aria-label="Choose workbook"
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files); }}
              className="text-center p-4"
              style={{ border: `1px dashed ${dragging ? 'var(--hz-primary-500)' : 'var(--hz-border-strong)'}`, borderRadius: 10, background: dragging ? 'var(--hz-primary-50)' : 'var(--hz-gray-50)', cursor: 'pointer' }}
            >
              <UploadCloud size={28} color="var(--hz-primary-500)" />
              <p className="mb-1 mt-2 fw-semibold">Drop your workbook here</p>
              <span className="small text-secondary-hz">or click to browse</span>
              <input ref={inputRef} type="file" accept=".xlsx,.xls" hidden data-testid="import-file-input" onChange={(e) => choose(e.target.files)} />
            </div>
            {file && (
              <div className="d-flex align-items-center justify-content-between gap-2 mt-3 p-2" style={{ background: 'var(--hz-primary-50)', borderRadius: 8 }}>
                <div className="d-flex align-items-center gap-2 text-truncate">
                  <FileSpreadsheet size={18} color="var(--hz-primary-600)" />
                  <span className="small text-truncate">{file.name}</span>
                </div>
                <button type="button" className="btn btn-link p-0" onClick={() => { setFile(null); resetPreview(); }} aria-label="Remove file"><XCircle size={17} /></button>
              </div>
            )}

            {(supportsReplace || supportsLeaveMode) && (
              <div className="mt-3 d-flex flex-column gap-2">
                {supportsLeaveMode && (
                  <label className="small">
                    <span className="d-block fw-semibold mb-1">Apply opening balance as</span>
                    <select className="form-select form-select-sm" value={leaveMode} onChange={(e) => { setLeaveMode(e.target.value); resetPreview(); }}>
                      <option value="ADJUSTMENT">Balance adjustment (balance = figure today)</option>
                      <option value="CARRY_FORWARD">Carried-forward days (accrual added on top)</option>
                    </select>
                  </label>
                )}
                {supportsReplace && (
                  <label className="form-check small mb-0">
                    <input type="checkbox" className="form-check-input" checked={replace} onChange={(e) => { setReplace(e.target.checked); resetPreview(); }} />
                    <span className="form-check-label">Replace existing (overwrite figures imported earlier)</span>
                  </label>
                )}
              </div>
            )}

            <Button icon={FileSpreadsheet} className="mt-3" onClick={() => previewMutation.mutate()} loading={previewMutation.isPending} disabled={!file}>
              Validate workbook
            </Button>
          </div></div>
        </div>

        <div className="col-12 col-xl-8">
          <div className="hz-card"><div className="hz-card__body">
            <Step number="3" label="Review and import" hint="Every row is checked before anything is written" />
            {error && <ErrorBanner title="Import problem">{error}</ErrorBanner>}
            {!preview && !error && (
              <div className="py-5 text-center text-secondary-hz">
                <FileSpreadsheet size={40} strokeWidth={1.3} />
                <p className="mt-3 mb-0">Your validated preview will appear here.</p>
              </div>
            )}
            {preview && (
              <>
                <div className="d-flex flex-wrap gap-3 mb-3">
                  <Summary label="Ready to import" value={preview.validRows} tone="success" />
                  <Summary label="Need attention" value={preview.invalidRows} tone={preview.invalidRows ? 'danger' : 'success'} />
                  {preview.skippedRows > 0 && <Summary label="Will be skipped" value={preview.skippedRows} tone="neutral" />}
                </div>
                <p className="small mb-2">{preview.message}</p>
                {preview.previousImportOfSameFile && !result && (
                  <div className="alert alert-warning py-2 small" role="alert">
                    This exact file was imported before (batch #{preview.previousImportOfSameFile.id}, {preview.previousImportOfSameFile.importedRows} rows
                    {preview.previousImportOfSameFile.importedBy ? ` by ${preview.previousImportOfSameFile.importedBy}` : ''}). Check you are not importing it twice.
                  </div>
                )}
                <label className="form-check small mb-2">
                  <input type="checkbox" className="form-check-input" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} />
                  <span className="form-check-label">Show only rows with errors, warnings or skips</span>
                </label>
                <div className="table-responsive" style={{ maxHeight: 460 }}>
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Row</th>
                        {columns.map((column) => <th key={column} className="text-nowrap">{column}</th>)}
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const tone = !row.valid ? 'error' : row.skip ? 'skip' : row.warnings?.length ? 'warning' : null;
                        return (
                          <tr key={row.row} data-testid={`import-row-${row.row}`} data-state={tone || 'ok'} style={tone ? { background: ROW_BG[tone] } : undefined}>
                            <td>{row.row}</td>
                            {columns.map((column) => <td key={column} className="text-nowrap">{row.values?.[column] || '—'}</td>)}
                            <td style={{ minWidth: 220 }}>
                              {!row.valid && <div className="text-danger small">{row.errors.join('; ')}</div>}
                              {row.valid && row.skip && <Badge variant="neutral">{row.action || 'Skipped'}</Badge>}
                              {row.valid && !row.skip && <Badge variant="success" dot>{row.action || 'Valid'}</Badge>}
                              {row.warnings?.length > 0 && <div className="small" style={{ color: 'var(--hz-warning-600)' }}>{row.warnings.join('; ')}</div>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {!result && (
                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 border-top pt-3 mt-3">
                    <div className="d-flex flex-column gap-1 small">
                      <label className="form-check mb-0">
                        <input type="radio" className="form-check-input" name={`${type}-mode`} checked={!allOrNothing} onChange={() => setAllOrNothing(false)} />
                        <span className="form-check-label">Import valid rows only (rows with errors are left out)</span>
                      </label>
                      <label className="form-check mb-0">
                        <input type="radio" className="form-check-input" name={`${type}-mode`} checked={allOrNothing} onChange={() => setAllOrNothing(true)} />
                        <span className="form-check-label">All or nothing (import only if every row is valid)</span>
                      </label>
                    </div>
                    <Button onClick={() => commitMutation.mutate()} loading={commitMutation.isPending} disabled={!importable || blockedByErrors}>
                      {blockedByErrors ? 'Fix errors to import all' : `Import ${importable} row${importable === 1 ? '' : 's'}`}
                    </Button>
                  </div>
                )}
              </>
            )}
            {result && (
              <div className={`alert ${result.status === 'COMPLETED' ? 'alert-success' : 'alert-warning'} d-flex align-items-start gap-2 mt-3 mb-0`} role="status">
                <CheckCircle2 size={18} className="flex-shrink-0 mt-1" />
                <div>
                  <strong>{result.message}</strong>
                  <div className="small">Batch #{result.batchId}: {result.importedRows} imported, {result.skippedRows} skipped, {result.failedRows} not imported.</div>
                </div>
              </div>
            )}
          </div></div>
        </div>
      </div>
    </div>
  );
}

function Step({ number, label, hint }) {
  return (
    <div className="d-flex align-items-center gap-3 mb-2 mt-1">
      <span className="d-inline-flex align-items-center justify-content-center rounded-circle" style={{ width: 28, height: 28, color: '#fff', background: 'var(--hz-primary-600)', fontWeight: 700, flexShrink: 0 }}>{number}</span>
      <div><strong>{label}</strong>{hint && <div className="small text-secondary-hz">{hint}</div>}</div>
    </div>
  );
}

function Summary({ label, value, tone }) {
  const color = tone === 'success' ? 'var(--hz-success-600)' : tone === 'danger' ? 'var(--hz-danger-600)' : 'var(--hz-text-muted)';
  return (
    <div className="px-3 py-2" style={{ border: '1px solid var(--hz-border)', borderRadius: 8, minWidth: 150 }}>
      <div className="small text-secondary-hz">{label}</div>
      <strong style={{ color, fontSize: 22 }}>{value}</strong>
    </div>
  );
}
