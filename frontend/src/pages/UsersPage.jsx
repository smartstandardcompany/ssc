import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit, Trash2, Shield, Eye, EyeOff, Pencil, Key, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { BranchFilter } from '@/components/BranchFilter';
import { useLanguage } from '@/contexts/LanguageContext';

// All modules that can have permissions
const ALL_MODULES = [
  { value: 'dashboard', label: 'Dashboard', group: 'Core' },
  { value: 'sales', label: 'Sales', group: 'Core' },
  { value: 'invoices', label: 'Invoices', group: 'Core' },
  { value: 'branches', label: 'Branches', group: 'Core' },
  { value: 'customers', label: 'Customers', group: 'Core' },
  { value: 'suppliers', label: 'Suppliers', group: 'Finance' },
  { value: 'supplier_payments', label: 'Supplier Payments', group: 'Finance' },
  { value: 'expenses', label: 'Expenses', group: 'Finance' },
  { value: 'cash_transfers', label: 'Cash Transfers', group: 'Finance' },
  { value: 'employees', label: 'Employees', group: 'HR' },
  { value: 'documents', label: 'Documents', group: 'HR' },
  { value: 'leave', label: 'Leave Approvals', group: 'HR' },
  { value: 'loans', label: 'Loans', group: 'HR' },
  { value: 'shifts', label: 'Shifts & Schedule', group: 'HR' },
  { value: 'stock', label: 'Inventory', group: 'Stock' },
  { value: 'kitchen', label: 'Kitchen', group: 'Stock' },
  { value: 'pos', label: 'POS', group: 'Operations' },
  { value: 'reports', label: 'Reports', group: 'Reports' },
  { value: 'credit_report', label: 'Credit Report', group: 'Reports' },
  { value: 'supplier_report', label: 'Supplier Report', group: 'Reports' },
  { value: 'analytics', label: 'Analytics', group: 'Reports' },
  { value: 'settings', label: 'Settings', group: 'Admin' },
  { value: 'users', label: 'User Management', group: 'Admin' },
  { value: 'partners', label: 'Partners', group: 'Admin' },
  { value: 'fines', label: 'Fines', group: 'Admin' },
];

const PERMISSION_GROUPS = [...new Set(ALL_MODULES.map(m => m.group))];

// Permission level colors
const PERMISSION_COLORS = {
  write: 'bg-green-100 text-green-700 border-green-200',
  read: 'bg-blue-100 text-blue-700 border-blue-200',
  none: 'bg-stone-100 text-stone-400 border-stone-200',
};

// Convert old list format to new dict format
function normalizePermissions(perms) {
  if (Array.isArray(perms)) {
    const dict = {};
    perms.forEach(p => { dict[p] = 'write'; });
    return dict;
  }
  if (typeof perms === 'object' && perms !== null) {
    return perms;
  }
  return {};
}

// Get default permissions for a role
function getDefaultPermissions(role) {
  const defaults = {};
  ALL_MODULES.forEach(m => {
    if (role === 'admin') {
      defaults[m.value] = 'write';
    } else if (role === 'manager') {
      // Managers get write access to most modules except admin-only ones
      if (['users', 'settings', 'partners'].includes(m.value)) {
        defaults[m.value] = 'read';
      } else {
        defaults[m.value] = 'write';
      }
    } else {
      // Operators get basic access
      if (['sales', 'expenses', 'customers', 'dashboard', 'pos'].includes(m.value)) {
        defaults[m.value] = 'write';
      } else {
        defaults[m.value] = 'none';
      }
    }
  });
  return defaults;
}

