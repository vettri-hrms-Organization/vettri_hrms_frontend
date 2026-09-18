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
  { value: 'STARTER', label: 'Starter', price: '₹2,999/mo', employeeLimit: '25 employees', deviceLimit: '2 devices' },
  { value: 'BUSINESS', label: 'Business', price: '₹5,999/mo', employeeLimit: '100 employees', deviceLimit: '10 devices' },
  { value: 'ENTERPRISE', label: 'Enterprise', price: '₹14,999/mo', employeeLimit: '500 employees', deviceLimit: '50 devices' },
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
  plan: 'STARTER',
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
  const selectedPlanFromUrl = searchParams.get('plan') || 'STARTER';
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ ...initialForm, plan: planOptions.some((option) => option.value === selectedPlanFromUrl) ? selectedPlanFromUrl : 'STARTER' });
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
        body: JSON.stringify({ ...form, plan: form.plan }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || result.details?.[0] || 'We could not create your workspace.');

      if (result.requiresPayment) {
        const orderResponse = await fetch(`${API_BASE_URL}/api/billing/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId: result.companyId, userId: result.userId, plan: result.plan, customerName: `${form.firstName} ${form.lastName}`.trim(), customerEmail: form.email, organizationName: form.organizationName }),
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
            const verificationResponse = await fetch(`${API_BASE_URL}/api/billing/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                companyId: result.companyId,
                userId: result.userId,
                plan: result.plan,
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
          },
          prefill: { name: `${form.firstName} ${form.lastName}`.trim(), email: form.email },
          theme: { color: '#2367c9' },
        };

        const razorpayScript = document.createElement('script');
        razorpayScript.src = 'https://checkout.razorpay.com/v1/checkout.js';
        razorpayScript.async = true;
        razorpayScript.onload = () => {
          const razorpayInstance = new window.Razorpay(options);
          razorpayInstance.open();
          setSubmitting(false);
        };
        razorpayScript.onerror = () => {
          throw new Error('Unable to load Razorpay checkout.');
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
        <Logo tone="onDark" size={40} wordmarkSize="var(--hz-text-2xl)" />
        <div>
          <p className="signup-eyebrow">Vettri workplace platform</p>
          <h1>HR meets workplace operations.</h1>
          <p className="signup-intro">Bring people, payroll, attendance, devices and software into one connected workspace.</p>
        </div>
        <p className="signup-trial"><span /> 14-day free trial. No credit card required.</p>
      </aside>

      <section className="signup-main">
        <div className="signup-wrap">
          <div className="signup-topline"><Link to="/login">Already have an account? Sign in</Link></div>
          <nav className="signup-progress" aria-label="Signup progress">
            {steps.map((label, index) => <div className={`signup-progress-step ${index + 1 <= step ? 'active' : ''}`} key={label}><span>{index + 1 < step ? <Check size={13} /> : `0${index + 1}`}</span>{label}</div>)}
          </nav>
          <div className="signup-surface">
            <Logo size={34} />
            <p className="signup-eyebrow light">Step 0{step}</p>
            <h2>{step === 1 ? 'Create your Vettri account' : step === 2 ? 'Tell us about your organization' : 'Set up your workspace'}</h2>
            <p className="signup-muted">{step === 1 ? 'Start your 14-day free trial or select a paid plan.' : step === 2 ? 'This helps us prepare the right workspace.' : 'Choose what you would like to manage first.'}</p>

            {step === 1 && <AccountFields form={form} errors={errors} showPassword={showPassword} setShowPassword={setShowPassword} update={update} />}
            {step === 2 && <OrganizationFields form={form} errors={errors} update={update} />}
            {step === 3 && (
              <>
                <div className="pricing-grid">
                  {planOptions.map((option) => (
                    <button type="button" key={option.value} className={`pricing-card ${form.plan === option.value ? 'selected' : ''}`} onClick={() => update('plan', option.value)}>
                      <div className="pricing-header">
                        <span>{option.label}</span>
                        <strong>{option.price}</strong>
                      </div>
                      <div className="pricing-meta">
                        <span>{option.employeeLimit}</span>
                        <span>{option.deviceLimit}</span>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="signup-interests">{interests.map((interest) => { const selected = form.interests.includes(interest); return <button type="button" className={selected ? 'selected' : ''} aria-pressed={selected} key={interest} onClick={() => update('interests', selected ? form.interests.filter((item) => item !== interest) : [...form.interests, interest])}>{selected && <Check size={15} />}{interest}</button>; })}</div>
              </>
            )}

            {errors.submit && <p className="signup-error" role="alert">{errors.submit}</p>}
            <div className="signup-actions">
              {step > 1 ? <button className="signup-back" type="button" onClick={() => setStep((current) => current - 1)} disabled={submitting}><ArrowLeft size={16} /> Back</button> : <span />}
              {step < 3 ? <button className="signup-primary" type="button" onClick={() => validate() && setStep((current) => current + 1)}>Continue <ArrowRight size={16} /></button> : <button className="signup-primary" type="button" onClick={createWorkspace} disabled={submitting}>{submitting ? 'Processing...' : form.plan === 'STARTER' || form.plan === 'BUSINESS' || form.plan === 'ENTERPRISE' ? `Pay ${selectedPlan.price}` : 'Create my workspace'} <ArrowRight size={16} /></button>}
            </div>
          </div>
          <p className="signup-footnote"><LockKeyhole size={14} /> {form.plan === 'STARTER' || form.plan === 'BUSINESS' || form.plan === 'ENTERPRISE' ? `Selected plan: ${selectedPlan.label} • ${selectedPlan.price}` : 'Your trial starts when your workspace is created.'}</p>
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
.signup-page { min-height: 100vh; display: grid; grid-template-columns: minmax(320px, .82fr) minmax(520px, 1.18fr); background: #f7f9fc; color: #10253f; }
.signup-brand-panel { background: linear-gradient(145deg, #092747, #124b85); color: #fff; display: flex; flex-direction: column; justify-content: space-between; padding: clamp(28px, 6vw, 88px); min-height: 100vh; }
.signup-brand-panel h1 { max-width: 470px; font-size: clamp(2.3rem, 4vw, 4.5rem); line-height: 1.05; letter-spacing: -.04em; margin: 18px 0; }
.signup-intro { color: #c6d9ed; max-width: 410px; line-height: 1.7; font-size: 1.05rem; }
.signup-eyebrow { color: #ffc15c; font-size: .72rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; margin: 0; }
.signup-eyebrow.light { color: #2f76df; margin-top: 28px; }
.signup-trial { color: #d6e4f3; font-size: .84rem; margin: 0; }.signup-trial span { display: inline-block; width: 8px; height: 8px; background: #ffb000; border-radius: 50%; margin-right: 10px; }
.signup-main { display: flex; align-items: center; justify-content: center; padding: 40px clamp(20px, 5vw, 90px); }.signup-wrap { width: 100%; max-width: 610px; }.signup-topline { text-align: right; margin-bottom: 28px; font-size: .82rem; }.signup-topline a { color: #2567c8; text-decoration: none; font-weight: 600; }
.signup-progress { display: flex; gap: 12px; margin-bottom: 22px; }.signup-progress-step { display: flex; align-items: center; gap: 8px; color: #8190a4; font-size: .75rem; font-weight: 700; flex: 1; }.signup-progress-step span { width: 28px; height: 28px; border: 1px solid #cbd7e5; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; }.signup-progress-step.active { color: #1b5cae; }.signup-progress-step.active span { background: #2367c9; color: #fff; border-color: #2367c9; }
.signup-surface { background: #fff; border: 1px solid #dce5ef; border-radius: 12px; box-shadow: 0 18px 45px rgba(14, 43, 74, .08); padding: clamp(24px, 4vw, 42px); }.signup-surface h2 { font-size: clamp(1.55rem, 3vw, 2.2rem); margin: 8px 0; letter-spacing: -.03em; }.signup-muted { color: #65778e; font-size: .9rem; margin: 0 0 28px; }.signup-fields { display: flex; flex-direction: column; gap: 16px; }.signup-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }.signup-field label { display: block; font-size: .76rem; font-weight: 700; margin-bottom: 7px; }.signup-field input, .signup-field select { width: 100%; height: 48px; box-sizing: border-box; border: 1px solid #c9d6e5; border-radius: 7px; padding: 0 13px; font: inherit; color: #10253f; background: #fff; }.signup-field input:focus, .signup-field select:focus { outline: 0; border-color: #2e72d2; box-shadow: 0 0 0 3px rgba(46,114,210,.13); }.signup-field small, .signup-error { color: #b13b3b; font-size: .74rem; display: block; margin-top: 6px; }.signup-password { display: flex; border: 1px solid #c9d6e5; border-radius: 7px; overflow: hidden; }.signup-password input { border: 0; flex: 1; }.signup-password button { border: 0; background: #fff; padding: 0 13px; color: #65778e; }.signup-interests { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }.signup-interests button { min-height: 48px; text-align: left; border: 1px solid #d3deea; border-radius: 7px; background: #fff; color: #40566e; padding: 10px 12px; font: inherit; font-size: .82rem; }.signup-interests button.selected { border-color: #2e72d2; background: #eef5ff; color: #1857aa; }.signup-interests button svg { vertical-align: -3px; margin-right: 6px; }.signup-actions { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #edf1f6; margin-top: 28px; padding-top: 20px; }.signup-primary, .signup-back { border: 0; display: inline-flex; align-items: center; gap: 8px; border-radius: 7px; padding: 12px 18px; font: inherit; font-weight: 700; }.signup-primary { background: #2367c9; color: #fff; }.signup-primary:disabled { opacity: .6; }.signup-back { background: transparent; color: #65778e; }.signup-footnote { color: #8190a4; font-size: .75rem; text-align: center; margin: 18px 0 0; }.signup-footnote svg { vertical-align: -3px; margin-right: 5px; color: #d79620; }
@media (max-width: 800px) { .signup-page { display: block; }.signup-brand-panel { min-height: auto; gap: 36px; padding: 28px 24px 34px; }.signup-brand-panel h1 { font-size: 2.4rem; }.signup-main { padding: 28px 18px 40px; }.signup-topline { margin-bottom: 22px; } }
@media (max-width: 520px) { .signup-field-row, .signup-interests { grid-template-columns: 1fr; }.signup-progress-step { font-size: .68rem; }.signup-surface { padding: 22px 18px; } }
`;
