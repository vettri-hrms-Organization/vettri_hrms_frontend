<<<<<<< HEAD
=======
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Filter,
  Check,
  X,
  Search,
  ChevronDown,
} from 'lucide-react';

>>>>>>> origin/uiupdate
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import { Skeleton } from './Skeleton';

<<<<<<< HEAD
/**
 * Column-config table. Cell rendering stays flexible via `render(row)` per
 * column - this centralizes the part that was actually duplicated across
 * pages (header typography, loading/error/empty states, row hover) without
 * forcing every table's cell markup into a rigid shape it might not fit.
 *
 * Usage:
 *   <Table
 *     columns={[
 *       { key: 'name', label: 'Employee', render: (row) => <EmployeeCell employee={row} /> },
 *       { key: 'dept', label: 'Department', render: (row) => row.departmentName || '—' },
 *     ]}
 *     rows={employees}
 *     getRowKey={(row) => row.id}
 *     isLoading={isLoading}
 *     isError={isError}
 *     onRetry={refetch}
 *     onRowClick={(row) => navigate(`/employees/${row.id}`)}
 *     emptyTitle="No employees yet"
 *   />
=======
function normalizeValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim().toLowerCase();
}

function getColumnValue(column, row) {
  if (typeof column.filterValue === 'function') {
    return column.filterValue(row);
  }

  if (typeof column.renderValue === 'function') {
    return column.renderValue(row);
  }

  return row?.[column.key];
}

function getFilterableOptions(column, rows) {
  if (Array.isArray(column.filterOptions)) {
    return column.filterOptions;
  }

  const values = new Map();

  rows.forEach((row) => {
    const rawValue = getColumnValue(column, row);

    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return;
    }

    const value = String(rawValue);

    if (!values.has(value)) {
      values.set(value, value);
    }
  });

  return Array.from(values.values()).map((value) => ({
    value,
    label: value,
  }));
}

function TextFilter({
  column,
  draftFilter,
  setDraftFilter,
}) {
  const operator = draftFilter?.operator || 'contains';
  const value = draftFilter?.value || '';

  return (
    <div className="hz-table__filter-body">
      <label className="hz-table__filter-label">
        Filter
      </label>

      <select
        className="hz-table__filter-select"
        value={operator}
        onChange={(event) =>
          setDraftFilter({
            operator: event.target.value,
            value,
          })
        }
      >
        <option value="contains">Contains</option>
        <option value="notContains">Does not contain</option>
        <option value="startsWith">Starts with</option>
        <option value="endsWith">Ends with</option>
        <option value="equals">Equals</option>
        <option value="notEquals">Does not equal</option>
      </select>

      <input
        type="text"
        className="hz-table__filter-search"
        placeholder={`Search ${column.label?.toLowerCase() || 'value'}...`}
        value={value}
        onChange={(event) =>
          setDraftFilter({
            operator,
            value: event.target.value,
          })
        }
        autoFocus
      />
    </div>
  );
}

function SelectFilter({
  column,
  rows,
  draftFilter,
  setDraftFilter,
}) {
  const [optionSearch, setOptionSearch] = useState('');

  const options = useMemo(
    () => getFilterableOptions(column, rows),
    [column, rows]
  );

  const selectedValues = draftFilter?.values || [];

  const filteredOptions = options.filter((option) =>
    normalizeValue(option.label).includes(
      normalizeValue(optionSearch)
    )
  );

  const allVisibleSelected =
    filteredOptions.length > 0 &&
    filteredOptions.every((option) =>
      selectedValues.includes(String(option.value))
    );

  function toggleValue(value) {
    const normalized = String(value);

    const next = selectedValues.includes(normalized)
      ? selectedValues.filter((item) => item !== normalized)
      : [...selectedValues, normalized];

    setDraftFilter({
      values: next,
    });
  }

  function toggleAll() {
    if (allVisibleSelected) {
      const visibleValues = filteredOptions.map((option) =>
        String(option.value)
      );

      setDraftFilter({
        values: selectedValues.filter(
          (value) => !visibleValues.includes(value)
        ),
      });

      return;
    }

    const visibleValues = filteredOptions.map((option) =>
      String(option.value)
    );

    setDraftFilter({
      values: Array.from(
        new Set([...selectedValues, ...visibleValues])
      ),
    });
  }

  return (
    <div className="hz-table__filter-body">
      <input
        type="search"
        className="hz-table__filter-search"
        placeholder={`Search ${column.label?.toLowerCase() || 'values'}...`}
        value={optionSearch}
        onChange={(event) => setOptionSearch(event.target.value)}
        autoFocus
      />

      <label className="hz-table__filter-option hz-table__filter-option--all">
        <input
          type="checkbox"
          checked={allVisibleSelected}
          onChange={toggleAll}
        />

        <span>Select All</span>
      </label>

      <div className="hz-table__filter-options">
        {filteredOptions.length === 0 ? (
          <div className="hz-table__filter-no-results">
            No values found
          </div>
        ) : (
          filteredOptions.map((option) => {
            const value = String(option.value);
            const checked = selectedValues.includes(value);

            return (
              <label
                key={value}
                className="hz-table__filter-option"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleValue(value)}
                />

                <span title={option.label}>
                  {option.label}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

function DateFilter({
  draftFilter,
  setDraftFilter,
}) {
  const operator = draftFilter?.operator || 'equals';
  const value = draftFilter?.value || '';
  const secondValue = draftFilter?.secondValue || '';

  return (
    <div className="hz-table__filter-body">
      <label className="hz-table__filter-label">
        Date filter
      </label>

      <select
        className="hz-table__filter-select"
        value={operator}
        onChange={(event) =>
          setDraftFilter({
            operator: event.target.value,
            value,
            secondValue,
          })
        }
      >
        <option value="equals">Is</option>
        <option value="before">Before</option>
        <option value="after">After</option>
        <option value="between">Between</option>
      </select>

      <input
        type="date"
        className="hz-table__filter-date"
        value={value}
        onChange={(event) =>
          setDraftFilter({
            operator,
            value: event.target.value,
            secondValue,
          })
        }
      />

      {operator === 'between' && (
        <input
          type="date"
          className="hz-table__filter-date"
          value={secondValue}
          onChange={(event) =>
            setDraftFilter({
              operator,
              value,
              secondValue: event.target.value,
            })
          }
        />
      )}
    </div>
  );
}

function FilterMenu({
  column,
  rows,
  filter,
  onApply,
  onClear,
  onClose,
}) {
  const menuRef = useRef(null);

  const [draftFilter, setDraftFilter] = useState(filter || {});

  useEffect(() => {
    setDraftFilter(filter || {});
  }, [filter]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target)
      ) {
        onClose();
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener(
      'mousedown',
      handleOutsideClick
    );

    document.addEventListener(
      'keydown',
      handleEscape
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleOutsideClick
      );

      document.removeEventListener(
        'keydown',
        handleEscape
      );
    };
  }, [onClose]);

  const filterType = column.filterType || 'text';

  function handleApply() {
    onApply(draftFilter);
  }

  function handleClear() {
    setDraftFilter({});
    onClear();
  }

  return (
    <div
      ref={menuRef}
      className="hz-table__filter-menu"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="hz-table__filter-menu-header">
        <span className="hz-table__filter-menu-title">
          {column.label}
        </span>

        <button
          type="button"
          className="hz-table__filter-close"
          onClick={onClose}
          aria-label="Close filter"
        >
          <X size={15} />
        </button>
      </div>

      {filterType === 'select' ? (
        <SelectFilter
          column={column}
          rows={rows}
          draftFilter={draftFilter}
          setDraftFilter={setDraftFilter}
        />
      ) : filterType === 'date' ? (
        <DateFilter
          draftFilter={draftFilter}
          setDraftFilter={setDraftFilter}
        />
      ) : (
        <TextFilter
          column={column}
          draftFilter={draftFilter}
          setDraftFilter={setDraftFilter}
        />
      )}

      <div className="hz-table__filter-footer">
        <button
          type="button"
          className="hz-table__filter-clear"
          onClick={handleClear}
        >
          Clear
        </button>

        <button
          type="button"
          className="hz-table__filter-apply"
          onClick={handleApply}
        >
          Apply
        </button>
      </div>
    </div>
  );
}

function matchesTextFilter(value, filter) {
  if (!filter || !filter.value) {
    return true;
  }

  const actual = normalizeValue(value);
  const expected = normalizeValue(filter.value);

  switch (filter.operator) {
    case 'notContains':
      return !actual.includes(expected);

    case 'startsWith':
      return actual.startsWith(expected);

    case 'endsWith':
      return actual.endsWith(expected);

    case 'equals':
      return actual === expected;

    case 'notEquals':
      return actual !== expected;

    case 'contains':
    default:
      return actual.includes(expected);
  }
}

function matchesSelectFilter(value, filter) {
  if (
    !filter ||
    !Array.isArray(filter.values) ||
    filter.values.length === 0
  ) {
    return true;
  }

  return filter.values.includes(String(value));
}

function matchesDateFilter(value, filter) {
  if (!filter || !filter.value) {
    return true;
  }

  if (!value) {
    return false;
  }

  const actualDate = new Date(value);

  if (Number.isNaN(actualDate.getTime())) {
    return false;
  }

  const selectedDate = new Date(filter.value);

  if (Number.isNaN(selectedDate.getTime())) {
    return true;
  }

  actualDate.setHours(0, 0, 0, 0);
  selectedDate.setHours(0, 0, 0, 0);

  switch (filter.operator) {
    case 'before':
      return actualDate < selectedDate;

    case 'after':
      return actualDate > selectedDate;

    case 'between': {
      if (!filter.secondValue) {
        return true;
      }

      const secondDate = new Date(filter.secondValue);
      secondDate.setHours(0, 0, 0, 0);

      return (
        actualDate >= selectedDate &&
        actualDate <= secondDate
      );
    }

    case 'equals':
    default:
      return (
        actualDate.getTime() ===
        selectedDate.getTime()
      );
  }
}

function rowMatchesFilters(row, columns, filters) {
  return columns.every((column) => {
    const filter = filters[column.key];

    if (!filter) {
      return true;
    }

    const value = getColumnValue(column, row);
    const filterType = column.filterType || 'text';

    if (filterType === 'select') {
      return matchesSelectFilter(value, filter);
    }

    if (filterType === 'date') {
      return matchesDateFilter(value, filter);
    }

    return matchesTextFilter(value, filter);
  });
}

/**
 * Column-config table.
 *
 * Supports:
 * - Row selection
 * - Loading/error/empty states
 * - Row click
 * - Column filters
 * - Text filters
 * - Select/multi-select filters
 * - Date filters
>>>>>>> origin/uiupdate
 */
