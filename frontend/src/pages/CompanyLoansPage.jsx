import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, DollarSign, Building2 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { BranchFilter } from '@/components/BranchFilter';

export default function CompanyLoansPage() {
  const [loans, setLoans] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [payingLoan, setPayingLoan] = useState(null);
  const [branchFilter, setBranchFilter] = useState([]);
  const [loanData, setLoanData] = useState({ lender: '', loan_type: 'bank', total_amount: '', monthly_payment: '', interest_rate: '', branch_id: '', start_date: new Date().toISOString().split('T')[0], notes: '' });
  const [payData, setPayData] = useState({ amount: '', payment_mode: 'bank', branch_id: '' });

  useEffect(() => { fetchData(); }, []);
  const fetchData = async () => {
    try { const [lR, bR] = await Promise.all([api.get('/company-loans'), api.get('/branches')]); setLoans(lR.data); setBranches(bR.data); }
    catch { toast.error('Failed'); } finally { setLoading(false); }
  };

  const handleAddLoan = async (e) => {
    e.preventDefault();
    try { await api.post('/company-loans', { ...loanData, total_amount: parseFloat(loanData.total_amount), monthly_payment: parseFloat(loanData.monthly_payment) || 0, interest_rate: parseFloat(loanData.interest_rate) || 0, branch_id: loanData.branch_id || null, start_date: new Date(loanData.start_date).toISOString() }); toast.success('Loan added'); setShowAddDialog(false); setLoanData({ lender: '', loan_type: 'bank', total_amount: '', monthly_payment: '', interest_rate: '', branch_id: '', start_date: new Date().toISOString().split('T')[0], notes: '' }); fetchData(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handlePay = async (e) => {
    e.preventDefault();
    try { const res = await api.post(`/company-loans/${payingLoan.id}/pay`, { amount: parseFloat(payData.amount), payment_mode: payData.payment_mode, branch_id: payData.branch_id || null }); toast.success(res.data.message); setShowPayDialog(false); fetchData(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  const filtered = loans.filter(l => branchFilter.length === 0 || branchFilter.includes(l.branch_id) || !l.branch_id);
  const totalLoans = filtered.reduce((s, l) => s + l.total_amount, 0);
  const totalPaid = filtered.reduce((s, l) => s + (l.paid_amount || 0), 0);
  const totalRemaining = filtered.reduce((s, l) => s + (l.remaining || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div><h1 className="text-4xl font-bold font-outfit mb-2">Company Loans</h1><p className="text-muted-foreground">Track bank loans, personal loans & repayments</p></div>
          <div className="flex gap-2 items-center flex-wrap">
            <BranchFilter onChange={setBranchFilter} />
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild><Button className="rounded-xl"><Plus size={16} className="mr-2" />Add Loan</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle className="font-outfit">Add Company Loan</DialogTitle></DialogHeader>
                <form onSubmit={handleAddLoan} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Lender *</Label><Input value={loanData.lender} onChange={(e) => setLoanData({...loanData, lender: e.target.value})} required placeholder="Bank name / Person" /></div>
                    <div><Label>Type</Label><Select value={loanData.loan_type} onValueChange={(v) => setLoanData({...loanData, loan_type: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bank">Bank Loan</SelectItem><SelectItem value="personal">Personal Loan</SelectItem><SelectItem value="partner">Partner Loan</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
                    <div><Label>Total Amount *</Label><Input type="number" step="0.01" value={loanData.total_amount} onChange={(e) => setLoanData({...loanData, total_amount: e.target.value})} required /></div>
                    <div><Label>Monthly Payment</Label><Input type="number" step="0.01" value={loanData.monthly_payment} onChange={(e) => setLoanData({...loanData, monthly_payment: e.target.value})} /></div>
                    <div><Label>Interest %</Label><Input type="number" step="0.1" value={loanData.interest_rate} onChange={(e) => setLoanData({...loanData, interest_rate: e.target.value})} /></div>
                    <div><Label>Branch</Label><Select value={loanData.branch_id || "none"} onValueChange={(v) => setLoanData({...loanData, branch_id: v === "none" ? "" : v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Company Overall</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Start Date</Label><Input type="date" value={loanData.start_date} onChange={(e) => setLoanData({...loanData, start_date: e.target.value})} /></div>
                  </div>
                  <div><Label>Notes</Label><Input value={loanData.notes} onChange={(e) => setLoanData({...loanData, notes: e.target.value})} /></div>
                  <Button type="submit" className="rounded-xl">Add Loan</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-stone-100"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Loans</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-error">SAR {totalLoans.toFixed(2)}</div></CardContent></Card>
          <Card className="border-stone-100"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Paid</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-success">SAR {totalPaid.toFixed(2)}</div></CardContent></Card>
          <Card className="border-stone-100 bg-warning/5"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Remaining</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-warning">SAR {totalRemaining.toFixed(2)}</div></CardContent></Card>
        </div>

        <div className="space-y-4">
          {filtered.map(loan => {
            const pct = loan.total_amount > 0 ? (loan.paid_amount / loan.total_amount * 100) : 0;
            return (
              <Card key={loan.id} className={`border-stone-100 ${loan.status === 'paid' ? 'opacity-60' : ''}`}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2"><Building2 size={18} className="text-primary" /><span className="font-bold text-lg">{loan.lender}</span><Badge variant="secondary" className="capitalize">{loan.loan_type}</Badge>{loan.status === 'paid' && <Badge className="bg-success/20 text-success">Paid Off</Badge>}</div>
                      <div className="text-sm text-muted-foreground mt-1">{loan.branch_id ? branches.find(b => b.id === loan.branch_id)?.name : 'Company'} | Started: {format(new Date(loan.start_date), 'MMM yyyy')}{loan.interest_rate > 0 ? ` | ${loan.interest_rate}% interest` : ''}{loan.monthly_payment > 0 ? ` | SAR ${loan.monthly_payment.toFixed(0)}/mo` : ''}</div>
                    </div>
                    <div className="flex gap-2">
                      {loan.status !== 'paid' && <Button size="sm" variant="outline" className="rounded-xl" onClick={() => { setPayingLoan(loan); setPayData({ amount: loan.monthly_payment || '', payment_mode: 'bank', branch_id: loan.branch_id || '' }); setShowPayDialog(true); }}><DollarSign size={14} className="mr-1" />Pay</Button>}
                      <Button size="sm" variant="ghost" className="text-error" onClick={async () => { if(window.confirm('Delete?')) { await api.delete(`/company-loans/${loan.id}`); fetchData(); }}}><Trash2 size={14} /></Button>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div className="text-center p-2 bg-stone-50 rounded-lg"><div className="text-xs text-muted-foreground">Total</div><div className="font-bold">SAR {loan.total_amount.toFixed(2)}</div></div>
                    <div className="text-center p-2 bg-success/10 rounded-lg"><div className="text-xs text-muted-foreground">Paid</div><div className="font-bold text-success">SAR {(loan.paid_amount || 0).toFixed(2)}</div></div>
                    <div className="text-center p-2 bg-warning/10 rounded-lg"><div className="text-xs text-muted-foreground">Remaining</div><div className="font-bold text-warning">SAR {(loan.remaining || 0).toFixed(2)}</div></div>
                  </div>
                  <div className="mt-3 w-full h-3 bg-stone-100 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-success to-primary rounded-full transition-all" style={{width: `${Math.min(pct, 100)}%`}} /></div>
                  <p className="text-xs text-muted-foreground mt-1 text-right">{pct.toFixed(1)}% paid</p>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && <Card className="border-dashed"><CardContent className="p-12 text-center text-muted-foreground">No company loans. Click "Add Loan" to track.</CardContent></Card>}
        </div>

        <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
          <DialogContent><DialogHeader><DialogTitle className="font-outfit">Loan Payment - {payingLoan?.lender}</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Remaining: <span className="font-bold text-warning">SAR {payingLoan?.remaining?.toFixed(2)}</span></p>
            <form onSubmit={handlePay} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Amount *</Label><Input type="number" step="0.01" value={payData.amount} onChange={(e) => setPayData({...payData, amount: e.target.value})} required /></div>
                <div><Label>Mode</Label><Select value={payData.payment_mode} onValueChange={(v) => setPayData({...payData, payment_mode: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent></Select></div>
                <div><Label>From Branch</Label><Select value={payData.branch_id || "none"} onValueChange={(v) => setPayData({...payData, branch_id: v === "none" ? "" : v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Company</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <Button type="submit" className="rounded-xl">Record Payment</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
