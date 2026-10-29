import {
  LayoutDashboard,
  UserRound,
  Users,
  Clock,
  CalendarDays,
  Briefcase,
  CalendarClock,
  TrendingUp,
  FileBarChart,
  FileText,
  ShieldCheck,
  ScrollText,
  Building2,
  Wallet,
  ListChecks,
  FileSpreadsheet,
  PlayCircle,
  Radio,
  Presentation,
  UserCheck,
  Receipt,
  MonitorSmartphone,
  ClipboardList,
  LifeBuoy,
  Bell,
  PackageOpen,
  Network,
  KeyRound,
  CalendarRange,
  AlarmClock,
  Timer,
  Megaphone,
  ClipboardCheck,
} from 'lucide-react';

/**
 * Premium Fly-out Modules Navigation
 * 
 * Single source of truth for app navigation organized as enterprise modules.
 * Each module represents a major area of the HRMS with logical submenus.
 * 
 * Structure:
 * - Module ID: unique identifier
 * - Label: display name (kept short for sidebar)
 * - Description: explains what the module does
 * - Icon: lucide icon for the module
 * - Permission: section-level permission gate
 * - Items: sub-pages and features within the module
 * 
 * Permission system uses existing permission names from backend.
 * Items are shown only if user has permission to view them.
 */
