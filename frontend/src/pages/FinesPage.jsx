import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, DollarSign, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { BranchFilter } from '@/components/BranchFilter';
import { ExportButtons } from '@/components/ExportButtons';

const FINE_TYPES = ['government', 'traffic', 'labor', 'municipality', 'other'];
const DEDUCTION_TYPES = ['fine', 'late', 'absence', 'misbehavior', 'damage', 'other'];

export default function FinesPage() {
  const [fines, setFines] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [fineTypes, setFineTypes] = useState([]);
  const [newFineType, setNewFineType] = useState('');
  const [loading, setLoading] = useState(true);
  const [showFineDialog, setShowFineDialog] = useState(false);
  const [showDeductionDialog, setShowDeductionDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [payingFine, setPayingFine] = useState(null);
  const [payData, setPayData] = useState({ amount: '', payment_mode: 'cash' });
  const [branchFilter, setBranchFilter] = useState([]);
  const [fineData, setFineData] = useState({ fine_type: 'government', department: '', description: '', amount: '', branch_id: '', employee_id: '', fine_date: new Date().toISOString().split('T')[0], due_date: '', deduct_from_salary: false, monthly_deduction: '', notes: '' });
  const [dedData, setDedData] = useState({ employee_id: '', deduction_type: 'late', amount: '', period: format(new Date(), 'MMM yyyy'), reason: '', branch_id: '', date: new Date().toISOString().split('T')[0] });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [fR, dR, bR, eR, catR] = await Promise.all([api.get('/fines'), api.get('/salary-deductions'), api.get('/branches'), api.get('/employees'), api.get('/categories?category_type=fine')]);
      setFines(fR.data); setDeductions(dR.data); setBranches(bR.data); setEmployees(eR.data);
      const defaults = ['government', 'traffic', 'labor', 'municipality', 'other'];
      const custom = catR.data.map(c => c.name.toLowerCase()).filter(n => !defaults.includes(n));
      setFineTypes([...defaults, ...custom]);
    } catch { toast.error('Failed'); }
    finally { setLoading(false); }
  };

  const handleAddFine = async (e) => {
    e.preventDefault();
    try {
      await api.post('/fines', { ...fineData, amount: parseFloat(fineData.amount), monthly_deduction: parseFloat(fineData.monthly_deduction) || 0, fine_date: new Date(fineData.fine_date).toISOString(), due_date: fineData.due_date ? new Date(fineData.due_date).toISOString() : null, branch_id: fineData.branch_id || null, employee_id: fineData.employee_id || null });
      toast.success('Fine recorded'); setShowFineDialog(false); fetchData();
      setFineData({ fine_type: 'government', department: '', description: '', amount: '', branch_id: '', employee_id: '', fine_date: new Date().toISOString().split('T')[0], due_date: '', deduct_from_salary: false, monthly_deduction: '', notes: '' });
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleAddDeduction = async (e) => {
    e.preventDefault();
    try {
      await api.post('/salary-deductions', { ...dedData, amount: parseFloat(dedData.amount), date: new Date(dedData.date).toISOString(), branch_id: dedData.branch_id || null });
      toast.success('Deduction recorded'); setShowDeductionDialog(false); fetchData();
      setDedData({ employee_id: '', deduction_type: 'late', amount: '', period: format(new Date(), 'MMM yyyy'), reason: '', branch_id: '', date: new Date().toISOString().split('T')[0] });
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handlePayFine = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/fines/${payingFine.id}/pay`, { amount: parseFloat(payData.amount), payment_mode: payData.payment_mode });
      toast.success('Payment recorded'); setShowPayDialog(false); setPayData({ amount: '', payment_mode: 'cash' }); fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  const filteredFines = fines.filter(f => branchFilter.length === 0 || branchFilter.includes(f.branch_id) || !f.branch_id);
  const filteredDed = deductions.filter(d => branchFilter.length === 0 || branchFilter.includes(d.branch_id) || !d.branch_id);
  const totalFines = filteredFines.reduce((s, f) => s + f.amount, 0);
  const unpaidFines = filteredFines.filter(f => f.payment_status !== 'paid').reduce((s, f) => s + f.amount - f.paid_amount, 0);
  const totalDeductions = filteredDed.reduce((s, d) => s + d.amount, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="fines-title">Fines & Deductions</h1>
            <p className="text-muted-foreground">Track government fines, penalties & salary deductions</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <BranchFilter onChange={setBranchFilter} />
            <Dialog open={showFineDialog} onOpenChange={setShowFineDialog}>
              <DialogTrigger asChild><Button className="rounded-xl" data-testid="add-fine-btn"><Plus size={16} className="mr-2" />Add Fine</Button></DialogTrigger>
              <DialogContent className="max-w-lg"><DialogHeader><DialogTitle className="font-outfit">Record Fine / Penalty</DialogTitle></DialogHeader>
                <form onSubmit={handleAddFine} className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Type *</Label><Select value={fineData.fine_type} onValueChange={(v) => setFineData({ ...fineData, fine_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FINE_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Department *</Label><Input value={fineData.department} onChange={(e) => setFineData({ ...fineData, department: e.target.value })} required placeholder="e.g., Traffic Dept" /></div>
                    <div className="col-span-2"><Label>Description *</Label><Input value={fineData.description} onChange={(e) => setFineData({ ...fineData, description: e.target.value })} required /></div>
                    <div><Label>Amount *</Label><Input type="number" step="0.01" value={fineData.amount} onChange={(e) => setFineData({ ...fineData, amount: e.target.value })} required /></div>
                    <div><Label>Branch</Label><Select value={fineData.branch_id || "none"} onValueChange={(v) => setFineData({ ...fineData, branch_id: v === "none" ? "" : v })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent><SelectItem value="none">No Branch</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Fine Date *</Label><Input type="date" value={fineData.fine_date} onChange={(e) => setFineData({ ...fineData, fine_date: e.target.value })} required /></div>
                    <div><Label>Due Date</Label><Input type="date" value={fineData.due_date} onChange={(e) => setFineData({ ...fineData, due_date: e.target.value })} /></div>
                    <div><Label>Charge to Employee</Label><Select value={fineData.employee_id || "none"} onValueChange={(v) => setFineData({ ...fineData, employee_id: v === "none" ? "" : v })}><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger><SelectContent><SelectItem value="none">Company</SelectItem>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select></div>
                    {fineData.employee_id && (
                      <>
                        <div className="col-span-2 flex items-center gap-3 p-3 bg-warning/10 rounded-xl border border-warning/20"><Checkbox checked={fineData.deduct_from_salary} onCheckedChange={(v) => setFineData({ ...fineData, deduct_from_salary: v })} /><div><Label>Deduct from monthly salary</Label>{fineData.deduct_from_salary && <Input type="number" step="0.01" value={fineData.monthly_deduction} onChange={(e) => setFineData({ ...fineData, monthly_deduction: e.target.value })} placeholder="Monthly amount" className="h-8 mt-1 w-40" />}</div></div>
                      </>
                    )}
                  </div>
                  <div><Label>Notes</Label><Textarea value={fineData.notes} onChange={(e) => setFineData({ ...fineData, notes: e.target.value })} /></div>
                  <div className="flex gap-3"><Button type="submit" className="rounded-xl">Record Fine</Button><Button type="button" variant="outline" onClick={() => setShowFineDialog(false)} className="rounded-xl">Cancel</Button></div>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={showDeductionDialog} onOpenChange={setShowDeductionDialog}>
              <DialogTrigger asChild><Button variant="outline" className="rounded-xl" data-testid="add-deduction-btn"><Plus size={16} className="mr-2" />Deduction</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle className="font-outfit">Salary Deduction</DialogTitle></DialogHeader>
                <form onSubmit={handleAddDeduction} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Employee *</Label><Select value={dedData.employee_id || "none"} onValueChange={(v) => setDedData({ ...dedData, employee_id: v === "none" ? "" : v })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Type *</Label><Select value={dedData.deduction_type} onValueChange={(v) => setDedData({ ...dedData, deduction_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DEDUCTION_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Amount *</Label><Input type="number" step="0.01" value={dedData.amount} onChange={(e) => setDedData({ ...dedData, amount: e.target.value })} required /></div>
                    <div><Label>Period</Label><Input value={dedData.period} onChange={(e) => setDedData({ ...dedData, period: e.target.value })} /></div>
                    <div><Label>Branch</Label><Select value={dedData.branch_id || "none"} onValueChange={(v) => setDedData({ ...dedData, branch_id: v === "none" ? "" : v })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent><SelectItem value="none">No Branch</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Date</Label><Input type="date" value={dedData.date} onChange={(e) => setDedData({ ...dedData, date: e.target.value })} /></div>
                  </div>
                  <div><Label>Reason *</Label><Input value={dedData.reason} onChange={(e) => setDedData({ ...dedData, reason: e.target.value })} required placeholder="Reason for deduction" /></div>
                  <div className="flex gap-3"><Button type="submit" className="rounded-xl">Record Deduction</Button><Button type="button" variant="outline" onClick={() => setShowDeductionDialog(false)} className="rounded-xl">Cancel</Button></div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-stone-100"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Fines</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold font-outfit text-error">SAR {totalFines.toFixed(2)}</div></CardContent></Card>
          <Card className="border-stone-100 bg-warning/5"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Unpaid Fines</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold font-outfit text-warning">SAR {unpaidFines.toFixed(2)}</div></CardContent></Card>
          <Card className="border-stone-100"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Deductions</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold font-outfit text-info">SAR {totalDeductions.toFixed(2)}</div></CardContent></Card>
        </div>

        <Tabs defaultValue="fines">
          <TabsList><TabsTrigger value="fines">Fines & Penalties</TabsTrigger><TabsTrigger value="deductions">Salary Deductions</TabsTrigger></TabsList>

          <TabsContent value="fines">
            <Card className="border-stone-100"><CardContent className="pt-6">
              <table className="w-full"><thead><tr className="border-b">
                <th className="text-left p-3 text-sm font-medium">Date</th><th className="text-left p-3 text-sm font-medium">Type</th><th className="text-left p-3 text-sm font-medium">Department</th><th className="text-left p-3 text-sm font-medium">Description</th><th className="text-right p-3 text-sm font-medium">Amount</th><th className="text-right p-3 text-sm font-medium">Paid</th><th className="text-center p-3 text-sm font-medium">Status</th><th className="text-right p-3 text-sm font-medium">Actions</th>
              </tr></thead><tbody>
                {filteredFines.map(f => (
                  <tr key={f.id} className="border-b hover:bg-stone-50" data-testid="fine-row">
                    <td className="p-3 text-sm">{format(new Date(f.fine_date), 'MMM dd, yyyy')}</td>
                    <td className="p-3"><Badge variant="secondary" className="capitalize">{f.fine_type}</Badge></td>
                    <td className="p-3 text-sm">{f.department}</td>
                    <td className="p-3 text-sm">{f.description}{f.employee_id && <span className="text-xs text-warning ml-1">(Employee)</span>}</td>
                    <td className="p-3 text-sm text-right font-bold">SAR {f.amount.toFixed(2)}</td>
                    <td className="p-3 text-sm text-right text-success">SAR {(f.paid_amount || 0).toFixed(2)}</td>
                    <td className="p-3 text-center"><Badge className={f.payment_status === 'paid' ? 'bg-success/20 text-success' : f.payment_status === 'partial' ? 'bg-warning/20 text-warning' : 'bg-error/20 text-error'}>{f.payment_status}</Badge></td>
                    <td className="p-3 text-right"><div className="flex gap-1 justify-end">
                      {f.payment_status !== 'paid' && <Button size="sm" variant="outline" onClick={() => { setPayingFine(f); setPayData({ amount: (f.amount - (f.paid_amount || 0)).toFixed(2), payment_mode: 'cash' }); setShowPayDialog(true); }} className="h-7 text-xs"><DollarSign size={12} className="mr-1" />Pay</Button>}
                      <Button size="sm" variant="ghost" onClick={async () => { if (window.confirm('Delete?')) { await api.delete(`/fines/${f.id}`); fetchData(); } }} className="h-7 text-xs text-error"><Trash2 size={12} /></Button>
                    </div></td>
                  </tr>
                ))}
                {filteredFines.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No fines recorded</td></tr>}
              </tbody></table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="deductions">
            <Card className="border-stone-100"><CardContent className="pt-6">
              <table className="w-full"><thead><tr className="border-b">
                <th className="text-left p-3 text-sm font-medium">Date</th><th className="text-left p-3 text-sm font-medium">Employee</th><th className="text-left p-3 text-sm font-medium">Type</th><th className="text-left p-3 text-sm font-medium">Reason</th><th className="text-left p-3 text-sm font-medium">Period</th><th className="text-right p-3 text-sm font-medium">Amount</th><th className="text-right p-3 text-sm font-medium">Actions</th>
              </tr></thead><tbody>
                {filteredDed.map(d => (
                  <tr key={d.id} className="border-b hover:bg-stone-50" data-testid="deduction-row">
                    <td className="p-3 text-sm">{format(new Date(d.date), 'MMM dd, yyyy')}</td>
                    <td className="p-3 text-sm font-medium">{d.employee_name}</td>
                    <td className="p-3"><Badge variant="secondary" className="capitalize">{d.deduction_type}</Badge></td>
                    <td className="p-3 text-sm">{d.reason}</td>
                    <td className="p-3 text-sm">{d.period}</td>
                    <td className="p-3 text-sm text-right font-bold text-error">SAR {d.amount.toFixed(2)}</td>
                    <td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={async () => { if (window.confirm('Delete?')) { await api.delete(`/salary-deductions/${d.id}`); fetchData(); } }} className="h-7 text-xs text-error"><Trash2 size={12} /></Button></td>
                  </tr>
                ))}
                {filteredDed.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No deductions recorded</td></tr>}
              </tbody></table>
            </CardContent></Card>
          </TabsContent>
        </Tabs>

        <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
          <DialogContent><DialogHeader><DialogTitle className="font-outfit">Pay Fine - {payingFine?.department}</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Remaining: <span className="font-bold text-warning">SAR {payingFine ? (payingFine.amount - (payingFine.paid_amount || 0)).toFixed(2) : '0'}</span></p>
            <form onSubmit={handlePayFine} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Amount *</Label><Input type="number" step="0.01" value={payData.amount} onChange={(e) => setPayData({ ...payData, amount: e.target.value })} required /></div>
                <div><Label>Mode</Label><Select value={payData.payment_mode} onValueChange={(v) => setPayData({ ...payData, payment_mode: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent></Select></div>
              </div>
              <div className="flex gap-3"><Button type="submit" className="rounded-xl">Record Payment</Button><Button type="button" variant="outline" onClick={() => setShowPayDialog(false)} className="rounded-xl">Cancel</Button></div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
