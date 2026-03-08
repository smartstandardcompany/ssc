import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Pencil, Building2, Star } from 'lucide-react';
import api from '@/lib/api';
import { useBranchStore } from '@/stores';
import { toast } from 'sonner';

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const { branches, fetchBranches } = useBranchStore();
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '', bank_name: '', account_number: '', iban: '', branch_id: '', is_default: false, notes: ''
  });

  const fetchAccounts = async () => {
    try {
      fetchBranches();
      const res = await api.get('/bank-accounts');
      setAccounts(res.data);
    } catch { toast.error('Failed to load bank accounts'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAccounts(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, branch_id: formData.branch_id || null };
      if (editingId) {
        await api.put(`/bank-accounts/${editingId}`, payload);
        toast.success('Bank account updated');
      } else {
        await api.post('/bank-accounts', payload);
        toast.success('Bank account added');
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: '', bank_name: '', account_number: '', iban: '', branch_id: '', is_default: false, notes: '' });
      fetchAccounts();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleEdit = (acc) => {
    setFormData({
      name: acc.name, bank_name: acc.bank_name, account_number: acc.account_number,
      iban: acc.iban || '', branch_id: acc.branch_id || '', is_default: acc.is_default || false, notes: acc.notes || ''
    });
    setEditingId(acc.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this bank account?')) return;
    try {
      await api.delete(`/bank-accounts/${id}`);
      toast.success('Deleted');
      fetchAccounts();
    } catch { toast.error('Failed to delete'); }
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit mb-1">Bank Accounts</h1>
            <p className="text-sm text-muted-foreground">Manage your company bank accounts for payment tracking</p>
          </div>
          <Button className="rounded-xl" onClick={() => { setEditingId(null); setFormData({ name: '', bank_name: '', account_number: '', iban: '', branch_id: '', is_default: false, notes: '' }); setShowForm(true); }}
            data-testid="add-bank-account-btn">
            <Plus size={16} className="mr-1" /> Add Bank Account
          </Button>
        </div>

        {/* Bank Account Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map(acc => (
            <Card key={acc.id} className={`border transition-all hover:shadow-md ${acc.is_default ? 'border-emerald-300 bg-emerald-50/30' : 'border-stone-200'}`}
              data-testid={`bank-account-card-${acc.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                      <Building2 size={20} className="text-blue-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm flex items-center gap-1.5">
                        {acc.name}
                        {acc.is_default && <Star size={12} className="text-amber-500 fill-amber-500" />}
                      </div>
                      <div className="text-xs text-muted-foreground">{acc.bank_name}</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleEdit(acc)} data-testid="edit-bank-btn"><Pencil size={12} /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-error" onClick={() => handleDelete(acc.id)} data-testid="delete-bank-btn"><Trash2 size={12} /></Button>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account #</span>
                    <span className="font-mono font-medium">{acc.account_number}</span>
                  </div>
                  {acc.iban && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IBAN</span>
                      <span className="font-mono text-xs">{acc.iban}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Branch</span>
                    {acc.branch_id ? (
                      <Badge variant="outline" className="text-[10px]">{branches.find(b => b.id === acc.branch_id)?.name || '-'}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">All Branches</span>
                    )}
                  </div>
                  {acc.is_default && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Default Account</Badge>}
                </div>
                {acc.notes && <p className="text-xs text-muted-foreground mt-2 italic">{acc.notes}</p>}
              </CardContent>
            </Card>
          ))}
          {accounts.length === 0 && (
            <Card className="md:col-span-3 border-dashed">
              <CardContent className="p-8 text-center">
                <Building2 size={40} className="mx-auto text-muted-foreground mb-3 opacity-30" />
                <p className="text-muted-foreground text-sm">No bank accounts added yet</p>
                <p className="text-xs text-muted-foreground mt-1">Add your company bank accounts to track payments</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Add/Edit Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent data-testid="bank-account-dialog">
            <DialogHeader>
              <DialogTitle className="font-outfit">{editingId ? 'Edit' : 'Add'} Bank Account</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Display Name *</Label>
                  <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Al Rajhi - Main" required data-testid="bank-name-input" />
                </div>
                <div>
                  <Label>Bank Name *</Label>
                  <Input value={formData.bank_name} onChange={e => setFormData({ ...formData, bank_name: e.target.value })} placeholder="e.g. Al Rajhi Bank" required data-testid="bank-bank-name-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Account Number *</Label>
                  <Input value={formData.account_number} onChange={e => setFormData({ ...formData, account_number: e.target.value })} placeholder="Account number" required data-testid="bank-account-number-input" />
                </div>
                <div>
                  <Label>IBAN</Label>
                  <Input value={formData.iban} onChange={e => setFormData({ ...formData, iban: e.target.value })} placeholder="SA..." data-testid="bank-iban-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Assigned Branch</Label>
                  <Select value={formData.branch_id || "all"} onValueChange={v => setFormData({ ...formData, branch_id: v === "all" ? "" : v })}>
                    <SelectTrigger data-testid="bank-branch-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Branches</SelectItem>
                      {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Optional notes" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={formData.is_default} onCheckedChange={v => setFormData({ ...formData, is_default: v })} id="is-default" />
                <Label htmlFor="is-default" className="cursor-pointer text-sm">Set as default bank account</Label>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" data-testid="save-bank-btn">{editingId ? 'Update' : 'Add'} Bank Account</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
