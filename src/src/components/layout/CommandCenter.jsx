import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  CalendarDays,
  Clock3,
  FileSpreadsheet,
  FileText,
  Keyboard,
  LoaderCircle,
  Plus,
  Search,
  UserRound,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { employeesApi } from '../../api/endpoints/employees';
import { useAuth } from '../../hooks/useAuth';
import Avatar from '../ui/Avatar';
import { NAV_SECTIONS, visibleNavSections } from './navConfig';
import { useNavMemory } from './NavMemoryContext';

const MAX_RESULTS = 12;
const ACTIONS = [
  { id: 'employees', label: 'Open employee workspace', description: 'Manage people and employee records', icon: Users, to: '/employees', permission: 'EMPLOYEE_VIEW' },
  { id: 'import-employees', label: 'Import employees', description: 'Upload employee records', icon: FileSpreadsheet, to: '/employees/import', permission: 'EMPLOYEE_CREATE' },
  { id: 'apply-leave', label: 'Open leave management', description: 'Review leave requests and balances', icon: CalendarDays, to: '/leave', permission: 'LEAVE_VIEW' },
  { id: 'recruitment', label: 'Open recruitment', description: 'Manage jobs and candidates', icon: Briefcase, to: '/recruitment', permission: 'RECRUITMENT_VIEW' },
  { id: 'payroll', label: 'Run payroll', description: 'Open payroll processing', icon: Wallet, to: '/salary/payroll-processing', permission: 'SALARY_VIEW' },
  { id: 'reports', label: 'Generate report', description: 'Open reports and analytics', icon: BarChart3, to: '/reports', permission: 'REPORTS_VIEW' },
];

function scoreText(text, query) {
  const value = text.toLowerCase();
  if (value === query) return 1000;
  if (value.startsWith(query)) return 500;
  if (value.includes(query)) return 100;
  let score = 0;
  let cursor = 0;
  for (const character of query) {
    const index = value.indexOf(character, cursor);
    if (index < 0) return 0;
    score += 1;
    cursor = index + 1;
  }
  return score;
}

