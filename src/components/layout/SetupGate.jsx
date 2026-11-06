import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Rocket } from 'lucide-react';
import { homeApi } from '../../api/endpoints/home';
import { useDemoSession } from './demoSession';
import { useAuth } from '../../hooks/useAuth';
import Dialog from '../ui/Dialog';
import Button from '../ui/Button';
import './setup-gate.css';

// Required workspace setup comes from GET /api/home/setup (locked = a required step is still open).
// Admins are reminded once per sign-in with a popup they can skip; nothing is blocked.
const SKIP_KEY = 'vettri.setupPrompt.skipped';

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
  const incomplete = !platformStaff && setup?.locked === true;
  return { setup, incomplete, refetch: query.refetch };
}

function readSkipped(userId) {
  try { return sessionStorage.getItem(SKIP_KEY) === String(userId); } catch { return false; }
}

function rememberSkipped(userId) {
  try { sessionStorage.setItem(SKIP_KEY, String(userId)); } catch { /* storage blocked: the popup just shows again */ }
}

function requiredSteps(setup) {
  return (setup?.steps || []).filter((step) => step.required);
}

function ProgressRing({ percent, small = false }) {
  return (
    <div className={`hz-setup-ring${small ? ' hz-setup-ring--sm' : ''}`} style={{ '--hz-setup-pct': `${percent * 3.6}deg` }} role="img" aria-label={`${percent}% of required setup complete`}>
      <div className="hz-setup-ring__inner">
        <strong>{percent}%</strong>
        <span>complete</span>
      </div>
    </div>
  );
}

/** Popup shown after sign-in while required setup is incomplete. "Skip for now" hides it until the next sign-in. */
export function SetupPrompt({ setup, userId, demoAvailable = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { enterDemo } = useDemoSession();
  const [openingDemo, setOpeningDemo] = useState(false);
  const [demoError, setDemoError] = useState(null);
  const [open, setOpen] = useState(() => !readSkipped(userId));
  const steps = requiredSteps(setup);
  const left = steps.filter((step) => !step.done);

  function skip() {
    rememberSkipped(userId);
    setOpen(false);
  }

  function setUpNow() {
    rememberSkipped(userId);
    setOpen(false);
    navigate('/onboarding');
  }

  async function openDemo() {
    setOpeningDemo(true);
    setDemoError(null);
    try {
      await enterDemo('ADMIN');
      rememberSkipped(userId);
      setOpen(false);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setDemoError(err?.response?.data?.message || 'Couldn’t open the demo workspace. Please try again.');
    } finally {
      setOpeningDemo(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={skip}
      title="Complete your workspace details"
      description={`Finish setting up ${user?.companyName || 'your company'} so your HR team and managers can start using Vettri.`}
      size="md"
      footer={(
        <div className="d-flex justify-content-end gap-2 w-100">
          {demoAvailable && <Button variant="ghost" className="me-auto" onClick={openDemo} loading={openingDemo}>Open demo workspace</Button>}
          <Button variant="secondary" onClick={skip}>Skip for now</Button>
          <Button icon={ArrowRight} onClick={setUpNow}>Set up now</Button>
        </div>
      )}
    >
      <div className="hz-setup-prompt">
        <ProgressRing percent={setup?.percent ?? 0} small />
        <div className="hz-setup-prompt__body">
          <strong>{left.length === 1 ? '1 step left' : `${left.length} steps left`}</strong>
          <ul>
            {steps.map((step) => (
              <li key={step.key} className={step.done ? 'is-done' : ''}>
                <span className="hz-setup-prompt__tick" aria-hidden="true">{step.done && <Check size={12} strokeWidth={3} />}</span>
                {step.title}
                {step.done && <span className="visually-hidden"> (done)</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {demoError && <div className="alert alert-danger mt-3 mb-0" role="alert">{demoError}</div>}
    </Dialog>
  );
}

/** Workspace Setup page while required steps are open: progress ring, the required steps and what comes after. */
export function SetupProgressScreen({ setup }) {
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
          <p className="hz-setup-lock__eyebrow"><Rocket size={13} aria-hidden="true" /> Workspace setup</p>
          <h1 id="hz-setup-lock-title">Set up {user?.companyName || 'your workspace'}</h1>
          <p>
            Complete {left === 1 ? 'the last step' : `the ${left} steps`} below. Once your company details, structure and
            HR team are in place, HR and managers take care of employees, attendance, leave and payroll.
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
          Later, usually by HR: {later.map((step) => step.title.toLowerCase()).join(', ')}.
        </p>
      )}
    </section>
  );
}
