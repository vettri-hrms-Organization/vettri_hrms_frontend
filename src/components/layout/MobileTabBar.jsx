import { NavLink, useLocation } from 'react-router-dom';
import { CalendarDays, Clock, Home, Menu, Wallet } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

/**
 * Employee bottom tab bar, shown only below 768px (see .hz-tabbar in mobile.css).
 * "More" opens the existing sidebar drawer instead of duplicating navigation.
 * Desktop and tablet layouts are untouched.
 */
export default function MobileTabBar({ onOpenMore, moreOpen = false }) {
  const { hasPermission, hasRole, selectedCompanyId } = useAuth();
  const location = useLocation();
  if (!hasPermission('SELF_PROFILE_VIEW')) return null;
  // Platform staff outside a company have no employee pages (attendance, leave, pay) to jump to.
  if (hasRole('SUPER_ADMIN') && !selectedCompanyId) return null;

  const tabs = [
    { to: '/dashboard', label: 'Home', icon: Home, end: true },
    hasPermission('SELF_ATTENDANCE_VIEW') && { to: '/my-attendance', label: 'Attendance', icon: Clock },
    hasPermission('SELF_LEAVE_VIEW') && { to: '/my-profile?tab=leave', label: 'Leave', icon: CalendarDays, match: () => location.pathname === '/my-profile' && new URLSearchParams(location.search).get('tab') === 'leave' },
    hasPermission('SELF_PAYSLIP_VIEW') && { to: '/my-payslip', label: 'Pay', icon: Wallet },
  ].filter(Boolean);

  return (
    <nav className="hz-tabbar" aria-label="Quick navigation">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `hz-tabbar__item${(tab.match ? tab.match() : isActive) ? ' is-active' : ''}`}
          >
            <Icon size={22} aria-hidden="true" />
            <span>{tab.label}</span>
          </NavLink>
        );
      })}
      <button
        type="button"
        className={`hz-tabbar__item${moreOpen ? ' is-active' : ''}`}
        onClick={onOpenMore}
        aria-label="More navigation"
        aria-expanded={moreOpen}
      >
        <Menu size={22} aria-hidden="true" />
        <span>More</span>
      </button>
    </nav>
  );
}
