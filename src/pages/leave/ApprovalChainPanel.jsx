import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, Plus, X } from 'lucide-react';
import { approvalWorkflowApi, errorText } from '../../api/endpoints/workflows';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';

const LEVELS = {
  REPORTING_MANAGER: ['Reporting manager', 'The person the employee reports to'],
  SKIP_LEVEL_MANAGER: ['Skip-level manager', "The reporting manager's manager"],
  HR: ['HR', 'Anyone with leave approval rights for the whole company'],
};

/** Multi-level leave approval: who approves, in what order, and when the extra levels apply. */
export default function ApprovalChainPanel() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['approval-workflow', 'LEAVE'], queryFn: () => approvalWorkflowApi.get('LEAVE') });
  const [levels, setLevels] = useState([]);
  const [minDays, setMinDays] = useState('');
  useEffect(() => {
    if (!data) return;
    setLevels(data.levels?.length ? data.levels : ['REPORTING_MANAGER']);
    setMinDays(data.fullChainMinDays ?? '');
  }, [data]);
  const save = useMutation({
    mutationFn: () => approvalWorkflowApi.save('LEAVE', { levels, fullChainMinDays: minDays === '' ? null : Number(minDays) }),
    onSuccess: (v) => {
      queryClient.setQueryData(['approval-workflow', 'LEAVE'], v);
      toast.success(v.active ? 'Approval chain saved. New leave requests follow it.' : 'Single-step approval saved.');
    },
    onError: (e) => toast.error(errorText(e, 'Could not save the approval chain.')),
  });
  if (isLoading) return <Card><SkeletonText lines={4} /></Card>;
  const unused = Object.keys(LEVELS).filter((l) => !levels.includes(l));
  return (
    <Card title="Leave approval chain" subtitle="With two or more levels, a request moves to the next approver after each approval. HR can approve at any level to finish it.">
      <div className="d-flex flex-column gap-2" style={{ maxWidth: 520 }}>
        {levels.map((l, i) => (
          <div key={l}>
            {i > 0 && <div className="text-center" style={{ color: 'var(--hz-text-muted)' }}><ArrowDown size={14} aria-hidden="true" /></div>}
            <div className="d-flex align-items-center justify-content-between gap-2 p-2 px-3" style={{ border: '1px solid var(--hz-border)', borderRadius: 10 }}>
              <div>
                <strong style={{ fontSize: 14 }}>{i + 1}. {LEVELS[l][0]}</strong>
                <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{LEVELS[l][1]}</div>
              </div>
              {levels.length > 1 && (
                <button type="button" className="btn btn-sm btn-light border-0" aria-label={`Remove ${LEVELS[l][0]}`} onClick={() => setLevels((all) => all.filter((x) => x !== l))}><X size={14} /></button>
              )}
            </div>
          </div>
        ))}
        {unused.length > 0 && (
          <div className="d-flex gap-2 flex-wrap mt-1">
            {unused.map((l) => <Button key={l} size="sm" variant="secondary" icon={Plus} onClick={() => setLevels((all) => [...all, l])}>{LEVELS[l][0]}</Button>)}
          </div>
        )}
        {levels.length > 1 && (
          <FormField type="number" min={0} step={0.5} label="Only use the extra levels for leave longer than (days)" value={minDays} onChange={setMinDays}
            hint="Blank = always. E.g. 3 means up to 3 days needs only the first approver." />
        )}
        <p className="mb-0" style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>
          Levels that don't apply to someone (no manager, or no skip-level manager) are skipped. Requests already pending keep moving under the new chain.
        </p>
        <div><Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button></div>
      </div>
    </Card>
  );
}
