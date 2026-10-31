import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Bell, ChevronDown, LogOut, UserCircle, Menu, Building2, Sun, Moon, CheckCheck, Circle, Plus, Users, CalendarDays, Briefcase, Sparkles, KeyRound, Download } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { employeesApi } from '../../api/endpoints/employees';
import { supportAccessApi } from '../../api/endpoints/supportAccess';
import { notificationsApi } from '../../api/endpoints/notifications';
import Avatar from '../ui/Avatar';
import { NAV_INDEX } from './navConfig';
import { useTheme } from '../../contexts/ThemeContext';
import { formatRole } from '../../utils/formatRole';
import CommandCenter from './CommandCenter';
import AskVettriPanel from './AskVettriPanel';
import { promptInstall, usePwa } from '../../pwa/pwa';
import IosInstallHint from '../../pwa/IosInstallHint';
import { LANGUAGES, useLanguage } from '../../i18n/LanguageContext';
import { syncAppBadge } from '../../pwa/OfflineBanner';

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
  const [askVettriOpen, setAskVettriOpen] = useState(false);
  const [askVettriQuery, setAskVettriQuery] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const pwa = usePwa();
  const [iosHintOpen, setIosHintOpen] = useState(false);
  const currentPage = useMemo(() => {
    const currentQuery = location.search.replace(/^\?/, '');
    const exact = NAV_INDEX.find((entry) => {
      const [path, query = ''] = entry.to.split('?');
      const pathMatches = path === location.pathname || (path !== '/' && location.pathname.startsWith(`${path}/`));
      return pathMatches && query === currentQuery;
    });
    if (exact) return exact.label;

    const fallback = NAV_INDEX.find((entry) => {
      const [path] = entry.to.split('?');
      return path === location.pathname || (path !== '/' && location.pathname.startsWith(`${path}/`));
    });
    return fallback?.label || 'Workspace';
  }, [location.pathname, location.search]);
  const { data: notificationData = { items: [], unreadCount: 0 } } = useQuery({
    queryKey: ['notifications', 'inbox', 0, 5],
    queryFn: () => notificationsApi.inbox({ page: 0, size: 5 }),
    enabled: !!user,
  });
  const unreadNotifications = notificationData.unreadCount || 0;
  useEffect(() => { syncAppBadge(unreadNotifications); }, [unreadNotifications]);
  const recentNotifications = notificationData.items || [];
  const markRead = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markAllRead = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  // Platform staff may only open companies that granted Vettri support access (or demo workspaces).
  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['support-access-companies'],
    queryFn: supportAccessApi.accessibleCompanies,
    enabled: hasRole('SUPER_ADMIN'),
    refetchInterval: 60_000,
  });

  // A remembered company whose support access ended (or never existed) is dropped, so platform
  // staff fall back to the platform view instead of a page full of "access not granted" errors.
  useEffect(() => {
    if (!hasRole('SUPER_ADMIN') || companiesLoading || !selectedCompanyId) return;
    if (!companies.some((company) => String(company.companyId) === String(selectedCompanyId))) setSelectedCompanyId(null);
  }, [companies, companiesLoading, selectedCompanyId, hasRole, setSelectedCompanyId]);

  async function openCompany(companyId) {
    if (!companyId) { setSelectedCompanyId(null); return; }
    try {
      await supportAccessApi.openSession(companyId); // records the visit in the company's audit log
      setSelectedCompanyId(companyId);
    } catch {
      setSelectedCompanyId(null);
    }
  }

  const quickActions = [
    hasPermission('EMPLOYEE_CREATE') && { label: 'Open employees', description: 'Add or manage people', icon: Users, to: '/employees' },
    hasPermission('LEAVE_VIEW') && { label: 'Open leave', description: 'Review requests and balances', icon: CalendarDays, to: '/leave' },
    hasPermission('RECRUITMENT_VIEW') && { label: 'Open recruitment', description: 'Manage jobs and candidates', icon: Briefcase, to: '/recruitment' },
  ].filter(Boolean);

  function openAskVettri(query = '') {
    setAskVettriQuery(query);
    setCommandCenterOpen(false);
    setAskVettriOpen(true);
  }

  // Global command center shortcut.
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandCenterOpen(true);
      }
    }
    function openFromSidebar() {
      setCommandCenterOpen(true);
    }
    function closeMenusOnEscape(e) {
      if (e.key !== 'Escape') return;
      setMenuOpen(false);
      setNotificationsOpen(false);
      setQuickCreateOpen(false);
    }
    document.addEventListener('keydown', closeMenusOnEscape);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('vettri:open-command-center', openFromSidebar);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keydown', closeMenusOnEscape);
      window.removeEventListener('vettri:open-command-center', openFromSidebar);
    };
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
    <header className="hz-topbar vettri-topbar">
      <button
        type="button"
        onClick={onOpenMobileNav}
        className="hz-icon-btn d-lg-none d-flex align-items-center justify-content-center border-0 flex-shrink-0"
        style={{ width: 38, height: 38 }}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <div className="vettri-topbar-crumb d-none d-lg-flex" aria-live="polite">
        <span>Workspace</span><b>/</b><strong>{currentPage}</strong>
      </div>

      <button type="button" className="hz-command-trigger vettri-command-trigger" onClick={() => setCommandCenterOpen(true)} aria-label="Open command center">
        <Search size={16} aria-hidden="true" />
        <span>Search employees, pages, actions...</span>
        <kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} K</kbd>
      </button>
      <button type="button" className="vettri-ask-trigger" onClick={() => openAskVettri()} aria-label="Ask Vettri" title="Ask Vettri, your HR assistant">
        <Sparkles size={16} aria-hidden="true" />
        <span>Ask Vettri</span>
      </button>
      <CommandCenter open={commandCenterOpen} onClose={() => setCommandCenterOpen(false)} onAskVettri={openAskVettri} />
      <AskVettriPanel open={askVettriOpen} initialQuery={askVettriQuery} onClose={() => setAskVettriOpen(false)} />
      <IosInstallHint open={iosHintOpen} onClose={() => setIosHintOpen(false)} />

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
        <LanguagePicker />
        <button type="button" className="hz-icon-btn d-flex align-items-center justify-content-center" style={{ width: 38, height: 38 }} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'} title={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        {hasRole('SUPER_ADMIN') && (
          <label className="d-flex align-items-center gap-2 mb-0" title="Tenant company">
            <Building2 size={16} color="var(--hz-text-muted)" />
            <select
              className="form-select form-select-sm"
              value={selectedCompanyId || ''}
              onChange={(event) => openCompany(event.target.value || null)}
              disabled={companiesLoading}
              aria-label="Open a company that allowed support access"
              style={{ maxWidth: 260, color: 'var(--hz-text-primary)', backgroundColor: 'var(--hz-bg-surface)', borderColor: 'var(--hz-border)', fontWeight: 600 }}
            >
              <option value="">{companies.length ? 'Platform view (no company)' : 'No company has allowed support'}</option>
              {companies.map((company) => <option key={company.companyId} value={company.companyId}>{company.name}{company.demo ? ' (demo)' : company.accessLevel === 'FULL' ? ' (full access)' : ' (view only)'}</option>)}
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
            {unreadNotifications > 0 && (
              <span
                className="hz-notification-dot"
                style={{ width: 'auto', minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, color: '#fff', fontSize: 9, lineHeight: '12px', textAlign: 'center' }}
                aria-label={`${unreadNotifications} unread notification${unreadNotifications === 1 ? '' : 's'}`}
              >
                {unreadNotifications > 99 ? '99+' : unreadNotifications}
              </span>
            )}
          </button>
          {notificationsOpen && (
            <>
              <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 15 }} onClick={() => setNotificationsOpen(false)} />
              <div className="hz-topbar-notifications hz-surface" role="menu" aria-label="Notifications">
                <div className="hz-topbar-notifications__header">
                  <strong>Notifications</strong>
                  {unreadNotifications > 0 && <span className="hz-topbar-notifications__count">{unreadNotifications} new</span>}
                </div>
                {unreadNotifications > 0 && (
                  <button type="button" className="hz-topbar-notifications__viewall" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
                    Mark all as read
                  </button>
                )}
                {recentNotifications.length === 0 && (
                  <div className="hz-topbar-notifications__empty">You&apos;re all caught up.</div>
                )}
                {recentNotifications.length > 0 && (
                  <div className="hz-topbar-notifications__list">
                    {recentNotifications.map((notification) => {
                      const isRead = !!notification.read_at;
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
              <span style={{ fontSize: 11.5, color: 'var(--hz-text-muted)' }}>{formatRole(user?.roles?.[0])}</span>
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
              <div role="menu" className="position-absolute end-0 mt-2 hz-surface hz-topbar-menu">
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
                {(pwa.canInstall || pwa.showIosHint) && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      if (pwa.canInstall) promptInstall();
                      else setIosHintOpen(true);
                    }}
                    className="btn btn-light border-0 w-100 d-flex align-items-center gap-2 text-start px-2 py-2"
                  >
                    <Download size={16} /> Install app
                  </button>
                )}
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/account/security');
                  }}
                  className="btn btn-light border-0 w-100 d-flex align-items-center gap-2 text-start px-2 py-2"
                >
                  <KeyRound size={16} /> Change password
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

/** UI language: English, Hindi or Tamil (per browser). */
function LanguagePicker() {
  const { lang, setLang, t } = useLanguage();
  return (
    <label className="d-flex align-items-center mb-0" title={t('Language')}>
      <span className="visually-hidden">{t('Language')}</span>
      <select className="form-select form-select-sm" style={{ width: 'auto' }} value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language">
        {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.native}</option>)}
      </select>
    </label>
  );
}