export default function UsersPage() {
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'operator',
    branch_id: '',
    permissions: {},
    must_change_password: false
  });
  
  // Password reset dialog state
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [resetData, setResetData] = useState({
    new_password: '',
    confirm_password: '',
    must_change_on_login: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, branchesRes] = await Promise.all([
        api.get('/users'),
        api.get('/branches'),
      ]);
      setUsers(usersRes.data);
      setBranches(branchesRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // For non-admin roles, require branch selection
    if (formData.role !== 'admin' && !formData.branch_id) {
      toast.error('Please select a branch for this user');
      return;
    }
    
    try {
      // Prepare data - ensure permissions is a dict
      const submitData = {
        ...formData,
        permissions: formData.permissions || {}
      };
      
      if (editingUser) {
        const updateData = { ...submitData };
        delete updateData.password;
        delete updateData.email;
        await api.put(`/users/${editingUser.id}`, updateData);
        toast.success('User updated successfully');
      } else {
        await api.post('/users', submitData);
        toast.success('User created successfully');
      }
      setShowDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save user');
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      branch_id: user.branch_id || '',
      permissions: normalizePermissions(user.permissions)
    });
    setShowDialog(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await api.delete(`/users/${id}`);
        toast.success('User deleted successfully');
        fetchData();
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Failed to delete user');
      }
    }
  };

  const handleRoleChange = (newRole) => {
    // When role changes, update default permissions
    const newPerms = getDefaultPermissions(newRole);
    setFormData({
      ...formData,
      role: newRole,
      permissions: newPerms
    });
  };

  const setPermissionLevel = (module, level) => {
    setFormData({
      ...formData,
      permissions: {
        ...formData.permissions,
        [module]: level
      }
    });
  };

  const setAllPermissions = (level) => {
    const newPerms = {};
    ALL_MODULES.forEach(m => {
      newPerms[m.value] = level;
    });
    setFormData({ ...formData, permissions: newPerms });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'operator',
      branch_id: '',
      permissions: getDefaultPermissions('operator'),
      must_change_password: false
    });
    setEditingUser(null);
  };

  // Password reset functions
  const openResetDialog = (user) => {
    setResetUser(user);
    setResetData({ new_password: '', confirm_password: '', must_change_on_login: true });
    setShowResetDialog(true);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (resetData.new_password !== resetData.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    if (resetData.new_password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      await api.put(`/users/${resetUser.id}/reset-password`, {
        new_password: resetData.new_password,
        must_change_on_login: resetData.must_change_on_login
      });
      toast.success(`Password reset for ${resetUser.name}`);
      setShowResetDialog(false);
      setResetUser(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reset password');
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-primary/20 text-primary border-primary/30';
      case 'manager':
        return 'bg-info/20 text-info border-info/30';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  const getPermissionSummary = (permissions) => {
    const perms = normalizePermissions(permissions);
    const write = Object.values(perms).filter(v => v === 'write').length;
    const read = Object.values(perms).filter(v => v === 'read').length;
    return { write, read, total: ALL_MODULES.length };
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="users-page-title">User Management</h1>
            <p className="text-muted-foreground">Manage users and granular access control</p>
          </div>
          <div className="flex gap-3 items-center flex-wrap">
            <BranchFilter onChange={setBranchFilter} />
            <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="rounded-full" data-testid="add-user-button">
                  <Plus size={18} className="mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="user-dialog" aria-describedby="user-dialog-description">
                <DialogHeader>
                  <DialogTitle className="font-outfit">{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Name *</Label>
                      <Input
                        value={formData.name}
                        data-testid="user-name-input"
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>Email *</Label>
                      <Input
                        type="email"
                        value={formData.email}
                        data-testid="user-email-input"
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                        disabled={editingUser}
                      />
                    </div>
                  </div>

                  {!editingUser && (
                    <div>
                      <Label>Password *</Label>
                      <Input
                        type="password"
                        value={formData.password}
                        data-testid="user-password-input"
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required={!editingUser}
                        minLength={6}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Role *</Label>
                      <Select value={formData.role} onValueChange={handleRoleChange}>
                        <SelectTrigger data-testid="user-role-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin (Full Access)</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="operator">Operator</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Assigned Branch</Label>
                      <Select value={formData.branch_id || "all"} onValueChange={(val) => setFormData({ ...formData, branch_id: val === "all" ? "" : val })}>
                        <SelectTrigger data-testid="user-branch-select">
                          <SelectValue placeholder="All branches" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Branches (No Restriction)</SelectItem>
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">Restrict user to see only data from this branch</p>
                    </div>
                  </div>

                  {formData.role !== 'admin' && (
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <Label className="text-base font-semibold">Module Permissions</Label>
                        <div className="flex gap-2">
                          <Button type="button" size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => setAllPermissions('write')}>
                            <Pencil size={12} /> All Write
                          </Button>
                          <Button type="button" size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => setAllPermissions('read')}>
                            <Eye size={12} /> All Read
                          </Button>
                          <Button type="button" size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => setAllPermissions('none')}>
                            <EyeOff size={12} /> All None
                          </Button>
                        </div>
                      </div>
                      <div className="border rounded-xl p-4 bg-stone-50 dark:bg-stone-900 space-y-4 max-h-72 overflow-y-auto">
                        {PERMISSION_GROUPS.map(group => (
                          <div key={group}>
                            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">{group}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {ALL_MODULES.filter(m => m.group === group).map((module) => {
                                const currentLevel = formData.permissions[module.value] || 'none';
                                return (
                                  <div key={module.value} className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                                    <span className="text-sm font-medium">{module.label}</span>
                                    <Select value={currentLevel} onValueChange={(val) => setPermissionLevel(module.value, val)}>
                                      <SelectTrigger className={`w-24 h-7 text-xs ${PERMISSION_COLORS[currentLevel]}`} data-testid={`permission-${module.value}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="write">
                                          <span className="flex items-center gap-1"><Pencil size={12} /> Write</span>
                                        </SelectItem>
                                        <SelectItem value="read">
                                          <span className="flex items-center gap-1"><Eye size={12} /> Read</span>
                                        </SelectItem>
                                        <SelectItem value="none">
                                          <span className="flex items-center gap-1"><EyeOff size={12} /> None</span>
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        <strong>Write:</strong> Can view and modify • <strong>Read:</strong> Can only view • <strong>None:</strong> No access
                      </p>
                    </div>
                  )}

                  {formData.role === 'admin' && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-700">
                      <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                        <Shield size={16} /> Admins have full access to all modules. No permission configuration needed.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button type="submit" data-testid="submit-user-button" className="rounded-full">
                      {editingUser ? 'Update' : 'Create'} User
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowDialog(false)} className="rounded-full">
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-outfit">All Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="users-table">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-medium text-sm">Name</th>
                    <th className="text-left p-3 font-medium text-sm">Email</th>
                    <th className="text-left p-3 font-medium text-sm">Role</th>
                    <th className="text-left p-3 font-medium text-sm">Branch</th>
                    <th className="text-left p-3 font-medium text-sm">Permissions</th>
                    <th className="text-right p-3 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.filter(u => branchFilter.length === 0 || branchFilter.includes(u.branch_id) || !u.branch_id).map((user) => {
                    const branchName = branches.find((b) => b.id === user.branch_id)?.name || 'All Branches';
                    const permSummary = getPermissionSummary(user.permissions);
                    return (
                      <tr key={user.id} className="border-b border-border hover:bg-secondary/50" data-testid="user-row">
                        <td className="p-3 text-sm font-medium">{user.name}</td>
                        <td className="p-3 text-sm">{user.email}</td>
                        <td className="p-3">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getRoleBadgeClass(user.role)}`}>
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </span>
                        </td>
                        <td className="p-3 text-sm">{branchName}</td>
                        <td className="p-3 text-sm">
                          {user.role === 'admin' ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200">Full Access</Badge>
                          ) : (
                            <div className="flex gap-1 items-center flex-wrap">
                              <Badge className="bg-green-100 text-green-700 border-green-200">{permSummary.write} write</Badge>
                              <Badge className="bg-blue-100 text-blue-700 border-blue-200">{permSummary.read} read</Badge>
                              {user.must_change_password && (
                                <Badge className="bg-amber-100 text-amber-700 border-amber-200 flex items-center gap-1">
                                  <AlertTriangle size={10} /> Must Change PW
                                </Badge>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openResetDialog(user)}
                              data-testid="reset-password-button"
                              className="h-8"
                              title="Reset Password"
                            >
                              <Key size={14} />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(user)}
                              data-testid="edit-user-button"
                              className="h-8"
                            >
                              <Edit size={14} className="mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(user.id)}
                              data-testid="delete-user-button"
                              className="h-8 text-error hover:text-error"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Password Reset Dialog */}
        <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
          <DialogContent className="max-w-md" data-testid="reset-password-dialog" aria-describedby="reset-password-description">
            <DialogHeader>
              <DialogTitle className="font-outfit flex items-center gap-2">
                <Key size={20} /> Reset Password
              </DialogTitle>
            </DialogHeader>
            {resetUser && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="p-3 bg-stone-100 dark:bg-stone-800 rounded-lg">
                  <p className="text-sm text-muted-foreground">Resetting password for:</p>
                  <p className="font-medium">{resetUser.name}</p>
                  <p className="text-sm text-muted-foreground">{resetUser.email}</p>
                </div>

                <div>
                  <Label>New Password *</Label>
                  <Input
                    type="password"
                    value={resetData.new_password}
                    onChange={(e) => setResetData({ ...resetData, new_password: e.target.value })}
                    data-testid="reset-new-password"
                    placeholder="Enter new password (min 6 characters)"
                    required
                    minLength={6}
                  />
                </div>

                <div>
                  <Label>Confirm Password *</Label>
                  <Input
                    type="password"
                    value={resetData.confirm_password}
                    onChange={(e) => setResetData({ ...resetData, confirm_password: e.target.value })}
                    data-testid="reset-confirm-password"
                    placeholder="Confirm new password"
                    required
                    minLength={6}
                  />
                </div>

                <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <Checkbox
                    id="must-change"
                    checked={resetData.must_change_on_login}
                    onCheckedChange={(checked) => setResetData({ ...resetData, must_change_on_login: checked })}
                    data-testid="must-change-checkbox"
                  />
                  <label htmlFor="must-change" className="text-sm cursor-pointer">
                    <span className="font-medium">Force password change on next login</span>
                    <p className="text-xs text-muted-foreground">User will be required to set a new password after logging in</p>
                  </label>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="submit" data-testid="submit-reset-button" className="rounded-full">
                    Reset Password
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowResetDialog(false)} className="rounded-full">
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
