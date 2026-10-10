import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, ShieldCheck, ShieldPlus, Trash2, Lock } from 'lucide-react';
import { usersApi } from '../api/endpoints/users';
import { rolesApi, permissionsApi } from '../api/endpoints/roles';
import { auditApi } from '../api/endpoints/audit';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import StatusBadge from '../components/ui/StatusBadge';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';
import Dialog from '../components/ui/Dialog';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { userFacingError } from '../utils/userFacingError.js';
import FormField from '../components/ui/FormField';
import Tabs from '../components/ui/Tabs';
import { SkeletonText } from '../components/ui/Skeleton';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';
import PageHeader from '../components/ui/PageHeader';
import ErrorBanner from '../components/ui/ErrorBanner';
import { useAuth } from '../hooks/useAuth';

const ROLE_LABELS = {
  COMPANY_ADMIN: 'Organization Administrator',
  HR_ADMIN: 'HR Manager',
  MANAGER: 'Team Lead',
  EMPLOYEE: 'Employee',
  SUPER_ADMIN: 'Platform Administrator',
  HR_EXECUTIVE: 'HR Executive',
  HR_COORDINATOR: 'HR Coordinator',
  DEPARTMENT_MANAGER: 'Department Manager',
  IT_ADMINISTRATOR: 'IT Administrator',
};

function displayRole(role) {
  return role?.label || ROLE_LABELS[role?.name] || role?.name || ROLE_LABELS[role] || role;
}

const SCOPE_LABELS = {
  SELF: 'Self',
  TEAM: 'Team',
  DEPARTMENT: 'Department',
  ORGANIZATION: 'Company',
};
function scopesForSave(selected, scopes, permissions = []) {
  const metadata = new Map(permissions.map((permission) => [permission.code, permission]));
  return Object.fromEntries([...selected].map((code) => [
    code,
    metadata.get(code)?.requiredScope === 'ORGANIZATION' ? 'ORGANIZATION' : scopes[code] || 'ORGANIZATION',
  ]));
}

function roleOperationError(error) {
  const status = error?.response?.status;
  const safeMessage = error?.userMessage || userFacingError(error);

  if (status === 403) return "You don't have permission to manage this user's roles.";
  return safeMessage;
}

function hasOrganizationScope(user, code) {
  return (user?.scopes?.[code] || []).includes('ORGANIZATION');
}

function canAssignRoles(user, hasPermission, hasRole) {
  return hasRole('SUPER_ADMIN')
    || (['ROLE_ASSIGN', 'USER_MANAGE'].some((code) => (
      hasPermission(code) && hasOrganizationScope(user, code)
    )));
}

export default function SettingsUsers() {
  const [tab, setTab] = useState('users');
  const { hasPermission } = useAuth();
  const items = [
    ...(hasPermission('USER_VIEW') || hasPermission('USER_MANAGE') ? [{ key: 'users', label: 'Users & Access' }] : []),
    ...(hasPermission('ROLE_VIEW') ? [{ key: 'roles', label: 'Roles' }, { key: 'permissions', label: 'Permission Catalog' }] : []),
    ...(hasPermission('AUDIT_VIEW') ? [{ key: 'audit', label: 'Audit History' }] : []),
  ];
  const firstTab = items[0]?.key || '';

  useEffect(() => {
    if (!items.some((item) => item.key === tab)) setTab(firstTab);
  }, [tab, firstTab]);

  return (
    <div className="hz-admin-page hz-admin-page--users hz-settings-page d-flex flex-column gap-4">
      <PageHeader
        eyebrow="Settings"
        title="Users & Roles"
        description="Manage who can sign in to Vettri HRMS and what they're allowed to do"
      />

      <Tabs
        value={items.some((item) => item.key === tab) ? tab : items[0]?.key || ''}
        onChange={setTab}
        ariaLabel="Users and roles sections"
        items={items}
      />

      {tab === 'users' && items.some((item) => item.key === tab) && <UsersPanel />}
      {tab === 'roles' && items.some((item) => item.key === tab) && <RolesPanel />}
      {tab === 'permissions' && items.some((item) => item.key === tab) && <PermissionCatalogPanel />}
      {tab === 'audit' && items.some((item) => item.key === tab) && <AuditHistoryPanel />}
      {items.length === 0 && <p className="alert alert-info mb-0">You do not have access to user, role, or audit administration.</p>}
    </div>
  );
}

