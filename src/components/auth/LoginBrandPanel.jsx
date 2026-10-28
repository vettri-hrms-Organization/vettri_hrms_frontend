import { CalendarCheck2, Check, ShieldCheck, Sparkles, Users, Wallet } from 'lucide-react';
import Logo from '../brand/Logo';

/**
 * Left-hand brand panel on the sign-in screen (desktop only).
 * The "product glimpse" below the copy is an illustration of the Vettri
 * interface, not live data, so it is hidden from assistive technology.
 */
export default function LoginBrandPanel() {
  const capabilities = [
    { icon: Users, label: 'People & org' },
    { icon: CalendarCheck2, label: 'Time & leave' },
    { icon: Wallet, label: 'Payroll' },
    { icon: ShieldCheck, label: 'Devices & security' },
  ];

  return (
    <aside className="login-brand-panel">
      <div className="login-brand-panel__grid" aria-hidden="true" />
      <div className="login-brand-panel__content">
        <div className="login-brand-panel__brand"><Logo tone="onDark" size={40} /></div>

        <div className="login-brand-panel__copy">
          <p className="login-brand-panel__eyebrow"><Sparkles size={13} aria-hidden="true" /> The workforce platform for growing teams</p>
          <h2>People operations, <em>beautifully</em> organized.</h2>
          <p className="login-brand-panel__intro">Employees, attendance, leave, payroll and workplace devices in one calm, secure workspace.</p>
          <ul className="login-brand-panel__chips">
            {capabilities.map(({ icon: Icon, label }) => (
              <li key={label}><Icon size={14} strokeWidth={2} aria-hidden="true" />{label}</li>
            ))}
          </ul>
        </div>

        <div className="login-brand-panel__stage" aria-hidden="true">
          <div className="glimpse glimpse--main">
            <div className="glimpse__head">
              <span className="glimpse__dot" /><span className="glimpse__dot" /><span className="glimpse__dot" />
              <b>Workforce overview</b>
            </div>
            <div className="glimpse__kpis">
              <div><small>Headcount</small><strong>248</strong><em>+12 this quarter</em></div>
              <div><small>Present today</small><strong>94%</strong><em>On time</em></div>
              <div><small>On leave</small><strong>11</strong><em>3 returning</em></div>
            </div>
            <div className="glimpse__chart">
              {[38, 52, 46, 64, 58, 76, 70, 88, 80, 92].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}
            </div>
          </div>

          <div className="glimpse glimpse--approval">
            <span className="glimpse__avatar">MI</span>
            <span><b>Meena Iyer</b><small>Casual leave · 2 days</small></span>
            <span className="glimpse__approved"><Check size={12} strokeWidth={3} /> Approved</span>
          </div>

          <div className="glimpse glimpse--payroll">
            <small>October payroll</small>
            <strong>Ready to release</strong>
            <span className="glimpse__progress"><i /></span>
          </div>
        </div>

        <div className="login-brand-panel__footer">
          <span>Simple. Secure. Scalable.</span>
          <span>© {new Date().getFullYear()} Vettri HRMS</span>
        </div>
      </div>

      <style>{`
        .login-brand-panel { position: relative; flex: 0 0 54%; min-height: 100vh; overflow: hidden; color: #fff;
          background: radial-gradient(70% 60% at 0% 0%, rgba(65,105,225,.38), transparent 60%),
                      radial-gradient(60% 55% at 100% 100%, rgba(101,88,245,.30), transparent 60%),
                      linear-gradient(160deg, #0B1222 0%, #10172A 50%, #141E3C 100%); }
        .login-brand-panel__grid { position: absolute; inset: 0; opacity: .5;
          background-image: linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px);
          background-size: 44px 44px; mask-image: radial-gradient(80% 70% at 30% 30%, #000 30%, transparent 75%); -webkit-mask-image: radial-gradient(80% 70% at 30% 30%, #000 30%, transparent 75%); }
        .login-brand-panel__content { position: relative; z-index: 1; display: flex; flex-direction: column; min-height: 100vh; padding: clamp(32px, 5vh, 56px) clamp(36px, 5.5vw, 84px) 32px; }
        .login-brand-panel__brand { display: inline-flex; margin-bottom: clamp(28px, 6vh, 64px); }
        .login-brand-panel__copy { max-width: 560px; }
        .login-brand-panel__eyebrow { display: inline-flex; align-items: center; gap: 8px; margin: 0 0 20px; padding: 6px 12px; border: 1px solid rgba(255,255,255,.12); border-radius: 999px; background: rgba(255,255,255,.04); color: #C9D2E6; font-size: 12.5px; font-weight: 600; }
        .login-brand-panel__eyebrow svg { color: #A9BCFF; }
        .login-brand-panel h2 { margin: 0; color: #fff; font-size: clamp(36px, 3.9vw, 56px); font-weight: 760; letter-spacing: -.04em; line-height: 1.05; }
        .login-brand-panel h2 em { font-style: normal; background: linear-gradient(90deg, #8EA6FF 0%, #B3A8FF 60%, #7FD1FF 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .login-brand-panel__intro { max-width: 460px; margin: 20px 0 0; color: #B4BED3; font-size: 15.5px; line-height: 1.6; }
        .login-brand-panel__chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 24px 0 0; padding: 0; list-style: none; }
        .login-brand-panel__chips li { display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; background: rgba(255,255,255,.05); color: #E3E8F4; font-size: 13px; font-weight: 600; }
        .login-brand-panel__chips svg { color: #A9BCFF; }

        .login-brand-panel__stage { position: relative; flex: 1; min-height: 250px; margin: clamp(24px, 4vh, 44px) 0 24px; }
        .glimpse { position: absolute; border: 1px solid rgba(255,255,255,.12); border-radius: 16px; background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04)); box-shadow: 0 30px 60px -20px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.08); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
        .glimpse--main { left: 0; top: 0; width: min(440px, 78%); padding: 16px 18px 18px; animation: glimpse-float 7s ease-in-out infinite; }
        .glimpse__head { display: flex; align-items: center; gap: 6px; margin-bottom: 14px; }
        .glimpse__dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,.18); }
        .glimpse__head b { margin-left: 8px; color: #E3E8F4; font-size: 12.5px; font-weight: 650; }
        .glimpse__kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .glimpse__kpis div { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 10px; background: rgba(255,255,255,.06); }
        .glimpse__kpis small { color: #9AA6C0; font-size: 11px; }
        .glimpse__kpis strong { color: #fff; font-size: 20px; font-weight: 760; letter-spacing: -.02em; }
        .glimpse__kpis em { color: #7FE0BE; font-size: 10.5px; font-style: normal; font-weight: 600; }
        .glimpse__chart { display: flex; align-items: flex-end; gap: 6px; height: 74px; margin-top: 14px; }
        .glimpse__chart i { flex: 1; border-radius: 4px 4px 2px 2px; background: linear-gradient(180deg, rgba(142,166,255,.95), rgba(101,88,245,.35)); transform-origin: bottom; animation: glimpse-grow 1.1s cubic-bezier(.2,0,0,1) both; }
        ${[...Array(10)].map((_, i) => `.glimpse__chart i:nth-child(${i + 1}) { animation-delay: ${200 + i * 60}ms; }`).join(' ')}
        .glimpse--approval { right: 2%; top: 46%; display: flex; align-items: center; gap: 10px; padding: 12px 14px; animation: glimpse-float 7s ease-in-out -2.5s infinite; }
        .glimpse__avatar { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: #E3F4EE; color: #0E5E4A; font-size: 12px; font-weight: 800; }
        .glimpse--approval > span:nth-child(2) { display: flex; flex-direction: column; }
        .glimpse--approval b { color: #fff; font-size: 13px; }
        .glimpse--approval small { color: #9AA6C0; font-size: 11.5px; }
        .glimpse__approved { display: inline-flex; align-items: center; gap: 4px; margin-left: 6px; padding: 4px 9px; border-radius: 999px; background: rgba(52,195,143,.16); color: #7FE0BE; font-size: 11.5px; font-weight: 700; }
        .glimpse--payroll { left: 18%; bottom: 0; display: flex; flex-direction: column; gap: 3px; width: 230px; padding: 13px 15px; animation: glimpse-float 7s ease-in-out -4.5s infinite; }
        .glimpse--payroll small { color: #9AA6C0; font-size: 11.5px; }
        .glimpse--payroll strong { color: #fff; font-size: 14px; }
        .glimpse__progress { height: 6px; margin-top: 6px; border-radius: 999px; background: rgba(255,255,255,.1); overflow: hidden; }
        .glimpse__progress i { display: block; width: 86%; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #4169E1, #8EA6FF); animation: glimpse-fill 1.6s cubic-bezier(.2,0,0,1) .5s both; }

        .login-brand-panel__footer { display: flex; justify-content: space-between; gap: 12px; color: #7F8BA6; font-size: 12.5px; }

        @keyframes glimpse-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes glimpse-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes glimpse-fill { from { width: 0; } }

        @media (max-height: 760px) {
          .login-brand-panel__stage { display: none; }
          .login-brand-panel__copy { margin-bottom: auto; }
        }
        @media (max-width: 1100px) {
          .glimpse--approval { right: 0; }
          .glimpse--payroll { left: 6%; }
        }
        @media (max-width: 760px) {
          .login-brand-panel { display: none; }
        }
      `}</style>
    </aside>
  );
}
