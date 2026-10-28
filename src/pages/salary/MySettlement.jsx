import { useQuery } from '@tanstack/react-query';
import { FileDown, FileText } from 'lucide-react';
import { settlementApi, formatINR } from '../../api/endpoints/settlement';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import { SkeletonText } from '../../components/ui/Skeleton';

/** Employee self-service: my approved / paid Full & Final settlement and its statement PDF. */
export default function MySettlement() {
  const { data = [], isLoading, isError, refetch } = useQuery({ queryKey: ['my-settlements'], queryFn: settlementApi.mine });

  if (isError) return <ErrorState description="Couldn't load your settlement." onRetry={refetch} />;

  return (
    <div className="hz-module-page d-flex flex-column gap-4">
      <PageHeader eyebrow="My finances" title="Full & Final settlement" description="Your final dues once your settlement is approved" />
      {isLoading && <Card><SkeletonText lines={4} /></Card>}
      {!isLoading && data.length === 0 && (
        <Card><EmptyState icon={FileText} title="No settlement yet" description="Your full and final statement appears here after HR approves it." /></Card>
      )}
      {data.map((s) => (
        <Card
          key={s.id}
          title={`Last working day ${s.lastWorkingDate}`}
          subtitle={`${s.serviceYears} years ${s.serviceMonths} months of service`}
          actions={<Button size="sm" icon={FileDown} onClick={() => settlementApi.downloadStatement(s.id, `full-and-final-${s.employeeCode || s.id}.pdf`)}>Statement PDF</Button>}
        >
          <div className="d-flex flex-wrap gap-4 align-items-center">
            <StatusBadge status={s.status} />
            <div><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>Earnings</div><strong>{formatINR(s.totalEarnings)}</strong></div>
            <div><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>Deductions</div><strong>{formatINR(s.totalDeductions)}</strong></div>
            <div><div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>Net</div><strong>{formatINR(s.netPayable)}</strong></div>
            {s.paymentReference && <div style={{ fontSize: 13 }}>Paid on {s.paymentDate} (ref {s.paymentReference})</div>}
          </div>
        </Card>
      ))}
    </div>
  );
}
