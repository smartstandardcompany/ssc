import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import ExportButton from '@/components/ExportButton';
import {
  Plus, DollarSign, Check, X, Banknote, Clock, CheckCircle, XCircle,
  AlertTriangle, Wallet, Receipt, ChevronRight, Trash2, Users
} from 'lucide-react';
import api from '@/lib/api';
import { format } from 'date-fns';

const STATUS_BADGE = {
  pending: { icon: Clock, className: 'bg-amber-100 text-amber-700 border-amber-200' },
  approved: { icon: Check, className: 'bg-blue-100 text-blue-700 border-blue-200' },
  active: { icon: Banknote, className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  completed: { icon: CheckCircle, className: 'bg-stone-100 text-stone-600 border-stone-200' },
  rejected: { icon: XCircle, className: 'bg-red-100 text-red-700 border-red-200' },
};

const LOAN_TYPES = [
  { id: 'personal', label: 'Personal Loan' },
  { id: 'advance', label: 'Salary Advance' },
  { id: 'emergency', label: 'Emergency Loan' },
  { id: 'housing', label: 'Housing Loan' },
];

export default function LoanManagementPage() {
  const [loans, setLoans] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  const [showCreateLoan, setShowCreateLoan] = useState(false);
  const [showLoanDetail, setShowLoanDetail] = useState(null);
  const [showInstallment, setShowInstallment] = useState(null);
  const [loanDetail, setLoanDetail] = useState(null);

  const [loanForm, setLoanForm] = useState({
    employee_id: '', loan_type: 'personal', amount: '', monthly_installment: '',
    total_installments: '', start_date: '', reason: '', notes: '',
  });
  const [installmentForm, setInstallmentForm] = useState({ amount: '', payment_mode: 'deduction', period: '', notes: '' });

  const fetchData = useCallback(async () => {
    try {
      const [loansRes, empRes, statsRes] = await Promise.all([
        api.get('/loans'),
        api.get('/employees'),
        api.get('/loans/summary/stats'),
      ]);
      setLoans(loansRes.data);
      setEmployees(empRes.data.filter(e => e.active !== false));
      setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to fetch loans:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredLoans = activeTab === 'all' ? loans : loans.filter(l => l.status === activeTab);

  const handleCreateLoan = async () => {
    if (!loanForm.employee_id || !loanForm.amount) {
      toast.error('Employee and amount are required');
      return;
    }
    try {
      await api.post('/loans', {
        ...loanForm,
        amount: parseFloat(loanForm.amount),
        monthly_installment: parseFloat(loanForm.monthly_installment || 0),
        total_installments: parseInt(loanForm.total_installments || 0),
        start_date: loanForm.start_date ? new Date(loanForm.start_date).toISOString() : null,
      });
      toast.success('Loan created');
      setShowCreateLoan(false);
      setLoanForm({ employee_id: '', loan_type: 'personal', amount: '', monthly_installment: '', total_installments: '', start_date: '', reason: '', notes: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create loan');
    }
  };

  const handleApprove = async (loanId, action) => {
    try {
      await api.post(`/loans/${loanId}/approve`, { action });
      toast.success(action === 'approve' ? 'Loan approved' : 'Loan rejected');
      fetchData();
      if (loanDetail?.loan?.id === loanId) loadLoanDetail(loanId);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const handleRecordInstallment = async () => {
    if (!installmentForm.amount) { toast.error('Amount required'); return; }
    try {
      await api.post(`/loans/${showInstallment}/installment`, {
        ...installmentForm,
        amount: parseFloat(installmentForm.amount),
      });
      toast.success('Installment recorded');
      setShowInstallment(null);
      setInstallmentForm({ amount: '', payment_mode: 'deduction', period: '', notes: '' });
      fetchData();
      if (showLoanDetail) loadLoanDetail(showLoanDetail);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const handleDeleteLoan = async (loanId) => {
    try {
      await api.delete(`/loans/${loanId}`);
      toast.success('Loan deleted');
      setShowLoanDetail(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Cannot delete');
    }
  };

  const loadLoanDetail = async (loanId) => {
    try {
      const res = await api.get(`/loans/${loanId}`);
      setLoanDetail(res.data);
      setShowLoanDetail(loanId);
    } catch (err) {
      toast.error('Failed to load loan details');
    }
  };

  const StatusBadge = ({ status }) => {
    const config = STATUS_BADGE[status] || STATUS_BADGE.pending;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`capitalize ${config.className}`}>
        <Icon size={12} className="mr-1" />{status}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="loan-management-page">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-outfit tracking-tight dark:text-white">Loan Management</h1>
            <p className="text-muted-foreground text-sm mt-1">Track and manage employee loans and installments</p>
          </div>
          <div className="flex gap-2">
            <ExportButton dataType="loans" label="Loans" />
            <Button onClick={() => setShowCreateLoan(true)} data-testid="create-loan-btn">
              <Plus size={16} className="mr-1" /> New Loan
            </Button>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Total', value: stats.total_loans, color: 'stone' },
              { label: 'Active', value: stats.active_loans, color: 'emerald' },
              { label: 'Pending', value: stats.pending_loans, color: 'amber' },
              { label: 'Completed', value: stats.completed_loans, color: 'blue' },
              { label: 'Disbursed', value: `SAR ${(stats.total_disbursed || 0).toLocaleString()}`, color: 'purple' },
              { label: 'Outstanding', value: `SAR ${(stats.total_outstanding || 0).toLocaleString()}`, color: 'red' },
              { label: 'Collected', value: `SAR ${(stats.total_collected || 0).toLocaleString()}`, color: 'emerald' },
            ].map(s => (
              <Card key={s.label} className="border-0 shadow-sm dark:bg-stone-900">
                <CardContent className="p-4 text-center">
                  <p className={`text-lg font-bold font-outfit text-${s.color}-600`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All ({loans.length})</TabsTrigger>
            <TabsTrigger value="active">Active ({loans.filter(l => l.status === 'active').length})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({loans.filter(l => l.status === 'pending').length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({loans.filter(l => l.status === 'completed').length})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {filteredLoans.length === 0 ? (
              <Card className="border-dashed border-2 dark:bg-stone-900 dark:border-stone-700">
                <CardContent className="p-12 text-center">
                  <Wallet size={48} className="mx-auto mb-4 text-stone-300 dark:text-stone-600" />
                  <h3 className="font-semibold text-lg mb-2">No loans found</h3>
                  <p className="text-muted-foreground text-sm">Create a new loan to get started</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredLoans.map(loan => {
                  const progress = loan.amount > 0 ? ((loan.amount - (loan.remaining_balance || 0)) / loan.amount) * 100 : 0;
                  return (
                    <Card key={loan.id} className="hover:shadow-md transition-all cursor-pointer dark:bg-stone-900 dark:border-stone-700 dark:hover:bg-stone-800" onClick={() => loadLoanDetail(loan.id)} data-testid={`loan-card-${loan.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                              <Banknote size={20} className="text-orange-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold dark:text-white">{loan.employee_name}</h3>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge variant="secondary" className="capitalize text-xs">{loan.loan_type.replace('_', ' ')}</Badge>
                                <StatusBadge status={loan.status} />
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold font-outfit text-lg">SAR {loan.amount.toLocaleString()}</p>
                            {loan.status === 'active' && (
                              <p className="text-xs text-muted-foreground">
                                Remaining: SAR {(loan.remaining_balance || 0).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                        {loan.status === 'active' && (
                          <div className="mt-3">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>{loan.paid_installments || 0}/{loan.total_installments || '?'} installments</span>
                              <span>{Math.round(progress)}%</span>
                            </div>
                            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                            </div>
                          </div>
                        )}
                        {loan.status === 'pending' && (
                          <div className="mt-3 flex gap-2" onClick={e => e.stopPropagation()}>
                            <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600" onClick={() => handleApprove(loan.id, 'approve')} data-testid={`approve-loan-${loan.id}`}>
                              <Check size={14} className="mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-500 border-red-200" onClick={() => handleApprove(loan.id, 'reject')}>
                              <X size={14} className="mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Loan Dialog */}
      <Dialog open={showCreateLoan} onOpenChange={setShowCreateLoan}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create New Loan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Employee *</Label>
              <Select value={loanForm.employee_id} onValueChange={v => setLoanForm({ ...loanForm, employee_id: v })}>
                <SelectTrigger className="mt-1" data-testid="loan-employee-select"><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Loan Type</Label>
              <Select value={loanForm.loan_type} onValueChange={v => setLoanForm({ ...loanForm, loan_type: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LOAN_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (SAR) *</Label>
              <Input type="number" step="0.01" value={loanForm.amount} onChange={e => setLoanForm({ ...loanForm, amount: e.target.value })} className="mt-1" data-testid="loan-amount-input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Monthly Installment</Label>
                <Input type="number" step="0.01" value={loanForm.monthly_installment} onChange={e => setLoanForm({ ...loanForm, monthly_installment: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Total Installments</Label>
                <Input type="number" value={loanForm.total_installments} onChange={e => setLoanForm({ ...loanForm, total_installments: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={loanForm.start_date} onChange={e => setLoanForm({ ...loanForm, start_date: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea value={loanForm.reason} onChange={e => setLoanForm({ ...loanForm, reason: e.target.value })} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateLoan(false)}>Cancel</Button>
            <Button onClick={handleCreateLoan} data-testid="save-loan-btn">Create Loan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loan Detail Dialog */}
      <Dialog open={!!showLoanDetail} onOpenChange={() => setShowLoanDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Loan Details</DialogTitle></DialogHeader>
          {loanDetail && (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg">{loanDetail.loan.employee_name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="capitalize">{loanDetail.loan.loan_type.replace('_', ' ')}</Badge>
                    <StatusBadge status={loanDetail.loan.status} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold font-outfit">SAR {loanDetail.loan.amount.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Remaining: SAR {(loanDetail.loan.remaining_balance || 0).toLocaleString()}</p>
                </div>
              </div>

              {loanDetail.loan.reason && (
                <div className="bg-stone-50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Reason</p>
                  <p className="text-sm">{loanDetail.loan.reason}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-stone-50 rounded-lg p-3">
                  <p className="font-bold font-outfit">{loanDetail.loan.paid_installments || 0}/{loanDetail.loan.total_installments || '?'}</p>
                  <p className="text-xs text-muted-foreground">Installments</p>
                </div>
                <div className="bg-stone-50 rounded-lg p-3">
                  <p className="font-bold font-outfit">SAR {(loanDetail.loan.monthly_installment || 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Monthly</p>
                </div>
                <div className="bg-stone-50 rounded-lg p-3">
                  <p className="font-bold font-outfit">{loanDetail.loan.created_at ? format(new Date(loanDetail.loan.created_at), 'MMM dd, yy') : '-'}</p>
                  <p className="text-xs text-muted-foreground">Created</p>
                </div>
              </div>

              {loanDetail.loan.status === 'active' && (
                <Button className="w-full" onClick={() => {
                  setInstallmentForm({ amount: String(loanDetail.loan.monthly_installment || ''), payment_mode: 'deduction', period: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), notes: '' });
                  setShowInstallment(loanDetail.loan.id);
                }} data-testid="record-installment-btn">
                  <Receipt size={16} className="mr-1" /> Record Installment
                </Button>
              )}

              {loanDetail.installments?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Payment History</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {loanDetail.installments.map(inst => (
                      <div key={inst.id} className="flex justify-between items-center p-2 bg-stone-50 rounded-lg text-sm">
                        <div>
                          <span className="font-medium">SAR {inst.amount.toLocaleString()}</span>
                          <span className="text-muted-foreground ml-2">{inst.period}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{inst.date ? format(new Date(inst.date), 'MMM dd') : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {loanDetail.loan.status === 'pending' && (
                  <>
                    <Button className="flex-1 bg-emerald-500 hover:bg-emerald-600" onClick={() => handleApprove(loanDetail.loan.id, 'approve')}>
                      <Check size={14} className="mr-1" /> Approve
                    </Button>
                    <Button variant="outline" className="flex-1 text-red-500" onClick={() => handleApprove(loanDetail.loan.id, 'reject')}>
                      <X size={14} className="mr-1" /> Reject
                    </Button>
                  </>
                )}
                {['pending', 'rejected'].includes(loanDetail.loan.status) && (
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeleteLoan(loanDetail.loan.id)}>
                    <Trash2 size={14} className="mr-1" /> Delete
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Installment Dialog */}
      <Dialog open={!!showInstallment} onOpenChange={() => setShowInstallment(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record Installment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount (SAR) *</Label>
              <Input type="number" step="0.01" value={installmentForm.amount} onChange={e => setInstallmentForm({ ...installmentForm, amount: e.target.value })} className="mt-1" data-testid="installment-amount-input" />
            </div>
            <div>
              <Label>Payment Mode</Label>
              <Select value={installmentForm.payment_mode} onValueChange={v => setInstallmentForm({ ...installmentForm, payment_mode: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deduction">Salary Deduction</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Period</Label>
              <Input value={installmentForm.period} onChange={e => setInstallmentForm({ ...installmentForm, period: e.target.value })} className="mt-1" placeholder="e.g., Feb 2026" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={installmentForm.notes} onChange={e => setInstallmentForm({ ...installmentForm, notes: e.target.value })} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInstallment(null)}>Cancel</Button>
            <Button onClick={handleRecordInstallment} data-testid="save-installment-btn">Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