export default function CommandCenter({ open, onClose }) {
  const { hasPermission, hasRole } = useAuth();
  const { recentPaths, recordVisit } = useNavMemory();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const dialogRef = useRef(null);
  const lastFocusedRef = useRef(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const visibleNavigation = useMemo(
    () => visibleNavSections(hasPermission, hasRole).flatMap((section) => section.items.map((item) => ({ ...item, section: section.label, permission: item.permission || section.permission }))),
    [hasPermission, hasRole]
  );
  const visibleActions = useMemo(
    () => ACTIONS.filter((action) => hasPermission(action.permission)),
    [hasPermission]
  );
  const recentItems = useMemo(
    () => recentPaths.map((path) => visibleNavigation.find((item) => item.to === path)).filter(Boolean).slice(0, 5),
    [recentPaths, visibleNavigation]
  );
  const navigationResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return visibleNavigation
      .map((item) => ({ item, score: Math.max(scoreText(item.label, normalized) * 1.5, scoreText(item.section, normalized)) }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map(({ item }) => item);
  }, [query, visibleNavigation]);
  const actionResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return visibleActions
      .map((item) => ({ item, score: Math.max(scoreText(item.label, normalized), scoreText(item.description, normalized)) }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
  }, [query, visibleActions]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setDebouncedQuery('');
      return undefined;
    }
    const timer = setTimeout(() => setDebouncedQuery(normalized), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: employees = [], isFetching: employeesLoading, isError: employeeSearchFailed } = useQuery({
    queryKey: ['command-center-employees', debouncedQuery],
    queryFn: () => employeesApi.list(debouncedQuery),
    enabled: open && hasPermission('EMPLOYEE_VIEW') && debouncedQuery.length >= 2,
  });
  const employeeResults = employees.slice(0, 5);
  const results = useMemo(
    () => [
      ...actionResults.map((item) => ({ kind: 'action', item })),
      ...navigationResults.map((item) => ({ kind: 'page', item })),
      ...employeeResults.map((item) => ({ kind: 'employee', item })),
    ],
    [actionResults, navigationResults, employeeResults]
  );

  useEffect(() => setActiveIndex(0), [query]);

  useEffect(() => {
    if (!open) return undefined;
    lastFocusedRef.current = document.activeElement;
    setQuery('');
    setActiveIndex(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      clearTimeout(timer);
      lastFocusedRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
      } else if (event.key === 'Home' && results.length) {
        event.preventDefault();
        setActiveIndex(0);
      } else if (event.key === 'End' && results.length) {
        event.preventDefault();
        setActiveIndex(results.length - 1);
      } else if (event.key === 'Enter' && results[activeIndex]) {
        event.preventDefault();
        execute(results[activeIndex]);
      } else if (event.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll('input, button, [tabindex]:not([tabindex="-1"])');
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, results, activeIndex]);

  function execute(result) {
    const destination = result.kind === 'employee' ? `/employees/${result.item.id}` : result.item.to;
    if (result.kind === 'page') recordVisit(result.item);
    onClose();
    navigate(destination);
  }

  if (!open) return null;

  const showEmpty = query.trim() && !results.length && !employeesLoading;
  return createPortal(
    <div className="hz-command-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="hz-command" role="dialog" aria-modal="true" aria-labelledby="hz-command-title">
        <div className="hz-command__heading">
          <div><span className="hz-command__eyebrow">Vettri</span><h2 id="hz-command-title">Command center</h2></div>
          <button type="button" className="hz-command__close" onClick={onClose} aria-label="Close command center"><X size={18} /></button>
        </div>
        <div className="hz-command__search-wrap">
          <Search size={19} aria-hidden="true" />
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employees, pages, actions..." aria-label="Search employees, pages, and actions" aria-controls="hz-command-results" aria-autocomplete="list" />
          <kbd>Esc</kbd>
        </div>
        <div id="hz-command-results" className="hz-command__results" role="listbox" aria-label="Command results">
          {!query.trim() && recentItems.length > 0 && <CommandGroup label="Recent" icon={<Clock3 size={13} />} items={recentItems.map((item) => ({ kind: 'page', item }))} activeIndex={activeIndex} onExecute={execute} />}
          {!query.trim() && !recentItems.length && <EmptyState text="Start typing to search pages, actions, or employees." />}
          {!!query.trim() && actionResults.length > 0 && <CommandGroup label="Quick actions" items={actionResults.map((item) => ({ kind: 'action', item }))} offset={0} activeIndex={activeIndex} onExecute={execute} />}
          {!!query.trim() && navigationResults.length > 0 && <CommandGroup label="Navigation" items={navigationResults.map((item) => ({ kind: 'page', item }))} offset={actionResults.length} activeIndex={activeIndex} onExecute={execute} />}
          {!!query.trim() && (employeeResults.length > 0 || employeesLoading) && <CommandGroup label="Employees" items={employeeResults.map((item) => ({ kind: 'employee', item }))} offset={actionResults.length + navigationResults.length} activeIndex={activeIndex} onExecute={execute} loading={employeesLoading} />}
          {employeeSearchFailed && <div className="hz-command__notice">Search temporarily unavailable. Pages and actions are still available.</div>}
          {showEmpty && <EmptyState text="No results found. Try searching for an employee, page, or action." />}
        </div>
        <footer className="hz-command__footer"><span><Keyboard size={14} /> Navigate with arrow keys</span><span><kbd>Enter</kbd> Select</span><span><kbd>Esc</kbd> Close</span></footer>
      </section>
    </div>,
    document.body
  );
}

function CommandGroup({ label, icon, items, offset = 0, activeIndex, onExecute, loading }) {
  return <div className="hz-command__group"><div className="hz-command__group-label">{icon || <Plus size={13} />} {label}</div>{loading && <div className="hz-command__loading"><LoaderCircle size={15} /> Searching employees...</div>}{items.map((result, index) => <CommandItem key={result.kind === 'employee' ? result.item.id : result.item.to} result={result} selected={activeIndex === offset + index} onExecute={onExecute} index={offset + index} />)}</div>;
}

function CommandItem({ result, selected, onExecute, index }) {
  const item = result.item;
  const Icon = result.kind === 'employee' ? UserRound : item.icon || FileText;
  const title = result.kind === 'employee' ? item.fullName : item.label;
  const subtitle = result.kind === 'employee' ? (item.designationTitle || item.departmentName || 'Employee') : (item.description || NAV_SECTIONS.find((section) => section.label === item.section)?.description || item.section);
  return <button type="button" role="option" aria-selected={selected} className={`hz-command__item ${selected ? 'is-selected' : ''}`} onMouseEnter={() => {}} onClick={() => onExecute(result)}><span className="hz-command__icon">{result.kind === 'employee' ? <Avatar name={item.fullName} size="sm" /> : <Icon size={17} />}</span><span className="hz-command__copy"><strong>{title}</strong><small>{subtitle}</small></span><span className="hz-command__meta">{selected ? <kbd>Enter</kbd> : <ArrowRight size={16} />}</span><span className="visually-hidden">Result {index + 1}</span></button>;
}

function EmptyState({ text }) {
  return <div className="hz-command__empty"><Search size={21} /><strong>{text}</strong></div>;
}
