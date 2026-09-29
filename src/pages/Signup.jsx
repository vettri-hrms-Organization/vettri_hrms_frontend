import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LockKeyhole, Minus, Plus } from 'lucide-react';
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
          theme: { color: '#2367c9' },
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

  return (
    <main className="signup-page">
      <aside className="signup-brand-panel">
        <div className="signup-brand-content">
          <div className="signup-brand-logo">
            <img
              src="/brand/vettri-logo-full-transparent.png"
              alt="Vettri HRMS"
              className="signup-brand-logo-image"
            />
            <div className="signup-brand-logo-subtitle">HRMS PLATFORM</div>
          </div>

          <div className="signup-brand-message">
            <div className="signup-brand-eyebrow">
              <span className="signup-brand-eyebrow-dot" />
              WORKFORCE MANAGEMENT
            </div>

            <h1>
              Everything your <span>workforce</span> needs.
            </h1>

            <p>
              Create your Vettri workspace and bring people, payroll,
              attendance and workplace operations together in one connected platform.
            </p>

            <div className="signup-brand-features">
              <div className="signup-brand-feature">
                <div className="signup-brand-feature-icon"><Check size={16} /></div>
                <span>Employee & payroll management</span>
              </div>
              <div className="signup-brand-feature">
                <div className="signup-brand-feature-icon"><Check size={16} /></div>
                <span>Attendance & leave tracking</span>
              </div>
              <div className="signup-brand-feature">
                <div className="signup-brand-feature-icon"><Check size={16} /></div>
                <span>Workplace monitoring & operations</span>
              </div>
            </div>
          </div>

          <div className="signup-brand-footer">
            <div className="signup-security-note">
              <LockKeyhole size={15} />
              <span>Secure enterprise workspace</span>
            </div>
            <span>© 2026 Vettri HRMS</span>
          </div>
        </div>

        <div className="signup-brand-circle signup-brand-circle-one" />
        <div className="signup-brand-circle signup-brand-circle-two" />
        <div className="signup-brand-grid" />
      </aside>

      <section className="signup-main">
        <div className="signup-wrap">
          <div className="signup-topline"><Link to="/login">Already have an account? Sign in</Link></div>

          <nav className="signup-progress" aria-label="Signup progress">
            {steps.map((label, index) => (
              <div className={`signup-progress-step ${index + 1 <= step ? 'active' : ''}`} key={label}>
                <span>{index + 1 < step ? <Check size={13} /> : `0${index + 1}`}</span>
                {label}
              </div>
            ))}
          </nav>

          <div className="signup-surface">
            <div className="signup-surface-header">
              <Logo size={30} />
              <p className="signup-eyebrow light">Step 0{step}</p>
            </div>

            <h2>{step === 1 ? 'Create your Vettri account' : step === 2 ? 'Tell us about your organization' : 'Set up your workspace'}</h2>
            <p className="signup-muted">{step === 1 ? 'Begin with a secure account setup.' : step === 2 ? 'This helps us prepare the right workspace.' : 'Choose your billing preference and confirm your workforce size.'}</p>

            {step === 1 && <AccountFields form={form} errors={errors} showPassword={showPassword} setShowPassword={setShowPassword} update={update} />}
            {step === 2 && <OrganizationFields form={form} errors={errors} update={update} />}
            {step === 3 && (
              <div className="checkout-layout">
                <div className="checkout-card">
                  <div className="checkout-section checkout-plan-row">
                    <div className="plan-copy">
                      <div className="plan-badge">Plan</div>
                      <div className="plan-name">{isTrialSignup ? 'Free trial' : selectedPlan.label}</div>
                      <div className="plan-subtitle">{isTrialSignup ? '₹1 verification through Razorpay' : 'Complete HRMS platform'}</div>
                    </div>
                    <div className="plan-chip">{isTrialSignup ? '₹1 verification' : 'Paid plan'}</div>
                  </div>

                  {hasPaymentFlow && <div className="checkout-section">
                    <div className="section-head">Billing</div>
                    <div className="billing-segment" role="tablist" aria-label="Billing cycle selector">
                      {billingCycles.map((cycle) => {
                        const selected = form.billingCycle === cycle.value;
                        const rate = getPerEmployeeRate(cycle.value);
                        const savingsLabel = getSavingsLabel(cycle.value);

                        return (
                          <button
                            key={cycle.value}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            className={`billing-option ${selected ? 'selected' : ''}`}
                            onClick={() => update('billingCycle', cycle.value)}
                          >
                            <span className="billing-topline">
                              <span className="billing-name">{cycle.label}</span>
                              {savingsLabel && <span className="billing-badge">{savingsLabel}</span>}
                            </span>
                            <span className="billing-rate">{billingConfig[cycle.value].detail}</span>
                            <span className="billing-meta">{billingConfig[cycle.value].label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>}

                  {hasPaymentFlow && <div className="checkout-section">
                    <div className="section-head">Number of employees</div>
                    <div className="employee-selector" aria-label="Employee count selector">
                      <button
                        type="button"
                        className="employee-step"
                        onClick={() => update('employeeCount', Math.max(1, form.employeeCount - 1))}
                        aria-label="Decrease employee count"
                        disabled={form.employeeCount <= 1}
                      >
                        <Minus size={20} strokeWidth={2.2} />
                      </button>
                      <div className="employee-value-wrap">
                        <span className="employee-value">{form.employeeCount}</span>
                        <span className="employee-caption">Active employees</span>
                      </div>
                      <button
                        type="button"
                        className="employee-step"
                        onClick={() => update('employeeCount', Math.max(1, Number(form.employeeCount) + 1))}
                        aria-label="Increase employee count"
                      >
                        <Plus size={20} strokeWidth={2.2} />
                      </button>
                    </div>
                  </div>}

                  {hasPaymentFlow && <div className="checkout-section summary-box">
                    <div className="section-head summary-head">
                      <span>Subscription summary</span>
                    </div>

                    <div className="summary-line summary-line--header">
                      <span>{form.employeeCount} employees {'\u00D7'} {'\u20B9'}{getPerEmployeeRate(form.billingCycle)}</span>
                      <strong>{getFutureBillingText(form.employeeCount, form.billingCycle)}</strong>
                    </div>

                    <div className="summary-divider" />

                    <div className="summary-line">
                      <span>Subtotal</span>
                      <strong>{getFutureBillingText(form.employeeCount, form.billingCycle)}</strong>
                    </div>

                    <div className="summary-line summary-line--muted">
                      <span>Verification today</span>
                      <strong>₹1</strong>
                    </div>

                    <div className="summary-line summary-line--muted">
                      <span>After trial</span>
                      <strong>{getFutureBillingText(form.employeeCount, form.billingCycle)}</strong>
                    </div>
                  </div>}

                  <div className="checkout-section trial-box">
                    <div className="trial-header">
                      <div className="section-head">Free trial</div>
                      <div className="trial-amount">₹1</div>
                    </div>
                    <p className="trial-title">Start your Vettri trial</p>
                    <p className="trial-copy">₹1 verification today. Your free trial starts after verification. After the trial, your subscription will be billed at <strong>{getFutureBillingText(form.employeeCount, form.billingCycle)}</strong>.</p>
                  </div>
                </div>
              </div>
            )}

            {errors.submit && <p className="signup-error" role="alert">{errors.submit}</p>}

            <div className="signup-actions">
              {step > 1 ? (
                <button className="signup-back" type="button" onClick={() => setStep((current) => current - 1)} disabled={submitting}>
                  <ArrowLeft size={16} /> Back
                </button>
              ) : <span className="signup-spacer" />}

              {step < 3 ? (
                <button className="signup-primary" type="button" onClick={() => validate() && setStep((current) => current + 1)}>
                  Continue <ArrowRight size={16} />
                </button>
              ) : (
                <button className="signup-primary" type="button" onClick={createWorkspace} disabled={submitting}>
                  {submitting ? 'Preparing secure checkout...' : <>Start free trial - ₹1 verification <ArrowRight size={16} /></>}
                  {submitting && <span className="button-spinner" aria-hidden="true" />}
                </button>
              )}
            </div>

            {hasPaymentFlow && <div className="signup-trust">
              <span className="trust-dot" aria-hidden="true" /> Secure checkout {'\u2022'} Powered by Razorpay
            </div>}
          </div>

          <p className="signup-footnote"><LockKeyhole size={14} /> {hasPaymentFlow ? <>Selected plan: {isTrialSignup ? 'Starter' : selectedPlan.label} {'\u2022'} {form.billingCycle} billing {'\u2022'} {form.employeeCount} employees</> : 'Your trial starts when your workspace is created.'}</p>
        </div>
      </section>

      <style>{styles}</style>
    </main>
  );
}

function Field({ id, label, value, onChange, error, type = 'text', placeholder }) {
  return <div className="signup-field"><label htmlFor={id}>{label}</label><input id={id} type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} />{error && <small>{error}</small>}</div>;
}

function AccountFields({ form, errors, showPassword, setShowPassword, update }) {
  return <div className="signup-fields"><div className="signup-field-row"><Field id="firstName" label="First name" value={form.firstName} error={errors.firstName} onChange={(value) => update('firstName', value)} /><Field id="lastName" label="Last name" value={form.lastName} error={errors.lastName} onChange={(value) => update('lastName', value)} /></div><Field id="email" label="Work email" type="email" value={form.email} error={errors.email} onChange={(value) => update('email', value)} /><div className="signup-field"><label htmlFor="password">Password</label><div className="signup-password"><input id="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => update('password', event.target.value)} autoComplete="new-password" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{errors.password && <small>{errors.password}</small>}</div><Field id="role" label="Job role (optional)" value={form.role} onChange={(value) => update('role', value)} placeholder="e.g. People operations" /></div>;
}

function OrganizationFields({ form, errors, update }) {
  return <div className="signup-fields"><Field id="organizationName" label="Organization name" value={form.organizationName} error={errors.organizationName} onChange={(value) => update('organizationName', value)} placeholder="e.g. Acme Technologies" /><SelectField id="industry" label="Industry" value={form.industry} error={errors.industry} options={industries} onChange={(value) => update('industry', value)} /><SelectField id="companySize" label="Company size" value={form.companySize} error={errors.companySize} options={companySizes} onChange={(value) => update('companySize', value)} /><Field id="country" label="Country" value={form.country} error={errors.country} onChange={(value) => update('country', value)} /></div>;
}

function SelectField({ id, label, value, options, error, onChange }) {
  return <div className="signup-field"><label htmlFor={id}>{label}</label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)}><option value="">Select an option</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>{error && <small>{error}</small>}</div>;
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

  * { box-sizing: border-box; }

  .signup-page {
    min-height: 100vh;
    height: 100vh;
    display: grid;
    grid-template-columns: 48% 52%;
    background: #fff;
    color: #0f172a;
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }

  /* LEFT — same visual language as the reference login screen */
  .signup-brand-panel {
    position: relative;
    min-width: 0;
    min-height: 100vh;
    overflow: hidden;
    background:
      radial-gradient(circle at 85% 15%, rgba(56,139,253,.18), transparent 35%),
      radial-gradient(circle at 20% 80%, rgba(56,139,253,.08), transparent 40%),
      linear-gradient(160deg, #0a1628 0%, #0d2137 45%, #0f2d4a 100%);
    color: #fff;
  }

  .signup-brand-content {
    position: relative;
    z-index: 5;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 52px clamp(40px, 7vw, 88px);
  }

  .signup-brand-logo { display: flex; flex-direction: column; align-items: flex-start; gap: 5px; }
  .signup-brand-logo-image { width: 140px; height: auto; object-fit: contain; display: block; }
  .signup-brand-logo-subtitle { margin-left: 2px; color: #8baecf; font-size: 9px; font-weight: 700; letter-spacing: .22em; }

  .signup-brand-message { max-width: 520px; margin: auto 0; }
  .signup-brand-eyebrow { display: inline-flex; align-items: center; gap: 10px; color: #6ba3ff; font-size: 11px; font-weight: 700; letter-spacing: .16em; }
  .signup-brand-eyebrow-dot { width: 8px; height: 8px; border-radius: 50%; background: #4d8dff; box-shadow: 0 0 0 6px rgba(77,141,255,.12); }
  .signup-brand-message h1 { margin: 18px 0 20px; max-width: 520px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: clamp(2.7rem, 4vw, 4.5rem); line-height: 1.02; letter-spacing: -.055em; font-weight: 800; color: #fff; }
  .signup-brand-message h1 span { color: #69a3ff; }
  .signup-brand-message p { max-width: 500px; margin: 0 0 28px; color: #a9c1d9; font-size: 15px; line-height: 1.75; }

  .signup-brand-features { display: flex; flex-direction: column; gap: 13px; }
  .signup-brand-feature { display: flex; align-items: center; gap: 12px; color: #dce9f6; font-size: 14px; font-weight: 600; }
  .signup-brand-feature-icon { width: 26px; height: 26px; flex: 0 0 26px; display: grid; place-items: center; border-radius: 8px; background: rgba(77,141,255,.16); border: 1px solid rgba(111,166,255,.22); color: #82b5ff; }

  .signup-brand-footer { display: flex; align-items: center; justify-content: space-between; gap: 20px; color: #718da9; font-size: 11px; }
  .signup-security-note { display: inline-flex; align-items: center; gap: 8px; color: #91abc4; }

  .signup-brand-circle { position: absolute; border-radius: 50%; pointer-events: none; z-index: 1; }
  .signup-brand-circle-one { width: 430px; height: 430px; right: -180px; top: 10%; border: 1px solid rgba(100,158,255,.12); box-shadow: 0 0 90px rgba(52,110,255,.08); }
  .signup-brand-circle-two { width: 280px; height: 280px; left: -160px; bottom: -100px; border: 1px solid rgba(255,255,255,.07); }
  .signup-brand-grid { position: absolute; inset: 0; opacity: .10; pointer-events: none; background-image: linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px); background-size: 42px 42px; mask-image: linear-gradient(to bottom, transparent 0%, black 35%, black 75%, transparent 100%); }

  /* RIGHT — independent vertical scrolling */
  .signup-main {
    min-width: 0;
    min-height: 100vh;
    height: 100vh;
    overflow-y: auto;
    overflow-x: hidden;
    background: #f5f7fa;
    scrollbar-width: thin;
    scrollbar-color: #c7d2e0 transparent;
  }
  .signup-main::-webkit-scrollbar { width: 8px; }
  .signup-main::-webkit-scrollbar-track { background: transparent; }
  .signup-main::-webkit-scrollbar-thumb { background: #c7d2e0; border-radius: 999px; }
  .signup-wrap { width: 100%; max-width: 720px; min-height: 100%; margin: 0 auto; padding: 28px 34px 44px; }

  .signup-topline { display: flex; justify-content: flex-end; align-items: center; min-height: 42px; margin-bottom: 26px; font-size: 13px; color: #64748b; }
  .signup-topline a { color: #1d5aa6; text-decoration: none; font-weight: 700; }
  .signup-topline a:hover { text-decoration: underline; }

  .signup-progress { display: flex; gap: 10px; margin-bottom: 16px; }
  .signup-progress-step { display: flex; align-items: center; gap: 8px; flex: 1; color: #8290a2; font-size: 11px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
  .signup-progress-step span { width: 29px; height: 29px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: #e9eef5; border: 1px solid #d7e0eb; color: #64748b; }
  .signup-progress-step.active { color: #1d5aa6; }
  .signup-progress-step.active span { background: #2367c9; border-color: #2367c9; color: #fff; }

  .signup-surface { background: #fff; border: 1px solid #dfe6ee; border-radius: 16px; box-shadow: 0 12px 35px rgba(15,27,61,.07); padding: 30px; }
  .signup-surface-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .signup-eyebrow.light { color: #1d5aa6; margin: 0; font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
  .signup-surface h2 { margin: 0; font-family: 'Plus Jakarta Sans', sans-serif; font-size: clamp(1.8rem, 3vw, 2.35rem); line-height: 1.12; letter-spacing: -.045em; font-weight: 800; color: #172033; }
  .signup-muted { margin: 9px 0 26px; color: #66758a; font-size: 13px; line-height: 1.65; }

  .signup-fields { display: flex; flex-direction: column; gap: 18px; }
  .signup-field-row { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px; }
  .signup-field label { display: block; margin: 0 0 7px; color: #25354d; font-size: 12px; font-weight: 700; }
  .signup-field input, .signup-field select { width: 100%; height: 50px; border-radius: 9px; border: 1px solid #ccd7e4; background: #fff; padding: 0 14px; font-family: inherit; font-size: 13px; font-weight: 500; color: #172033; transition: border-color .18s ease; box-shadow: none; }
  .signup-field input::placeholder { color: #9aaabd; }
  .signup-field input:focus, .signup-field select:focus { outline: none; border-color: #2367c9; box-shadow: none; }
  .signup-field small, .signup-error { display: block; margin-top: 6px; color: #b42318; font-size: 11px; font-weight: 600; line-height: 1.4; }
  .signup-password { display: flex; align-items: center; border: 1px solid #ccd7e4; border-radius: 9px; background: #fff; transition: border-color .18s ease; }
  .signup-password:focus-within { border-color: #2367c9; box-shadow: none; }
  .signup-password input { border: 0 !important; box-shadow: none !important; height: 50px; flex: 1; }
  .signup-password button { border: 0; background: transparent; color: #64748b; height: 50px; padding: 0 14px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }

  .checkout-layout { display: block; }
  .checkout-card { display: grid; gap: 15px; }
  .checkout-section { background: #f9fbfd; border: 1px solid #e4ebf3; border-radius: 12px; padding: 15px; }
  .section-head { font-size: 10px; letter-spacing: .09em; text-transform: uppercase; font-weight: 800; color: #718096; margin-bottom: 9px; }
  .checkout-plan-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #f5f8fd; }
  .plan-badge { font-size: 10px; text-transform: uppercase; font-weight: 800; color: #2367c9; margin-bottom: 5px; }
  .plan-name { font-size: 18px; font-weight: 800; color: #172033; }
  .plan-subtitle { color: #68788d; font-size: 12px; margin-top: 2px; }
  .plan-chip { border-radius: 999px; background: #eaf2ff; color: #1857aa; padding: 6px 9px; font-size: 10px; font-weight: 800; text-transform: uppercase; }
  .billing-segment { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 9px; }
  .billing-option { appearance: none; border: 1px solid #ccd7e4; background: #fff; border-radius: 9px; min-height: 96px; padding: 11px; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 5px; color: #172033; cursor: pointer; transition: border-color .18s ease, background .18s ease; text-align: left; }
  .billing-option:hover { border-color: #9eb5d8; }
  .billing-option.selected { background: #eef5ff; border-color: #2367c9; box-shadow: none; }
  .billing-topline { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 7px; }
  .billing-name { font-size: 12px; font-weight: 800; }
  .billing-badge { background: #e7f0ff; color: #1857aa; border-radius: 999px; padding: 3px 6px; font-size: 9px; font-weight: 800; }
  .billing-rate { font-size: 14px; font-weight: 800; }
  .billing-meta { color: #718096; font-size: 10px; }
  .employee-selector { display: grid; grid-template-columns: 48px minmax(0,1fr) 48px; align-items: center; gap: 10px; background: #fff; border: 1px solid #ccd7e4; border-radius: 12px; padding: 11px 12px; }
  .employee-step { border: 1px solid #ccd7e4; background: #f7f9fc; color: #172033; width: 38px; height: 38px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
  .employee-step:hover:not(:disabled) { border-color: #2367c9; background: #eef5ff; }
  .employee-step:disabled { opacity: .4; cursor: not-allowed; }
  .employee-value-wrap { display: flex; flex-direction: column; align-items: center; text-align: center; }
  .employee-value { font-size: 34px; line-height: 1; font-weight: 800; color: #172033; }
  .employee-caption { margin-top: 5px; color: #718096; font-size: 9px; text-transform: uppercase; font-weight: 700; letter-spacing: .06em; }
  .summary-box { background: #f7faff; }
  .summary-line { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 12px; color: #25354d; padding: 7px 0; }
  .summary-line strong { font-size: 13px; }
  .summary-line--header, .summary-line--muted { color: #66758a; }
  .summary-divider { height: 1px; background: #dce5f0; margin: 7px 0 2px; }
  .trial-box { background: #eef5ff; border-color: #d8e6fb; }
  .trial-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; }
  .trial-amount { font-size: 22px; font-weight: 800; color: #1857aa; }
  .trial-title { margin: 0 0 5px; font-size: 14px; font-weight: 800; color: #172033; }
  .trial-copy { margin: 0; color: #66758a; font-size: 12px; line-height: 1.6; }

  .signup-actions { display: flex; justify-content: space-between; align-items: center; gap: 14px; border-top: 1px solid #e9eef4; margin-top: 22px; padding-top: 18px; }
  .signup-back, .signup-primary { border: 0; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 9px; font-family: inherit; font-weight: 800; min-height: 50px; }
  .signup-back { background: transparent; color: #53657d; padding: 0 8px; min-width: 90px; }
  .signup-back:hover:not(:disabled) { color: #172033; }
  .signup-primary { width: 100%; max-width: 310px; padding: 0 20px; background: #2367c9; color: #fff; box-shadow: 0 8px 18px rgba(35,103,201,.20); }
  .signup-primary:hover:not(:disabled) { background: #1d5aa6; }
  .signup-primary:disabled { opacity: .75; cursor: wait; }
  .button-spinner { width: 15px; height: 15px; border: 2px solid rgba(255,255,255,.45); border-top-color: #fff; border-radius: 50%; display: inline-block; animation: spin .8s linear infinite; }
  .signup-spacer { width: 90px; }
  .signup-trust { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 13px; color: #718096; font-size: 10px; font-weight: 700; }
  .trust-dot { width: 6px; height: 6px; border-radius: 50%; background: #39a875; }
  .signup-footnote { color: #718096; font-size: 10px; display: flex; align-items: center; justify-content: center; gap: 7px; margin: 16px 0 0; }
  @keyframes spin { to { transform: rotate(360deg); } }

  @media (max-width: 900px) {
    .signup-page { display: block; height: auto; min-height: 100vh; overflow: visible; }
    .signup-brand-panel { min-height: auto; }
    .signup-brand-content { min-height: 540px; padding: 34px 28px 30px; }
    .signup-main { height: auto; min-height: auto; overflow: visible; }
    .signup-wrap { max-width: 760px; padding: 26px 22px 42px; }
  }

  @media (max-width: 620px) {
    .signup-field-row, .billing-segment { grid-template-columns: 1fr; }
    .signup-brand-content { min-height: 500px; padding: 28px 22px; }
    .signup-brand-message h1 { font-size: 2.45rem; }
    .signup-brand-footer { align-items: flex-start; flex-direction: column; gap: 8px; }
    .signup-surface { padding: 22px 18px; border-radius: 14px; }
    .signup-actions { flex-direction: column-reverse; align-items: stretch; }
    .signup-primary, .signup-back, .signup-spacer { width: 100%; max-width: none; }
  }
`;


