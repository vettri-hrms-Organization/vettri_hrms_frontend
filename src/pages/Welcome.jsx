import { ArrowRight, BriefcaseBusiness, CalendarDays, Compass, LayoutDashboard, LifeBuoy, UserCircle, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Welcome() {
  const { user, hasPermission } = useAuth();
  const firstName = user?.fullName?.split(' ')[0] || 'there';
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const quickActions = [
    { title: 'Dashboard', description: 'Review workspace signals and action items.', to: '/dashboard', icon: LayoutDashboard },
    { title: 'People', description: 'Open the employee directory and profiles.', to: '/employees', icon: Users, permission: 'EMPLOYEE_VIEW' },
    { title: 'Attendance', description: 'Check attendance records and status.', to: '/attendance', icon: CalendarDays, permission: 'ATTENDANCE_VIEW' },
    { title: 'Recruitment', description: 'Review hiring pipelines and roles.', to: '/recruitment', icon: BriefcaseBusiness, permission: 'RECRUITMENT_VIEW' },
  ].filter((item) => !item.permission || hasPermission(item.permission));

  const summaryItems = [
    { label: 'Workspace', value: user?.companyName || 'Vettri HRMS' },
    { label: 'Role', value: user?.roles?.[0] || 'Workspace member' },
    { label: 'Status', value: 'Ready to work' },
  ];

  return (
    <div className="hz-page-shell hz-welcome-page">
      <header className="hz-welcome-hero">
        <div className="hz-welcome-hero__copy">
          <p className="hz-dashboard__eyebrow">Welcome back</p>
          <h1>Hi, {firstName}</h1>
          <p>{todayLabel}. Here is your workspace summary and the next actions most likely to matter today.</p>
        </div>
        <div className="hz-welcome-hero__badge">
          <Compass size={15} />
          Workspace ready
        </div>
      </header>

      <div className="hz-welcome-grid">
        <section className="hz-dashboard__surface hz-welcome-summary">
          <div className="hz-dashboard__section-heading">
            <div>
              <span className="hz-dashboard__section-kicker">Profile</span>
              <h2>Personal workspace</h2>
            </div>
          </div>
          <div className="hz-welcome-summary__identity">
            <div className="hz-welcome-profile__avatar"><UserCircle size={28} /></div>
            <div>
              <strong>{user?.fullName || 'Authenticated user'}</strong>
              <small>{user?.email || 'Secure workspace access'}</small>
            </div>
          </div>
          <div className="hz-welcome-summary__list">
            {summaryItems.map((item) => (
              <div key={item.label} className="hz-welcome-summary__item">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="hz-dashboard__surface hz-welcome-quick-actions">
          <div className="hz-dashboard__section-heading">
            <div>
              <span className="hz-dashboard__section-kicker">Actions</span>
              <h2>Useful shortcuts</h2>
            </div>
          </div>
          <div className="hz-dashboard__shortcut-grid">
            {quickActions.map(({ title, description, to, icon: Icon }) => (
              <Link key={title} to={to} className="hz-dashboard__shortcut-card">
                <span className="hz-dashboard__shortcut-icon"><Icon size={18} /></span>
                <span className="hz-dashboard__shortcut-copy">
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="hz-dashboard__three-col">
        <section className="hz-dashboard__surface">
          <div className="hz-dashboard__section-heading">
            <div>
              <span className="hz-dashboard__section-kicker">Priority</span>
              <h2>Next steps</h2>
            </div>
          </div>
          <div className="hz-dashboard__mini-list">
            <div className="hz-dashboard__mini-item">
              <span className="hz-dashboard__mini-bullet" />
              <div><strong>Review the dashboard</strong><small>Check employee, leave, and attendance updates.</small></div>
            </div>
            <div className="hz-dashboard__mini-item">
              <span className="hz-dashboard__mini-bullet hz-dashboard__mini-bullet--muted" />
              <div><strong>Check pending work</strong><small>Focus on decisions that need your action today.</small></div>
            </div>
          </div>
        </section>

        <section className="hz-dashboard__surface">
          <div className="hz-dashboard__section-heading">
            <div>
              <span className="hz-dashboard__section-kicker">Time</span>
              <h2>Today</h2>
            </div>
          </div>
          <div className="hz-dashboard__mini-list">
            <div className="hz-dashboard__mini-item">
              <span className="hz-dashboard__mini-bullet" />
              <div><strong>Schedule</strong><small>{todayLabel}</small></div>
            </div>
            <div className="hz-dashboard__mini-item">
              <span className="hz-dashboard__mini-bullet hz-dashboard__mini-bullet--muted" />
              <div><strong>Workspace</strong><small>{user?.companyName || 'Corporate workspace'}</small></div>
            </div>
          </div>
        </section>

        <section className="hz-dashboard__surface">
          <div className="hz-dashboard__section-heading">
            <div>
              <span className="hz-dashboard__section-kicker">Support</span>
              <h2>Need help?</h2>
            </div>
          </div>
          <div className="hz-dashboard__support-compact">
            <p>Open the support center for guidance and request history.</p>
            <Link to="/support" className="hz-dashboard__text-link">Visit support <ArrowRight size={15} /></Link>
            <div className="hz-welcome-help">
              <LifeBuoy size={16} />
              <span>Help and request tracking</span>
            </div>
          </div>
        </section>
      </div>

      <div className="hz-dashboard__support-strip hz-welcome-footer-strip">
        <div>
          <span className="hz-dashboard__section-kicker">Your workflow</span>
          <h2>Use Vettri as your daily workspace</h2>
          <p>Move between people, leave, attendance, payroll, and support without leaving the platform.</p>
        </div>
        <Link to="/dashboard" className="hz-dashboard__text-link">Open dashboard <ArrowRight size={15} /></Link>
        <Zap size={28} aria-hidden="true" />
      </div>
    </div>
  );
}