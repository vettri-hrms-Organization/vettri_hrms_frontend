import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BadgeCheck, Briefcase, Building2, Check, Eye, EyeOff, Globe2, LockKeyhole, Mail, Minus, MonitorCheck, Plus, ShieldCheck, Sparkles, UserRound, Users, Wallet } from 'lucide-react';
import Logo from '../components/brand/Logo';
import { API_BASE_URL, resetSessionExpirationHandling } from '../api/axiosClient';
import { tokenStorage } from '../auth/tokenStorage';
import { userFacingError } from '../utils/userFacingError';

const steps = ['Account', 'Organization', 'Workspace'];
const industries = ['Technology', 'Manufacturing', 'Retail', 'Healthcare', 'Education', 'Finance', 'Professional Services', 'Other'];
const companySizes = ['1-25', '26-50', '51-100', '101-250', '251-500', '500+'];
const interests = ['HR & employee management', 'Attendance & leave', 'Payroll', 'Assets', 'Devices', 'Software management', 'Remote support'];
const planOptions = [
  { value: 'STARTER', label: 'Starter', price: '\u20B9199 / employee / month' },
  { value: 'BUSINESS', label: 'Business', price: '\u20B9199 / employee / month' },
  { value: 'ENTERPRISE', label: 'Enterprise', price: '\u20B9199 / employee / month' },
];

const billingConfig = {
  MONTHLY: { label: 'Monthly', rate: 199, unit: 'month', detail: '\u20B9199 / employee / month', periodsPerYear: 12 },
  QUARTERLY: { label: 'Quarterly', rate: 537, unit: 'quarter', detail: '\u20B9537 / employee / quarter', periodsPerYear: 4 },
  ANNUAL: { label: 'Annual', rate: 2148, unit: 'year', detail: '\u20B92,148 / employee / year', periodsPerYear: 1 },
};

const billingCycles = [
  { value: 'MONTHLY', label: 'Monthly', subtitle: 'Best for new teams' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL', label: 'Annual' },
];

const initialForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  role: '',
  organizationName: '',
  industry: '',
  companySize: '',
  country: 'India',
  interests: [],
  plan: 'TRIAL',
  billingCycle: 'MONTHLY',
  employeeCount: 25,
  acceptTerms: false,
  acceptDpa: false,
};

const LEGAL_URLS = {
  terms: 'https://vettrihrms.in/terms',
  privacy: 'https://vettrihrms.in/privacy',
  dpa: 'https://vettrihrms.in/dpa',
};

const getSubscriptionTotal = (employeeCount, billingCycle) => {
  const rate = billingConfig[billingCycle]?.rate ?? billingConfig.MONTHLY.rate;
  return Math.max(1, Math.floor(Number(employeeCount) || 1)) * rate;
};

const getFutureBillingText = (employeeCount, billingCycle) => {
  const total = getSubscriptionTotal(employeeCount, billingCycle);
  const unitLabel = billingConfig[billingCycle]?.unit ?? 'month';
  return `\u20B9${total.toLocaleString('en-IN')}/${unitLabel}`;
};

const getPerEmployeeRate = (billingCycle) => billingConfig[billingCycle]?.rate ?? billingConfig.MONTHLY.rate;

const getSavingsLabel = (billingCycle) => {
  const config = billingConfig[billingCycle];
  if (!config || billingCycle === 'MONTHLY') return '';
  const monthlyBaseline = billingConfig.MONTHLY.rate * billingConfig.MONTHLY.periodsPerYear;
  const annualizedRate = config.rate * config.periodsPerYear;
  const savingsPercent = Math.round((1 - annualizedRate / monthlyBaseline) * 100);
  return savingsPercent > 0 ? `Save ${savingsPercent}%` : '';
};

function passwordScore(password) {
  if (!password) return 0;
  return Math.min(
    (password.length >= 8 ? 1 : 0) +
      (/[A-Z]/.test(password) ? 1 : 0) +
      (/[0-9]/.test(password) ? 1 : 0) +
      (/[^A-Za-z0-9]/.test(password) ? 1 : 0),
    4
  );
}

