import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LifeBuoy, LogOut, Settings2, UserCircle, X } from 'lucide-react';
import Logo from '../brand/Logo';
import Avatar from '../ui/Avatar';
import { NAV_SECTIONS, findNavItemByPath, visibleNavSections } from './navConfig';
import { useNavMemory } from './NavMemoryContext';
import { useAuth } from '../../hooks/useAuth';

export default function Sidebar({ mobileOpen = false, onCloseMobile }) {
  const location = useLocation();
  const sidebarRef = useRef(null);
  const { user, logout, hasPermission, hasRole } = useAuth();
  const navigate = useNavigate();
  const { recordVisit } = useNavMemory();
  const sections = useMemo(() => visibleNavSections(hasPermission, hasRole, !!user?.employeeId), [hasPermission, hasRole, user?.employeeId]);
  const primarySections = useMemo(
    () => sections.filter((section) => section.id !== 'administration' && !section.items.some((item) => item.to === '/support')),
    [sections]
  );

  const activeSectionId = sections.find((section) => section.items.some((item) => isNavItemActive(item, location)))?.id;
  const [selectedSectionId, setSelectedSectionId] = useState(activeSectionId || primarySections[0]?.id);
  const selectedSection = sections.find((section) => section.id === selectedSectionId) || sections[0];
  const administration = sections.find((section) => section.id === 'administration');
  const supportSection = sections.find((section) => section.items.some((item) => item.to === '/support'));
  const supportItem = supportSection?.items.find((item) => item.to === '/support');
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [flyoutTop, setFlyoutTop] = useState(12);
  const flyoutCloseTimer = useRef(null);

  const openCommandCenter = () => {
    window.dispatchEvent(new CustomEvent('vettri:open-command-center'));
  };

  // Restore the user's group preferences, then always open the active group
  // so navigation never hides the page they are currently viewing.
  useEffect(() => {
    if (activeSectionId) setSelectedSectionId(activeSectionId);
    setFlyoutOpen(false);
    setProfileOpen(false);
    const matched = findNavItemByPath(location.pathname);
    if (matched) recordVisit(matched);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setFlyoutOpen(false);
        setProfileOpen(false);
        if (mobileOpen) onCloseMobile?.();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileOpen, onCloseMobile]);

  useEffect(() => {
    if (!flyoutOpen) return undefined;
    function handlePointerDown(event) {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) setFlyoutOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [flyoutOpen]);

  useEffect(() => {
    if (!profileOpen) return undefined;
    function handlePointerDown(event) {
      if (!sidebarRef.current?.contains(event.target)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [profileOpen]);

  useEffect(() => () => clearTimeout(flyoutCloseTimer.current), []);

  function keepFlyoutOpen() {
    clearTimeout(flyoutCloseTimer.current);
  }

  function closeFlyoutSoon() {
    if (window.matchMedia('(max-width: 991px)').matches) return;
    clearTimeout(flyoutCloseTimer.current);
    flyoutCloseTimer.current = setTimeout(() => setFlyoutOpen(false), 180);
  }

  function toggleProduct(id, event) {
    setSelectedSectionId(id);
    if (event?.currentTarget && window.matchMedia('(min-width: 992px)').matches) {
      setFlyoutTop(Math.max(12, event.currentTarget.getBoundingClientRect().top));
    }
    setFlyoutOpen((isOpen) => selectedSectionId === id ? !isOpen : true);
  }

  function openProduct(id, event) {
    setSelectedSectionId(id);
    if (event?.currentTarget && window.matchMedia('(min-width: 992px)').matches) {
      setFlyoutTop(Math.max(12, event.currentTarget.getBoundingClientRect().top));
    }
    setFlyoutOpen(true);
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="hz-sidebar-backdrop d-lg-none"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <aside
        ref={sidebarRef}
        className={`d-flex flex-column hz-sidebar hz-icon-rail ${mobileOpen ? 'hz-sidebar--mobile-open' : ''} ${isCollapsed ? 'hz-sidebar--collapsed' : ''}`}
        aria-label="Main navigation"
        onMouseEnter={keepFlyoutOpen}
        onMouseLeave={closeFlyoutSoon}
      >
        <div className="hz-sidebar__header d-flex align-items-center justify-content-between gap-2">
          <div className="hz-rail-brand" aria-label="Vettri HRMS">
            <Logo variant="mark" tone="default" size={26} />
            {!isCollapsed && <span>Vettri</span>}
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.innerWidth < 992) onCloseMobile?.();
              else setIsCollapsed((value) => !value);
            }}
            className="hz-sidebar__collapse-btn d-flex align-items-center justify-content-center border-0"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            className="hz-icon-btn d-lg-none d-flex align-items-center justify-content-center border-0"
            style={{ width: 32, height: 32 }}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="hz-sidebar__workspace" role="button" tabIndex={0} onClick={() => navigate('/dashboard')} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate('/dashboard'); }}}>
          <div className="hz-sidebar__workspace-mark">V</div>
          {!isCollapsed && (
            <div className="hz-sidebar__workspace-copy">
              <span className="hz-sidebar__workspace-name">{user?.companyName || 'Vettri Workspace'}</span>
              <small>{user?.fullName || 'Company workspace'}</small>
            </div>
          )}
        </div>

        <button type="button" className="hz-sidebar__search" onClick={openCommandCenter} aria-label="Open command center" title="Search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="M16 16L21 21" /></svg>
          {!isCollapsed && <span>Search</span>}
          {!isCollapsed && <kbd>{navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl K'}</kbd>}
        </button>

        <nav className="hz-icon-rail__nav flex-grow-1 overflow-auto" aria-label="Product areas">
          {primarySections.map((section) => {
            const Icon = section.id === 'administration' ? Settings2 : section.items[0]?.icon || LayoutDashboard;
            const isActive = activeSectionId === section.id;
            const isSelected = selectedSectionId === section.id && flyoutOpen;
            return (
              <button
                type="button"
                key={section.id}
                className={`hz-rail-item ${isActive ? 'hz-rail-item--active' : ''} ${isSelected ? 'hz-rail-item--selected' : ''}`}
                onClick={(event) => toggleProduct(section.id, event)}
                aria-label={section.label}
                aria-expanded={isSelected}
                title={section.label}
                onMouseEnter={(event) => {
                  keepFlyoutOpen();
                  if (window.matchMedia('(min-width: 992px)').matches) openProduct(section.id, event);
                }}
              >
                <Icon size={19} strokeWidth={1.8} />
                <span>{section.label}</span>
                {section.badge && (
                  <span
                    className={`hz-rail-badge ${section.badge.type === 'alert' ? 'hz-rail-badge--alert' : ''}`}
                  >
                    {section.badge.value > 99 ? '99+' : section.badge.value}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="hz-rail-utilities">
          {hasPermission('EMPLOYEE_CREATE') && (
            <button type="button" className="hz-sidebar__quick-action" onClick={() => navigate('/employees')} aria-label="Add employee" title="Add employee">
              <span className="hz-sidebar__quick-action-plus">+</span>
              {!isCollapsed && <span>Add employee</span>}
            </button>
          )}
          {supportItem && (
            <button
              type="button"
              className={`hz-rail-item hz-rail-utility ${activeSectionId === supportSection.id ? 'hz-rail-item--active' : ''}`}
              onClick={() => { setFlyoutOpen(false); navigate(supportItem.to); }}
              aria-label="Support"
              title="Support"
            >
              <LifeBuoy size={19} strokeWidth={1.8} />
              {!isCollapsed && <span>Support</span>}
            </button>
          )}
          {administration && (
            <button
              type="button"
              className={`hz-rail-item hz-rail-utility ${activeSectionId === 'administration' ? 'hz-rail-item--active' : ''} ${selectedSectionId === 'administration' && flyoutOpen ? 'hz-rail-item--selected' : ''}`}
              onClick={(event) => toggleProduct('administration', event)}
              aria-label="Settings"
              aria-expanded={selectedSectionId === 'administration' && flyoutOpen}
              title="Settings"
              onMouseEnter={(event) => {
                keepFlyoutOpen();
                if (window.matchMedia('(min-width: 992px)').matches) openProduct('administration', event);
              }}
            >
              <Settings2 size={19} strokeWidth={1.8} />
              {!isCollapsed && <span>Settings</span>}
            </button>
          )}
          <div className="hz-rail-profile">
            <button
              type="button"
              className="hz-rail-profile__trigger"
              onClick={() => setProfileOpen((open) => !open)}
              aria-label="Open profile menu"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              title={user?.fullName || 'Profile'}
            >
              <Avatar name={user?.fullName} size="sm" />
            </button>
            {profileOpen && (
              <div className="hz-rail-profile__menu" role="menu" aria-label="Profile menu">
                <div className="hz-rail-profile__identity">
                  <Avatar name={user?.fullName} size="sm" />
                  <span><strong>{user?.fullName || 'Account'}</strong><small>{user?.roles?.[0] || 'Member'}</small></span>
                </div>
                <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); navigate('/my-profile'); }}>
                  <UserCircle size={16} /> My Profile
                </button>
                <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); navigate('/settings/preferences'); }}>
                  <Settings2 size={16} /> Preferences
                </button>
                <button type="button" role="menuitem" className="hz-rail-profile__logout" onClick={() => { setProfileOpen(false); logout(); }}>
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>

        {flyoutOpen && selectedSection && (
          <div className="hz-nav-flyout" style={{ '--hz-flyout-top': `${flyoutTop}px` }} role="navigation" aria-label={`${selectedSection.label} navigation`}>
            <div className="hz-nav-flyout__header">
              <div>
                <p>{selectedSection.label}</p>
                <span>{sectionDescription(selectedSection.id)}</span>
              </div>
            </div>
            <div className="hz-nav-flyout__items">
              {selectedSection.items.map((item) => (
                <NavItem key={item.to} item={item} />
              ))}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function NavItem({ item }) {
  const location = useLocation();
  const isActive = isNavItemActive(item, location);

  return (
    <div className="hz-sidebar-item position-relative mx-2 mb-1">
      <NavLink
        to={item.to}
        end={item.end}
        className={`hz-sidebar-link hz-flyout-link d-flex align-items-center gap-3 px-3 py-2 text-decoration-none rounded-3 ${
          isActive ? 'hz-nav-active' : 'hz-nav-inactive'
        }`}
      >
        <item.icon size={18} strokeWidth={2} style={{ flexShrink: 0 }} />
        <span className="text-truncate">{item.label}</span>
      </NavLink>
    </div>
  );
}

function isNavItemActive(item, location) {
  const [itemPath, itemQuery = ''] = item.to.split('?');
  const pathMatches = item.end
    ? location.pathname === itemPath
    : location.pathname === itemPath || location.pathname.startsWith(`${itemPath}/`);

  if (!pathMatches) return false;
  return new URLSearchParams(itemQuery).toString() === new URLSearchParams(location.search).toString();
}

function sectionDescription(id) {
  const section = NAV_SECTIONS.find((s) => s.id === id);
  return section?.description || 'Vettri HRMS';
}
