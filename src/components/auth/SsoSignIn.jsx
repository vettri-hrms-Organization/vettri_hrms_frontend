import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { authApi } from '../../api/endpoints/auth';
import { useAuth } from '../../hooks/useAuth';

export const SSO_ERROR_MESSAGES = {
  account_not_found: "We couldn't find an active Vettri account for that email. Ask your HR team to invite you first.",
  email_not_verified: "Your identity provider didn't confirm that email address, so we can't sign you in with it.",
  identity_conflict: 'This Vettri account is already linked to a different account at that provider.',
  expired: 'Your sign-in attempt expired. Please try again.',
  cancelled: 'Sign-in was cancelled.',
  unavailable: 'That sign-in option is not available right now.',
  failed: "We couldn't complete single sign-on. Please try again.",
};

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 23 23" aria-hidden="true">
      <path fill="#f35325" d="M1 1h10v10H1z" />
      <path fill="#81bc06" d="M12 1h10v10H12z" />
      <path fill="#05a6f0" d="M1 12h10v10H1z" />
      <path fill="#ffba08" d="M12 12h10v10H12z" />
    </svg>
  );
}

/**
 * "Continue with Google / Microsoft" buttons (only for providers the server has
 * configured) plus the return leg: /login?sso_code=... is exchanged once via
 * POST for the normal session (or a two-step challenge handed to onMfa).
 */
export default function SsoSignIn({ onMfa, onSignedIn, onError }) {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [providers, setProviders] = useState([]);
  const [exchanging, setExchanging] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    if (typeof authApi.ssoProviders !== 'function') return undefined;
    let cancelled = false;
    authApi.ssoProviders()
      .then((data) => { if (!cancelled) setProviders(Array.isArray(data?.providers) ? data.providers : []); })
      .catch(() => { if (!cancelled) setProviders([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (handled.current) return;
    const params = new URLSearchParams(location.search);
    const code = params.get('sso_code');
    const error = params.get('sso_error');
    if (!code && !error) return;
    handled.current = true;
    // Drop the one-time code from the address bar and history straight away.
    navigate(location.pathname, { replace: true, state: location.state });
    if (error) {
      onError?.(SSO_ERROR_MESSAGES[error] || SSO_ERROR_MESSAGES.failed);
      return;
    }
    if (typeof authApi.ssoExchange !== 'function') return;
    setExchanging(true);
    authApi.ssoExchange(code)
      .then(async (data) => {
        if (data?.mfaRequired) {
          onMfa?.({
            mfaRequired: true,
            mfaToken: data.mfaToken,
            methods: data.methods || [],
            maskedEmail: data.maskedEmail || null,
            expiresInSeconds: data.mfaExpiresInSeconds || 300,
          });
          return;
        }
        await auth.establishSession(data);
        onSignedIn?.();
      })
      .catch((err) => onError?.(err?.response?.data?.message || SSO_ERROR_MESSAGES.failed))
      .finally(() => setExchanging(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  if (exchanging) {
    return (
      <div className="text-center text-secondary small mt-4" role="status">
        <Loader2 size={16} className="me-2" aria-hidden="true" /> Completing single sign-on…
      </div>
    );
  }
  if (!providers.length) return null;

  return (
    <div className="mt-4">
      <div className="d-flex align-items-center gap-2 text-secondary small mb-3">
        <hr className="flex-grow-1 my-0" /> <span>or</span> <hr className="flex-grow-1 my-0" />
      </div>
      <div className="d-flex flex-column gap-2">
        {providers.map((provider) => (
          <a
            key={provider.id}
            href={authApi.ssoStartUrl(provider.id)}
            className="btn btn-outline-secondary w-100 d-inline-flex align-items-center justify-content-center gap-2 fw-semibold"
          >
            {provider.id === 'google' ? <GoogleMark /> : <MicrosoftMark />}
            Continue with {provider.name}
          </a>
        ))}
      </div>
    </div>
  );
}