export default function Signup() {
  const [searchParams] = useSearchParams();
  const selectedPlanFromUrl = searchParams.get('plan') || 'TRIAL';
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ ...initialForm, plan: ['TRIAL', ...planOptions.map((option) => option.value)].includes(selectedPlanFromUrl.toUpperCase()) ? selectedPlanFromUrl.toUpperCase() : 'TRIAL' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const selectedPlan = useMemo(() => planOptions.find((option) => option.value === form.plan) || planOptions[0], [form.plan]);
  const isPaidPlan = ['STARTER', 'BUSINESS', 'ENTERPRISE'].includes(form.plan);
  const isTrialSignup = form.plan === 'TRIAL';
  const hasPaymentFlow = isTrialSignup || isPaidPlan;

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  };

  const validate = () => {
    const nextErrors = {};
    if (step === 1) {
      if (!form.firstName.trim()) nextErrors.firstName = 'Enter your first name.';
      if (!form.lastName.trim()) nextErrors.lastName = 'Enter your last name.';
      if (!/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = 'Enter a valid work email.';
      if (passwordScore(form.password) < 3) nextErrors.password = 'Use 8+ characters with an uppercase letter and number.';
    }
    if (step === 2) {
      if (!form.organizationName.trim()) nextErrors.organizationName = 'Enter your organization name.';
      if (!form.industry) nextErrors.industry = 'Select an industry.';
      if (!form.companySize) nextErrors.companySize = 'Select your company size.';
      if (!form.country.trim()) nextErrors.country = 'Enter your country.';
    }
    if (step === 3) {
      if (!form.acceptTerms) nextErrors.acceptTerms = 'Please agree to the Terms of Service and Privacy Policy.';
      if (!form.acceptDpa) nextErrors.acceptDpa = 'Please accept the Data Processing Agreement for your organization.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const createWorkspace = async () => {
    if (!validate() || submitting) return;
    setSubmitting(true);
    setErrors({});
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
          role: form.role,
          organizationName: form.organizationName,
          industry: form.industry,
          companySize: form.companySize,
          country: form.country,
          interests: form.interests,
          plan: form.plan,
          acceptTerms: form.acceptTerms,
          acceptDpa: form.acceptDpa,
          ...(hasPaymentFlow ? { billingCycle: form.billingCycle, employeeCount: form.employeeCount } : {}),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(userFacingError({ response: { status: response.status, data: result } }));

      if (result.requiresPayment) {
        const orderResponse = await fetch(`${API_BASE_URL}/api/billing/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId: result.companyId, userId: result.userId, plan: result.plan, billingCycle: form.billingCycle, employeeCount: form.employeeCount, customerName: `${form.firstName} ${form.lastName}`.trim(), customerEmail: form.email, organizationName: form.organizationName }),
        });
        const order = await orderResponse.json().catch(() => ({}));
        if (!orderResponse.ok) throw new Error(userFacingError({ response: { status: orderResponse.status, data: order } }));

        const options = {
          key: order.key,
          amount: order.amount,
          currency: order.currency,
          name: 'Vettri HRMS',
          description: `${order.plan} plan`,
          order_id: order.orderId,
          handler: async function (paymentResponse) {
            try {
              setSubmitting(true);
              const verificationResponse = await fetch(`${API_BASE_URL}/api/billing/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  companyId: result.companyId,
                  userId: result.userId,
                  plan: result.plan,
                  billingCycle: form.billingCycle,
                  employeeCount: form.employeeCount,
                  razorpayPaymentId: paymentResponse.razorpay_payment_id,
                  razorpayOrderId: paymentResponse.razorpay_order_id,
                  razorpaySignature: paymentResponse.razorpay_signature,
                }),
              });
              const verification = await verificationResponse.json().catch(() => ({}));
              if (!verificationResponse.ok) throw new Error(userFacingError({ response: { status: verificationResponse.status, data: verification } }));

              const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: form.email, password: form.password }),
              });
              const loginResult = await loginResponse.json().catch(() => ({}));
              if (!loginResponse.ok) throw new Error(userFacingError({ response: { status: loginResponse.status, data: loginResult } }));
              tokenStorage.setTokens(loginResult.accessToken || loginResult.token, loginResult.refreshToken);
              resetSessionExpirationHandling();
              window.location.assign('/onboarding');
            } catch (error) {
              setErrors({ submit: error instanceof TypeError ? 'Unable to reach Vettri. Check your connection and try again.' : error.message });
              setSubmitting(false);
            }
          },
          modal: {
            ondismiss: () => {
              setSubmitting(false);
              setErrors({ submit: 'Payment was cancelled before completion.' });
            },
          },
          prefill: { name: `${form.firstName} ${form.lastName}`.trim(), email: form.email },
          theme: { color: '#4169E1' },
        };

        const razorpayScript = document.createElement('script');
        razorpayScript.src = 'https://checkout.razorpay.com/v1/checkout.js';
        razorpayScript.async = true;
        razorpayScript.onload = () => {
          const razorpayInstance = new window.Razorpay(options);
          razorpayInstance.on('payment.failed', (response) => {
            setErrors({ submit: response.error?.description || 'Razorpay could not complete the payment.' });
            setSubmitting(false);
          });
          razorpayInstance.open();
          setSubmitting(false);
        };
        razorpayScript.onerror = () => {
          setErrors({ submit: 'Unable to load Razorpay checkout.' });
          setSubmitting(false);
        };
        document.body.appendChild(razorpayScript);
        return;
      }

      tokenStorage.setTokens(result.accessToken || result.token, result.refreshToken);
      resetSessionExpirationHandling();
      window.location.assign('/onboarding');
    } catch (error) {
      setErrors({ submit: error instanceof TypeError ? 'Unable to reach Vettri. Check your connection and try again.' : error.message });
      setSubmitting(false);
    }
  };

  const stepMeta = [
    { title: 'Create your account', subtitle: 'Your login for Vettri. Takes under a minute.', icon: UserRound },
    { title: 'About your organization', subtitle: 'We tailor the workspace, leave policies and payroll defaults to you.', icon: Building2 },
    { title: 'Set up your workspace', subtitle: 'Choose billing and team size. You can change both any time.', icon: Sparkles },
  ][step - 1];
  const StepIcon = stepMeta.icon;
  const progress = ((step - 1) / (steps.length - 1)) * 100;

  return (
    <main className="su-page">
      <div className="su-mesh" aria-hidden="true"><i /><i /><i /><i /></div>

      <aside className="su-showcase" aria-label="About Vettri HRMS">
        <div className="su-showcase__grid" aria-hidden="true" />
        <div className="su-showcase__inner">
          <Link to="/" className="su-brand" aria-label="Vettri HRMS home">
            <img src="/brand/vettri-logo-full-transparent.png" alt="Vettri HRMS" />
          </Link>

          <div className="su-pitch">
            <p className="su-pill"><span>New</span> HR and IT in one platform</p>
            <h1>Run your people and their devices <span className="su-gtext">from one place.</span></h1>
            <p className="su-lead">Employees, attendance, leave, payroll, hiring and every company laptop, set up in minutes.</p>

            <ul className="su-benefits">
              <li><span className="su-benefit-icon su-tone-blue"><Users size={17} /></span><div><b>Every employee record</b><small>Profiles, documents, org chart</small></div></li>
              <li><span className="su-benefit-icon su-tone-violet"><Wallet size={17} /></span><div><b>Payroll with PF, ESI, PT and TDS</b><small>Payslips, Form 16, bank file</small></div></li>
              <li><span className="su-benefit-icon su-tone-cyan"><MonitorCheck size={17} /></span><div><b>IT management built in</b><small>Devices, software, remote support</small></div></li>
            </ul>
          </div>

          <div className="su-widgets" aria-hidden="true">
            <div className="su-glass su-glass--payroll">
              <div className="su-glass__head"><span>October payroll</span><em>Processed</em></div>
              <strong>₹6,84,200</strong>
              <div className="su-bars">{[42, 58, 50, 66, 61, 78, 72].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
            </div>
            <div className="su-glass su-glass--toast">
              <span className="su-glass__icon su-tone-green"><BadgeCheck size={18} /></span>
              <div><b>Leave approved</b><small>Balance updated automatically</small></div>
            </div>
            <div className="su-glass su-glass--team">
              <div className="su-avatars">{['AR', 'PN', 'KS', 'MR'].map((a) => <span key={a}>{a}</span>)}</div>
              <div><b>42 of 48 checked in</b><small>Today, live</small></div>
            </div>
          </div>

          <div className="su-showcase__footer">
            <span><ShieldCheck size={15} /> Role-based access &amp; audit logs</span>
            <span>© {new Date().getFullYear()} Vettri HRMS</span>
          </div>
        </div>
      </aside>

      <section className="su-main">
        <div className="su-wrap">
          <header className="su-topbar">
            <Link to="/" className="su-topbar__logo" aria-label="Vettri HRMS home"><Logo size={28} /></Link>
            <span>Already have an account? <Link to="/login">Sign in</Link></span>
          </header>

          <nav className="su-steps" aria-label="Signup progress">
            <div className="su-steps__track" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
            {steps.map((label, index) => {
              const number = index + 1;
              const state = number < step ? 'done' : number === step ? 'current' : 'todo';
              return (
                <div className={`su-step su-step--${state}`} key={label} aria-current={state === 'current' ? 'step' : undefined}>
                  <span className="su-step__dot">{state === 'done' ? <Check size={14} strokeWidth={3} /> : number}</span>
                  <span className="su-step__label">{label}</span>
                </div>
              );
            })}
          </nav>

          <div className="su-card">
            <div className="su-card__head" key={`head-${step}`}>
              <span className="su-card__icon"><StepIcon size={20} /></span>
              <div>
                <p className="su-kicker">Step {step} of {steps.length}</p>
                <h2>{stepMeta.title}</h2>
                <p className="su-muted">{stepMeta.subtitle}</p>
              </div>
            </div>

            <div className="su-step-body" key={`body-${step}`}>
              {step === 1 && <AccountFields form={form} errors={errors} showPassword={showPassword} setShowPassword={setShowPassword} update={update} />}
              {step === 2 && <OrganizationFields form={form} errors={errors} update={update} />}
              {step === 3 && (
                <div className="su-checkout">
                  <div className="su-plan">
                    <div>
                      <span className="su-plan__badge">{isTrialSignup ? 'Free trial' : 'Plan'}</span>
                      <strong>{isTrialSignup ? 'Every feature, free to start' : selectedPlan.label}</strong>
                      <small>{isTrialSignup ? 'Verify with ₹1 through Razorpay, then explore everything.' : 'Complete HR, payroll and IT platform'}</small>
                    </div>
                    <span className="su-plan__price">{isTrialSignup ? '₹1' : `₹${getPerEmployeeRate(form.billingCycle)}`}</span>
                  </div>

                  {hasPaymentFlow && (
                    <div className="su-block">
                      <p className="su-label">Billing cycle</p>
                      <div className="su-cycles" role="radiogroup" aria-label="Billing cycle">
                        {billingCycles.map((cycle) => {
                          const selected = form.billingCycle === cycle.value;
                          const savingsLabel = getSavingsLabel(cycle.value);
                          return (
                            <button key={cycle.value} type="button" role="radio" aria-checked={selected}
                              className={`su-cycle ${selected ? 'is-selected' : ''}`} onClick={() => update('billingCycle', cycle.value)}>
                              <span className="su-cycle__top"><b>{cycle.label}</b>{savingsLabel && <em>{savingsLabel}</em>}</span>
                              <span className="su-cycle__rate">₹{billingConfig[cycle.value].rate.toLocaleString('en-IN')}</span>
                              <span className="su-cycle__unit">per employee / {billingConfig[cycle.value].unit}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {hasPaymentFlow && (
                    <div className="su-block">
                      <p className="su-label">How many employees?</p>
                      <div className="su-counter">
                        <button type="button" onClick={() => update('employeeCount', Math.max(1, form.employeeCount - 1))} aria-label="Decrease employee count" disabled={form.employeeCount <= 1}><Minus size={18} /></button>
                        <div className="su-counter__value"><strong>{form.employeeCount}</strong><span>employees</span></div>
                        <button type="button" onClick={() => update('employeeCount', Math.max(1, Number(form.employeeCount) + 1))} aria-label="Increase employee count"><Plus size={18} /></button>
                      </div>
                      <input className="su-range" type="range" min="1" max="500" value={Math.min(500, form.employeeCount)}
                        onChange={(event) => update('employeeCount', Number(event.target.value))} aria-label="Employee count"
                        style={{ '--su-fill': `${(Math.min(500, form.employeeCount) / 500) * 100}%` }} />
                    </div>
                  )}

                  {hasPaymentFlow && (
                    <div className="su-summary">
                      <div className="su-summary__row"><span>{form.employeeCount} employees × ₹{getPerEmployeeRate(form.billingCycle)}</span><strong>{getFutureBillingText(form.employeeCount, form.billingCycle)}</strong></div>
                      <div className="su-summary__row su-summary__row--muted"><span>Verification today</span><strong>₹1</strong></div>
                      <div className="su-summary__total"><span>After your trial</span><strong>{getFutureBillingText(form.employeeCount, form.billingCycle)}</strong></div>
                      <p>No charge beyond ₹1 today. Cancel any time before the trial ends.</p>
                    </div>
                  )}

                  <div className="su-legal">
                    <label className={`su-check ${errors.acceptTerms ? 'has-error' : ''}`}>
                      <input type="checkbox" checked={form.acceptTerms} onChange={(event) => update('acceptTerms', event.target.checked)} aria-invalid={Boolean(errors.acceptTerms)} />
                      <span className="su-check__box" aria-hidden="true"><Check size={12} strokeWidth={3.2} /></span>
                      <span>I agree to the <a href={LEGAL_URLS.terms} target="_blank" rel="noopener noreferrer">Terms of Service</a> and <a href={LEGAL_URLS.privacy} target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</span>
                    </label>
                    {errors.acceptTerms && <small className="su-error">{errors.acceptTerms}</small>}
                    <label className={`su-check ${errors.acceptDpa ? 'has-error' : ''}`}>
                      <input type="checkbox" checked={form.acceptDpa} onChange={(event) => update('acceptDpa', event.target.checked)} aria-invalid={Boolean(errors.acceptDpa)} />
                      <span className="su-check__box" aria-hidden="true"><Check size={12} strokeWidth={3.2} /></span>
                      <span>On behalf of {form.organizationName.trim() || 'my organization'}, I accept the <a href={LEGAL_URLS.dpa} target="_blank" rel="noopener noreferrer">Data Processing Agreement</a>. Vettri processes our employees' data only on our instructions.</span>
                    </label>
                    {errors.acceptDpa && <small className="su-error">{errors.acceptDpa}</small>}
                  </div>
                </div>
              )}
            </div>

            {errors.submit && <p className="su-alert" role="alert">{errors.submit}</p>}

            <div className="su-actions">
              {step > 1 ? (
                <button className="su-back" type="button" onClick={() => setStep((current) => current - 1)} disabled={submitting}>
                  <ArrowLeft size={16} /> Back
                </button>
              ) : <span />}
              {step < 3 ? (
                <button className="su-primary" type="button" onClick={() => validate() && setStep((current) => current + 1)}>
                  Continue <ArrowRight size={17} />
                </button>
              ) : (
                <button className="su-primary" type="button" onClick={createWorkspace} disabled={submitting}>
                  {submitting ? <>Preparing secure checkout <span className="su-spinner" aria-hidden="true" /></> : <>Start free trial <ArrowRight size={17} /></>}
                </button>
              )}
            </div>

            {hasPaymentFlow && (
              <div className="su-trust">
                <span><LockKeyhole size={13} /> Secure checkout by Razorpay</span>
                <span><ShieldCheck size={13} /> ₹1 verification only</span>
              </div>
            )}
          </div>

          <p className="su-footnote">
            {hasPaymentFlow
              ? <>Plan: {isTrialSignup ? 'Starter trial' : selectedPlan.label} · {billingConfig[form.billingCycle]?.label} billing · {form.employeeCount} employees</>
              : 'Your trial starts as soon as your workspace is created.'}
          </p>
        </div>
      </section>

      <style>{styles}</style>
    </main>
  );
}

function Field({ id, label, value, onChange, error, type = 'text', placeholder, icon: Icon, autoComplete }) {
  return (
    <div className={`su-field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="su-input">
        {Icon && <Icon size={17} className="su-input__icon" aria-hidden="true" />}
        <input id={id} type={type} value={value} placeholder={placeholder} autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
      </div>
      {error && <small className="su-error" id={`${id}-error`}>{error}</small>}
    </div>
  );
}

const PASSWORD_RULES = [
  { label: '8+ characters', test: (value) => value.length >= 8 },
  { label: 'Uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { label: 'Number', test: (value) => /[0-9]/.test(value) },
  { label: 'Symbol (recommended)', test: (value) => /[^A-Za-z0-9]/.test(value) },
];
const STRENGTH = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];

function AccountFields({ form, errors, showPassword, setShowPassword, update }) {
  const score = passwordScore(form.password);
  return (
    <div className="su-fields">
      <div className="su-row">
        <Field id="firstName" label="First name" icon={UserRound} autoComplete="given-name" value={form.firstName} error={errors.firstName} onChange={(value) => update('firstName', value)} />
        <Field id="lastName" label="Last name" autoComplete="family-name" value={form.lastName} error={errors.lastName} onChange={(value) => update('lastName', value)} />
      </div>
      <Field id="email" label="Work email" icon={Mail} type="email" autoComplete="email" value={form.email} error={errors.email} onChange={(value) => update('email', value)} placeholder="you@company.com" />
      <div className={`su-field ${errors.password ? 'has-error' : ''}`}>
        <label htmlFor="password">Password</label>
        <div className="su-input">
          <LockKeyhole size={17} className="su-input__icon" aria-hidden="true" />
          <input id="password" type={showPassword ? 'text' : 'password'} value={form.password} autoComplete="new-password"
            onChange={(event) => update('password', event.target.value)} aria-invalid={Boolean(errors.password)} placeholder="Create a strong password" />
          <button type="button" className="su-input__toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        {form.password && (
          <div className="su-strength" aria-live="polite">
            <div className={`su-strength__bars su-strength--${score}`}>{[1, 2, 3, 4].map((n) => <i key={n} className={n <= score ? 'on' : ''} />)}</div>
            <span>{STRENGTH[score]}</span>
          </div>
        )}
        <ul className="su-rules">
          {PASSWORD_RULES.map((rule) => {
            const ok = rule.test(form.password);
            return <li key={rule.label} className={ok ? 'ok' : ''}><Check size={12} strokeWidth={3} /> {rule.label}</li>;
          })}
        </ul>
        {errors.password && <small className="su-error">{errors.password}</small>}
      </div>
      <Field id="role" label="Job role (optional)" icon={Briefcase} value={form.role} onChange={(value) => update('role', value)} placeholder="e.g. People operations" />
    </div>
  );
}

function ChipGroup({ id, label, options, value, error, onChange }) {
  return (
    <div className={`su-field ${error ? 'has-error' : ''}`}>
      <span className="su-field__label" id={`${id}-label`}>{label}</span>
      <div className="su-chips" role="radiogroup" aria-labelledby={`${id}-label`}>
        {options.map((option) => (
          <button type="button" role="radio" aria-checked={value === option} key={option}
            className={`su-chip ${value === option ? 'is-selected' : ''}`} onClick={() => onChange(option)}>
            {value === option && <Check size={13} strokeWidth={3} />}{option}
          </button>
        ))}
      </div>
      {error && <small className="su-error">{error}</small>}
    </div>
  );
}

function OrganizationFields({ form, errors, update }) {
  return (
    <div className="su-fields">
      <Field id="organizationName" label="Organization name" icon={Building2} autoComplete="organization" value={form.organizationName} error={errors.organizationName} onChange={(value) => update('organizationName', value)} placeholder="e.g. Acme Technologies" />
      <ChipGroup id="industry" label="Industry" options={industries} value={form.industry} error={errors.industry} onChange={(value) => update('industry', value)} />
      <ChipGroup id="companySize" label="Company size (employees)" options={companySizes} value={form.companySize} error={errors.companySize} onChange={(value) => update('companySize', value)} />
      <Field id="country" label="Country" icon={Globe2} autoComplete="country-name" value={form.country} error={errors.country} onChange={(value) => update('country', value)} />
    </div>
  );
}

const styles = `
  .su-page {
    --su-ink: #0F172A; --su-muted: #5B6478; --su-line: #E6EAF1; --su-blue: #4169E1;
    --su-grad: linear-gradient(110deg, #4169E1 0%, #6366F1 35%, #8B5CF6 65%, #06B6D4 100%);
    --su-grad-btn: linear-gradient(135deg, #4F74F0 0%, #4169E1 45%, #6366F1 100%);
    --su-hero: linear-gradient(140deg, #1E2A78 0%, #3B3FD8 42%, #7C3AED 78%, #0891B2 120%);
    position: relative; isolation: isolate;
    min-height: calc(100vh / var(--app-zoom, 1));
    display: grid; grid-template-columns: minmax(0, 46fr) minmax(0, 54fr);
    gap: 0; background: #F7F9FC; color: var(--su-ink);
    font-family: var(--hz-font-sans); -webkit-font-smoothing: antialiased;
  }
  .su-page *, .su-page *::before, .su-page *::after { box-sizing: border-box; }

  /* Aurora light behind the form side, same as the marketing hero. */
  .su-mesh { position: fixed; inset: -10% -10% auto 30%; height: 900px; z-index: -1; filter: blur(80px) saturate(130%); opacity: .55; pointer-events: none; }
  .su-mesh i { position: absolute; border-radius: 50%; animation: su-drift 18s ease-in-out infinite alternate; }
  .su-mesh i:nth-child(1) { left: 10%; top: 20px; width: 420px; height: 360px; background: rgba(65,105,225,.38); }
  .su-mesh i:nth-child(2) { left: 45%; top: -40px; width: 460px; height: 340px; background: rgba(139,92,246,.30); animation-delay: -6s; }
  .su-mesh i:nth-child(3) { right: 0; top: 220px; width: 420px; height: 380px; background: rgba(6,182,212,.26); animation-delay: -11s; }
  .su-mesh i:nth-child(4) { left: 30%; top: 460px; width: 360px; height: 260px; background: rgba(236,72,153,.12); animation-delay: -3s; }
  @keyframes su-drift { 50% { transform: translate3d(40px, 30px, 0) scale(1.08); } 100% { transform: translate3d(-30px, 50px, 0) scale(.94); } }

  /* ---------- Showcase (left) ---------- */
  .su-showcase {
    position: sticky; top: 0; height: calc(100vh / var(--app-zoom, 1));
    margin: 14px 0 14px 14px; height: calc(100vh / var(--app-zoom, 1) - 28px);
    border-radius: 28px; overflow: hidden; isolation: isolate; color: #fff;
    background: var(--su-hero); background-size: 180% 180%;
    animation: su-hero 18s ease-in-out infinite alternate;
    box-shadow: 0 40px 80px -40px rgba(79,70,229,.75);
  }
  @keyframes su-hero { to { background-position: 100% 100%; } }
  .su-showcase::before { content: ""; position: absolute; inset: 0; z-index: -1; background:
    radial-gradient(45% 40% at 15% 10%, rgba(255,255,255,.22), transparent 70%),
    radial-gradient(40% 45% at 95% 100%, rgba(6,182,212,.45), transparent 70%); }
  .su-showcase__grid { position: absolute; inset: 0; z-index: -1; background-image: linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px); background-size: 40px 40px; -webkit-mask-image: radial-gradient(70% 60% at 30% 20%, #000, transparent 80%); mask-image: radial-gradient(70% 60% at 30% 20%, #000, transparent 80%); }
  .su-showcase__inner { height: 100%; display: flex; flex-direction: column; padding: clamp(28px, 4vw, 48px); gap: 28px; overflow-y: auto; scrollbar-width: none; }
  .su-brand img { width: 128px; height: auto; display: block; }

  .su-pitch { max-width: 520px; }
  .su-pill { display: inline-flex; align-items: center; gap: 8px; margin: 0 0 18px; padding: 5px 14px 5px 5px; border: 1px solid rgba(255,255,255,.28); border-radius: 999px; background: rgba(255,255,255,.12); backdrop-filter: blur(8px); font-size: 13px; font-weight: 600; }
  .su-pill span { padding: 2px 9px; border-radius: 999px; background: #fff; color: #3B3FD8; font-size: 11.5px; font-weight: 800; }
  .su-pitch h1 { margin: 0; font-family: var(--hz-font-display); font-size: clamp(2.1rem, 3.3vw, 3.3rem); line-height: 1.06; letter-spacing: -.04em; font-weight: 800; color: #fff; }
  .su-gtext { background: linear-gradient(110deg, #C7D2FE 0%, #F0ABFC 45%, #67E8F9 100%); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent; animation: su-g 8s ease-in-out infinite alternate; }
  @keyframes su-g { to { background-position: 100% 50%; } }
  .su-lead { margin: 16px 0 26px; max-width: 460px; color: rgba(224,231,255,.9); font-size: 15.5px; line-height: 1.7; }
  .su-benefits { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
  .su-benefits li { display: flex; align-items: center; gap: 13px; padding: 11px 14px; border: 1px solid rgba(255,255,255,.14); border-radius: 14px; background: rgba(255,255,255,.08); backdrop-filter: blur(10px); }
  .su-benefits b { display: block; font-size: 14px; font-weight: 700; }
  .su-benefits small { color: rgba(224,231,255,.78); font-size: 12.5px; }
  .su-benefit-icon, .su-glass__icon { display: grid; place-items: center; flex: 0 0 36px; width: 36px; height: 36px; border-radius: 11px; color: #fff; box-shadow: 0 10px 22px -10px rgba(0,0,0,.45); }
  .su-tone-blue { background: linear-gradient(135deg, #60A5FA, #4169E1); }
  .su-tone-violet { background: linear-gradient(135deg, #C084FC, #7C3AED); }
  .su-tone-cyan { background: linear-gradient(135deg, #22D3EE, #0891B2); }
  .su-tone-green { background: linear-gradient(135deg, #34D399, #059669); }

  .su-widgets { position: relative; min-height: 210px; margin-top: auto; }
  .su-glass { position: absolute; display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: 1px solid rgba(255,255,255,.7); border-radius: 16px; background: rgba(255,255,255,.86); color: var(--su-ink); backdrop-filter: blur(14px) saturate(160%); box-shadow: 0 24px 50px -22px rgba(15,23,42,.6); animation: su-bob 6s ease-in-out infinite; }
  .su-glass b { display: block; font-size: 14px; }
  .su-glass small { color: var(--su-muted); font-size: 12.5px; }
  .su-glass--payroll { left: 0; top: 0; width: 250px; flex-direction: column; align-items: stretch; gap: 4px; }
  .su-glass__head { display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; color: var(--su-muted); font-weight: 600; }
  .su-glass__head em { font-style: normal; padding: 2px 8px; border-radius: 999px; background: #DCFCE7; color: #047857; font-size: 11px; font-weight: 800; }
  .su-glass--payroll strong { font-size: 22px; letter-spacing: -.02em; }
  .su-bars { display: flex; align-items: flex-end; gap: 6px; height: 46px; margin-top: 6px; }
  .su-bars i { flex: 1; border-radius: 5px 5px 2px 2px; background: var(--su-grad); opacity: .9; }
  .su-glass--toast { right: 0; top: 40px; animation-delay: -2s; }
  .su-glass--team { left: 34%; bottom: 0; animation-delay: -4s; }
  .su-avatars { display: flex; }
  .su-avatars span { display: grid; place-items: center; width: 30px; height: 30px; margin-left: -8px; border: 2px solid #fff; border-radius: 50%; background: var(--su-grad); color: #fff; font-size: 10px; font-weight: 800; }
  .su-avatars span:first-child { margin-left: 0; }
  @keyframes su-bob { 50% { transform: translateY(-9px); } }
  .su-showcase__footer { display: flex; justify-content: space-between; gap: 12px; color: rgba(224,231,255,.75); font-size: 12px; }
  .su-showcase__footer span { display: inline-flex; align-items: center; gap: 7px; }

  /* ---------- Form side ---------- */
  .su-main { min-width: 0; display: flex; justify-content: center; padding: 18px clamp(18px, 4vw, 56px) 40px; }
  .su-wrap { width: 100%; max-width: 640px; }
  .su-topbar { display: flex; align-items: center; justify-content: flex-end; gap: 16px; min-height: 52px; color: var(--su-muted); font-size: 14px; }
  .su-topbar__logo { display: none; margin-right: auto; }
  .su-topbar a { color: var(--su-blue); font-weight: 700; text-decoration: none; }
  .su-topbar a:hover { text-decoration: underline; }

  .su-steps { position: relative; display: grid; grid-template-columns: repeat(3, 1fr); margin: 18px 0 22px; }
  .su-steps__track { position: absolute; left: 16.66%; right: 16.66%; top: 17px; height: 3px; border-radius: 3px; background: #E3E7F0; }
  .su-steps__track span { display: block; height: 100%; border-radius: inherit; background: var(--su-grad); transition: width .5s cubic-bezier(.16,1,.3,1); }
  .su-step { position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
  .su-step__dot { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: #fff; border: 2px solid #E3E7F0; color: var(--su-muted); font-size: 14px; font-weight: 800; transition: all .3s ease; }
  .su-step__label { color: var(--su-muted); font-size: 13px; font-weight: 700; }
  .su-step--current .su-step__dot { border-color: transparent; background: var(--su-grad-btn); color: #fff; box-shadow: 0 0 0 6px rgba(99,102,241,.16), 0 10px 22px -10px rgba(99,102,241,.9); }
  .su-step--current .su-step__label { color: var(--su-ink); }
  .su-step--done .su-step__dot { border-color: transparent; background: linear-gradient(135deg, #34D399, #059669); color: #fff; }

  .su-card { position: relative; padding: clamp(22px, 3.4vw, 36px); border: 1px solid rgba(255,255,255,.8); border-radius: 24px; background: rgba(255,255,255,.88); backdrop-filter: blur(18px) saturate(160%); box-shadow: 0 1px 2px rgba(16,24,40,.04), 0 40px 80px -40px rgba(30,41,99,.35); }
  .su-card::before { content: ""; position: absolute; inset: 0 24px auto; height: 3px; border-radius: 0 0 4px 4px; background: var(--su-grad); }
  .su-card__head { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 24px; animation: su-in .45s cubic-bezier(.16,1,.3,1) both; }
  .su-card__icon { display: grid; place-items: center; flex: 0 0 46px; width: 46px; height: 46px; border-radius: 14px; background: var(--su-grad-btn); color: #fff; box-shadow: 0 12px 26px -12px rgba(99,102,241,.95); }
  .su-kicker { margin: 0 0 4px; background: var(--su-grad); -webkit-background-clip: text; background-clip: text; color: transparent; font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  .su-card h2 { margin: 0; font-family: var(--hz-font-display); font-size: clamp(1.55rem, 2.4vw, 2rem); line-height: 1.15; letter-spacing: -.03em; font-weight: 800; }
  .su-muted { margin: 6px 0 0; color: var(--su-muted); font-size: 14.5px; line-height: 1.6; }
  .su-step-body { animation: su-in .5s cubic-bezier(.16,1,.3,1) both; }
  @keyframes su-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }

  .su-fields { display: grid; gap: 18px; }
  .su-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .su-field label, .su-field__label, .su-label { display: block; margin: 0 0 8px; color: var(--su-ink); font-size: 13.5px; font-weight: 700; }
  .su-input { position: relative; display: flex; align-items: center; border: 1.5px solid var(--su-line); border-radius: 13px; background: #fff; transition: border-color .18s, box-shadow .18s; }
  .su-input:hover { border-color: #CBD3E3; }
  .su-input:focus-within { border-color: #6366F1; box-shadow: 0 0 0 4px rgba(99,102,241,.14); }
  .su-field.has-error .su-input { border-color: #E5484D; box-shadow: 0 0 0 4px rgba(229,72,77,.10); }
  .su-input__icon { flex: 0 0 auto; margin-left: 14px; color: #8A94A8; transition: color .18s; }
  .su-input:focus-within .su-input__icon { color: #6366F1; }
  .su-input input { flex: 1; min-width: 0; height: 52px; padding: 0 14px; border: 0; border-radius: 13px; background: transparent; color: var(--su-ink); font: inherit; font-size: 15px; font-weight: 500; outline: none; }
  .su-input__icon + input { padding-left: 10px; }
  .su-input input::placeholder { color: #A0A9BB; }
  .su-input input:focus, .su-input input:focus-visible { outline: none; box-shadow: none !important; border: 0; }
  .su-input__toggle { display: grid; place-items: center; height: 52px; padding: 0 14px; border: 0; background: transparent; color: #8A94A8; cursor: pointer; }
  .su-input__toggle:hover { color: var(--su-ink); }
  .su-error { display: block; margin-top: 7px; color: #C62828; font-size: 12.5px; font-weight: 600; }

  .su-strength { display: flex; align-items: center; gap: 10px; margin-top: 10px; font-size: 12.5px; font-weight: 700; color: var(--su-muted); }
  .su-strength__bars { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; flex: 1; }
  .su-strength__bars i { height: 6px; border-radius: 4px; background: #E8ECF3; transition: background .3s; }
  .su-strength--1 i.on { background: #F43F5E; }
  .su-strength--2 i.on { background: #F59E0B; }
  .su-strength--3 i.on { background: #6366F1; }
  .su-strength--4 i.on { background: linear-gradient(90deg, #10B981, #06B6D4); }
  .su-rules { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 10px 0 0; padding: 0; list-style: none; }
  .su-rules li { display: inline-flex; align-items: center; gap: 5px; color: #98A2B3; font-size: 12.5px; font-weight: 600; transition: color .2s; }
  .su-rules li svg { padding: 1px; border-radius: 50%; background: #E8ECF3; color: #fff; transition: background .2s; }
  .su-rules li.ok { color: #047857; }
  .su-rules li.ok svg { background: #10B981; }

  .su-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .su-chip { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 15px; border: 1.5px solid var(--su-line); border-radius: 999px; background: #fff; color: #344054; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; transition: all .18s; }
  .su-chip:hover { border-color: #A5B4FC; background: #F5F7FF; }
  .su-chip.is-selected { border-color: transparent; background: var(--su-grad-btn); color: #fff; box-shadow: 0 8px 18px -10px rgba(99,102,241,.9); }
  .su-chip:focus-visible, .su-cycle:focus-visible, .su-primary:focus-visible, .su-back:focus-visible { outline: 3px solid rgba(99,102,241,.45); outline-offset: 2px; }
  .su-field.has-error .su-chips { padding: 6px; margin: -6px; border-radius: 14px; box-shadow: 0 0 0 2px rgba(229,72,77,.35); }

  .su-checkout { display: grid; gap: 18px; }
  .su-plan { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 20px; border-radius: 18px; background: linear-gradient(135deg, #EEF3FF 0%, #F3EEFF 55%, #E9FBFE 100%); border: 1px solid #E0E5FB; }
  .su-plan__badge { display: inline-block; margin-bottom: 6px; padding: 3px 10px; border-radius: 999px; background: var(--su-grad-btn); color: #fff; font-size: 11.5px; font-weight: 800; }
  .su-plan strong { display: block; font-size: 17px; letter-spacing: -.01em; }
  .su-plan small { color: var(--su-muted); font-size: 13px; }
  .su-plan__price { background: var(--su-grad); -webkit-background-clip: text; background-clip: text; color: transparent; font-size: 34px; font-weight: 800; letter-spacing: -.03em; }
  .su-block { display: grid; gap: 0; }
  .su-cycles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .su-cycle { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; padding: 14px; border: 1.5px solid var(--su-line); border-radius: 15px; background: #fff; color: var(--su-ink); font: inherit; text-align: left; cursor: pointer; transition: all .18s; }
  .su-cycle:hover { border-color: #A5B4FC; }
  .su-cycle.is-selected { border-color: #6366F1; background: #F5F7FF; box-shadow: 0 0 0 4px rgba(99,102,241,.12); }
  .su-cycle__top { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 6px; font-size: 13.5px; }
  .su-cycle__top em { padding: 2px 7px; border-radius: 999px; background: #DCFCE7; color: #047857; font-size: 11px; font-style: normal; font-weight: 800; }
  .su-cycle__rate { font-size: 21px; font-weight: 800; letter-spacing: -.02em; }
  .su-cycle__unit { color: var(--su-muted); font-size: 12px; }
  .su-counter { display: grid; grid-template-columns: 46px 1fr 46px; align-items: center; gap: 10px; padding: 10px; border: 1.5px solid var(--su-line); border-radius: 16px; background: #fff; }
  .su-counter button { display: grid; place-items: center; width: 46px; height: 46px; border: 0; border-radius: 12px; background: #F2F4FA; color: var(--su-ink); cursor: pointer; transition: all .18s; }
  .su-counter button:hover:not(:disabled) { background: var(--su-grad-btn); color: #fff; }
  .su-counter button:disabled { opacity: .4; cursor: not-allowed; }
  .su-counter__value { display: flex; align-items: baseline; justify-content: center; gap: 8px; }
  .su-counter__value strong { font-size: 32px; font-weight: 800; letter-spacing: -.03em; }
  .su-counter__value span { color: var(--su-muted); font-size: 14px; font-weight: 600; }
  .su-range { width: 100%; margin-top: 14px; height: 6px; border-radius: 6px; appearance: none; -webkit-appearance: none; background: linear-gradient(90deg, #6366F1 0 var(--su-fill), #E3E7F0 var(--su-fill) 100%); outline: none; }
  .su-range::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: #fff; border: 3px solid #6366F1; box-shadow: 0 4px 12px rgba(99,102,241,.45); cursor: pointer; }
  .su-range::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: #fff; border: 3px solid #6366F1; cursor: pointer; }
  .su-summary { padding: 16px 18px; border: 1px dashed #C7D2FE; border-radius: 16px; background: #FAFBFF; }
  .su-summary__row { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; font-size: 14px; }
  .su-summary__row--muted { color: var(--su-muted); }
  .su-summary__total { display: flex; justify-content: space-between; margin-top: 8px; padding-top: 10px; border-top: 1px solid #E3E7F0; font-size: 15px; font-weight: 700; }
  .su-summary__total strong { background: var(--su-grad); -webkit-background-clip: text; background-clip: text; color: transparent; font-size: 17px; }
  .su-summary p { margin: 8px 0 0; color: var(--su-muted); font-size: 12.5px; }

  .su-legal { display: grid; gap: 10px; }
  .su-check { position: relative; display: flex; align-items: flex-start; gap: 11px; padding: 12px 14px; border: 1.5px solid var(--su-line); border-radius: 14px; background: #fff; color: #475467; font-size: 13.5px; line-height: 1.55; cursor: pointer; transition: border-color .18s; }
  .su-check:hover { border-color: #C7D2FE; }
  .su-check input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .su-check__box { display: grid; place-items: center; flex: 0 0 20px; width: 20px; height: 20px; margin-top: 1px; border: 1.5px solid #C2CADA; border-radius: 6px; background: #fff; color: transparent; transition: all .18s; }
  .su-check input:checked + .su-check__box { border-color: transparent; background: var(--su-grad-btn); color: #fff; }
  .su-check input:focus-visible + .su-check__box { box-shadow: 0 0 0 4px rgba(99,102,241,.25); }
  .su-check.has-error { border-color: rgba(229,72,77,.6); }
  .su-check a { color: var(--su-blue); font-weight: 700; }

  .su-alert { margin: 18px 0 0; padding: 12px 14px; border: 1px solid #FECACA; border-radius: 12px; background: #FEF2F2; color: #B42318; font-size: 13.5px; font-weight: 600; }
  .su-actions { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-top: 26px; }
  .su-back { display: inline-flex; align-items: center; gap: 7px; min-height: 52px; padding: 0 16px; border: 0; border-radius: 13px; background: transparent; color: var(--su-muted); font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
  .su-back:hover:not(:disabled) { background: #EEF1F7; color: var(--su-ink); }
  .su-primary { position: relative; overflow: hidden; isolation: isolate; display: inline-flex; align-items: center; justify-content: center; gap: 9px; min-width: 220px; min-height: 54px; padding: 0 26px; border: 0; border-radius: 14px; background: var(--su-grad-btn); color: #fff; font: inherit; font-size: 16px; font-weight: 800; cursor: pointer; box-shadow: inset 0 1px 0 rgba(255,255,255,.22), 0 16px 32px -14px rgba(99,102,241,.95); transition: transform .15s, box-shadow .2s; }
  .su-primary::after { content: ""; position: absolute; inset: 0; z-index: -1; background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,.4) 50%, transparent 70%); transform: translateX(-120%); transition: transform .7s cubic-bezier(.2,0,0,1); }
  .su-primary:hover:not(:disabled)::after { transform: translateX(120%); }
  .su-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: inset 0 1px 0 rgba(255,255,255,.25), 0 20px 38px -14px rgba(99,102,241,1); }
  .su-primary:disabled { opacity: .8; cursor: wait; }
  .su-primary svg { transition: transform .2s; }
  .su-primary:hover:not(:disabled) svg { transform: translateX(3px); }
  .su-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.45); border-top-color: #fff; border-radius: 50%; animation: su-spin .8s linear infinite; }
  @keyframes su-spin { to { transform: rotate(360deg); } }
  .su-trust { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px 18px; margin-top: 16px; color: var(--su-muted); font-size: 12.5px; font-weight: 600; }
  .su-trust span { display: inline-flex; align-items: center; gap: 6px; }
  .su-trust svg { color: #10B981; }
  .su-footnote { margin: 16px 0 0; text-align: center; color: #8A94A8; font-size: 12.5px; }

  @media (max-width: 1080px) {
    .su-page { grid-template-columns: 1fr; }
    .su-showcase { position: relative; height: auto; margin: 12px 12px 0; }
    .su-showcase__inner { overflow: visible; }
    .su-widgets, .su-showcase__footer { display: none; }
    .su-benefits { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 720px) {
    .su-showcase { display: none; }
    .su-topbar__logo { display: inline-flex; }
    .su-topbar { justify-content: space-between; font-size: 13px; }
    .su-row, .su-cycles { grid-template-columns: 1fr; }
    .su-step__label { font-size: 12px; }
    .su-card { border-radius: 20px; }
    .su-actions { flex-direction: column-reverse; align-items: stretch; }
    .su-primary { width: 100%; min-width: 0; }
    .su-back { justify-content: center; }
  }
  @media (prefers-reduced-motion: reduce) {
    .su-mesh i, .su-showcase, .su-gtext, .su-glass, .su-card__head, .su-step-body { animation: none !important; }
  }
`;
