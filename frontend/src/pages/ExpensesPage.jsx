import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, AlertTriangle, DollarSign, Settings2, MessageCircle } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ExportButtons } from '@/components/ExportButtons';
import { WhatsAppSendDialog } from '@/components/WhatsAppSendDialog';
import { BranchFilter } from '@/components/BranchFilter';
import { DateFilter } from '@/components/DateFilter';

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recurringExpenses, setRecurringExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState([]);
  const [dateFilter, setDateFilter] = useState({ start: null, end: null, period: 'all' });
  const [showCatManager, setShowCatManager] = useState(false);
  const [showRenewDialog, setShowRenewDialog] = useState(false);
  const [renewingRec, setRenewingRec] = useState(null);
  const [renewData, setRenewData] = useState({ amount: '', payment_mode: 'cash', branch_id: '' });
  const [newCat, setNewCat] = useState('');
  const [newSubCat, setNewSubCat] = useState({ name: '', parent: '' });
  const [newRecData, setNewRecData] = useState({ name: '', category: 'rent', amount: '', frequency: 'monthly', branch_id: '', next_due_date: '', alert_days: 7 });
  const [showWhatsApp, setShowWhatsApp] = useState(false);

  const [formData, setFormData] = useState({
    category: '', sub_category: '', description: '', amount: '',
    payment_mode: 'cash', branch_id: '', expense_for_branch_id: '', supplier_id: '',
    date: new Date().toISOString().split('T')[0], notes: ''
  });

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin' || user.role === 'manager';

  const defaultCats = [
    { name: 'Salary', subs: ['Basic Salary', 'Overtime', 'Bonus'] },
    { name: 'Rent', subs: ['Office Rent', 'Warehouse Rent', 'Shop Rent'] },
    { name: 'Utilities', subs: ['Electricity', 'Water', 'Internet', 'Phone'] },
    { name: 'Vehicle', subs: ['Fuel', 'Maintenance', 'Insurance'] },
    { name: 'Maintenance', subs: ['Office Maintenance', 'Equipment Repair'] },
    { name: 'Supplier', subs: [] },
    { name: 'Tickets', subs: [] },
    { name: 'ID Card', subs: [] },
    { name: 'Other', subs: [] },
  ];

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [eR, sR, bR, cR, rR] = await Promise.all([api.get('/expenses'), api.get('/suppliers'), api.get('/branches'), api.get('/categories?category_type=expense'), api.get('/recurring-expenses')]);
      setExpenses(eR.data); setSuppliers(sR.data); setBranches(bR.data); setCategories(cR.data); setRecurringExpenses(rR.data);
    } catch { toast.error('Failed'); } finally { setLoading(false); }
  };

  // Build category tree
  const mainCats = [...defaultCats.map(c => c.name), ...categories.filter(c => !c.parent_id).map(c => c.name)].filter((v, i, a) => a.indexOf(v) === i);
  const getSubCats = (mainCat) => {
    const defaultSubs = defaultCats.find(c => c.name === mainCat)?.subs || [];
    const customSubs = categories.filter(c => c.parent_id).filter(c => {
      const parent = categories.find(p => p.id === c.parent_id);
      return parent?.name === mainCat;
    }).map(c => c.name);
    return [...defaultSubs, ...customSubs].filter((v, i, a) => a.indexOf(v) === i);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.category || !formData.amount) { toast.error('Select category and amount'); return; }
    try {
      await api.post('/expenses', {
        ...formData, category: formData.sub_category || formData.category,
        sub_category: formData.sub_category ? formData.category : null,
        amount: parseFloat(formData.amount),
        branch_id: formData.branch_id || null, supplier_id: formData.supplier_id || null,
        expense_for_branch_id: formData.expense_for_branch_id || null,
        date: new Date(formData.date).toISOString()
      });
      toast.success('Expense added');
      setFormData({ category: '', sub_category: '', description: '', amount: '', payment_mode: 'cash', branch_id: '', expense_for_branch_id: '', supplier_id: '', date: new Date().toISOString().split('T')[0], notes: '' });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleAddCat = async () => {
    if (!newCat.trim()) return;
    try { await api.post('/categories', { name: newCat.trim(), type: 'expense' }); toast.success('Category added'); setNewCat(''); fetchData(); }
    catch { toast.error('Failed'); }
  };

  const handleAddSubCat = async () => {
    if (!newSubCat.name.trim() || !newSubCat.parent) return;
    const parent = categories.find(c => c.name === newSubCat.parent && !c.parent_id);
    try { await api.post('/categories', { name: newSubCat.name.trim(), type: 'expense', parent_id: parent?.id || null }); toast.success('Sub-category added'); setNewSubCat({ name: '', parent: '' }); fetchData(); }
    catch { toast.error('Failed'); }
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  const filtered = expenses.filter(e => {
    if (branchFilter.length > 0 && !branchFilter.includes(e.branch_id)) return false;
    if (dateFilter.start && dateFilter.end) { const d = new Date(e.date); return d >= dateFilter.start && d <= dateFilter.end; }
    return true;
  });
  const totalExp = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 className="text-4xl font-bold font-outfit mb-2">Expenses</h1>
            <p className="text-muted-foreground">Track and manage all business expenses</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <BranchFilter onChange={setBranchFilter} />
            <DateFilter onFilterChange={setDateFilter} />
            <ExportButtons dataType="expenses" />
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowWhatsApp(true)} data-testid="expenses-whatsapp-btn"><MessageCircle size={14} className="mr-1" />WhatsApp</Button>
            {isAdmin && <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowCatManager(true)}><Settings2 size={14} className="mr-1" />Categories</Button>}
          </div>
        </div>

        <Tabs defaultValue="add">
          <TabsList><TabsTrigger value="add">Add Expense</TabsTrigger><TabsTrigger value="list">All Expenses ({filtered.length})</TabsTrigger><TabsTrigger value="recurring">Recurring & Planned</TabsTrigger></TabsList>

          {/* ADD EXPENSE - Simplified */}
          <TabsContent value="add">
            <Card className="border-stone-100">
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>Category *</Label>
                    <div className="flex gap-2 flex-wrap mt-2">
                      {mainCats.map((c, i) => {
                        const colors = ['bg-orange-100 border-orange-300 text-orange-700', 'bg-green-100 border-green-300 text-green-700', 'bg-blue-100 border-blue-300 text-blue-700', 'bg-purple-100 border-purple-300 text-purple-700', 'bg-red-100 border-red-300 text-red-700', 'bg-cyan-100 border-cyan-300 text-cyan-700', 'bg-amber-100 border-amber-300 text-amber-700', 'bg-pink-100 border-pink-300 text-pink-700', 'bg-stone-100 border-stone-300 text-stone-700'];
                        return (
                          <button key={c} type="button" onClick={() => setFormData({...formData, category: c, sub_category: ''})}
                            className={`px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${colors[i % colors.length]} ${formData.category === c ? 'ring-2 ring-primary ring-offset-1 scale-105 shadow-md' : 'opacity-80 hover:opacity-100 hover:scale-105'}`}>
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {formData.category && getSubCats(formData.category).length > 0 && (
                    <div>
                      <Label>Sub-Category</Label>
                      <div className="flex gap-2 flex-wrap mt-2">
                        <button type="button" onClick={() => setFormData({...formData, sub_category: ''})}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${!formData.sub_category ? 'bg-primary text-white' : 'bg-stone-50 border-stone-200 hover:bg-stone-100'}`}>General</button>
                        {getSubCats(formData.category).map(s => (
                          <button key={s} type="button" onClick={() => setFormData({...formData, sub_category: s})}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${formData.sub_category === s ? 'bg-primary text-white' : 'bg-stone-50 border-stone-200 hover:bg-stone-100'}`}>{s}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label>Amount *</Label>
                      <Input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="SAR 0.00" className="h-10" required />
                    </div>
                    <div>
                      <Label>Payment</Label>
                      <Select value={formData.payment_mode} onValueChange={(v) => setFormData({ ...formData, payment_mode: v })}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank</SelectItem><SelectItem value="credit">Credit</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Paid From (Branch)</Label>
                      <Select value={formData.branch_id || "none"} onValueChange={(v) => setFormData({ ...formData, branch_id: v === "none" ? "" : v })}>
                        <SelectTrigger className="h-10" data-testid="expense-paid-from-branch"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="none">No Branch</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Expense For Branch</Label>
                      <Select value={formData.expense_for_branch_id || "none"} onValueChange={(v) => setFormData({ ...formData, expense_for_branch_id: v === "none" ? "" : v })}>
                        <SelectTrigger className="h-10" data-testid="expense-for-branch"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="none">Same as Paid From</SelectItem>{branches.filter(b => b.id !== formData.branch_id).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Date</Label>
                      <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="h-10" />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="What was this for?" className="h-10" />
                    </div>
                    <div className="flex items-end">
                      <Button type="submit" className="rounded-xl w-full h-10" data-testid="add-expense-btn"><Plus size={16} className="mr-2" />Add Expense</Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ALL EXPENSES */}
          <TabsContent value="list">
            <Card className="border-stone-100">
              <CardHeader><CardTitle className="font-outfit text-base flex justify-between">All Expenses <span className="text-error">Total: SAR {totalExp.toFixed(2)}</span></CardTitle></CardHeader>
              <CardContent>
                <table className="w-full"><thead><tr className="border-b">
                  <th className="text-left p-3 text-sm font-medium">Date</th><th className="text-left p-3 text-sm font-medium">Category</th><th className="text-left p-3 text-sm font-medium">Description</th><th className="text-left p-3 text-sm font-medium">Paid From</th><th className="text-left p-3 text-sm font-medium">Expense For</th><th className="text-right p-3 text-sm font-medium">Amount</th><th className="text-left p-3 text-sm font-medium">Mode</th><th className="text-right p-3 text-sm font-medium">Actions</th>
                </tr></thead><tbody>
                  {filtered.map(e => (
                    <tr key={e.id} className="border-b hover:bg-stone-50" data-testid={`expense-row-${e.id}`}>
                      <td className="p-3 text-sm">{format(new Date(e.date), 'MMM dd, yyyy')}</td>
                      <td className="p-3"><Badge variant="secondary" className="capitalize">{e.category?.replace('_',' ')}</Badge>{e.sub_category && <Badge variant="outline" className="ml-1 text-xs capitalize">{e.sub_category}</Badge>}</td>
                      <td className="p-3 text-sm">{e.description || '-'}</td>
                      <td className="p-3 text-sm">{branches.find(b => b.id === e.branch_id)?.name || '-'}</td>
                      <td className="p-3 text-sm">{e.expense_for_branch_id ? <Badge variant="outline" className="bg-amber-50 border-amber-300 text-amber-700">{branches.find(b => b.id === e.expense_for_branch_id)?.name || '-'}</Badge> : <span className="text-muted-foreground">-</span>}</td>
                      <td className="p-3 text-sm text-right font-bold">SAR {e.amount.toFixed(2)}</td>
                      <td className="p-3"><Badge className={`capitalize ${e.payment_mode === 'cash' ? 'bg-cash/20 text-cash' : e.payment_mode === 'bank' ? 'bg-bank/20 text-bank' : 'bg-credit/20 text-credit'}`}>{e.payment_mode}</Badge></td>
                      <td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={async () => { if(window.confirm('Delete?')) { await api.delete(`/expenses/${e.id}`); fetchData(); }}} className="h-7 text-error"><Trash2 size={12} /></Button></td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No expenses</td></tr>}
                </tbody></table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* RECURRING & PLANNED */}
          <TabsContent value="recurring">
            <div className="space-y-4">
              <Card className="border-stone-100">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="font-outfit text-base">Recurring Expenses (Rent, Insurance, Renewals)</CardTitle>
                    <Button size="sm" className="rounded-xl" onClick={() => document.getElementById('rec-form').classList.toggle('hidden')}><Plus size={14} className="mr-1" />Add Recurring</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div id="rec-form" className="hidden mb-4 p-4 bg-stone-50 rounded-xl border space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div><Label className="text-xs">Name *</Label><Input value={newRecData.name} onChange={(e) => setNewRecData({...newRecData, name: e.target.value})} placeholder="Office Rent" className="h-8" /></div>
                      <div><Label className="text-xs">Category</Label><Input value={newRecData.category} onChange={(e) => setNewRecData({...newRecData, category: e.target.value})} placeholder="rent" className="h-8" /></div>
                      <div><Label className="text-xs">Amount *</Label><Input type="number" step="0.01" value={newRecData.amount} onChange={(e) => setNewRecData({...newRecData, amount: e.target.value})} className="h-8" /></div>
                      <div><Label className="text-xs">Frequency</Label><Select value={newRecData.frequency} onValueChange={(v) => setNewRecData({...newRecData, frequency: v})}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="yearly">Yearly</SelectItem></SelectContent></Select></div>
                      <div><Label className="text-xs">Branch</Label><Select value={newRecData.branch_id || "none"} onValueChange={(v) => setNewRecData({...newRecData, branch_id: v === "none" ? "" : v})}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">All</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
                      <div><Label className="text-xs">Next Due *</Label><Input type="date" value={newRecData.next_due_date} onChange={(e) => setNewRecData({...newRecData, next_due_date: e.target.value})} className="h-8" /></div>
                      <div><Label className="text-xs">Alert Days</Label><Input type="number" value={newRecData.alert_days} onChange={(e) => setNewRecData({...newRecData, alert_days: e.target.value})} className="h-8" /></div>
                      <div className="flex items-end"><Button size="sm" className="h-8 rounded-xl w-full" onClick={async () => {
                        if (!newRecData.name || !newRecData.amount || !newRecData.next_due_date) { toast.error('Fill required'); return; }
                        try { await api.post('/recurring-expenses', {...newRecData, amount: parseFloat(newRecData.amount), alert_days: parseInt(newRecData.alert_days) || 7, branch_id: newRecData.branch_id || null, next_due_date: new Date(newRecData.next_due_date).toISOString()}); toast.success('Added'); setNewRecData({name:'',category:'rent',amount:'',frequency:'monthly',branch_id:'',next_due_date:'',alert_days:7}); fetchData(); }
                        catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
                      }}>Save</Button></div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {recurringExpenses.map(r => {
                      const dl = r.days_until_due;
                      const overdue = dl != null && dl < 0;
                      const near = dl != null && dl <= (r.alert_days || 7) && dl >= 0;
                      return (
                        <div key={r.id} className={`flex justify-between items-center p-4 rounded-xl border ${overdue ? 'bg-error/5 border-error/30' : near ? 'bg-warning/5 border-warning/30' : 'bg-stone-50'}`}>
                          <div>
                            <div className="font-medium">{r.name}</div>
                            <div className="text-xs text-muted-foreground mt-1 capitalize">{r.category} | {r.frequency} | SAR {r.amount.toFixed(2)}{r.branch_id ? ` | ${branches.find(b => b.id === r.branch_id)?.name || ''}` : ''}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            {dl != null && <Badge className={overdue ? 'bg-error/20 text-error' : near ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'}>{overdue ? `${Math.abs(dl)}d overdue` : `${dl}d left`}</Badge>}
                            <Button size="sm" variant="default" className="rounded-xl" onClick={() => { setRenewingRec(r); setRenewData({ amount: r.amount.toString(), payment_mode: 'cash', branch_id: r.branch_id || '' }); setShowRenewDialog(true); }}><DollarSign size={14} className="mr-1" />Renew & Pay</Button>
                            <Button size="sm" variant="ghost" className="text-error" onClick={async () => { if(window.confirm('Delete?')) { await api.delete(`/recurring-expenses/${r.id}`); fetchData(); }}}><Trash2 size={12} /></Button>
                          </div>
                        </div>
                      );
                    })}
                    {recurringExpenses.length === 0 && <div className="text-center py-8 text-muted-foreground"><AlertTriangle size={24} className="mx-auto mb-2 text-warning" /><p>No recurring expenses set up yet.</p><p className="text-xs mt-1">Add rent, insurance, subscriptions etc. to get alerts before they're due.</p></div>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Category Manager Dialog */}
        <Dialog open={showCatManager} onOpenChange={setShowCatManager}>
          <DialogContent className="max-w-lg"><DialogHeader><DialogTitle className="font-outfit">Manage Expense Categories</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Add Main Category</Label>
                <div className="flex gap-2 mt-1"><Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="e.g. Marketing" className="h-9" /><Button size="sm" className="rounded-xl h-9" onClick={handleAddCat}>Add</Button></div>
              </div>
              <div>
                <Label className="text-sm font-medium">Add Sub-Category</Label>
                <div className="flex gap-2 mt-1">
                  <Select value={newSubCat.parent || "none"} onValueChange={(v) => setNewSubCat({...newSubCat, parent: v === "none" ? "" : v})}><SelectTrigger className="h-9 w-36"><SelectValue placeholder="Parent" /></SelectTrigger><SelectContent><SelectItem value="none">Select</SelectItem>{mainCats.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                  <Input value={newSubCat.name} onChange={(e) => setNewSubCat({...newSubCat, name: e.target.value})} placeholder="Sub-category name" className="h-9 flex-1" />
                  <Button size="sm" className="rounded-xl h-9" onClick={handleAddSubCat}>Add</Button>
                </div>
              </div>
              <div className="border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Current Categories:</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">{mainCats.map(cat => (
                  <div key={cat} className="p-2 bg-stone-50 rounded-lg">
                    <span className="font-medium text-sm">{cat}</span>
                    {getSubCats(cat).length > 0 && <div className="flex gap-1 mt-1 flex-wrap">{getSubCats(cat).map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}</div>}
                  </div>
                ))}</div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Renew & Pay Dialog */}
        <Dialog open={showRenewDialog} onOpenChange={setShowRenewDialog}>
          <DialogContent><DialogHeader><DialogTitle className="font-outfit">Renew & Pay - {renewingRec?.name}</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground capitalize">{renewingRec?.category} | {renewingRec?.frequency}</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Amount *</Label><Input type="number" step="0.01" value={renewData.amount} onChange={(e) => setRenewData({...renewData, amount: e.target.value})} /></div>
                <div><Label>Mode</Label><Select value={renewData.payment_mode} onValueChange={(v) => setRenewData({...renewData, payment_mode: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent></Select></div>
                <div><Label>Branch</Label><Select value={renewData.branch_id || "none"} onValueChange={(v) => setRenewData({...renewData, branch_id: v === "none" ? "" : v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No Branch</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <Button className="rounded-xl" onClick={async () => {
                try { const res = await api.post(`/recurring-expenses/${renewingRec.id}/renew-pay`, {amount: parseFloat(renewData.amount), payment_mode: renewData.payment_mode, branch_id: renewData.branch_id || null}); toast.success(res.data.message); setShowRenewDialog(false); fetchData(); }
                catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
              }}>Pay & Renew</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
