import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ExternalLink, FileText, LogOut, ShieldCheck } from 'lucide-react';
import Button from '../../components/ui/Button';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { legalApi } from '../../api/endpoints/privacy';

export const LEGAL_ACCEPT_PATH = '/privacy/accept';

const DOC_HELP = {
  TERMS: 'The agreement between your organization and Vettri for using the service.',
  PRIVACY: 'How Vettri handles your account information as a data fiduciary, and your rights.',
  ACCEPTABLE_USE: 'What you may and may not do while using Vettri.',
  DPA: 'You accept this on behalf of your organization: Vettri processes employee data only on your instructions.',
};

/**
 * Login gate (see ProtectedRoute): shown when a legal document this user
 * must accept has a new version, or was never accepted.
 */
export default function LegalAcceptance() {
  const navigate = useNavigate();
  const { refreshUser, logout } = useAuth();
  const [checked, setChecked] = useState({});
  const [error, setError] = useState('');
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['legal-status'], queryFn: legalApi.status });
  const pending = data?.pending || [];
  const allChecked = pending.length > 0 && pending.every((doc) => checked[doc.type]);

  const accept = useMutation({
    mutationFn: () => legalApi.accept(pending.map((doc) => doc.type)),
    onSuccess: async () => {
      await refreshUser();
      navigate('/dashboard', { replace: true });
    },
    onError: (err) => setError(err?.response?.data?.message || 'We could not record your acceptance. Please try again.'),
  });

  return (
    <div className="hz-module-page d-flex justify-content-center">
      <section className="hz-card w-100" style={{ maxWidth: 640 }}>
        <div className="hz-card__body d-flex flex-column gap-4">
          <div className="d-flex align-items-center gap-3">
            <div className="hz-stat__icon" style={{ background: 'var(--hz-primary-50)', color: 'var(--hz-primary-600)' }}><ShieldCheck size={22} /></div>
            <div>
              <h1 className="h4 mb-1">Please review our updated terms</h1>
              <p className="text-secondary-hz mb-0">To keep using Vettri, review and accept the documents below.</p>
            </div>
          </div>

          {isLoading && <SkeletonText lines={4} />}
          {isError && <ErrorState description="Couldn't load the documents." onRetry={refetch} />}

          {!isLoading && !isError && pending.length === 0 && (
            <div className="d-flex flex-column gap-3">
              <p className="mb-0">You're up to date - nothing to accept.</p>
              <Button onClick={async () => { await refreshUser(); navigate('/dashboard', { replace: true }); }}>Continue</Button>
            </div>
          )}

          {!isLoading && !isError && pending.length > 0 && (
            <>
              <ul className="list-unstyled d-flex flex-column gap-3 mb-0">
                {pending.map((doc) => (
                  <li key={doc.type} className="border rounded p-3">
                    <label className="d-flex align-items-start gap-3 mb-0" style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        className="form-check-input mt-1"
                        checked={!!checked[doc.type]}
                        onChange={(e) => setChecked((current) => ({ ...current, [doc.type]: e.target.checked }))}
                        aria-label={`I accept the ${doc.title}`}
                      />
                      <span className="d-flex flex-column gap-1">
                        <span className="fw-semibold d-inline-flex align-items-center gap-2"><FileText size={15} /> I accept the {doc.title}</span>
                        <small className="text-secondary-hz">{DOC_HELP[doc.type]} Version {doc.version}.</small>
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="small d-inline-flex align-items-center gap-1">
                          Read the {doc.title} <ExternalLink size={12} />
                        </a>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {error && <div className="alert alert-danger mb-0" role="alert">{error}</div>}
              <div className="d-flex justify-content-between gap-2 flex-wrap">
                <Button variant="secondary" icon={LogOut} onClick={logout}>Sign out</Button>
                <Button onClick={() => accept.mutate()} disabled={!allChecked} loading={accept.isPending}>Accept and continue</Button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
