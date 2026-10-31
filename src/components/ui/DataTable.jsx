import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Columns3 } from 'lucide-react';
import Table from './Table';
import SearchField from './SearchField';
import ExportMenu from './ExportMenu';
import { exportToCsv } from '../../utils/exportToCsv';
import './data-table.css';

const PAGE_SIZES = [10, 25, 50, 100];

/**
 * The standard list table: search, sortable columns, paging, CSV export and a column chooser on top of
 * Table (which keeps the loading/error/empty states and the phone card layout). Everything happens in the
 * browser on the rows you pass in; for server-paged lists keep using Table directly.
 *
 * Columns take Table's props plus:
 *   value(row)        plain value used to sort, search and export (defaults to row[key])
 *   sortable          false to turn sorting off for the column
 *   searchable        false to leave the column out of the search
 *   exportValue(row)  value written to the CSV, when it differs from value; export: false to leave it out
 *
 * exportFileName turns on a CSV of the visible columns; onExport(rows) instead hands the searched and
 * sorted rows (all pages) to a page that already has its own export layout. `flush` is for a table that
 * fills a padding-free Card: the toolbar and footer get their own padding.
 *   hideable          false to keep the column out of the column chooser (e.g. actions)
 *   defaultHidden     start hidden; people can switch it on
 *
 *   <DataTable
 *     columns={columns}
 *     rows={requests}
 *     isLoading={isLoading}
 *     searchPlaceholder="Search employee or leave type"
 *     exportFileName="leave-requests"
 *     storageKey="leave-requests"
 *     toolbar={<StatusFilter />}
 *   />
 */
