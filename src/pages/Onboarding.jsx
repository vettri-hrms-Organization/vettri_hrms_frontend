import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Building2, CalendarDays, CalendarRange, Check, Clock3, Network, PlayCircle, ShieldCheck, Users, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { SkeletonText } from '../components/ui/Skeleton';
import { homeApi } from '../api/endpoints/home';

// Progress comes from the server (GET /api/home/setup) so this page and the home checklist always agree.
const ICONS = {
  company: Building2, departments: Network, employees: Users, leave: CalendarDays, holidays: CalendarRange,
  attendance: Clock3, salary: Wallet, team: ShieldCheck, payroll: PlayCircle,
};

export default function Onboarding() {
  const { data, isLoading } = useQuery({ queryKey: ['home-setup'], queryFn: homeApi.setup });
  const steps = data?.steps || [];
  const [activeStep, setActiveStep] = useState(0);

  // Open on the first step that still needs doing.
  useEffect(() => {
    const firstOpen = steps.findIndex((s) => !s.done);
    if (firstOpen >= 0) setActiveStep(firstOpen);
  }, [steps.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <Card><SkeletonText lines={6} /></Card>;
  if (!steps.length) {
    return (
      <div className="hz-onboarding d-flex flex-column gap-4">
        <PageHeader eyebrow="Workspace setup" title="Set up your Vettri workspace" description="Only workspace admins can see setup progress." />
      </div>
    );
  }

  const done = steps.filter((s) => s.done).length;
  const step = steps[activeStep] || steps[0];
  const StepIcon = ICONS[step.key] || Check;

  return (
    <div className="hz-onboarding d-flex flex-column gap-4">
      <PageHeader
        eyebrow="Workspace setup"
        title={done === steps.length ? 'Your workspace is ready' : 'Set up your Vettri workspace'}
        description={done === steps.length
          ? 'Every setup step is complete. You can come back here any time.'
          : `${done} of ${steps.length} steps done. Each one takes a few minutes.`}
      />

      <div className="row g-4 align-items-start">
        <div className="col-12 col-lg-4">
          <Card title="Setup steps" subtitle="Done steps are ticked automatically">
            <div className="hz-onboarding-steps">
              {steps.map((item, index) => {
                const Icon = ICONS[item.key] || Check;
                return (
                  <button
                    type="button"
                    key={item.key}
                    className={`hz-onboarding-step ${activeStep === index ? 'hz-onboarding-step--active' : ''}`}
                    onClick={() => setActiveStep(index)}
                  >
                    <span className="hz-onboarding-step__number">{item.done ? <Check size={13} strokeWidth={2.5} aria-label="Completed" /> : index + 1}</span>
                    <Icon size={16} />
                    <span>{item.title}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="col-12 col-lg-8">
          <Card className="hz-onboarding-focus">
            <div className="hz-onboarding-focus__icon"><StepIcon size={24} /></div>
            <p className="hz-page-header__eyebrow">Step {activeStep + 1} of {steps.length}{step.done ? ' · Done' : ''}</p>
            <h2>{step.title}</h2>
            <p>{step.detail}</p>
            <Link to={step.link} className="text-decoration-none">
              <Button icon={ArrowRight} variant={step.done ? 'secondary' : 'primary'}>{step.done ? 'Review' : 'Do this now'}</Button>
            </Link>
            <div className="hz-onboarding-focus__footer">
              <button type="button" className="btn btn-link p-0" disabled={activeStep === 0} onClick={() => setActiveStep((value) => value - 1)}>Previous</button>
              <button type="button" className="btn btn-link p-0" disabled={activeStep === steps.length - 1} onClick={() => setActiveStep((value) => value + 1)}>Next step</button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
