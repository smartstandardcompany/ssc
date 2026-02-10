import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, DollarSign, AlertTriangle, Eye, X } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ExportButtons } from '@/components/ExportButtons';

const PAYMENT_TYPES = [
  { value: 'salary', label: 'Salary', color: 'bg-success/20 text-success' },
  { value: 'advance', label: 'Advance', color: 'bg-info/20 text-info' },
  { value: 'overtime', label: 'Overtime', color: 'bg-primary/20 text-primary' },
  { value: 'tickets', label: 'Tickets', color: 'bg-warning/20 text-warning' },
  { value: 'id_card', label: 'ID Card', color: 'bg-error/20 text-error' },
];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [salaryPayments, setSalaryPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const [payingEmp, setPayingEmp] = useState(null);
  const [empSummary, setEmpSummary] = useState(null);
  const [formData, setFormData] = useState({ name: '', document_id: '', phone: '', email: '', position: '', branch_id: '', salary: '', pay_frequency: 'monthly', join_date: '', document_expiry: '', notes: '' });
  const [payData, setPayData] = useState({ payment_type: 'salary', amount: '', payment_mode: 'cash', branch_id: '', period: '', date: new Date().toISOString().split('T')[0], notes: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [empRes, brRes, spRes] = await Promise.all([api.get('/employees'), api.get('/branches'), api.get('/salary-payments')]);
      setEmployees(empRes.data);
      setBranches(brRes.data);
      setSalaryPayments(spRes.data);
    } catch { toast.error('Failed to fetch data'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, salary: parseFloat(formData.salary) || 0, join_date: formData.join_date ? new Date(formData.join_date).toISOString() : null, document_expiry: formData.document_expiry ? new Date(formData.document_expiry).toISOString() : null, branch_id: formData.branch_id || null };
      if (editingEmp) { await api.put(`/employees/${editingEmp.id}`, payload); toast.success('Employee updated'); }
      else { await api.post('/employees', payload); toast.success('Employee added'); }
      setShowDialog(false); resetForm(); fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to save'); }
  };

  const handlePaySalary = async (e) => {
    e.preventDefault();
    try {
      await api.post('/salary-payments', { ...payData, employee_id: payingEmp.id, amount: parseFloat(payData.amount), branch_id: payData.branch_id || null, date: new Date(payData.date).toISOString() });
      const typeLabel = PAYMENT_TYPES.find(t => t.value === payData.payment_type)?.label || 'Payment';
      toast.success(`${typeLabel} recorded for ${payingEmp.name}`);
      if (payData.payment_type === 'tickets' || payData.payment_type === 'id_card') {
        toast.info('Also added to Expenses');
      }
      setShowPayDialog(false);
      setPayData({ payment_type: 'salary', amount: '', payment_mode: 'cash', branch_id: '', period: '', date: new Date().toISOString().split('T')[0], notes: '' });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to record payment'); }
  };

  const viewSummary = async (emp) => {
    try {
      const res = await api.get(`/employees/${emp.id}/summary`);
      setEmpSummary(res.data);
      setShowSummary(true);
    } catch { toast.error('Failed to load summary'); }
  };

  const handleEdit = (emp) => {
    setEditingEmp(emp);
    setFormData({ name: emp.name, document_id: emp.document_id || '', phone: emp.phone || '', email: emp.email || '', position: emp.position || '', branch_id: emp.branch_id || '', salary: emp.salary || '', pay_frequency: emp.pay_frequency || 'monthly', join_date: emp.join_date ? new Date(emp.join_date).toISOString().split('T')[0] : '', document_expiry: emp.document_expiry ? new Date(emp.document_expiry).toISOString().split('T')[0] : '', notes: emp.notes || '' });
    setShowDialog(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this employee?')) {
      try { await api.delete(`/employees/${id}`); toast.success('Deleted'); fetchData(); }
      catch { toast.error('Failed to delete'); }
    }
  };

  const resetForm = () => { setFormData({ name: '', document_id: '', phone: '', email: '', position: '', branch_id: '', salary: '', pay_frequency: 'monthly', join_date: '', document_expiry: '', notes: '' }); setEditingEmp(null); };

  const isExpiryNear = (date) => {
    if (!date) return false;
    return Math.floor((new Date(date) - new Date()) / (1000 * 60 * 60 * 24)) <= 30;
  };

  const getEmpPayments = (empId) => salaryPayments.filter(p => p.employee_id === empId);
  const getEmpTotalPaid = (empId) => getEmpPayments(empId).reduce((s, p) => s + p.amount, 0);

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  const totalSalary = employees.filter(e => e.active !== false).reduce((s, e) => s + (e.salary || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="employees-page-title">Employees</h1>
            <p className="text-muted-foreground">Manage employees, payroll, tickets & ID card payments</p>
          </div>
          <div className="flex gap-3 items-center">
            <ExportButtons dataType="employees" />
            <Dialog open={showDialog} onOpenChange={(o) => { setShowDialog(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="rounded-full" data-testid="add-employee-button"><Plus size={18} className="mr-2" />Add Employee</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl" data-testid="employee-dialog">
                <DialogHeader><DialogTitle className="font-outfit">{editingEmp ? 'Edit' : 'Add'} Employee</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Name *</Label><Input value={formData.name} data-testid="emp-name" onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
                    <div><Label>Document ID</Label><Input value={formData.document_id} data-testid="emp-doc-id" onChange={(e) => setFormData({ ...formData, document_id: e.target.value })} placeholder="ID/Passport number" /></div>
                    <div><Label>Position</Label><Input value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })} /></div>
                    <div><Label>Monthly Salary</Label><Input type="number" step="0.01" value={formData.salary} data-testid="emp-salary" onChange={(e) => setFormData({ ...formData, salary: e.target.value })} /></div>
                    <div><Label>Pay Frequency</Label>
                      <Select value={formData.pay_frequency} onValueChange={(v) => setFormData({ ...formData, pay_frequency: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="biweekly">Bi-weekly</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div><Label>Branch</Label>
                      <Select value={formData.branch_id || "all"} onValueChange={(v) => setFormData({ ...formData, branch_id: v === "all" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">No Branch</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Phone</Label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
                    <div><Label>Email</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
                    <div><Label>Join Date</Label><Input type="date" value={formData.join_date} onChange={(e) => setFormData({ ...formData, join_date: e.target.value })} /></div>
                    <div><Label>Document Expiry</Label><Input type="date" value={formData.document_expiry} data-testid="emp-doc-expiry" onChange={(e) => setFormData({ ...formData, document_expiry: e.target.value })} /></div>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-border"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Employees</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold font-outfit text-primary">{employees.length}</div></CardContent></Card>
          <Card className="border-border"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Monthly Payroll</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold font-outfit text-error">${totalSalary.toFixed(2)}</div></CardContent></Card>
          <Card className="border-border"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Expiring Documents</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold font-outfit text-warning">{employees.filter(e => isExpiryNear(e.document_expiry)).length}</div></CardContent></Card>
        </div>

        <Card className="border-border">
          <CardHeader><CardTitle className="font-outfit">All Employees</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="employees-table">
                <thead><tr className="border-b border-border">
                  <th className="text-left p-3 font-medium text-sm">Name</th>
                  <th className="text-left p-3 font-medium text-sm">Position</th>
                  <th className="text-left p-3 font-medium text-sm">Doc ID</th>
                  <th className="text-right p-3 font-medium text-sm">Salary</th>
                  <th className="text-right p-3 font-medium text-sm">Total Paid</th>
                  <th className="text-left p-3 font-medium text-sm">Doc Expiry</th>
                  <th className="text-right p-3 font-medium text-sm">Actions</th>
                </tr></thead>
                <tbody>
                  {employees.map((emp) => {
                    const totalPaid = getEmpTotalPaid(emp.id);
                    const expiryNear = isExpiryNear(emp.document_expiry);
                    return (
                      <tr key={emp.id} className="border-b border-border hover:bg-secondary/50" data-testid="employee-row">
                        <td className="p-3 text-sm font-medium">{emp.name}</td>
                        <td className="p-3 text-sm">{emp.position || '-'}</td>
                        <td className="p-3 text-sm">{emp.document_id || '-'}</td>
                        <td className="p-3 text-sm text-right font-medium">${(emp.salary || 0).toFixed(2)}</td>
                        <td className="p-3 text-sm text-right text-success font-medium">${totalPaid.toFixed(2)}</td>
                        <td className="p-3 text-sm">
                          {emp.document_expiry ? (
                            <span className={`inline-flex items-center gap-1 ${expiryNear ? 'text-error font-bold' : ''}`}>
                              {expiryNear && <AlertTriangle size={14} />}
                              {format(new Date(emp.document_expiry), 'MMM dd, yyyy')}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" onClick={() => viewSummary(emp)} data-testid="view-summary-btn" className="h-8"><Eye size={14} className="mr-1" />View</Button>
                            <Button size="sm" variant="outline" onClick={() => { setPayingEmp(emp); setPayData({ ...payData, amount: emp.salary || '', period: format(new Date(), 'MMM yyyy') }); setShowPayDialog(true); }} data-testid="pay-salary-btn" className="h-8"><DollarSign size={14} className="mr-1" />Pay</Button>
                            <Button size="sm" variant="outline" onClick={() => handleEdit(emp)} className="h-8"><Edit size={14} /></Button>
                            <Button size="sm" variant="outline" onClick={() => handleDelete(emp.id)} className="h-8 text-error hover:text-error"><Trash2 size={14} /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
            <p className="text-sm text-muted-foreground">Monthly Salary: <span className="font-bold text-foreground">${payingEmp?.salary?.toFixed(2)}</span></p>
            <form onSubmit={handlePaySalary} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Payment Type *</Label>
                  <Select value={payData.payment_type} onValueChange={(v) => setPayData({ ...payData, payment_type: v })}>
                    <SelectTrigger data-testid="payment-type-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {(payData.payment_type === 'tickets' || payData.payment_type === 'id_card') && (
                    <p className="text-xs text-warning mt-1">This will also be added to Expenses</p>
                  )}
                </div>
                <div><Label>Amount *</Label><Input type="number" step="0.01" value={payData.amount} data-testid="salary-amount" onChange={(e) => setPayData({ ...payData, amount: e.target.value })} required /></div>
                <div><Label>Period *</Label><Input value={payData.period} placeholder="e.g. Feb 2026" data-testid="salary-period" onChange={(e) => setPayData({ ...payData, period: e.target.value })} required /></div>
                <div><Label>Payment Mode</Label>
                  <Select value={payData.payment_mode} onValueChange={(v) => setPayData({ ...payData, payment_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>From Branch</Label>
                  <Select value={payData.branch_id || "all"} onValueChange={(v) => setPayData({ ...payData, branch_id: v === "all" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">No Branch</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Date</Label><Input type="date" value={payData.date} onChange={(e) => setPayData({ ...payData, date: e.target.value })} /></div>
              </div>
              <div><Label>Notes</Label><Input value={payData.notes} onChange={(e) => setPayData({ ...payData, notes: e.target.value })} placeholder="Optional notes" /></div>
              <div className="flex gap-3">
                <Button type="submit" data-testid="submit-salary" className="rounded-full">Record Payment</Button>
                <Button type="button" variant="outline" onClick={() => setShowPayDialog(false)} className="rounded-full">Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Employee Summary Dialog */}
        <Dialog open={showSummary} onOpenChange={setShowSummary}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid="summary-dialog">
            <DialogHeader><DialogTitle className="font-outfit">Payment Summary - {empSummary?.employee?.name}</DialogTitle></DialogHeader>
            {empSummary && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-secondary/50 rounded-lg">
                    <div className="text-xs text-muted-foreground">Monthly Salary</div>
                    <div className="text-xl font-bold font-outfit">${empSummary.employee.salary.toFixed(2)}</div>
                  </div>
                  <div className="p-3 bg-success/10 rounded-lg">
                    <div className="text-xs text-muted-foreground">Total Paid (All Time)</div>
                    <div className="text-xl font-bold font-outfit text-success">${empSummary.total_all_time.toFixed(2)}</div>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <div className="text-xs text-muted-foreground">Position</div>
                    <div className="text-xl font-bold font-outfit">{empSummary.employee.position || '-'}</div>
                  </div>
                </div>

                {empSummary.monthly_summary.length > 0 ? (
                  <div className="space-y-3">
                    {empSummary.monthly_summary.map((m) => (
                      <Card key={m.period} className="border-border">
                        <CardHeader className="py-3">
                          <div className="flex justify-between items-center">
                            <CardTitle className="font-outfit text-base">{m.period}</CardTitle>
                            <div className="flex gap-3 text-sm">
                              <span>Paid: <span className="font-bold text-success">${m.total_paid.toFixed(2)}</span></span>
                              <span>Balance: <span className={`font-bold ${m.balance > 0 ? 'text-error' : 'text-success'}`}>${m.balance.toFixed(2)}</span></span>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex gap-2 flex-wrap mb-3">
                            {m.salary_paid > 0 && <Badge className="bg-success/20 text-success">Salary: ${m.salary_paid.toFixed(2)}</Badge>}
                            {m.advance > 0 && <Badge className="bg-info/20 text-info">Advance: ${m.advance.toFixed(2)}</Badge>}
                            {m.overtime > 0 && <Badge className="bg-primary/20 text-primary">Overtime: ${m.overtime.toFixed(2)}</Badge>}
                            {m.tickets > 0 && <Badge className="bg-warning/20 text-warning">Tickets: ${m.tickets.toFixed(2)}</Badge>}
                            {m.id_card > 0 && <Badge className="bg-error/20 text-error">ID Card: ${m.id_card.toFixed(2)}</Badge>}
                          </div>
                          <div className="space-y-1">
                            {m.payments.map(p => (
                              <div key={p.id} className="flex justify-between text-xs p-2 bg-secondary/30 rounded">
                                <span>{format(new Date(p.date), 'MMM dd')} - <span className="capitalize font-medium">{p.payment_type.replace('_', ' ')}</span> ({p.payment_mode})</span>
                                <span className="font-bold">${p.amount.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">No payments recorded yet</p>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
