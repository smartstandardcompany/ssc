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
import { Plus, Edit, Trash2, DollarSign, AlertTriangle, Eye, Calendar, FileText, Briefcase, UserX, Calculator, Mail, Send, Download, ClipboardCheck, CheckCircle2, KeyRound, Copy, RefreshCw } from 'lucide-react';
import ExportButton from '@/components/ExportButton';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { ExportButtons } from '@/components/ExportButtons';
import { BranchFilter } from '@/components/BranchFilter';
import { BulkSalaryPayment } from '@/components/BulkSalaryPayment';
import { useBranchStore } from '@/stores';

const PAYMENT_TYPES = [
  { value: 'salary', label: 'Salary', color: 'bg-success/20 text-success' },
  { value: 'bonus', label: 'Bonus', color: 'bg-primary/20 text-primary' },
  { value: 'old_balance', label: 'Old Balance Payment', color: 'bg-info/20 text-info' },
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
  const { branches, fetchBranches } = useBranchStore();
  const [jobTitles, setJobTitles] = useState([]);
  const [salaryPayments, setSalaryPayments] = useState([]);
  const [pendingSummary, setPendingSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [showDialog, setShowDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showJobTitleManager, setShowJobTitleManager] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const [payingEmp, setPayingEmp] = useState(null);
  const [leaveEmp, setLeaveEmp] = useState(null);
  const [empSummary, setEmpSummary] = useState(null);
  const [formData, setFormData] = useState({ name: '', document_id: '', phone: '', email: '', position: '', job_title_id: '', branch_id: '', salary: '', pay_frequency: 'monthly', join_date: '', document_expiry: '', annual_leave_entitled: 30, sick_leave_entitled: 15, pos_role: '', notes: '' });
  const [payData, setPayData] = useState({ payment_type: 'salary', amount: '', payment_mode: 'cash', branch_id: '', period: '', date: new Date().toISOString().split('T')[0], notes: '' });
  const [leaveData, setLeaveData] = useState({ leave_type: 'annual', start_date: '', end_date: '', days: '', reason: '' });
  const [pinLoading, setPinLoading] = useState(null);

  const handleGeneratePin = async (empId, empName) => {
    setPinLoading(empId);
    try {
      const res = await api.post(`/cashier/generate-pin/${empId}`);
      toast.success(`PIN for ${empName}: ${res.data.pin}`);
      fetchEmployees();
    } catch { toast.error('Failed to generate PIN'); }
    finally { setPinLoading(null); }
  };

  const handleRevokePin = async (empId, empName) => {
    if (!window.confirm(`Revoke PIN for ${empName}? They won't be able to access Cashier/Waiter portals.`)) return;
    setPinLoading(empId);
    try {
      await api.delete(`/cashier/pin/${empId}`);
      toast.success(`PIN revoked for ${empName}`);
      fetchEmployees();
    } catch { toast.error('Failed to revoke PIN'); }
    finally { setPinLoading(null); }
  };

  const copyPin = (pin) => {
    navigator.clipboard.writeText(pin);
    toast.success('PIN copied to clipboard');
  };
  const [newJobTitle, setNewJobTitle] = useState({ title: '', department: '', min_salary: '', max_salary: '', permissions: [] });
  const [editingJT, setEditingJT] = useState(null);
  const [resignDialog, setResignDialog] = useState(null);
  const [resignForm, setResignForm] = useState({ resignation_date: '', notice_period_days: 30, reason: '', status: 'resigned' });
  const [settlementDialog, setSettlementDialog] = useState(null);
  const [settlement, setSettlement] = useState(null);
  const [clearanceUpdating, setClearanceUpdating] = useState(false);
  const [emailDialog, setEmailDialog] = useState(null);
  const [emailForm, setEmailForm] = useState({ subject: '', message: '' });
  const [sendingEmail, setSendingEmail] = useState(false);

  const ALL_PERMISSIONS = [
    { key: 'dashboard', label: 'Dashboard' }, { key: 'sales', label: 'Sales' }, { key: 'invoices', label: 'Invoices' },
    { key: 'branches', label: 'Branches' }, { key: 'customers', label: 'Customers' }, { key: 'suppliers', label: 'Suppliers' },
    { key: 'supplier_payments', label: 'Supplier Payments' }, { key: 'expenses', label: 'Expenses' },
    { key: 'cash_transfers', label: 'Cash Transfers' }, { key: 'employees', label: 'Employees' },
    { key: 'stock', label: 'Stock' }, { key: 'kitchen', label: 'Kitchen' }, { key: 'shifts', label: 'Schedule' },
    { key: 'documents', label: 'Documents' }, { key: 'reports', label: 'Reports' },
    { key: 'credit_report', label: 'Credit Report' }, { key: 'supplier_report', label: 'Supplier Report' },
  ];

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      fetchBranches();
      const [empRes, spRes, pendRes, jtRes] = await Promise.all([api.get('/employees'), api.get('/salary-payments'), api.get('/employees/pending-summary'), api.get('/job-titles')]);
      setEmployees(empRes.data); setSalaryPayments(spRes.data); setPendingSummary(pendRes.data.employees || pendRes.data); setJobTitles(jtRes.data);
    } catch { toast.error('Failed to fetch data'); }
    finally { setLoading(false); }
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (!emailForm.subject || !emailForm.message) { toast.error('Subject and message required'); return; }
    setSendingEmail(true);
    try {
      const res = await api.post(`/employees/${emailDialog.id}/send-email`, emailForm);
      if (res.data.status === 'sent') toast.success(res.data.message);
      else toast.error(res.data.message);
      setEmailDialog(null);
      setEmailForm({ subject: '', message: '' });
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to send email'); }
    finally { setSendingEmail(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, salary: parseFloat(formData.salary) || 0, annual_leave_entitled: parseInt(formData.annual_leave_entitled) || 30, sick_leave_entitled: parseInt(formData.sick_leave_entitled) || 15, join_date: formData.join_date ? new Date(formData.join_date).toISOString() : null, document_expiry: formData.document_expiry ? new Date(formData.document_expiry).toISOString() : null, branch_id: formData.branch_id || null };
      if (editingEmp) { await api.put(`/employees/${editingEmp.id}`, payload); toast.success('Employee updated (email synced to user account)'); }
      else { await api.post('/employees', payload); toast.success('Employee added'); }
      setShowDialog(false); resetForm(); fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to save'); }
  };

  const handlePaySalary = async (e) => {
    e.preventDefault();
    try {
      await api.post('/salary-payments', { ...payData, employee_id: payingEmp.id, amount: parseFloat(payData.amount), branch_id: payData.branch_id || null, date: `${payData.date}T12:00:00` });
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

  const downloadEmpReport = async (empId) => {
    try {
      const res = await api.get(`/employees/${empId}/report/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a'); link.href = url; link.setAttribute('download', 'employee_report.pdf'); document.body.appendChild(link); link.click(); link.remove();
      toast.success('Report downloaded');
    } catch { toast.error('Failed'); }
  };

  const getMonthOptions = () => {
    const months = [];
    for (let i = -2; i <= 96; i++) { const d = new Date(); d.setMonth(d.getMonth() - i); months.push(d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })); }
    return months;
  };

  const [empDocs, setEmpDocs] = useState([]);
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [newDoc, setNewDoc] = useState({ document_type: 'passport', document_number: '', expiry_date: '' });
  const [newIncrement, setNewIncrement] = useState({ new_salary: '', effective_date: '', reason: '' });

  const viewSummary = async (emp) => {
    try {
      const [res, docsRes, histRes] = await Promise.all([api.get(`/employees/${emp.id}/summary`), api.get(`/employee-documents?employee_id=${emp.id}`), api.get(`/salary-history/${emp.id}`)]);
      setEmpSummary(res.data); setEmpDocs(docsRes.data); setSalaryHistory(histRes.data); setShowSummary(true);
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
    setFormData({ name: emp.name, document_id: emp.document_id || '', phone: emp.phone || '', email: emp.email || '', position: emp.position || '', job_title_id: emp.job_title_id || '', branch_id: emp.branch_id || '', salary: emp.salary || '', pay_frequency: emp.pay_frequency || 'monthly', join_date: emp.join_date ? new Date(emp.join_date).toISOString().split('T')[0] : '', document_expiry: emp.document_expiry ? new Date(emp.document_expiry).toISOString().split('T')[0] : '', annual_leave_entitled: emp.annual_leave_entitled || 30, sick_leave_entitled: emp.sick_leave_entitled || 15, pos_role: emp.pos_role || '', notes: emp.notes || '' });
    setShowDialog(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this employee?')) {
      try { await api.delete(`/employees/${id}`); toast.success('Deleted'); fetchData(); }
      catch { toast.error('Failed'); }
    }
  };

  const resetForm = () => { setFormData({ name: '', document_id: '', phone: '', email: '', position: '', job_title_id: '', branch_id: '', salary: '', pay_frequency: 'monthly', join_date: '', document_expiry: '', annual_leave_entitled: 30, sick_leave_entitled: 15, pos_role: '', notes: '' }); setEditingEmp(null); };

  const isExpiryNear = (d) => d && Math.floor((new Date(d) - new Date()) / 86400000) <= 30;
  const getEmpTotalPaid = (id) => salaryPayments.filter(p => p.employee_id === id).reduce((s, p) => s + p.amount, 0);
  const getPending = (id) => pendingSummary.find(p => p.id === id) || {};

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  const totalSalary = employees.filter(e => e.active !== false).reduce((s, e) => s + (e.salary || 0), 0);
  const totalLoan = employees.reduce((s, e) => s + (e.loan_balance || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit mb-1" data-testid="employees-page-title">Employees</h1>
            <p className="text-sm text-muted-foreground">Payroll, loans, leaves & document tracking</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <BranchFilter onChange={setBranchFilter} />
            <ExportButtons dataType="employees" />
            <BulkSalaryPayment onComplete={fetchData} />
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowJobTitleManager(true)} data-testid="manage-job-titles-btn"><Briefcase size={14} className="mr-1" />Job Titles</Button>
            <Dialog open={showDialog} onOpenChange={(o) => { setShowDialog(o); if (!o) resetForm(); }}>
              <ExportButton dataType="employees" label="Employees" />
              <ExportButton dataType="attendance" label="Attendance" />
              <DialogTrigger asChild><Button size="sm" className="rounded-full" data-testid="add-employee-button"><Plus size={14} className="mr-1" />Add Employee</Button></DialogTrigger>
              <DialogContent className="max-w-2xl" data-testid="employee-dialog">
                <DialogHeader><DialogTitle className="font-outfit">{editingEmp ? 'Edit' : 'Add'} Employee</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Name *</Label><Input value={formData.name} data-testid="emp-name" onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
                    <div><Label>Document ID</Label><Input value={formData.document_id} data-testid="emp-doc-id" onChange={(e) => setFormData({ ...formData, document_id: e.target.value })} /></div>
                    <div><Label>Job Title</Label>
                      <Select value={formData.job_title_id || "none"} onValueChange={(v) => {
                        const jt = jobTitles.find(j => j.id === v);
                        const updates = { job_title_id: v === "none" ? "" : v, position: jt?.title || '' };
                        if (jt && !formData.salary && jt.min_salary > 0) updates.salary = jt.min_salary;
                        setFormData({ ...formData, ...updates });
                      }}>
                        <SelectTrigger data-testid="employee-job-title"><SelectValue placeholder="Select Job Title" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Title</SelectItem>
                          {jobTitles.filter(j => j.active !== false).map(j => <SelectItem key={j.id} value={j.id}>{j.title} {j.department ? `(${j.department})` : ''}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
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
                    <div>
                      <Label>POS Role</Label>
                      <Select value={formData.pos_role || "none"} onValueChange={(v) => setFormData({ ...formData, pos_role: v === "none" ? "" : v })}>
                        <SelectTrigger data-testid="pos-role-select"><SelectValue placeholder="No POS access" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No POS Access</SelectItem>
                          <SelectItem value="cashier">Cashier Only</SelectItem>
                          <SelectItem value="waiter">Waiter Only</SelectItem>
                          <SelectItem value="both">Cashier + Waiter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-border"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Employees</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold font-outfit text-primary">{employees.length}</div></CardContent></Card>
          <Card className={`border-border cursor-pointer transition-all ${statusFilter === 'active' ? 'ring-2 ring-emerald-400' : ''}`} onClick={() => setStatusFilter('active')} data-testid="filter-active">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Active</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold font-outfit text-emerald-600">{employees.filter(e => !e.status || e.status === 'active').length}</div></CardContent>
          </Card>
          <Card className={`border-border cursor-pointer transition-all ${statusFilter === 'left' ? 'ring-2 ring-red-400' : ''}`} onClick={() => setStatusFilter('left')} data-testid="filter-left">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Left / Terminated</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold font-outfit text-red-600">{employees.filter(e => ['left', 'terminated', 'resigned', 'end_of_contract'].includes(e.status)).length}</div></CardContent>
          </Card>
          <Card className="border-border"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Monthly Payroll</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold font-outfit text-error"> SAR {totalSalary.toFixed(0)}</div></CardContent></Card>
          <Card className={`border-border cursor-pointer transition-all ${statusFilter === 'all' ? 'ring-2 ring-blue-400' : ''}`} onClick={() => setStatusFilter('all')} data-testid="filter-all">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Show All</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold font-outfit text-blue-600">{employees.length}</div></CardContent>
          </Card>
        </div>

        <Card className="border-border">
          <CardHeader><CardTitle className="font-outfit">All Employees</CardTitle></CardHeader>
          <CardContent>
            {/* Mobile card view */}
            <div className="sm:hidden space-y-2">
              {employees.filter(emp => {
                if (branchFilter.length > 0 && !branchFilter.includes(emp.branch_id) && emp.branch_id) return false;
                if (statusFilter === 'active') return !emp.status || emp.status === 'active';
                if (statusFilter === 'left') return ['left', 'terminated', 'resigned', 'on_notice', 'end_of_contract'].includes(emp.status);
                return true;
              }).map((emp) => {
                const pend = getPending(emp.id);
                const jt = jobTitles.find(j => j.id === emp.job_title_id);
                return (
                  <div key={emp.id} className={`p-3 border rounded-xl space-y-2 ${emp.status === 'resigned' || emp.status === 'on_notice' || emp.status === 'end_of_contract' ? 'bg-amber-50/30 border-amber-200' : emp.status === 'left' || emp.status === 'terminated' ? 'bg-red-50/30 border-red-200' : 'bg-white'}`} data-testid={`employee-card-${emp.id}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-bold">{emp.name}</p>
                        {jt && <Badge variant="outline" className="capitalize text-[10px] mt-0.5">{jt.title}</Badge>}
                        {emp.status && emp.status !== 'active' && (
                          <Badge className={`ml-1 text-[10px] ${emp.status === 'resigned' || emp.status === 'on_notice' || emp.status === 'end_of_contract' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{emp.status.replace('_', ' ')}</Badge>
                        )}
                      </div>
                      <span className="text-sm font-bold text-stone-700">SAR {(emp.salary || 0).toFixed(0)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                      <div className="p-1.5 bg-stone-50 rounded-lg">
                        <p className="text-muted-foreground">Pending</p>
                        <p className={`font-bold ${(pend.pending_salary || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{(pend.pending_salary || 0) > 0 ? `SAR ${pend.pending_salary.toFixed(0)}` : 'Paid'}</p>
                      </div>
                      <div className="p-1.5 bg-stone-50 rounded-lg">
                        <p className="text-muted-foreground">Loan</p>
                        <p className={`font-bold ${(emp.loan_balance || 0) > 0 ? 'text-amber-600' : 'text-stone-400'}`}>{(emp.loan_balance || 0) > 0 ? `SAR ${emp.loan_balance.toFixed(0)}` : '-'}</p>
                      </div>
                      <div className="p-1.5 bg-stone-50 rounded-lg">
                        <p className="text-muted-foreground">Leave</p>
                        <p className="font-bold"><span className="text-emerald-600">{pend.annual_leave_remaining || 0}A</span> <span className="text-blue-600">{pend.sick_leave_remaining || 0}S</span></p>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-wrap pt-1 border-t border-stone-100">
                      <Button size="sm" variant="outline" onClick={() => viewSummary(emp)} className="h-7 text-[10px] flex-1"><Eye size={10} className="mr-0.5" />View</Button>
                      <Button size="sm" variant="outline" onClick={() => { setPayingEmp(emp); setPayData(d => ({ ...d, amount: emp.salary || '', period: format(new Date(), 'MMM yyyy') })); setShowPayDialog(true); }} className="h-7 text-[10px] flex-1"><DollarSign size={10} className="mr-0.5" />Pay</Button>
                      <Button size="sm" variant="outline" onClick={() => { setLeaveEmp(emp); setShowLeaveDialog(true); }} className="h-7 text-[10px] flex-1"><Calendar size={10} className="mr-0.5" />Leave</Button>
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(emp)} className="h-7 text-[10px]"><Edit size={10} /></Button>
                      {(!emp.status || emp.status === 'active') && (
                        <Button size="sm" variant="outline" className="h-7 text-[10px] text-amber-700 border-amber-300" data-testid="resign-card-btn"
                          onClick={() => { setResignDialog(emp); setResignForm({ resignation_date: new Date().toISOString().split('T')[0], notice_period_days: 30, reason: '', status: 'resigned' }); }}>
                          <UserX size={10} className="mr-0.5" />Exit
                        </Button>
                      )}
                      {(emp.status === 'resigned' || emp.status === 'on_notice' || emp.status === 'terminated' || emp.status === 'end_of_contract') && (
                        <Button size="sm" variant="outline" className="h-7 text-[10px] text-blue-700 border-blue-300" data-testid="settlement-card-btn"
                          onClick={async () => {
                            try { const { data } = await api.get(`/employees/${emp.id}/settlement`); setSettlement(data); setSettlementDialog(emp); } catch { toast.error('Failed'); }
                          }}>
                          <Calculator size={10} className="mr-0.5" />Settlement
                        </Button>
                      )}
                      {emp.status === 'left' && (
                        <Button size="sm" variant="outline" className="h-7 text-[10px] text-stone-500 border-stone-300" data-testid="review-card-btn"
                          onClick={async () => {
                            try { const { data } = await api.get(`/employees/${emp.id}/settlement`); setSettlement(data); setSettlementDialog(emp); } catch { toast.error('Failed'); }
                          }}>
                          <FileText size={10} className="mr-0.5" />Review
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
              {employees.length === 0 && <p className="text-center text-muted-foreground py-8">No employees yet</p>}
            </div>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full" data-testid="employees-table">
                <thead><tr className="border-b border-border">
                  <th className="text-left p-3 font-medium text-sm">Name</th>
                  <th className="text-left p-3 font-medium text-sm">Job Title</th>
                  <th className="text-right p-3 font-medium text-sm">Salary</th>
                  <th className="text-right p-3 font-medium text-sm">Pending</th>
                  <th className="text-right p-3 font-medium text-sm">Loan</th>
                  <th className="text-center p-3 font-medium text-sm">Leave</th>
                  <th className="text-right p-3 font-medium text-sm">Actions</th>
                </tr></thead>
                <tbody>
                  {employees.filter(emp => {
                    if (branchFilter.length > 0 && !branchFilter.includes(emp.branch_id) && emp.branch_id) return false;
                    if (statusFilter === 'active') return !emp.status || emp.status === 'active';
                    if (statusFilter === 'left') return ['left', 'terminated', 'resigned', 'on_notice', 'end_of_contract'].includes(emp.status);
                    return true;
                  }).map((emp) => {
                    const pend = getPending(emp.id);
                    return (
                    <tr key={emp.id} className={`border-b border-border hover:bg-secondary/50 ${emp.status === 'resigned' || emp.status === 'on_notice' || emp.status === 'end_of_contract' ? 'bg-amber-50/30' : emp.status === 'left' || emp.status === 'terminated' ? 'bg-red-50/30' : ''}`} data-testid="employee-row">
                      <td className="p-3 text-sm font-medium">
                        {emp.name}
                        <div className="text-xs text-muted-foreground">{emp.document_id || ''}</div>
                        {emp.status && emp.status !== 'active' && (
                          <Badge className={`mt-0.5 text-[10px] ${emp.status === 'resigned' || emp.status === 'on_notice' || emp.status === 'end_of_contract' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                            {emp.status.replace('_', ' ')}
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-sm">{(() => { const jt = jobTitles.find(j => j.id === emp.job_title_id); return jt ? <Badge variant="outline" className="capitalize">{jt.title}</Badge> : <span className="text-muted-foreground">{emp.position || '-'}</span>; })()}</td>
                      <td className="p-3 text-sm text-right font-medium"> SAR {(emp.salary || 0).toFixed(2)}</td>
                      <td className="p-3 text-sm text-right">
                        {(pend.pending_salary || 0) > 0 ? <span className="font-bold text-error"> SAR {pend.pending_salary.toFixed(2)}</span> : <span className="text-success font-medium">Paid</span>}
                      </td>
                      <td className="p-3 text-sm text-right">
                        {(emp.loan_balance || 0) > 0 ? <span className="font-bold text-warning"> SAR {emp.loan_balance.toFixed(2)}</span> : <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="p-3 text-center">
                        <div className="text-xs">
                          <span className="text-success">{pend.annual_leave_remaining || 0}A</span> <span className="text-info">{pend.sick_leave_remaining || 0}S</span>
                          {pend.pending_leave_requests > 0 && <Badge className="ml-1 bg-warning/20 text-warning text-xs">{pend.pending_leave_requests}P</Badge>}
                          {pend.on_leave && <div className="mt-1"><Badge className="bg-orange-100 text-orange-700 text-xs">{pend.on_leave.type}: {pend.on_leave.from} - {pend.on_leave.to}</Badge></div>}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex gap-1 justify-end flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => viewSummary(emp)} data-testid="view-summary-btn" className="h-7 text-xs"><Eye size={12} className="mr-1" />View</Button>
                          <Button size="sm" variant="ghost" onClick={() => downloadEmpReport(emp.id)} className="h-7 text-xs" title="Download Report"><FileText size={12} /></Button>
                          <Button size="sm" variant="outline" onClick={() => { setPayingEmp(emp); setPayData(d => ({ ...d, amount: emp.salary || '', period: format(new Date(), 'MMM yyyy') })); setShowPayDialog(true); }} data-testid="pay-salary-btn" className="h-7 text-xs"><DollarSign size={12} className="mr-1" />Pay</Button>
                          <Button size="sm" variant="outline" onClick={() => { setLeaveEmp(emp); setShowLeaveDialog(true); }} data-testid="add-leave-btn" className="h-7 text-xs"><Calendar size={12} className="mr-1" />Leave</Button>
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(emp)} className="h-7 text-xs"><Edit size={12} /></Button>
                          {emp.email && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-600" data-testid="email-employee-btn"
                              onClick={() => { setEmailDialog(emp); setEmailForm({ subject: '', message: '' }); }}
                              title={`Email: ${emp.email}`}>
                              <Mail size={12} />
                            </Button>
                          )}
                          {/* PIN Management */}
                          {emp.cashier_pin ? (
                            <div className="flex items-center gap-0.5">
                              <Badge className="bg-violet-100 text-violet-700 text-[10px] font-mono cursor-pointer hover:bg-violet-200" 
                                onClick={() => copyPin(emp.cashier_pin)} title="Click to copy PIN" data-testid={`pin-badge-${emp.id}`}>
                                <KeyRound size={10} className="mr-0.5" /> {emp.cashier_pin}
                              </Badge>
                              <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-violet-400 hover:text-violet-600" 
                                onClick={() => handleGeneratePin(emp.id, emp.name)} title="Regenerate PIN" data-testid={`regenerate-pin-${emp.id}`}
                                disabled={pinLoading === emp.id}>
                                <RefreshCw size={10} />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-red-400 hover:text-red-600" 
                                onClick={() => handleRevokePin(emp.id, emp.name)} title="Revoke PIN" data-testid={`revoke-pin-${emp.id}`}>
                                <Trash2 size={10} />
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" className="h-7 text-xs text-violet-600 border-violet-200 hover:bg-violet-50"
                              onClick={() => handleGeneratePin(emp.id, emp.name)} disabled={pinLoading === emp.id}
                              data-testid={`generate-pin-${emp.id}`} title="Generate Cashier/Waiter PIN">
                              {pinLoading === emp.id ? <RefreshCw size={12} className="animate-spin" /> : <KeyRound size={12} className="mr-1" />}
                              {pinLoading === emp.id ? '' : 'PIN'}
                            </Button>
                          )}
                          {(!emp.status || emp.status === 'active') && (
                            <Button size="sm" variant="outline" className="h-7 text-xs text-amber-700 border-amber-300 hover:bg-amber-50" data-testid="resign-btn"
                              onClick={() => { setResignDialog(emp); setResignForm({ resignation_date: new Date().toISOString().split('T')[0], notice_period_days: 30, reason: '', status: 'resigned' }); }}>
                              <UserX size={12} className="mr-1" />Exit
                            </Button>
                          )}
                          {(emp.status === 'resigned' || emp.status === 'on_notice' || emp.status === 'terminated' || emp.status === 'end_of_contract') && (
                            <Button size="sm" variant="outline" className="h-7 text-xs text-blue-700 border-blue-300 hover:bg-blue-50" data-testid="settlement-btn"
                              onClick={async () => {
                                try {
                                  const { data } = await api.get(`/employees/${emp.id}/settlement`);
                                  setSettlement(data); setSettlementDialog(emp);
                                } catch { toast.error('Failed to load settlement'); }
                              }}>
                              <Calculator size={12} className="mr-1" />Settlement
                            </Button>
                          )}
                          {emp.status === 'left' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs text-stone-500 border-stone-300" data-testid="view-settlement-btn"
                              onClick={async () => {
                                try {
                                  const { data } = await api.get(`/employees/${emp.id}/settlement`);
                                  setSettlement(data); setSettlementDialog(emp);
                                } catch { toast.error('Failed to load settlement'); }
                              }}>
                              <FileText size={12} className="mr-1" />Review
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(emp.id)} className="h-7 text-xs text-error"><Trash2 size={12} /></Button>
                        </div>
                      </td>
                    </tr>
                  ); })}
                  {employees.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No employees yet</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Pay Dialog */}
        <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
          <DialogContent data-testid="pay-salary-dialog">
            <DialogHeader><DialogTitle className="font-outfit">Record Payment - {payingEmp?.name}</DialogTitle></DialogHeader>
            <div className="flex gap-4 text-sm mb-2 flex-wrap">
              <span>Salary: <span className="font-bold"> SAR {payingEmp?.salary?.toFixed(2)}</span></span>
              {(payingEmp?.loan_balance || 0) > 0 && <span>Loan: <span className="font-bold text-warning"> SAR {payingEmp?.loan_balance?.toFixed(2)}</span></span>}
              {(payingEmp?.old_salary_balance || 0) > 0 && <span>Old Balance: <span className="font-bold text-error"> SAR {payingEmp?.old_salary_balance?.toFixed(2)}</span></span>}
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
                <div><Label>Period *</Label>
                  <Select value={payData.period} onValueChange={(v) => setPayData({ ...payData, period: v })}>
                    <SelectTrigger data-testid="salary-period"><SelectValue placeholder="Select month" /></SelectTrigger>
                    <SelectContent>{getMonthOptions().map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Mode</Label>
                  <Select value={payData.payment_mode} onValueChange={(v) => setPayData({ ...payData, payment_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Paid From</Label>
                  <Select value={payData.branch_id || "company"} onValueChange={(v) => setPayData({ ...payData, branch_id: v === "company" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent><SelectItem value="company">Company / Head Office</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Which branch cash/bank is used to pay</p>
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
            <DialogHeader><DialogTitle className="font-outfit">Payment Summary - {empSummary?.employee?.name} {(() => { const jt = jobTitles.find(j => j.id === empSummary?.employee?.job_title_id); return jt ? <Badge variant="outline" className="ml-2 capitalize">{jt.title}</Badge> : ''; })()}</DialogTitle></DialogHeader>
            {empSummary && (
              <Tabs defaultValue="payments">
                <TabsList className="mb-4"><TabsTrigger value="payments">Payments</TabsTrigger><TabsTrigger value="loan">Loan</TabsTrigger><TabsTrigger value="leave">Leave</TabsTrigger><TabsTrigger value="deductions">Deductions</TabsTrigger><TabsTrigger value="salary_history">Salary History</TabsTrigger><TabsTrigger value="docs">Documents</TabsTrigger><TabsTrigger value="pin" data-testid="pin-tab">Portal PIN</TabsTrigger></TabsList>

                <TabsContent value="payments" className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-secondary/50 rounded-lg"><div className="text-xs text-muted-foreground">Monthly Salary</div><div className="text-xl font-bold"> SAR {empSummary.employee.salary.toFixed(2)}</div></div>
                    <div className="p-3 bg-success/10 rounded-lg"><div className="text-xs text-muted-foreground">Total Paid</div><div className="text-xl font-bold text-success"> SAR {empSummary.total_all_time.toFixed(2)}</div></div>
                    <div className="p-3 bg-warning/10 rounded-lg"><div className="text-xs text-muted-foreground">Loan Balance</div><div className="text-xl font-bold text-warning"> SAR {empSummary.loan.balance.toFixed(2)}</div></div>
                    {(empSummary?.old_salary_balance || 0) > 0 && <div className="p-3 bg-error/10 rounded-lg"><div className="text-xs text-muted-foreground">Old Balance Due</div><div className="text-xl font-bold text-error"> SAR {empSummary.old_salary_balance.toFixed(2)}</div></div>}
                  </div>
                  {empSummary.monthly_summary.map((m) => (
                    <Card key={m.period} className="border-border">
                      <CardHeader className="py-3">
                        <div className="flex justify-between items-center">
                          <CardTitle className="font-outfit text-base">{m.period}</CardTitle>
                          <div className="flex gap-3 text-sm">
                            <span>Paid: <span className="font-bold text-success"> SAR {m.salary_paid.toFixed(2)}</span></span>
                            <span>Balance: <span className={`font-bold ${m.balance > 0 ? 'text-error' : 'text-success'}`}> SAR {m.balance.toFixed(2)}</span></span>
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
                                <span className="font-bold"> SAR {p.amount.toFixed(2)}</span>
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
                    <div className="p-3 bg-info/10 rounded-lg"><div className="text-xs text-muted-foreground">Total Advance Taken</div><div className="text-xl font-bold text-info"> SAR {empSummary.loan.total_advance.toFixed(2)}</div></div>
                    <div className="p-3 bg-success/10 rounded-lg"><div className="text-xs text-muted-foreground">Total Repaid</div><div className="text-xl font-bold text-success"> SAR {empSummary.loan.total_repaid.toFixed(2)}</div></div>
                    <div className="p-3 bg-warning/10 rounded-lg border border-warning/30"><div className="text-xs text-muted-foreground">Outstanding Balance</div><div className="text-xl font-bold text-warning"> SAR {empSummary.loan.balance.toFixed(2)}</div></div>
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

                <TabsContent value="deductions" className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-error/10 rounded-xl"><div className="text-xs text-muted-foreground">Total Deductions</div><div className="text-lg font-bold text-error">SAR {(empSummary?.total_deductions || 0).toFixed(2)}</div></div>
                    <div className="p-3 bg-orange-50 rounded-xl"><div className="text-xs text-muted-foreground">Total Fines</div><div className="text-lg font-bold text-orange-600">SAR {(empSummary?.total_fines || 0).toFixed(2)}</div></div>
                    <div className="p-3 bg-warning/10 rounded-xl"><div className="text-xs text-muted-foreground">Unpaid Fines</div><div className="text-lg font-bold text-warning">SAR {(empSummary?.unpaid_fines || 0).toFixed(2)}</div></div>
                  </div>
                  {empSummary?.deductions?.length > 0 && (
                    <div><p className="text-sm font-medium mb-2">Salary Deductions</p>
                    <div className="space-y-1">{empSummary.deductions.map(d => (
                      <div key={d.id} className="flex justify-between items-center text-xs p-2 bg-error/5 rounded-lg border border-error/20"><span><Badge variant="secondary" className="capitalize mr-2">{d.type}</Badge>{d.reason} ({d.period})</span><span className="font-bold text-error">SAR {d.amount.toFixed(2)}</span></div>
                    ))}</div></div>
                  )}
                  {empSummary?.fines?.length > 0 && (
                    <div><p className="text-sm font-medium mb-2">Fines Charged</p>
                    <div className="space-y-1">{empSummary.fines.map(f => (
                      <div key={f.id} className="flex justify-between items-center text-xs p-2 bg-orange-50 rounded-lg border border-orange-200"><span><Badge variant="secondary" className="capitalize mr-2">{f.type}</Badge>{f.department}: {f.description}</span><div className="text-right"><span className="font-bold">SAR {f.amount.toFixed(2)}</span>{f.status !== 'paid' && <Badge className="ml-2 bg-warning/20 text-warning">{f.status}</Badge>}</div></div>
                    ))}</div></div>
                  )}
                  {(!empSummary?.deductions?.length && !empSummary?.fines?.length) && <p className="text-center text-muted-foreground py-4">No deductions or fines</p>}
                </TabsContent>

                <TabsContent value="salary_history" className="space-y-4">
                  <div className="flex gap-2 items-end p-3 bg-stone-50 rounded-xl border">
                    <div className="w-28"><Label className="text-xs">New Salary</Label><Input type="number" step="0.01" value={newIncrement.new_salary} onChange={(e) => setNewIncrement({ ...newIncrement, new_salary: e.target.value })} className="h-8" placeholder="SAR" /></div>
                    <div className="w-36"><Label className="text-xs">Effective Date</Label><Input type="date" value={newIncrement.effective_date} onChange={(e) => setNewIncrement({ ...newIncrement, effective_date: e.target.value })} className="h-8" /></div>
                    <div className="flex-1"><Label className="text-xs">Reason</Label><Input value={newIncrement.reason} onChange={(e) => setNewIncrement({ ...newIncrement, reason: e.target.value })} className="h-8" placeholder="Annual increment" /></div>
                    <Button size="sm" className="h-8 rounded-xl" onClick={async () => {
                      if (!newIncrement.new_salary || !newIncrement.effective_date || !empSummary?.employee?.id) return;
                      try {
                        await api.post('/salary-history', { employee_id: empSummary.employee.id, new_salary: newIncrement.new_salary, effective_date: new Date(newIncrement.effective_date).toISOString(), reason: newIncrement.reason });
                        toast.success('Salary updated'); setNewIncrement({ new_salary: '', effective_date: '', reason: '' });
                        const h = await api.get(`/salary-history/${empSummary.employee.id}`); setSalaryHistory(h.data); fetchData();
                      } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
                    }}>Update Salary</Button>
                  </div>
                  <div className="space-y-2">
                    {salaryHistory.map(h => (
                      <div key={h.id} className="flex justify-between items-center p-3 rounded-xl border bg-stone-50">
                        <div><span className="text-sm font-medium">SAR {h.old_salary.toFixed(2)} → SAR {h.new_salary.toFixed(2)}</span><div className="text-xs text-muted-foreground mt-1">{h.reason || 'No reason'} | {new Date(h.effective_date).toLocaleDateString()}</div></div>
                        <Badge className={h.new_salary > h.old_salary ? 'bg-success/20 text-success' : 'bg-error/20 text-error'}>{h.new_salary > h.old_salary ? '+' : ''}{(h.new_salary - h.old_salary).toFixed(2)}</Badge>
                      </div>
                    ))}
                    {salaryHistory.length === 0 && <p className="text-center text-muted-foreground py-4">No salary history</p>}
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

                <TabsContent value="pin" className="space-y-4">
                  <Card className="border-violet-200 bg-violet-50/30">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 bg-violet-100 rounded-xl"><KeyRound size={20} className="text-violet-600" /></div>
                        <div>
                          <h3 className="font-semibold text-sm">Portal Access PIN</h3>
                          <p className="text-xs text-muted-foreground">Used for Cashier, Waiter, and Kitchen Display login</p>
                        </div>
                      </div>
                      {empSummary?.employee?.cashier_pin ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-violet-200">
                            <p className="text-xs text-muted-foreground">Current PIN:</p>
                            <span className="text-3xl font-mono font-bold tracking-[0.3em] text-violet-700" data-testid="current-pin-display">
                              {empSummary.employee.cashier_pin}
                            </span>
                            <Button size="sm" variant="ghost" className="h-8 text-violet-600" onClick={() => copyPin(empSummary.employee.cashier_pin)} data-testid="copy-pin-btn">
                              <Copy size={14} className="mr-1" /> Copy
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="text-violet-600 border-violet-200 hover:bg-violet-50"
                              onClick={() => handleGeneratePin(empSummary.employee.id, empSummary.employee.name)} disabled={pinLoading === empSummary.employee.id}
                              data-testid="regenerate-pin-btn">
                              {pinLoading === empSummary.employee.id ? <RefreshCw size={12} className="animate-spin mr-1" /> : <RefreshCw size={12} className="mr-1" />}
                              Regenerate PIN
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => handleRevokePin(empSummary.employee.id, empSummary.employee.name)} disabled={pinLoading === empSummary.employee.id}
                              data-testid="revoke-pin-btn">
                              <Trash2 size={12} className="mr-1" /> Revoke PIN
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <KeyRound size={32} className="mx-auto text-stone-300 mb-2" />
                          <p className="text-sm text-muted-foreground mb-3">No PIN assigned. Generate one to enable portal access.</p>
                          <Button className="bg-violet-600 hover:bg-violet-700"
                            onClick={() => handleGeneratePin(empSummary.employee.id, empSummary.employee.name)} disabled={pinLoading === empSummary.employee.id}
                            data-testid="generate-pin-summary-btn">
                            {pinLoading === empSummary.employee.id ? <RefreshCw size={14} className="animate-spin mr-1" /> : <KeyRound size={14} className="mr-1" />}
                            Generate PIN
                          </Button>
                        </div>
                      )}
                      <div className="mt-4 p-3 bg-stone-50 rounded-lg border text-xs text-muted-foreground space-y-1">
                        <p><strong>How PINs work:</strong></p>
                        <p>Employees use this 4-digit PIN to log into Cashier POS, Waiter, and Kitchen Display portals.</p>
                        <p>Each PIN is unique. Regenerating creates a new one and invalidates the old PIN.</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {/* Job Title Manager Dialog */}
        <Dialog open={showJobTitleManager} onOpenChange={(v) => { setShowJobTitleManager(v); if (!v) setEditingJT(null); }}>
          <DialogContent className="max-w-2xl" data-testid="job-title-manager-dialog">
            <DialogHeader><DialogTitle className="font-outfit">Manage Job Titles</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Add/Edit Form */}
              <div className="space-y-3 p-3 border rounded-xl bg-stone-50/50">
                <div className="grid grid-cols-4 gap-2 items-end">
                  <div><Label className="text-xs">Title *</Label><Input value={editingJT ? editingJT.title : newJobTitle.title} onChange={(e) => editingJT ? setEditingJT({ ...editingJT, title: e.target.value }) : setNewJobTitle({ ...newJobTitle, title: e.target.value })} placeholder="e.g. Chef" className="h-9" data-testid="new-jt-title" /></div>
                  <div><Label className="text-xs">Department</Label><Input value={editingJT ? editingJT.department : newJobTitle.department} onChange={(e) => editingJT ? setEditingJT({ ...editingJT, department: e.target.value }) : setNewJobTitle({ ...newJobTitle, department: e.target.value })} placeholder="e.g. Kitchen" className="h-9" /></div>
                  <div><Label className="text-xs">Min Salary</Label><Input type="number" value={editingJT ? editingJT.min_salary : newJobTitle.min_salary} onChange={(e) => editingJT ? setEditingJT({ ...editingJT, min_salary: e.target.value }) : setNewJobTitle({ ...newJobTitle, min_salary: e.target.value })} placeholder="SAR" className="h-9" /></div>
                  <div><Label className="text-xs">Max Salary</Label><Input type="number" value={editingJT ? editingJT.max_salary : newJobTitle.max_salary} onChange={(e) => editingJT ? setEditingJT({ ...editingJT, max_salary: e.target.value }) : setNewJobTitle({ ...newJobTitle, max_salary: e.target.value })} placeholder="SAR" className="h-9" /></div>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Permissions (Pages this role can access)</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_PERMISSIONS.map(p => {
                      const perms = editingJT ? (editingJT.permissions || []) : (newJobTitle.permissions || []);
                      const active = perms.includes(p.key);
                      return (
                        <button key={p.key} type="button" data-testid={`perm-toggle-${p.key}`}
                          className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${active ? 'bg-orange-100 border-orange-400 text-orange-700 font-medium' : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300'}`}
                          onClick={() => {
                            const newPerms = active ? perms.filter(x => x !== p.key) : [...perms, p.key];
                            editingJT ? setEditingJT({ ...editingJT, permissions: newPerms }) : setNewJobTitle({ ...newJobTitle, permissions: newPerms });
                          }}>
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-2">
                  {editingJT ? (
                    <>
                      <Button size="sm" className="h-8 rounded-xl" data-testid="save-jt-btn" onClick={async () => {
                        try {
                          await api.put(`/job-titles/${editingJT.id}`, { ...editingJT, min_salary: parseFloat(editingJT.min_salary) || 0, max_salary: parseFloat(editingJT.max_salary) || 0 });
                          toast.success('Job title updated');
                          setEditingJT(null);
                          const r = await api.get('/job-titles'); setJobTitles(r.data);
                        } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
                      }}><Edit size={14} className="mr-1" />Save Changes</Button>
                      <Button size="sm" variant="outline" className="h-8 rounded-xl" onClick={() => setEditingJT(null)}>Cancel</Button>
                    </>
                  ) : (
                    <Button size="sm" className="h-8 rounded-xl" data-testid="add-jt-btn" onClick={async () => {
                      if (!newJobTitle.title) { toast.error('Title required'); return; }
                      try {
                        await api.post('/job-titles', { ...newJobTitle, min_salary: parseFloat(newJobTitle.min_salary) || 0, max_salary: parseFloat(newJobTitle.max_salary) || 0 });
                        toast.success('Job title added');
                        setNewJobTitle({ title: '', department: '', min_salary: '', max_salary: '', permissions: [] });
                        const r = await api.get('/job-titles'); setJobTitles(r.data);
                      } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
                    }}><Plus size={14} className="mr-1" />Add</Button>
                  )}
                </div>
              </div>
              {/* Table */}
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-stone-50 border-b">
                    <th className="text-left p-2 font-medium">Title</th>
                    <th className="text-left p-2 font-medium">Department</th>
                    <th className="text-right p-2 font-medium">Salary Range</th>
                    <th className="text-left p-2 font-medium">Permissions</th>
                    <th className="text-right p-2 font-medium">Actions</th>
                  </tr></thead>
                  <tbody>
                    {jobTitles.map(jt => (
                      <tr key={jt.id} className="border-b hover:bg-stone-50" data-testid={`jt-row-${jt.id}`}>
                        <td className="p-2 font-medium">{jt.title}</td>
                        <td className="p-2 text-muted-foreground">{jt.department || '-'}</td>
                        <td className="p-2 text-right">SAR {jt.min_salary?.toFixed(0) || 0} - {jt.max_salary?.toFixed(0) || 0}</td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            {(jt.permissions || []).length > 0 ?
                              (jt.permissions || []).slice(0, 3).map(p => <Badge key={p} variant="outline" className="text-[10px] py-0">{p}</Badge>)
                              : <span className="text-xs text-stone-400">None</span>}
                            {(jt.permissions || []).length > 3 && <Badge variant="outline" className="text-[10px] py-0">+{jt.permissions.length - 3}</Badge>}
                          </div>
                        </td>
                        <td className="p-2 text-right flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" className="h-7" data-testid={`edit-jt-${jt.id}`} onClick={() => setEditingJT({ ...jt, min_salary: jt.min_salary || 0, max_salary: jt.max_salary || 0 })}><Edit size={12} /></Button>
                          <Button size="sm" variant="ghost" className="h-7 text-error" onClick={async () => {
                            if (window.confirm(`Delete "${jt.title}"?`)) {
                              await api.delete(`/job-titles/${jt.id}`);
                              const r = await api.get('/job-titles'); setJobTitles(r.data);
                              toast.success('Deleted');
                            }
                          }}><Trash2 size={12} /></Button>
                        </td>
                      </tr>
                    ))}
                    {jobTitles.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No job titles</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Resignation / Termination Dialog */}
        <Dialog open={!!resignDialog} onOpenChange={(v) => !v && setResignDialog(null)}>
          <DialogContent className="max-w-md" data-testid="resign-dialog">
            <DialogHeader><DialogTitle className="font-outfit">Employee Exit Process</DialogTitle></DialogHeader>
            {resignDialog && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Processing exit for <strong>{resignDialog.name}</strong></p>
                
                {/* Exit Type Selection */}
                <div>
                  <Label className="text-xs mb-2 block">Exit Type</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'resigned', label: 'Resignation', desc: 'Employee chose to leave', color: 'bg-amber-50 border-amber-300 text-amber-700' },
                      { value: 'terminated', label: 'Termination', desc: 'Company decision', color: 'bg-red-50 border-red-300 text-red-700' },
                      { value: 'end_of_contract', label: 'End of Contract', desc: 'Contract expired', color: 'bg-blue-50 border-blue-300 text-blue-700' },
                    ].map(opt => (
                      <button key={opt.value} type="button"
                        className={`p-2 rounded-xl border text-center transition-all ${resignForm.status === opt.value ? opt.color + ' ring-2 ring-offset-1' : 'bg-white border-stone-200 dark:bg-stone-800 dark:border-stone-700'}`}
                        onClick={() => setResignForm({ ...resignForm, status: opt.value, exit_type: opt.value })}
                        data-testid={`exit-type-${opt.value}`}
                      >
                        <p className="text-xs font-medium">{opt.label}</p>
                        <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">{resignForm.status === 'terminated' ? 'Termination Date' : resignForm.status === 'end_of_contract' ? 'Contract End Date' : 'Resignation Date'}</Label>
                    <Input type="date" value={resignForm.resignation_date} onChange={(e) => setResignForm({ ...resignForm, resignation_date: e.target.value })} className="h-9" />
                  </div>
                  <div><Label className="text-xs">Notice Period (days)</Label>
                    <Input type="number" value={resignForm.notice_period_days} onChange={(e) => setResignForm({ ...resignForm, notice_period_days: parseInt(e.target.value) || 0 })} className="h-9" />
                    {resignForm.status === 'terminated' && <p className="text-[10px] text-muted-foreground mt-0.5">Set to 0 for immediate termination</p>}
                  </div>
                </div>
                <div><Label className="text-xs">Reason</Label>
                  <Input value={resignForm.reason} onChange={(e) => setResignForm({ ...resignForm, reason: e.target.value })} 
                    placeholder={resignForm.status === 'terminated' ? 'e.g. Performance issues, Misconduct...' : resignForm.status === 'end_of_contract' ? 'Contract period completed' : 'e.g. Personal reasons, Better opportunity...'}
                    className="h-9" />
                </div>

                {/* EOS Info */}
                <div className={`p-3 rounded-lg text-xs ${resignForm.status === 'terminated' ? 'bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 border border-red-200' : resignForm.status === 'end_of_contract' ? 'bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400 border border-blue-200' : 'bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 border border-amber-200'}`}>
                  {resignForm.status === 'terminated' ? (
                    <p>Termination: Employee receives full EOS benefits (1/2 salary/year for first 5 years, full salary/year after). Saudi Labor Law.</p>
                  ) : resignForm.status === 'end_of_contract' ? (
                    <p>End of Contract: Full EOS benefits apply (same as termination calculation). Saudi Labor Law.</p>
                  ) : (
                    <p>Resignation: EOS is 0 if under 2 years, 1/3 salary/year for 2-5 years, increasing after. Saudi Labor Law.</p>
                  )}
                </div>

                <Button className="w-full rounded-xl" data-testid="confirm-resign-btn" onClick={async () => {
                  try {
                    await api.post(`/employees/${resignDialog.id}/resign`, { ...resignForm, exit_type: resignForm.status });
                    toast.success(`${resignDialog.name} marked as ${resignForm.status.replace('_', ' ')}`);
                    setResignDialog(null);
                    const r = await api.get('/employees'); setEmployees(r.data);
                  } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
                }}>Confirm Exit</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Email Employee Dialog */}
        <Dialog open={!!emailDialog} onOpenChange={(v) => !v && setEmailDialog(null)}>
          <DialogContent className="max-w-md" data-testid="email-employee-dialog">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Mail className="text-blue-500" size={18} /> Email {emailDialog?.name}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSendEmail} className="space-y-4">
              <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/30 p-2 rounded-lg border border-blue-200">
                To: <span className="font-medium text-foreground">{emailDialog?.email}</span>
              </div>
              <div className="space-y-2">
                <Label>Subject *</Label>
                <Input value={emailForm.subject} onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })} placeholder="e.g., Schedule Update, Important Notice..." required data-testid="email-subject-input" />
              </div>
              <div className="space-y-2">
                <Label>Message *</Label>
                <Textarea value={emailForm.message} onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })} placeholder="Type your message here..." rows={5} required data-testid="email-message-input" />
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={sendingEmail} className="rounded-xl bg-blue-600 hover:bg-blue-700" data-testid="send-email-btn">
                  {sendingEmail ? 'Sending...' : <><Send size={14} className="mr-1" /> Send Email</>}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEmailDialog(null)} className="rounded-xl">Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Settlement Dialog with Clearance */}
        <Dialog open={!!settlementDialog} onOpenChange={(v) => !v && setSettlementDialog(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="settlement-dialog">
            <DialogHeader><DialogTitle className="font-outfit flex items-center gap-2"><ClipboardCheck size={18} className="text-blue-500" /> Employee Exit & Settlement</DialogTitle></DialogHeader>
            {settlement && settlementDialog && (
              <div className="space-y-4">
                {/* Employee Info */}
                <div className="bg-stone-50 dark:bg-stone-900 rounded-xl p-3 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Employee</span><span className="font-medium">{settlement.employee_name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant="outline" className="capitalize">{settlement.exit_type?.replace('_', ' ') || settlement.status}</Badge></div>
                  <div className="grid grid-cols-2 gap-2">
                    {settlement.join_date && <div className="flex justify-between"><span className="text-muted-foreground">Join Date</span><span>{settlement.join_date}</span></div>}
                    {settlement.end_date && <div className="flex justify-between"><span className="text-muted-foreground">End Date</span><span>{settlement.end_date}</span></div>}
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Service Period</span><span className="font-medium">{settlement.service_years} years ({settlement.service_days} days)</span></div>
                </div>

                {/* Clearance Checklist */}
                {settlement.clearance && Object.keys(settlement.clearance).length > 0 && (
                  <div className="border rounded-xl p-3 space-y-2" data-testid="clearance-checklist">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold flex items-center gap-1.5">
                        <ClipboardCheck size={14} className="text-amber-500" /> Clearance Checklist
                      </h4>
                      {settlement.clearance_complete ? (
                        <Badge className="bg-emerald-100 text-emerald-700 text-[10px]"><CheckCircle2 size={10} className="mr-1" />All Clear</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 text-[10px]">Pending Items</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {[
                        { key: 'company_assets_returned', label: 'Company Assets Returned' },
                        { key: 'id_card_returned', label: 'ID Card Returned' },
                        { key: 'laptop_returned', label: 'Laptop/Equipment Returned' },
                        { key: 'keys_returned', label: 'Keys Returned' },
                        { key: 'pending_work_handed_over', label: 'Work Handed Over' },
                        { key: 'no_pending_loans', label: 'No Pending Loans' },
                        { key: 'exit_interview_done', label: 'Exit Interview Done' },
                      ].map(item => (
                        <label key={item.key} className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${settlement.clearance[item.key] ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20' : 'bg-white border-stone-200 dark:bg-stone-800 dark:border-stone-700'}`} data-testid={`clearance-${item.key}`}>
                          <input
                            type="checkbox"
                            checked={!!settlement.clearance[item.key]}
                            disabled={clearanceUpdating}
                            onChange={async (e) => {
                              setClearanceUpdating(true);
                              try {
                                await api.put(`/employees/${settlementDialog.id}/clearance`, { [item.key]: e.target.checked });
                                setSettlement(prev => ({
                                  ...prev,
                                  clearance: { ...prev.clearance, [item.key]: e.target.checked },
                                  clearance_complete: Object.entries({ ...prev.clearance, [item.key]: e.target.checked }).every(([, v]) => v),
                                }));
                              } catch { toast.error('Failed to update clearance'); }
                              setClearanceUpdating(false);
                            }}
                            className="rounded accent-emerald-600"
                          />
                          <span className={settlement.clearance[item.key] ? 'text-emerald-700 dark:text-emerald-400 line-through' : ''}>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Settlement Breakdown */}
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 space-y-2 text-sm border border-blue-200">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-300 text-xs uppercase tracking-wide">Settlement Breakdown</h4>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pending Salary</span><span className="font-mono">SAR {settlement.pending_salary?.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Leave Encashment ({settlement.leave_balance_days} days)</span><span className="font-mono text-emerald-600">+SAR {settlement.leave_encashment?.toFixed(2)}</span></div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      End-of-Service Benefit
                      <span className="text-[10px] ml-1 text-blue-600">({settlement.eos_calculation_type === 'termination' ? 'Termination/EOC' : 'Resignation'})</span>
                    </span>
                    <span className="font-mono text-emerald-600">+SAR {settlement.end_of_service_benefit?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Loan Deduction</span><span className="font-mono text-red-600">-SAR {settlement.loan_balance?.toFixed(2)}</span></div>
                  <hr className="border-blue-200" />
                  <div className="flex justify-between text-base font-bold">
                    <span>Total Settlement</span>
                    <span className={settlement.total_settlement >= 0 ? 'text-emerald-600' : 'text-red-600'}>SAR {settlement.total_settlement?.toFixed(2)}</span>
                  </div>
                </div>

                {settlement.service_years < 2 && settlement.eos_calculation_type === 'resignation' && (
                  <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    Note: End-of-service benefit is SAR 0 because service period is less than 2 years (Saudi Labor Law).
                  </p>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-xl" data-testid="download-settlement-pdf" onClick={async () => {
                    try {
                      const response = await api.get(`/employees/${settlementDialog.id}/settlement/pdf`, { responseType: 'blob' });
                      const url = window.URL.createObjectURL(new Blob([response.data]));
                      const link = document.createElement('a');
                      link.href = url;
                      link.setAttribute('download', `settlement_${settlement.employee_name?.replace(/\s+/g, '_')}.pdf`);
                      document.body.appendChild(link); link.click(); link.remove();
                      window.URL.revokeObjectURL(url);
                      toast.success('Settlement PDF downloaded');
                    } catch { toast.error('Failed to download PDF'); }
                  }}><Download size={14} className="mr-1.5" />Download Settlement PDF</Button>
                  <Button className="flex-1 rounded-xl" data-testid="complete-exit-btn" onClick={async () => {
                    try {
                      await api.post(`/employees/${settlementDialog.id}/complete-exit`, { settlement_amount: settlement.total_settlement, paid: true, status: 'left' });
                      toast.success('Employee exit completed');
                      setSettlementDialog(null); setSettlement(null);
                      const r = await api.get('/employees'); setEmployees(r.data);
                    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
                  }}>Complete Exit & Deactivate</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
