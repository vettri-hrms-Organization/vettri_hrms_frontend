import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
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
  const [errorKey, setErrorKey] = useState(0); // re-triggers the shake animation on every new error
  const [submitting, setSubmitting] = useState(false);

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
      await login(normalizedIdentifier, password);
      navigate(from, { replace: true });
    } catch (err) {
      showError(mapPasswordError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container-fluid p-0">
      <div className="row g-0 min-vh-100">
        <div className="col-lg-6 d-none d-lg-block">
          <LoginBrandPanel />
        </div>

        <section className="col-12 col-lg-6 min-vh-100 bg-light d-flex align-items-center justify-content-center p-3 p-md-4">
          <div className="w-100" style={{ maxWidth: 440 }}>
            <div className="d-flex justify-content-end align-items-center gap-2 mb-4 small text-secondary">
              <span>New to Vettri?</span>
              <Link to="/signup" className="btn btn-sm btn-outline-primary px-3 fw-semibold">
                Create account
              </Link>
            </div>

            <div className="card border-0 shadow-sm rounded-4">
              <div className="card-body p-4 p-md-5">
                <div className="mb-4">
                  <span className="badge rounded-pill bg-primary-subtle text-primary border border-primary-subtle px-3 py-2 fw-semibold">
                    <ShieldCheck size={14} className="me-1" />
                    Secure sign in
                  </span>
                  <h1 className="h2 fw-bold text-dark mt-3 mb-2">Welcome back</h1>
                  <p className="text-secondary mb-0">
                    Sign in to continue to your Vettri workspace.
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
                    <div className="input-group bg-white border-end-0 text-secondary">
                      {/* <span className="input-group-text bg-white border-end-0 text-secondary">
                        <Mail size={18} />
                      </span> */}
                      <input
                        id="login-identifier"
                        className="form-control border-start-0"
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

                    <div className="input-group">
                      {/* <span className="input-group-text bg-white border-end-0 text-secondary">
                        <Lock size={18} />
                      </span> */}
                      <input
                        id="login-password"
                        className="form-control border-start-0 border-end-0"
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
                        className="btn btn-outline-secondary border-start-0 bg-white"
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

                <div className="d-flex align-items-center gap-3 my-4">
                  <hr className="flex-grow-1 border-secondary-subtle my-0" />
                  <span className="small text-secondary fw-semibold">OR</span>
                  <hr className="flex-grow-1 border-secondary-subtle my-0" />
                </div>

                <button
                  type="button"
                  className="btn btn-outline-secondary w-100 py-2 fw-semibold bg-white"
                  disabled
                  aria-label="Continue with Google (coming soon)"
                  title="Google sign-in will be available soon"
                >
                  <span className="d-inline-flex align-items-center gap-2">
                    <span className="fw-bold">G</span>
                    <span>Continue with Google</span>
                    <span className="badge rounded-pill bg-light text-secondary border">Soon</span>
                  </span>
                </button>

                <p className="text-center text-secondary small mt-4 mb-0">
                  Don&apos;t have an account?{' '}
                  <Link to="/signup" className="text-primary text-decoration-none fw-semibold">
                    Create your workspace
                  </Link>
                </p>
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
