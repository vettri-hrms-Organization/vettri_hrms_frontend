import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, CheckCheck, ClipboardCheck, RefreshCw, Search, X as XIcon } from 'lucide-react';
import { compOffApi, encashmentApi, leaveRequestsApi } from '../../api/endpoints/leave';
import { attendanceApi } from '../../api/endpoints/attendance';
import { overtimeApi } from '../../api/endpoints/shifts';
import { expensesApi } from '../../api/endpoints/expenses';
import { profileApi } from '../../api/endpoints/profile';
import { formatHours, timesheetsApi } from '../../api/endpoints/timesheets';
import { resignationsApi } from '../../api/endpoints/resignations';
import { loanLabel, loansApi } from '../../api/endpoints/loans';
import { fbpApi } from '../../api/endpoints/fbp';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Avatar from '../../components/ui/Avatar';
import Dialog from '../../components/ui/Dialog';
import FormField from '../../components/ui/FormField';
import EmptyState from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../hooks/useAuth';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDateIST, toISTDateInputValue } from '../../utils/formatDateTime';
import { formatLeaveDuration } from '../../utils/formatLeave';
import { addDays, formatDay, formatMinutes, istToday } from '../attendance/shiftUtils';
import { travelApi } from '../../api/endpoints/workflows';
import './approvals.css';

/** Pending overtime older than this is out of the inbox window (the list endpoint requires a range). */
const OVERTIME_LOOKBACK_DAYS = 365;

const fmtNumber = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '0');
const plural = (n, word) => `${fmtNumber(n)} ${word}${Number(n) === 1 ? '' : 's'}`;
const errorMessage = (error, fallback) => error?.response?.data?.message || fallback;
/** Account numbers show only their last 4 digits in the list; the full value is on the profile. */
const showValue = (field, value) => (!value ? 'blank' : field === 'bankAccountNumber' && value.length > 4 ? `••••${value.slice(-4)}` : value);

/** A source the caller may not reach (401/403) is just an empty queue, never a broken page. */
async function forbiddenAsEmpty(request) {
  try {
    const data = await request();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    const status = error?.response?.status;
    if (status === 401 || status === 403) return [];
    throw error;
  }
}

function joinDetails(...parts) {
  return parts.filter(Boolean).join(' · ');
}

/**
 * One entry per approval queue. `enabled` mirrors the permission the
 * existing page for that queue uses, so we never call an endpoint the user
 * can't reach. `toItems` maps the real DTO fields into one row shape.
 */
