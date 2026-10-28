import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListChecks, Play } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Dialog from '../../components/ui/Dialog';
import FormField from '../../components/ui/FormField';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../hooks/useAuth';
import { onboardingApi } from '../../api/endpoints/onboarding';
import { apiMessage } from '../../api/endpoints/letters';
import ChecklistCard from './ChecklistCard';

/** Employee profile → Onboarding tab: checklist progress, task completion, and (HR) manual start. */
export default function EmployeeOnboardingTab({ employee }) {
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission('ONBOARDING_MANAGE');
  const selfView = String(user?.employeeId) === String(employee.id);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showStart, setShowStart] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const queryKey = ['onboarding', 'employee', employee.id];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => onboardingApi.forEmployee(employee.id),
  });

  const cancel = useMutation({
    mutationFn: (id) => onboardingApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setCancelTarget(null);
      toast.success('Checklist cancelled.');
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  if (isLoading) return <Card><SkeletonText lines={5} /></Card>;
  if (isError) return <ErrorState onRetry={refetch} />;

  const checklists = data || [];

  return (
    <div className="d-flex flex-column gap-3">
      {canManage && (
        <div className="d-flex justify-content-end">
          <Button icon={Play} onClick={() => setShowStart(true)}>Start checklist</Button>
        </div>
      )}

      {checklists.length === 0 ? (
        <Card>
          <EmptyState
            icon={ListChecks}
            title="No checklists yet"
            description={canManage
              ? 'Onboarding starts automatically for new employees. You can also start an onboarding or exit checklist manually.'
              : 'There are no onboarding or exit tasks for this employee.'}
          />
        </Card>
      ) : (
        checklists.map((checklist) => (
          <ChecklistCard
            key={checklist.id}
            checklist={checklist}
            selfView={selfView}
            canManage={canManage}
            onCancel={setCancelTarget}
            queryKeys={[queryKey, ['onboarding', 'my'], ['onboarding', 'dashboard']]}
          />
        ))
      )}

      {showStart && (
        <StartChecklistDialog
          employee={employee}
          onClose={() => setShowStart(false)}
          onStarted={() => {
            queryClient.invalidateQueries({ queryKey });
            setShowStart(false);
          }}
        />
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel checklist?"
        description={cancelTarget ? `"${cancelTarget.name}" will stop and no further reminders will be sent.` : ''}
        confirmLabel="Cancel checklist"
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate(cancelTarget.id)}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  );
}

function StartChecklistDialog({ employee, onClose, onStarted }) {
  const toast = useToast();
  const isExiting = ['Resigned', 'Terminated'].includes(employee.status);
  const [templateId, setTemplateId] = useState('');
  const [anchorDate, setAnchorDate] = useState('');
  const { data: templates, isLoading } = useQuery({ queryKey: ['onboarding', 'templates'], queryFn: onboardingApi.templates });
  const active = (templates || []).filter((t) => t.active);
  const defaultTemplate = active.find((t) => t.defaultTemplate && t.templateType === (isExiting ? 'EXIT' : 'ONBOARDING'));
  const chosen = templateId || (defaultTemplate ? String(defaultTemplate.id) : '');
  const chosenTemplate = active.find((t) => String(t.id) === chosen);

  const start = useMutation({
    mutationFn: () => onboardingApi.start({
      employeeId: employee.id,
      templateId: chosen ? Number(chosen) : undefined,
      anchorDate: anchorDate || undefined,
    }),
    onSuccess: () => {
      toast.success('Checklist started. Task owners have been notified.');
      onStarted();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const anchorHint = chosenTemplate?.templateType === 'EXIT'
    ? 'Defaults to the last working date.'
    : 'Defaults to the date of joining.';

  return (
    <Dialog
      open
      onClose={onClose}
      title="Start checklist"
      description={`Create a checklist for ${employee.fullName}. Due dates are offsets from the anchor date.`}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={start.isPending} disabled={!chosen} onClick={() => start.mutate()}>Start</Button>
        </>
      )}
    >
      {isLoading ? <SkeletonText lines={2} /> : (
        <div className="d-flex flex-column gap-3">
          <FormField as="select" label="Template" value={chosen} onChange={setTemplateId} required>
            <option value="">Select a template</option>
            {active.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.templateType === 'EXIT' ? 'Exit' : 'Onboarding'}, {t.tasks.length} tasks)
              </option>
            ))}
          </FormField>
          <FormField type="date" label="Anchor date (optional)" value={anchorDate} onChange={setAnchorDate} hint={anchorHint} />
        </div>
      )}
    </Dialog>
  );
}
