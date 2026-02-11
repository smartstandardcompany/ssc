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
import { Plus, Edit, Trash2, DollarSign, AlertTriangle, Eye, Calendar, FileText } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ExportButtons } from '@/components/ExportButtons';
import { BranchFilter } from '@/components/BranchFilter';

const PAYMENT_TYPES = [
  { value: 'salary', label: 'Salary', color: 'bg-success/20 text-success' },
  { value: 'advance', label: 'Advance / Loan', color: 'bg-info/20 text-info' },
  { value: 'loan_repayment', label: 'Loan Repayment', color: 'bg-primary/20 text-primary' },
  { value: 'overtime', label: 'Overtime', color: 'bg-primary/20 text-primary' },
  { value: 'tickets', label: 'Tickets', color: 'bg-warning/20 text-warning' },
  { value: 'id_card', label: 'ID Card', color: 'bg-error/20 text-error' },
];
const LEAVE_TYPES = [
  { value: 'annual', label: 'Annual Leave' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'unpaid', label: 'Unpaid Leave' },
  { value: 'other', label: 'Other' },
];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [salaryPayments, setSalaryPayments] = useState([]);
  const [pendingSummary, setPendingSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const [payingEmp, setPayingEmp] = useState(null);
  const [leaveEmp, setLeaveEmp] = useState(null);
  const [empSummary, setEmpSummary] = useState(null);
  const [formData, setFormData] = useState({ name: '', document_id: '', phone: '', email: '', position: '', branch_id: '', salary: '', pay_frequency: 'monthly', join_date: '', document_expiry: '', annual_leave_entitled: 30, sick_leave_entitled: 15, notes: '' });
  const [payData, setPayData] = useState({ payment_type: 'salary', amount: '', payment_mode: 'cash', branch_id: '', period: '', date: new Date().toISOString().split('T')[0], notes: '' });
  const [leaveData, setLeaveData] = useState({ leave_type: 'annual', start_date: '', end_date: '', days: '', reason: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [empRes, brRes, spRes, pendRes] = await Promise.all([api.get('/employees'), api.get('/branches'), api.get('/salary-payments'), api.get('/employees/pending-summary')]);
      setEmployees(empRes.data); setBranches(brRes.data); setSalaryPayments(spRes.data); setPendingSummary(pendRes.data);
    } catch { toast.error('Failed to fetch data'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, salary: parseFloat(formData.salary) || 0, annual_leave_entitled: parseInt(formData.annual_leave_entitled) || 30, sick_leave_entitled: parseInt(formData.sick_leave_entitled) || 15, join_date: formData.join_date ? new Date(formData.join_date).toISOString() : null, document_expiry: formData.document_expiry ? new Date(formData.document_expiry).toISOString() : null, branch_id: formData.branch_id || null };
      if (editingEmp) { await api.put(`/employees/${editingEmp.id}`, payload); toast.success('Employee updated'); }
      else { await api.post('/employees', payload); toast.success('Employee added'); }
      setShowDialog(false); resetForm(); fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to save'); }
  };

  const handlePaySalary = async (e) => {
    e.preventDefault();
    try {
      await api.post('/salary-payments', { ...payData, employee_id: payingEmp.id, amount: parseFloat(payData.amount), branch_id: payData.branch_id || null, date: new Date(payData.date).toISOString() });
      const tl = PAYMENT_TYPES.find(t => t.value === payData.payment_type)?.label || 'Payment';
      toast.success(`${tl} recorded for ${payingEmp.name}`);
      if (['tickets', 'id_card'].includes(payData.payment_type)) toast.info('Also added to Expenses');
      setShowPayDialog(false);
      setPayData({ payment_type: 'salary', amount: '', payment_mode: 'cash', branch_id: '', period: '', date: new Date().toISOString().split('T')[0], notes: '' });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleLeave = async (e) => {
    e.preventDefault();
    try {
      await api.post('/leaves', { ...leaveData, employee_id: leaveEmp.id, days: parseInt(leaveData.days), start_date: new Date(leaveData.start_date).toISOString(), end_date: new Date(leaveData.end_date).toISOString() });
      toast.success('Leave recorded');
      setShowLeaveDialog(false);
      setLeaveData({ leave_type: 'annual', start_date: '', end_date: '', days: '', reason: '' });
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const downloadPayslip = async (paymentId) => {
    try {
      const res = await api.get(`/salary-payments/${paymentId}/payslip`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payslip_${paymentId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Payslip downloaded');
    } catch { toast.error('Failed to download payslip'); }
  };

  const [empDocs, setEmpDocs] = useState([]);
  const [newDoc, setNewDoc] = useState({ document_type: 'passport', document_number: '', expiry_date: '' });

  const viewSummary = async (emp) => {
    try {
      const [res, docsRes] = await Promise.all([api.get(`/employees/${emp.id}/summary`), api.get(`/employee-documents?employee_id=${emp.id}`)]);
      setEmpSummary(res.data); setEmpDocs(docsRes.data); setShowSummary(true);
    } catch { toast.error('Failed to load summary'); }
  };

  const handleAddEmpDoc = async () => {
    if (!empSummary?.employee?.id || !newDoc.document_type) return;
    try {
      await api.post('/employee-documents', { ...newDoc, employee_id: empSummary.employee.id, expiry_date: newDoc.expiry_date ? new Date(newDoc.expiry_date).toISOString() : null });
      toast.success('Document added');
      const docsRes = await api.get(`/employee-documents?employee_id=${empSummary.employee.id}`);
      setEmpDocs(docsRes.data);
      setNewDoc({ document_type: 'passport', document_number: '', expiry_date: '' });
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleEdit = (emp) => {
    setEditingEmp(emp);
    setFormData({ name: emp.name, document_id: emp.document_id || '', phone: emp.phone || '', email: emp.email || '', position: emp.position || '', branch_id: emp.branch_id || '', salary: emp.salary || '', pay_frequency: emp.pay_frequency || 'monthly', join_date: emp.join_date ? new Date(emp.join_date).toISOString().split('T')[0] : '', document_expiry: emp.document_expiry ? new Date(emp.document_expiry).toISOString().split('T')[0] : '', annual_leave_entitled: emp.annual_leave_entitled || 30, sick_leave_entitled: emp.sick_leave_entitled || 15, notes: emp.notes || '' });
    setShowDialog(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this employee?')) {
      try { await api.delete(`/employees/${id}`); toast.success('Deleted'); fetchData(); }
      catch { toast.error('Failed'); }
    }
  };

  const resetForm = () => { setFormData({ name: '', document_id: '', phone: '', email: '', position: '', branch_id: '', salary: '', pay_frequency: 'monthly', join_date: '', document_expiry: '', annual_leave_entitled: 30, sick_leave_entitled: 15, notes: '' }); setEditingEmp(null); };

  const isExpiryNear = (d) => d && Math.floor((new Date(d) - new Date()) / 86400000) <= 30;
  const getEmpTotalPaid = (id) => salaryPayments.filter(p => p.employee_id === id).reduce((s, p) => s + p.amount, 0);
  const getPending = (id) => pendingSummary.find(p => p.id === id) || {};

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  const totalSalary = employees.filter(e => e.active !== false).reduce((s, e) => s + (e.salary || 0), 0);
  const totalLoan = employees.reduce((s, e) => s + (e.loan_balance || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="employees-page-title">Employees</h1>
            <p className="text-muted-foreground">Payroll, loans, leaves & document tracking</p>
          </div>
          <div className="flex gap-3 items-center">
            <BranchFilter onChange={setBranchFilter} />
            <ExportButtons dataType="employees" />
            <Dialog open={showDialog} onOpenChange={(o) => { setShowDialog(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild><Button className="rounded-full" data-testid="add-employee-button"><Plus size={18} className="mr-2" />Add Employee</Button></DialogTrigger>
              <DialogContent className="max-w-2xl" data-testid="employee-dialog">
                <DialogHeader><DialogTitle className="font-outfit">{editingEmp ? 'Edit' : 'Add'} Employee</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Name *</Label><Input value={formData.name} data-testid="emp-name" onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
                    <div><Label>Document ID</Label><Input value={formData.document_id} data-testid="emp-doc-id" onChange={(e) => setFormData({ ...formData, document_id: e.target.value })} /></div>
                    <div><Label>Position</Label><Input value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })} /></div>
                    <div><Label>Monthly Salary</Label><Input type="number" step="0.01" value={formData.salary} data-testid="emp-salary" onChange={(e) => setFormData({ ...formData, salary: e.target.value })} /></div>
                    <div><Label>Branch</Label>
                      <Select value={formData.branch_id || "all"} onValueChange={(v) => setFormData({ ...formData, branch_id: v === "all" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">No Branch</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Pay Frequency</Label>
                      <Select value={formData.pay_frequency} onValueChange={(v) => setFormData({ ...formData, pay_frequency: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="biweekly">Bi-weekly</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div><Label>Phone</Label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
                    <div><Label>Email</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
                    <div><Label>Join Date</Label><Input type="date" value={formData.join_date} onChange={(e) => setFormData({ ...formData, join_date: e.target.value })} /></div>
                    <div><Label>Document Expiry</Label><Input type="date" value={formData.document_expiry} onChange={(e) => setFormData({ ...formData, document_expiry: e.target.value })} /></div>
                    <div><Label>Annual Leave (days/yr)</Label><Input type="number" value={formData.annual_leave_entitled} onChange={(e) => setFormData({ ...formData, annual_leave_entitled: e.target.value })} /></div>
                    <div><Label>Sick Leave (days/yr)</Label><Input type="number" value={formData.sick_leave_entitled} onChange={(e) => setFormData({ ...formData, sick_leave_entitled: e.target.value })} /></div>
                  </div>
                  <div className="flex gap-3">
                    <Button type="submit" data-testid="submit-employee" className="rounded-full">{editingEmp ? 'Update' : 'Add'} Employee</Button>
                    <Button type="button" variant="outline" onClick={() => setShowDialog(false)} className="rounded-full">Cancel</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Employees</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold font-outfit text-primary">{employees.length}</div></CardContent></Card>
          <Card className="border-border"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Monthly Payroll</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold font-outfit text-error">${totalSalary.toFixed(2)}</div></CardContent></Card>
          <Card className="border-border"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Outstanding Loans</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold font-outfit text-warning">${totalLoan.toFixed(2)}</div></CardContent></Card>
          <Card className="border-border"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Expiring Docs</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold font-outfit text-info">{employees.filter(e => isExpiryNear(e.document_expiry)).length}</div></CardContent></Card>
        </div>

        <Card className="border-border">
          <CardHeader><CardTitle className="font-outfit">All Employees</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="employees-table">
                <thead><tr className="border-b border-border">
                  <th className="text-left p-3 font-medium text-sm">Name</th>
                  <th className="text-left p-3 font-medium text-sm">Position</th>
                  <th className="text-right p-3 font-medium text-sm">Salary</th>
                  <th className="text-right p-3 font-medium text-sm">Pending</th>
                  <th className="text-right p-3 font-medium text-sm">Loan</th>
                  <th className="text-center p-3 font-medium text-sm">Leave</th>
                  <th className="text-right p-3 font-medium text-sm">Actions</th>
                </tr></thead>
                <tbody>
                  {employees.filter(emp => branchFilter.length === 0 || branchFilter.includes(emp.branch_id) || !emp.branch_id).map((emp) => {
                    const pend = getPending(emp.id);
                    return (
                    <tr key={emp.id} className="border-b border-border hover:bg-secondary/50" data-testid="employee-row">
                      <td className="p-3 text-sm font-medium">{emp.name}<div className="text-xs text-muted-foreground">{emp.document_id || ''}</div></td>
                      <td className="p-3 text-sm">{emp.position || '-'}</td>
                      <td className="p-3 text-sm text-right font-medium">${(emp.salary || 0).toFixed(2)}</td>
                      <td className="p-3 text-sm text-right">
                        {(pend.pending_salary || 0) > 0 ? <span className="font-bold text-error">${pend.pending_salary.toFixed(2)}</span> : <span className="text-success font-medium">Paid</span>}
                      </td>
                      <td className="p-3 text-sm text-right">
                        {(emp.loan_balance || 0) > 0 ? <span className="font-bold text-warning">${emp.loan_balance.toFixed(2)}</span> : <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="p-3 text-center">
                        <div className="text-xs"><span className="text-success">{pend.annual_leave_remaining || 0}A</span> <span className="text-info">{pend.sick_leave_remaining || 0}S</span>{pend.pending_leave_requests > 0 && <Badge className="ml-1 bg-warning/20 text-warning text-xs">{pend.pending_leave_requests}P</Badge>}</div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex gap-1 justify-end flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => viewSummary(emp)} data-testid="view-summary-btn" className="h-7 text-xs"><Eye size={12} className="mr-1" />View</Button>
                          <Button size="sm" variant="outline" onClick={() => { setPayingEmp(emp); setPayData(d => ({ ...d, amount: emp.salary || '', period: format(new Date(), 'MMM yyyy') })); setShowPayDialog(true); }} data-testid="pay-salary-btn" className="h-7 text-xs"><DollarSign size={12} className="mr-1" />Pay</Button>
                          <Button size="sm" variant="outline" onClick={() => { setLeaveEmp(emp); setShowLeaveDialog(true); }} data-testid="add-leave-btn" className="h-7 text-xs"><Calendar size={12} className="mr-1" />Leave</Button>
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(emp)} className="h-7 text-xs"><Edit size={12} /></Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(emp.id)} className="h-7 text-xs text-error"><Trash2 size={12} /></Button>
                        </div>
                      </td>
                    </tr>
                  ); })}
                  {employees.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No employees yet</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Pay Dialog */}
        <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
          <DialogContent data-testid="pay-salary-dialog">
            <DialogHeader><DialogTitle className="font-outfit">Record Payment - {payingEmp?.name}</DialogTitle></DialogHeader>
            <div className="flex gap-4 text-sm mb-2">
              <span>Salary: <span className="font-bold">${payingEmp?.salary?.toFixed(2)}</span></span>
              {(payingEmp?.loan_balance || 0) > 0 && <span>Loan: <span className="font-bold text-warning">${payingEmp?.loan_balance?.toFixed(2)}</span></span>}
            </div>
            <form onSubmit={handlePaySalary} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Payment Type *</Label>
                  <Select value={payData.payment_type} onValueChange={(v) => setPayData({ ...payData, payment_type: v })}>
                    <SelectTrigger data-testid="payment-type-select"><SelectValue /></SelectTrigger>
                    <SelectContent>{PAYMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                  {['tickets', 'id_card'].includes(payData.payment_type) && <p className="text-xs text-warning mt-1">Also added to Expenses</p>}
                  {payData.payment_type === 'advance' && <p className="text-xs text-info mt-1">Will increase loan balance</p>}
                  {payData.payment_type === 'loan_repayment' && <p className="text-xs text-success mt-1">Will decrease loan balance</p>}
                </div>
                <div><Label>Amount *</Label><Input type="number" step="0.01" value={payData.amount} data-testid="salary-amount" onChange={(e) => setPayData({ ...payData, amount: e.target.value })} required /></div>
                <div><Label>Period *</Label><Input value={payData.period} placeholder="e.g. Feb 2026" data-testid="salary-period" onChange={(e) => setPayData({ ...payData, period: e.target.value })} required /></div>
                <div><Label>Mode</Label>
                  <Select value={payData.payment_mode} onValueChange={(v) => setPayData({ ...payData, payment_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>From Branch</Label>
                  <Select value={payData.branch_id || "all"} onValueChange={(v) => setPayData({ ...payData, branch_id: v === "all" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">No Branch</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Date</Label><Input type="date" value={payData.date} onChange={(e) => setPayData({ ...payData, date: e.target.value })} /></div>
              </div>
              <div><Label>Notes</Label><Input value={payData.notes} onChange={(e) => setPayData({ ...payData, notes: e.target.value })} placeholder="Optional" /></div>
              <div className="flex gap-3">
                <Button type="submit" data-testid="submit-salary" className="rounded-full">Record Payment</Button>
                <Button type="button" variant="outline" onClick={() => setShowPayDialog(false)} className="rounded-full">Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Leave Dialog */}
        <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
          <DialogContent data-testid="leave-dialog">
            <DialogHeader><DialogTitle className="font-outfit">Record Leave - {leaveEmp?.name}</DialogTitle></DialogHeader>
            <form onSubmit={handleLeave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Leave Type *</Label>
                  <Select value={leaveData.leave_type} onValueChange={(v) => setLeaveData({ ...leaveData, leave_type: v })}>
                    <SelectTrigger data-testid="leave-type-select"><SelectValue /></SelectTrigger>
                    <SelectContent>{LEAVE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Start Date *</Label><Input type="date" value={leaveData.start_date} data-testid="leave-start" onChange={(e) => { const s = e.target.value; const days = s && leaveData.end_date ? Math.max(1, Math.round((new Date(leaveData.end_date) - new Date(s)) / 86400000) + 1) : ''; setLeaveData({ ...leaveData, start_date: s, days }); }} required /></div>
                <div><Label>End Date *</Label><Input type="date" value={leaveData.end_date} data-testid="leave-end" onChange={(e) => { const en = e.target.value; const days = leaveData.start_date && en ? Math.max(1, Math.round((new Date(en) - new Date(leaveData.start_date)) / 86400000) + 1) : ''; setLeaveData({ ...leaveData, end_date: en, days }); }} required /></div>
                <div><Label>Days</Label><Input type="number" value={leaveData.days} data-testid="leave-days" readOnly className="bg-stone-50 font-bold" /></div>
              </div>
              <div><Label>Reason</Label><Textarea value={leaveData.reason} onChange={(e) => setLeaveData({ ...leaveData, reason: e.target.value })} placeholder="Optional reason" /></div>
              <div className="flex gap-3">
                <Button type="submit" data-testid="submit-leave" className="rounded-full">Record Leave</Button>
                <Button type="button" variant="outline" onClick={() => setShowLeaveDialog(false)} className="rounded-full">Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Employee Summary Dialog */}
        <Dialog open={showSummary} onOpenChange={setShowSummary}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" data-testid="summary-dialog">
            <DialogHeader><DialogTitle className="font-outfit">Payment Summary - {empSummary?.employee?.name}</DialogTitle></DialogHeader>
            {empSummary && (
              <Tabs defaultValue="payments">
                <TabsList className="mb-4"><TabsTrigger value="payments">Payments</TabsTrigger><TabsTrigger value="loan">Loan</TabsTrigger><TabsTrigger value="leave">Leave</TabsTrigger><TabsTrigger value="docs">Documents</TabsTrigger></TabsList>

                <TabsContent value="payments" className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-secondary/50 rounded-lg"><div className="text-xs text-muted-foreground">Monthly Salary</div><div className="text-xl font-bold">${empSummary.employee.salary.toFixed(2)}</div></div>
                    <div className="p-3 bg-success/10 rounded-lg"><div className="text-xs text-muted-foreground">Total Paid</div><div className="text-xl font-bold text-success">${empSummary.total_all_time.toFixed(2)}</div></div>
                    <div className="p-3 bg-warning/10 rounded-lg"><div className="text-xs text-muted-foreground">Loan Balance</div><div className="text-xl font-bold text-warning">${empSummary.loan.balance.toFixed(2)}</div></div>
                  </div>
                  {empSummary.monthly_summary.map((m) => (
                    <Card key={m.period} className="border-border">
                      <CardHeader className="py-3">
                        <div className="flex justify-between items-center">
                          <CardTitle className="font-outfit text-base">{m.period}</CardTitle>
                          <div className="flex gap-3 text-sm">
                            <span>Paid: <span className="font-bold text-success">${m.salary_paid.toFixed(2)}</span></span>
                            <span>Balance: <span className={`font-bold ${m.balance > 0 ? 'text-error' : 'text-success'}`}>${m.balance.toFixed(2)}</span></span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex gap-2 flex-wrap mb-3">
                          {m.salary_paid > 0 && <Badge className="bg-success/20 text-success">Salary: ${m.salary_paid.toFixed(2)}</Badge>}
                          {m.advance > 0 && <Badge className="bg-info/20 text-info">Advance: ${m.advance.toFixed(2)}</Badge>}
                          {m.loan_repayment > 0 && <Badge className="bg-primary/20 text-primary">Loan Repay: ${m.loan_repayment.toFixed(2)}</Badge>}
                          {m.overtime > 0 && <Badge className="bg-primary/20 text-primary">Overtime: ${m.overtime.toFixed(2)}</Badge>}
                          {m.tickets > 0 && <Badge className="bg-warning/20 text-warning">Tickets: ${m.tickets.toFixed(2)}</Badge>}
                          {m.id_card > 0 && <Badge className="bg-error/20 text-error">ID Card: ${m.id_card.toFixed(2)}</Badge>}
                        </div>
                        <div className="space-y-1">
                          {m.payments.map(p => (
                            <div key={p.id} className="flex justify-between items-center text-xs p-2 bg-secondary/30 rounded">
                              <span>{format(new Date(p.date), 'MMM dd')} - <span className="capitalize font-medium">{p.payment_type.replace('_', ' ')}</span> ({p.payment_mode}){p.notes ? ` - ${p.notes}` : ''}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-bold">${p.amount.toFixed(2)}</span>
                                <Button size="sm" variant="ghost" onClick={() => downloadPayslip(p.id)} className="h-6 w-6 p-0" title="Download Payslip"><FileText size={12} /></Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {empSummary.monthly_summary.length === 0 && <p className="text-center text-muted-foreground py-4">No payments recorded yet</p>}
                </TabsContent>

                <TabsContent value="loan" className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-info/10 rounded-lg"><div className="text-xs text-muted-foreground">Total Advance Taken</div><div className="text-xl font-bold text-info">${empSummary.loan.total_advance.toFixed(2)}</div></div>
                    <div className="p-3 bg-success/10 rounded-lg"><div className="text-xs text-muted-foreground">Total Repaid</div><div className="text-xl font-bold text-success">${empSummary.loan.total_repaid.toFixed(2)}</div></div>
                    <div className="p-3 bg-warning/10 rounded-lg border border-warning/30"><div className="text-xs text-muted-foreground">Outstanding Balance</div><div className="text-xl font-bold text-warning">${empSummary.loan.balance.toFixed(2)}</div></div>
                  </div>
                  <p className="text-sm text-muted-foreground">Advance/loan payments and repayments are tracked automatically. Use "Advance / Loan" type to give advance, and "Loan Repayment" to deduct from balance.</p>
                </TabsContent>

                <TabsContent value="leave" className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-success/10 rounded-lg"><div className="text-xs text-muted-foreground">Annual Leave</div><div className="text-lg font-bold">{empSummary.leave.annual_used} / {empSummary.employee.annual_leave_entitled} used</div><div className="text-xs text-success">{empSummary.leave.annual_remaining} remaining</div></div>
                    <div className="p-3 bg-error/10 rounded-lg"><div className="text-xs text-muted-foreground">Sick Leave</div><div className="text-lg font-bold">{empSummary.leave.sick_used} / {empSummary.employee.sick_leave_entitled} used</div><div className="text-xs text-error">{empSummary.leave.sick_remaining} remaining</div></div>
                    <div className="p-3 bg-secondary rounded-lg"><div className="text-xs text-muted-foreground">Unpaid Leave</div><div className="text-lg font-bold">{empSummary.leave.unpaid_used} days</div></div>
                  </div>
                </TabsContent>

                <TabsContent value="docs" className="space-y-4">
                  <div className="flex gap-2 items-end p-3 bg-stone-50 rounded-xl border">
                    <div className="w-36"><Label className="text-xs">Type</Label>
                      <Select value={newDoc.document_type} onValueChange={(v) => setNewDoc({ ...newDoc, document_type: v })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="passport">Passport</SelectItem><SelectItem value="visa">Visa</SelectItem><SelectItem value="labor_card">Labor Card</SelectItem><SelectItem value="emirates_id">Emirates ID</SelectItem><SelectItem value="health_card">Health Card</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1"><Label className="text-xs">Number</Label><Input value={newDoc.document_number} onChange={(e) => setNewDoc({ ...newDoc, document_number: e.target.value })} className="h-8" placeholder="Doc number" /></div>
                    <div className="w-36"><Label className="text-xs">Expiry</Label><Input type="date" value={newDoc.expiry_date} onChange={(e) => setNewDoc({ ...newDoc, expiry_date: e.target.value })} className="h-8" /></div>
                    <Button size="sm" onClick={handleAddEmpDoc} className="h-8 rounded-xl">Add</Button>
                  </div>
                  <div className="space-y-2">
                    {empDocs.map(d => (
                      <div key={d.id} className={`flex justify-between items-center p-3 rounded-xl border ${d.days_until_expiry != null && d.days_until_expiry <= 30 ? 'bg-error/5 border-error/30' : 'bg-stone-50'}`}>
                        <div>
                          <Badge variant="secondary" className="capitalize mr-2">{d.document_type.replace('_', ' ')}</Badge>
                          <span className="text-sm">{d.document_number || '-'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {d.expiry_date && <span className="text-xs">{new Date(d.expiry_date).toLocaleDateString()}</span>}
                          {d.days_until_expiry != null && (
                            <Badge className={d.days_until_expiry < 0 ? 'bg-error/20 text-error' : d.days_until_expiry <= 30 ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'}>
                              {d.days_until_expiry < 0 ? `${Math.abs(d.days_until_expiry)}d expired` : `${d.days_until_expiry}d left`}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    {empDocs.length === 0 && <p className="text-center text-muted-foreground py-4">No documents added</p>}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
