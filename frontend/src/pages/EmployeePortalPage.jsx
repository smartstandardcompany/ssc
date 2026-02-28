import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle, Clock, XCircle, Calendar, DollarSign, FileText, Send, LogIn, LogOut, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const [leaveData, setLeaveData] = useState({ leave_type: 'annual', start_date: '', end_date: '', days: '', reason: '', with_ticket: false });
  const [requestData, setRequestData] = useState({ request_type: 'letter', subject: '', details: '', amount: '' });
  const [noProfile, setNoProfile] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const profRes = await api.get('/my/employee-profile');
      setProfile(profRes.data);
      const [payRes, leaveRes, reqRes, attRes, loanRes] = await Promise.all([api.get('/my/payments'), api.get('/my/leaves'), api.get('/my/requests'), api.get('/my/attendance'), api.get('/my/loans').catch(() => ({ data: [] }))]);
      setPayments(payRes.data); setLeaves(leaveRes.data); setRequests(reqRes.data); setAttendance(attRes.data); setMyLoans(loanRes.data);
      const today = new Date().toISOString().split('T')[0];
      setTodayAttendance(attRes.data.find(a => a.date === today) || null);
    } catch (err) {
      if (err.response?.status === 404) setNoProfile(true);
    } finally { setLoading(false); }
  };

  const handleTimeIn = async () => {
    try { await api.post('/attendance/time-in'); toast.success('Timed in!'); fetchData(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };
  const handleTimeOut = async () => {
    try { await api.post('/attendance/time-out'); toast.success('Timed out!'); fetchData(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };
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
  const handleAcknowledge = async (id) => {
    try { await api.post(`/salary-payments/${id}/acknowledge`); toast.success('Confirmed'); fetchData(); }
    catch { toast.error('Failed'); }
  };
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
      toast.success('Letter downloaded');
    } catch { toast.error('Failed'); }
  };

  const getStatusBadge = (s) => {
    if (s === 'approved') return <Badge className="bg-success/20 text-success"><CheckCircle size={12} className="mr-1" />Approved</Badge>;
    if (s === 'rejected') return <Badge className="bg-error/20 text-error"><XCircle size={12} className="mr-1" />Rejected</Badge>;
    return <Badge className="bg-warning/20 text-warning"><Clock size={12} className="mr-1" />Pending</Badge>;
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;
  if (noProfile) return <DashboardLayout><div className="flex items-center justify-center h-64 text-muted-foreground">No employee profile linked. Contact admin.</div></DashboardLayout>;

  const annualUsed = leaves.filter(l => l.leave_type === 'annual' && l.status === 'approved').reduce((s, l) => s + l.days, 0);
  const sickUsed = leaves.filter(l => l.leave_type === 'sick' && l.status === 'approved').reduce((s, l) => s + l.days, 0);
  const pendingPayments = payments.filter(p => !p.acknowledged);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="portal-title">My Portal</h1>
            <p className="text-muted-foreground">Welcome, {profile?.name}</p>
          </div>
          <div className="flex gap-2">
            {!todayAttendance?.time_in ? (
              <Button onClick={handleTimeIn} className="rounded-xl bg-success hover:bg-success/90" data-testid="time-in-btn"><LogIn size={18} className="mr-2" />Time In</Button>
            ) : !todayAttendance?.time_out ? (
              <Button onClick={handleTimeOut} variant="outline" className="rounded-xl border-error text-error hover:bg-error/10" data-testid="time-out-btn"><LogOut size={18} className="mr-2" />Time Out</Button>
            ) : (
              <Badge className="bg-success/20 text-success py-2 px-4"><CheckCircle size={14} className="mr-2" />Done for today</Badge>
            )}
            <Button onClick={() => setShowLeaveForm(true)} variant="outline" className="rounded-xl"><Calendar size={16} className="mr-2" />Leave</Button>
            <Button onClick={() => setShowRequestForm(true)} variant="outline" className="rounded-xl"><Send size={16} className="mr-2" />Request</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card className="border-stone-100"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Salary</CardTitle></CardHeader><CardContent><div className="text-xl font-bold font-outfit"> SAR {(profile?.salary || 0).toFixed(2)}</div></CardContent></Card>
          <Card className={`border-stone-100 ${(() => { const currentPeriod = new Date().toLocaleDateString('en-US', {month:'short', year:'numeric'}); const paidThisMonth = payments.filter(p => p.period === currentPeriod && p.payment_type === 'salary').reduce((s,p) => s + p.amount, 0); const due = (profile?.salary || 0) - paidThisMonth; return due > 0 ? 'bg-error/5 border-error/30' : ''; })()}`}>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Due Balance</CardTitle></CardHeader>
            <CardContent><div className={`text-xl font-bold font-outfit ${(() => { const currentPeriod = new Date().toLocaleDateString('en-US', {month:'short', year:'numeric'}); const paidThisMonth = payments.filter(p => p.period === currentPeriod && p.payment_type === 'salary').reduce((s,p) => s + p.amount, 0); const due = (profile?.salary || 0) - paidThisMonth; return due > 0 ? 'text-error' : 'text-success'; })()}`}>
              ${(() => { const currentPeriod = new Date().toLocaleDateString('en-US', {month:'short', year:'numeric'}); const paidThisMonth = payments.filter(p => p.period === currentPeriod && p.payment_type === 'salary').reduce((s,p) => s + p.amount, 0); return Math.max(0, (profile?.salary || 0) - paidThisMonth).toFixed(2); })()}
            </div></CardContent>
          </Card>
          <Card className="border-stone-100"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Loan</CardTitle></CardHeader><CardContent><div className="text-xl font-bold font-outfit text-warning"> SAR {(profile?.loan_balance || 0).toFixed(2)}</div></CardContent></Card>
          <Card className="border-stone-100"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Annual Leave</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-success">{(profile?.annual_leave_entitled || 30) - annualUsed} left</div></CardContent></Card>
          <Card className="border-stone-100"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Sick Leave</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-info">{(profile?.sick_leave_entitled || 15) - sickUsed} left</div></CardContent></Card>
          <Card className="border-stone-100"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Ticket</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-primary">{(profile?.ticket_entitled || 1) - (profile?.ticket_used || 0)}</div></CardContent></Card>
        </div>

        {pendingPayments.length > 0 && (
          <Card className="border-warning/50 bg-warning/5">
            <CardHeader><CardTitle className="font-outfit flex items-center gap-2 text-base"><DollarSign size={18} className="text-warning" />Payments Awaiting Acknowledgment</CardTitle></CardHeader>
            <CardContent><div className="space-y-2">{pendingPayments.map(p => (
              <div key={p.id} className="flex justify-between items-center p-3 bg-background rounded-xl border">
                <div><div className="font-medium text-sm"> SAR {p.amount.toFixed(2)} - {(p.payment_type || 'salary').replace('_', ' ')}</div><div className="text-xs text-muted-foreground">{p.period} | {p.payment_mode}</div></div>
                <Button size="sm" onClick={() => handleAcknowledge(p.id)} className="rounded-xl"><CheckCircle size={14} className="mr-1" />Confirm Receipt</Button>
              </div>
            ))}</div></CardContent>
          </Card>
        )}

        <Tabs defaultValue="attendance">
          <TabsList><TabsTrigger value="attendance">Attendance</TabsTrigger><TabsTrigger value="payments">Payments</TabsTrigger><TabsTrigger value="leaves">Leaves</TabsTrigger><TabsTrigger value="loans">Loans</TabsTrigger><TabsTrigger value="requests">Requests</TabsTrigger><TabsTrigger value="letters">Letters</TabsTrigger></TabsList>

          <TabsContent value="attendance">
            <Card className="border-stone-100"><CardHeader><CardTitle className="font-outfit text-base">Attendance Records</CardTitle></CardHeader><CardContent>
              <table className="w-full"><thead><tr className="border-b"><th className="text-left p-3 text-sm font-medium">Date</th><th className="text-left p-3 text-sm font-medium">Time In</th><th className="text-left p-3 text-sm font-medium">Time Out</th><th className="text-left p-3 text-sm font-medium">Hours</th></tr></thead>
              <tbody>{attendance.slice(0, 30).map(a => {
                const tin = a.time_in ? new Date(a.time_in) : null;
                const tout = a.time_out ? new Date(a.time_out) : null;
                const hours = tin && tout ? ((tout - tin) / 3600000).toFixed(1) : '-';
                return (<tr key={a.id} className="border-b hover:bg-stone-50"><td className="p-3 text-sm">{a.date}</td><td className="p-3 text-sm text-success">{tin ? format(tin, 'hh:mm a') : '-'}</td><td className="p-3 text-sm text-error">{tout ? format(tout, 'hh:mm a') : '-'}</td><td className="p-3 text-sm font-medium">{hours}h</td></tr>);
              })}{attendance.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No attendance records</td></tr>}</tbody></table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card className="border-stone-100"><CardHeader><CardTitle className="font-outfit text-base">Payment History</CardTitle></CardHeader><CardContent>
              <table className="w-full"><thead><tr className="border-b"><th className="text-left p-3 text-sm font-medium">Date</th><th className="text-left p-3 text-sm font-medium">Type</th><th className="text-left p-3 text-sm font-medium">Period</th><th className="text-right p-3 text-sm font-medium">Amount</th><th className="text-center p-3 text-sm font-medium">Status</th><th className="text-center p-3 text-sm font-medium">Payslip</th></tr></thead>
              <tbody>{payments.map(p => (<tr key={p.id} className="border-b hover:bg-stone-50"><td className="p-3 text-sm">{format(new Date(p.date), 'MMM dd, yyyy')}</td><td className="p-3"><Badge variant="secondary" className="capitalize">{(p.payment_type || 'salary').replace('_', ' ')}</Badge></td><td className="p-3 text-sm">{p.period}</td><td className="p-3 text-sm text-right font-medium"> SAR {p.amount.toFixed(2)}</td><td className="p-3 text-center">{p.acknowledged ? <Badge className="bg-success/20 text-success">Confirmed</Badge> : <Button size="sm" variant="outline" onClick={() => handleAcknowledge(p.id)} className="h-7 text-xs">Confirm</Button>}</td><td className="p-3 text-center"><Button size="sm" variant="ghost" onClick={() => downloadPayslip(p.id)} className="h-7 text-xs"><FileText size={12} className="mr-1" />PDF</Button></td></tr>))}{payments.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No payments</td></tr>}</tbody></table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="leaves">
            <Card className="border-stone-100"><CardHeader><CardTitle className="font-outfit text-base">Leave History</CardTitle></CardHeader><CardContent>
              <table className="w-full"><thead><tr className="border-b"><th className="text-left p-3 text-sm font-medium">Type</th><th className="text-left p-3 text-sm font-medium">From</th><th className="text-left p-3 text-sm font-medium">To</th><th className="text-center p-3 text-sm font-medium">Days</th><th className="text-center p-3 text-sm font-medium">Ticket</th><th className="text-center p-3 text-sm font-medium">Status</th></tr></thead>
              <tbody>{leaves.map(l => (<tr key={l.id} className="border-b hover:bg-stone-50"><td className="p-3"><Badge variant="secondary" className="capitalize">{l.leave_type}</Badge></td><td className="p-3 text-sm">{format(new Date(l.start_date), 'MMM dd')}</td><td className="p-3 text-sm">{format(new Date(l.end_date), 'MMM dd, yyyy')}</td><td className="p-3 text-center font-medium">{l.days}</td><td className="p-3 text-center">{l.with_ticket ? <Badge className="bg-primary/20 text-primary">Yes</Badge> : '-'}</td><td className="p-3 text-center">{getStatusBadge(l.status)}</td></tr>))}{leaves.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No leaves</td></tr>}</tbody></table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="requests">
            <Card className="border-stone-100"><CardHeader><CardTitle className="font-outfit text-base">My Requests</CardTitle></CardHeader><CardContent>
              <div className="space-y-3">{requests.map(r => (
                <div key={r.id} className="p-3 border rounded-xl"><div className="flex justify-between"><div><div className="font-medium text-sm">{r.subject}</div><div className="text-xs text-muted-foreground mt-1"><Badge variant="secondary" className="capitalize mr-2">{r.request_type.replace('_', ' ')}</Badge>{r.amount ? `SAR ${r.amount}` : ''}</div>{r.response && <p className="text-xs text-primary mt-1">Response: {r.response}</p>}</div>{getStatusBadge(r.status)}</div></div>
              ))}{requests.length === 0 && <p className="text-center text-muted-foreground py-4">No requests</p>}</div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="letters">
            <Card className="border-stone-100"><CardHeader><CardTitle className="font-outfit text-base">Download Letters</CardTitle></CardHeader><CardContent>
              <p className="text-sm text-muted-foreground mb-4">Generate official letters with your details pre-filled.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[{type:'salary_certificate',title:'Salary Certificate',desc:'For bank, visa applications'},{type:'employment',title:'Employment Letter',desc:'Proof of employment'},{type:'noc',title:'No Objection Certificate',desc:'NOC for various purposes'},{type:'experience',title:'Experience Certificate',desc:'Work experience proof'}].map(l => (
                  <div key={l.type} className="p-4 border rounded-xl hover:bg-stone-50 transition-all flex justify-between items-center">
                    <div><div className="font-medium text-sm">{l.title}</div><div className="text-xs text-muted-foreground">{l.desc}</div></div>
                    <Button size="sm" variant="outline" onClick={() => downloadLetter(l.type)} className="rounded-xl"><FileText size={14} className="mr-1" />Download</Button>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          </TabsContent>
        </Tabs>

        {/* Leave Dialog */}
        <Dialog open={showLeaveForm} onOpenChange={setShowLeaveForm}>
          <DialogContent><DialogHeader><DialogTitle className="font-outfit">Apply for Leave</DialogTitle></DialogHeader>
            <form onSubmit={handleApplyLeave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Type *</Label><Select value={leaveData.leave_type} onValueChange={(v) => setLeaveData({ ...leaveData, leave_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="annual">Annual</SelectItem><SelectItem value="sick">Sick</SelectItem><SelectItem value="unpaid">Unpaid</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
                <div><Label>From *</Label><Input type="date" value={leaveData.start_date} onChange={(e) => { const s = e.target.value; const days = s && leaveData.end_date ? Math.max(1, Math.round((new Date(leaveData.end_date) - new Date(s)) / 86400000) + 1) : ''; setLeaveData({ ...leaveData, start_date: s, days }); }} required /></div>
                <div><Label>To *</Label><Input type="date" value={leaveData.end_date} onChange={(e) => { const en = e.target.value; const days = leaveData.start_date && en ? Math.max(1, Math.round((new Date(en) - new Date(leaveData.start_date)) / 86400000) + 1) : ''; setLeaveData({ ...leaveData, end_date: en, days }); }} required /></div>
                <div><Label>Days</Label><Input type="number" value={leaveData.days} readOnly className="bg-stone-50 font-bold" /></div>
              </div>
              <div><Label>Reason</Label><Textarea value={leaveData.reason} onChange={(e) => setLeaveData({ ...leaveData, reason: e.target.value })} /></div>
              {(profile?.ticket_entitled || 1) - (profile?.ticket_used || 0) > 0 && (
                <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/20"><Checkbox checked={leaveData.with_ticket} onCheckedChange={(v) => setLeaveData({ ...leaveData, with_ticket: v })} /><div><Label>Request ticket</Label><p className="text-xs text-muted-foreground">Balance: {(profile?.ticket_entitled || 1) - (profile?.ticket_used || 0)}</p></div></div>
              )}
              <div className="flex gap-3"><Button type="submit" className="rounded-xl">Submit</Button><Button type="button" variant="outline" onClick={() => setShowLeaveForm(false)} className="rounded-xl">Cancel</Button></div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Request Dialog */}
        <Dialog open={showRequestForm} onOpenChange={setShowRequestForm}>
          <DialogContent><DialogHeader><DialogTitle className="font-outfit">Submit Request</DialogTitle></DialogHeader>
            <form onSubmit={handleRequest} className="space-y-4">
              <div><Label>Type *</Label><Select value={requestData.request_type} onValueChange={(v) => setRequestData({ ...requestData, request_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="letter">Letter Request</SelectItem><SelectItem value="salary_certificate">Salary Certificate</SelectItem><SelectItem value="loan">Loan Request</SelectItem><SelectItem value="salary_advance">Salary Advance</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
              <div><Label>Subject *</Label><Input value={requestData.subject} onChange={(e) => setRequestData({ ...requestData, subject: e.target.value })} required /></div>
              {['loan', 'salary_advance'].includes(requestData.request_type) && <div><Label>Amount</Label><Input type="number" step="0.01" value={requestData.amount} onChange={(e) => setRequestData({ ...requestData, amount: e.target.value })} /></div>}
              <div><Label>Details</Label><Textarea value={requestData.details} onChange={(e) => setRequestData({ ...requestData, details: e.target.value })} /></div>
              <div className="flex gap-3"><Button type="submit" className="rounded-xl">Submit</Button><Button type="button" variant="outline" onClick={() => setShowRequestForm(false)} className="rounded-xl">Cancel</Button></div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