export default function Table({
  columns,
  rows,
  getRowKey = (row, i) => row.id ?? i,
  isLoading = false,
  isError = false,
  onRetry,
  onRowClick,
  loadingRows = 5,
  emptyIcon,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  ariaLabel = 'Data table',
  selectable = false,
  selectedKeys = new Set(),
  onToggleRow,
  onToggleAll,
}) {
<<<<<<< HEAD
  if (isError) {
    return <ErrorState description="Couldn't load this data." onRetry={onRetry} />;
  }

  if (!isLoading && (!rows || rows.length === 0)) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <div className="table-responsive">
      <table className="table mb-0 align-middle hz-table" aria-label={ariaLabel} aria-busy={isLoading || undefined}>
        <thead>
          <tr>
            {selectable && <th className="hz-table__selection"><input type="checkbox" checked={!isLoading && rows?.length > 0 && rows.every((row, index) => selectedKeys.has(getRowKey(row, index)))} onChange={(event) => onToggleAll?.(event.target.checked)} disabled={isLoading || !rows?.length} aria-label="Select all rows" /></th>}
            {columns.map((col) => (
              <th key={col.key} style={{ width: col.width, textAlign: col.align }} className={col.headerClassName}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading &&
            Array.from({ length: loadingRows }).map((_, i) => (
              <tr key={`skeleton-${i}`}>
                {columns.map((col) => (
                  <td key={col.key}>
                    <Skeleton height={14} width={col.skeletonWidth || '70%'} />
                  </td>
                ))}
              </tr>
            ))}

          {!isLoading &&
            rows.map((row, i) => (
              <tr
                key={getRowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onRowClick(row); } } : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={onRowClick ? `Open row ${i + 1}` : undefined}
                className={onRowClick ? 'hz-table-row--clickable' : undefined}
              >
                {selectable && <td className="hz-table__selection" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedKeys.has(getRowKey(row, i))} onChange={() => onToggleRow?.(row)} aria-label={`Select row ${i + 1}`} /></td>}
                {columns.map((col) => (
                  <td key={col.key} data-label={typeof col.label === 'string' ? col.label : undefined} style={{ textAlign: col.align, ...col.style }} className={col.className}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
=======
  const [activeFilterKey, setActiveFilterKey] = useState(null);
  const [filters, setFilters] = useState({});

  const safeRows = rows || [];

  const filteredRows = useMemo(() => {
    if (Object.keys(filters).length === 0) {
      return safeRows;
    }

    return safeRows.filter((row) =>
      rowMatchesFilters(row, columns, filters)
    );
  }, [safeRows, columns, filters]);

  function handleApplyFilter(columnKey, filter) {
    setFilters((current) => {
      const next = { ...current };

      const hasValue =
        filter &&
        (
          filter.value ||
          (
            Array.isArray(filter.values) &&
            filter.values.length > 0
          )
        );

      if (hasValue) {
        next[columnKey] = filter;
      } else {
        delete next[columnKey];
      }

      return next;
    });

    setActiveFilterKey(null);
  }

  function handleClearFilter(columnKey) {
    setFilters((current) => {
      const next = { ...current };
      delete next[columnKey];
      return next;
    });

    setActiveFilterKey(null);
  }

  function clearAllFilters() {
    setFilters({});
    setActiveFilterKey(null);
  }

  const activeFilterCount = Object.keys(filters).length;

  if (isError) {
    return (
      <ErrorState
        description="Couldn't load this data."
        onRetry={onRetry}
      />
    );
  }

  if (
    !isLoading &&
    safeRows.length === 0
  ) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <div className="hz-table-wrapper">
      {activeFilterCount > 0 && (
        <div className="hz-table__filter-summary">
          <span>
            {activeFilterCount}{' '}
            {activeFilterCount === 1
              ? 'filter'
              : 'filters'}{' '}
            applied
          </span>

          <button
            type="button"
            onClick={clearAllFilters}
          >
            Clear all
          </button>
        </div>
      )}

      <div className="table-responsive">
        <table
          className="table mb-0 align-middle hz-table"
          aria-label={ariaLabel}
          aria-busy={
            isLoading || undefined
          }
        >
          <thead>
            <tr>
              {selectable && (
                <th className="hz-table__selection">
                  <input
                    type="checkbox"
                    checked={
                      !isLoading &&
                      filteredRows.length > 0 &&
                      filteredRows.every(
                        (row, index) =>
                          selectedKeys.has(
                            getRowKey(row, index)
                          )
                      )
                    }
                    onChange={(event) =>
                      onToggleAll?.(
                        event.target.checked
                      )
                    }
                    disabled={
                      isLoading ||
                      !filteredRows.length
                    }
                    aria-label="Select all rows"
                  />
                </th>
              )}

              {columns.map((col) => {
                const hasFilter =
                  !!col.filterable;

                const isActive =
                  !!filters[col.key];

                return (
                  <th
                    key={col.key}
                    style={{
                      width: col.width,
                      textAlign: col.align,
                    }}
                    className={[
                      col.headerClassName || '',
                      hasFilter
                        ? 'hz-table__header-cell--filterable'
                        : '',
                      isActive
                        ? 'hz-table__header-cell--filtered'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <div className="hz-table__header-content">
                      <span
                        className="hz-table__header-label"
                        title={
                          typeof col.label === 'string'
                            ? col.label
                            : undefined
                        }
                      >
                        {col.label}
                      </span>

                      {hasFilter && (
                        <div className="hz-table__filter-wrapper">
                          <button
                            type="button"
                            className={[
                              'hz-table__filter-button',
                              isActive
                                ? 'is-active'
                                : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            onClick={(event) => {
                              event.stopPropagation();

                              setActiveFilterKey(
                                (current) =>
                                  current === col.key
                                    ? null
                                    : col.key
                              );
                            }}
                            aria-label={`Filter ${col.label}`}
                            aria-expanded={
                              activeFilterKey ===
                              col.key
                            }
                          >
                            <Filter size={14} />
                          </button>

                          {activeFilterKey ===
                            col.key && (
                            <FilterMenu
                              column={col}
                              rows={safeRows}
                              filter={
                                filters[col.key]
                              }
                              onApply={(
                                filter
                              ) =>
                                handleApplyFilter(
                                  col.key,
                                  filter
                                )
                              }
                              onClear={() =>
                                handleClearFilter(
                                  col.key
                                )
                              }
                              onClose={() =>
                                setActiveFilterKey(
                                  null
                                )
                              }
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {isLoading &&
              Array.from({
                length: loadingRows,
              }).map((_, i) => (
                <tr
                  key={`skeleton-${i}`}
                >
                  {selectable && (
                    <td className="hz-table__selection">
                      <Skeleton
                        height={14}
                        width={14}
                      />
                    </td>
                  )}

                  {columns.map((col) => (
                    <td key={col.key}>
                      <Skeleton
                        height={14}
                        width={
                          col.skeletonWidth ||
                          '70%'
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}

            {!isLoading &&
              filteredRows.map(
                (row, i) => (
                  <tr
                    key={getRowKey(row, i)}
                    onClick={
                      onRowClick
                        ? () =>
                            onRowClick(row)
                        : undefined
                    }
                    onKeyDown={
                      onRowClick
                        ? (event) => {
                            if (
                              event.key ===
                                'Enter' ||
                              event.key === ' '
                            ) {
                              event.preventDefault();
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                    tabIndex={
                      onRowClick
                        ? 0
                        : undefined
                    }
                    aria-label={
                      onRowClick
                        ? `Open row ${
                            i + 1
                          }`
                        : undefined
                    }
                    className={
                      onRowClick
                        ? 'hz-table-row--clickable'
                        : undefined
                    }
                  >
                    {selectable && (
                      <td
                        className="hz-table__selection"
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                      >
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(
                            getRowKey(
                              row,
                              i
                            )
                          )}
                          onChange={() =>
                            onToggleRow?.(
                              row
                            )
                          }
                          aria-label={`Select row ${
                            i + 1
                          }`}
                        />
                      </td>
                    )}

                    {columns.map(
                      (col) => (
                        <td
                          key={col.key}
                          data-label={
                            typeof col.label ===
                            'string'
                              ? col.label
                              : undefined
                          }
                          style={{
                            textAlign:
                              col.align,
                            ...col.style,
                          }}
                          className={
                            col.className
                          }
                        >
                          {col.render
                            ? col.render(row)
                            : row[col.key]}
                        </td>
                      )
                    )}
                  </tr>
                )
              )}

            {!isLoading &&
              safeRows.length > 0 &&
              filteredRows.length ===
                0 && (
                <tr>
                  <td
                    colSpan={
                      columns.length +
                      (selectable
                        ? 1
                        : 0)
                    }
                    className="hz-table__no-filter-results"
                  >
                    <div>
                      <strong>
                        No matching records
                      </strong>

                      <span>
                        Change or clear the
                        column filters.
                      </span>

                      <button
                        type="button"
                        onClick={
                          clearAllFilters
                        }
                      >
                        Clear filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
>>>>>>> origin/uiupdate
