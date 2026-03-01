import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  CheckCircle, Clock, XCircle, Calendar, DollarSign, FileText, Send,
  LogIn, LogOut, AlertTriangle, User, Banknote, Briefcase, Phone, Mail,
  Building, Wallet, TrendingDown, Receipt
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

const getStatusBadge = (s) => {
  if (s === 'approved' || s === 'completed') return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"><CheckCircle size={11} className="mr-1" />{s}</Badge>;
  if (s === 'rejected') return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"><XCircle size={11} className="mr-1" />{s}</Badge>;
  if (s === 'active') return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"><Banknote size={11} className="mr-1" />{s}</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"><Clock size={11} className="mr-1" />{s}</Badge>;
};

function LeaveBalanceBar({ label, used, total, color }) {
  const remaining = Math.max(0, total - used);
  const pct = total > 0 ? (used / total) * 100 : 0;
  return (
    <div data-testid={`leave-balance-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium dark:text-stone-300">{label}</span>
        <span className="text-muted-foreground">{remaining}/{total} days left</span>
      </div>
      <div className="h-2.5 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function EmployeePortalPage() {
  const { t } = useLanguage();
  const [profile, setProfile] = useState(null);
  const [payments, setPayments] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [requests, setRequests] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [myLoans, setMyLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [leaveData, setLeaveData] = useState({ leave_type: 'annual', start_date: '', end_date: '', days: '', reason: '', with_ticket: false });
  const [requestData, setRequestData] = useState({ request_type: 'letter', subject: '', details: '', amount: '' });
  const [editData, setEditData] = useState({ phone: '', email: '' });
  const [noProfile, setNoProfile] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const profRes = await api.get('/my/employee-profile');
      setProfile(profRes.data);
      setEditData({ phone: profRes.data.phone || '', email: profRes.data.email || '' });
      const [payRes, leaveRes, reqRes, attRes, loanRes] = await Promise.all([
        api.get('/my/payments'), api.get('/my/leaves'), api.get('/my/requests'),
        api.get('/my/attendance'), api.get('/my/loans').catch(() => ({ data: [] }))
      ]);
      setPayments(payRes.data); setLeaves(leaveRes.data); setRequests(reqRes.data);
      setAttendance(attRes.data); setMyLoans(loanRes.data);
      const today = new Date().toISOString().split('T')[0];
      setTodayAttendance(attRes.data.find(a => a.date === today) || null);
    } catch (err) {
      if (err.response?.status === 404) setNoProfile(true);
    } finally { setLoading(false); }
  };

  const handleTimeIn = async () => { try { await api.post('/attendance/time-in'); toast.success('Timed in!'); fetchData(); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } };
  const handleTimeOut = async () => { try { await api.post('/attendance/time-out'); toast.success('Timed out!'); fetchData(); } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); } };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    try {
      await api.post('/my/apply-leave', { ...leaveData, employee_id: '', days: parseInt(leaveData.days), with_ticket: leaveData.with_ticket, start_date: new Date(leaveData.start_date).toISOString(), end_date: new Date(leaveData.end_date).toISOString() });
      toast.success(leaveData.with_ticket ? 'Leave + ticket request submitted' : 'Leave request submitted');
      setShowLeaveForm(false); setLeaveData({ leave_type: 'annual', start_date: '', end_date: '', days: '', reason: '', with_ticket: false }); fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleRequest = async (e) => {
    e.preventDefault();
    try {
      await api.post('/my/request', { ...requestData, amount: requestData.amount ? parseFloat(requestData.amount) : null });
      toast.success('Request submitted'); setShowRequestForm(false); setRequestData({ request_type: 'letter', subject: '', details: '', amount: '' }); fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleAcknowledge = async (id) => { try { await api.post(`/salary-payments/${id}/acknowledge`); toast.success('Confirmed'); fetchData(); } catch { toast.error('Failed'); } };
  const downloadPayslip = async (id) => {
    try {
      const res = await api.get(`/salary-payments/${id}/payslip`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const l = document.createElement('a'); l.href = url; l.setAttribute('download', `payslip_${id}.pdf`); document.body.appendChild(l); l.click(); l.remove();
    } catch { toast.error('Failed'); }
  };
  const downloadLetter = async (type) => {
    try {
      const res = await api.post('/letters/generate', { employee_id: profile.id, letter_type: type }, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const l = document.createElement('a'); l.href = url; l.setAttribute('download', `${type}_${profile.name}.pdf`); document.body.appendChild(l); l.click(); l.remove();
    } catch { toast.error('Failed'); }
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div></DashboardLayout>;
  if (noProfile) return <DashboardLayout><div className="flex flex-col items-center justify-center h-64 text-muted-foreground"><User size={48} className="mb-3 opacity-30" /><p>No employee profile linked. Contact admin.</p></div></DashboardLayout>;

  const annualUsed = leaves.filter(l => l.leave_type === 'annual' && l.status === 'approved').reduce((s, l) => s + l.days, 0);
  const sickUsed = leaves.filter(l => l.leave_type === 'sick' && l.status === 'approved').reduce((s, l) => s + l.days, 0);
  const pendingPayments = payments.filter(p => !p.acknowledged);
  const currentPeriod = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const paidThisMonth = payments.filter(p => p.period === currentPeriod && p.payment_type === 'salary').reduce((s, p) => s + p.amount, 0);
  const dueBalance = Math.max(0, (profile?.salary || 0) - paidThisMonth);
  const activeLoans = myLoans.filter(l => l.status === 'active');
  const totalLoanBalance = activeLoans.reduce((s, l) => s + (l.remaining_balance || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="employee-portal-page">
        {/* Header with Time In/Out */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-outfit dark:text-white" data-testid="portal-title">My Portal</h1>
            <p className="text-sm text-muted-foreground">Welcome back, {profile?.name}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!todayAttendance?.time_in ? (
              <Button onClick={handleTimeIn} className="bg-emerald-500 hover:bg-emerald-600" data-testid="time-in-btn"><LogIn size={16} className="mr-1.5" />Time In</Button>
            ) : !todayAttendance?.time_out ? (
              <Button onClick={handleTimeOut} variant="outline" className="border-red-300 text-red-600" data-testid="time-out-btn"><LogOut size={16} className="mr-1.5" />Time Out</Button>
            ) : (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 py-2 px-4"><CheckCircle size={14} className="mr-1.5" />Done for today</Badge>
            )}
            <Button onClick={() => setShowLeaveForm(true)} variant="outline" size="sm"><Calendar size={14} className="mr-1" />Leave</Button>
            <Button onClick={() => setShowRequestForm(true)} variant="outline" size="sm"><Send size={14} className="mr-1" />Request</Button>
          </div>
        </div>

        {/* Profile Card + Leave Balance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Profile Info */}
          <Card className="dark:bg-stone-900 dark:border-stone-700" data-testid="profile-card">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center shrink-0">
                  <User size={28} className="text-orange-600" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-lg font-outfit dark:text-white truncate">{profile?.name}</h2>
                  <p className="text-sm text-muted-foreground">{profile?.position || 'Employee'}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground">
                    {profile?.phone && <span className="flex items-center gap-1"><Phone size={11} />{profile.phone}</span>}
                    {profile?.email && <span className="flex items-center gap-1"><Mail size={11} />{profile.email}</span>}
                    {profile?.branch_name && <span className="flex items-center gap-1"><Building size={11} />{profile.branch_name}</span>}
                  </div>
                  <Button variant="ghost" size="sm" className="mt-2 text-xs h-7 px-2" onClick={() => setShowEditProfile(true)} data-testid="edit-profile-btn">
                    Edit Info
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financial Summary */}
          <Card className="dark:bg-stone-900 dark:border-stone-700" data-testid="financial-card">
            <CardContent className="p-5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Financial</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Salary</p>
                  <p className="text-lg font-bold font-outfit dark:text-white">SAR {(profile?.salary || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Due Balance</p>
                  <p className={`text-lg font-bold font-outfit ${dueBalance > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                    SAR {dueBalance.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Loan Balance</p>
                  <p className="text-lg font-bold font-outfit text-amber-500">SAR {totalLoanBalance.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Active Loans</p>
                  <p className="text-lg font-bold font-outfit dark:text-white">{activeLoans.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Leave Balances */}
          <Card className="dark:bg-stone-900 dark:border-stone-700" data-testid="leave-balance-card">
            <CardContent className="p-5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Leave Balance</h3>
              <div className="space-y-3">
                <LeaveBalanceBar label="Annual Leave" used={annualUsed} total={profile?.annual_leave_entitled || 30} color="bg-emerald-500" />
                <LeaveBalanceBar label="Sick Leave" used={sickUsed} total={profile?.sick_leave_entitled || 15} color="bg-blue-500" />
                <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t dark:border-stone-700">
                  <span className="text-muted-foreground">Ticket Balance</span>
                  <Badge variant="outline" className="text-xs">{(profile?.ticket_entitled || 1) - (profile?.ticket_used || 0)} remaining</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Payments Alert */}
        {pendingPayments.length > 0 && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800" data-testid="pending-payments-alert">
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm flex items-center gap-2 mb-3 dark:text-amber-300"><DollarSign size={16} className="text-amber-600" />Payments Awaiting Confirmation</h3>
              <div className="space-y-2">
                {pendingPayments.map(p => (
                  <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white dark:bg-stone-800 rounded-xl border dark:border-stone-700">
                    <div>
                      <span className="font-medium text-sm dark:text-white">SAR {p.amount.toFixed(2)}</span>
                      <span className="text-xs text-muted-foreground ml-2">{(p.payment_type || 'salary').replace('_', ' ')} &middot; {p.period}</span>
                    </div>
                    <Button size="sm" onClick={() => handleAcknowledge(p.id)}><CheckCircle size={14} className="mr-1" />Confirm</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="attendance">
          <div className="overflow-x-auto">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="attendance" className="text-xs sm:text-sm">Attendance</TabsTrigger>
              <TabsTrigger value="payments" className="text-xs sm:text-sm">Payments</TabsTrigger>
              <TabsTrigger value="leaves" className="text-xs sm:text-sm">Leaves</TabsTrigger>
              <TabsTrigger value="loans" className="text-xs sm:text-sm">Loans ({myLoans.length})</TabsTrigger>
              <TabsTrigger value="requests" className="text-xs sm:text-sm">Requests</TabsTrigger>
              <TabsTrigger value="letters" className="text-xs sm:text-sm">Letters</TabsTrigger>
              <TabsTrigger value="tasks" className="text-xs sm:text-sm">My Tasks</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="attendance">
            <Card className="dark:bg-stone-900 dark:border-stone-700">
              <CardHeader><CardTitle className="font-outfit text-base dark:text-white">Attendance Records</CardTitle></CardHeader>
              <CardContent className="p-0 sm:p-6">
                <div className="overflow-x-auto">
                  <table className="w-full" data-testid="attendance-table">
                    <thead><tr className="border-b dark:border-stone-700">
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">Date</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">In</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">Out</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">Hours</th>
                    </tr></thead>
                    <tbody>{attendance.slice(0, 30).map(a => {
                      const tin = a.time_in ? new Date(a.time_in) : null;
                      const tout = a.time_out ? new Date(a.time_out) : null;
                      const hours = tin && tout ? ((tout - tin) / 3600000).toFixed(1) : '-';
                      return (<tr key={a.id} className="border-b dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800">
                        <td className="p-3 text-sm dark:text-stone-300">{a.date}</td>
                        <td className="p-3 text-sm text-emerald-600">{tin ? format(tin, 'hh:mm a') : '-'}</td>
                        <td className="p-3 text-sm text-red-500">{tout ? format(tout, 'hh:mm a') : '-'}</td>
                        <td className="p-3 text-sm font-medium dark:text-white">{hours}h</td>
                      </tr>);
                    })}{attendance.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No records</td></tr>}</tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card className="dark:bg-stone-900 dark:border-stone-700">
              <CardHeader><CardTitle className="font-outfit text-base dark:text-white">Payment History</CardTitle></CardHeader>
              <CardContent className="p-0 sm:p-6">
                <div className="overflow-x-auto">
                  <table className="w-full" data-testid="payments-table">
                    <thead><tr className="border-b dark:border-stone-700">
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">Date</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">Type</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Period</th>
                      <th className="text-right p-3 text-xs font-medium text-muted-foreground">Amount</th>
                      <th className="text-center p-3 text-xs font-medium text-muted-foreground">Status</th>
                      <th className="text-center p-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Payslip</th>
                    </tr></thead>
                    <tbody>{payments.map(p => (
                      <tr key={p.id} className="border-b dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800">
                        <td className="p-3 text-sm dark:text-stone-300">{format(new Date(p.date), 'MMM dd')}</td>
                        <td className="p-3"><Badge variant="secondary" className="capitalize text-xs">{(p.payment_type || 'salary').replace('_', ' ')}</Badge></td>
                        <td className="p-3 text-sm dark:text-stone-300 hidden sm:table-cell">{p.period}</td>
                        <td className="p-3 text-sm text-right font-medium dark:text-white">SAR {p.amount.toFixed(2)}</td>
                        <td className="p-3 text-center">{p.acknowledged ? <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]">OK</Badge> : <Button size="sm" variant="outline" onClick={() => handleAcknowledge(p.id)} className="h-6 text-[10px] px-2">Confirm</Button>}</td>
                        <td className="p-3 text-center hidden sm:table-cell"><Button size="sm" variant="ghost" onClick={() => downloadPayslip(p.id)} className="h-6 text-[10px] px-2"><FileText size={11} className="mr-1" />PDF</Button></td>
                      </tr>
                    ))}{payments.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No payments</td></tr>}</tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leaves">
            <Card className="dark:bg-stone-900 dark:border-stone-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-outfit text-base dark:text-white">Leave History</CardTitle>
                <Button size="sm" onClick={() => setShowLeaveForm(true)}><Calendar size={14} className="mr-1" />Apply</Button>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                <div className="overflow-x-auto">
                  <table className="w-full" data-testid="leaves-table">
                    <thead><tr className="border-b dark:border-stone-700">
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">Type</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground">Dates</th>
                      <th className="text-center p-3 text-xs font-medium text-muted-foreground">Days</th>
                      <th className="text-center p-3 text-xs font-medium text-muted-foreground">Status</th>
                    </tr></thead>
                    <tbody>{leaves.map(l => (
                      <tr key={l.id} className="border-b dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800">
                        <td className="p-3"><Badge variant="secondary" className="capitalize text-xs">{l.leave_type}</Badge>{l.with_ticket && <Badge className="ml-1 bg-blue-100 text-blue-700 text-[10px]">Ticket</Badge>}</td>
                        <td className="p-3 text-sm dark:text-stone-300">{format(new Date(l.start_date), 'MMM dd')} - {format(new Date(l.end_date), 'MMM dd')}</td>
                        <td className="p-3 text-center font-medium dark:text-white">{l.days}</td>
                        <td className="p-3 text-center">{getStatusBadge(l.status)}</td>
                      </tr>
                    ))}{leaves.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No leaves</td></tr>}</tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="loans">
            <Card className="dark:bg-stone-900 dark:border-stone-700">
              <CardHeader><CardTitle className="font-outfit text-base dark:text-white">My Loans</CardTitle></CardHeader>
              <CardContent>
                {myLoans.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground"><Wallet size={40} className="mx-auto mb-2 opacity-30" /><p>No loans</p></div>
                ) : (
                  <div className="space-y-3">
                    {myLoans.map(loan => {
                      const progress = loan.amount > 0 ? ((loan.amount - (loan.remaining_balance || 0)) / loan.amount) * 100 : 0;
                      return (
                        <div key={loan.id} className="p-4 border dark:border-stone-700 rounded-xl dark:bg-stone-800" data-testid={`my-loan-${loan.id}`}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary" className="capitalize text-xs">{loan.loan_type.replace('_', ' ')}</Badge>
                              {getStatusBadge(loan.status)}
                            </div>
                            <div className="text-right">
                              <p className="font-bold font-outfit dark:text-white">SAR {loan.amount.toLocaleString()}</p>
                              {loan.status === 'active' && <p className="text-xs text-muted-foreground">Remaining: SAR {(loan.remaining_balance || 0).toLocaleString()}</p>}
                            </div>
                          </div>
                          {loan.status === 'active' && (
                            <div className="mt-3">
                              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                <span>{loan.paid_installments || 0}/{loan.total_installments || '?'} paid</span>
                                <span>SAR {(loan.monthly_installment || 0).toLocaleString()}/mo</span>
                              </div>
                              <div className="h-2 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                              </div>
                            </div>
                          )}
                          {loan.reason && <p className="text-xs text-muted-foreground mt-2">Reason: {loan.reason}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests">
            <Card className="dark:bg-stone-900 dark:border-stone-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-outfit text-base dark:text-white">My Requests</CardTitle>
                <Button size="sm" onClick={() => setShowRequestForm(true)}><Send size={14} className="mr-1" />New</Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">{requests.map(r => (
                  <div key={r.id} className="p-3 border dark:border-stone-700 rounded-xl dark:bg-stone-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm dark:text-white">{r.subject}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="secondary" className="capitalize text-xs">{r.request_type.replace('_', ' ')}</Badge>
                          {r.amount && <span className="text-xs text-muted-foreground">SAR {r.amount}</span>}
                        </div>
                        {r.response && <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Response: {r.response}</p>}
                      </div>
                      {getStatusBadge(r.status)}
                    </div>
                  </div>
                ))}{requests.length === 0 && <p className="text-center text-muted-foreground py-8">No requests</p>}</div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="letters">
            <Card className="dark:bg-stone-900 dark:border-stone-700">
              <CardHeader><CardTitle className="font-outfit text-base dark:text-white">Download Letters</CardTitle></CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-4">Generate official letters with your details pre-filled.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { type: 'salary_certificate', title: 'Salary Certificate', desc: 'For bank, visa applications' },
                    { type: 'employment', title: 'Employment Letter', desc: 'Proof of employment' },
                    { type: 'noc', title: 'No Objection Certificate', desc: 'NOC for various purposes' },
                    { type: 'experience', title: 'Experience Certificate', desc: 'Work experience proof' },
                  ].map(l => (
                    <div key={l.type} className="p-4 border dark:border-stone-700 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-all flex justify-between items-center">
                      <div><p className="font-medium text-sm dark:text-white">{l.title}</p><p className="text-xs text-muted-foreground">{l.desc}</p></div>
                      <Button size="sm" variant="outline" onClick={() => downloadLetter(l.type)}><FileText size={14} className="mr-1" />PDF</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Leave Dialog */}
        <Dialog open={showLeaveForm} onOpenChange={setShowLeaveForm}>
          <DialogContent><DialogHeader><DialogTitle className="font-outfit">Apply for Leave</DialogTitle></DialogHeader>
            <form onSubmit={handleApplyLeave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Type *</Label><Select value={leaveData.leave_type} onValueChange={(v) => setLeaveData({ ...leaveData, leave_type: v })}><SelectTrigger data-testid="leave-type-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="annual">Annual</SelectItem><SelectItem value="sick">Sick</SelectItem><SelectItem value="unpaid">Unpaid</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
                <div><Label>From *</Label><Input type="date" value={leaveData.start_date} onChange={(e) => { const s = e.target.value; const days = s && leaveData.end_date ? Math.max(1, Math.round((new Date(leaveData.end_date) - new Date(s)) / 86400000) + 1) : ''; setLeaveData({ ...leaveData, start_date: s, days }); }} required data-testid="leave-start" /></div>
                <div><Label>To *</Label><Input type="date" value={leaveData.end_date} onChange={(e) => { const en = e.target.value; const days = leaveData.start_date && en ? Math.max(1, Math.round((new Date(en) - new Date(leaveData.start_date)) / 86400000) + 1) : ''; setLeaveData({ ...leaveData, end_date: en, days }); }} required data-testid="leave-end" /></div>
                <div><Label>Days</Label><Input type="number" value={leaveData.days} readOnly className="bg-stone-50 dark:bg-stone-800 font-bold" /></div>
              </div>
              <div><Label>Reason</Label><Textarea value={leaveData.reason} onChange={(e) => setLeaveData({ ...leaveData, reason: e.target.value })} data-testid="leave-reason" /></div>
              {(profile?.ticket_entitled || 1) - (profile?.ticket_used || 0) > 0 && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800"><Checkbox checked={leaveData.with_ticket} onCheckedChange={(v) => setLeaveData({ ...leaveData, with_ticket: v })} /><div><Label>Request ticket</Label><p className="text-xs text-muted-foreground">Balance: {(profile?.ticket_entitled || 1) - (profile?.ticket_used || 0)}</p></div></div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowLeaveForm(false)}>Cancel</Button>
                <Button type="submit" data-testid="submit-leave-btn">Submit Leave</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Request Dialog */}
        <Dialog open={showRequestForm} onOpenChange={setShowRequestForm}>
          <DialogContent><DialogHeader><DialogTitle className="font-outfit">Submit Request</DialogTitle></DialogHeader>
            <form onSubmit={handleRequest} className="space-y-4">
              <div><Label>Type *</Label><Select value={requestData.request_type} onValueChange={(v) => setRequestData({ ...requestData, request_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="letter">Letter Request</SelectItem><SelectItem value="salary_certificate">Salary Certificate</SelectItem><SelectItem value="loan">Loan Request</SelectItem><SelectItem value="salary_advance">Salary Advance</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
              <div><Label>Subject *</Label><Input value={requestData.subject} onChange={(e) => setRequestData({ ...requestData, subject: e.target.value })} required data-testid="request-subject" /></div>
              {['loan', 'salary_advance'].includes(requestData.request_type) && <div><Label>Amount</Label><Input type="number" step="0.01" value={requestData.amount} onChange={(e) => setRequestData({ ...requestData, amount: e.target.value })} /></div>}
              <div><Label>Details</Label><Textarea value={requestData.details} onChange={(e) => setRequestData({ ...requestData, details: e.target.value })} /></div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowRequestForm(false)}>Cancel</Button>
                <Button type="submit" data-testid="submit-request-btn">Submit</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Profile Dialog */}
        <Dialog open={showEditProfile} onOpenChange={setShowEditProfile}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="font-outfit">Edit Personal Info</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Phone</Label><Input value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} data-testid="edit-phone" /></div>
              <div><Label>Email</Label><Input value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} data-testid="edit-email" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditProfile(false)}>Cancel</Button>
              <Button onClick={async () => {
                try {
                  await api.put(`/employees/${profile.id}`, { ...profile, phone: editData.phone, email: editData.email });
                  toast.success('Profile updated'); setShowEditProfile(false); fetchData();
                } catch { toast.error('Failed to update'); }
              }} data-testid="save-profile-btn">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
