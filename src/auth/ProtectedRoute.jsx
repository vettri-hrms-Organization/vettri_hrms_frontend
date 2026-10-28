import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import PageLoader from '../components/ui/PageLoader';
import { NAV_INDEX } from '../components/layout/navConfig';

export const CHANGE_PASSWORD_PATH = '/account/security';
export const LEGAL_ACCEPT_PATH = '/privacy/accept';

/**
 * Wraps a set of routes (via <Outlet/>) behind authentication. Pass
 * `allowedRoles` to additionally gate by role - if the user is signed in
 * but lacks any of the allowed roles, they're redirected to the dashboard
 * rather than the login page (they don't need to re-authenticate, they
 * just don't have access to that particular screen).
 */
export default function ProtectedRoute({ allowedRoles }) {
  const { user, isAuthenticated, isLoading, hasAnyRole, hasPermission, hasRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Temporary/admin-issued passwords: nothing else is reachable until the
  // user picks their own (the flag comes from /api/auth/me).
  if (user?.mustChangePassword && location.pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
  }

  // Company policy requires two-factor and this user hasn't enrolled yet:
  // same treatment - the security page is the only reachable screen.
  if (user?.mfaEnrollmentRequired && location.pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
  }

  // A legal document this user must accept is new or has a new version
  // (Terms / Privacy / DPA bump): the acceptance page is the only reachable
  // screen until they accept (flag + list come from /api/auth/me).
  // Runs only after the password/2FA gates are satisfied, so the gates never bounce between each other.
  if (user?.legalAcceptanceRequired && !user?.mustChangePassword && !user?.mfaEnrollmentRequired
      && location.pathname !== LEGAL_ACCEPT_PATH) {
    return <Navigate to={LEGAL_ACCEPT_PATH} replace />;
  }

  if (user?.employeeId && !hasPermission('ATTENDANCE_VIEW') && location.pathname === '/attendance') {
    return <Navigate to="/my-attendance" replace />;
  }

  if (user?.employeeId && !hasPermission('LEAVE_VIEW') && !hasPermission('LEAVE_APPROVE') && location.pathname === '/leave') {
    return <Navigate to="/my-profile?tab=leave" replace />;
  }

  if (allowedRoles && !hasAnyRole(allowedRoles)) {
    return <AccessDenied />;
  }

  // The backend grants a linked employee access to their own record without
  // granting the broad employee-view permission. Mirror that narrow rule in
  // the route guard so the profile page can actually reach the API.
  const profileId = location.pathname.match(/^\/employees\/([^/]+)$/)?.[1];
  const isOwnProfile = profileId && user?.employeeId && String(user.employeeId) === profileId;

  // The same path can appear in several nav sections with different gates
  // (e.g. /leave is "Team Leave" for approvers and "Leave Management" for
  // LEAVE_VIEW holders). Take every entry with the most specific matching
  // path and allow the route if ANY of them grants access - the same rule
  // the sidebar uses to decide whether to show the link at all.
  const matching = NAV_INDEX.filter((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));
  const longest = Math.max(0, ...matching.map((item) => item.to.length));
  const candidates = matching.filter((item) => item.to.length === longest);

  const itemAllows = (item) => {
    const hasRequiredEmployeeProfile = item.role === 'EMPLOYEE' && !!user?.employeeId;
    if (item.role && !hasRequiredEmployeeProfile && !hasAnyRole([item.role])) return false;
    if (item.roles && !hasAnyRole(item.roles)) return false;
    if (isOwnProfile) return true;
    if (item.permission && !hasPermission(item.permission)) return false;
    if (item.permissionsAny && !item.permissionsAny.some((permission) => hasPermission(permission))) return false;
    if (item.sectionPermission && !hasPermission(item.sectionPermission)) return false;
    return true;
  };

  if (candidates.length > 0 && !candidates.some(itemAllows)) {
    return <AccessDenied />;
  }

  return <Outlet />;
}

function AccessDenied() {
  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 p-4" style={{ background: 'var(--hz-bg-canvas)' }}>
      <div className="hz-state hz-state--error" style={{ maxWidth: 460 }}>
        <div className="hz-state__icon-wrap" aria-hidden="true">
          <ShieldAlert size={26} />
        </div>
        <h1 className="hz-state__title">Access Restricted</h1>
        <p className="hz-state__description">You don't have permission to access this page or perform this action. Please contact your HR/Admin if you need access.</p>
        <div className="d-flex align-items-center justify-content-center gap-2">
          <a href="/dashboard" className="btn btn-primary">Back to dashboard</a>
          <button type="button" className="btn btn-outline-secondary" onClick={() => window.history.back()}>
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
