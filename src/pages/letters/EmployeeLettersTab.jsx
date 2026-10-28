import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FilePlus2, Mail, ScrollText } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../hooks/useAuth';
import { lettersApi, LETTER_TYPE_LABEL, apiMessage, saveBlobResponse } from '../../api/endpoints/letters';
import { formatDateTimeIST } from '../../utils/formatDateTime';
import GenerateLetterDialog from './GenerateLetterDialog';

const EXIT_STATUSES = ['Resigned', 'Terminated'];

/** Employee profile → Letters tab: issued letters (download / email) and, for HR, generation. */
export default function EmployeeLettersTab({ employee }) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('LETTER_MANAGE');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [generateType, setGenerateType] = useState(null);
  const queryKey = ['letters', 'employee', employee.id];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => lettersApi.forEmployee(employee.id),
  });

  const email = useMutation({
    mutationFn: (id) => lettersApi.email(id),
    onSuccess: (letter) => {
      queryClient.invalidateQueries({ queryKey });
      if (letter.emailStatus === 'SENT') toast.success('Letter emailed.');
      else toast.error('The email could not be delivered. Please try again later.');
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  async function download(letter) {
    try {
      saveBlobResponse(await lettersApi.download(letter.id), letter.fileName || 'letter.pdf');
    } catch (error) {
      toast.error(apiMessage(error, 'Could not download the letter.'));
    }
  }

  const exiting = EXIT_STATUSES.includes(employee.status);
  const letters = data || [];

  return (
    <div className="d-flex flex-column gap-3">
      {canManage && exiting && (
        <Card title="Exit letters" subtitle={`Last working date: ${employee.lastWorkingDate || 'not set'}`}>
          <div className="d-flex flex-wrap gap-2">
            <Button icon={FilePlus2} onClick={() => setGenerateType('RELIEVING')}>Relieving letter</Button>
            <Button variant="secondary" icon={FilePlus2} onClick={() => setGenerateType('EXPERIENCE')}>Experience letter</Button>
          </div>
        </Card>
      )}

      <Card
        title="Letters"
        subtitle="Generated HR letters. They also appear under Documents."
        actions={canManage && (
          <Button size="sm" icon={FilePlus2} onClick={() => setGenerateType('')}>Generate letter</Button>
        )}
      >
        {isLoading && <SkeletonText lines={4} />}
        {isError && <ErrorState onRetry={refetch} />}
        {!isLoading && !isError && letters.length === 0 && (
          <EmptyState icon={ScrollText} title="No letters issued" description={canManage ? 'Generate an appointment, confirmation or other letter from a template.' : 'Letters issued to you will appear here.'} />
        )}
        {letters.length > 0 && (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col">Letter</th>
                  <th scope="col">Type</th>
                  <th scope="col">Issued</th>
                  <th scope="col">Email</th>
                  <th scope="col" className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {letters.map((letter) => (
                  <tr key={letter.id}>
                    <td className="fw-semibold">{letter.title}</td>
                    <td>{LETTER_TYPE_LABEL[letter.letterType] || letter.letterType}</td>
                    <td className="small">{formatDateTimeIST(letter.issuedAt)}{letter.issuedBy ? <div className="text-muted">by {letter.issuedBy}</div> : null}</td>
                    <td>
                      {letter.emailStatus === 'SENT' && <Badge variant="success">Sent</Badge>}
                      {letter.emailStatus === 'FAILED' && <Badge variant="danger">Failed</Badge>}
                      {!letter.emailStatus && <span className="text-muted small">Not emailed</span>}
                    </td>
                    <td className="text-end">
                      <div className="d-inline-flex gap-1">
                        <Button size="sm" variant="ghost" icon={Download} onClick={() => download(letter)} aria-label={`Download ${letter.title}`}>Download</Button>
                        {canManage && (
                          <Button size="sm" variant="ghost" icon={Mail} loading={email.isPending && email.variables === letter.id} onClick={() => email.mutate(letter.id)}>
                            Email
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {generateType !== null && (
        <GenerateLetterDialog
          employee={employee}
          initialType={generateType || undefined}
          onClose={() => setGenerateType(null)}
          onGenerated={() => {
            queryClient.invalidateQueries({ queryKey });
            queryClient.invalidateQueries({ queryKey: ['employee-documents', String(employee.id)] });
            setGenerateType(null);
          }}
        />
      )}
    </div>
  );
}