export const NAV_SECTIONS = [
  {
    id: 'employee-home',
    label: 'Home',
    description: 'Your Vettri HRMS workspace at a glance',
    permission: 'SELF_PROFILE_VIEW',
    collapsible: true,
    badge: null,
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Home', end: true, permission: 'SELF_PROFILE_VIEW' },
      // One inbox for every request waiting on this person (leave, WFH, corrections, overtime, expenses...).
      { to: '/approvals', icon: ClipboardCheck, label: 'Approvals', permissionsAny: ['LEAVE_APPROVE', 'LEAVE_MANAGE', 'ATTENDANCE_MANAGE', 'OVERTIME_APPROVE', 'EXPENSE_APPROVE', 'EXPENSE_MANAGE'] },
    ],
  },
  {
    id: 'employee-me',
    label: 'Me',
    description: 'Your profile, time, pay, and employee services',
    permission: 'SELF_PROFILE_VIEW',
    collapsible: true,
    badge: null,
    items: [
      { to: '/my-profile', icon: UserRound, label: 'My Profile', end: true, permission: 'SELF_PROFILE_VIEW' },
      { to: '/my-profile?tab=job', icon: Briefcase, label: 'My Job', permission: 'SELF_PROFILE_VIEW' },
      { to: '/my-attendance', icon: Clock, label: 'My Attendance', permission: 'SELF_ATTENDANCE_VIEW' },
      { to: '/my-holidays', icon: CalendarRange, label: 'Holidays', permission: 'SELF_LEAVE_VIEW' },
      { to: '/my-profile?tab=leave', icon: CalendarDays, label: 'Leave', permission: 'SELF_LEAVE_VIEW' },
      { to: '/my-profile?tab=documents', icon: FileText, label: 'My Documents', permission: 'SELF_DOCUMENT_VIEW' },
      { to: '/my-onboarding', icon: ListChecks, label: 'My Onboarding', permission: 'SELF_PROFILE_VIEW' },
      { to: '/my-expenses', icon: Receipt, label: 'My Expenses', permission: 'SELF_EXPENSE_SUBMIT' },
      { to: '/announcements', icon: Megaphone, label: 'Announcements', permission: 'SELF_PROFILE_VIEW' },
      { to: '/my-interviews', icon: CalendarClock, label: 'My Interviews' },
    ],
  },
  {
    id: 'employee-team',
    label: 'My Team',
    description: 'Leave and team workflows assigned to you',
    permission: 'LEAVE_APPROVE',
    collapsible: true,
    badge: null,
    items: [{ to: '/leave', icon: Users, label: 'Team Leave' }],
  },
  {
    id: 'employee-finances',
    label: 'My Finances',
    description: 'Your salary and payroll information',
    permission: 'SELF_PAYSLIP_VIEW',
    collapsible: true,
    badge: null,
    items: [
      { to: '/my-payslip', icon: Wallet, label: 'My Pay' },
      { to: '/my-tax-declaration', icon: Receipt, label: 'Tax Declaration' },
      { to: '/my-settlement', icon: FileText, label: 'Full & Final' },
    ],
  },
  {
    id: 'employee-performance',
    label: 'Performance',
    description: 'Your goals and performance reviews',
    // Everyone can see their own goals and reviews (the backend allows self access).
    permission: 'SELF_PROFILE_VIEW',
    collapsible: true,
    badge: null,
    items: [{ to: '/performance', icon: TrendingUp, label: 'My Performance' }],
  },
  {
    id: 'employee-apps',
    label: 'Apps',
    description: 'Vettri HRMS services and support',
    permission: 'SELF_PROFILE_VIEW',
    collapsible: true,
    badge: null,
    items: [{ to: '/support', icon: LifeBuoy, label: 'Support' }, { to: '/privacy', icon: ShieldCheck, label: 'Privacy' }],
  },
  {
    id: 'root',
    label: 'Dashboard',
    description: 'Workspace overview and quick actions',
    collapsible: true,
    badge: null,
    items: [{ to: '/dashboard', icon: LayoutDashboard, label: 'Overview', end: true }],
  },
  {
    id: 'organization',
    label: 'Organization',
    description: 'Company administration and governance',
    collapsible: true,
    badge: null,
    items: [
      { to: '/organization/structure', icon: Network, label: 'Organization Structure', permission: 'ORG_VIEW' },
      { to: '/employees/import', icon: FileSpreadsheet, label: 'Import Employees', permission: 'EMPLOYEE_IMPORT' },
      {
        to: '/settings/organization',
        icon: Building2,
        label: 'Organization Settings',
        permissionsAny: [
          'ORG_VIEW', 'ORG_MANAGE',
          'OFFICE_LOCATION_VIEW', 'OFFICE_LOCATION_CREATE',
          'OFFICE_LOCATION_UPDATE', 'OFFICE_LOCATION_DEACTIVATE',
        ],
      },
      { to: '/settings/users', icon: ShieldCheck, label: 'Users & Roles', permission: 'USER_VIEW' },
    ],
  },
  {
    id: 'attendance',
    label: 'Attendance',
    description: 'Track attendance and time off',
    collapsible: true,
    badge: null,
    items: [
      { to: '/attendance', icon: Clock, label: 'Attendance', permission: 'ATTENDANCE_VIEW' },
      { to: '/leave', icon: CalendarDays, label: 'Leave Management', permission: 'LEAVE_VIEW' },
      { to: '/attendance/roster', icon: CalendarRange, label: 'Roster', permission: 'ATTENDANCE_VIEW' },
      { to: '/attendance/late-early', icon: AlarmClock, label: 'Late & Early', permission: 'ATTENDANCE_VIEW' },
      { to: '/attendance/overtime', icon: Timer, label: 'Overtime Approvals', permission: 'OVERTIME_APPROVE' },
    ],
  },
  {
    id: 'talent',
    label: 'Talent',
    description: 'Recruitment and performance',
    collapsible: true,
    badge: null,
    items: [
      { to: '/recruitment', icon: Briefcase, label: 'Recruitment', permission: 'RECRUITMENT_VIEW' },
      { to: '/my-recruitment', icon: UserCheck, label: 'My Recruiting', permission: 'RECRUITMENT_MANAGE' },
      { to: '/my-interviews', icon: CalendarClock, label: 'My Interviews' },
      { to: '/performance', icon: TrendingUp, label: 'Performance', permission: 'PERFORMANCE_VIEW' },
      { to: '/hr-onboarding', icon: ListChecks, label: 'Onboarding', permission: 'ONBOARDING_MANAGE' },
    ],
  },
  {
    id: 'team-monitoring',
    label: 'Team Monitoring',
    description: 'Activity and reports for employees in your authorized scope',
    collapsible: true,
    permission: 'MONITORING_VIEW',
    badge: null,
    items: [
      { to: '/monitoring', icon: MonitorSmartphone, label: 'Live Activity', end: true },
      { to: '/monitoring/activity', icon: Clock, label: 'Activity Log' },
      { to: '/monitoring/reports', icon: FileBarChart, label: 'Reports' },
    ],
  },
  {
    id: 'monitoring',
    label: 'IT MANAGEMENT',
    description: 'Managed devices and software',
    collapsible: true,
    permission: 'IT_MANAGEMENT_ACCESS',
    badge: null,
    items: [
      { to: '/monitoring', icon: MonitorSmartphone, label: 'Live Activity', end: true, permission: 'MONITORING_VIEW' },
      { to: '/monitoring/devices', icon: MonitorSmartphone, label: 'Devices', permission: 'MONITORING_VIEW' },
      { to: '/monitoring/activity', icon: Clock, label: 'Activity Log', permission: 'MONITORING_VIEW' },
      { to: '/monitoring/reports', icon: FileBarChart, label: 'Reports', permission: 'MONITORING_VIEW' },
      { to: '/attendance/devices', icon: Radio, label: 'Biometric Devices', permission: 'DEVICE_MANAGE' },
      { to: '/software', icon: PackageOpen, label: 'Software', permission: 'SOFTWARE_VIEW' },
    ],
  },
  {
    id: 'payroll',
    label: 'Payroll',
    description: 'Compensation and salary management',
    collapsible: true,
    permission: 'SALARY_VIEW',
    badge: null,
    items: [
      { to: '/salary', icon: Wallet, label: 'Salary Dashboard', end: true },
      { to: '/salary/employees', icon: ListChecks, label: 'Employee Salary' },
      { to: '/salary/structure', icon: FileSpreadsheet, label: 'Salary Structure' },
      { to: '/salary/payroll-processing', icon: PlayCircle, label: 'Payroll Processing' },
      { to: '/salary/reports', icon: FileBarChart, label: 'Reports' },
      { to: '/salary/tax-declarations', icon: Receipt, label: 'Tax Declarations' },
      { to: '/salary/settlements', icon: UserCheck, label: 'Full & Final', permission: 'SALARY_VIEW' },
      { to: '/salary/accounting', icon: FileSpreadsheet, label: 'Accounting Export', permission: 'SALARY_MANAGE' },
      { to: '/salary/settings', icon: ShieldCheck, label: 'Payroll Settings', permission: 'SALARY_MANAGE' },
    ],
  },
  {
    id: 'insights',
    label: 'Insights',
    description: 'Analytics and reporting',
    collapsible: true,
    badge: null,
    items: [
      { to: '/executive', icon: Presentation, label: 'Executive Dashboard', permission: 'REPORTS_VIEW' },
      { to: '/reports', icon: FileBarChart, label: 'Reports', permission: 'REPORTS_VIEW' },
      { to: '/requirements', icon: ClipboardList, label: 'Requirements', permission: 'REQUIREMENT_VIEW' },
    ],
  },
  {
    id: 'workplace',
    label: 'Expenses & Announcements',
    description: 'Expense approvals and company announcements',
    collapsible: true,
    badge: null,
    items: [
      { to: '/expenses/approvals', icon: Receipt, label: 'Expense Approvals', permissionsAny: ['EXPENSE_APPROVE', 'EXPENSE_MANAGE'] },
      { to: '/announcements/manage', icon: Megaphone, label: 'Manage Announcements', permission: 'ANNOUNCEMENT_MANAGE' },
    ],
  },
  {
    id: 'administration',
    label: 'Settings',
    description: 'System configuration and administration',
    collapsible: true,
    badge: null,
    items: [
      { to: '/settings/users', icon: ShieldCheck, label: 'Users & Roles', permission: 'USER_VIEW' },
      {
        to: '/settings/organization',
        icon: Building2,
        label: 'Organization Settings',
        permissionsAny: [
          'ORG_VIEW', 'ORG_MANAGE',
          'OFFICE_LOCATION_VIEW', 'OFFICE_LOCATION_CREATE',
          'OFFICE_LOCATION_UPDATE', 'OFFICE_LOCATION_DEACTIVATE',
        ],
      },
      { to: '/settings/leave', icon: CalendarDays, label: 'Leave Configuration', permission: 'LEAVE_MANAGE' },
      { to: '/settings/letters', icon: FileText, label: 'Letter Templates', permission: 'LETTER_MANAGE' },
      { to: '/settings/shifts', icon: Clock, label: 'Shifts', permission: 'ATTENDANCE_MANAGE' },
      { to: '/settings/expenses', icon: Receipt, label: 'Expense Settings', permission: 'EXPENSE_MANAGE' },
      { to: '/settings/custom-fields', icon: ListChecks, label: 'Custom Fields', permission: 'EMPLOYEE_MANAGE' },
      { to: '/settings/sign-in', icon: KeyRound, label: 'Sign-in & WhatsApp', roles: ['COMPANY_ADMIN', 'SUPER_ADMIN'] },
      { to: '/settings/data-import', icon: FileSpreadsheet, label: 'Data Import', permissionsAny: ['SALARY_MANAGE', 'LEAVE_MANAGE', 'EMPLOYEE_MANAGE', 'EMPLOYEE_IMPORT'] },
      { to: '/settings/audit', icon: ScrollText, label: 'Audit Logs', permission: 'AUDIT_VIEW' },
      { to: '/settings/privacy', icon: ShieldCheck, label: 'Privacy & Data', permission: 'PRIVACY_MANAGE' },
      { to: '/billing', icon: Wallet, label: 'Billing & Subscription', roles: ['COMPANY_ADMIN', 'HR_ADMIN', 'SUPER_ADMIN'] },
      { to: '/settings/platform', icon: ShieldCheck, label: 'Platform Admin', role: 'SUPER_ADMIN' },
      { to: '/onboarding', icon: ClipboardList, label: 'Workspace Setup', roles: ['COMPANY_ADMIN', 'SUPER_ADMIN'] },
      { to: '/support', icon: LifeBuoy, label: 'Support Information' },
      { to: '/privacy', icon: ShieldCheck, label: 'My Privacy' },
      { to: '/account/security', icon: KeyRound, label: 'Change Password' },
    ],
  },
];