function buildSources(hasPermission, myEmployeeId) {
  const leaveTeamScoped = hasPermission('LEAVE_APPROVE') && !hasPermission('LEAVE_MANAGE');
  const isFinance = hasPermission('EXPENSE_MANAGE');
  const canManagerReviewExpenses = hasPermission('EXPENSE_APPROVE') || isFinance;
  const otTo = istToday();
  const otFrom = addDays(otTo, -OVERTIME_LOOKBACK_DAYS);

  return [
    {
      key: 'leave',
      label: 'Leave',
      variant: 'primary',
      enabled: hasPermission('LEAVE_APPROVE'),
      fetch: () => (leaveTeamScoped ? leaveRequestsApi.teamList('PENDING') : leaveRequestsApi.list('PENDING')),
      // With a multi-level chain, team approvers only see requests waiting on them (HR sees all).
      toItems: (rows) => rows.filter((r) => !r.status || r.status === 'PENDING')
        .filter((r) => !leaveTeamScoped || !r.pendingWith || r.pendingApproverEmployeeId === myEmployeeId).map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        subtitle: r.departmentName,
        title: r.leaveTypeName || 'Leave',
        details: joinDetails(
          r.startDate === r.endDate ? formatDay(r.startDate) : `${formatDay(r.startDate)} – ${formatDay(r.endDate)}`,
          r.halfDay ? formatLeaveDuration(r) : plural(r.days, 'day'),
          r.pendingWith && r.approvalLevel > 0 ? `Step ${r.approvalLevel + 1} · with ${r.pendingWith}` : null,
        ),
        reason: r.reason,
        submittedAt: r.requestedAt,
        requestDate: r.startDate,
      })),
      approve: (item, note) => leaveRequestsApi.approve(item.id, note),
      reject: (item, note) => leaveRequestsApi.reject(item.id, note),
      invalidate: [['leave-requests'], ['dashboard-summary'], ['dashboard-my-team'], ['leave-balance']],
    },
    {
      key: 'wfh',
      label: 'WFH',
      variant: 'info',
      enabled: hasPermission('LEAVE_APPROVE'),
      fetch: () => attendanceApi.teamWfh(),
      toItems: (rows) => rows.filter((r) => !r.status || r.status === 'PENDING').map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        title: 'Work from home',
        details: formatDay(r.workDate),
        reason: r.reason,
        requestDate: r.workDate,
      })),
      approve: (item, note) => attendanceApi.approveWfh(item.id, note),
      reject: (item, note) => attendanceApi.rejectWfh(item.id, note),
      invalidate: [['attendance-wfh-team']],
    },
    {
      key: 'regularization',
      label: 'Attendance corrections',
      variant: 'warning',
      enabled: hasPermission('ATTENDANCE_MANAGE'),
      fetch: () => attendanceApi.pendingRegularizations(),
      toItems: (rows) => rows.filter((r) => !r.status || r.status === 'PENDING').map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        title: 'Attendance correction',
        details: joinDetails(
          formatDay(r.attendanceDate),
          r.requestedCheckIn && `${r.requestedCheckIn}${r.requestedCheckOut ? ` – ${r.requestedCheckOut}` : ''}`,
        ),
        reason: r.reason,
        requestDate: r.attendanceDate,
      })),
      approve: (item, note) => attendanceApi.reviewRegularization(item.id, true, note),
      reject: (item, note) => attendanceApi.reviewRegularization(item.id, false, note),
      invalidate: [['attendance-regularizations-pending'], ['attendance-exceptions']],
    },
    {
      key: 'overtime',
      label: 'Overtime',
      variant: 'neutral',
      enabled: hasPermission('OVERTIME_APPROVE'),
      fetch: () => overtimeApi.list('PENDING', otFrom, otTo),
      toItems: (rows, user) => rows
        .filter((r) => r.status === 'PENDING')
        // Your own overtime can't be reviewed by you (same rule as the Overtime page).
        .filter((r) => !(user?.employeeId && String(user.employeeId) === String(r.employeeId)))
        .map((r) => ({
          id: r.id,
          employeeId: r.employeeId,
          employeeName: r.employeeName,
          subtitle: joinDetails(r.employeeCode, r.departmentName),
          title: r.source === 'EMPLOYEE' ? 'Overtime claim' : 'Overtime',
          details: joinDetails(formatDay(r.workDate), `${formatMinutes(r.computedMinutes)} computed`, r.shiftName),
          reason: r.employeeNote,
          requestDate: r.workDate,
        })),
      // approvedMinutes null = approve the full computed overtime.
      approve: (item, note) => overtimeApi.review(item.id, true, null, note || null),
      reject: (item, note) => overtimeApi.review(item.id, false, null, note || null),
      invalidate: [['overtime']],
    },
    {
      key: 'expense',
      label: 'Expenses',
      variant: 'success',
      enabled: canManagerReviewExpenses,
      rejectNoteRequired: true,
      fetch: async () => {
        const [managerRows, financeRows] = await Promise.all([
          forbiddenAsEmpty(() => expensesApi.managerQueue()),
          isFinance ? forbiddenAsEmpty(() => expensesApi.financeQueue()) : Promise.resolve([]),
        ]);
        // Finance items win when a claim is in both queues (a submitted claim
        // with no active manager goes straight to final approval).
        const byId = new Map();
        managerRows.filter((c) => c.status === 'SUBMITTED').forEach((c) => byId.set(c.id, { ...c, _stage: 'manager' }));
        financeRows
          .filter((c) => c.status === 'SUBMITTED' || c.status === 'MANAGER_APPROVED')
          .forEach((c) => byId.set(c.id, { ...c, _stage: 'finance' }));
        return [...byId.values()];
      },
      toItems: (rows) => rows.map((c) => ({
        id: c.id,
        employeeId: c.employeeId,
        employeeName: c.employeeName,
        subtitle: c.departmentName,
        title: c._stage === 'finance' ? 'Expense · final approval' : 'Expense claim',
        details: joinDetails(c.title, formatCurrency(c.totalAmount)),
        reason: c.purpose,
        submittedAt: c.submittedAt,
        stage: c._stage,
      })),
      approve: (item, note) => (item.stage === 'finance'
        ? expensesApi.approve(item.id, note || null)
        : expensesApi.managerApprove(item.id, note || null)),
      reject: (item, note) => expensesApi.reject(item.id, note),
      invalidate: [['expense-approvals']],
    },
    {
      key: 'compoff',
      label: 'Comp-off',
      variant: 'primary',
      enabled: hasPermission('LEAVE_APPROVE'),
      fetch: () => compOffApi.approvals('PENDING'),
      toItems: (rows) => rows.filter((r) => !r.status || r.status === 'PENDING').map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        subtitle: r.departmentName,
        title: 'Comp-off credit',
        details: joinDetails(
          `Worked ${formatDay(r.workDate)}${r.dayType === 'HOLIDAY' ? ' (holiday)' : r.dayType ? ' (weekly off)' : ''}`,
          plural(r.days, 'day'),
          r.attendanceVerified === true ? 'Attendance verified' : r.attendanceVerified === false ? 'No attendance found' : null,
        ),
        reason: r.reason,
        submittedAt: r.createdAt,
        requestDate: r.workDate,
      })),
      approve: (item, note) => compOffApi.approve(item.id, note),
      reject: (item, note) => compOffApi.reject(item.id, note),
      invalidate: [['comp-off-approvals'], ['comp-off'], ['leave-balance']],
    },
    {
      key: 'encashment',
      label: 'Encashment',
      variant: 'warning',
      enabled: hasPermission('LEAVE_MANAGE'),
      fetch: () => encashmentApi.list('PENDING'),
      toItems: (rows) => rows.filter((r) => !r.status || r.status === 'PENDING').map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        subtitle: r.departmentName,
        title: 'Leave encashment',
        details: joinDetails(
          `${r.leaveTypeName}${r.leaveYear ? ` (${r.leaveYear})` : ''}`,
          plural(r.days, 'day'),
          r.amount != null ? formatCurrency(r.amount) : null,
        ),
        reason: r.reason,
        submittedAt: r.createdAt,
      })),
      approve: (item, note) => encashmentApi.approve(item.id, note),
      reject: (item, note) => encashmentApi.reject(item.id, note),
      invalidate: [['leave-encashment-approvals'], ['leave-encashments'], ['leave-balance']],
    },
    {
      key: 'fbp',
      label: 'FBP claims',
      variant: 'info',
      enabled: hasPermission('SALARY_MANAGE'),
      fetch: () => fbpApi.claims('SUBMITTED'),
      toItems: (rows) => rows.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        subtitle: r.employeeCode,
        title: 'FBP claim',
        details: joinDetails(
          r.componentName,
          formatCurrency(r.amount),
          r.billReference ? `bill ${r.billReference}` : null,
          r.billDate ? `dated ${formatDay(r.billDate)}` : null,
        ),
        reason: r.description,
        // The claim DTO has no submitted time, only the bill's date, so it shows no pending age.
        requestDate: r.billDate,
      })),
      approve: (item, note) => fbpApi.approveClaim(item.id, note),
      reject: (item, note) => fbpApi.rejectClaim(item.id, note),
      rejectNoteRequired: true,
      invalidate: [['fbp-claims']],
    },
    {
      key: 'loan',
      label: 'Loans',
      variant: 'warning',
      enabled: hasPermission('SALARY_MANAGE'),
      fetch: () => loansApi.list('REQUESTED'),
      toItems: (rows) => rows.filter((r) => r.status === 'REQUESTED').map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        subtitle: r.employeeCode,
        title: loanLabel(r.loanType),
        details: joinDetails(formatCurrency(r.requestedAmount), plural(r.requestedMonths, 'month')),
        reason: r.reason,
        submittedAt: r.requestedAt,
      })),
      // Approve as requested, interest-free, from next month; open Loans & Advances to change the terms.
      approve: (item, note) => loansApi.approve(item.id, { note: note || null }),
      reject: (item, note) => loansApi.reject(item.id, note),
      rejectNoteRequired: true,
      invalidate: [['loans']],
    },
    {
      key: 'travel',
      label: 'Travel',
      variant: 'info',
      // Reporting managers approve their reports' trips; finance sees all. The backend scopes the list.
      enabled: hasPermission('EXPENSE_APPROVE') || hasPermission('EXPENSE_MANAGE') || hasPermission('LEAVE_APPROVE'),
      fetch: () => travelApi.queue('PENDING'),
      toItems: (rows) => rows.filter((r) => r.canDecide).map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        subtitle: r.employeeCode,
        title: `Trip · ${r.fromCity} → ${r.toCity}`,
        details: joinDetails(
          r.departDate === r.returnDate ? formatDay(r.departDate) : `${formatDay(r.departDate)} – ${formatDay(r.returnDate)}`,
          r.estimatedCost != null ? `est. ${formatCurrency(r.estimatedCost)}` : null,
          Number(r.advanceAmount) > 0 ? `advance ${formatCurrency(r.advanceAmount)}` : null,
        ),
        reason: r.purpose,
        submittedAt: r.createdAt,
        requestDate: r.departDate,
      })),
      approve: (item, note) => travelApi.decide(item.id, true, note),
      reject: (item, note) => travelApi.decide(item.id, false, note),
      rejectNoteRequired: true,
      invalidate: [['travel-queue'], ['travel-mine']],
    },
    {
      key: 'resignation',
      label: 'Resignations',
      variant: 'danger',
      enabled: hasPermission('EMPLOYEE_MANAGE') || hasPermission('LEAVE_APPROVE'),
      fetch: () => resignationsApi.pending(),
      toItems: (rows) => rows.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        subtitle: [r.designation, r.departmentName].filter(Boolean).join(' · '),
        title: r.canHrReview ? 'Resignation (HR)' : 'Resignation',
        details: joinDetails(
          r.reasonCategory,
          `last day ${formatDay(r.managerRecommendedLastWorkingDate || r.requestedLastWorkingDate || r.policyLastWorkingDate)}`,
          r.noticeShortfallDays > 0 ? `${r.noticeShortfallDays} days short of notice` : null,
        ),
        reason: r.reason,
        submittedAt: r.resignationDate,
      })),
      // Approve keeps the suggested last day; open Exits to change it. Reject = retain the employee.
      approve: (item, note) => resignationsApi.approve(item.id, note),
      reject: (item, note) => resignationsApi.retain(item.id, note),
      rejectNoteRequired: true,
      invalidate: [['resignations'], ['resignation-summary']],
    },
    {
      key: 'timesheet',
      label: 'Timesheets',
      variant: 'info',
      enabled: hasPermission('TIMESHEET_APPROVE'),
      fetch: () => timesheetsApi.approvals(),
      toItems: (rows) => rows.map((r) => ({
        id: r.weekId,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        subtitle: r.departmentName,
        title: 'Timesheet',
        details: joinDetails(
          `Week of ${formatDay(r.weekStart)}`,
          `${formatHours(r.totalMinutes)} logged${r.targetMinutes && r.totalMinutes < r.targetMinutes ? ` (target ${formatHours(r.targetMinutes)})` : ''}`,
          r.billableMinutes ? `${formatHours(r.billableMinutes)} billable` : null,
        ),
        reason: r.projectSummary,
        submittedAt: r.submittedAt,
        requestDate: r.weekStart,
      })),
      approve: (item, note) => timesheetsApi.approve(item.id, note),
      reject: (item, note) => timesheetsApi.reject(item.id, note),
      rejectNoteRequired: true,
      invalidate: [['timesheet-team']],
    },
    {
      key: 'profile',
      label: 'Profile changes',
      variant: 'neutral',
      enabled: hasPermission('EMPLOYEE_MANAGE'),
      fetch: () => profileApi.pendingChanges(),
      toItems: (rows) => rows.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        subtitle: r.employeeCode,
        title: r.section === 'BANK' ? 'Bank details change' : 'Personal details change',
        details: r.changes.map((c) => `${c.label}: ${showValue(c.field, c.from)} → ${showValue(c.field, c.to)}`).join(' · '),
        reason: r.reason,
        submittedAt: r.requestedAt,
      })),
      approve: (item, note) => profileApi.approveChange(item.id, note),
      reject: (item, note) => profileApi.rejectChange(item.id, note),
      rejectNoteRequired: true,
      invalidate: [['profile'], ['employee']],
    },
  ];
}

