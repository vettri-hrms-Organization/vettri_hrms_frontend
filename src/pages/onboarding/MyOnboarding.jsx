import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListChecks, ClipboardCheck } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { onboardingApi } from '../../api/endpoints/onboarding';
import { apiMessage } from '../../api/endpoints/letters';
import ChecklistCard, { TaskRow } from './ChecklistCard';

/**
 * "My onboarding" self-service page: the signed-in employee's own
 * onboarding / exit checklist, plus tasks they own on colleagues'
 * checklists (as manager, IT or a named owner).
 */
export default function MyOnboarding() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const mine = useQuery({ queryKey: ['onboarding', 'my'], queryFn: onboardingApi.my });
  const tasks = useQuery({ queryKey: ['onboarding', 'my-tasks'], queryFn: onboardingApi.myTasks });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['onboarding', 'my'] });
    queryClient.invalidateQueries({ queryKey: ['onboarding', 'my-tasks'] });
  };
  const onError = (error) => toast.error(apiMessage(error));
  const complete = useMutation({ mutationFn: (id) => onboardingApi.complete(id, {}), onSuccess: () => { refresh(); toast.success('Task completed.'); }, onError });
  const upload = useMutation({ mutationFn: ({ id, file }) => onboardingApi.uploadDocument(id, file), onSuccess: () => { refresh(); toast.success('Document uploaded.'); }, onError });

  const checklists = mine.data || [];
  const assigned = tasks.data || [];
  const active = checklists.filter((c) => c.status === 'IN_PROGRESS');
  const nothing = !mine.isLoading && !tasks.isLoading && checklists.length === 0 && assigned.length === 0;

  return (
    <div className="d-flex flex-column gap-4">
      <PageHeader
        eyebrow="My workspace"
        title="My onboarding"
        description={active.length
          ? 'Complete your tasks below. HR, your manager and IT can see your progress.'
          : 'Your onboarding and exit tasks, and tasks assigned to you for colleagues.'}
      />

      {(mine.isLoading || tasks.isLoading) && <Card><SkeletonText lines={5} /></Card>}
      {mine.isError && <ErrorState onRetry={mine.refetch} />}

      {nothing && (
        <Card>
          <EmptyState icon={ListChecks} title="Nothing to do here" description="You have no onboarding tasks right now." />
        </Card>
      )}

      {checklists.map((checklist) => (
        <ChecklistCard
          key={checklist.id}
          checklist={checklist}
          selfView
          queryKeys={[['onboarding', 'my'], ['onboarding', 'my-tasks']]}
        />
      ))}

      {assigned.length > 0 && (
        <Card title="Tasks assigned to you" subtitle="Onboarding and offboarding tasks you own for colleagues">
          <ul className="list-unstyled mb-0 d-flex flex-column gap-2">
            {assigned.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                showEmployee
                busy={complete.isPending || upload.isPending}
                onComplete={() => complete.mutate(task.id)}
                onUpload={(file) => upload.mutate({ id: task.id, file })}
                onReopen={() => {}}
                onSkip={() => {}}
              />
            ))}
          </ul>
        </Card>
      )}

      {!tasks.isLoading && assigned.length === 0 && checklists.length > 0 && (
        <p className="small text-muted d-flex align-items-center gap-2 mb-0">
          <ClipboardCheck size={14} aria-hidden="true" /> No tasks are waiting on you for colleagues.
        </p>
      )}
    </div>
  );
}
