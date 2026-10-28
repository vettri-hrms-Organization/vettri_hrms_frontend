import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, Loader2, Lock, Mail, ShieldCheck, Smartphone } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../api/endpoints/auth';
import LoginBrandPanel from '../components/auth/LoginBrandPanel';
import Logo from '../components/brand/Logo';
import { mapPasswordError } from '../utils/errorMapping';

const MFA_METHOD_LABELS = {
  TOTP: { label: 'Authenticator app', icon: Smartphone },
  EMAIL: { label: 'Email code', icon: Mail },
  RECOVERY: { label: 'Recovery code', icon: KeyRound },
};

/** Raw backend message (the axios interceptor keeps it on err.apiMessage). */
function rawApiMessage(err) {
  return String(err?.apiMessage || err?.response?.data?.message || '');
}

export function mapMfaError(err) {
  const status = err?.response?.status;
  const message = rawApiMessage(err);
  if (!err?.response) return 'We could not reach the server. Check your connection and try again.';
  if (status === 429) return 'Too many attempts. Please wait a minute and try again.';
  if (/expired\. please sign in again/i.test(message)) return 'Your sign-in session expired. Please sign in again.';
  if (/locked/i.test(message)) return message;
  if (status === 401) return "That code didn't work. Check it and try again.";
  return message || 'Verification failed. Please try again.';
}

