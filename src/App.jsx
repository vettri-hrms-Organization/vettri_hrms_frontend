import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './auth/ProtectedRoute';
import { useAuth } from './hooks/useAuth';
import MainLayout from './components/layout/MainLayout';
import Login from './pages/Login';
const Signup = lazy(() => import('./pages/Signup'));
const ActivateAccount = lazy(() => import('./pages/ActivateAccount'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const EmployeeList = lazy(() => import('./pages/employees/EmployeeList'));
const EmployeeProfile = lazy(() => import('./pages/employees/EmployeeProfile'));
const EmployeeImport = lazy(() => import('./pages/employees/EmployeeImport'));
const AttendanceList = lazy(() => import('./pages/attendance/AttendanceList'));
const Devices = lazy(() => import('./pages/attendance/Devices'));
const EmployeeAttendance = lazy(() => import('./pages/attendance/EmployeeAttendance'));
const AttendancePresence = lazy(() => import('./pages/attendance/AttendancePresence'));
const RosterGrid = lazy(() => import('./pages/attendance/RosterGrid'));
const LateEarly = lazy(() => import('./pages/attendance/LateEarly'));
const OvertimeApprovals = lazy(() => import('./pages/attendance/OvertimeApprovals'));
const SettingsShifts = lazy(() => import('./pages/SettingsShifts'));
const LeaveRequests = lazy(() => import('./pages/leave/LeaveRequests'));
const JobOpenings = lazy(() => import('./pages/recruitment/JobOpenings'));
const CandidatePipeline = lazy(() => import('./pages/recruitment/CandidatePipeline'));
const MyInterviews = lazy(() => import('./pages/recruitment/MyInterviews'));
const PerformanceHub = lazy(() => import('./pages/performance/PerformanceHub'));
const Reports = lazy(() => import('./pages/reports/Reports'));
const ExecutiveOverview = lazy(() => import('./pages/reports/ExecutiveOverview'));
const RecruiterDashboard = lazy(() => import('./pages/recruitment/RecruiterDashboard'));
const SalaryDashboard = lazy(() => import('./pages/salary/SalaryDashboard'));
const EmployeeSalaryList = lazy(() => import('./pages/salary/EmployeeSalaryList'));
const SalaryStructurePage = lazy(() => import('./pages/salary/SalaryStructurePage'));
const PayrollProcessing = lazy(() => import('./pages/salary/PayrollProcessing'));
const SalaryDetails = lazy(() => import('./pages/salary/SalaryDetails'));
const SalaryReports = lazy(() => import('./pages/salary/SalaryReports'));
const PayrollSettings = lazy(() => import('./pages/salary/PayrollSettings'));
const TaxDeclarations = lazy(() => import('./pages/salary/TaxDeclarations'));
const MyTaxDeclaration = lazy(() => import('./pages/salary/MyTaxDeclaration'));
const FullAndFinal = lazy(() => import('./pages/salary/FullAndFinal'));
const AccountingExport = lazy(() => import('./pages/salary/AccountingExport'));
const MySettlement = lazy(() => import('./pages/salary/MySettlement'));
const MyHolidays = lazy(() => import('./pages/leave/MyHolidays'));
const MonitoringDashboard = lazy(() => import('./pages/monitoring/MonitoringDashboard'));
const MonitoringDevices = lazy(() => import('./pages/monitoring/Devices'));
const MonitoringDeviceDetails = lazy(() => import('./pages/monitoring/DeviceDetails'));
const VettriCli = lazy(() => import('./pages/monitoring/VettriCli'));
const RemoteDesktop = lazy(() => import('./pages/monitoring/RemoteDesktop'));
const MonitoringActivity = lazy(() => import('./pages/monitoring/Activity'));
const DeviceEnrollment = lazy(() => import('./pages/monitoring/DeviceEnrollment'));
const SettingsUsers = lazy(() => import('./pages/SettingsUsers'));
const SettingsOrganization = lazy(() => import('./pages/SettingsOrganization'));
const SettingsLeave = lazy(() => import('./pages/SettingsLeave'));
const SettingsAudit = lazy(() => import('./pages/SettingsAudit'));
import NotFound from './pages/NotFound';
const Onboarding = lazy(() => import('./pages/Onboarding'));
import PageLoader from './components/ui/PageLoader';
const SupportInfo = lazy(() => import('./pages/SupportInfo'));
const SettingsPreferences = lazy(() => import('./pages/SettingsPreferences'));
const AccountSecurity = lazy(() => import('./pages/AccountSecurity'));
const Welcome = lazy(() => import('./pages/Welcome'));
const Notifications = lazy(() => import('./pages/Notifications'));
const BillingInvoices = lazy(() => import('./pages/BillingInvoices'));
const BillingSubscription = lazy(() => import('./pages/billing/BillingSubscription'));
const Requirements = lazy(() => import('./pages/Requirements'));
const MonitoringReports = lazy(() => import('./pages/monitoring/MonitoringReports'));
const SettingsPlatform = lazy(() => import('./pages/SettingsPlatform'));
const SoftwareManagement = lazy(() => import('./pages/software/SoftwareManagement'));
const OrganizationStructure = lazy(() => import('./pages/organization/OrganizationStructure'));
const CareersList = lazy(() => import('./pages/careers/CareersList'));
const JobApply = lazy(() => import('./pages/careers/JobApply'));
const SettingsLetters = lazy(() => import('./pages/letters/SettingsLetters'));
const OnboardingDashboard = lazy(() => import('./pages/onboarding/OnboardingDashboard'));
const MyOnboarding = lazy(() => import('./pages/onboarding/MyOnboarding'));
const MyExpenses = lazy(() => import('./pages/expenses/MyExpenses'));
const ExpenseApprovals = lazy(() => import('./pages/expenses/ExpenseApprovals'));
const ExpenseSettings = lazy(() => import('./pages/expenses/ExpenseSettings'));
const SettingsCustomFields = lazy(() => import('./pages/settings/SettingsCustomFields'));
const SettingsSignIn = lazy(() => import('./pages/settings/SettingsSignIn'));
const DataImportHub = lazy(() => import('./pages/imports/DataImportHub'));
const AnnouncementsFeed = lazy(() => import('./pages/announcements/AnnouncementsFeed'));
const AnnouncementAdmin = lazy(() => import('./pages/announcements/AnnouncementAdmin'));
const MyPrivacy = lazy(() => import('./pages/privacy/MyPrivacy'));
const LegalAcceptance = lazy(() => import('./pages/privacy/LegalAcceptance'));
const PrivacyAdmin = lazy(() => import('./pages/privacy/PrivacyAdmin'));

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}><Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/activate-account" element={<ActivateAccount />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/careers" element={<CareersList />} />
      <Route path="/careers/:jobId" element={<JobApply />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/device-enrollment/:token" element={<DeviceEnrollment />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="welcome" element={<Welcome />} />
          <Route path="employees" element={<EmployeeList />} />
          <Route path="employees/import" element={<EmployeeImport />} />
          <Route path="employees/:id" element={<EmployeeProfile />} />
          <Route path="organization/structure" element={<OrganizationStructure />} />
          <Route path="attendance" element={<AttendanceList />} />
          <Route path="attendance/presence" element={<AttendancePresence />} />
          <Route path="attendance/devices" element={<Devices />} />
          <Route path="attendance/roster" element={<RosterGrid />} />
          <Route path="attendance/late-early" element={<LateEarly />} />
          <Route path="attendance/overtime" element={<OvertimeApprovals />} />
          <Route path="settings/shifts" element={<SettingsShifts />} />
          <Route path="my-attendance" element={<EmployeeAttendance />} />
          <Route path="leave" element={<LeaveRequests />} />
          <Route path="recruitment" element={<JobOpenings />} />
          <Route path="recruitment/:jobOpeningId" element={<CandidatePipeline />} />
          <Route path="my-recruitment" element={<RecruiterDashboard />} />
          <Route path="my-interviews" element={<MyInterviews />} />
          <Route path="performance" element={<PerformanceHub />} />
          <Route path="monitoring" element={<MonitoringDashboard />} />
          <Route path="monitoring/live" element={<MonitoringDashboard />} />
          <Route path="monitoring/devices" element={<MonitoringDevices />} />
          <Route path="monitoring/devices/:id" element={<MonitoringDeviceDetails />} />
          <Route path="monitoring/devices/:id/cli" element={<VettriCli />} />
          <Route path="monitoring/devices/:id/remote-desktop" element={<RemoteDesktop />} />
          <Route path="monitoring/activity" element={<MonitoringActivity />} />
          <Route path="monitoring/reports" element={<MonitoringReports />} />
          <Route path="software" element={<SoftwareManagement />} />
          <Route path="salary" element={<SalaryDashboard />} />
          <Route path="salary/employees" element={<EmployeeSalaryList />} />
          <Route path="salary/employees/:employeeId" element={<SalaryDetails />} />
          <Route path="salary/structure" element={<SalaryStructurePage />} />
          <Route path="salary/payroll-processing" element={<PayrollProcessing />} />
          <Route path="salary/reports" element={<SalaryReports />} />
          <Route path="salary/settings" element={<PayrollSettings />} />
          <Route path="salary/tax-declarations" element={<TaxDeclarations />} />
          <Route path="my-payslip" element={<SalaryDetails />} />
          <Route path="my-tax-declaration" element={<MyTaxDeclaration />} />
          <Route path="salary/settlements" element={<FullAndFinal />} />
          <Route path="salary/accounting" element={<AccountingExport />} />
          <Route path="my-settlement" element={<MySettlement />} />
          <Route path="my-holidays" element={<MyHolidays />} />
          <Route path="my-profile" element={<MyProfileRoute />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="billing" element={<BillingSubscription />} />
          <Route path="billing/invoices" element={<BillingInvoices />} />
          <Route path="reports" element={<Reports />} />
          <Route path="/requirements" element={<Requirements />} />
          <Route path="executive" element={<ExecutiveOverview />} />
          <Route path="settings/users" element={<SettingsUsers />} />
          <Route path="settings/organization" element={<SettingsOrganization />} />
          <Route path="settings/leave" element={<SettingsLeave />} />
          <Route path="settings/audit" element={<SettingsAudit />} />
          <Route path="settings/platform" element={<SettingsPlatform />} />
          <Route path="settings/preferences" element={<SettingsPreferences />} />
          <Route path="account/security" element={<AccountSecurity />} />
          <Route path="privacy" element={<MyPrivacy />} />
          <Route path="privacy/accept" element={<LegalAcceptance />} />
          <Route path="settings/privacy" element={<PrivacyAdmin />} />
          <Route path="onboarding" element={<Onboarding />} />
          <Route path="settings/letters" element={<SettingsLetters />} />
          <Route path="hr-onboarding" element={<OnboardingDashboard />} />
          <Route path="my-onboarding" element={<MyOnboarding />} />
          <Route path="support" element={<SupportInfo />} />
          <Route path="my-expenses" element={<MyExpenses />} />
          <Route path="expenses/approvals" element={<ExpenseApprovals />} />
          <Route path="settings/expenses" element={<ExpenseSettings />} />
          <Route path="settings/custom-fields" element={<SettingsCustomFields />} />
          <Route path="settings/sign-in" element={<SettingsSignIn />} />
          <Route path="settings/data-import" element={<DataImportHub />} />
          <Route path="announcements" element={<AnnouncementsFeed />} />
          <Route path="announcements/manage" element={<AnnouncementAdmin />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes></Suspense>
  );
}

function RootRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

// My Profile is the employee's own record; its Attendance tab stays inside
// the profile. Check-in/out lives on the dedicated /my-attendance page.
function MyProfileRoute() {
  return <EmployeeProfile />;
}
