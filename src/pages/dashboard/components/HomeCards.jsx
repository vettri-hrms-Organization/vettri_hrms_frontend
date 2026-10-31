import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowRight, CalendarOff, Cake, Check, CheckCircle2, ClipboardCheck, FileSignature, HeartHandshake, Laptop,
  LifeBuoy, ListChecks, MessageSquareText, Rocket, Sparkles, Star, X,
} from 'lucide-react';
import { homeApi, askVettri } from '../../../api/endpoints/home';
import Avatar from '../../../components/ui/Avatar';
import './home-cards.css';

const TODO_ICONS = {
  sign: FileSignature, reviews: Star, surveys: MessageSquareText, tickets: LifeBuoy, pip: ListChecks,
  leave: CalendarOff, probation: HeartHandshake,
};

function Heading({ id, title, meta = null, link = null }) {
  return (
    <div className="hz-dash__panel-heading">
      <h2 id={id}>{title}</h2>
      <div className="hz-dash__panel-meta">
        {meta}
        {link && <Link to={link.to} className="hz-dash__link">{link.label} <ArrowRight size={14} aria-hidden="true" /></Link>}
      </div>
    </div>
  );
}

function Empty({ icon: Icon, title, description }) {
  return (
    <div className="hz-dash__empty">
      <Icon size={20} aria-hidden="true" />
      <div><strong>{title}</strong><small>{description}</small></div>
    </div>
  );
}

function Skeleton({ rows = 3 }) {
  return (
    <div className="hz-dash__list-skeleton" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <span key={i} className="hz-dash__skeleton" />)}
    </div>
  );
}

