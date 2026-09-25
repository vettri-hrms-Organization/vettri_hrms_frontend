import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import LoginBrandPanel from '../components/auth/LoginBrandPanel';
import { mapPasswordError } from '../utils/errorMapping';

export default function Login() {
  const { login, isAuthenticated, isLoading } = useAuth();
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
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const normalizedIdentifier = identifier.trim();
    if (!normalizedIdentifier || !password.trim()) {
      setError('Please enter both your username/email and password.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await login(normalizedIdentifier, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(mapPasswordError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="vettri-login-shell">
      <LoginBrandPanel />

      <section className="vettri-login-card-page">
        <div className="vettri-login-panel">
          <form className="vettri-login-card" onSubmit={handleSubmit}>
            <div className="vettri-login-card__body">
              <div className="vettri-login-card__header">
                <h1>Welcome back</h1>
                <p>Sign in to your Vettri workspace</p>
              </div>

              <div className="vettri-login-card__fields">
            {error && <div className="vettri-login-card__error" role="alert" aria-live="polite">{error}</div>}

            <div className="vettri-login-card__field-group">
              <label htmlFor="login-identifier">Username or email</label>
              <div className="vettri-login-card__input-wrap">
                <Mail size={17} aria-hidden="true" />
                <input
                  id="login-identifier"
                  className="vettri-login-card__input"
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

            <div className="vettri-login-card__field-group">
              <div className="vettri-login-card__label-row">
                <label htmlFor="login-password">Password</label>
                <Link to="/reset-password">Forgot password?</Link>
              </div>
              <div className="vettri-login-card__input-wrap">
                <Lock size={17} aria-hidden="true" />
                <input
                  id="login-password"
                  className="vettri-login-card__input"
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
                  className="vettri-login-card__password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <label className="vettri-login-card__remember">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={() => setRememberMe((value) => !value)}
              />
              <span>Remember me for 30 days</span>
            </label>

            <button className="vettri-login-card__submit" type="submit" disabled={submitting}>
              <span>{submitting ? 'Signing in...' : 'Sign in'}</span>
              {!submitting && <ArrowRight size={17} />}
            </button>
              </div>

              <div className="vettri-login-card__divider"><span>or</span></div>

              <button
                type="button"
                className="vettri-login-card__google"
                disabled
                aria-label="Continue with Google (coming soon)"
                title="Google sign-in will be available soon"
              >
                <span className="vettri-login-card__google-icon" aria-hidden="true">G</span>
                <span>Continue with Google</span>
                <span className="vettri-login-card__google-badge">Soon</span>
              </button>

              <p className="vettri-login-card__signup">
                Don&apos;t have an account? <Link to="/signup">Create your workspace</Link>
              </p>
            </div>
          </form>

          <footer className="vettri-login-card__footer">
            <span>Need help? <a href="mailto:admin@vettrihrms.com">Contact support</a></span>
            <span>© 2026 Vettri. All rights reserved.</span>
          </footer>
        </div>
      </section>

      <style>{`
        :root {
          --vettri-login-bg: var(--hz-bg-canvas, #f4f7fb);
          --vettri-login-card-bg: #ffffff;
          --vettri-login-border: var(--hz-border, #e5eaf1);
          --vettri-login-text: var(--hz-text-primary, #172033);
          --vettri-login-muted: var(--hz-text-muted, #718096);
          --vettri-login-strong: #243954;
          --vettri-login-focus: rgba(37, 99, 235, 0.14);
          --vettri-login-error-bg: rgba(254, 242, 242, 0.9);
          --vettri-login-error-border: rgba(220, 38, 38, 0.25);
        }

        .vettri-login-card-page {
          min-width: 0;
          min-height: 100vh;
          flex: 1;
          overflow: hidden;
          background: var(--vettri-login-bg);
          color: var(--vettri-login-text);
          font-family: var(--hz-font-sans, 'Manrope', sans-serif);
        }

        .vettri-login-shell {
          min-height: 100vh;
          display: flex;
          background: var(--vettri-login-bg);
        }

        .vettri-login-panel {
          width: 100%;
          box-sizing: border-box;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          padding: 20px clamp(20px, 3vw, 44px) 16px;
        }

        .vettri-login-card {
          width: 100%;
          max-width: 360px;
          margin: auto;
          box-sizing: border-box;
        }

        .vettri-login-card__body {
          padding: 16px 0 12px;
        }

        .vettri-login-card__header {
          text-align: left;
        }

        .vettri-login-card__header h1 {
          margin: 0 0 8px;
          color: var(--vettri-login-text);
          font-size: clamp(30px, 2.5vw, 34px);
          font-weight: 750;
          letter-spacing: -0.05em;
          line-height: 1.12;
        }

        .vettri-login-card__header p {
          margin: 0;
          color: var(--vettri-login-muted);
          font-size: 13px;
        }

        .vettri-login-card__fields {
          display: grid;
          gap: 10px;
          margin-top: 20px;
        }

        .vettri-login-card__field-group {
          display: grid;
          gap: 8px;
        }

        .vettri-login-card__field-group label,
        .vettri-login-card__label-row label {
          color: var(--vettri-login-strong);
          font-size: 12px;
          font-weight: 700;
        }

        .vettri-login-card__label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .vettri-login-card__label-row a,
        .vettri-login-card__signup a,
        .vettri-login-card__footer a {
          color: var(--hz-primary-600, #2563eb);
          text-decoration: none;
          font-weight: 600;
        }

        .vettri-login-card__label-row a:hover,
        .vettri-login-card__signup a:hover,
        .vettri-login-card__footer a:hover {
          text-decoration: underline;
        }

        .vettri-login-card__input-wrap {
          position: relative;
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          min-height: 48px;
          padding: 0 12px 0 14px;
          border: 1px solid var(--vettri-login-border);
          border-radius: 12px;
          background: var(--vettri-login-card-bg);
          box-shadow: 0 1px 0 rgba(15, 23, 42, 0.02);
          transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
        }

        .vettri-login-card__input-wrap:focus-within {
          border-color: var(--hz-primary-500, #2563eb);
          box-shadow: 0 0 0 4px var(--vettri-login-focus);
          background: #fff;
        }

        .vettri-login-card__input-wrap svg {
          flex-shrink: 0;
          color: var(--vettri-login-muted);
        }

        .vettri-login-card__input {
          width: 100%;
          min-height: 46px;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--vettri-login-text);
          font-size: 14px;
          outline: none;
        }

        .vettri-login-card__input::placeholder {
          color: var(--hz-text-muted, #718096);
        }

        .vettri-login-card__input:-webkit-autofill,
        .vettri-login-card__input:-webkit-autofill:hover,
        .vettri-login-card__input:-webkit-autofill:focus {
          -webkit-text-fill-color: var(--vettri-login-text);
          -webkit-box-shadow: 0 0 0 1000px #fff inset;
          box-shadow: 0 0 0 1000px #fff inset;
          caret-color: var(--vettri-login-text);
        }

        .vettri-login-card__password-toggle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: #64748b;
          cursor: pointer;
        }

        .vettri-login-card__password-toggle:hover {
          background: #f3f6fb;
          color: #254784;
        }

        .vettri-login-card__remember {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 6px;
          color: #445d7c;
          font-size: 13px;
          cursor: pointer;
        }

        .vettri-login-card__remember input {
          margin: 0;
          accent-color: var(--hz-primary-500, #2563eb);
          width: 16px;
          height: 16px;
        }

        .vettri-login-card__submit,
        .vettri-login-card__google {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-height: 46px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
        }

        .vettri-login-card__submit {
          gap: 8px;
          margin-top: 18px;
          border: 0;
          color: #fff;
          background: linear-gradient(180deg, #2b6ef7 0%, #1655d5 100%);
          box-shadow: 0 10px 20px rgba(37, 99, 235, 0.18);
          cursor: pointer;
          transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
        }

        .vettri-login-card__submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 12px 22px rgba(37, 99, 235, 0.22);
        }

        .vettri-login-card__submit:disabled {
          opacity: 0.72;
          cursor: progress;
        }

        .vettri-login-card__divider {
          display: flex;
          align-items: center;
          gap: 15px;
          margin: 18px 0 14px;
          color: #8aa0b6;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .vettri-login-card__divider::before,
        .vettri-login-card__divider::after {
          content: '';
          height: 1px;
          flex: 1;
          background: #e4ebf3;
        }

        .vettri-login-card__google {
          gap: 10px;
          border: 1px solid #dfe7f1;
          background: #f8fafc;
          color: #475569;
          cursor: not-allowed;
          opacity: 0.82;
        }

        .vettri-login-card__google-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: linear-gradient(135deg, #4285f4, #34a853 45%, #fbbc05 70%, #ea4335);
          color: #fff;
          font-size: 12px;
          font-weight: 800;
        }

        .vettri-login-card__google-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 42px;
          min-height: 22px;
          padding: 0 8px;
          border-radius: 999px;
          background: #eef4ff;
          color: #4866bd;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .vettri-login-card__signup {
          margin: 18px 0 0;
          color: #64748b;
          font-size: 13px;
          text-align: center;
        }

        .vettri-login-card__error {
          margin: 0 0 12px;
          padding: 10px 12px;
          border: 1px solid var(--vettri-login-error-border);
          border-radius: 10px;
          background: var(--vettri-login-error-bg);
          color: #b42318;
          font-size: 12px;
          font-weight: 600;
        }

        .vettri-login-card__footer {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 12px 0 0;
          color: var(--hz-text-muted);
          font-size: 11px;
          line-height: 1.5;
          text-align: center;
        }

        @media (max-width: 760px) {
          .vettri-login-shell {
            flex-direction: column;
          }

          .vettri-login-card-page {
            min-height: auto;
            background: var(--hz-bg-canvas);
          }

          .vettri-login-panel {
            padding: 20px 16px 28px;
          }

          .vettri-login-card {
            max-width: 100%;
          }

          .vettri-login-card__footer {
            margin-top: 8px;
          }
        }
      `}</style>
    </main>
  );
}
