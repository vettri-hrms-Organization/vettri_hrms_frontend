import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, MailWarning } from 'lucide-react';
import { authApi } from '../api/endpoints/auth';
import AuthPageShell from '../components/auth/AuthPageShell';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState(token ? 'loading' : 'invalid');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    authApi.verifyEmail(token)
      .then((result) => {
        if (!cancelled) setState(result.status === 'ALREADY_VERIFIED' ? 'already' : 'success');
      })
      .catch((error) => {
        if (!cancelled) {
          setState('invalid');
          setMessage(error.response?.data?.message || 'This verification link is invalid or expired.');
        }
      });
    return () => { cancelled = true; };
  }, [token]);

  const success = state === 'success' || state === 'already';
  return (
    <AuthPageShell>
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: 24, color: success ? 'var(--hz-success-600)' : 'var(--hz-danger-600)' }}>
          {success ? <CheckCircle2 size={48} style={{ margin: '0 auto' }} /> : <MailWarning size={48} style={{ margin: '0 auto' }} />}
        </div>
        <h1 style={{ fontSize: 'var(--hz-text-2xl)', fontWeight: 700, marginBottom: 8 }}>
          {state === 'loading' ? 'Verifying your email' : success ? 'Email verified' : 'Verification link unavailable'}
        </h1>
        <p style={{ fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-muted)', marginBottom: 32 }}>
          {state === 'loading'
            ? 'Please wait while we secure your Vettri HRMS account.'
            : success
              ? state === 'already' ? 'This email address has already been verified.' : 'Your email address is now verified. You can sign in to Vettri HRMS.'
              : message || 'This verification link is invalid or expired.'}
        </p>
        {state !== 'loading' && (
          <Link to="/login" className="btn btn-primary" style={{ minWidth: 200 }}>
            Go to Login
          </Link>
        )}
      </div>
    </AuthPageShell>
  );
}