/** Flat list of every navigable page, each tagged with its section label -
 *  what the search index and favorites picker actually iterate over. */
export const NAV_INDEX = [
  ...NAV_SECTIONS.flatMap((section) =>
    section.items.map((item) => ({
      ...item,
      section: section.label,
      permission: item.permission || section.permission,
      sectionPermission: section.permission,
    }))
  ),
  {
    to: '/notifications',
    icon: Bell,
    label: 'Notifications',
    permission: 'SELF_PROFILE_VIEW',
    sectionPermission: 'SELF_PROFILE_VIEW',
    section: 'Notifications',
  },
  { to: '/employees', permission: 'EMPLOYEE_VIEW' },
];

export function findNavItemByPath(path) {
  return NAV_INDEX.find((item) => item.to === path);
}

/** Filters sections/items down to what a user with the given `hasPermission`
 *  check can actually reach. An item/section with no `permission` tag is
 *  assumed open to any authenticated user (matches today's backend reality
 *  for modules that haven't had permission codes carved out yet). */
export function visibleNavSections(hasPermission, hasRole = () => false) {
  const hasAccessRole = (item) =>
    (!item.role && !item.roles) ||
    (item.role && hasRole(item.role)) ||
    (item.roles && item.roles.some((role) => hasRole(role)));

  const filtered = NAV_SECTIONS.map((section) => {
    const sectionAllowed = (!section.permission || hasPermission(section.permission))
      && !(section.id === 'team-monitoring' && hasPermission('IT_MANAGEMENT_ACCESS'));
    const items = sectionAllowed
      ? section.items.filter((item) => (
        (item.permissionsAny
          ? item.permissionsAny.some((permission) => hasPermission(permission))
          : (!item.permission || hasPermission(item.permission)))
        && hasAccessRole(item)
      ))
      : [];
    return { ...section, items };
  }).filter((section) => section.items.length > 0 && hasAccessRole(section));

  const employeeSelfIds = new Set(['employee-me', 'employee-team', 'employee-finances', 'employee-performance', 'employee-apps']);
  const employeeSelfItems = [];
  const peopleItems = hasPermission('EMPLOYEE_VIEW')
    ? [{ to: '/employees', icon: Users, label: 'Employees', permission: 'EMPLOYEE_VIEW' }]
    : [];
  let timeAndLeave = null;
  let organizationSection = null;

  for (const section of filtered) {
    // Home and Dashboard are the same destination; keep one sidebar entry.
    if (section.id === 'root' && filtered.some((item) => item.id === 'employee-home')) continue;

    if (employeeSelfIds.has(section.id)) {
      employeeSelfItems.push(...section.items);
      continue;
    }

    if (section.id === 'talent') {
      peopleItems.push(...section.items);
      continue;
    }

    if (section.id === 'organization') {
      organizationSection = {
        ...section,
        id: 'organization',
        label: 'Organization',
        description: 'Company administration and governance',
      };
      continue;
    }

    if (section.id === 'attendance') {
      timeAndLeave = {
        id: 'time-leave',
        label: 'Time & Leave',
        description: 'Attendance, devices and leave management',
        collapsible: true,
        badge: null,
        items: [...section.items],
      };
      continue;
    }
  }

  const result = [];
  const seenDestinations = new Set();
  const addSection = (section) => {
    if (!section?.items?.length) return;
    const items = section.items.filter((item) => {
      const key = item.to;
      if (seenDestinations.has(key)) return false;
      seenDestinations.add(key);
      return true;
    });
    if (items.length) result.push({ ...section, items });
  };

  addSection(filtered.find((section) => section.id === 'employee-home'));

  if (employeeSelfItems.length) {
    addSection({
      id: 'my-workspace',
      label: 'My Workspace',
      description: 'Your profile, time, pay and employee services',
      collapsible: true,
      badge: null,
      items: employeeSelfItems,
    });
  }

  addSection({
    id: 'people',
    label: 'People',
    description: 'Employees, recruitment and talent workflows',
    collapsible: true,
    badge: null,
    items: peopleItems,
  });
  if (organizationSection) {
    addSection(organizationSection);
  }
  addSection(timeAndLeave);

  for (const section of filtered) {
    if (['employee-home', 'employee-me', 'employee-team', 'employee-finances', 'employee-performance', 'employee-apps', 'root', 'organization', 'talent', 'attendance'].includes(section.id)) continue;
    addSection(section);
  }

  return result;
}
