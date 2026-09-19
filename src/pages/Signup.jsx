import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import Logo from '../components/brand/Logo';
import { API_BASE_URL } from '../api/axiosClient';
import { tokenStorage } from '../auth/tokenStorage';

const steps = ['Account', 'Organization', 'Workspace'];
const industries = ['Technology', 'Manufacturing', 'Retail', 'Healthcare', 'Education', 'Finance', 'Professional Services', 'Other'];
const companySizes = ['1-25', '26-50', '51-100', '101-250', '251-500', '500+'];
const interests = ['HR & employee management', 'Attendance & leave', 'Payroll', 'Assets', 'Devices', 'Software management', 'Remote support'];
const planOptions = [
  { value: 'VETTRI_HRMS', label: 'Vettri HRMS', price: '\u20B999/employee/mo', employeeLimit: 'Unlimited employee tiers', deviceLimit: 'Unified product' },
];

const billingCycles = [
  { value: 'MONTHLY', label: 'Monthly', subtitle: 'Best for new teams' },
  { value: 'QUARTERLY', label: 'Quarterly', subtitle: 'Save 5%' },
  { value: 'ANNUAL', label: 'Annual', subtitle: 'Save 10%' },
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
  plan: 'VETTRI_HRMS',
  billingCycle: 'MONTHLY',
  employeeCount: 25,
};

const billingConfig = {
  MONTHLY: { label: 'Monthly', rate: 99, unit: 'month', detail: '\u20B999 / employee / month' },
  QUARTERLY: { label: 'Quarterly', rate: 279, unit: 'quarter', detail: '\u20B9279 / employee / quarter' },
  ANNUAL: { label: 'Annual', rate: 999, unit: 'year', detail: '\u20B9999 / employee / year' },
};

const getSubscriptionTotal = (employeeCount, billingCycle) => {
  const rate = billingConfig[billingCycle]?.rate ?? billingConfig.MONTHLY.rate;
  return Number(employeeCount || 1) * rate;
};

const getFutureBillingText = (employeeCount, billingCycle) => {
  const total = getSubscriptionTotal(employeeCount, billingCycle);
  const unitLabel = billingConfig[billingCycle]?.unit ?? 'month';
  return `\u20B9${total.toLocaleString('en-IN')}/${unitLabel}`;
};

