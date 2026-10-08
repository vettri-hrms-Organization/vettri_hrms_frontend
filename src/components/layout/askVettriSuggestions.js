import {
  Activity,
  Briefcase,
  CalendarDays,
  FileText,
  MonitorCog,
  ShieldCheck,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import { NAV_INDEX } from './navConfig.js';

const ASK_VETTRI_INTENTS = [
  {
    id: 'profile',
    label: 'View my profile',
    description: 'Check your employee profile and work details',
    route: '/my-profile',
    permissions: ['SELF_PROFILE_VIEW'],
    keywords: ['profile', 'my details', 'about me', 'who am i', 'employee profile'],
    audiences: ['employee'],
    defaultPriority: 10,
    icon: UserRound,
  },
  {
    id: 'attendance',
    label: 'Open my attendance',
    description: 'Review your attendance records and hours',
    route: '/my-attendance',
    permissions: ['SELF_ATTENDANCE_VIEW'],
    keywords: ['attendance', 'my time', 'clock in', 'clock out', 'hours worked', 'timesheet'],
    audiences: ['employee'],
    defaultPriority: 9,
    icon: CalendarDays,
  },
  {
    id: 'personal-leave',
    label: 'Check my leave',
    description: 'Open your leave balance and requests',
    route: '/my-profile?tab=leave',
    permissions: ['SELF_PROFILE_VIEW', 'SELF_LEAVE_VIEW'],
    keywords: ['my leave', 'leave balance', 'my time off', 'my vacation', 'my absence'],
    audiences: ['employee'],
    defaultPriority: 8,
    icon: CalendarDays,
  },
  {
    id: 'team-leave',
    label: 'Review team leave',
    description: 'Review and approve employee time-off requests',
    route: '/leave',
    permissions: ['LEAVE_APPROVE'],
    keywords: ['team leave', 'approve leave', 'leave approvals', 'time off approvals', 'pending leave'],
    audiences: ['manager', 'hr', 'admin'],
    defaultPriority: 9,
    icon: CalendarDays,
  },
  {
    id: 'attendance-management',
    label: 'Manage attendance',
    description: 'Review attendance across your authorized workforce',
    route: '/attendance',
    permissions: ['ATTENDANCE_VIEW'],
    keywords: ['attendance management', 'team attendance', 'employee attendance', 'attendance records'],
    audiences: ['manager', 'hr', 'admin'],
    defaultPriority: 6,
    icon: Activity,
  },
  {
    id: 'employees',
    label: 'Manage employees',
    description: 'Open employee records and the people directory',
    route: '/employees',
    permissions: ['EMPLOYEE_VIEW'],
    keywords: ['employee', 'employees', 'people', 'team directory', 'staff'],
    audiences: ['manager', 'hr', 'admin'],
    defaultPriority: 7,
    icon: Users,
  },
  {
    id: 'recruitment',
    label: 'Open recruitment',
    description: 'Review job openings and candidates',
    route: '/recruitment',
    permissions: ['RECRUITMENT_VIEW'],
    keywords: ['recruitment', 'hiring', 'job opening', 'candidates', 'talent'],
    audiences: ['hr', 'admin'],
    defaultPriority: 6,
    icon: Briefcase,
  },
  {
    id: 'payslip',
    label: 'View my payslip',
    description: 'Open your personal payslip',
    route: '/my-payslip',
    permissions: ['SELF_PAYSLIP_VIEW'],
    keywords: ['my payslip', 'payslip', 'my pay', 'pay stub', 'salary slip'],
    audiences: ['employee'],
    defaultPriority: 8,
    icon: Wallet,
  },
  {
    id: 'payroll',
    label: 'Manage payroll',
    description: 'Open payroll and salary management',
    route: '/salary',
    permissions: ['SALARY_VIEW'],
    keywords: ['payroll', 'salary dashboard', 'salary management', 'compensation'],
    audiences: ['hr', 'admin'],
    defaultPriority: 6,
    icon: Wallet,
  },
  {
    id: 'monitoring',
    label: 'Open live activity',
    description: 'Review live activity in your authorized scope',
    route: '/monitoring',
    permissions: ['MONITORING_VIEW'],
    keywords: ['monitoring', 'live activity', 'activity status', 'employee activity'],
    audiences: ['manager', 'it'],
    defaultPriority: 6,
    icon: MonitorCog,
  },
  {
    id: 'devices',
    label: 'Manage IT devices',
    description: 'Open managed devices and device status',
    route: '/monitoring/devices',
    permissions: ['IT_MANAGEMENT_ACCESS', 'MONITORING_VIEW'],
    keywords: ['it devices', 'devices', 'device status', 'managed devices'],
    audiences: ['it'],
    defaultPriority: 8,
    icon: MonitorCog,
  },
  {
    id: 'software',
    label: 'Manage software',
    description: 'Open IT software management',
    route: '/software',
    permissions: ['IT_MANAGEMENT_ACCESS', 'SOFTWARE_VIEW'],
    keywords: ['software', 'installed software', 'software inventory'],
    audiences: ['it'],
    defaultPriority: 6,
    icon: MonitorCog,
  },
  {
    id: 'biometric-devices',
    label: 'Manage biometric devices',
    description: 'Open biometric attendance device management',
    route: '/attendance/devices',
    permissions: ['DEVICE_MANAGE'],
    keywords: ['biometric', 'biometric device', 'attendance device'],
    audiences: ['it'],
    defaultPriority: 6,
    icon: MonitorCog,
  },
  {
    id: 'reports',
    label: 'Open reports',
    description: 'Review HR and business reports',
    route: '/reports',
    permissions: ['REPORTS_VIEW'],
    keywords: ['report', 'reports', 'analytics', 'business insights', 'summary'],
    audiences: ['manager', 'hr', 'admin'],
    defaultPriority: 5,
    icon: FileText,
  },
  {
    id: 'users',
    label: 'Manage users and roles',
    description: 'Open user and role administration',
    route: '/settings/users',
    permissions: ['USER_VIEW'],
    keywords: ['users', 'roles', 'user access', 'permissions', 'user administration'],
    audiences: ['admin'],
    defaultPriority: 7,
    icon: ShieldCheck,
  },
  {
    id: 'organization',
    label: 'Manage organization settings',
    description: 'Open organization structure and settings',
    route: '/settings/organization',
    permissions: ['ORG_MANAGE'],
    keywords: ['organization', 'departments', 'designations', 'teams', 'company settings'],
    audiences: ['hr', 'admin'],
    defaultPriority: 5,
    icon: ShieldCheck,
  },
  {
    id: 'platform-admin',
    label: 'Open platform administration',
    description: 'Manage platform companies and subscriptions',
    route: '/settings/platform',
    permissions: [],
    keywords: ['platform administration', 'companies', 'subscriptions', 'platform settings'],
    audiences: ['admin'],
    defaultPriority: 6,
    icon: ShieldCheck,
  },
];

const ROLE_AUDIENCES = {
  employee: ['EMPLOYEE'],
  manager: ['MANAGER'],
  hr: ['HR_ADMIN'],
  it: ['IT_ADMIN', 'IT_MANAGER', 'IT_SUPPORT'],
  admin: ['COMPANY_ADMIN', 'SUPER_ADMIN'],
};

const AUDIENCE_PRIORITY = {
  employee: 8,
  manager: 18,
  hr: 18,
  it: 18,
  admin: 20,
};

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function userHasRole(role, user, hasRole) {
  return hasRole(role) || (user?.roles || []).some((userRole) => userRole?.toUpperCase() === role);
}

function getUserAudiences(user, hasPermission, hasRole) {
  const audiences = new Set();
  if (user?.employeeId || userHasRole('EMPLOYEE', user, hasRole)) audiences.add('employee');
  if (userHasRole('MANAGER', user, hasRole) || hasPermission('LEAVE_APPROVE')) audiences.add('manager');
  if (userHasRole('HR_ADMIN', user, hasRole) || hasPermission('EMPLOYEE_MANAGE')) audiences.add('hr');
  if (
    ['it'].some((audience) => ROLE_AUDIENCES[audience].some((role) => userHasRole(role, user, hasRole))) ||
    hasPermission('IT_MANAGEMENT_ACCESS')
  ) audiences.add('it');
  if (
    ROLE_AUDIENCES.admin.some((role) => userHasRole(role, user, hasRole)) ||
    hasPermission('USER_VIEW') ||
    hasPermission('ORG_MANAGE')
  ) audiences.add('admin');
  return audiences;
}

function routeIsInNavigation(route) {
  const routePath = route.split('?')[0];
  return NAV_INDEX.some((entry) => entry.to === route || entry.to.split('?')[0] === routePath);
}

function canReachNavEntry(entry, hasPermission, hasRole) {
  const requiredPermissions = [entry.permission, entry.sectionPermission].filter(Boolean);
  const requiredRoles = [
    ...(entry.role ? [entry.role] : []),
  ];

  return requiredPermissions.every((permission) => hasPermission(permission))
    && requiredRoles.every((role) => hasRole(role))
    && (!entry.roles?.length || entry.roles.some((role) => hasRole(role)));
}

function intentIsAvailable(intent, hasPermission, hasRole) {
  if (!intent.permissions.every((permission) => hasPermission(permission))) return false;

  const matchingEntries = NAV_INDEX.filter((entry) =>
    entry.to === intent.route || entry.to.split('?')[0] === intent.route.split('?')[0]
  );

  return matchingEntries.some((entry) => canReachNavEntry(entry, hasPermission, hasRole));
}

function scoreIntent(intent, query) {
  if (!query) return intent.defaultPriority;

  const normalizedQuery = normalizeText(query);
  const phraseMatches = intent.keywords
    .map(normalizeText)
    .filter((keyword) => keyword && normalizedQuery.includes(keyword));
  let score = phraseMatches.reduce((total, keyword) => total + 35 + keyword.split(' ').length * 5, 0);

  const queryTokens = [...new Set(normalizedQuery.split(' '))];
  const intentTokens = new Set(
    normalizeText(`${intent.label} ${intent.description} ${intent.keywords.join(' ')}`).split(' ')
  );
  const matchedTokens = queryTokens.filter((token) => intentTokens.has(token));
  score += matchedTokens.length * 12;

  if (normalizeText(intent.label) === normalizedQuery) score += 80;
  if (normalizedQuery.includes('my') && intent.audiences.includes('employee')) score += 8;
  if (normalizedQuery.includes('team') && intent.audiences.includes('manager')) score += 10;
  if (normalizedQuery.includes('it') && intent.audiences.includes('it')) score += 10;

  return score;
}

export function getAskVettriSuggestions({ query = '', user, hasPermission, hasRole }) {
  const normalizedQuery = normalizeText(query);
  const audiences = getUserAudiences(user, hasPermission, hasRole);

  return ASK_VETTRI_INTENTS
    .filter((intent) => intentIsAvailable(intent, hasPermission, hasRole))
    .map((intent) => ({
      intent,
      score: scoreIntent(intent, normalizedQuery) + (
        normalizedQuery
          ? 0
          : intent.audiences.reduce((boost, audience) => boost + (audiences.has(audience) ? AUDIENCE_PRIORITY[audience] : 0), 0)
      ),
    }))
    .filter(({ score }) => normalizedQuery ? score > 0 : true)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.intent.label.localeCompare(right.intent.label);
    })
    .slice(0, 6)
    .map(({ intent }) => intent);
}

export function isAskVettriRoute(route) {
  return routeIsInNavigation(route);
}