function UsersPanel() {
  const [showCreate, setShowCreate] = useState(false);
  const [editingRolesFor, setEditingRolesFor] = useState(null);
  const [managingPermissionsFor, setManagingPermissionsFor] = useState(null);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user: currentUser, hasPermission, hasRole } = useAuth();

  const { data: users, isLoading, isError, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }) => (active ? usersApi.deactivate(id) : usersApi.activate(id)),
    onSuccess: () => {
      toast.success('User status updated.');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Could not update user status.'),
  });

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-end">
        {hasPermission('USER_CREATE') && (
          <Button icon={UserPlus} onClick={() => setShowCreate(true)}>New User</Button>
        )}
      </div>

      <Card bodyClassName="p-0">
        {isLoading && (
          <div className="p-4">
            <SkeletonText lines={5} />
          </div>
        )}

        {isError && <ErrorState description="Couldn't load users - you may not have permission, or the server is unreachable." onRetry={refetch} />}

        {!isLoading && !isError && users?.length === 0 && (
          <EmptyState title="No users yet" description="Create the first account to get your team into Vettri HRMS." />
        )}

        {!isLoading && !isError && users?.length > 0 && (
          <div className="table-responsive">
            <table className="table mb-0 align-middle hz-table" aria-label="Users and roles">
            <thead>
              <tr style={{ fontSize: 'var(--hz-text-xs)', color: 'var(--hz-text-muted)', textTransform: 'uppercase' }}>
                <th className="ps-4">User</th>
                <th>Roles</th>
                <th>Status</th>
                <th>Last Login</th>
                <th className="text-end pe-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="ps-4">
                    <div className="d-flex align-items-center gap-2">
                      <Avatar name={u.fullName} size="sm" />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--hz-text-sm)' }}>{u.fullName}</div>
                        <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="d-flex gap-1 flex-wrap">
                      {u.roles.map((r) => (
                        <Badge key={r} variant="primary">
                          {displayRole(r)}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={u.active ? 'ACTIVE' : 'INACTIVE'} variant={u.active ? 'success' : 'neutral'} dot>
                      {u.active ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </td>
                  <td style={{ fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-secondary)' }}>
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="text-end pe-4">
                    <div className="d-flex justify-content-end gap-2">
                      {canAssignRoles(currentUser, hasPermission, hasRole) && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={ShieldCheck}
                          onClick={() => setEditingRolesFor(u)}
                        >
                          Edit Roles
                        </Button>
                      )}
                      {hasPermission('USER_PERMISSION_GRANT') && currentUser?.id !== u.id && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={ShieldPlus}
                          onClick={() => setManagingPermissionsFor(u)}
                        >
                          Permissions
                        </Button>
                      )}
                      {(hasPermission('USER_MANAGE')) && (
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={toggleActive.isPending && toggleActive.variables?.id === u.id}
                          onClick={() => toggleActive.mutate({ id: u.id, active: u.active })}
                        >
                          {u.active ? 'Deactivate' : 'Activate'}
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

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
      {managingPermissionsFor && (
        <UserPermissionsModal
          user={managingPermissionsFor}
          onClose={() => setManagingPermissionsFor(null)}
        />
      )}
      {editingRolesFor && (
        <EditRolesModal
          user={editingRolesFor}
          onClose={() => setEditingRolesFor(null)}
          otherSuperAdminCount={(users || []).filter((u) => u.id !== editingRolesFor.id && u.active && u.roles.includes('SUPER_ADMIN')).length}
        />
      )}
    </div>
  );
}

const GRANT_SCOPES = ['SELF', 'TEAM', 'DEPARTMENT', 'ORGANIZATION'];

function UserPermissionsModal({ user, onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const [permissionCode, setPermissionCode] = useState('');
  const [scope, setScope] = useState('SELF');
  const [grantToRevoke, setGrantToRevoke] = useState(null);

  const grantsQuery = useQuery({
    queryKey: ['user-permission-grants', user.id],
    queryFn: () => usersApi.permissionGrants(user.id),
  });
  const permissionsQuery = useQuery({
    queryKey: ['permissions'],
    queryFn: permissionsApi.list,
  });

  const assignablePermissions = (permissionsQuery.data || []).filter((permission) => (
    permission.delegable !== false
    && !permission.platformOnly
    && currentUser?.permissions?.includes(permission.code)
    && (permission.requiredScope === 'ORGANIZATION'
      ? currentUser?.scopes?.[permission.code]?.includes('ORGANIZATION')
      : (currentUser?.scopes?.[permission.code] || []).some((item) => GRANT_SCOPES.includes(item)))
  ));
  const actorScopes = currentUser?.scopes?.[permissionCode] || [];
  const maxScopeIndex = Math.max(...actorScopes.map((actorScope) => GRANT_SCOPES.indexOf(actorScope)), -1);
  const selectedPermission = (permissionsQuery.data || []).find((permission) => permission.code === permissionCode);
  const availableScopes = selectedPermission?.requiredScope === 'ORGANIZATION'
    ? ['ORGANIZATION']
    : GRANT_SCOPES.slice(0, maxScopeIndex + 1);

  useEffect(() => {
    if (!assignablePermissions.some((permission) => permission.code === permissionCode)) {
      setPermissionCode(assignablePermissions[0]?.code || '');
    }
  }, [assignablePermissions, permissionCode]);

  useEffect(() => {
    if (availableScopes.length && !availableScopes.includes(scope)) {
      setScope(availableScopes[availableScopes.length - 1]);
    } else if (!availableScopes.length && scope !== 'SELF') {
      setScope('SELF');
    }
  }, [availableScopes, scope]);

  const grant = useMutation({
    mutationFn: () => usersApi.grantPermission(user.id, { permissionCode, scope }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-permission-grants', user.id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(`Granted ${permissionCode} to ${user.fullName}.`);
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Could not grant this permission.'),
  });

  const revoke = useMutation({
    mutationFn: () => usersApi.revokePermission(user.id, grantToRevoke.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-permission-grants', user.id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(`Revoked ${grantToRevoke.permissionCode} from ${user.fullName}.`);
      setGrantToRevoke(null);
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Could not revoke this permission.'),
  });

  const activeCodes = new Set((grantsQuery.data || []).filter((item) => item.active).map((item) => item.permissionCode));
  const errorMessage = (error) => error.response?.data?.message || userFacingError(error);

  return (
    <>
      <Dialog open onClose={onClose} title="User permissions" description={user.fullName} size="lg">
        <p className="text-muted-hz mb-3" style={{ fontSize: 13 }}>
          Direct permissions supplement the user’s roles. You can only delegate permissions and scopes already available to your account.
        </p>
        <div className="border rounded-3 p-3 mb-4">
          <h3 className="h6">Effective access</h3>
          <p className="small text-muted-hz mb-2">Base role: {(user.roles || []).map(displayRole).join(', ') || 'None'}</p>
          <p className="small mb-1"><strong>Role permissions:</strong> {(user.rolePermissions || []).join(', ') || 'None'}</p>
          <p className="small mb-1"><strong>Direct grants:</strong> {(user.directPermissions || []).join(', ') || 'None'}</p>
          <p className="small mb-0"><strong>Effective permissions:</strong> {(user.permissions || []).join(', ') || 'None'}</p>
        </div>
        <div className="row g-2 align-items-end mb-4">
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="grant-permission">Permission</label>
            <select
              id="grant-permission"
              className="form-select"
              value={permissionCode}
              onChange={(event) => setPermissionCode(event.target.value)}
              disabled={permissionsQuery.isLoading || assignablePermissions.length === 0}
            >
              {assignablePermissions.map((permission) => (
                <option key={permission.code} value={permission.code}>
                  {permission.code}{permission.description ? ` — ${permission.description}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label" htmlFor="grant-scope">Scope</label>
            <select
              id="grant-scope"
              className="form-select"
              value={availableScopes.includes(scope) ? scope : ''}
              onChange={(event) => setScope(event.target.value)}
              disabled={!permissionCode || availableScopes.length === 0}
            >
              {availableScopes.map((item) => (
                <option key={item} value={item}>{SCOPE_LABELS[item] || item}</option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-3">
            <Button
              icon={ShieldPlus}
              loading={grant.isPending}
              disabled={!permissionCode || !availableScopes.includes(scope) || activeCodes.has(permissionCode)}
              onClick={() => grant.mutate()}
            >
              Grant
            </Button>
          </div>
        </div>

        {permissionsQuery.isLoading && <SkeletonText lines={2} />}
        {permissionsQuery.isError && <ErrorState description={errorMessage(permissionsQuery.error)} onRetry={permissionsQuery.refetch} />}
        {!permissionsQuery.isLoading && !permissionsQuery.isError && assignablePermissions.length === 0 && (
          <p className="alert alert-info">There are no permissions you can delegate with your current access.</p>
        )}

        <h3 className="h6">Permission grant history</h3>
        {grantsQuery.isLoading && <SkeletonText lines={3} />}
        {grantsQuery.isError && <ErrorState description={errorMessage(grantsQuery.error)} onRetry={grantsQuery.refetch} />}
        {!grantsQuery.isLoading && !grantsQuery.isError && (grantsQuery.data || []).length === 0 && (
          <p className="text-muted-hz mb-0">No direct permission grants have been recorded.</p>
        )}
        {!grantsQuery.isLoading && !grantsQuery.isError && (grantsQuery.data || []).length > 0 && (
          <div className="table-responsive">
            <table className="table align-middle mb-0 hz-table" aria-label="User permission grants">
              <thead>
                <tr>
                  <th>Permission</th>
                  <th>Scope</th>
                  <th>Status</th>
                  <th>Granted</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {grantsQuery.data.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.permissionCode}</strong>
                      {item.permissionDescription && <small className="d-block text-muted-hz">{item.permissionDescription}</small>}
                    </td>
                    <td>{SCOPE_LABELS[item.scope] || item.scope}</td>
                    <td><StatusBadge status={item.active ? 'ACTIVE' : 'INACTIVE'} variant={item.active ? 'success' : 'neutral'}>{item.active ? 'Active' : 'Revoked'}</StatusBadge></td>
                    <td>{item.grantedAt ? new Date(item.grantedAt).toLocaleString() : '—'}</td>
                    <td className="text-end">
                      {item.active && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Trash2}
                          disabled={revoke.isPending}
                          onClick={() => setGrantToRevoke(item)}
                        >
                          Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Dialog>
      <ConfirmDialog
        open={!!grantToRevoke}
        onClose={() => setGrantToRevoke(null)}
        onConfirm={() => revoke.mutate()}
        title={`Revoke ${grantToRevoke?.permissionCode || 'permission'}?`}
        description={`This removes the direct permission grant from ${user.fullName}. Permissions granted by their roles remain unchanged.`}
        confirmLabel="Revoke Permission"
        loading={revoke.isPending}
      />
    </>
  );
}

function EditRolesModal({ user, onClose, otherSuperAdminCount }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasRole } = useAuth();
  const [selected, setSelected] = useState(() => new Set(user.roles));

  const { data: roles, isLoading, isError, error: rolesError } = useQuery({
    queryKey: ['roles'],
    queryFn: rolesApi.list,
    retry: false,
  });

  const wouldRemoveLastSuperAdmin = user.roles.includes('SUPER_ADMIN') && !selected.has('SUPER_ADMIN') && otherSuperAdminCount === 0;

  const save = useMutation({
    mutationFn: () => usersApi.assignRoles(user.id, Array.from(selected)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(`Updated roles for ${user.fullName}`);
      onClose();
    },
    onError: (err) => toast.error(roleOperationError(err)),
  });

  function toggle(name) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <Dialog open onClose={onClose} title="Edit Roles" description={user.fullName} size="sm">
      {isLoading && <SkeletonText lines={4} />}
      {isError && <ErrorState description={roleOperationError(rolesError)} />}
      {!isLoading && !isError && (
        <>
          <div className="d-flex flex-column gap-2 mb-3">
            {roles?.filter((role) => hasRole('SUPER_ADMIN') || role.name !== 'SUPER_ADMIN' || user.roles.includes(role.name)).map((r) => (
              <label
                key={r.id}
                className="d-flex align-items-start gap-2 p-2 rounded-3"
                style={{ border: '1px solid var(--hz-border)', cursor: 'pointer' }}
              >
                <input type="checkbox" className="form-check-input mt-1" checked={selected.has(r.name)} onChange={() => toggle(r.name)} />
                <span>
                  <span className="d-block" style={{ fontSize: 'var(--hz-text-sm)', fontWeight: 600 }}>
                    {displayRole(r)}
                  </span>
                  {r.description && (
                    <span className="d-block" style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>
                      {r.description}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
          {wouldRemoveLastSuperAdmin && (
            <p style={{ fontSize: 12, color: 'var(--hz-danger-600)', fontWeight: 600 }}>
              {user.fullName} is the only remaining Super Admin. Removing this role would leave no one able to manage users, roles, or settings - assign Super Admin to someone else first.
            </p>
          )}
          {!wouldRemoveLastSuperAdmin && selected.size === 0 && (
            <p style={{ fontSize: 12, color: 'var(--hz-warning-600)' }}>
              This user will have no roles at all - they'll be able to log in but won't be able to do anything until a role is assigned.
            </p>
          )}
          <div className="d-flex justify-content-end gap-2 mt-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={save.isPending || wouldRemoveLastSuperAdmin}>
              Save Roles
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}

function CreateUserModal({ onClose }) {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: rolesApi.list });
  const [form, setForm] = useState({ username: '', email: '', fullName: '', temporaryPassword: '', roleNames: [] });
  const [error, setError] = useState(null);

  const createUser = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err) => setError(err.response?.data?.message || 'Could not create user'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    createUser.mutate(form);
  }

  return (
    <Dialog open onClose={onClose} title="New User" size="sm">
      <form onSubmit={handleSubmit}>
        {error && (
          <ErrorBanner>{error}</ErrorBanner>
        )}
        <FormField label="Full Name" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} required />
        <FormField label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} required />
        <FormField label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
        <div className="mb-3">
          <label className="form-label" htmlFor="new-user-role">Account role</label>
          <select
            id="new-user-role"
            className="form-select"
            value={form.roleNames[0] || 'EMPLOYEE'}
            onChange={(event) => setForm({ ...form, roleNames: [event.target.value] })}
          >
            {(rolesQuery.data || [{ name: 'EMPLOYEE', label: 'Employee' }])
              .filter((role) => hasRole('SUPER_ADMIN') || role.name !== 'SUPER_ADMIN')
              .map((role) => (
                <option key={role.id || role.name} value={role.name}>{displayRole(role)}</option>
              ))}
          </select>
        </div>
        {rolesQuery.isError && <p className="text-muted-hz small">Role options could not be loaded; Employee remains available.</p>}
        <FormField
          label="Temporary Password"
          type="password"
          value={form.temporaryPassword}
          onChange={(v) => setForm({ ...form, temporaryPassword: v })}
          required
        />
        <p style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>
          The email and username can both be used to log in. The new user will be prompted to change this password on first login.
        </p>
        <div className="d-flex justify-content-end gap-2 mt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={createUser.isPending}>
            Create User
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function RolesPanel() {
  const [showCreate, setShowCreate] = useState(false);
  const [editingPermissionsFor, setEditingPermissionsFor] = useState(null);
  const [deletingRole, setDeletingRole] = useState(null);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user: currentUser, hasPermission, hasRole } = useAuth();
  const canManageRoles = hasPermission('ROLE_MANAGE')
    && (hasRole('SUPER_ADMIN') || hasOrganizationScope(currentUser, 'ROLE_MANAGE'));

  const { data: roles, isLoading, isError, refetch } = useQuery({ queryKey: ['roles'], queryFn: rolesApi.list });

  const deleteRole = useMutation({
    mutationFn: (id) => rolesApi.remove(id),
    onSuccess: () => {
      toast.success(`Deleted role "${displayRole(deletingRole)}".`);
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setDeletingRole(null);
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Could not delete this role - it may still be assigned to users.'),
  });

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-center">
        <p className="mb-0" style={{ fontSize: 'var(--hz-text-sm)', color: 'var(--hz-text-secondary)' }}>
          Roles bundle permissions together. Build a custom role for a team that needs an access pattern the built-in roles don't cover.
        </p>
        {canManageRoles && <Button icon={ShieldPlus} onClick={() => setShowCreate(true)}>New Role</Button>}
      </div>

      <Card bodyClassName="p-0">
        {isLoading && (
          <div className="p-4">
            <SkeletonText lines={5} />
          </div>
        )}

        {isError && <ErrorState description="Couldn't load roles - you may not have permission, or the server is unreachable." onRetry={refetch} />}

        {!isLoading && !isError && roles?.length === 0 && (
          <EmptyState title="No roles yet" description="Create a role to start assigning tailored permission sets to users." />
        )}

        {!isLoading && !isError && roles?.length > 0 && (
          <div className="table-responsive">
            <table className="table mb-0 align-middle hz-table" aria-label="Roles">
              <thead>
                <tr style={{ fontSize: 'var(--hz-text-xs)', color: 'var(--hz-text-muted)', textTransform: 'uppercase' }}>
                  <th className="ps-4">Role</th>
                  <th>Permissions</th>
                  <th>Users</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r.id}>
                    <td className="ps-4">
                      <div className="d-flex align-items-center gap-2">
                        <div style={{ fontWeight: 600, fontSize: 'var(--hz-text-sm)' }}>{displayRole(r)}</div>
                        {r.systemDefined && (
                          <Badge variant="neutral" title="Built-in role - permissions are fixed by the platform">
                            <Lock size={11} className="me-1" style={{ verticalAlign: -1 }} />System
                          </Badge>
                        )}
                      </div>
                      {r.description && <div style={{ fontSize: 12, color: 'var(--hz-text-muted)' }}>{r.description}</div>}
                    </td>
                    <td>
                      <StatusBadge status={r.permissions?.length ? 'ACTIVE' : 'INACTIVE'} variant={r.permissions?.length ? 'primary' : 'neutral'}>
                        {r.permissions?.length || 0} permission{r.permissions?.length === 1 ? '' : 's'}
                      </StatusBadge>
                    </td>
                    <td>{r.assignedUserCount ?? 0}</td>
                    <td className="text-end pe-4">
                      <div className="d-flex justify-content-end gap-2">
                        <Button variant="secondary" size="sm" icon={ShieldCheck} onClick={() => setEditingPermissionsFor(r)}>
                          {r.systemDefined || !canManageRoles ? 'View Permissions' : 'Edit Permissions'}
                        </Button>
                        {!r.systemDefined && canManageRoles && (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={Trash2}
                            onClick={() => setDeletingRole(r)}
                            aria-label={`Delete role "${displayRole(r)}"`}
                          >
                            Delete
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

      {showCreate && <CreateRoleModal onClose={() => setShowCreate(false)} />}
      {editingPermissionsFor && (
        <EditPermissionsModal role={editingPermissionsFor} onClose={() => setEditingPermissionsFor(null)} canManage={canManageRoles} />
      )}
      <ConfirmDialog
        open={!!deletingRole}
        onClose={() => setDeletingRole(null)}
        onConfirm={() => deleteRole.mutate(deletingRole.id)}
        title={`Delete "${displayRole(deletingRole)}"?`}
        description="Users currently holding only this role will lose the permissions it grants. This can't be undone."
        confirmLabel="Delete Role"
        loading={deleteRole.isPending}
      />
    </div>
  );
}

function PermissionCatalogPanel() {
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const { data: permissions, isLoading, isError, refetch } = useQuery({
    queryKey: ['permissions'],
    queryFn: permissionsApi.list,
  });
  const modules = [...new Set((permissions || []).map((permission) => permission.module || 'General'))]
    .sort((left, right) => left.localeCompare(right));
  const filtered = (permissions || []).filter((permission) => (
    (!moduleFilter || (permission.module || 'General') === moduleFilter)
      && `${permission.code} ${permission.displayName || ''} ${permission.description || ''}`
        .toLowerCase().includes(search.trim().toLowerCase())
  ));

  return (
    <div className="d-flex flex-column gap-3">
      <p className="mb-0 text-muted-hz">This catalog is served by the backend and contains permissions registered for implemented modules.</p>
      <div className="row g-3">
        <div className="col-12 col-md-8">
          <label className="form-label" htmlFor="catalog-permission-search">Search permissions</label>
          <input id="catalog-permission-search" className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label" htmlFor="catalog-module-filter">Module</label>
          <select id="catalog-module-filter" className="form-select" value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
            <option value="">All modules</option>
            {modules.map((module) => <option key={module} value={module}>{module}</option>)}
          </select>
        </div>
      </div>
      {isLoading && <SkeletonText lines={5} />}
      {isError && <ErrorState description="Couldn't load the permission catalog." onRetry={refetch} />}
      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState title="No matching permissions" description="Try a different search term or module." />
      )}
      {!isLoading && !isError && filtered.length > 0 && (
        <Card bodyClassName="p-0">
          <div className="table-responsive">
            <table className="table align-middle mb-0 hz-table" aria-label="Permission catalog">
              <thead>
                <tr>
                  <th className="ps-4">Permission</th>
                  <th>Module</th>
                  <th>Scope</th>
                  <th>Risk</th>
                  <th>Delegation</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((permission) => (
                  <tr key={permission.code}>
                    <td className="ps-4">
                      <strong>{permission.displayName || permission.code}</strong>
                      <small className="d-block text-muted-hz">{permission.code}</small>
                      {permission.description && <small className="d-block text-muted-hz">{permission.description}</small>}
                    </td>
                    <td>{permission.module || 'General'}</td>
                    <td>{permission.requiredScope === 'ORGANIZATION' ? 'Company' : permission.requiredScope === 'SELF' ? 'Self' : 'Scoped'}</td>
                    <td><Badge variant={permission.risk === 'CRITICAL' || permission.risk === 'HIGH' ? 'danger' : 'neutral'}>{permission.risk || 'MEDIUM'}</Badge></td>
                    <td>{permission.platformOnly ? 'Platform only' : permission.delegable ? 'Delegable' : 'Restricted'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function AuditHistoryPanel() {
  const [entityName, setEntityName] = useState('');
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: ['role-permission-audit', entityName, page],
    queryFn: () => auditApi.logs({ page, size: 50, entityName }),
  });
  const records = query.data?.content || [];
  const totalPages = query.data?.totalPages || 0;

  return (
    <div className="d-flex flex-column gap-3">
      <p className="mb-0 text-muted-hz">Role assignments, role edits, and direct permission grants are recorded in the organization audit log.</p>
      <div className="d-flex align-items-end gap-2">
        <div>
          <label className="form-label" htmlFor="audit-entity-filter">Change type</label>
          <select
            id="audit-entity-filter"
            className="form-select"
            value={entityName}
            onChange={(event) => { setEntityName(event.target.value); setPage(0); }}
          >
            <option value="">All audit events</option>
            <option value="Role">Role changes</option>
            <option value="User">User and role assignments</option>
            <option value="UserPermissionGrant">Direct permission grants</option>
          </select>
        </div>
      </div>
      {query.isLoading && <SkeletonText lines={4} />}
      {query.isError && <ErrorState description="Couldn't load organization audit history." onRetry={query.refetch} />}
      {!query.isLoading && !query.isError && records.length === 0 && (
        <EmptyState title="No audit events" description="No matching role or permission changes were found." />
      )}
      {!query.isLoading && !query.isError && records.length > 0 && (
        <>
          <Card bodyClassName="p-0">
            <div className="table-responsive">
              <table className="table align-middle mb-0 hz-table" aria-label="Role and permission audit history">
                <thead><tr><th>When</th><th>Actor</th><th>Change</th><th>Target</th><th>Details</th></tr></thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td>{record.performedAt ? new Date(record.performedAt).toLocaleString() : '—'}</td>
                      <td>{record.performedBy || 'System'}</td>
                      <td>{record.action}</td>
                      <td>{record.entityName} {record.entityId ?? ''}</td>
                      <td>{record.details || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="d-flex justify-content-end align-items-center gap-2">
            <span className="small text-muted-hz">Page {page + 1} of {Math.max(totalPages, 1)}</span>
            <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</Button>
            <Button variant="secondary" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </div>
        </>
      )}
    </div>
  );
}

const ROLE_SCOPES = ['SELF', 'TEAM', 'DEPARTMENT', 'ORGANIZATION'];

function PermissionMatrix({ permissions, selected, onToggle, scopes = {}, onScopeChange = () => {}, readOnly = false }) {
  const { user, hasRole } = useAuth();
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const availableModules = [...new Set((permissions || []).map((permission) => permission.module || 'General'))].sort();
  const visiblePermissions = (permissions || []).filter((permission) => (
    (!moduleFilter || (permission.module || 'General') === moduleFilter)
      && `${permission.code} ${permission.displayName || ''} ${permission.description || ''}`
        .toLowerCase().includes(search.trim().toLowerCase())
  ));
  const grouped = visiblePermissions.reduce((acc, p) => {
    const module = p.module || 'General';
    (acc[module] ||= []).push(p);
    return acc;
  }, {});
  const moduleNames = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  return (
    <div className="hz-permission-matrix">
      <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
        <div className="flex-grow-1">
          <label className="form-label" htmlFor="permission-search">Search permissions</label>
          <input id="permission-search" className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div>
          <label className="form-label" htmlFor="permission-module-filter">Module</label>
          <select id="permission-module-filter" className="form-select" value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
            <option value="">All modules</option>
            {availableModules.map((module) => <option key={module} value={module}>{module}</option>)}
          </select>
        </div>
        <span className="small text-muted-hz">{selected.size} selected</span>
      </div>
      {moduleNames.map((module) => (
        <div className="hz-permission-matrix__group" key={module}>
          <h4>{module}</h4>
          <div className="hz-permission-matrix__grid">
            {grouped[module].map((permission) => (
              <label key={permission.id} className={`hz-permission-matrix__item ${readOnly ? 'is-readonly' : ''}`}>
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={selected.has(permission.code)}
                  disabled={readOnly || (!selected.has(permission.code) && (
                    permission.delegable === false || permission.platformOnly
                    || (!hasRole('SUPER_ADMIN') && !user?.permissions?.includes(permission.code))
                  ))}
                  onChange={() => onToggle(permission.code)}
                />
                <span>
                  <span className="hz-permission-matrix__code">{permission.displayName || permission.code}</span>
                  {permission.code !== permission.displayName && <small className="d-block text-muted-hz">{permission.code}</small>}
                  {permission.description && <span className="hz-permission-matrix__desc">{permission.description}</span>}
                  <small className="d-block text-muted-hz">
                    {permission.risk || 'MEDIUM'} risk{permission.readOnly ? ' · read-only' : ' · changes data'}
                    {permission.delegable === false ? ' · non-delegable' : ''}
                  </small>
                </span>
                <select
                  className="form-select form-select-sm ms-auto"
                  style={{ maxWidth: 150 }}
                  value={permission.requiredScope === 'ORGANIZATION' ? 'ORGANIZATION' : scopes?.[permission.code] || 'ORGANIZATION'}
                  disabled={readOnly || !selected.has(permission.code) || permission.requiredScope === 'ORGANIZATION'}
                  onChange={(event) => onScopeChange(permission.code, event.target.value)}
                  aria-label={`${permission.code} scope`}
                >
                  {ROLE_SCOPES.map((scope) => <option key={scope} value={scope}>{SCOPE_LABELS[scope]}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EditPermissionsModal({ role, onClose, canManage = true }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selected, setSelected] = useState(() => new Set((role.permissions || []).map((p) => p.code)));
  const [scopes, setScopes] = useState(() => ({ ...role.scopes }));
  const readOnly = role.systemDefined || !canManage;

  const { data: permissions, isLoading, isError } = useQuery({ queryKey: ['permissions'], queryFn: permissionsApi.list });

  const save = useMutation({
    mutationFn: () => rolesApi.updatePermissionsAndScopes(role.id, Array.from(selected), scopesForSave(selected, scopes, permissions || [])),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success(`Updated permissions for ${displayRole(role)}.`);
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not update permissions.'),
  });

  function toggle(code) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function changeScope(code, scope) {
    setScopes((current) => ({ ...current, [code]: scope }));
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={readOnly ? `${displayRole(role)} permissions` : `Edit permissions - ${displayRole(role)}`}
      description={readOnly ? 'This is a built-in role - its permissions are fixed by the platform.' : 'Choose exactly what this role can see and do.'}
      size="xl"
      footer={!readOnly && (
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button onClick={() => save.mutate()} loading={save.isPending}>Save Permissions</Button>
        </>
      )}
    >
      {isLoading && <SkeletonText lines={6} />}
      {isError && <ErrorState description="Couldn't load the permission list." />}
      {!isLoading && !isError && (
        <PermissionMatrix permissions={permissions} selected={selected} onToggle={toggle} scopes={scopes} onScopeChange={changeScope} readOnly={readOnly} />
      )}
    </Dialog>
  );
}

function CreateRoleModal({ onClose }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', description: '' });
  const [selected, setSelected] = useState(() => new Set());
  const [scopes, setScopes] = useState({});
  const [error, setError] = useState(null);

  const { data: permissions, isLoading, isError } = useQuery({ queryKey: ['permissions'], queryFn: permissionsApi.list });

  const createRole = useMutation({
    mutationFn: () => rolesApi.create({ name: form.name, description: form.description, permissionCodes: Array.from(selected), permissionScopes: scopesForSave(selected, scopes, permissions || []) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success(`Created role "${form.name}".`);
      onClose();
    },
    onError: (err) => setError(err.response?.data?.message || 'Could not create this role.'),
  });

  function toggle(code) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function changeScope(code, scope) {
    setScopes((current) => ({ ...current, [code]: scope }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    createRole.mutate();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="New Role"
      description="Name the role, then choose the permissions it grants."
      size="xl"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={createRole.isPending}>Cancel</Button>
          <Button onClick={handleSubmit} loading={createRole.isPending} disabled={!form.name.trim()}>Create Role</Button>
        </>
      )}
    >
      <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <FormField label="Role Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required placeholder="e.g. Regional Recruiter" />
        <FormField label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="What this role is for" />
        {isLoading && <SkeletonText lines={5} />}
        {isError && <ErrorState description="Couldn't load the permission list." />}
        {!isLoading && !isError && (
          <PermissionMatrix permissions={permissions} selected={selected} onToggle={toggle} scopes={scopes} onScopeChange={changeScope} />
        )}
      </form>
    </Dialog>
  );
}
