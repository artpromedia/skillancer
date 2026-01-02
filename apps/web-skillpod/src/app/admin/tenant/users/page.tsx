'use client';

/**
 * Tenant User Management Page
 * Invite, manage, and configure user access
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  MoreHorizontal,
  Mail,
  Shield,
  Upload,
  Download,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Check,
  X,
  Trash2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@skillancer/ui/card';
import { Button } from '@skillancer/ui/button';
import { Input } from '@skillancer/ui/input';
import { Badge } from '@skillancer/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@skillancer/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@skillancer/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@skillancer/ui/select';
import { Label } from '@skillancer/ui/label';
import { Textarea } from '@skillancer/ui/textarea';
import { useToast } from '@skillancer/ui/use-toast';

// =============================================================================
// TYPES
// =============================================================================

type UserRole = 'SUPER_ADMIN' | 'SECURITY_ADMIN' | 'USER_ADMIN' | 'VIEWER' | 'USER';
type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'INVITED';

interface TenantUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  mfaEnabled: boolean;
}

interface UserListResponse {
  users: TenantUser[];
  total: number;
  page: number;
  pageSize: number;
}

interface InviteUserPayload {
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

async function fetchUsers(params: {
  page: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
}): Promise<UserListResponse> {
  const searchParams = new URLSearchParams({
    page: params.page.toString(),
    pageSize: '20',
  });
  if (params.search) searchParams.set('search', params.search);
  if (params.role) searchParams.set('role', params.role);
  if (params.status) searchParams.set('status', params.status);

  const response = await fetch(`/api/admin/tenant/users?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch users');
  return response.json();
}

async function inviteUser(payload: InviteUserPayload): Promise<void> {
  const response = await fetch('/api/admin/tenant/users/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to invite user');
  }
}

async function bulkInviteUsers(
  emails: string[],
  role: UserRole
): Promise<{ success: number; failed: string[] }> {
  const response = await fetch('/api/admin/tenant/users/bulk-invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emails, role }),
  });
  if (!response.ok) throw new Error('Failed to bulk invite');
  return response.json();
}

async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  const response = await fetch(`/api/admin/tenant/users/${userId}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!response.ok) throw new Error('Failed to update role');
}

async function suspendUser(userId: string): Promise<void> {
  const response = await fetch(`/api/admin/tenant/users/${userId}/suspend`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to suspend user');
}

async function reactivateUser(userId: string): Promise<void> {
  const response = await fetch(`/api/admin/tenant/users/${userId}/reactivate`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to reactivate user');
}

async function removeUser(userId: string): Promise<void> {
  const response = await fetch(`/api/admin/tenant/users/${userId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to remove user');
}

async function resendInvite(userId: string): Promise<void> {
  const response = await fetch(`/api/admin/tenant/users/${userId}/resend-invite`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to resend invite');
}

// =============================================================================
// COMPONENTS
// =============================================================================

const roleLabels: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  SECURITY_ADMIN: 'Security Admin',
  USER_ADMIN: 'User Admin',
  VIEWER: 'Viewer',
  USER: 'User',
};

const roleColors: Record<UserRole, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-800',
  SECURITY_ADMIN: 'bg-red-100 text-red-800',
  USER_ADMIN: 'bg-blue-100 text-blue-800',
  VIEWER: 'bg-gray-100 text-gray-800',
  USER: 'bg-green-100 text-green-800',
};

const statusColors: Record<UserStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  SUSPENDED: 'bg-red-100 text-red-800',
  INVITED: 'bg-yellow-100 text-yellow-800',
};

function InviteUserDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<UserRole>('USER');
  const { toast } = useToast();

  const inviteMutation = useMutation({
    mutationFn: inviteUser,
    onSuccess: () => {
      toast({ title: 'Invitation sent', description: `Invite sent to ${email}` });
      setOpen(false);
      setEmail('');
      setFirstName('');
      setLastName('');
      setRole('USER');
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inviteMutation.mutate({ email, firstName, lastName, role });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Invite New User</DialogTitle>
            <DialogDescription>Send an invitation to join your organization.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="VIEWER">Viewer (Read-only)</SelectItem>
                  <SelectItem value="USER_ADMIN">User Admin</SelectItem>
                  <SelectItem value="SECURITY_ADMIN">Security Admin</SelectItem>
                  <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? 'Sending...' : 'Send Invite'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BulkImportDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState('');
  const [role, setRole] = useState<UserRole>('USER');
  const [result, setResult] = useState<{ success: number; failed: string[] } | null>(null);
  const { toast } = useToast();

  const bulkMutation = useMutation({
    mutationFn: () => {
      const emailList = emails
        .split(/[\n,;]/)
        .map((e) => e.trim())
        .filter((e) => e.length > 0 && e.includes('@'));
      return bulkInviteUsers(emailList, role);
    },
    onSuccess: (data) => {
      setResult(data);
      if (data.success > 0) {
        toast({ title: 'Bulk import complete', description: `${data.success} users invited` });
        onSuccess();
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleClose = () => {
    setOpen(false);
    setEmails('');
    setRole('USER');
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Bulk Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Import Users</DialogTitle>
          <DialogDescription>
            Enter email addresses separated by commas, semicolons, or new lines.
          </DialogDescription>
        </DialogHeader>
        {!result ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email Addresses</Label>
              <Textarea
                placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com"
                rows={6}
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Default Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                  <SelectItem value="USER_ADMIN">User Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="flex items-center text-green-600">
              <Check className="mr-2 h-5 w-5" />
              {result.success} users invited successfully
            </div>
            {result.failed.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center text-red-600">
                  <X className="mr-2 h-5 w-5" />
                  {result.failed.length} failed
                </div>
                <div className="text-muted-foreground bg-muted max-h-32 overflow-auto rounded p-2 text-sm">
                  {result.failed.join(', ')}
                </div>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={() => bulkMutation.mutate()} disabled={bulkMutation.isPending}>
                {bulkMutation.isPending ? 'Importing...' : 'Import Users'}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserRow({ user, onRefresh }: { user: TenantUser; onRefresh: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState<UserRole>(user.role);

  const updateRoleMutation = useMutation({
    mutationFn: () => updateUserRole(user.id, newRole),
    onSuccess: () => {
      toast({ title: 'Role updated' });
      setRoleDialogOpen(false);
      onRefresh();
    },
    onError: (e: Error) =>
      toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const suspendMutation = useMutation({
    mutationFn: () => suspendUser(user.id),
    onSuccess: () => {
      toast({ title: 'User suspended' });
      onRefresh();
    },
    onError: (e: Error) =>
      toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const reactivateMutation = useMutation({
    mutationFn: () => reactivateUser(user.id),
    onSuccess: () => {
      toast({ title: 'User reactivated' });
      onRefresh();
    },
    onError: (e: Error) =>
      toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const removeMutation = useMutation({
    mutationFn: () => removeUser(user.id),
    onSuccess: () => {
      toast({ title: 'User removed' });
      onRefresh();
    },
    onError: (e: Error) =>
      toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const resendMutation = useMutation({
    mutationFn: () => resendInvite(user.id),
    onSuccess: () => toast({ title: 'Invitation resent' }),
    onError: (e: Error) =>
      toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const displayName = user.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`
    : user.email;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <>
      <tr className="hover:bg-muted/50 border-b">
        <td className="px-4 py-4">
          <div>
            <p className="font-medium">{displayName}</p>
            <p className="text-muted-foreground text-sm">{user.email}</p>
          </div>
        </td>
        <td className="px-4 py-4">
          <Badge className={roleColors[user.role]}>{roleLabels[user.role]}</Badge>
        </td>
        <td className="px-4 py-4">
          <Badge className={statusColors[user.status]}>{user.status}</Badge>
        </td>
        <td className="text-muted-foreground px-4 py-4 text-sm">{formatDate(user.lastLoginAt)}</td>
        <td className="px-4 py-4">
          <div className="flex items-center gap-2">
            {user.mfaEnabled ? (
              <span title="MFA Enabled">
                <Shield className="h-4 w-4 text-green-600" />
              </span>
            ) : (
              <span title="No MFA">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setRoleDialogOpen(true)}>
                <Shield className="mr-2 h-4 w-4" />
                Change Role
              </DropdownMenuItem>
              {user.status === 'INVITED' && (
                <DropdownMenuItem onClick={() => resendMutation.mutate()}>
                  <Mail className="mr-2 h-4 w-4" />
                  Resend Invite
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {user.status === 'ACTIVE' && (
                <DropdownMenuItem
                  className="text-yellow-600"
                  onClick={() => suspendMutation.mutate()}
                >
                  Suspend User
                </DropdownMenuItem>
              )}
              {user.status === 'SUSPENDED' && (
                <DropdownMenuItem onClick={() => reactivateMutation.mutate()}>
                  Reactivate User
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => {
                  if (confirm('Are you sure you want to remove this user?')) {
                    removeMutation.mutate();
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove User
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </tr>

      {/* Role Change Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>Update role for {user.email}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="VIEWER">Viewer</SelectItem>
                <SelectItem value="USER_ADMIN">User Admin</SelectItem>
                <SelectItem value="SECURITY_ADMIN">Security Admin</SelectItem>
                <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => updateRoleMutation.mutate()}
              disabled={updateRoleMutation.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function TenantUsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tenant-users', page, search, roleFilter, statusFilter],
    queryFn: () =>
      fetchUsers({
        page,
        search: search || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      }),
  });

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">{data?.total || 0} users in your organization</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <BulkImportDialog onSuccess={handleRefresh} />
          <InviteUserDialog onSuccess={handleRefresh} />
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="min-w-[200px] flex-1">
              <div className="relative">
                <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            <Select
              value={roleFilter}
              onValueChange={(v) => {
                setRoleFilter(v as UserRole | '');
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Roles</SelectItem>
                <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                <SelectItem value="SECURITY_ADMIN">Security Admin</SelectItem>
                <SelectItem value="USER_ADMIN">User Admin</SelectItem>
                <SelectItem value="VIEWER">Viewer</SelectItem>
                <SelectItem value="USER">User</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as UserStatus | '');
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="INVITED">Invited</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
            </div>
          ) : data?.users.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <Users className="text-muted-foreground mb-4 h-12 w-12" />
              <p className="text-lg font-medium">No users found</p>
              <p className="text-muted-foreground">
                {search || roleFilter || statusFilter
                  ? 'Try adjusting your filters'
                  : 'Invite users to get started'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">User</th>
                    <th className="px-4 py-3 text-left font-medium">Role</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Last Login</th>
                    <th className="px-4 py-3 text-left font-medium">Security</th>
                    <th className="w-12 px-4 py-3 text-left font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {data?.users.map((user) => (
                    <UserRow key={user.id} user={user} onRefresh={handleRefresh} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t p-4">
            <p className="text-muted-foreground text-sm">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
