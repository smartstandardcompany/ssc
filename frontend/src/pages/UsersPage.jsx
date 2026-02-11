import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit, Trash2, Shield, User as UserIcon } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { BranchFilter } from '@/components/BranchFilter';

export default function UsersPage() {
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
    permissions: []
  });

  const allPermissions = [
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
    { value: 'leave_approvals', label: 'Leave Approvals', group: 'HR' },
    { value: 'reports', label: 'Reports', group: 'Reports' },
    { value: 'credit_report', label: 'Credit Report', group: 'Reports' },
    { value: 'supplier_report', label: 'Supplier Report', group: 'Reports' },
    { value: 'settings', label: 'Settings', group: 'Admin' },
    { value: 'users', label: 'User Management', group: 'Admin' },
  ];

  const permissionGroups = [...new Set(allPermissions.map(p => p.group))];

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
    try {
      if (editingUser) {
        const updateData = { ...formData };
        delete updateData.password;
        delete updateData.email;
        await api.put(`/users/${editingUser.id}`, updateData);
        toast.success('User updated successfully');
      } else {
        await api.post('/users', formData);
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
      permissions: user.permissions || []
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

  const togglePermission = (permission) => {
    if (formData.permissions.includes(permission)) {
      setFormData({
        ...formData,
        permissions: formData.permissions.filter((p) => p !== permission)
      });
    } else {
      setFormData({
        ...formData,
        permissions: [...formData.permissions, permission]
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'operator',
      branch_id: '',
      permissions: []
    });
    setEditingUser(null);
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
            <p className="text-muted-foreground">Manage users and access control</p>
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
            <DialogContent className="max-w-2xl" data-testid="user-dialog" aria-describedby="user-dialog-description">
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
                    <Select value={formData.role} onValueChange={(val) => setFormData({ ...formData, role: val })}>
                      <SelectTrigger data-testid="user-role-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
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
                        <SelectItem value="all">All Branches</SelectItem>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <Label>Permissions</Label>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="ghost" className="text-xs h-7" onClick={() => setFormData({ ...formData, permissions: allPermissions.map(p => p.value) })}>Select All</Button>
                      <Button type="button" size="sm" variant="ghost" className="text-xs h-7" onClick={() => setFormData({ ...formData, permissions: [] })}>Clear All</Button>
                    </div>
                  </div>
                  <div className="border rounded-xl p-4 bg-stone-50 space-y-4 max-h-64 overflow-y-auto">
                    {permissionGroups.map(group => (
                      <div key={group}>
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">{group}</p>
                        <div className="grid grid-cols-2 gap-2">
                          {allPermissions.filter(p => p.group === group).map((perm) => (
                            <div key={perm.value} className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-white transition-all">
                              <Checkbox id={perm.value} checked={formData.permissions.includes(perm.value)} onCheckedChange={() => togglePermission(perm.value)} data-testid={`permission-SAR {perm.value}`} />
                              <label htmlFor={perm.value} className="text-sm cursor-pointer">{perm.label}</label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
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
                  {users.map((user) => {
                    const branchName = branches.find((b) => b.id === user.branch_id)?.name || 'All Branches';
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
                          <div className="flex gap-1 flex-wrap">
                            {user.permissions?.slice(0, 3).map((perm) => (
                              <span key={perm} className="inline-block px-2 py-0.5 rounded text-xs bg-primary/10 text-primary">
                                {perm}
                              </span>
                            ))}
                            {user.permissions?.length > 3 && (
                              <span className="text-xs text-muted-foreground">+{user.permissions.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex gap-2 justify-end">
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
      </div>
    </DashboardLayout>
  );
}
