import { BarChart3, Monitor, Settings, Users } from 'lucide-react';
import Logo from '../brand/Logo';

/**
 * LoginBrandPanel
 * Premium left-side brand experience for desktop
 * Displays VETTRI brand identity with workforce visualization
 */







export default function LoginBrandPanel() {
  const benefits = [
    { icon: Users, title: 'Empower your people', copy: 'Simplify HR and daily operations' },
    { icon: Settings, title: 'Manage your assets', copy: 'Complete visibility and control' },
    { icon: Monitor, title: 'Secure your workplace', copy: 'People, devices and software in sync' },
    { icon: BarChart3, title: 'Make better decisions', copy: 'Real-time insights for a growing business' },
  ];

  return (
    <aside className="login-brand-panel">
      <div className="login-brand-panel__pattern" />
      <div className="login-brand-panel__content">
        <div className="login-brand-panel__brand"><Logo tone="onDark" size={42} /></div>
        <div className="login-brand-panel__copy">
          <p className="login-brand-panel__eyebrow">People <span>•</span> Process <span>•</span> Progress</p>
          <h2>A smarter <em>workplace</em> for a stronger tomorrow</h2>
          <p className="login-brand-panel__intro">Unify your people, assets, devices, and workplace operations - all in one platform.</p>
          <div className="login-brand-panel__benefits">
            {benefits.map(({ icon: Icon, title, copy }) => (
              <div className="login-brand-panel__benefit" key={title}>
                <span className="login-brand-panel__benefit-icon"><Icon size={19} strokeWidth={1.8} /></span>
                <span><strong>{title}</strong><small>{copy}</small></span>
              </div>
            ))}
          </div>
        </div>

        <div className="login-brand-panel__device" aria-hidden="true">
          <div className="login-brand-panel__screen">
            <div className="mock-sidebar">
              <strong>Vettri</strong>
              <span>Dashboard</span><span>Employees</span><span>Attendance</span><span>Leave</span><span>Payroll</span><span>Assets</span><span>Devices</span><span>Software</span><span>Reports</span><span>Settings</span>
            </div>
            <div className="mock-dashboard">
              <div className="mock-topline"><span>Good morning, Team!</span><b>186</b></div>
              <small>Here&apos;s what&apos;s happening today.</small>
              <div className="mock-cards"><i /><i /><i /></div>
              <div className="mock-table"><b>Workforce Trend</b><div className="mock-bars"><i /><i /><i /><i /><i /><i /><i /></div></div>
            </div>
          </div>
        </div>

        <div className="login-brand-panel__footer">
          <strong>Trusted by modern businesses</strong>
          <span>Built for teams that believe in progress.</span>
          <b>Simple. Secure. Scalable.</b>
          <div className="login-brand-panel__dots"><i /><i /><i /></div>
        </div>
      </div>
      <style>{`
        .login-brand-panel { position: relative; flex: 0 0 56%; min-height: 100vh; overflow: hidden; color: #fff; background: #031a31; }
        .login-brand-panel::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 12% -8%, #143e69 0%, transparent 40%), linear-gradient(115deg, transparent 0 48%, rgba(47, 126, 185, .22) 48.2%, transparent 67%); }
        .login-brand-panel::after { content: ''; position: absolute; right: -10%; bottom: -10%; width: 70%; height: 27%; border-radius: 50% 50% 0 0; background: #020d1b; transform: rotate(-8deg); box-shadow: 0 -20px 45px rgba(0, 0, 0, .3); }
        .login-brand-panel__pattern { position: absolute; inset: 0; opacity: .3; background: radial-gradient(circle at 85% 5%, rgba(93, 176, 225, .18), transparent 24%); }
        .login-brand-panel__content { position: relative; z-index: 1; min-height: 100vh; padding: clamp(34px, 5vw, 68px) clamp(36px, 6vw, 92px) 118px; overflow: hidden; }
        .login-brand-panel__brand { display: inline-flex; margin-bottom: clamp(46px, 7vh, 76px); }
        .login-brand-panel__copy { max-width: 470px; }
        .login-brand-panel__eyebrow { margin: 0 0 18px; color: #a8bdd1; font-size: 11px; font-weight: 800; letter-spacing: .2em; text-transform: uppercase; }
        .login-brand-panel__eyebrow span { padding: 0 5px; color: #4aaee4; }
        .login-brand-panel h2 { max-width: 470px; margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: clamp(38px, 4.2vw, 64px); font-weight: 400; letter-spacing: -.045em; line-height: .98; }
        .login-brand-panel h2 em { color: #22a9ed; font-style: normal; }
        .login-brand-panel__intro { max-width: 390px; margin: 25px 0 0; color: #afc1d3; font-size: 14px; line-height: 1.6; }
        .login-brand-panel__benefits { position: relative; z-index: 4; display: grid; gap: 13px; max-width: 390px; margin-top: 28px; }
        .login-brand-panel__benefit { display: flex; align-items: center; gap: 13px; }
        .login-brand-panel__benefit-icon { display: grid; place-items: center; width: 42px; height: 42px; flex: 0 0 42px; border: 1px solid rgba(83, 181, 232, .3); border-radius: 10px; color: #f0f9ff; background: linear-gradient(145deg, rgba(25, 117, 188, .58), rgba(18, 56, 93, .58)); box-shadow: inset 0 1px 0 rgba(255,255,255,.12); }
        .login-brand-panel__benefit > span:last-child { display: flex; flex-direction: column; gap: 2px; }
        .login-brand-panel__benefit strong { color: #f7fbff; font-size: 13px; font-weight: 700; }
        .login-brand-panel__benefit small { color: #9fb5c8; font-size: 11px; }
        .login-brand-panel__device { position: absolute; z-index: 2; width: 57%; height: 51%; right: -12%; bottom: 6%; padding: 7px; border: 6px solid #030b15; border-radius: 18px; background: #0b1622; box-shadow: -22px 20px 35px rgba(0, 0, 0, .42); transform: rotate(-10deg) perspective(900px) rotateY(-12deg); }
        .login-brand-panel__device::before { content: ''; position: absolute; top: 7px; left: 50%; z-index: 2; width: 42px; height: 4px; border-radius: 5px; background: #8fa5b6; transform: translateX(-50%); }
        .login-brand-panel__screen { display: flex; gap: 7px; height: 100%; padding: 17px 9px 9px; overflow: hidden; border-radius: 12px; background: #f5f9fc; color: #304860; font-size: 7px; }
        .mock-sidebar { display: flex; width: 27%; flex-direction: column; gap: 7px; padding: 6px; border-right: 1px solid #dce5ec; }
        .mock-sidebar strong { margin-bottom: 8px; color: #1769b0; font-size: 10px; }
        .mock-dashboard { flex: 1; min-width: 0; padding: 7px 4px; }
        .mock-topline { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 2px; font-size: 9px; font-weight: 700; }
        .mock-topline b { color: #162c45; font-size: 18px; }
        .mock-dashboard > small { color: #71869a; font-size: 6px; }
        .mock-cards { display: flex; gap: 5px; margin: 14px 0 12px; }
        .mock-cards i { display: block; width: 31%; height: 34px; border-radius: 4px; background: #dceef8; }
        .mock-table { height: 58%; padding: 7px; border: 1px solid #dfe7ed; border-radius: 4px; background: #fff; }
        .mock-table b { display: block; margin-bottom: 7px; font-size: 8px; }
        .mock-bars { display: flex; height: calc(100% - 17px); align-items: end; gap: 6px; }
        .mock-bars i { display: block; flex: 1; height: 35%; border-radius: 3px 3px 0 0; background: #c9e4f2; }
        .mock-bars i:nth-child(2) { height: 52%; }.mock-bars i:nth-child(3) { height: 43%; }.mock-bars i:nth-child(4) { height: 72%; background: #208cd1; }.mock-bars i:nth-child(5) { height: 58%; }.mock-bars i:nth-child(6) { height: 82%; background: #2ea8e8; }.mock-bars i:nth-child(7) { height: 65%; }
        .login-brand-panel__footer { position: absolute; right: clamp(36px, 6vw, 92px); bottom: 34px; left: clamp(36px, 6vw, 92px); z-index: 5; display: flex; flex-direction: column; gap: 4px; color: #8299ad; font-size: 11px; line-height: 1.4; }
        .login-brand-panel__footer strong { color: #dce7f0; font-size: 10px; letter-spacing: .15em; text-transform: uppercase; }
        .login-brand-panel__footer b { position: absolute; right: 0; bottom: 0; color: #aebfce; font-size: 9px; letter-spacing: .14em; text-transform: uppercase; }
        .login-brand-panel__dots { position: absolute; right: 0; bottom: 24px; display: flex; gap: 8px; }
        .login-brand-panel__dots i { width: 7px; height: 7px; border-radius: 50%; background: #748da5; }.login-brand-panel__dots i:last-child { background: #e3edf4; }
        @media (min-width: 761px) and (max-height: 820px) {
          .login-brand-panel__content { padding-top: 30px; padding-bottom: 102px; }
          .login-brand-panel__brand { margin-bottom: 28px; }
          .login-brand-panel__eyebrow { margin-bottom: 12px; font-size: 10px; }
          .login-brand-panel h2 { max-width: 410px; font-size: clamp(34px, 3.8vw, 50px); }
          .login-brand-panel__intro { margin-top: 16px; font-size: 13px; }
          .login-brand-panel__benefits { gap: 8px; margin-top: 18px; }
          .login-brand-panel__benefit-icon { width: 34px; height: 34px; flex-basis: 34px; }
          .login-brand-panel__benefit strong { font-size: 12px; }
          .login-brand-panel__benefit small { font-size: 10px; }
          .login-brand-panel__device { width: 54%; height: 45%; bottom: 5%; }
          .login-brand-panel__footer { bottom: 24px; font-size: 10px; }
          .login-brand-panel__footer b { font-size: 8px; }
        }
        @media (max-width: 760px) {
          .login-brand-panel { display: none; }
        }
      `}</style>
    </aside>
  );
}

function BrandFeature({ icon: Icon, title, description }) {
  return (
    <div className="d-flex gap-3">
      <div style={{ flexShrink: 0, marginTop: 2 }}>
        <Icon size={20} style={{ color: 'var(--hz-accent-500)' }} />
      </div>
      <div>
        <div
          style={{
            fontSize: 'var(--hz-text-sm)',
            fontWeight: 600,
            marginBottom: 4,
            color: 'var(--hz-text-on-primary)',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 'var(--hz-text-sm)',
            opacity: 0.75,
            lineHeight: 1.5,
            color: 'var(--hz-text-on-primary)',
          }}
        >
          {description}
        </div>
      </div>
    </div>
  );
}
