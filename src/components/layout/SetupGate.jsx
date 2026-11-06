import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Lock, Rocket } from 'lucide-react';
import { homeApi } from '../../api/endpoints/home';
import { useAuth } from '../../hooks/useAuth';
import './setup-gate.css';

// While required workspace setup is open (GET /api/home/setup -> locked), admins
// can only reach the pages that finish it plus their own account pages.
const ALWAYS_OPEN_PATHS = [
  '/onboarding', '/settings/organization', '/organization/structure', '/settings/leave', '/settings/users',
  '/settings/shifts', '/attendance/devices', '/my-profile', '/account/security', '/settings/preferences',
  '/settings/sign-in', '/billing', '/billing/invoices', '/privacy', '/privacy/accept', '/notifications', '/support',
];

export function useWorkspaceSetup() {
  const { user, selectedCompanyId } = useAuth();
  const platformStaff = !!user?.roles?.includes('SUPER_ADMIN');
  const query = useQuery({
    queryKey: ['home-setup'],
    queryFn: homeApi.setup,
    enabled: !!user && !(platformStaff && !selectedCompanyId),
    staleTime: 15_000,
  });
  const setup = query.data;
  const locked = !platformStaff && setup?.locked === true;
  return { setup, locked, refetch: query.refetch };
}

export function isOpenDuringSetup(path, setup) {
  const pathname = String(path || '').split('?')[0];
  const stepLinks = (setup?.steps || []).filter((step) => step.required).map((step) => step.link);
  return [...ALWAYS_OPEN_PATHS, ...stepLinks].some((open) => pathname === open || pathname.startsWith(`${open}/`));
}

function requiredSteps(setup) {
  return (setup?.steps || []).filter((step) => step.required);
}

function ProgressRing({ percent }) {
  return (
    <div className="hz-setup-ring" style={{ '--hz-setup-pct': `${percent * 3.6}deg` }} role="img" aria-label={`${percent}% of required setup complete`}>
      <div className="hz-setup-ring__inner">
        <strong>{percent}%</strong>
        <span>complete</span>
      </div>
    </div>
  );
}

/** Shown instead of a locked page until every required setup step is done. */
export function SetupLockedScreen({ setup }) {
  const { user } = useAuth();
  const steps = requiredSteps(setup);
  const next = steps.find((step) => !step.done);
  const left = steps.length - steps.filter((step) => step.done).length;
  const later = (setup?.steps || []).filter((step) => !step.required);

  return (
    <section className="hz-setup-lock" aria-labelledby="hz-setup-lock-title">
      <div className="hz-setup-lock__hero">
        <ProgressRing percent={setup?.percent ?? 0} />
        <div className="hz-setup-lock__intro">
          <p className="hz-setup-lock__eyebrow"><Lock size={13} aria-hidden="true" /> Finish setup to unlock</p>
          <h1 id="hz-setup-lock-title">Set up {user?.companyName || 'your workspace'}</h1>
          <p>
            Complete {left === 1 ? 'the last required step' : `the ${left} required steps`} below. Attendance, leave, payroll
            and every other section unlock as soon as setup reaches 100%.
          </p>
          {next && (
            <Link to={next.link} className="btn btn-primary d-inline-flex align-items-center gap-2">
              Continue: {next.title} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>

      <ol className="hz-setup-lock__steps">
        {steps.map((step, index) => (
          <li key={step.key} className={step.done ? 'is-done' : ''}>
            <span className="hz-setup-lock__tick" aria-hidden="true">{step.done ? <Check size={14} strokeWidth={3} /> : index + 1}</span>
            <div className="hz-setup-lock__copy">
              <strong>{step.title}</strong>
              <span>{step.detail}</span>
            </div>
            {step.done
              ? <span className="hz-setup-lock__state">Done</span>
              : <Link to={step.link} className="btn btn-sm btn-outline-primary">Set up</Link>}
          </li>
        ))}
      </ol>

      {later.length > 0 && (
        <p className="hz-setup-lock__later">
          After unlocking: {later.map((step) => step.title.toLowerCase()).join(', ')}.
        </p>
      )}
    </section>
  );
}

/** Slim progress strip on the pages that stay open during setup. */
export function SetupProgressBanner({ setup }) {
  const steps = requiredSteps(setup);
  const left = steps.length - steps.filter((step) => step.done).length;
  const percent = setup?.percent ?? 0;
  return (
    <div className="hz-setup-banner" role="status">
      <Rocket size={16} aria-hidden="true" className="hz-setup-banner__icon" />
      <div className="hz-setup-banner__body">
        <div className="hz-setup-banner__text">
          <strong>Workspace setup {percent}%</strong>
          <span>{left === 1 ? '1 required step left' : `${left} required steps left`} to unlock every section</span>
        </div>
        <div className="hz-setup-banner__bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Required setup progress">
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>
      <Link to="/onboarding" className="hz-setup-banner__link">View steps</Link>
    </div>
  );
}
