import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CheckCircle, XCircle, Clock, Send } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function LeaveApprovalsPage() {
  const [leaves, setLeaves] = useState([]);
  const [requests, setRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState(null);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [announcement, setAnnouncement] = useState({ title: '', message: '', target: 'all' });
  const [responseText, setResponseText] = useState('');

  useEffect(() => { fetchLeaves(); fetchRequests(); }, [filter]);

  const fetchRequests = async () => {
    try {
      const [reqRes, empRes] = await Promise.all([api.get('/employee-requests'), api.get('/employees')]);
      setRequests(reqRes.data);
      setEmployees(empRes.data);
    } catch {}
  };

  const fetchLeaves = async () => {
    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const res = await api.get(`/leaves${params}`);
      setLeaves(res.data);
    } catch { toast.error('Failed to fetch leaves'); }
    finally { setLoading(false); }
  };

  const handleApprove = async (id) => {
    try {
      await api.put(`/leaves/${id}/approve`);
      toast.success('Leave approved');
      fetchLeaves();
    } catch { toast.error('Failed to approve'); }
  };

  const handleReject = async (id) => {
    try {
      await api.put(`/leaves/${id}/reject`, { reason: rejectReason });
      toast.success('Leave rejected');
      setRejectingId(null);
      setRejectReason('');
      fetchLeaves();
    } catch { toast.error('Failed to reject'); }
  };

  const getStatusBadge = (s) => {
    if (s === 'approved') return <Badge className="bg-success/20 text-success"><CheckCircle size={12} className="mr-1" />Approved</Badge>;
    if (s === 'rejected') return <Badge className="bg-error/20 text-error"><XCircle size={12} className="mr-1" />Rejected</Badge>;
    return <Badge className="bg-warning/20 text-warning"><Clock size={12} className="mr-1" />Pending</Badge>;
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  const pendingCount = leaves.filter(l => l.status === 'pending').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="leave-approvals-title">Leave Approvals</h1>
            <p className="text-muted-foreground">{pendingCount} pending request(s)</p>
          </div>
          <div className="flex gap-2">
            {['pending', 'approved', 'rejected', 'all'].map(f => (
              <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => { setFilter(f); setLoading(true); }} className="capitalize rounded-full" data-testid={`filter-${f}`}>{f}</Button>
            ))}
          </div>
        </div>

        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {leaves.map(l => (
                <div key={l.id} className="p-4 border rounded-lg hover:bg-secondary/30" data-testid="leave-request">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{l.employee_name}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        <Badge variant="secondary" className="capitalize mr-2">{l.leave_type}</Badge>
                        {format(new Date(l.start_date), 'MMM dd')} - {format(new Date(l.end_date), 'MMM dd, yyyy')} ({l.days} days)
                      </div>
                      {l.reason && <p className="text-sm mt-2">Reason: {l.reason}</p>}
                      {l.rejection_reason && <p className="text-sm text-error mt-1">Rejection: {l.rejection_reason}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {l.status === 'pending' ? (
                        <>
                          {rejectingId === l.id ? (
                            <div className="flex gap-2 items-center">
                              <Input placeholder="Reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="h-8 w-40 text-xs" />
                              <Button size="sm" variant="destructive" onClick={() => handleReject(l.id)} className="h-8 text-xs">Reject</Button>
                              <Button size="sm" variant="ghost" onClick={() => setRejectingId(null)} className="h-8 text-xs">Cancel</Button>
                            </div>
                          ) : (
                            <>
                              <Button size="sm" onClick={() => handleApprove(l.id)} className="h-8 rounded-full" data-testid="approve-btn">
                                <CheckCircle size={14} className="mr-1" />Approve
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setRejectingId(l.id)} className="h-8 rounded-full text-error" data-testid="reject-btn">
                                <XCircle size={14} className="mr-1" />Reject
                              </Button>
                            </>
                          )}
                        </>
                      ) : getStatusBadge(l.status)}
                    </div>
                  </div>
                </div>
              ))}
              {leaves.length === 0 && <p className="text-center text-muted-foreground py-8">No leave requests</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