/** Calendar days (IST) a request has waited since it was submitted; null when the source has no submitted time. */
function pendingDays(submittedAt) {
  if (!submittedAt || Number.isNaN(new Date(submittedAt).getTime())) return null;
  const toUtc = (day) => { const [y, m, d] = day.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.max(0, Math.round((toUtc(istToday()) - toUtc(toISTDateInputValue(submittedAt))) / 86400000));
}

function ageLabel(days) {
  if (days === null) return '—';
  if (days === 0) return 'Today';
  if (days < 60) return plural(days, 'day');
  return plural(Math.floor(days / 30), 'month');
}

/**
 * Sort key for oldest/newest-first: when it was submitted, else the date the
 * request is for (WFH day, attendance date, week…) for sources whose DTO has
 * no submitted time. Items with neither sort last either way.
 */
function sortTime(item) {
  const time = new Date(item.submittedAt || item.requestDate || '').getTime();
  return Number.isNaN(time) ? null : time;
}

/** Requests waiting this long are flagged in the "Pending since" column. */
const STALE_AFTER_DAYS = 3;

export default function Approvals() {
  const { hasPermission, user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('oldest');
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(() => new Set());
  const [rejecting, setRejecting] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  // { done, total } while "Approve selected" works through the batch one by one.
  const [bulkProgress, setBulkProgress] = useState(null);
  // Requests the last bulk run couldn't approve, with the server's reason, until dismissed.
  const [bulkFailures, setBulkFailures] = useState([]);
  const tabRefs = useRef({});

  const sources = useMemo(() => buildSources(hasPermission, user?.employeeId).filter((s) => s.enabled), [hasPermission, user?.employeeId]);

  const results = useQueries({
    queries: sources.map((source) => ({
      queryKey: ['approvals-inbox', source.key],
      queryFn: () => forbiddenAsEmpty(source.fetch),
      retry: false,
    })),
  });

  const sections = sources.map((source, index) => {
    const result = results[index] || {};
    const items = (result.data ? source.toItems(result.data, user) : []).map((item) => ({
      ...item,
      uid: `${source.key}:${item.id}`,
      source,
      age: pendingDays(item.submittedAt),
    }));
    return { source, result, items };
  });

  const allItems = sections.flatMap((s) => s.items);
  const inTab = filter === 'all' ? allItems : (sections.find((s) => s.source.key === filter)?.items || []);
  const needle = query.trim().toLowerCase();
  const visibleItems = inTab
    .filter((item) => !needle || [item.employeeName, item.subtitle, item.title]
      .some((value) => String(value || '').toLowerCase().includes(needle)))
    .map((item) => ({ item, time: sortTime(item) }))
    .sort((a, b) => {
      if (a.time === b.time) return 0;
      if (a.time === null) return 1;
      if (b.time === null) return -1;
      return sort === 'oldest' ? a.time - b.time : b.time - a.time;
    })
    .map(({ item }) => item);
  const isLoading = sections.some((s) => s.result.isLoading);
  const failed = sections.filter((s) => s.result.isError);
  const inScope = (s) => filter === 'all' || s.source.key === filter;
  const failedInTab = failed.filter(inScope);
  const loadingInTab = sections.some((s) => s.result.isLoading && inScope(s));
  const total = allItems.length;
  const bulkRunning = bulkProgress !== null;

  const visibleSelected = visibleItems.filter((item) => selected.has(item.uid));
  const allVisibleSelected = visibleItems.length > 0 && visibleSelected.length === visibleItems.length;

  const tabs = [
    { key: 'all', label: 'All', count: total, loading: isLoading, error: false },
    ...sections.map((s) => ({ key: s.source.key, label: s.source.label, count: s.items.length, loading: s.result.isLoading, error: s.result.isError })),
  ];
  const activeTab = tabs.find((t) => t.key === filter);

  const markBusy = (uids, on) => setBusy((prev) => {
    const next = new Set(prev);
    uids.forEach((uid) => (on ? next.add(uid) : next.delete(uid)));
    return next;
  });

  const refreshSources = (touched) => {
    touched.forEach((source) => {
      queryClient.invalidateQueries({ queryKey: ['approvals-inbox', source.key] });
      source.invalidate.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
    });
  };

  const unselect = (uid) => setSelected((prev) => { const next = new Set(prev); next.delete(uid); return next; });

  const toggle = (uid) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(uid)) next.delete(uid); else next.add(uid);
    return next;
  });

  const toggleAllVisible = () => setSelected((prev) => {
    const next = new Set(prev);
    if (allVisibleSelected) visibleItems.forEach((item) => next.delete(item.uid));
    else visibleItems.forEach((item) => next.add(item.uid));
    return next;
  });

  // Roving focus for the type chips: arrows / Home / End move between tabs (WAI-ARIA tabs pattern).
  const onTabKeyDown = (event, index) => {
    const moves = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const target = tabs[(moves[event.key] + tabs.length) % tabs.length];
    setFilter(target.key);
    tabRefs.current[target.key]?.focus();
  };

  async function approveOne(item) {
    markBusy([item.uid], true);
    try {
      await item.source.approve(item, undefined);
      toast.success(`Approved ${item.employeeName}'s ${item.title.toLowerCase()}.`);
      unselect(item.uid);
    } catch (error) {
      toast.error(errorMessage(error, `Could not approve ${item.employeeName}'s request.`));
    } finally {
      markBusy([item.uid], false);
      refreshSources([item.source]);
    }
  }

  async function submitReject(event) {
    event.preventDefault();
    const item = rejecting;
    if (!item) return;
    const note = rejectNote.trim();
    if (item.source.rejectNoteRequired && !note) return;
    markBusy([item.uid], true);
    try {
      await item.source.reject(item, note || undefined);
      toast.success(`Rejected ${item.employeeName}'s ${item.title.toLowerCase()}.`);
      unselect(item.uid);
      setRejecting(null);
      setRejectNote('');
    } catch (error) {
      toast.error(errorMessage(error, `Could not reject ${item.employeeName}'s request.`));
    } finally {
      markBusy([item.uid], false);
      refreshSources([item.source]);
    }
  }

  /**
   * Approves the selected visible rows one at a time with the same single-item
   * calls the row buttons use, so each source's own rules apply. Failures stay
   * selected and are listed with the server's reason; nothing is dropped.
   */
  async function approveSelected() {
    const items = visibleSelected;
    if (!items.length || bulkRunning) return;
    setBulkFailures([]);
    setBulkProgress({ done: 0, total: items.length });
    markBusy(items.map((i) => i.uid), true);
    let succeeded = 0;
    const failures = [];
    for (const item of items) {
      try {
        // Sequential on purpose: one decision at a time, with visible progress.
        await item.source.approve(item, undefined);
        succeeded += 1;
        unselect(item.uid);
      } catch (error) {
        failures.push({ uid: item.uid, label: `${item.employeeName || 'Employee'} · ${item.title}`, message: errorMessage(error, 'Could not approve.') });
      }
      markBusy([item.uid], false);
      setBulkProgress({ done: succeeded + failures.length, total: items.length });
    }
    setBulkProgress(null);
    setBulkFailures(failures);
    refreshSources([...new Set(items.map((i) => i.source))]);
    if (failures.length === 0) {
      toast.success(`Approved ${plural(succeeded, 'request')}.`);
    } else if (succeeded === 0) {
      toast.error(`None of the ${plural(failures.length, 'request')} could be approved. They're still in the list.`);
    } else {
      toast.info(`Approved ${succeeded}, ${failures.length} failed. Failed requests are still in the list.`);
    }
  }

  const description = sources.length === 0
    ? "You don't have any approval permissions."
    : isLoading
      ? 'Everything waiting on your decision, in one place.'
      : `${plural(total, 'request')} waiting on your decision across leave, attendance and expenses.`;

  return (
    <div className="hz-module-page hz-approvals">
      <PageHeader
        eyebrow="Workspace"
        title="Approvals"
        description={description}
        actions={sources.length > 0 && (
          <>
            <span className="hz-badge hz-badge--warning" aria-live="polite" data-testid="approvals-total">
              {isLoading ? 'Loading…' : `${total} pending`}
            </span>
            <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => results.forEach((r) => r.refetch?.())}>Refresh</Button>
          </>
        )}
      />

      {sources.length === 0 ? (
        <Card><EmptyState icon={ClipboardCheck} title="No approval access" description="Approvals appear here once you're given permission to review requests." /></Card>
      ) : (
        <>
          <div className="hz-approvals__chips" role="tablist" aria-label="Filter approvals by type">
            {tabs.map((tab, index) => {
              const active = filter === tab.key;
              const empty = tab.count === 0 && !tab.loading && !tab.error;
              return (
                <button
                  key={tab.key}
                  ref={(node) => { tabRefs.current[tab.key] = node; }}
                  type="button"
                  role="tab"
                  id={`approvals-tab-${tab.key}`}
                  aria-controls="approvals-panel"
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setFilter(tab.key)}
                  onKeyDown={(event) => onTabKeyDown(event, index)}
                  className={`hz-approvals__chip${active ? ' is-active' : ''}${empty ? ' is-empty' : ''}`}
                >
                  {tab.label}
                  {tab.error ? (
                    <span className="hz-approvals__chip-count is-error" aria-label="couldn't load"><AlertTriangle size={12} aria-hidden="true" /></span>
                  ) : (
                    <span className="hz-approvals__chip-count" aria-label={`${tab.count} pending`}>{tab.loading ? '…' : tab.count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {failed.length > 0 && (
            <div className="hz-approvals__alert" role="alert">
              <AlertTriangle size={16} aria-hidden="true" />
              <span className="hz-approvals__alert-text">
                Couldn't load {failed.map((s) => s.source.label).join(', ')}. Other approvals are shown below.
              </span>
              <span className="hz-approvals__alert-actions">
                {failed.map((s) => (
                  <Button key={s.source.key} variant="secondary" size="sm" icon={RefreshCw} onClick={() => s.result.refetch?.()} aria-label={`Retry ${s.source.label}`}>
                    {failed.length > 1 ? s.source.label : 'Retry'}
                  </Button>
                ))}
              </span>
            </div>
          )}

          {bulkFailures.length > 0 && (
            <div className="hz-approvals__alert" role="alert">
              <AlertTriangle size={16} aria-hidden="true" />
              <div className="hz-approvals__alert-text">
                <strong>{plural(bulkFailures.length, 'request')} couldn't be approved and {bulkFailures.length === 1 ? 'is' : 'are'} still selected:</strong>
                <ul>
                  {bulkFailures.map((failure) => <li key={failure.uid}>{`${failure.label}: ${failure.message}`}</li>)}
                </ul>
              </div>
              <button type="button" className="hz-approvals__icon-button" onClick={() => setBulkFailures([])} aria-label="Dismiss approval failures">
                <XIcon size={16} aria-hidden="true" />
              </button>
            </div>
          )}

          <section className="hz-approvals__panel" id="approvals-panel" role="tabpanel" aria-labelledby={`approvals-tab-${filter}`}>
            <div className="hz-approvals__toolbar">
              <label className="hz-approvals__search">
                <Search size={15} aria-hidden="true" />
                <input type="search" placeholder="Search by name" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search approvals by name" />
              </label>
              <select className="form-select hz-approvals__sort" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort approvals">
                <option value="oldest">Oldest first</option>
                <option value="newest">Newest first</option>
              </select>
              <span className="hz-approvals__total">{needle ? `${visibleItems.length} of ${inTab.length}` : `Total: ${inTab.length}`}</span>
            </div>

            {visibleItems.length > 0 && (
              <div className="hz-approvals__bulkbar">
                <label className="hz-approvals__select-all">
                  <input
                    type="checkbox"
                    className="form-check-input m-0"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    disabled={bulkRunning}
                    aria-label="Select all visible requests"
                  />
                  {visibleSelected.length > 0 ? `${visibleSelected.length} selected` : 'Select all'}
                </label>
                {bulkRunning && (
                  <div className="hz-approvals__progress" role="status" aria-live="polite">
                    <span>Approving {Math.min(bulkProgress.done + 1, bulkProgress.total)} of {bulkProgress.total}…</span>
                    <span className="hz-approvals__progress-track" aria-hidden="true">
                      <span style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }} />
                    </span>
                  </div>
                )}
                <Button size="sm" icon={CheckCheck} onClick={approveSelected} loading={bulkRunning} disabled={visibleSelected.length === 0}>
                  Approve selected{visibleSelected.length > 0 ? ` (${visibleSelected.length})` : ''}
                </Button>
              </div>
            )}

            {loadingInTab && visibleItems.length === 0 ? (
              <ul className="hz-approvals__skeleton" aria-busy="true" aria-label="Loading approvals">
                {[0, 1, 2, 3].map((i) => (
                  <li key={i}>
                    <Skeleton width={34} height={34} radius="50%" />
                    <div>
                      <Skeleton height={12} width="35%" />
                      <Skeleton height={10} width="60%" />
                    </div>
                    <Skeleton width={150} height={30} radius={8} />
                  </li>
                ))}
              </ul>
            ) : visibleItems.length === 0 ? (
              needle && inTab.length > 0 ? (
                <EmptyState
                  icon={Search}
                  title="No requests match this search"
                  description={`Nobody in ${filter === 'all' ? 'the inbox' : activeTab?.label.toLowerCase()} matches "${query.trim()}".`}
                  action={<Button variant="secondary" size="sm" onClick={() => setQuery('')}>Clear search</Button>}
                />
              ) : failedInTab.length > 0 ? (
                <div className="hz-state hz-state--error" role="alert">
                  <div className="hz-state__icon-wrap" aria-hidden="true"><AlertTriangle size={26} aria-hidden="true" /></div>
                  <h2 className="hz-state__title">Couldn't load {failedInTab.map((s) => s.source.label.toLowerCase()).join(', ')}</h2>
                  <p className="hz-state__description">These requests are still waiting; they just couldn't be fetched.</p>
                  <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => failedInTab.forEach((s) => s.result.refetch?.())}>Try again</Button>
                </div>
              ) : (
                <EmptyState
                  icon={CheckCheck}
                  title="You're all caught up"
                  description={filter === 'all' ? 'Nothing is waiting on your decision right now.' : `No pending ${activeTab?.label.toLowerCase()} requests.`}
                />
              )
            ) : (
              <div className="hz-approvals__table-wrap">
                <table className="hz-approvals__table" aria-label="Pending approvals">
                  <thead>
                    <tr>
                      <th className="hz-approvals__check-col"><span className="visually-hidden">Select</span></th>
                      <th>Employee</th>
                      <th>Request</th>
                      <th>Details</th>
                      <th>Reason</th>
                      <th>Pending since</th>
                      <th><span className="visually-hidden">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.map((item) => (
                      <ApprovalRow
                        key={item.uid}
                        item={item}
                        checked={selected.has(item.uid)}
                        busy={busy.has(item.uid)}
                        locked={bulkRunning}
                        onToggle={() => toggle(item.uid)}
                        onApprove={() => approveOne(item)}
                        onReject={() => { setRejecting(item); setRejectNote(''); }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <Dialog
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title={rejecting ? `Reject ${rejecting.title.toLowerCase()}` : 'Reject request'}
        description={rejecting ? joinDetails(rejecting.employeeName, rejecting.details) : undefined}
      >
        {rejecting && (
          <form onSubmit={submitReject}>
            <FormField
              as="textarea"
              rows={3}
              label={rejecting.source.rejectNoteRequired ? 'Rejection reason' : 'Note for the employee (optional)'}
              required={!!rejecting.source.rejectNoteRequired}
              value={rejectNote}
              onChange={setRejectNote}
              maxLength={500}
              placeholder="Explain why this request can't be approved…"
            />
            <div className="d-flex justify-content-end gap-2 mt-2">
              <Button variant="secondary" onClick={() => setRejecting(null)}>Cancel</Button>
              <Button
                type="submit"
                variant="danger"
                loading={busy.has(rejecting.uid)}
                disabled={rejecting.source.rejectNoteRequired && !rejectNote.trim()}
              >
                Reject
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}

function ApprovalRow({ item, checked, busy, locked, onToggle, onApprove, onReject }) {
  const who = item.employeeName || 'Employee';
  const what = item.title.toLowerCase();
  const stale = item.age !== null && item.age >= STALE_AFTER_DAYS;
  return (
    <tr className={checked ? 'is-selected' : undefined}>
      <td className="hz-approvals__check-col">
        <input
          type="checkbox"
          className="form-check-input m-0"
          checked={checked}
          onChange={onToggle}
          disabled={busy || locked}
          aria-label={`Select ${who}'s ${what}`}
        />
      </td>
      <td className="hz-approvals__who">
        <Avatar name={who} size="sm" />
        <div>
          {item.employeeId ? (
            <Link to={`/employees/${item.employeeId}`} className="hz-approvals__name">{who}</Link>
          ) : (
            <span className="hz-approvals__name">{who}</span>
          )}
          {item.subtitle && <small>{item.subtitle}</small>}
        </div>
      </td>
      <td data-label="Request"><Badge variant={item.source.variant}>{item.title}</Badge></td>
      <td data-label="Details" className="hz-approvals__details">{item.details || '—'}</td>
      <td data-label="Reason" className="hz-approvals__reason"><span title={item.reason || undefined}>{item.reason || '—'}</span></td>
      <td data-label="Pending since" className="hz-approvals__age">
        {item.age === null ? (
          <span title="This request type doesn't record when it was submitted">—</span>
        ) : (
          <>
            <strong className={stale ? 'is-stale' : undefined}>{ageLabel(item.age)}</strong>
            <small>{formatDateIST(item.submittedAt)}</small>
          </>
        )}
      </td>
      <td className="hz-approvals__actions">
        <Button size="sm" variant="secondary" icon={XIcon} onClick={onReject} disabled={busy || locked} aria-label={`Reject ${who}'s ${what}`}>Reject</Button>
        <Button size="sm" icon={Check} onClick={onApprove} loading={busy} disabled={locked} aria-label={`Approve ${who}'s ${what}`}>Approve</Button>
      </td>
    </tr>
  );
}
