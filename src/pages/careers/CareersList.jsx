import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, Building2, Users } from 'lucide-react';
import { careersApi } from '../../api/endpoints/recruitment';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { formatStatusLabel } from '../../components/ui/StatusBadge';
import PublicLayout from './PublicLayout';

export default function CareersList() {
  const { data: jobs, isLoading, isError, refetch } = useQuery({ queryKey: ['careers-jobs'], queryFn: careersApi.listOpenJobs });
  const openRoles = jobs?.length || 0;

  const hero = (
    <section className="hz-public__hero">
      <div className="hz-public__hero-inner">
        <span className="hz-public__eyebrow">Careers</span>
        <h1>Build what&apos;s next with us</h1>
        <p>We&apos;re growing. Explore the roles we&apos;re hiring for and apply in a couple of minutes.</p>
        {!isLoading && !isError && openRoles > 0 && (
          <span className="hz-public__count"><Briefcase size={15} aria-hidden="true" /> {openRoles} open role{openRoles === 1 ? '' : 's'}</span>
        )}
      </div>
    </section>
  );

  return (
    <PublicLayout hero={hero}>
      {isError && <ErrorState description="Couldn't load open positions right now." onRetry={refetch} />}

      {!isError && (
        <div className="hz-careers-grid">
          {isLoading && Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}

          {!isLoading && openRoles === 0 && (
            <div className="hz-careers-grid__full hz-card">
              <EmptyState icon={Briefcase} title="No open positions right now" description="Please check back soon. New roles are posted regularly." />
            </div>
          )}

          {!isLoading && jobs?.map((job) => (
            <Link to={`/careers/${job.id}`} className="hz-career-card" key={job.id}>
              <span className="hz-career-card__icon" aria-hidden="true"><Briefcase size={18} /></span>
              <h2>{job.title}</h2>
              <ul className="hz-career-card__meta">
                {job.departmentName && <li><Building2 size={14} aria-hidden="true" /> {job.departmentName}</li>}
                <li>{formatStatusLabel(job.employmentType || 'FULL_TIME')}</li>
                {job.openingsCount > 0 && <li><Users size={14} aria-hidden="true" /> {job.openingsCount} opening{job.openingsCount === 1 ? '' : 's'}</li>}
              </ul>
              {job.description && <p>{job.description}</p>}
              <span className="hz-career-card__cta">View role and apply <ArrowRight size={15} aria-hidden="true" /></span>
            </Link>
          ))}
        </div>
      )}
    </PublicLayout>
  );
}