export default function DataTable({
  columns,
  rows,
  searchable = true,
  searchPlaceholder = 'Search…',
  pageSize: initialPageSize = 25,
  exportFileName,
  onExport,
  storageKey,
  toolbar = null,
  initialSort = null,
  flush = false,
  emptyTitle,
  emptyDescription,
  emptyAction,
  ...tableProps
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [hidden, setHidden] = useState(() => readHidden(storageKey, columns));
  const [chooserOpen, setChooserOpen] = useState(false);
  const list = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);

  const prepared = useMemo(() => columns.map((col) => {
    const value = col.value || ((row) => row?.[col.key]);
    const plain = list.some((row) => isPlain(value(row)));
    return {
      ...col,
      getValue: value,
      sortable: col.sortable ?? plain,
      searchable: col.searchable ?? plain,
    };
  }), [columns, list]);

  const visibleColumns = prepared.filter((col) => !hidden.has(col.key));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    const fields = prepared.filter((col) => col.searchable);
    return list.filter((row) => fields.some((col) => String(col.getValue(row) ?? '').toLowerCase().includes(q)));
  }, [list, prepared, query]);

  const sorted = useMemo(() => {
    const col = sort && prepared.find((item) => item.key === sort.key);
    if (!col) return filtered;
    const factor = sort.dir === 'desc' ? -1 : 1;
    return [...filtered].sort((a, b) => compare(col.getValue(a), col.getValue(b)) * factor);
  }, [filtered, prepared, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  // A new search starts again from the first page. New rows (live punches, a refetch) keep you where you
  // are; safePage already pulls you back when the list gets shorter.
  useEffect(() => { setPage(0); }, [query]);

  function toggleSort(key) {
    setSort((current) => {
      if (current?.key !== key) return { key, dir: 'asc' };
      if (current.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  }

  function toggleColumn(key) {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else if (prepared.length - next.size > 1) next.add(key);
      writeHidden(storageKey, next);
      return next;
    });
  }

  function exportRows() {
    // A page with its own export layout gets the rows exactly as shown: searched and sorted, all pages.
    if (onExport) {
      onExport(sorted);
      return;
    }
    const cols = visibleColumns.filter((col) => col.export !== false && typeof col.label === 'string' && col.label);
    exportToCsv(exportFileName, sorted.map((row) => Object.fromEntries(cols.map((col) => {
      const value = col.exportValue ? col.exportValue(row) : col.getValue(row);
      return [col.label, isPlain(value) ? value : ''];
    }))));
  }

  const hideable = prepared.filter((col) => col.hideable !== false && typeof col.label === 'string' && col.label);
  const searching = query.trim().length > 0;
  const canExport = !!(exportFileName || onExport);
  const showToolbar = searchable || toolbar || canExport || hideable.length > 1;

  return (
    <div className={`hz-data-table${flush ? ' hz-data-table--flush' : ''}`}>
      {showToolbar && (
        <div className="hz-data-table__toolbar">
          {searchable && (
            <SearchField value={query} onChange={setQuery} placeholder={searchPlaceholder} aria-label={searchPlaceholder} className="hz-data-table__search" />
          )}
          {toolbar && <div className="hz-data-table__filters">{toolbar}</div>}
          <div className="hz-data-table__tools">
            {hideable.length > 1 && (
              <div className="hz-export-menu">
                <button type="button" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-2" aria-haspopup="true" aria-expanded={chooserOpen} onClick={() => setChooserOpen((open) => !open)}>
                  <Columns3 size={15} aria-hidden="true" /> Columns
                </button>
                {chooserOpen && (
                  <>
                    <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 15 }} onClick={() => setChooserOpen(false)} aria-hidden="true" />
                    <div className="hz-export-menu__popover hz-data-table__chooser" role="group" aria-label="Show columns">
                      {hideable.map((col) => (
                        <label key={col.key}>
                          <input type="checkbox" checked={!hidden.has(col.key)} onChange={() => toggleColumn(col.key)} />
                          <span>{col.label}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {canExport && <ExportMenu onExport={exportRows} disabled={tableProps.isLoading || sorted.length === 0} />}
          </div>
        </div>
      )}

      <Table
        {...tableProps}
        columns={visibleColumns}
        rows={pageRows}
        sort={sort}
        onSort={toggleSort}
        emptyTitle={searching && list.length > 0 ? 'No matches' : emptyTitle}
        emptyDescription={searching && list.length > 0 ? `Nothing matches "${query.trim()}".` : emptyDescription}
        emptyAction={searching && list.length > 0 ? null : emptyAction}
      />

      {!tableProps.isLoading && !tableProps.isError && sorted.length > PAGE_SIZES[0] && (
        <div className="hz-data-table__footer">
          <span>
            {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, sorted.length)} of {sorted.length}
            {searching ? ` (filtered from ${list.length})` : ''}
          </span>
          <label className="d-flex align-items-center gap-2 mb-0">
            <span>Rows</span>
            <select className="form-select form-select-sm" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }} aria-label="Rows per page">
              {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <div className="d-flex align-items-center gap-1">
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label="Previous page"><ChevronLeft size={15} /></button>
            <span className="px-1">Page {safePage + 1} of {pageCount}</span>
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} aria-label="Next page"><ChevronRight size={15} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function isPlain(value) {
  return value != null && value !== '' && ['string', 'number', 'boolean'].includes(typeof value);
}

/** Numbers by size, text in natural order ("Item 2" before "Item 10"), empty values always last. */
function compare(a, b) {
  const emptyA = a == null || a === '';
  const emptyB = b == null || b === '';
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'en-IN', { numeric: true, sensitivity: 'base' });
}

function readHidden(storageKey, columns) {
  const defaults = new Set(columns.filter((col) => col.defaultHidden).map((col) => col.key));
  if (!storageKey) return defaults;
  try {
    const saved = JSON.parse(window.localStorage.getItem(`vettri.table.${storageKey}.hidden`) || 'null');
    return Array.isArray(saved) ? new Set(saved.filter((key) => columns.some((col) => col.key === key && col.hideable !== false))) : defaults;
  } catch {
    return defaults;
  }
}

function writeHidden(storageKey, hidden) {
  if (!storageKey) return;
  try { window.localStorage.setItem(`vettri.table.${storageKey}.hidden`, JSON.stringify([...hidden])); } catch { /* private window: keep it for this visit only */ }
}
