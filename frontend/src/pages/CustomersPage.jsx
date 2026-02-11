import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, DollarSign, Eye, FileText } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { ExportButtons } from '@/components/ExportButtons';
import { BranchFilter } from '@/components/BranchFilter';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [balances, setBalances] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchFilter, setBranchFilter] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [customerReport, setCustomerReport] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [receivingCustomer, setReceivingCustomer] = useState(null);
  const [formData, setFormData] = useState({ name: '', branch_id: '', phone: '', email: '' });
  const [receiveData, setReceiveData] = useState({ payment_mode: 'cash', amount: '', discount: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [custRes, brRes, balRes] = await Promise.all([
        api.get('/customers'), api.get('/branches'), api.get('/customers-balance')
      ]);
      setCustomers(custRes.data); setBranches(brRes.data); setBalances(balRes.data);
    } catch { toast.error('Failed to fetch data'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, branch_id: formData.branch_id || null };
      if (editingCustomer) { await api.put(`/customers/${editingCustomer.id}`, payload); toast.success('Customer updated'); }
      else { await api.post('/customers', payload); toast.success('Customer added'); }
      setShowDialog(false); resetForm(); fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleReceiveCredit = async (e) => {
    e.preventDefault();
    if (!receivingCustomer) return;
    try {
      const salesRes = await api.get('/sales');
      const custSales = salesRes.data.filter(s => s.customer_id === receivingCustomer.id && (s.credit_amount - s.credit_received) > 0);
      if (custSales.length === 0) { toast.error('No pending credit sales'); return; }
      
      let remainingPay = parseFloat(receiveData.amount) || 0;
      let remainingDisc = parseFloat(receiveData.discount) || 0;
      
      for (const sale of custSales) {
        if (remainingPay <= 0 && remainingDisc <= 0) break;
        const saleRemaining = sale.credit_amount - sale.credit_received;
        const payAmount = Math.min(remainingPay, saleRemaining);
        const discAmount = Math.min(remainingDisc, saleRemaining - payAmount);
        if (payAmount > 0 || discAmount > 0) {
          await api.post(`/sales/${sale.id}/receive-credit`, { payment_mode: receiveData.payment_mode, amount: payAmount, discount: discAmount });
        }
        remainingPay -= payAmount;
        remainingDisc -= discAmount;
      }
      const totalSettled = (parseFloat(receiveData.amount) || 0) + (parseFloat(receiveData.discount) || 0);
      toast.success(`$${totalSettled.toFixed(2)} settled (Payment: SAR ${(parseFloat(receiveData.amount) || 0).toFixed(2)}, Discount: SAR ${(parseFloat(receiveData.discount) || 0).toFixed(2)})`);
      setShowReceiveDialog(false);
      setReceiveData({ payment_mode: 'cash', amount: '', discount: '' });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleEdit = (c) => {
    setEditingCustomer(c);
    setFormData({ name: c.name, branch_id: c.branch_id || '', phone: c.phone || '', email: c.email || '' });
    setShowDialog(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete customer?')) {
      try { await api.delete(`/customers/${id}`); toast.success('Deleted'); fetchData(); }
      catch { toast.error('Failed'); }
    }
  };

  const resetForm = () => { setFormData({ name: '', branch_id: '', phone: '', email: '' }); setEditingCustomer(null); };
  const getBalance = (id) => balances.find(b => b.id === id) || {};

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  const totalCredit = balances.reduce((s, b) => s + (b.credit_balance || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="customers-page-title">Customers</h1>
            <p className="text-muted-foreground">Manage customers and track balances</p>
          </div>
          <div className="flex gap-3 items-center flex-wrap">
            <BranchFilter onChange={setBranchFilter} />
            <ExportButtons dataType="customers" />
            <Dialog open={showDialog} onOpenChange={(o) => { setShowDialog(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild><Button className="rounded-full" data-testid="add-customer-button"><Plus size={18} className="mr-2" />Add Customer</Button></DialogTrigger>
              <DialogContent data-testid="customer-dialog">
                <DialogHeader><DialogTitle className="font-outfit">{editingCustomer ? 'Edit' : 'Add'} Customer</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div><Label>Name *</Label><Input value={formData.name} data-testid="customer-name-input" onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
                  <div><Label>Branch</Label>
                    <Select value={formData.branch_id || "all"} onValueChange={(v) => setFormData({ ...formData, branch_id: v === "all" ? "" : v })}>
                      <SelectTrigger data-testid="customer-branch-select"><SelectValue placeholder="All branches" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">All Branches</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Phone</Label><Input value={formData.phone} data-testid="customer-phone-input" onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
                  <div><Label>Email</Label><Input type="email" value={formData.email} data-testid="customer-email-input" onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
                  <div className="flex gap-3">
                    <Button type="submit" data-testid="submit-customer-button" className="rounded-full">{editingCustomer ? 'Update' : 'Add'} Customer</Button>
                    <Button type="button" variant="outline" onClick={() => setShowDialog(false)} className="rounded-full">Cancel</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Customers</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold font-outfit text-primary">{customers.length}</div></CardContent></Card>
          <Card className="border-border"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Sales</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold font-outfit text-success"> SAR {balances.reduce((s, b) => s + (b.total_sales || 0), 0).toFixed(2)}</div></CardContent></Card>
          <Card className="border-border bg-warning/5"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Outstanding Credit</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold font-outfit text-warning"> SAR {totalCredit.toFixed(2)}</div></CardContent></Card>
        </div>

        <Card className="border-border">
          <CardHeader><CardTitle className="font-outfit">All Customers</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="customers-table">
                <thead><tr className="border-b border-border">
                  <th className="text-left p-3 font-medium text-sm">Name</th>
                  <th className="text-left p-3 font-medium text-sm">Branch</th>
                  <th className="text-left p-3 font-medium text-sm">Phone</th>
                  <th className="text-right p-3 font-medium text-sm">Total Sales</th>
                  <th className="text-right p-3 font-medium text-sm">Cash</th>
                  <th className="text-right p-3 font-medium text-sm">Bank</th>
                  <th className="text-right p-3 font-medium text-sm">Credit Balance</th>
                  <th className="text-right p-3 font-medium text-sm">Actions</th>
                </tr></thead>
                <tbody>
                  {customers.filter(c => {
                    if (branchFilter.length > 0 && !branchFilter.includes(c.branch_id) && c.branch_id) return false;
                    return true;
                  }).map((c) => {
                    const bal = getBalance(c.id);
                    const brName = branches.find(b => b.id === c.branch_id)?.name || 'All';
                    return (
                      <tr key={c.id} className="border-b border-border hover:bg-secondary/50" data-testid="customer-row">
                        <td className="p-3 text-sm font-medium">{c.name}</td>
                        <td className="p-3 text-sm">{brName}</td>
                        <td className="p-3 text-sm">{c.phone || '-'}</td>
                        <td className="p-3 text-sm text-right"> SAR {(bal.total_sales || 0).toFixed(2)}</td>
                        <td className="p-3 text-sm text-right text-cash"> SAR {(bal.cash || 0).toFixed(2)}</td>
                        <td className="p-3 text-sm text-right text-bank"> SAR {(bal.bank || 0).toFixed(2)}</td>
                        <td className="p-3 text-sm text-right">
                          {(bal.credit_balance || 0) > 0 ? <span className="font-bold text-warning"> SAR {bal.credit_balance.toFixed(2)}</span> : <span className="text-muted-foreground">$0.00</span>}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex gap-1 justify-end">
                            {(bal.credit_balance || 0) > 0 && (
                              <Button size="sm" variant="outline" onClick={() => { setReceivingCustomer({ ...c, credit_balance: bal.credit_balance }); setReceiveData({ payment_mode: 'cash', amount: '' }); setShowReceiveDialog(true); }} data-testid="receive-credit-btn" className="h-8">
                                <DollarSign size={14} className="mr-1" />Receive
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => handleEdit(c)} data-testid="edit-customer-button" className="h-8"><Edit size={14} /></Button>
                            <Button size="sm" variant="outline" onClick={() => handleDelete(c.id)} data-testid="delete-customer-button" className="h-8 text-error hover:text-error"><Trash2 size={14} /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {customers.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No customers yet</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Receive Credit Dialog */}
        <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
          <DialogContent data-testid="receive-credit-dialog">
            <DialogHeader><DialogTitle className="font-outfit">Receive Credit - {receivingCustomer?.name}</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Outstanding: <span className="font-bold text-warning"> SAR {receivingCustomer?.credit_balance?.toFixed(2)}</span></p>
            <form onSubmit={handleReceiveCredit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Payment Amount</Label><Input type="number" step="0.01" value={receiveData.amount} data-testid="receive-amount-input" onChange={(e) => setReceiveData({ ...receiveData, amount: e.target.value })} placeholder="0.00" /></div>
                <div><Label>Discount</Label><Input type="number" step="0.01" value={receiveData.discount} data-testid="receive-discount-input" onChange={(e) => setReceiveData({ ...receiveData, discount: e.target.value })} placeholder="0.00" /></div>
              </div>
              {(parseFloat(receiveData.amount) > 0 || parseFloat(receiveData.discount) > 0) && (
                <div className="p-3 bg-secondary/50 rounded-lg space-y-1 text-sm">
                  <div className="flex justify-between"><span>Payment:</span><span className="font-medium"> SAR {(parseFloat(receiveData.amount) || 0).toFixed(2)}</span></div>
                  {parseFloat(receiveData.discount) > 0 && <div className="flex justify-between"><span>Discount:</span><span className="font-medium text-error">-SAR {(parseFloat(receiveData.discount) || 0).toFixed(2)}</span></div>}
                  <div className="flex justify-between border-t pt-1 font-bold"><span>Total Settled:</span><span className="text-success"> SAR {((parseFloat(receiveData.amount) || 0) + (parseFloat(receiveData.discount) || 0)).toFixed(2)}</span></div>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Remaining after:</span><span> SAR {(receivingCustomer?.credit_balance - (parseFloat(receiveData.amount) || 0) - (parseFloat(receiveData.discount) || 0)).toFixed(2)}</span></div>
                </div>
              )}
              <div><Label>Payment Mode</Label>
                <Select value={receiveData.payment_mode} onValueChange={(v) => setReceiveData({ ...receiveData, payment_mode: v })}>
                  <SelectTrigger data-testid="receive-mode-select"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <Button type="submit" data-testid="submit-receive-button" className="rounded-full">Receive Payment</Button>
                <Button type="button" variant="outline" onClick={() => setShowReceiveDialog(false)} className="rounded-full">Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
