import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Eye, ShoppingCart, Receipt, Truck } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function BranchesPage() {
  const [branches, setBranches] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [editingBranch, setEditingBranch] = useState(null);
  const [formData, setFormData] = useState({ name: '', location: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const brRes = await api.get('/branches');
      setBranches(brRes.data);
      const sums = {};
      for (const b of brRes.data) {
        try {
          const res = await api.get(`/branches/${b.id}/summary`);
          sums[b.id] = res.data;
        } catch { sums[b.id] = null; }
      }
      setSummaries(sums);
    } catch { toast.error('Failed to fetch branches'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBranch) { await api.put(`/branches/${editingBranch.id}`, formData); toast.success('Branch updated'); }
      else { await api.post('/branches', formData); toast.success('Branch added'); }
      setShowDialog(false); resetForm(); fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleEdit = (b) => { setEditingBranch(b); setFormData({ name: b.name, location: b.location || '' }); setShowDialog(true); };
  const handleDelete = async (id) => {
    if (window.confirm('Delete branch?')) {
      try { await api.delete(`/branches/${id}`); toast.success('Deleted'); fetchData(); }
      catch { toast.error('Failed'); }
    }
  };
  const resetForm = () => { setFormData({ name: '', location: '' }); setEditingBranch(null); };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="branches-page-title">Branches</h1>
            <p className="text-muted-foreground">Manage branches and view performance</p>
          </div>
          <Dialog open={showDialog} onOpenChange={(o) => { setShowDialog(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild><Button className="rounded-full" data-testid="add-branch-button"><Plus size={18} className="mr-2" />Add Branch</Button></DialogTrigger>
            <DialogContent data-testid="branch-dialog">
              <DialogHeader><DialogTitle className="font-outfit">{editingBranch ? 'Edit' : 'Add'} Branch</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><Label>Branch Name *</Label><Input value={formData.name} data-testid="branch-name-input" onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="e.g., Downtown Store" /></div>
                <div><Label>Location</Label><Input value={formData.location} data-testid="branch-location-input" onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="e.g., New York" /></div>
                <div className="flex gap-3">
                  <Button type="submit" data-testid="submit-branch-button" className="rounded-full">{editingBranch ? 'Update' : 'Add'} Branch</Button>
                  <Button type="button" variant="outline" onClick={() => setShowDialog(false)} className="rounded-full">Cancel</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches.map((branch) => {
            const s = summaries[branch.id];
            return (
              <Card key={branch.id} className="border-border hover:shadow-lg transition-shadow" data-testid="branch-card">
                <CardHeader>
                  <CardTitle className="font-outfit flex items-start justify-between">
                    <div>
                      <span>{branch.name}</span>
                      {branch.location && <p className="text-sm font-normal text-muted-foreground mt-1">{branch.location}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setShowDetail(s)} data-testid="view-branch-btn"><Eye size={16} /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(branch)} data-testid="edit-branch-button"><Edit size={16} /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(branch.id)} data-testid="delete-branch-button" className="text-error hover:text-error"><Trash2 size={16} /></Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {s ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-2 bg-success/10 rounded">
                        <span className="text-xs flex items-center gap-1"><ShoppingCart size={12} />Sales</span>
                        <span className="text-sm font-bold text-success">${s.total_sales.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-error/10 rounded">
                        <span className="text-xs flex items-center gap-1"><Receipt size={12} />Expenses</span>
                        <span className="text-sm font-bold text-error">${s.total_expenses.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-info/10 rounded">
                        <span className="text-xs flex items-center gap-1"><Truck size={12} />Supplier Payments</span>
                        <span className="text-sm font-bold text-info">${s.total_supplier_payments.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-primary/10 rounded border border-primary/20">
                        <span className="text-xs font-medium">Net Profit</span>
                        <span className={`text-sm font-bold ${s.net_profit >= 0 ? 'text-success' : 'text-error'}`}>${s.net_profit.toFixed(2)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="flex items-center justify-between p-2 bg-cash/10 rounded">
                          <span className="text-xs">Cash In Hand</span>
                          <span className={`text-sm font-bold ${(s.cash_in_hand || 0) >= 0 ? 'text-cash' : 'text-error'}`}>${(s.cash_in_hand || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-bank/10 rounded">
                          <span className="text-xs">Bank In Hand</span>
                          <span className={`text-sm font-bold ${(s.bank_in_hand || 0) >= 0 ? 'text-bank' : 'text-error'}`}>${(s.bank_in_hand || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Loading stats...</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {branches.length === 0 && (
            <Card className="col-span-full border-dashed"><CardContent className="p-12 text-center"><p className="text-muted-foreground">No branches yet.</p></CardContent></Card>
          )}
        </div>

        {/* Branch Detail Dialog */}
        <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
          <DialogContent className="max-w-lg" data-testid="branch-detail-dialog">
            <DialogHeader><DialogTitle className="font-outfit">{showDetail?.branch_name} - Details</DialogTitle></DialogHeader>
            {showDetail && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-success/10 rounded-lg"><div className="text-xs text-muted-foreground">Total Sales</div><div className="text-lg font-bold text-success">${showDetail.total_sales.toFixed(2)}</div><div className="text-xs">{showDetail.sales_count} transactions</div></div>
                  <div className="p-3 bg-error/10 rounded-lg"><div className="text-xs text-muted-foreground">Total Expenses</div><div className="text-lg font-bold text-error">${showDetail.total_expenses.toFixed(2)}</div><div className="text-xs">{showDetail.expenses_count} transactions</div></div>
                  <div className="p-3 bg-info/10 rounded-lg"><div className="text-xs text-muted-foreground">Supplier Payments</div><div className="text-lg font-bold text-info">${showDetail.total_supplier_payments.toFixed(2)}</div><div className="text-xs">{showDetail.sp_count} transactions</div></div>
                  <div className="p-3 bg-primary/10 rounded-lg"><div className="text-xs text-muted-foreground">Net Profit</div><div className={`text-lg font-bold ${showDetail.net_profit >= 0 ? 'text-success' : 'text-error'}`}>${showDetail.net_profit.toFixed(2)}</div></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-cash/10 rounded-lg border border-cash/30"><div className="text-xs text-muted-foreground">Cash In Hand</div><div className={`text-lg font-bold ${(showDetail.cash_in_hand || 0) >= 0 ? 'text-cash' : 'text-error'}`}>${(showDetail.cash_in_hand || 0).toFixed(2)}</div></div>
                  <div className="p-3 bg-bank/10 rounded-lg border border-bank/30"><div className="text-xs text-muted-foreground">Bank In Hand</div><div className={`text-lg font-bold ${(showDetail.bank_in_hand || 0) >= 0 ? 'text-bank' : 'text-error'}`}>${(showDetail.bank_in_hand || 0).toFixed(2)}</div></div>
                </div>
                <div className="border-t pt-3">
                  <h4 className="text-sm font-medium mb-2">Sales Breakdown</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 bg-cash/10 rounded text-center"><div className="text-xs text-muted-foreground">Cash</div><div className="text-sm font-bold text-cash">${showDetail.sales_cash.toFixed(2)}</div></div>
                    <div className="p-2 bg-bank/10 rounded text-center"><div className="text-xs text-muted-foreground">Bank</div><div className="text-sm font-bold text-bank">${showDetail.sales_bank.toFixed(2)}</div></div>
                    <div className="p-2 bg-credit/10 rounded text-center"><div className="text-xs text-muted-foreground">Credit</div><div className="text-sm font-bold text-credit">${showDetail.sales_credit.toFixed(2)}</div></div>
                  </div>
                </div>
                <div className="border-t pt-3">
                  <h4 className="text-sm font-medium mb-2">Expenses Breakdown</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-cash/10 rounded text-center"><div className="text-xs text-muted-foreground">Cash</div><div className="text-sm font-bold text-cash">${showDetail.expenses_cash.toFixed(2)}</div></div>
                    <div className="p-2 bg-bank/10 rounded text-center"><div className="text-xs text-muted-foreground">Bank</div><div className="text-sm font-bold text-bank">${showDetail.expenses_bank.toFixed(2)}</div></div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
