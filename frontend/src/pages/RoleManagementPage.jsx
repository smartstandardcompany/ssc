import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import api from '@/lib/api';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Shield, Plus, Edit2, Trash2, Copy, Check, X } from 'lucide-react';

const ALL_MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'sales', label: 'Sales' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'branches', label: 'Branches' },
  { key: 'customers', label: 'Customers' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'supplier_payments', label: 'Supplier Payments' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'cash_transfers', label: 'Cash Transfers' },
  { key: 'employees', label: 'Employees' },
  { key: 'documents', label: 'Documents' },
  { key: 'leave', label: 'Leave' },
  { key: 'loans', label: 'Loans' },
  { key: 'shifts', label: 'Shifts' },
  { key: 'stock', label: 'Stock' },
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'pos', label: 'POS' },
  { key: 'reports', label: 'Reports' },
  { key: 'credit_report', label: 'Credit Report' },
  { key: 'supplier_report', label: 'Supplier Report' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'settings', label: 'Settings' },
  { key: 'users', label: 'Users' },
  { key: 'partners', label: 'Partners' },
  { key: 'fines', label: 'Fines' },
];

const PERM_COLORS = {
  write: 'bg-emerald-100 text-emerald-700',
  read: 'bg-blue-100 text-blue-700',
  none: 'bg-stone-100 text-stone-400',
};

export default function RoleManagementPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(null); // null or template object
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', permissions: {} });

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await api.get('/role-templates');
      setTemplates(res.data);
    } catch (e) {
      toast.error('Failed to load role templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const initFormForCreate = () => {
    const perms = {};
    ALL_MODULES.forEach(m => { perms[m.key] = 'none'; });
    setForm({ name: '', description: '', permissions: perms });
    setShowCreate(true);
    setEditMode(null);
  };

  const initFormForEdit = (tmpl) => {
    setForm({ name: tmpl.name, description: tmpl.description || '', permissions: { ...tmpl.permissions } });
    setEditMode(tmpl);
    setShowCreate(true);
  };

  const handleSave = async () => {
    if (!form.name) return toast.error('Name required');
    try {
      if (editMode) {
        await api.put(`/role-templates/${editMode.id}`, form);
        toast.success('Template updated');
      } else {
        await api.post('/role-templates', form);
        toast.success('Template created');
      }
      setShowCreate(false);
      setEditMode(null);
      fetchTemplates();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await api.delete(`/role-templates/${id}`);
      toast.success('Template deleted');
      fetchTemplates();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to delete');
    }
  };

  const handleDuplicate = (tmpl) => {
    const perms = { ...tmpl.permissions };
    setForm({ name: `${tmpl.name} (Copy)`, description: tmpl.description || '', permissions: perms });
    setShowCreate(true);
    setEditMode(null);
  };

  const setAllPerms = (level) => {
    const perms = {};
    ALL_MODULES.forEach(m => { perms[m.key] = level; });
    setForm(f => ({ ...f, permissions: perms }));
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-1" data-testid="role-management-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2" data-testid="role-mgmt-title">
              <Shield className="w-6 h-6 text-orange-500" />
              Role & Permission Templates
            </h1>
            <p className="text-sm text-stone-500 mt-1">Create permission templates and apply them to users</p>
          </div>
          <Button className="bg-orange-500 hover:bg-orange-600 rounded-full" onClick={initFormForCreate} data-testid="create-template-btn">
            <Plus className="w-4 h-4 mr-1" /> New Template
          </Button>
        </div>

        {/* Template Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map(tmpl => (
            <Card key={tmpl.id} className="border-stone-100 hover:border-stone-200 transition-colors" data-testid={`template-card-${tmpl.id}`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-stone-800">{tmpl.name}</h3>
                    {tmpl.is_system && <Badge className="bg-stone-100 text-stone-500 text-[10px]">System</Badge>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleDuplicate(tmpl)} data-testid={`duplicate-${tmpl.id}`}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => initFormForEdit(tmpl)} data-testid={`edit-${tmpl.id}`}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    {!tmpl.is_system && (
                      <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(tmpl.id)} data-testid={`delete-${tmpl.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                {tmpl.description && <p className="text-xs text-stone-500 mb-3">{tmpl.description}</p>}
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(tmpl.permissions || {}).filter(([, v]) => v !== 'none').slice(0, 8).map(([key, level]) => (
                    <Badge key={key} className={`text-[10px] ${PERM_COLORS[level]}`}>
                      {key.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                  {Object.entries(tmpl.permissions || {}).filter(([, v]) => v !== 'none').length > 8 && (
                    <Badge className="bg-stone-100 text-stone-500 text-[10px]">
                      +{Object.entries(tmpl.permissions).filter(([, v]) => v !== 'none').length - 8} more
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Create/Edit Dialog */}
        <Dialog open={showCreate} onOpenChange={(o) => { if (!o) { setShowCreate(false); setEditMode(null); } }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="template-dialog">
            <DialogHeader>
              <DialogTitle>{editMode ? 'Edit Template' : 'Create Template'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Template Name *</Label>
                  <Input data-testid="template-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Branch Manager" />
                </div>
                <div className="space-y-1">
                  <Label>Description</Label>
                  <Input data-testid="template-desc" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What this role does" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-stone-500">Quick Set:</span>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAllPerms('write')} data-testid="set-all-write">All Write</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAllPerms('read')} data-testid="set-all-read">All Read</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAllPerms('none')} data-testid="set-all-none">All None</Button>
              </div>

              <div className="border border-stone-100 rounded-xl overflow-hidden">
                <div className="grid grid-cols-[1fr_100px] bg-stone-50 px-4 py-2 text-xs font-semibold text-stone-500 border-b border-stone-100">
                  <span>Module</span>
                  <span className="text-center">Permission</span>
                </div>
                <div className="max-h-[40vh] overflow-y-auto">
                  {ALL_MODULES.map(mod => (
                    <div key={mod.key} className="grid grid-cols-[1fr_100px] px-4 py-2 border-b border-stone-50 items-center hover:bg-stone-50/50">
                      <span className="text-sm text-stone-700">{mod.label}</span>
                      <Select value={form.permissions[mod.key] || 'none'} onValueChange={v => setForm(f => ({ ...f, permissions: { ...f.permissions, [mod.key]: v } }))}>
                        <SelectTrigger className="h-7 text-xs" data-testid={`perm-${mod.key}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="write">Write</SelectItem>
                          <SelectItem value="read">Read</SelectItem>
                          <SelectItem value="none">None</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowCreate(false); setEditMode(null); }} data-testid="cancel-template">Cancel</Button>
              <Button className="bg-orange-500 hover:bg-orange-600" onClick={handleSave} data-testid="save-template-btn">
                {editMode ? 'Update' : 'Create'} Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
