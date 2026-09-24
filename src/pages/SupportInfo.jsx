import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BookOpenText, Headphones, PlusCircle, Search, ShieldAlert, WalletCards } from 'lucide-react';
import Dialog from '../components/ui/Dialog';
import FormField from '../components/ui/FormField';
import Button from '../components/ui/Button';
import { selfServiceApi } from '../api/endpoints/selfService';
import { useAuth } from '../hooks/useAuth';

const supportLevels = [
  { label: 'Level 1', title: 'General support', icon: Headphones, description: 'For everyday questions about using Vettri HRMS and its core workflows.' },
  { label: 'Level 2', title: 'Account & billing', icon: WalletCards, description: 'For workspace, account, payment, and billing-related assistance.' },
  { label: 'Level 3', title: 'Escalation', icon: ShieldAlert, description: 'For priority issues and specialist review when your case needs deeper support.' },
];

const helpTopics = [
  'Accessing your profile and workspace settings',
  'Attendance, leave, and payroll questions',
  'Employee record updates and document requirements',
  'Recruitment, onboarding, and support workflows',
];

export default function SupportInfo() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: '', description: '', category: 'GENERAL', priority: 'NORMAL' });
  const queryClient = useQueryClient();
  const { data: requests = [], isLoading } = useQuery({ queryKey: ['support-requests'], queryFn: selfServiceApi.supportRequests });

  const createRequest = useMutation({
    mutationFn: selfServiceApi.createSupportRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-requests'] });
      setForm({ subject: '', description: '', category: 'GENERAL', priority: 'NORMAL' });
      setOpen(false);
    },
  });

  return (
    <div className="hz-page-shell hz-support-page">
      <header className="hz-support-hero">
        <div className="hz-support-hero__copy">
          <p className="hz-dashboard__eyebrow">Support</p>
          <h1>How can we help?</h1>
          <p>Everything you need to get support, find answers, and track requests in one place.</p>
        </div>
        <div className="hz-support-hero__search">
          <Search size={16} />
          <input type="text" value="" placeholder="Search help topics..." aria-label="Search help topics" readOnly />
        </div>
      </header>

      <section className="hz-support-grid" aria-label="Support levels">
        {supportLevels.map(({ label, title, icon: Icon, description }) => (
          <article className="hz-support-card" key={label}>
            <div className="hz-support-card__icon"><Icon size={18} /></div>
            <span>{label}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <div className="hz-dashboard__overview-grid">
        <section className="hz-dashboard__surface">
          <div className="hz-dashboard__section-heading">
            <div>
              <span className="hz-dashboard__section-kicker">Quick help</span>
              <h2>Popular topics</h2>
            </div>
            <Button variant="secondary" onClick={() => setOpen(true)} icon={PlusCircle}>Raise a request</Button>
          </div>
          <div className="hz-help-list">
            {helpTopics.map((topic) => (
              <div className="hz-help-item" key={topic}>
                <BookOpenText size={15} />
                <span>{topic}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="hz-dashboard__surface">
          <div className="hz-dashboard__section-heading">
            <div>
              <span className="hz-dashboard__section-kicker">Requests</span>
              <h2>My support requests</h2>
            </div>
          </div>
          {isLoading ? (
            <div className="hz-dashboard__mini-list">
              <div className="hz-dashboard__mini-item">
                <span className="hz-dashboard__mini-bullet" />
                <div><strong>Loading requests</strong><small>Checking your request history.</small></div>
              </div>
            </div>
          ) : requests.length === 0 ? (
            <div className="hz-support-empty">
              <Headphones size={20} />
              <div>
                <strong>No requests yet</strong>
                <small>Your support request history will appear here.</small>
              </div>
            </div>
          ) : (
            <div className="hz-dashboard__mini-list">
              {requests.slice(0, 4).map((request) => (
                <div className="hz-dashboard__mini-item" key={request.id || request.subject}>
                  <span className="hz-dashboard__mini-bullet" />
                  <div>
                    <strong>{request.subject}</strong>
                    <small>{request.category || 'General'} · {request.status || 'Open'}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="hz-dashboard__surface hz-support-meta">
        <div className="hz-dashboard__section-heading">
          <div>
            <span className="hz-dashboard__section-kicker">Workspace</span>
            <h2>Support information</h2>
          </div>
        </div>
        <div className="hz-support-meta__list">
          <div className="hz-support-meta__item">
            <span>Primary contact</span>
            <strong>{user?.email || 'Support team'}</strong>
          </div>
          <div className="hz-support-meta__item">
            <span>Workspace</span>
            <strong>{user?.companyName || 'Current company'}</strong>
          </div>
          <div className="hz-support-meta__item">
            <span>Help status</span>
            <strong>Available</strong>
          </div>
        </div>
      </section>

      <Dialog open={open} onClose={() => setOpen(false)} title="Raise a support request" description="Tell your support team what you need help with.">
        <form onSubmit={(event) => { event.preventDefault(); createRequest.mutate(form); }}>
          <FormField label="Subject" required value={form.subject} onChange={(value) => setForm((current) => ({ ...current, subject: value }))} />
          <FormField as="select" label="Category" value={form.category} onChange={(value) => setForm((current) => ({ ...current, category: value }))}>
            <option value="GENERAL">General</option>
            <option value="ACCOUNT">Account</option>
            <option value="PAYROLL">Payroll</option>
            <option value="ATTENDANCE">Attendance</option>
            <option value="LEAVE">Leave</option>
          </FormField>
          <FormField as="textarea" label="Description" required rows={4} value={form.description} onChange={(value) => setForm((current) => ({ ...current, description: value }))} />
          <div className="d-flex justify-content-end gap-2 mt-3">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={createRequest.isPending}>Submit request</Button>
          </div>
        </form>
      </Dialog>

      <div className="hz-dashboard__support-strip hz-support-footer-strip">
        <div>
          <span className="hz-dashboard__section-kicker">Need a quicker answer?</span>
          <h2>Use the support workflow for active issues</h2>
          <p>Keep your request details organized and track follow-up in one place.</p>
        </div>
        <button type="button" className="hz-dashboard__text-link hz-support-footer-strip__button" onClick={() => setOpen(true)}>
          Raise a support request <ArrowRight size={15} />
        </button>
        <Headphones size={28} aria-hidden="true" />
      </div>
    </div>
  );
}
