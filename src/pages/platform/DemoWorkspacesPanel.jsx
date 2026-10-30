import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Presentation, RotateCcw } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { adminApi } from '../../api/endpoints/admin';
import { formatDateTimeIST } from '../../utils/formatDateTime';

const errorMessage = (error, fallback) => error?.response?.data?.message || fallback;

/** SUPER_ADMIN: create / reset seeded sales demo companies. Credentials are shown once. */
export default function DemoWorkspacesPanel() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [credentials, setCredentials] = useState(null);
  const [confirmReset, setConfirmReset] = useState(null);
  const [copied, setCopied] = useState(false);
  const demos = useQuery({ queryKey: ['admin-demo-companies'], queryFn: adminApi.demoCompanies });

  const onSeeded = (data) => {
    setCredentials(data);
    setCopied(false);
    queryClient.invalidateQueries({ queryKey: ['admin-demo-companies'] });
    queryClient.invalidateQueries({ queryKey: ['admin-companies'] });
    queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
  };
  const create = useMutation({ mutationFn: () => adminApi.createDemoCompany(name.trim() || null), onSuccess: (data) => { setName(''); onSeeded(data); } });
  const reset = useMutation({ mutationFn: (id) => adminApi.resetDemoCompany(id), onSuccess: (data) => { setConfirmReset(null); onSeeded(data); } });

  async function copyCredentials() {
    if (!credentials) return;
    try {
      await navigator.clipboard.writeText(`Username: ${credentials.adminUsername}\nPassword: ${credentials.adminPassword}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const rows = Array.isArray(demos.data) ? demos.data : [];

  return (
    <Card title="Demo workspaces" subtitle="Seeded sample companies for sales demos (about 40 employees, 3 months of activity). Billing and outbound email/WhatsApp are skipped for them.">
      <form className="row g-3 align-items-end mb-3" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
        <div className="col-md-6">
          <label className="hz-form-label">Demo company name (optional)
            <input className="form-control" maxLength={255} placeholder="Sundaram Tech Solutions" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
        </div>
        <div className="col-md-3">
          <Button type="submit" icon={Presentation} loading={create.isPending}>Create demo company</Button>
        </div>
      </form>
      {create.isPending && <p className="text-secondary-hz">Seeding the workspace and running payroll - this can take a few seconds...</p>}
      {create.isError && <p role="alert" className="text-danger">{errorMessage(create.error, 'Could not create the demo company.')}</p>}
      {reset.isError && <p role="alert" className="text-danger">{errorMessage(reset.error, 'Could not reset the demo company.')}</p>}

      {credentials && (
        <div className="alert alert-warning" role="status">
          <strong>{credentials.companyName}</strong> is ready. Save these sign-in details now - they will not be shown again.
          <div className="mt-2"><code>Username: {credentials.adminUsername}</code></div>
          <div><code>Password: {credentials.adminPassword}</code></div>
          <div className="d-flex gap-2 mt-2">
            <Button size="sm" variant="secondary" icon={Copy} onClick={copyCredentials}>{copied ? 'Copied' : 'Copy credentials'}</Button>
            <Button size="sm" variant="secondary" onClick={() => setCredentials(null)}>I saved them</Button>
          </div>
          {credentials.counts && (
            <small className="d-block mt-2">
              {Object.entries(credentials.counts).map(([key, value]) => `${key}: ${value}`).join(' · ')}
            </small>
          )}
        </div>
      )}

      {demos.isLoading ? <p className="text-secondary-hz mb-0">Loading demo companies...</p> : rows.length === 0 ? (
        <p className="text-secondary-hz mb-0">No demo companies yet.</p>
      ) : (
        <div className="table-responsive">
          <table className="table align-middle mb-0 hz-table" aria-label="Demo companies">
            <thead><tr><th>Name</th><th>Employees</th><th>Created</th><th /></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.employees}</td>
                  <td>{formatDateTimeIST(row.createdAt)}</td>
                  <td className="text-end">
                    <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => setConfirmReset(row)}>Reset</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmReset}
        onClose={() => setConfirmReset(null)}
        onConfirm={() => reset.mutate(confirmReset.id)}
        loading={reset.isPending}
        title="Reset demo company?"
        description={confirmReset ? `All data in "${confirmReset.name}" is wiped and freshly seeded. Old demo logins stop working and a new admin password is generated.` : ''}
        confirmLabel="Reset and re-seed"
        irreversible
      />
    </Card>
  );
}