const getPerEmployeeRate = (billingCycle) => billingConfig[billingCycle]?.rate ?? billingConfig.MONTHLY.rate;

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
  const selectedPlanFromUrl = searchParams.get('plan') || 'VETTRI_HRMS';
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ ...initialForm, plan: planOptions.some((option) => option.value === selectedPlanFromUrl) ? selectedPlanFromUrl : 'VETTRI_HRMS' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const selectedPlan = useMemo(() => planOptions.find((option) => option.value === form.plan) || planOptions[0], [form.plan]);

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
        body: JSON.stringify({ ...form, plan: form.plan, billingCycle: form.billingCycle, employeeCount: form.employeeCount }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || result.details?.[0] || 'We could not create your workspace.');

      if (result.requiresPayment) {
        const orderResponse = await fetch(`${API_BASE_URL}/api/billing/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId: result.companyId, userId: result.userId, plan: result.plan, billingCycle: form.billingCycle, employeeCount: form.employeeCount, customerName: `${form.firstName} ${form.lastName}`.trim(), customerEmail: form.email, organizationName: form.organizationName }),
        });
        const order = await orderResponse.json().catch(() => ({}));
        if (!orderResponse.ok) throw new Error(order.message || 'We could not start payment.');

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
              if (!verificationResponse.ok) throw new Error(verification.message || 'Payment verification failed.');

              const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: form.email, password: form.password }),
              });
              const loginResult = await loginResponse.json().catch(() => ({}));
              if (!loginResponse.ok) throw new Error(loginResult.message || 'Your subscription is active, but we could not sign you in.');
              tokenStorage.setTokens(loginResult.accessToken || loginResult.token, loginResult.refreshToken);
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
      window.location.assign('/onboarding');
    } catch (error) {
      setErrors({ submit: error instanceof TypeError ? 'Unable to reach Vettri. Check your connection and try again.' : error.message });
      setSubmitting(false);
    }
  };

  return (
    <main className="signup-page">
      <aside className="signup-brand-panel">
        <div className="signup-brand-top">
          <Logo tone="onDark" size={40} wordmarkSize="var(--hz-text-2xl)" />
        </div>

        <div className="signup-brand-copy">
          <p className="signup-eyebrow">Vettri workplace platform</p>
          <h1>Build your workforce workspace.</h1>
          <p className="signup-intro">Configure your plan, choose your workforce size, and start using Vettri HRMS in minutes.</p>

          <ul className="signup-value-list" aria-label="Key product benefits">
            <li><span className="check-pill"><Check size={14} /></span>Complete HRMS platform</li>
            <li><span className="check-pill"><Check size={14} /></span>Employee & workforce management</li>
            <li><span className="check-pill"><Check size={14} /></span>Secure cloud-based workspace</li>
            <li><span className="check-pill"><Check size={14} /></span>Built for growing teams</li>
          </ul>
        </div>

        <p className="signup-trial"><span /> Secure verification starts at {'\u20B9'}1.</p>
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
            <p className="signup-muted">{step === 1 ? `Begin with a secure \u20B91 verification step.` : step === 2 ? 'This helps us prepare the right workspace.' : 'Choose your billing preference and confirm your workforce size.'}</p>

            {step === 1 && <AccountFields form={form} errors={errors} showPassword={showPassword} setShowPassword={setShowPassword} update={update} />}
            {step === 2 && <OrganizationFields form={form} errors={errors} update={update} />}
            {step === 3 && (
              <div className="checkout-layout">
                <div className="checkout-card">
                  <div className="checkout-section checkout-plan-row">
                    <div className="plan-copy">
                      <div className="plan-badge">Plan</div>
                      <div className="plan-name">Vettri HRMS</div>
                      <div className="plan-subtitle">Complete HRMS platform</div>
                    </div>
                    <div className="plan-chip">All-in-one</div>
                  </div>

                  <div className="checkout-section">
                    <div className="section-head">Billing</div>
                    <div className="billing-segment" role="tablist" aria-label="Billing cycle selector">
                      {billingCycles.map((cycle) => {
                        const selected = form.billingCycle === cycle.value;
                        const rate = getPerEmployeeRate(cycle.value);
                        const savingsLabel = cycle.value === 'ANNUAL' ? 'Best value' : cycle.value === 'QUARTERLY' ? 'Save 5%' : '';

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
                            <span className="billing-rate">{'\u20B9'}{rate} / employee</span>
                            <span className="billing-meta">{cycle.value === 'MONTHLY' ? 'per month' : cycle.value === 'QUARTERLY' ? 'per quarter' : 'per year'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="checkout-section">
                    <div className="section-head">Number of employees</div>
                    <div className="employee-selector" aria-label="Employee count selector">
                      <button
                        type="button"
                        className="employee-step"
                        onClick={() => update('employeeCount', Math.max(1, form.employeeCount - 1))}
                        aria-label="Decrease employee count"
                        disabled={form.employeeCount <= 1}
                      >
                        âˆ’
                      </button>
                      <div className="employee-value-wrap">
                        <span className="employee-value">{form.employeeCount}</span>
                        <span className="employee-caption">Active employees</span>
                      </div>
                      <button
                        type="button"
                        className="employee-step"
                        onClick={() => update('employeeCount', form.employeeCount + 1)}
                        aria-label="Increase employee count"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="checkout-section summary-box">
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
                      <span>Due today</span>
                      <strong>{'\u20B9'}1</strong>
                    </div>

                    <div className="summary-line summary-line--muted">
                      <span>After trial</span>
                      <strong>{getFutureBillingText(form.employeeCount, form.billingCycle)}</strong>
                    </div>
                  </div>

                  <div className="checkout-section trial-box">
                    <div className="trial-header">
                      <div className="section-head">Trial</div>
                      <div className="trial-amount">{'\u20B9'}1</div>
                    </div>
                    <p className="trial-title">Start your trial for {'\u20B9'}1</p>
                    <p className="trial-copy">{'\u20B9'}1 charged today. Your selected subscription will be billed at {getFutureBillingText(form.employeeCount, form.billingCycle)} after the trial period.</p>
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
                  {submitting ? 'Starting your trial...' : <>Start trial {'\u2014'} {'\u20B9'}1</>}
                  {!submitting && <ArrowRight size={16} />}
                  {submitting && <span className="button-spinner" aria-hidden="true" />}
                </button>
              )}
            </div>

            <div className="signup-trust">
              <span className="trust-dot" aria-hidden="true" /> Secure checkout {'\u2022'} Powered by Razorpay
            </div>
          </div>

          <p className="signup-footnote"><LockKeyhole size={14} /> {form.plan === 'VETTRI_HRMS' ? <>Selected plan: {selectedPlan.label} {'\u2022'} {form.billingCycle} billing {'\u2022'} {form.employeeCount} employees</> : 'Your trial starts when your workspace is created.'}</p>
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
  :root {
    --vettri-navy: #0f1b3d;
    --vettri-deep: #162653;
    --vettri-blue: #2563eb;
    --vettri-blue-strong: #1c4fd5;
    --vettri-surface: #f5f7fb;
    --vettri-panel: #ffffff;
    --vettri-border: #dfe7f3;
    --vettri-border-strong: #cedae9;
    --vettri-text: #0f1b3d;
    --vettri-muted: #5f6f86;
    --vettri-soft: #edf3ff;
    --vettri-gold: #f0b85a;
    --shadow-soft: 0 18px 45px rgba(15, 27, 61, 0.07);
  }

  * { box-sizing: border-box; }

  .signup-page {
    min-height: 100vh;
    display: grid;
    grid-template-columns: minmax(320px, 42%) minmax(520px, 58%);
    background: var(--vettri-surface);
    color: var(--vettri-text);
    font-family: "Manrope", "Inter", "Segoe UI", sans-serif;
  }

  .signup-brand-panel {
    background: linear-gradient(180deg, rgba(9, 20, 42, 0.98) 0%, rgba(20, 40, 75, 0.97) 100%);
    color: #fff;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: clamp(26px, 4vw, 72px);
    min-height: 100vh;
    position: relative;
    overflow: hidden;
  }

  .signup-brand-panel::before,
  .signup-brand-panel::after {
    content: "";
    position: absolute;
    border-radius: 50%;
    inset: auto;
    pointer-events: none;
  }

  .signup-brand-panel::before {
    width: 420px;
    height: 420px;
    right: -150px;
    top: 62px;
    background: radial-gradient(circle, rgba(52, 110, 255, 0.34), rgba(52, 110, 255, 0) 68%);
  }

  .signup-brand-panel::after {
    width: 320px;
    height: 320px;
    left: -100px;
    bottom: -80px;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0) 68%);
  }

  .signup-brand-top,
  .signup-brand-copy,
  .signup-trial {
    position: relative;
    z-index: 1;
  }

  .signup-brand-copy {
    max-width: 480px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .signup-brand-panel h1 {
    max-width: 470px;
    font-size: clamp(2.4rem, 3.2vw, 4.1rem);
    line-height: 0.98;
    letter-spacing: -0.06em;
    margin: 0;
    color: #ffffff;
  }

  .signup-intro {
    max-width: 420px;
    line-height: 1.7;
    font-size: 1.02rem;
    color: rgba(219, 232, 255, 0.85);
    margin: 0;
  }

  .signup-eyebrow {
    color: #f7c766;
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin: 0;
  }

  .signup-eyebrow.light {
    color: var(--vettri-blue);
    margin-top: 12px;
    letter-spacing: 0.1em;
  }

  .signup-value-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 12px;
  }

  .signup-value-list li {
    display: flex;
    align-items: center;
    gap: 12px;
    color: rgba(230, 238, 254, 0.92);
    font-size: 0.96rem;
    font-weight: 600;
  }

  .check-pill {
    width: 22px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(37, 99, 235, 0.23);
    border: 1px solid rgba(255, 255, 255, 0.14);
    color: #dff0ff;
  }

  .signup-trial {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 0.88rem;
    color: rgba(219, 232, 255, 0.9);
    margin: 0;
    padding-top: 12px;
  }

  .signup-trial span {
    display: inline-block;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--vettri-gold);
    box-shadow: 0 0 0 5px rgba(240, 184, 90, 0.16);
  }

  .signup-main {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 38px clamp(18px, 4vw, 92px);
  }

  .signup-wrap {
    width: 100%;
    max-width: 640px;
  }

  .signup-topline {
    text-align: right;
    margin-bottom: 24px;
    font-size: 0.83rem;
  }

  .signup-topline a {
    color: var(--vettri-blue-strong);
    text-decoration: none;
    font-weight: 700;
  }

  .signup-progress {
    display: flex;
    gap: 12px;
    margin-bottom: 18px;
  }

  .signup-progress-step {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    color: #7f8ca0;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.03em;
  }

  .signup-progress-step span {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #edf2fa;
    border: 1px solid #d8e1ee;
    color: #4b5d78;
    font-weight: 800;
  }

  .signup-progress-step.active {
    color: var(--vettri-blue-strong);
  }

  .signup-progress-step.active span {
    background: var(--vettri-blue);
    border-color: var(--vettri-blue);
    color: #fff;
  }

  .signup-surface {
    background: var(--vettri-panel);
    border: 1px solid var(--vettri-border);
    border-radius: 20px;
    box-shadow: var(--shadow-soft);
    padding: clamp(22px, 3vw, 34px);
  }

  .signup-surface-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }

  .signup-surface h2 {
    margin: 0;
    font-size: clamp(1.8rem, 2.4vw, 2.5rem);
    line-height: 1.08;
    letter-spacing: -0.055em;
    color: var(--vettri-text);
  }

  .signup-muted {
    margin: 10px 0 24px;
    color: var(--vettri-muted);
    font-size: 0.96rem;
    line-height: 1.6;
  }

  .signup-fields {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .signup-field-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .signup-field label {
    display: block;
    margin: 0 0 8px;
    color: #1d2d4a;
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.01em;
  }

  .signup-field input,
  .signup-field select {
    width: 100%;
    height: 52px;
    border-radius: 12px;
    border: 1px solid var(--vettri-border-strong);
    background: #fff;
    padding: 0 14px;
    font: inherit;
    color: var(--vettri-text);
    transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
  }

  .signup-field input::placeholder {
    color: #8ea2ba;
  }

  .signup-field input:focus,
  .signup-field select:focus,
  .signup-password:focus-within {
    outline: none;
    border-color: var(--vettri-blue);
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
  }

  .signup-field small,
  .signup-error {
    display: block;
    margin-top: 7px;
    color: #a93737;
    font-size: 0.74rem;
    font-weight: 600;
    line-height: 1.4;
  }

  .signup-password {
    display: flex;
    align-items: center;
    border-radius: 12px;
    border: 1px solid var(--vettri-border-strong);
    background: #fff;
    transition: border-color 0.18s ease, box-shadow 0.18s ease;
  }

  .signup-password input {
    border: 0;
    box-shadow: none !important;
    height: 52px;
    flex: 1;
  }

  .signup-password button {
    appearance: none;
    border: none;
    background: transparent;
    color: #5d6d84;
    padding: 0 14px;
    height: 52px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .checkout-layout {
    display: block;
  }

  .checkout-card {
    display: grid;
    gap: 18px;
  }

  .checkout-section {
    background: #f9fbff;
    border: 1px solid #ebf0f7;
    border-radius: 16px;
    padding: 16px 16px 14px;
  }

  .section-head {
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 800;
    color: #6d7e94;
    margin-bottom: 10px;
  }

  .checkout-plan-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: linear-gradient(180deg, #f7f9ff 0%, #f3f7ff 100%);
  }

  .plan-badge {
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 800;
    color: var(--vettri-blue);
    margin-bottom: 6px;
  }

  .plan-name {
    font-size: 1.28rem;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: var(--vettri-text);
  }

  .plan-subtitle {
    color: var(--vettri-muted);
    font-size: 0.82rem;
    margin-top: 2px;
  }

  .plan-chip {
    border-radius: 999px;
    background: rgba(37, 99, 235, 0.08);
    color: var(--vettri-blue-strong);
    padding: 7px 10px;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .billing-segment {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .billing-option {
    appearance: none;
    border: 1px solid var(--vettri-border-strong);
    background: #fff;
    border-radius: 12px;
    min-height: 102px;
    padding: 12px 10px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 6px;
    color: var(--vettri-text);
    cursor: pointer;
    transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease, background 0.18s ease;
    text-align: left;
  }

  .billing-option:hover {
    transform: translateY(-1px);
    border-color: #a7bae7;
  }

  .billing-option.selected {
    background: linear-gradient(180deg, #edf5ff 0%, #e9f2ff 100%);
    border-color: rgba(37, 99, 235, 0.9);
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08);
  }

  .billing-topline {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .billing-name {
    font-size: 0.87rem;
    font-weight: 800;
  }

  .billing-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(37, 99, 235, 0.09);
    color: var(--vettri-blue-strong);
    border-radius: 999px;
    padding: 4px 7px;
    font-size: 0.64rem;
    font-weight: 800;
    letter-spacing: 0.02em;
  }

  .billing-rate {
    font-size: 1.02rem;
    font-weight: 800;
    letter-spacing: -0.03em;
  }

  .billing-meta {
    color: #657a96;
    font-size: 0.72rem;
  }

  .employee-selector {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr) 52px;
    align-items: center;
    gap: 12px;
    background: #fff;
    border: 1px solid var(--vettri-border-strong);
    border-radius: 16px;
    padding: 12px 14px;
  }

  .employee-step {
    appearance: none;
    border: 1px solid var(--vettri-border-strong);
    background: #f7f9fd;
    color: var(--vettri-text);
    width: 40px;
    height: 40px;
    border-radius: 10px;
    font-size: 1.9rem;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
  }

  .employee-step:hover:not(:disabled) {
    border-color: rgba(37, 99, 235, 0.9);
    background: #eef5ff;
    transform: translateY(-1px);
  }

  .employee-step:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .employee-value-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    min-height: 58px;
  }

  .employee-value {
    font-size: clamp(2.1rem, 3.2vw, 2.8rem);
    line-height: 1;
    letter-spacing: -0.06em;
    font-weight: 800;
    color: var(--vettri-text);
  }

  .employee-caption {
    margin-top: 6px;
    color: var(--vettri-muted);
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 700;
  }

  .summary-box {
    background: linear-gradient(180deg, #fbfcff 0%, #f4f8ff 100%);
  }

  .summary-head {
    margin-bottom: 12px;
  }

  .summary-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 0.92rem;
    color: var(--vettri-text);
    padding: 8px 0;
  }

  .summary-line strong {
    font-size: 0.96rem;
    letter-spacing: -0.02em;
  }

  .summary-line--header {
    font-size: 0.9rem;
    color: var(--vettri-muted);
  }

  .summary-line--muted {
    color: #5d6f87;
    font-weight: 600;
  }

  .summary-divider {
    height: 1px;
    background: linear-gradient(90deg, rgba(207, 219, 234, 0.2), rgba(207, 219, 234, 1), rgba(207, 219, 234, 0.2));
    margin: 8px 0 2px;
  }

  .trial-box {
    background: linear-gradient(180deg, #f4f8ff 0%, #eef4ff 100%);
  }

  .trial-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 8px;
  }

  .trial-amount {
    font-size: 1.5rem;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: var(--vettri-blue-strong);
  }

  .trial-title {
    margin: 0 0 6px;
    font-size: 1.04rem;
    font-weight: 800;
    color: var(--vettri-text);
  }

  .trial-copy {
    margin: 0;
    color: var(--vettri-muted);
    font-size: 0.9rem;
    line-height: 1.6;
  }

  .signup-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
    border-top: 1px solid #edf1f7;
    margin-top: 22px;
    padding-top: 20px;
  }

  .signup-back,
  .signup-primary {
    appearance: none;
    border: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: 12px;
    font: inherit;
    font-weight: 800;
    transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease, background 0.18s ease;
  }

  .signup-back {
    background: transparent;
    color: #364b68;
    padding: 12px 8px;
    min-width: 92px;
  }

  .signup-back:hover:not(:disabled) {
    color: var(--vettri-text);
    transform: translateX(-1px);
  }

  .signup-primary {
    width: 100%;
    max-width: 290px;
    min-height: 54px;
    padding: 0 22px;
    background: linear-gradient(180deg, var(--vettri-blue) 0%, var(--vettri-blue-strong) 100%);
    color: #fff;
    box-shadow: 0 12px 25px rgba(37, 99, 235, 0.24);
  }

  .signup-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 15px 28px rgba(37, 99, 235, 0.28);
  }

  .signup-primary:disabled {
    opacity: 0.85;
    cursor: wait;
  }

  .button-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.45);
    border-top-color: #fff;
    border-radius: 50%;
    display: inline-block;
    animation: spin 0.8s linear infinite;
  }

  .signup-spacer {
    display: inline-block;
    width: 92px;
  }

  .signup-trust {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 14px;
    color: #6c7d96;
    font-size: 0.76rem;
    font-weight: 700;
  }

  .trust-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #4dbd8a;
    display: inline-block;
  }

  .signup-footnote {
    color: #6d7f96;
    font-size: 0.78rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    margin-top: 18px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 860px) {
    .signup-page { display: block; }
    .signup-brand-panel {
      min-height: auto;
      gap: 38px;
      padding: 28px 24px 34px;
    }
    .signup-main { padding: 28px 18px 42px; }
    .signup-wrap { max-width: 680px; }
  }

  @media (max-width: 620px) {
    .signup-field-row,
    .billing-segment {
      grid-template-columns: 1fr;
    }

    .signup-progress {
      gap: 8px;
    }

    .signup-progress-step {
      font-size: 0.63rem;
      letter-spacing: 0.01em;
    }

    .signup-topline {
      margin-bottom: 18px;
    }

    .signup-surface {
      padding: 20px 18px 22px;
      border-radius: 18px;
    }

    .signup-actions {
      flex-direction: column-reverse;
      align-items: stretch;
    }

    .signup-primary,
    .signup-back,
    .signup-spacer {
      width: 100%;
      max-width: none;
    }
  }
`;

