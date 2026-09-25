import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LifeBuoy, LogOut, Plus, Search, Settings2, UserCircle, X } from 'lucide-react';
import Logo from '../brand/Logo';
import Avatar from '../ui/Avatar';
import { visibleNavSections, findNavItemByPath } from './navConfig';
import { useNavMemory } from './NavMemoryContext';
import { useAuth } from '../../hooks/useAuth';

export default function Sidebar({ mobileOpen = false, onCloseMobile }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasPermission, hasRole } = useAuth();
  const { recordVisit } = useNavMemory();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const sections = useMemo(
    () => visibleNavSections(hasPermission, hasRole, !!user?.employeeId),
    [hasPermission, hasRole, user?.employeeId]
  );

  useEffect(() => {
    const matched = findNavItemByPath(location.pathname);
    if (matched) recordVisit(matched);
    setProfileOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        if (mobileOpen) onCloseMobile?.();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  const openCommandCenter = () => window.dispatchEvent(new CustomEvent('vettri:open-command-center'));

  const currentUserName = user?.fullName || 'Account';
  const currentRole = user?.roles?.[0] || 'Member';
  const workspaceName = user?.companyName || 'Vettri Workspace';

  return (
    <>
      {mobileOpen && <div className="vettri-sidebar-backdrop d-lg-none" onClick={onCloseMobile} aria-hidden="true" />}

      <div className={`vettri-sidebar-shell ${isCollapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}>
        <aside className="vettri-sidebar" aria-label="Main navigation">
          <button
            type="button"
            className="vettri-sidebar-handle d-none d-lg-flex"
            onClick={() => setIsCollapsed((value) => !value)}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronDown size={12} />
          </button>

          <div className="vettri-sidebar-brand">
            <Logo variant="mark" tone="onLight" size={31} />
            {!isCollapsed && <span>Vettri</span>}
            <button type="button" className="vettri-mobile-close d-lg-none" onClick={onCloseMobile} aria-label="Close navigation">
              <X size={18} />
            </button>
          </div>

          <button
            type="button"
            className="vettri-workspace-switcher"
            onClick={() => navigate('/dashboard')}
            title={workspaceName}
          >
            <span className="vettri-workspace-mark">V</span>
            {!isCollapsed && (
              <span className="vettri-workspace-copy">
                <strong>{workspaceName}</strong>
                <small>{user?.fullName || 'Workspace'}</small>
              </span>
            )}
            {!isCollapsed && <ChevronDown className="vettri-workspace-chevron" size={14} />}
          </button>

          <div className="vettri-sidebar-search-wrap">
            <button type="button" className="vettri-sidebar-search" onClick={openCommandCenter} aria-label="Search" title="Search">
              <Search size={15} />
              {!isCollapsed && <span>Search</span>}
              {!isCollapsed && <kbd>{navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl K'}</kbd>}
            </button>
          </div>

          <nav className="vettri-sidebar-nav" aria-label="Product areas">
            {sections.map((section) => (
              <div className="vettri-nav-group" key={section.id}>
                {!isCollapsed && <div className="vettri-nav-group-label">{section.label}</div>}
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={`${section.id}-${item.to}`}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) => `vettri-nav-item ${isActive ? 'is-active' : ''}`}
                      title={isCollapsed ? item.label : undefined}
                      onClick={() => {
                        const matched = findNavItemByPath(item.to.split('?')[0]);
                        if (matched) recordVisit(matched);
                        onCloseMobile?.();
                      }}
                    >
                      <span className="vettri-nav-icon"><Icon size={16} strokeWidth={1.8} /></span>
                      {!isCollapsed && <span className="vettri-nav-label">{item.label}</span>}
                      {!isCollapsed && item.badge && <span className="vettri-nav-badge">{item.badge.value > 99 ? '99+' : item.badge.value}</span>}
                      {isCollapsed && <span className="vettri-nav-tooltip">{item.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            ))}

            {hasPermission('EMPLOYEE_CREATE') && (
              <button type="button" className="vettri-quick-add" onClick={() => { navigate('/employees'); onCloseMobile?.(); }} title="Add employee">
                <Plus size={14} />
                {!isCollapsed && <span>Add employee</span>}
              </button>
            )}
          </nav>

          <div className="vettri-sidebar-footer">
            <div className="vettri-user-card">
              <button type="button" className="vettri-user-trigger" onClick={() => setProfileOpen((value) => !value)} aria-haspopup="menu" aria-expanded={profileOpen} title={currentUserName}>
                <span className="vettri-avatar-wrap">
                  <Avatar name={currentUserName} size="sm" />
                  <span className="vettri-status-dot" />
                </span>
                {!isCollapsed && (
                  <span className="vettri-user-meta">
                    <strong>{currentUserName}</strong>
                    <small>{currentRole}</small>
                  </span>
                )}
              </button>
              {!isCollapsed && <button type="button" className="vettri-user-bell" onClick={() => navigate('/notifications')} aria-label="Notifications"><span>●</span>♢</button>}
            </div>

            {profileOpen && (
              <div className="vettri-sidebar-profile-menu" role="menu">
                <div className="vettri-sidebar-profile-identity">
                  <Avatar name={currentUserName} size="sm" />
                  <span><strong>{currentUserName}</strong><small>{currentRole}</small></span>
                </div>
                <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); navigate('/my-profile'); }}><UserCircle size={15} /> My Profile</button>
                <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); navigate('/settings/preferences'); }}><Settings2 size={15} /> Preferences</button>
                <button type="button" role="menuitem" className="danger" onClick={() => { setProfileOpen(false); logout(); }}><LogOut size={15} /> Sign out</button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