/** Everything waiting on the signed-in person, from every module, in one list. */
export function TodosCard() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['home-todos'], queryFn: homeApi.todos, staleTime: 30_000 });
  const todos = data || [];
  const total = todos.reduce((n, t) => n + t.count, 0);
  return (
    <section className="hz-dash__panel" aria-labelledby="home-todos-title">
      <Heading id="home-todos-title" title="Your to-dos" meta={!isLoading && total > 0 ? <span className="hz-dash__count">{total} waiting</span> : null} />
      {isLoading ? <Skeleton rows={3} /> : isError ? (
        <Empty icon={ClipboardCheck} title="To-dos could not load" description="Refresh the page to try again." />
      ) : todos.length === 0 ? (
        <Empty icon={CheckCircle2} title="You're all caught up" description="Approvals, documents to sign, reviews and surveys will show up here." />
      ) : (
        <ul className="hz-dash__list hz-home-todos">
          {todos.map((t) => {
            const Icon = TODO_ICONS[t.key] || ClipboardCheck;
            return (
              <li key={t.key}>
                <Link to={t.link} className="hz-home-todo">
                  <span className={`hz-home-todo__icon hz-home-todo__icon--${t.tone}`}><Icon size={17} aria-hidden="true" /></span>
                  <span className="hz-home-todo__copy">
                    <strong>{t.title}</strong>
                    <small>{t.detail}</small>
                  </span>
                  <span className="hz-home-todo__count">{t.count}</span>
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Setup progress for new workspaces; hides itself when complete or dismissed. */
export function SetupChecklist() {
  const { data } = useQuery({ queryKey: ['home-setup'], queryFn: homeApi.setup, staleTime: 60_000 });
  const [dismissed, setDismissed] = useState(() => {
    try { return window.localStorage.getItem('vettri.setup.dismissed') === '1'; } catch { return false; }
  });
  if (!data?.visible || dismissed) return null;
  const pct = Math.round((data.done / data.total) * 100);
  const next = data.steps.find((s) => !s.done);
  const dismiss = () => {
    setDismissed(true);
    try { window.localStorage.setItem('vettri.setup.dismissed', '1'); } catch { /* private mode */ }
  };
  return (
    <section className="hz-dash__panel hz-home-setup" aria-labelledby="home-setup-title">
      <div className="hz-home-setup__top">
        <span className="hz-home-setup__badge" aria-hidden="true"><Rocket size={20} /></span>
        <div className="hz-home-setup__intro">
          <h2 id="home-setup-title">Get your workspace ready</h2>
          <p>{data.done} of {data.total} done{next ? ` · Next: ${next.title.toLowerCase()}` : ''}</p>
          <div className="hz-home-setup__bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Setup progress">
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
        <button type="button" className="hz-home-setup__close" onClick={dismiss} aria-label="Hide setup checklist" title="Hide (you can reopen it from Workspace Setup)">
          <X size={16} />
        </button>
      </div>
      <ol className="hz-home-setup__steps">
        {data.steps.map((s) => (
          <li key={s.key} className={s.done ? 'is-done' : ''}>
            <Link to={s.link}>
              <span className="hz-home-setup__tick" aria-hidden="true">{s.done ? <Check size={13} strokeWidth={3} /> : null}</span>
              <span>
                <strong>{s.title}</strong>
                <small>{s.detail}</small>
              </span>
              {!s.done && <ArrowRight size={14} aria-hidden="true" className="hz-home-setup__go" />}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PeopleList({ people, empty }) {
  if (!people?.length) return <Empty {...empty} />;
  return (
    <ul className="hz-dash__list">
      {people.map((p) => (
        <li key={`${p.employeeId}-${p.date}`}>
          <span className="hz-dash__person">
            <Avatar name={p.name} src={p.photoUrl} size="sm" />
            <span><strong>{p.name}</strong></span>
            <time>{p.detail}</time>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Today's team pulse: who is out, upcoming work anniversaries and (optionally) birthdays, plus an IT snapshot
 * for admins who manage company laptops.
 */
/** `extra` panels (e.g. new joiners, next holiday on the admin home) join the same grid. */
export function TeamPulse({ showBirthdays = false, extra = [] }) {
  const { data, isLoading } = useQuery({ queryKey: ['home-today'], queryFn: homeApi.today, staleTime: 60_000 });
  const panels = [
    <section key="out" className="hz-dash__panel" aria-labelledby="home-out-title">
      <Heading id="home-out-title" title="Out today" meta={data?.outToday?.length ? <span className="hz-dash__count">{data.outToday.length}</span> : null} />
      {isLoading ? <Skeleton rows={2} /> : <PeopleList people={data?.outToday} empty={{ icon: CheckCircle2, title: 'Everyone is in today', description: 'People on approved leave show here.' }} />}
    </section>,
    showBirthdays && (
      <section key="bday" className="hz-dash__panel" aria-labelledby="home-bday-title">
        <Heading id="home-bday-title" title="Birthdays" />
        {isLoading ? <Skeleton rows={2} /> : <PeopleList people={data?.birthdays} empty={{ icon: Cake, title: 'No birthdays in the next two weeks', description: 'Birthdays show when a date of birth is on the profile.' }} />}
      </section>
    ),
    <section key="anniv" className="hz-dash__panel" aria-labelledby="home-anniv-title">
      <Heading id="home-anniv-title" title="Work anniversaries" />
      {isLoading ? <Skeleton rows={2} /> : <PeopleList people={data?.anniversaries} empty={{ icon: HeartHandshake, title: 'None in the next two weeks', description: 'Work anniversaries come from each joining date.' }} />}
    </section>,
    data?.it && (
      <section key="it" className="hz-dash__panel" aria-labelledby="home-it-title">
        <Heading id="home-it-title" title="Company laptops" link={{ to: '/monitoring/devices', label: 'Devices' }} />
        {data.it.devices === 0 ? (
          <Empty icon={Laptop} title="No laptops connected yet" description="Install the Vettri agent to see every laptop, its user and its status." />
        ) : (
          <div className="hz-home-it">
            <div><strong>{data.it.online}</strong><small>online now</small></div>
            <div><strong>{data.it.devices}</strong><small>laptops</small></div>
            <div className={data.it.notSeenForWeek ? 'is-warn' : ''}><strong>{data.it.notSeenForWeek}</strong><small>not seen for a week</small></div>
            <div className={data.it.unassigned ? 'is-warn' : ''}><strong>{data.it.unassigned}</strong><small>without an employee</small></div>
          </div>
        )}
      </section>
    ),
    ...extra,
  ].filter(Boolean);
  return <div className={`hz-dash__grid ${panels.length >= 3 ? 'hz-dash__grid--three' : 'hz-dash__grid--main'}`}>{panels}</div>;
}

const SUGGESTIONS = ['How many leave days do I have left?', 'When is the next holiday?', 'Show my latest payslip'];

/** A prompt box that opens the Ask Vettri assistant with the question already typed. */
export function AskVettriBox() {
  const [q, setQ] = useState('');
  const submit = (text) => askVettri((text ?? q).trim());
  return (
    <section className="hz-dash__panel hz-home-ask" aria-labelledby="home-ask-title">
      <Heading id="home-ask-title" title="Ask Vettri" />
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="hz-home-ask__form">
        <Sparkles size={17} aria-hidden="true" />
        <label htmlFor="home-ask-input" className="visually-hidden">Ask Vettri a question</label>
        <input id="home-ask-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about leave, pay, holidays, policies…" maxLength={500} />
        <button type="submit" className="btn btn-primary btn-sm">Ask</button>
      </form>
      <div className="hz-home-ask__chips">
        {SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => submit(s)}>{s}</button>)}
      </div>
    </section>
  );
}
