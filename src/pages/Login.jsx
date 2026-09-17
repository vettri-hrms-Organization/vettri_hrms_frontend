import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import LoginBrandPanel from '../components/auth/LoginBrandPanel';
import { mapPasswordError } from '../utils/errorMapping';

export default function Login() {
  const { login } = useAuth();
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

  async function handleSubmit(event) {
    event.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Please enter your username or email and password');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await login(identifier, password);
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
            {error && <div className="vettri-login-card__error" role="alert">{error}</div>}

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
        .vettri-login-card-page {
          min-width: 0;
          min-height: 100vh;
          flex: 1;
          overflow: hidden;
          background: #fff;
          color: #102a43;
          font-family: var(--hz-font-sans, 'Manrope', sans-serif);
        }

        .vettri-login-shell {
          min-height: 100vh;
          display: flex;
          background: #f4f7fb;
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
          max-width: 340px;
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
          margin: 0 0 7px;
          color: #102a43;
          font-size: clamp(30px, 2.5vw, 34px);
          font-weight: 750;
          letter-spacing: -.05em;
          line-height: 1.2;
        }

        .vettri-login-card__header p {
          margin: 0;
          color: #718096;
          font-size: 12px;
        }

        .vettri-login-card__fields {
          display: grid;
          gap: 9px;
          margin-top: 20px;
        }

        .vettri-login-card__field-group {
          display: grid;
          gap: 8px;
        }

        .vettri-login-card__field-group label,
        .vettri-login-card__label-row label {
          color: #243954;
          font-size: 13px;
          font-weight: 700;
        }

        .vettri-login-card__label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .vettri-login-card__label-row a {
          color: #1769ff;
          font-size: 12px;
          text-decoration: none;
        }

        .vettri-login-card__input-wrap {
          position: relative;
          display: flex;
          align-items: center;
          gap: 10px;
          height: 44px;
          padding: 0 13px;
          border: 1px solid #d5dee8;
          border-radius: 9px;
          color: #77899e;
          background: #fff;
          transition: border-color .2s, box-shadow .2s;
        }

        .vettri-login-card__input-wrap:focus-within {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, .1);
        }

        .vettri-login-card__input {
          min-width: 0;
          width: 100%;
          border: 0;
          outline: 0;
          color: #172c47;
          background: transparent;
          font: inherit;
          font-size: 14px;
        }

        .vettri-login-card__input::placeholder {
          color: #9aa8b8;
        }

        .vettri-login-card__input:-webkit-autofill,
        .vettri-login-card__input:-webkit-autofill:hover,
        .vettri-login-card__input:-webkit-autofill:focus {
          -webkit-text-fill-color: #172c47;
          -webkit-box-shadow: 0 0 0 1000px #fff inset;
          box-shadow: 0 0 0 1000px #fff inset;
          caret-color: #172c47;
        }

        .vettri-login-card__password-toggle {
          display: flex;
          flex: 0 0 auto;
          padding: 3px;
          border: 0;
          color: #77899e;
          background: transparent;
          cursor: pointer;
        }

        .vettri-login-card__remember {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-top: -1px;
          color: #43566d;
          font-size: 12px;
        }

        .vettri-login-card__remember input {
          width: 14px;
          height: 14px;
          margin: 0;
          accent-color: #1769ff;
        }

        .vettri-login-card__submit,
        .vettri-login-card__google {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 44px;
          border-radius: 9px;
          font: inherit;
          font-size: 14px;
          font-weight: 700;
        }

        .vettri-login-card__submit {
          gap: 10px;
          margin-top: 5px;
          border: 0;
          color: #fff;
          background: #1769ff;
          box-shadow: 0 9px 18px rgba(23, 105, 255, .2);
          cursor: pointer;
          transition: background .2s, transform .2s;
        }

        .vettri-login-card__submit:hover:not(:disabled) {
          background: #1259db;
          transform: translateY(-1px);
        }

        .vettri-login-card__submit:disabled {
          cursor: wait;
          opacity: .68;
        }

        .vettri-login-card__divider {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 12px;
          margin: 16px 0 12px;
          color: #8a99aa;
          font-size: 11px;
        }

        .vettri-login-card__divider::before,
        .vettri-login-card__divider::after {
          content: '';
          height: 1px;
          border-top: 1px dashed #dbe3eb;
        }

        .vettri-login-card__google {
          gap: 9px;
          border: 1px solid #d5dee8;
          color: #344a62;
          background: #fff;
          cursor: not-allowed;
          opacity: .7;
        }

        .vettri-login-card__signup {
          margin: 15px 0 0;
          color: #718096;
          font-size: 12px;
          text-align: center;
        }

        .vettri-login-card__signup a {
          color: #1769ff;
          font-weight: 700;
          text-decoration: none;
        }

        .vettri-login-card__google-icon {
          display: grid;
          place-items: center;
          width: 20px;
          height: 20px;
          color: #4285f4;
          font-family: Arial, sans-serif;
          font-size: 17px;
          font-weight: 800;
        }

        .vettri-login-card__error {
          padding: 10px 12px;
          border: 1px solid #f1caca;
          border-radius: 8px;
          color: #a43d3d;
          background: #fff4f4;
          font-size: 12px;
          line-height: 1.4;
        }

        .vettri-login-card__footer {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          width: 100%;
          max-width: 340px;
          margin: 0 auto;
          box-sizing: border-box;
          padding: 0;
          color: #8795a6;
          font-size: 9px;
          line-height: 1.4;
        }

        .vettri-login-card__footer a {
          color: #1769ff;
          text-decoration: none;
        }

        @media (max-width: 560px) {
          .vettri-login-shell { display: block; }

          .vettri-login-card-page {
            min-height: 100vh;
            overflow: visible;
          }

          .vettri-login-panel { padding: 20px 24px 18px; }

          .vettri-login-card__body { padding: 16px 0 12px; }

          .vettri-login-card__footer {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
        }
      `}</style>
    </main>
  );
}
