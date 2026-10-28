import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, Download, ListChecks, Pencil, Plus, Trash2, UserPlus } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Tabs from '../../components/ui/Tabs';
import StatCard from '../../components/ui/StatCard';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { onboardingApi, OWNER_TYPE_LABEL } from '../../api/endpoints/onboarding';
import { apiMessage } from '../../api/endpoints/letters';
import { formatDateIST } from '../../utils/formatDateTime';
import { exportToCsv } from '../../utils/exportToCsv';
import { ProgressBar } from './ChecklistCard';
import ChecklistTemplateDialog from './ChecklistTemplateDialog';

const TABS = [
  { key: 'active', label: 'In progress', icon: ListChecks },
  { key: 'overdue', label: 'Overdue tasks', icon: AlertTriangle },
  { key: 'templates', label: 'Templates', icon: Pencil },
];

/** HR onboarding dashboard: every in-progress checklist, overdue tasks, and checklist templates. */
export default function OnboardingDashboard() {
  const [tab, setTab] = useState('active');
  const [typeFilter, setTypeFilter] = useState('');
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['onboarding', 'dashboard'], queryFn: onboardingApi.dashboard });

  const checklists = (data?.checklists || []).filter((c) => !typeFilter || c.checklistType === typeFilter);
  const overdue = (data?.overdue || []).filter((t) => !typeFilter || t.checklistType === typeFilter);

  function exportOverdue() {
    exportToCsv('overdue-checklist-tasks.csv', overdue.map((t) => ({
      Employee: t.employeeName,
      Checklist: t.checklistType === 'EXIT' ? 'Offboarding' : 'Onboarding',
      Task: t.title,
      Owner: `${OWNER_TYPE_LABEL[t.ownerType] || t.ownerType}: ${t.ownerName}`,
      'Due date': t.dueDate,
    })));
  }

  return (
    <div className="d-flex flex-column gap-4">
      <PageHeader
        eyebrow="People"
        title="Onboarding"
        description="Track new-hire onboarding and employee exit checklists across the organization."
      />

      <div className="row g-3">
        <div className="col-12 col-md-4"><StatCard label="Checklists in progress" value={data?.inProgress ?? 0} icon={UserPlus} loading={isLoading} /></div>
        <div className="col-12 col-md-4"><StatCard label="Overdue tasks" value={data?.overdueTasks ?? 0} icon={AlertTriangle} accent="danger" loading={isLoading} /></div>
        <div className="col-12 col-md-4"><StatCard label="Due in the next 7 days" value={data?.dueThisWeek ?? 0} icon={CalendarClock} loading={isLoading} /></div>
      </div>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <Tabs items={TABS} value={tab} onChange={setTab} />
        {tab !== 'templates' && (
          <select className="form-select form-select-sm" style={{ width: 200 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Checklist type">
            <option value="">All checklists</option>
            <option value="ONBOARDING">Onboarding</option>
            <option value="EXIT">Offboarding</option>
          </select>
        )}
      </div>

      {tab !== 'templates' && isLoading && <Card><SkeletonText lines={6} /></Card>}
      {tab !== 'templates' && isError && <ErrorState onRetry={refetch} />}

      {tab === 'active' && data && (
        <Card title="In-progress checklists">
          {checklists.length === 0 ? (
            <EmptyState icon={ListChecks} title="No checklists in progress" description="Checklists start automatically when an employee is added or exits." />
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th scope="col">Employee</th>
                    <th scope="col">Checklist</th>
                    <th scope="col">Anchor date</th>
                    <th scope="col" style={{ minWidth: 180 }}>Progress</th>
                    <th scope="col">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {checklists.map((c) => (
                    <tr key={c.id} style={c.overdueTasks > 0 ? { background: 'var(--hz-danger-50, #fef2f2)' } : undefined}>
                      <td>
                        <Link to={`/employees/${c.employeeId}?tab=onboarding`} className="fw-semibold">{c.employeeName}</Link>
                        <div className="small text-muted">{c.employeeCode}</div>
                      </td>
                      <td>
                        {c.name}
                        <div><Badge variant={c.checklistType === 'EXIT' ? 'warning' : 'info'}>{c.checklistType === 'EXIT' ? 'Offboarding' : 'Onboarding'}</Badge></div>
                      </td>
                      <td>{formatDateIST(c.anchorDate)}</td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="flex-grow-1"><ProgressBar percent={c.progressPercent} /></div>
                          <span className="small">{c.doneTasks}/{c.totalTasks}</span>
                        </div>
                      </td>
                      <td>{c.overdueTasks > 0 ? <Badge variant="danger">{c.overdueTasks}</Badge> : <span className="text-muted">-</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'overdue' && data && (
        <Card
          title="Overdue tasks"
          actions={overdue.length > 0 && <Button size="sm" variant="secondary" icon={Download} onClick={exportOverdue}>Export CSV</Button>}
        >
          {overdue.length === 0 ? (
            <EmptyState icon={AlertTriangle} title="Nothing overdue" description="All checklist tasks are on schedule." />
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th scope="col">Task</th>
                    <th scope="col">Employee</th>
                    <th scope="col">Owner</th>
                    <th scope="col">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.map((t) => (
                    <tr key={t.id}>
                      <td className="fw-semibold">{t.title}</td>
                      <td><Link to={`/employees/${t.employeeId}?tab=onboarding`}>{t.employeeName}</Link></td>
                      <td>{OWNER_TYPE_LABEL[t.ownerType] || t.ownerType}: {t.ownerName}</td>
                      <td style={{ color: 'var(--hz-danger-600)' }}>{formatDateIST(t.dueDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'templates' && <TemplatesPanel />}
    </div>
  );
}

function TemplatesPanel() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(null); // template object, or {} for new
  const [deleting, setDeleting] = useState(null);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['onboarding', 'templates'], queryFn: onboardingApi.templates });
  const remove = useMutation({
    mutationFn: (id) => onboardingApi.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding', 'templates'] });
      setDeleting(null);
      toast.success('Template deleted.');
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  return (
    <Card
      title="Checklist templates"
      subtitle="Due offsets are days relative to the joining date (onboarding) or last working date (exit)."
      actions={<Button size="sm" icon={Plus} onClick={() => setEditing({})}>New template</Button>}
    >
      {isLoading && <SkeletonText lines={4} />}
      {isError && <ErrorState onRetry={refetch} />}
      {data && (
        <div className="d-flex flex-column gap-2">
          {data.map((t) => (
            <div key={t.id} className="d-flex flex-wrap align-items-center justify-content-between gap-2 p-2 rounded" style={{ border: '1px solid var(--hz-border)' }}>
              <div>
                <div className="fw-semibold">{t.name}</div>
                <div className="small text-muted d-flex flex-wrap gap-2">
                  <Badge variant={t.templateType === 'EXIT' ? 'warning' : 'info'}>{t.templateType === 'EXIT' ? 'Offboarding' : 'Onboarding'}</Badge>
                  {t.defaultTemplate && <Badge variant="primary">Default{t.autoStart ? ' · auto-start' : ''}</Badge>}
                  {!t.active && <Badge variant="neutral">Inactive</Badge>}
                  <span>{t.tasks.length} tasks</span>
                </div>
              </div>
              <div className="d-flex gap-1">
                <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(t)}>Edit</Button>
                <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setDeleting(t)} aria-label={`Delete ${t.name}`} />
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ChecklistTemplateDialog
          template={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['onboarding', 'templates'] });
            setEditing(null);
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Delete template?"
        description={deleting ? `"${deleting.name}" will no longer be available. Running checklists are not affected.` : ''}
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() => remove.mutate(deleting.id)}
        onClose={() => setDeleting(null)}
      />
    </Card>
  );
}