export default function Login() {
  const { login, verifyMfa, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from
    ? `${location.state.from.pathname}${location.state.from.search || ''}${location.state.from.hash || ''}`
    : '/dashboard';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState(null);
  const [errorKey, setErrorKey] = useState(0); // re-triggers the shake animation on every new error
  const [submitting, setSubmitting] = useState(false);
  // Pending second factor ({ mfaToken, methods, maskedEmail, identifier }); the
  // home page's inline sign-in hands one over through navigation state.
  const [mfa, setMfa] = useState(() => location.state?.mfaChallenge || null);

  if (!isLoading && isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  function showError(message) {
    setError(message);
    setErrorKey((k) => k + 1);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const normalizedIdentifier = identifier.trim();
    if (!normalizedIdentifier || !password.trim()) {
      showError('Please enter both your username/email and password.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const result = await login(normalizedIdentifier, password);
      if (result?.mfaRequired) {
        setMfa(result);
        return;
      }
      navigate(from, { replace: true });
    } catch (err) {
      showError(mapPasswordError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container-fluid p-0 vettri-auth-page">
      <div className="row g-0 min-vh-100">
        <div className="col-lg-6 d-none d-lg-block">
          <LoginBrandPanel />
        </div>

        <section className="col-12 col-lg-6 min-vh-100 d-flex align-items-center justify-content-center p-3 p-md-4">
          <div className="vettri-auth-form">
            <div className="vettri-auth-mobile-brand d-lg-none">
              <Logo size={32} />
              <Link to="/signup" className="btn btn-sm btn-outline-primary px-3 fw-semibold">
                Create account
              </Link>
            </div>
            <div className="d-none d-lg-flex justify-content-end align-items-center gap-2 mb-4 small text-secondary">
              <span>New to Vettri?</span>
              <Link to="/signup" className="btn btn-sm btn-outline-primary px-3 fw-semibold">
                Create account
              </Link>
            </div>

            <div className="vettri-auth-card">
              <div className="card-body p-4 p-md-5">
                {mfa ? (
                  <MfaStep
                    challenge={mfa}
                    defaultRemember={rememberMe}
                    verifyMfa={verifyMfa}
                    onVerified={() => navigate(from, { replace: true })}
                    onCancel={() => {
                      setMfa(null);
                      setPassword('');
                    }}
                  />
                ) : (
                <>
                <div className="mb-4">
                  <span className="badge rounded-pill bg-primary-subtle text-primary border border-primary-subtle px-3 py-2 fw-semibold">
                    <ShieldCheck size={14} className="me-1" />
                    Secure workspace access
                  </span>
                  <h1 className="h2 fw-bold text-dark mt-3 mb-2">Welcome back</h1>
                  <p className="text-secondary mb-0">
                    Sign in to continue to your Vettri HRMS workspace.
                  </p>
                </div>

                {error && (
                  <div id="login-error" className="alert alert-danger border py-2 px-3 small mb-4"
                    role="alert" aria-live="polite">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  <div className="mb-3">
                    <label htmlFor="login-identifier" className="form-label fw-semibold text-dark">
                      Username or email
                    </label>
                    <div className="vettri-auth-field">
                      <Mail size={16} className="vettri-auth-field__icon" aria-hidden="true" />
                      <input
                        id="login-identifier"
                        className="form-control"
                        type="text"
                        name="username"
                        value={identifier}
                        onChange={(event) => setIdentifier(event.target.value)}
                        placeholder="Username or you@company.com"
                        autoComplete="username"
                        autoFocus
                        disabled={submitting}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? 'login-error' : undefined}
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <label htmlFor="login-password" className="form-label fw-semibold text-dark mb-0">
                        Password
                      </label>
                      <Link to="/reset-password" className="small text-primary text-decoration-none fw-semibold">
                        Forgot password?
                      </Link>
                    </div>

                    <div className="vettri-auth-field vettri-auth-field--password">
                      <Lock size={16} className="vettri-auth-field__icon" aria-hidden="true" />
                      <input
                        id="login-password"
                        className="form-control"
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        disabled={submitting}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? 'login-error' : undefined}
                        required
                      />
                      <button
                        type="button"
                        className="vettri-auth-field__toggle"
                        onClick={() => setShowPassword((visible) => !visible)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-check mb-4">
                    <input
                      id="remember-me"
                      className="form-check-input"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={() => setRememberMe((value) => !value)}
                    />
                    <label className="form-check-label small text-secondary" htmlFor="remember-me">
                      Remember me for 30 days
                    </label>
                  </div>

                  <button className="btn btn-primary w-100 py-2 fw-semibold" type="submit" disabled={submitting}>
                    {submitting ? (
                      <span className="d-inline-flex align-items-center gap-2">
                        <Loader2 size={17} /> Signing in...
                      </span>
                    ) : (
                      <span className="d-inline-flex align-items-center gap-2">
                        Sign in <ArrowRight size={17} />
                      </span>
                    )}
                  </button>
                </form>

                <p className="text-center text-secondary small mt-4 mb-0">
                  Don&apos;t have an account?{' '}
                  <Link to="/signup" className="text-primary text-decoration-none fw-semibold">
                    Create your workspace
                  </Link>
                </p>
                </>
                )}
              </div>
            </div>

            <footer className="text-center text-secondary small mt-3">
              <div>
                Need help?{' '}
                <a href="mailto:admin@vettrihrms.com" className="text-primary text-decoration-none fw-semibold">
                  Contact support
                </a>
              </div>
              <div className="mt-1">© 2026 Vettri. All rights reserved.</div>
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}

/**
 * Second sign-in step: the password was right, now prove the second factor
 * with an authenticator code, an emailed code or a one-time recovery code.
 */
export function MfaStep({ challenge, defaultRemember = false, verifyMfa, onVerified, onCancel }) {
  const methods = challenge.methods?.length ? challenge.methods : ['TOTP'];
  const [method, setMethod] = useState(methods[0]);
  const [code, setCode] = useState('');
  const [remember, setRemember] = useState(defaultRemember);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const autoSent = useRef(false);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function sendEmailCode() {
    setSending(true);
    setError(null);
    try {
      const sent = await authApi.sendMfaEmailCode(challenge.mfaToken);
      setInfo(`We sent a 6-digit code to ${sent?.sentTo || challenge.maskedEmail || 'your email'}.`);
      setResendIn(sent?.resendAfterSeconds || 60);
    } catch (err) {
      setError(mapMfaError(err));
    } finally {
      setSending(false);
    }
  }

  // Email is the only factor (e.g. the company requires 2FA and the user has
  // not enrolled yet): send the code straight away.
  useEffect(() => {
    if (method === 'EMAIL' && methods.length === 1 && !autoSent.current) {
      autoSent.current = true;
      sendEmailCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);

  function chooseMethod(next) {
    setMethod(next);
    setCode('');
    setError(null);
    setInfo(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError(method === 'RECOVERY' ? 'Enter one of your recovery codes.' : 'Enter the 6-digit code.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await verifyMfa({
        mfaToken: challenge.mfaToken,
        method,
        code: trimmed,
        rememberDevice: remember,
        identifier: challenge.identifier,
      });
      onVerified?.();
    } catch (err) {
      setError(mapMfaError(err));
      setCode('');
    } finally {
      setSubmitting(false);
    }
  }

  const isRecovery = method === 'RECOVERY';
  const prompt = {
    TOTP: 'Open your authenticator app and enter the 6-digit code for Vettri HRMS.',
    EMAIL: challenge.maskedEmail
      ? `We'll email a 6-digit code to ${challenge.maskedEmail}.`
      : "We'll email a 6-digit code to your registered address.",
    RECOVERY: 'Enter one of the recovery codes you saved when you set up two-step verification. Each code works once.',
  }[method];

  return (
    <div>
      <div className="mb-4">
        <span className="badge rounded-pill bg-primary-subtle text-primary border border-primary-subtle px-3 py-2 fw-semibold">
          <ShieldCheck size={14} className="me-1" />
          Two-step verification
        </span>
        <h1 className="h2 fw-bold text-dark mt-3 mb-2">Verify it&apos;s you</h1>
        <p className="text-secondary mb-0">{prompt}</p>
      </div>

      {methods.length > 1 && (
        <div className="btn-group w-100 mb-3" role="group" aria-label="Verification method">
          {methods.map((value) => {
            const meta = MFA_METHOD_LABELS[value] || { label: value, icon: ShieldCheck };
            const Icon = meta.icon;
            return (
              <button
                key={value}
                type="button"
                className={`btn btn-sm ${method === value ? 'btn-primary' : 'btn-outline-primary'}`}
                aria-pressed={method === value}
                onClick={() => chooseMethod(value)}
                disabled={submitting}
              >
                <Icon size={14} className="me-1" aria-hidden="true" />
                {meta.label}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div id="mfa-error" className="alert alert-danger border py-2 px-3 small mb-3" role="alert" aria-live="polite">
          {error}
        </div>
      )}
      {info && !error && (
        <div className="alert alert-info border py-2 px-3 small mb-3" role="status">
          {info}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {method === 'EMAIL' && (
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm w-100 mb-3"
            onClick={sendEmailCode}
            disabled={sending || resendIn > 0}
          >
            {sending ? 'Sending...' : resendIn > 0 ? `Resend code in ${resendIn}s` : info ? 'Resend code' : 'Email me a code'}
          </button>
        )}

        <div className="mb-3">
          <label htmlFor="mfa-code" className="form-label fw-semibold text-dark">
            {isRecovery ? 'Recovery code' : 'Verification code'}
          </label>
          <input
            id="mfa-code"
            className="form-control"
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder={isRecovery ? 'xxxxx-xxxxx' : '123456'}
            inputMode={isRecovery ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            maxLength={isRecovery ? 20 : 8}
            autoFocus
            disabled={submitting}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'mfa-error' : undefined}
          />
        </div>

        <div className="form-check mb-4">
          <input
            id="mfa-remember"
            className="form-check-input"
            type="checkbox"
            checked={remember}
            onChange={() => setRemember((value) => !value)}
          />
          <label className="form-check-label small text-secondary" htmlFor="mfa-remember">
            Remember this device for 30 days
          </label>
        </div>

        <button className="btn btn-primary w-100 py-2 fw-semibold" type="submit" disabled={submitting}>
          {submitting ? (
            <span className="d-inline-flex align-items-center gap-2">
              <Loader2 size={17} /> Verifying...
            </span>
          ) : (
            <span className="d-inline-flex align-items-center gap-2">
              Verify <ArrowRight size={17} />
            </span>
          )}
        </button>
      </form>

      <button type="button" className="btn btn-link w-100 mt-3 small text-decoration-none" onClick={onCancel}>
        <ArrowLeft size={14} className="me-1" aria-hidden="true" />
        Back to sign in
      </button>
    </div>
  );
}
