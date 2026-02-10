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
import { CheckCircle, Clock, XCircle, Calendar, DollarSign } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function EmployeePortalPage() {
  const [profile, setProfile] = useState(null);
  const [payments, setPayments] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveData, setLeaveData] = useState({ leave_type: 'annual', start_date: '', end_date: '', days: '', reason: '' });
  const [noProfile, setNoProfile] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const profRes = await api.get('/my/employee-profile');
      setProfile(profRes.data);
      const [payRes, leaveRes] = await Promise.all([api.get('/my/payments'), api.get('/my/leaves')]);
      setPayments(payRes.data);
      setLeaves(leaveRes.data);
    } catch (err) {
      if (err.response?.status === 404) setNoProfile(true);
      else toast.error('Failed to load data');
    } finally { setLoading(false); }
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    try {
      await api.post('/my/apply-leave', { ...leaveData, employee_id: '', days: parseInt(leaveData.days), start_date: new Date(leaveData.start_date).toISOString(), end_date: new Date(leaveData.end_date).toISOString() });
      toast.success('Leave request submitted for approval');
      setShowLeaveForm(false);
      setLeaveData({ leave_type: 'annual', start_date: '', end_date: '', days: '', reason: '' });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleAcknowledge = async (paymentId) => {
    try {
      await api.post(`/salary-payments/${paymentId}/acknowledge`);
      toast.success('Payment receipt confirmed');
      fetchData();
    } catch { toast.error('Failed to acknowledge'); }
  };

  const getStatusBadge = (status) => {
    if (status === 'approved') return <Badge className="bg-success/20 text-success"><CheckCircle size={12} className="mr-1" />Approved</Badge>;
    if (status === 'rejected') return <Badge className="bg-error/20 text-error"><XCircle size={12} className="mr-1" />Rejected</Badge>;
    return <Badge className="bg-warning/20 text-warning"><Clock size={12} className="mr-1" />Pending</Badge>;
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;
  if (noProfile) return <DashboardLayout><div className="flex items-center justify-center h-64 text-muted-foreground">No employee profile linked to your account. Contact admin.</div></DashboardLayout>;

  const annualUsed = leaves.filter(l => l.leave_type === 'annual' && l.status === 'approved').reduce((s, l) => s + l.days, 0);
  const sickUsed = leaves.filter(l => l.leave_type === 'sick' && l.status === 'approved').reduce((s, l) => s + l.days, 0);
  const pendingPayments = payments.filter(p => !p.acknowledged);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="portal-title">My Portal</h1>
            <p className="text-muted-foreground">Welcome, {profile?.name}</p>
          </div>
          <Button onClick={() => setShowLeaveForm(true)} className="rounded-full" data-testid="apply-leave-btn">
            <Calendar size={18} className="mr-2" />Apply for Leave
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Monthly Salary</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold font-outfit">${(profile?.salary || 0).toFixed(2)}</div></CardContent></Card>
          <Card className="border-border"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Loan Balance</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold font-outfit text-warning">${(profile?.loan_balance || 0).toFixed(2)}</div></CardContent></Card>
          <Card className="border-border"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Annual Leave</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold font-outfit text-success">{(profile?.annual_leave_entitled || 30) - annualUsed} left</div></CardContent></Card>
          <Card className="border-border"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Sick Leave</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold font-outfit text-info">{(profile?.sick_leave_entitled || 15) - sickUsed} left</div></CardContent></Card>
        </div>

        {pendingPayments.length > 0 && (
          <Card className="border-border border-warning/50 bg-warning/5">
            <CardHeader><CardTitle className="font-outfit flex items-center gap-2"><DollarSign size={18} className="text-warning" />Payments Awaiting Acknowledgment</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingPayments.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-3 bg-background rounded-lg border" data-testid="pending-payment">
                    <div>
                      <div className="font-medium text-sm">${p.amount.toFixed(2)} - {(p.payment_type || 'salary').replace('_', ' ')}</div>
                      <div className="text-xs text-muted-foreground">{p.period} | {p.payment_mode} | {format(new Date(p.date), 'MMM dd, yyyy')}</div>
                    </div>
                    <Button size="sm" onClick={() => handleAcknowledge(p.id)} className="rounded-full" data-testid="acknowledge-btn">
                      <CheckCircle size={14} className="mr-1" />I Confirm Receipt
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="payments">
          <TabsList><TabsTrigger value="payments">My Payments</TabsTrigger><TabsTrigger value="leaves">My Leaves</TabsTrigger></TabsList>

          <TabsContent value="payments">
            <Card className="border-border">
              <CardHeader><CardTitle className="font-outfit">Payment History</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full" data-testid="my-payments-table">
                    <thead><tr className="border-b border-border">
                      <th className="text-left p-3 font-medium text-sm">Date</th>
                      <th className="text-left p-3 font-medium text-sm">Type</th>
                      <th className="text-left p-3 font-medium text-sm">Period</th>
                      <th className="text-right p-3 font-medium text-sm">Amount</th>
                      <th className="text-left p-3 font-medium text-sm">Mode</th>
                      <th className="text-center p-3 font-medium text-sm">Status</th>
                    </tr></thead>
                    <tbody>
                      {payments.map(p => (
                        <tr key={p.id} className="border-b border-border hover:bg-secondary/50">
                          <td className="p-3 text-sm">{format(new Date(p.date), 'MMM dd, yyyy')}</td>
                          <td className="p-3"><Badge variant="secondary" className="capitalize">{(p.payment_type || 'salary').replace('_', ' ')}</Badge></td>
                          <td className="p-3 text-sm">{p.period}</td>
                          <td className="p-3 text-sm text-right font-medium">${p.amount.toFixed(2)}</td>
                          <td className="p-3 text-sm capitalize">{p.payment_mode}</td>
                          <td className="p-3 text-center">
                            {p.acknowledged ? (
                              <Badge className="bg-success/20 text-success"><CheckCircle size={12} className="mr-1" />Confirmed</Badge>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => handleAcknowledge(p.id)} className="h-7 text-xs" data-testid="ack-btn">Confirm Receipt</Button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {payments.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No payments yet</td></tr>}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leaves">
            <Card className="border-border">
              <CardHeader><CardTitle className="font-outfit">Leave History</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full" data-testid="my-leaves-table">
                    <thead><tr className="border-b border-border">
                      <th className="text-left p-3 font-medium text-sm">Type</th>
                      <th className="text-left p-3 font-medium text-sm">From</th>
                      <th className="text-left p-3 font-medium text-sm">To</th>
                      <th className="text-center p-3 font-medium text-sm">Days</th>
                      <th className="text-left p-3 font-medium text-sm">Reason</th>
                      <th className="text-center p-3 font-medium text-sm">Status</th>
                    </tr></thead>
                    <tbody>
                      {leaves.map(l => (
                        <tr key={l.id} className="border-b border-border hover:bg-secondary/50">
                          <td className="p-3"><Badge variant="secondary" className="capitalize">{l.leave_type}</Badge></td>
                          <td className="p-3 text-sm">{format(new Date(l.start_date), 'MMM dd, yyyy')}</td>
                          <td className="p-3 text-sm">{format(new Date(l.end_date), 'MMM dd, yyyy')}</td>
                          <td className="p-3 text-center font-medium">{l.days}</td>
                          <td className="p-3 text-sm">{l.reason || '-'}</td>
                          <td className="p-3 text-center">{getStatusBadge(l.status)}</td>
                        </tr>
                      ))}
                      {leaves.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No leave records</td></tr>}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Apply Leave Dialog */}
        <Dialog open={showLeaveForm} onOpenChange={setShowLeaveForm}>
          <DialogContent data-testid="apply-leave-dialog">
            <DialogHeader><DialogTitle className="font-outfit">Apply for Leave</DialogTitle></DialogHeader>
            <form onSubmit={handleApplyLeave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Leave Type *</Label>
                  <Select value={leaveData.leave_type} onValueChange={(v) => setLeaveData({ ...leaveData, leave_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="annual">Annual Leave</SelectItem>
                      <SelectItem value="sick">Sick Leave</SelectItem>
                      <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Days *</Label><Input type="number" value={leaveData.days} onChange={(e) => setLeaveData({ ...leaveData, days: e.target.value })} required /></div>
                <div><Label>Start Date *</Label><Input type="date" value={leaveData.start_date} onChange={(e) => setLeaveData({ ...leaveData, start_date: e.target.value })} required /></div>
                <div><Label>End Date *</Label><Input type="date" value={leaveData.end_date} onChange={(e) => setLeaveData({ ...leaveData, end_date: e.target.value })} required /></div>
              </div>
              <div><Label>Reason</Label><Textarea value={leaveData.reason} onChange={(e) => setLeaveData({ ...leaveData, reason: e.target.value })} placeholder="Reason for leave" /></div>
              <div className="flex gap-3">
                <Button type="submit" className="rounded-full" data-testid="submit-leave-request">Submit Request</Button>
                <Button type="button" variant="outline" onClick={() => setShowLeaveForm(false)} className="rounded-full">Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
