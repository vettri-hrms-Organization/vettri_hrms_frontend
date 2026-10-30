import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { isPublicAuthRoute } from '../../auth/authRoutes';
import { vettriMicrocopy } from '../../utils/vettriMicrocopy';

/**
 * Minimal in-app toast system - the Salary module is the first feature
 * that needs fire-and-forget confirmations (email sent, payroll processed,
 * etc.), so it's introduced here rather than pulling in a new dependency.
 * Follows the same "introduced alongside the first module that needs it"
 * pattern BaseEntity's javadoc describes on the backend.
 *
 * Each toast shows a short heading for its variant above the message, a
 * countdown bar that pauses while hovered, and errors stay longer so they
 * can be read. Identical messages already on screen are refreshed instead
 * of stacking, and at most MAX_VISIBLE toasts are shown.
 */
const ToastContext = createContext(null);

const MAX_VISIBLE = 4;
const VARIANTS = {
  success: { icon: CheckCircle2, title: 'Done', duration: 4000 },
  error: { icon: XCircle, title: "That didn't work", duration: 7000 },
  warning: { icon: AlertTriangle, title: 'Please check', duration: 6000 },
  info: { icon: Info, title: 'Good to know', duration: 5000 },
};

/** Sentence-case the message and end it with punctuation, so every toast reads the same way. */
export function polishToastMessage(message) {
  if (typeof message !== 'string') return message;
  const text = message.trim();
  if (!text) return text;
  const capitalised = text.charAt(0).toUpperCase() + text.slice(1);
  return /[.!?)…:]$/.test(capitalised) ? capitalised : `${capitalised}.`;
}

function ToastItem({ toast, onDismiss }) {
  const config = VARIANTS[toast.variant] || VARIANTS.info;
  const Icon = config.icon;
  const [paused, setPaused] = useState(false);
  const remaining = useRef(toast.duration);
  const startedAt = useRef(Date.now());

  // A repeated message restarts the countdown.
  useEffect(() => { remaining.current = toast.duration; }, [toast.version, toast.duration]);

  useEffect(() => {
    if (toast.duration <= 0 || paused) return undefined;
    startedAt.current = Date.now();
    const timer = setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [toast.id, toast.duration, toast.version, paused, onDismiss]);

  return (
    <div
      className={`hz-toast hz-toast--${toast.variant}`}
      role={toast.variant === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span className="hz-toast__icon" aria-hidden="true"><Icon size={18} /></span>
      <div className="hz-toast__content">
        <strong className="hz-toast__title">{toast.title || config.title}</strong>
        <span className="hz-toast__message">{toast.message}</span>
      </div>
      <button type="button" className="hz-toast__close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss">
        <X size={14} />
      </button>
      {toast.duration > 0 && (
        <span
          key={toast.version}
          className="hz-toast__progress"
          style={{ animationDuration: `${toast.duration}ms`, animationPlayState: paused ? 'paused' : 'running' }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const location = useLocation();

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (rawMessage, variant = 'success', duration, kind = 'generic', title) => {
      const message = polishToastMessage(rawMessage);
      if (!message) return;
      const ttl = duration ?? (VARIANTS[variant] || VARIANTS.info).duration;
      setToasts((prev) => {
        const existing = prev.find((t) => t.message === message && t.variant === variant);
        if (existing) {
          return prev.map((t) => (t === existing ? { ...t, version: t.version + 1 } : t));
        }
        const next = [...prev, { id: Date.now() + Math.random(), message, variant, kind, title, duration: ttl, version: 0 }];
        return next.slice(-MAX_VISIBLE);
      });
    },
    []
  );

  useEffect(() => {
    if (isPublicAuthRoute(location.pathname)) {
      setToasts((prev) => prev.filter((toast) => toast.kind !== 'session-expired'));
    }
  }, [location.pathname]);

  useEffect(() => {
    function handleApiError(event) {
      const message = event.detail?.message;
      if (message) push(message, 'error');
    }

    function handleSessionExpired(event) {
      const message = event.detail?.message;
      if (message && !isPublicAuthRoute(location.pathname)) push(message, 'error', 8000, 'session-expired', 'Session ended');
    }

    window.addEventListener('vettri:api-error', handleApiError);
    window.addEventListener('vettri:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('vettri:api-error', handleApiError);
      window.removeEventListener('vettri:session-expired', handleSessionExpired);
    };
  }, [location.pathname, push]);

  const api = useMemo(
    () => ({
      success: (message = vettriMicrocopy.success.saved) => push(message, 'success'),
      error: (message = vettriMicrocopy.error.generic) => push(message, 'error'),
      warning: (message) => push(message, 'warning'),
      info: (message) => push(message, 'info'),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="hz-toast-stack" aria-live="polite">
        {toasts.map((t) => <ToastItem key={t.id} toast={t} onDismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
