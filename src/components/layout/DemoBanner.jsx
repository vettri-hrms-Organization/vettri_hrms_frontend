import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FlaskConical, LogOut } from 'lucide-react';
import Button from '../ui/Button';
import { daysLeft, userFacingMessage } from './demoErrors';
import { hasRealSession, useDemoSession } from './demoSession';
import './demo.css';

const ROLE_LABEL = { ADMIN: 'Company Admin', HR: 'HR Admin', MANAGER: 'Manager', EMPLOYEE: 'Employee' };

/** "Demo Mode" strip on every page of a demo workspace: days left, view-as switch, exit and subscribe. */
export default function DemoBanner({ demo }) {
  const navigate = useNavigate();
  const { enterDemo, exitDemo } = useDemoSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const canExit = hasRealSession();
  const left = daysLeft(demo.expiresAt);

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(userFacingMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const switchRole = (role) => run(async () => { await enterDemo(role); navigate('/dashboard', { replace: true }); });
  const leave = (to) => run(async () => { await exitDemo(); navigate(to, { replace: true }); });

  return (
    <div className="hz-demo-banner" role="region" aria-label="Demo mode">
      <span className="hz-demo-banner__badge"><FlaskConical size={14} aria-hidden="true" /> Demo Mode</span>
      <p className="hz-demo-banner__text">
        Sample data only.{left !== null && <> Demo ends in <strong>{left === 1 ? '1 day' : `${left} days`}</strong>.</>}
      </p>
      <label className="hz-demo-banner__view">
        <span>View as</span>
        <select className="form-select form-select-sm" value={demo.viewingAs || 'ADMIN'} onChange={(e) => switchRole(e.target.value)} disabled={busy} aria-label="View the demo as">
          {(demo.roles || Object.keys(ROLE_LABEL)).map((role) => <option key={role} value={role}>{ROLE_LABEL[role] || role}</option>)}
        </select>
      </label>
      {canExit && (
        <div className="hz-demo-banner__actions">
          <Button variant="secondary" size="sm" icon={LogOut} onClick={() => leave('/onboarding')} disabled={busy}>Exit demo</Button>
          <Button size="sm" icon={ArrowRight} onClick={() => leave('/billing')} disabled={busy}>Subscribe</Button>
        </div>
      )}
      {error && <p className="hz-demo-banner__error" role="alert">{error}</p>}
    </div>
  );
}

/** Replaces every page once the demo period is over. */
export function DemoEndedScreen() {
  const navigate = useNavigate();
  const { exitDemo } = useDemoSession();
  const canExit = hasRealSession();
  return (
    <section className="hz-demo-ended" aria-labelledby="hz-demo-ended-title">
      <span className="hz-demo-ended__icon" aria-hidden="true"><FlaskConical size={24} /></span>
      <h1 id="hz-demo-ended-title">Your demo has ended</h1>
      <p>The sample workspace is being removed. Subscribe to keep using Vettri HRMS with your own organization.</p>
      {canExit && (
        <div className="d-flex gap-2 justify-content-center flex-wrap">
          <Button variant="secondary" onClick={async () => { await exitDemo(); navigate('/onboarding', { replace: true }); }}>Back to my company</Button>
          <Button onClick={async () => { await exitDemo(); navigate('/billing', { replace: true }); }}>Subscribe</Button>
        </div>
      )}
    </section>
  );
}
