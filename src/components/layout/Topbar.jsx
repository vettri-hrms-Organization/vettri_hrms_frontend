import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Bell, ChevronDown, LogOut, UserCircle, Menu, Building2, Sun, Moon, CheckCheck, Circle, Plus, Users, CalendarDays, Briefcase } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { employeesApi } from '../../api/endpoints/employees';
import { adminApi } from '../../api/endpoints/admin';
import Avatar from '../ui/Avatar';
import Logo from '../brand/Logo';
import { NAV_INDEX, NAV_SECTIONS } from './navConfig';
import { useNavMemory } from './NavMemoryContext';
import { selfServiceApi } from '../../api/endpoints/selfService';
import { useTheme } from '../../contexts/ThemeContext';
import CommandCenter from './CommandCenter';

export default function Topbar({ onOpenMobileNav }) {
  const { user, logout, hasPermission, hasRole, selectedCompanyId, setSelectedCompanyId } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [commandCenterOpen, setCommandCenterOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const currentPage = useMemo(() => {
    const item = NAV_INDEX.find((entry) => {
      const [path] = entry.to.split('?');
      return path === location.pathname || (path !== '/' && location.pathname.startsWith(`${path}/`));
    });
    return item?.label || 'Workspace';
  }, [location.pathname]);
  const isEmployeeUser = !!user?.employeeId;
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: selfServiceApi.notifications,
    enabled: !!user && isEmployeeUser,
  });
  const unreadNotifications = notifications.filter((notification) => !(notification.read_at || notification.readAt)).length;
  const recentNotifications = notifications.slice(0, 5);
  const markRead = useMutation({
    mutationFn: selfServiceApi.markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['admin-companies-selector'],
    queryFn: adminApi.companies,
    enabled: hasRole('SUPER_ADMIN'),
  });

  const quickActions = [
    hasPermission('EMPLOYEE_CREATE') && { label: 'Open employees', description: 'Add or manage people', icon: Users, to: '/employees' },
    hasPermission('LEAVE_VIEW') && { label: 'Open leave', description: 'Review requests and balances', icon: CalendarDays, to: '/leave' },
    hasPermission('RECRUITMENT_VIEW') && { label: 'Open recruitment', description: 'Manage jobs and candidates', icon: Briefcase, to: '/recruitment' },
  ].filter(Boolean);

  // Global command center shortcut.
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandCenterOpen(true);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function openMyProfile() {
    setMenuOpen(false);
    if (user?.employeeId) {
      navigate(`/employees/${user.employeeId}`);
      return;
    }
    if (!user?.email) {
      navigate('/employees');
      return;
    }
    setProfileLoading(true);
    try {
      const matches = await employeesApi.list(user.email);
      const employee = matches.find((item) => item.email?.toLowerCase() === user.email.toLowerCase()) || matches[0];
      navigate(employee ? `/employees/${employee.id}` : '/employees');
    } catch {
      navigate('/employees');
    } finally {
      setProfileLoading(false);
    }
  }

  return (
    <header
      className="hz-topbar d-flex align-items-center gap-2 px-3 px-md-4"
    >
      <div className="hz-brand-mark d-none d-lg-flex" aria-label="Vettri HRMS">
        <span className="hz-brand-mark__text">Vettri</span>
      </div>

      <button
        type="button"
        onClick={onOpenMobileNav}
        className="hz-icon-btn d-lg-none d-flex align-items-center justify-content-center border-0 flex-shrink-0"
        style={{ width: 38, height: 38 }}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <div className="hz-topbar-context d-none d-lg-flex" aria-live="polite">
        <span className="hz-topbar-context__eyebrow">Workspace</span>
        <strong>{currentPage}</strong>
      </div>

      <button type="button" className="hz-command-trigger" onClick={() => setCommandCenterOpen(true)} aria-label="Open command center">
        <Search size={16} aria-hidden="true" />
        <span>Search employees, pages, actions...</span>
        <kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} K</kbd>
      </button>
      <CommandCenter open={commandCenterOpen} onClose={() => setCommandCenterOpen(false)} />

      {false && (
          <div id="hz-global-search-results" className="position-absolute hz-surface hz-search-panel" style={{ top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 20, maxHeight: '70vh', overflowY: 'auto' }}>
            {!query.trim() && recentItems.length > 0 && (
              <div className="pb-1">
                <div className="px-3 pt-2 pb-1 d-flex align-items-center gap-2" style={{ fontSize: 11, color: 'var(--hz-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <Clock3 size={12} /> Recent Pages
                </div>
                {recentItems.map((item, i) => (
                  <SearchRow
                    key={item.to}
                    active={activeIndex === i}
                    icon={<item.icon size={15} />}
                    title={item.label}
                    subtitle={item.section}
                    onClick={() => goTo({ kind: 'page', item })}
                  />
                ))}
              </div>
            )}
            
            {!query.trim() && recentItems.length === 0 && searchHistory.length === 0 && (
              <div className="px-3 py-3" style={{ fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-muted)' }}>
                Pages you visit will show up here
              </div>
            )}

            {!query.trim() && searchHistory.length > 0 && (
              <div className="pb-1">
                <div className="px-3 pt-2 pb-1 d-flex align-items-center justify-content-between" style={{ fontSize: 11, color: 'var(--hz-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <span><Zap size={12} style={{ marginRight: 4, display: 'inline' }} /> Search History</span>
                  <button
                    type="button"
                    onClick={() => {
                      clearSearchHistory();
                      setSearchHistory([]);
                    }}
                    className="border-0 bg-transparent p-0"
                    style={{ cursor: 'pointer', color: 'var(--hz-text-muted)' }}
                    title="Clear history"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                {searchHistory.slice(0, 5).map((historyQuery, i) => (
                  <button
                    key={`history-${i}`}
                    type="button"
                    onClick={() => setQuery(historyQuery)}
                    className="hz-search-row d-flex align-items-center gap-2 w-100 border-0 bg-transparent text-start px-3 py-2"
                    style={{ 
                      background: activeIndex === recentItems.length + i ? 'var(--hz-primary-50)' : 'transparent',
                      borderRadius: 8,
                      margin: '0 6px',
                      transition: 'all 150ms ease-out'
                    }}
                  >
                    <span className="d-flex align-items-center justify-content-center" style={{ width: 24, flexShrink: 0, color: 'var(--hz-text-secondary)' }}>
                      <Clock3 size={14} />
                    </span>
                    <span className="flex-grow-1 text-truncate">
                      <span style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 500, color: 'var(--hz-text-primary)' }}>{historyQuery}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {query.trim() && matchedPages.length === 0 && matchedEmployees.length === 0 && !employeesLoading && (
              <div className="px-3 py-3 d-flex align-items-center gap-2" style={{ fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-muted)' }}>
                <ShieldAlert size={14} /> No matches for "{query}"
              </div>
            )}

            {query.trim() && matchedPages.length > 0 && (
              <div className="pb-1">
                <div className="px-3 pt-2 pb-1" style={{ fontSize: 11, color: 'var(--hz-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Pages & Modules
                </div>
                {matchedPages.map((item, i) => {
                  const moduleInfo = NAV_SECTIONS.find((s) => s.label === item.section);
                  return (
                    <SearchRow
                      key={item.to}
                      active={activeIndex === i}
                      icon={<item.icon size={15} />}
                      title={item.label}
                      subtitle={moduleInfo?.description || item.section}
                      onClick={() => goTo({ kind: 'page', item })}
                    />
                  );
                })}
              </div>
            )}

            {query.trim() && (matchedEmployees.length > 0 || employeesLoading) && (
              <div className="pb-1">
                <div className="px-3 pt-2 pb-1" style={{ fontSize: 11, color: 'var(--hz-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  People
                </div>
                {employeesLoading && <div className="px-3 py-2" style={{ fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-muted)' }}>Searching…</div>}
                {!employeesLoading &&
                  matchedEmployees.map((emp, i) => (
                    <SearchRow
                      key={emp.id}
                      active={activeIndex === matchedPages.length + i}
                      icon={<Avatar name={emp.fullName} size="sm" />}
                      title={emp.fullName}
                      subtitle={emp.designationTitle || emp.departmentName || 'Employee'}
                      onClick={() => goTo({ kind: 'employee', item: emp })}
                    />
                  ))}
              </div>
            )}
          </div>
      )}

      <div className="d-flex align-items-center gap-2 ms-auto flex-shrink-0">
        {quickActions.length > 0 && (
          <div className="position-relative">
            <button
              type="button"
              className="hz-icon-btn d-flex align-items-center justify-content-center"
              style={{ width: 40, height: 40 }}
              onClick={() => setQuickCreateOpen((open) => !open)}
              aria-label="Quick actions"
              aria-haspopup="menu"
              aria-expanded={quickCreateOpen}
              title="Quick actions"
            >
              <Plus size={19} />
            </button>
            {quickCreateOpen && (
              <>
                <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 15 }} onClick={() => setQuickCreateOpen(false)} />
                <div className="hz-quick-actions hz-surface" role="menu" aria-label="Quick actions">
                  <div className="hz-quick-actions__header">Quick actions</div>
                  {quickActions.map(({ label, description, icon: Icon, to }) => (
                    <button
                      type="button"
                      role="menuitem"
                      key={to}
                      className="hz-quick-actions__item"
                      onClick={() => {
                        setQuickCreateOpen(false);
                        navigate(to);
                      }}
                    >
                      <span className="hz-quick-actions__icon"><Icon size={16} /></span>
                      <span><strong>{label}</strong><small>{description}</small></span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <button type="button" className="hz-icon-btn d-flex align-items-center justify-content-center" style={{ width: 38, height: 38 }} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'} title={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        {hasRole('SUPER_ADMIN') && (
          <label className="d-flex align-items-center gap-2 mb-0" title="Tenant company">
            <Building2 size={16} color="var(--hz-text-muted)" />
            <select
              className="form-select form-select-sm"
              value={selectedCompanyId || ''}
              onChange={(event) => setSelectedCompanyId(event.target.value || null)}
              disabled={companiesLoading}
              aria-label="Select tenant company"
              style={{ maxWidth: 190 }}
            >
              <option value="">Select company</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </label>
        )}
        {!hasRole('SUPER_ADMIN') && user?.companyName && (
          <div className="hz-current-workspace d-none d-lg-flex align-items-center gap-2 px-2">
            <Building2 size={15} />
            <span className="text-truncate">{user.companyName}</span>
          </div>
        )}
        <div className="position-relative">
          <button
            type="button"
            className="hz-icon-btn position-relative d-flex align-items-center justify-content-center"
            style={{ width: 38, height: 38 }}
            aria-label="Notifications"
            aria-haspopup="menu"
            aria-expanded={notificationsOpen}
            onClick={() => setNotificationsOpen((open) => !open)}
          >
            <Bell size={18} />
            {unreadNotifications > 0 && <span className="hz-notification-dot" aria-label={`${unreadNotifications} unread notification${unreadNotifications === 1 ? '' : 's'}`} />}
          </button>
          {notificationsOpen && (
            <>
              <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 15 }} onClick={() => setNotificationsOpen(false)} />
              <div className="hz-topbar-notifications hz-surface" role="menu" aria-label="Notifications">
                <div className="hz-topbar-notifications__header">
                  <strong>Notifications</strong>
                  {unreadNotifications > 0 && <span className="hz-topbar-notifications__count">{unreadNotifications} new</span>}
                </div>
                {recentNotifications.length === 0 && (
                  <div className="hz-topbar-notifications__empty">You&apos;re all caught up.</div>
                )}
                {recentNotifications.length > 0 && (
                  <div className="hz-topbar-notifications__list">
                    {recentNotifications.map((notification) => {
                      const isRead = !!(notification.read_at || notification.readAt);
                      return (
                        <button
                          type="button"
                          role="menuitem"
                          key={notification.id}
                          className={`hz-topbar-notifications__item ${isRead ? '' : 'is-unread'}`}
                          onClick={() => {
                            if (!isRead) markRead.mutate(notification.id);
                            setNotificationsOpen(false);
                            navigate('/notifications');
                          }}
                        >
                          <span className="hz-topbar-notifications__item-icon">{isRead ? <CheckCheck size={14} /> : <Circle size={8} />}</span>
                          <span className="hz-topbar-notifications__item-copy">
                            <strong>{notification.title}</strong>
                            <small>{notification.message}</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <Link to="/notifications" className="hz-topbar-notifications__viewall" onClick={() => setNotificationsOpen(false)}>
                  View all notifications
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="position-relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="hz-icon-btn d-flex align-items-center gap-2 px-2"
            style={{ borderRadius: 10, width: 'auto', height: 44 }}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Account menu"
          >
            <Avatar name={user?.fullName} size="sm" />
            <div className="d-none d-md-flex flex-column align-items-start lh-1">
              <span style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 600, color: 'var(--hz-text-primary)' }}>
                {user?.fullName}
              </span>
              <span style={{ fontSize: 11, color: 'var(--hz-text-muted)' }}>{user?.roles?.[0]}</span>
            </div>
            <ChevronDown size={14} />
          </button>

          {menuOpen && (
            <>
              <div
                className="position-fixed top-0 start-0 w-100 h-100"
                style={{ zIndex: 15 }}
                onClick={() => setMenuOpen(false)}
              />
              <div
                role="menu"
                className="position-absolute end-0 mt-2 hz-surface"
                style={{ width: 220, zIndex: 20, padding: 6 }}
              >
                <div className="px-2 py-2 mb-1" style={{ borderBottom: '1px solid var(--hz-border)' }}>
                  <div style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 600 }}>{user?.fullName}</div>
                  <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{user?.email}</div>
                </div>
                <button
                  role="menuitem"
                  onClick={openMyProfile}
                  disabled={profileLoading}
                  className="btn btn-light border-0 w-100 d-flex align-items-center gap-2 text-start px-2 py-2"
                >
                  <UserCircle size={16} /> {profileLoading ? 'Opening profile…' : 'My Profile'}
                </button>
                <button
                  role="menuitem"
                  onClick={logout}
                  className="btn btn-light border-0 w-100 d-flex align-items-center gap-2 text-start px-2 py-2"
                  style={{ color: 'var(--hz-danger-600)' }}
                >
                  <LogOut size={16} /> Log Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function SearchRow({ icon, title, subtitle, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hz-search-row d-flex align-items-center gap-2 w-100 border-0 bg-transparent text-start px-3 py-2"
      style={{ 
        background: active ? 'var(--hz-primary-50)' : 'transparent',
        borderRadius: 8,
        margin: '0 6px',
        transition: 'all 150ms ease-out'
      }}
    >
      <span className="d-flex align-items-center justify-content-center" style={{ width: 24, flexShrink: 0, color: 'var(--hz-text-secondary)' }}>
        {icon}
      </span>
      <span className="flex-grow-1 text-truncate">
        <span style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 600, color: 'var(--hz-text-primary)' }}>{title}</span>
        {subtitle && <span className="d-block" style={{ fontSize: 11, color: 'var(--hz-text-muted)' }}>{subtitle}</span>}
      </span>
    </button>
  );
}
