import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronsLeft, LogOut, Plus, Settings2, UserCircle, X } from 'lucide-react';
import Logo from '../brand/Logo';
import Avatar from '../ui/Avatar';
import { visibleNavSections, findNavItemByPath } from './navConfig';
import { useNavMemory } from './NavMemoryContext';
import { useAuth } from '../../hooks/useAuth';
import { formatRole } from '../../utils/formatRole';

const COLLAPSE_KEY = 'vettri_sidebar_collapsed';
const GROUPS_KEY = 'vettri_sidebar_groups';

function readStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode) - preference just won't persist.
  }
}

function itemIsActive(item, location) {
  const [targetPath, targetQuery = ''] = item.to.split('?');
  const currentQuery = location.search.replace(/^\?/, '');
  const pathMatches = item.end
    ? location.pathname === targetPath
    : location.pathname === targetPath || location.pathname.startsWith(`${targetPath}/`);
  const queryMatches = targetQuery ? currentQuery === targetQuery : !currentQuery;
  return pathMatches && queryMatches;
}

export default function Sidebar({ mobileOpen = false, onCloseMobile }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasPermission, hasRole } = useAuth();
  const { recordVisit } = useNavMemory();
  const [isCollapsed, setIsCollapsed] = useState(() => readStored(COLLAPSE_KEY, false) === true);
  const [profileOpen, setProfileOpen] = useState(false);

  const sections = useMemo(
    () => visibleNavSections(hasPermission, hasRole),
    [hasPermission, hasRole]
  );

  // Admins land on organisation-wide tools, so their personal "My Workspace"
  // group starts folded; everyone else starts with every group open.
  const isAdminNavigator = hasPermission('EMPLOYEE_VIEW');
  const [closedGroups, setClosedGroups] = useState(() => readStored(GROUPS_KEY, isAdminNavigator ? ['my-workspace'] : []));

  useEffect(() => writeStored(COLLAPSE_KEY, isCollapsed), [isCollapsed]);
  useEffect(() => writeStored(GROUPS_KEY, closedGroups), [closedGroups]);

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

  const toggleGroup = (id) => {
    setClosedGroups((current) => (current.includes(id) ? current.filter((group) => group !== id) : [...current, id]));
  };

  const currentUserName = user?.fullName || 'Account';
  const currentRole = formatRole(user?.roles?.[0]);
  const workspaceName = user?.companyName || 'Vettri Workspace';

  return (
    <>
      {mobileOpen && <div className="vettri-sidebar-backdrop d-lg-none" onClick={onCloseMobile} aria-hidden="true" />}

      <div className={`vettri-sidebar-shell ${isCollapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}>
        <aside className="vettri-sidebar" aria-label="Main navigation">
          <div className="vettri-sidebar-brand">
            <Logo variant="mark" tone="onDark" size={30} />
            {!isCollapsed && (
              <span className="vettri-sidebar-brand__name">
                Vettri<small>HRMS</small>
              </span>
            )}
            <button
              type="button"
              className="vettri-sidebar-handle d-none d-lg-flex"
              onClick={() => setIsCollapsed((value) => !value)}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!isCollapsed}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronsLeft size={16} />
            </button>
            <button type="button" className="vettri-mobile-close d-lg-none" onClick={onCloseMobile} aria-label="Close navigation">
              <X size={18} />
            </button>
          </div>

          {/* Identifies the current organisation. Tenants are switched from
              the topbar (super admins only), so this is not a control. */}
          <div className="vettri-workspace-switcher" title={workspaceName}>
            <span className="vettri-workspace-mark" aria-hidden="true">{workspaceName.trim().charAt(0).toUpperCase() || 'V'}</span>
            {!isCollapsed && (
              <span className="vettri-workspace-copy">
                <strong>{workspaceName}</strong>
                <small>Organisation</small>
              </span>
            )}
          </div>

          <nav className="vettri-sidebar-nav" aria-label="Product areas">
            {sections.map((section) => {
              const containsActive = section.items.some((item) => itemIsActive(item, location));
              const canFold = section.items.length > 1 && !isCollapsed;
              const isOpen = !canFold || containsActive || !closedGroups.includes(section.id);
              const groupId = `nav-group-${section.id}`;

              return (
                <div className={`vettri-nav-group${isOpen ? '' : ' is-folded'}`} key={section.id}>
                  {!isCollapsed && (canFold ? (
                    <button
                      type="button"
                      className="vettri-nav-group-label vettri-nav-group-toggle"
                      onClick={() => toggleGroup(section.id)}
                      aria-expanded={isOpen}
                      aria-controls={groupId}
                      disabled={containsActive}
                    >
                      <span>{section.label}</span>
                      <ChevronDown size={13} aria-hidden="true" />
                    </button>
                  ) : (
                    <div className="vettri-nav-group-label">{section.label}</div>
                  ))}
                  {isOpen && (
                    <div id={groupId} className="vettri-nav-group-items">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const active = itemIsActive(item, location);
                        return (
                          <NavLink
                            key={`${section.id}-${item.to}`}
                            to={item.to}
                            end={item.end}
                            className={() => `vettri-nav-item ${active ? 'is-active' : ''}`}
                            aria-current={active ? 'page' : undefined}
                            aria-label={isCollapsed ? item.label : undefined}
                            onClick={() => {
                              const matched = findNavItemByPath(item.to.split('?')[0]);
                              if (matched) recordVisit(matched);
                              onCloseMobile?.();
                            }}
                          >
                            <span className="vettri-nav-icon"><Icon size={17} strokeWidth={1.8} /></span>
                            {!isCollapsed && <span className="vettri-nav-label">{item.label}</span>}
                            {!isCollapsed && item.badge && <span className="vettri-nav-badge">{item.badge.value > 99 ? '99+' : item.badge.value}</span>}
                            {isCollapsed && <span className="vettri-nav-tooltip" aria-hidden="true">{item.label}</span>}
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {hasPermission('EMPLOYEE_CREATE') && (
            <button type="button" className="vettri-quick-add" onClick={() => { navigate('/employees'); onCloseMobile?.(); }} title="Add employee">
              <Plus size={15} aria-hidden="true" />
              {!isCollapsed && <span>Add employee</span>}
            </button>
          )}

          <div className="vettri-sidebar-footer">
            <button type="button" className="vettri-user-trigger" onClick={() => setProfileOpen((value) => !value)} aria-haspopup="menu" aria-expanded={profileOpen} title={currentUserName}>
              <span className="vettri-avatar-wrap">
                <Avatar name={currentUserName} size="sm" />
                <span className="vettri-status-dot" aria-hidden="true" />
              </span>
              {!isCollapsed && (
                <span className="vettri-user-meta">
                  <strong>{currentUserName}</strong>
                  <small>{currentRole}</small>
                </span>
              )}
              {!isCollapsed && <ChevronDown size={14} className="vettri-user-chevron" aria-hidden="true" />}
            </button>

            {profileOpen && (
              <div className="vettri-sidebar-profile-menu" role="menu">
                <div className="vettri-sidebar-profile-identity">
                  <Avatar name={currentUserName} size="sm" />
                  <span><strong>{currentUserName}</strong><small>{user?.email || currentRole}</small></span>
                </div>
                <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); navigate('/my-profile'); }}><UserCircle size={15} /> My profile</button>
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

