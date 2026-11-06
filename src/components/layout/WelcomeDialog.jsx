import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Building2, Check, Loader2, Sparkles } from 'lucide-react';
import Dialog from '../ui/Dialog';
import { demoSandboxApi } from '../../api/endpoints/demoSandbox';
import { userFacingMessage } from './demoErrors';
import { useDemoSession } from './demoSession';
import './demo.css';

// Shown while the demo workspace is being seeded (the request itself is one call; these pace the wait).
export const DEMO_STEPS = [
  'Creating organization…',
  'Creating departments and designations…',
  'Creating employees…',
  'Generating attendance records…',
  'Adding leave, expenses and payroll…',
  'Preparing dashboard…',
];

/**
 * First sign-in of a Company Admin / HR Admin whose company has not chosen how to start:
 * set up the real organisation, or explore a separate demo workspace full of sample data.
 * The choice is stored on the server, so this does not come back once made.
 */
export default function WelcomeDialog({ companyName }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enterDemo } = useDemoSession();
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [error, setError] = useState(null);

  const chooseSetup = useMutation({
    mutationFn: () => demoSandboxApi.choose('SETUP'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demo-sandbox'] });
      setOpen(false);
      navigate('/onboarding');
    },
    onError: (err) => setError(userFacingMessage(err)),
  });

  const exploreDemo = useMutation({
    mutationFn: async () => {
      await demoSandboxApi.create();
      setStep(DEMO_STEPS.length);
      await enterDemo('ADMIN');
    },
    onSuccess: () => navigate('/dashboard', { replace: true }),
    onError: (err) => setError(userFacingMessage(err)),
  });

  const generating = exploreDemo.isPending;
  useEffect(() => {
    if (!generating) return undefined;
    const timer = setInterval(() => setStep((current) => Math.min(current + 1, DEMO_STEPS.length - 1)), 2200);
    return () => clearInterval(timer);
  }, [generating]);

  function start(kind) {
    setError(null);
    setStep(0);
    if (kind === 'demo') exploreDemo.mutate();
    else chooseSetup.mutate();
  }

  return (
    <Dialog
      open={open}
      onClose={() => { if (!generating) setOpen(false); }}
      title={generating ? 'Preparing your demo workspace' : 'Welcome to Vettri HRMS!'}
      description={generating ? 'This takes about a minute. Please keep this tab open.' : 'How would you like to get started? Set up your organization or explore Vettri HRMS with realistic demo data.'}
      size="lg"
    >
      {generating ? (
        <ol className="hz-demo-progress" aria-live="polite">
          {DEMO_STEPS.map((label, index) => (
            <li key={label} className={index < step ? 'is-done' : index === step ? 'is-active' : ''}>
              <span className="hz-demo-progress__icon" aria-hidden="true">
                {index < step ? <Check size={13} strokeWidth={3} /> : index === step ? <Loader2 size={14} className="hz-demo-spin" /> : null}
              </span>
              {label}
            </li>
          ))}
        </ol>
      ) : (
        <>
          <div className="hz-welcome-choices">
            <button type="button" className="hz-welcome-choice" onClick={() => start('setup')} disabled={chooseSetup.isPending}>
              <span className="hz-welcome-choice__icon" aria-hidden="true"><Building2 size={22} /></span>
              <strong>Set Up My Organization</strong>
              <span>Enter {companyName || 'your company'}&rsquo;s real details: company profile, departments, designations, locations and your HR team.</span>
            </button>
            <button type="button" className="hz-welcome-choice hz-welcome-choice--demo" onClick={() => start('demo')}>
              <span className="hz-welcome-choice__icon" aria-hidden="true"><Sparkles size={22} /></span>
              <strong>Explore with Demo Data</strong>
              <span>Open a separate demo workspace with 40 sample employees, attendance, leave, payroll and more. Your real company stays empty.</span>
            </button>
          </div>
          {error && <div className="alert alert-danger mt-3 mb-0" role="alert">{error}</div>}
        </>
      )}
    </Dialog>
  );
}
