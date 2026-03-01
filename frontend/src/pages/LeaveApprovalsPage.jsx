import { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ExportButton from '@/components/ExportButton';
import { CheckCircle, XCircle, Clock, Send, CalendarDays, List, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, isSameMonth, getDay, parseISO } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

const LEAVE_COLORS = {
  annual: { approved: 'bg-emerald-500', pending: 'bg-emerald-300', rejected: 'bg-emerald-200 line-through' },
  sick: { approved: 'bg-blue-500', pending: 'bg-blue-300', rejected: 'bg-blue-200' },
  unpaid: { approved: 'bg-orange-500', pending: 'bg-orange-300', rejected: 'bg-orange-200' },
  personal: { approved: 'bg-purple-500', pending: 'bg-purple-300', rejected: 'bg-purple-200' },
  emergency: { approved: 'bg-red-500', pending: 'bg-red-300', rejected: 'bg-red-200' },
};

const STATUS_BADGE = {
  approved: { icon: CheckCircle, className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  rejected: { icon: XCircle, className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  pending: { icon: Clock, className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function LeaveCalendar({ leaves }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart);

  // Build map of dates -> leaves
  const leaveMap = useMemo(() => {
    const map = {};
    leaves.forEach(l => {
      if (!l.start_date || !l.end_date) return;
      const start = parseISO(l.start_date);
      const end = parseISO(l.end_date);
      const interval = eachDayOfInterval({ start, end });
      interval.forEach(d => {
        const key = format(d, 'yyyy-MM-dd');
        if (!map[key]) map[key] = [];
        map[key].push(l);
      });
    });
    return map;
  }, [leaves]);

  const selectedLeaves = selectedDate ? (leaveMap[format(selectedDate, 'yyyy-MM-dd')] || []) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar */}
      <div className="lg:col-span-2">
        <Card className="dark:bg-stone-900 dark:border-stone-700">
          <CardContent className="p-4">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft size={20} />
              </Button>
              <h2 className="text-lg font-bold font-outfit dark:text-white" data-testid="calendar-month">
                {format(currentMonth, 'MMMM yyyy')}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight size={20} />
              </Button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1" data-testid="leave-calendar-grid">
              {/* Padding for start of month */}
              {Array.from({ length: startPad }).map((_, i) => (
                <div key={`pad-${i}`} className="h-20" />
              ))}

              {days.map(day => {
                const key = format(day, 'yyyy-MM-dd');
                const dayLeaves = leaveMap[key] || [];
                const isToday = isSameDay(day, new Date());
                const isSelected = selectedDate && isSameDay(day, selectedDate);

                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDate(day)}
                    className={`h-20 rounded-xl p-1.5 text-left transition-all border-2 ${
                      isSelected ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' :
                      isToday ? 'border-stone-300 dark:border-stone-600 bg-stone-50 dark:bg-stone-800' :
                      'border-transparent hover:bg-stone-50 dark:hover:bg-stone-800'
                    }`}
                    data-testid={`cal-day-${key}`}
                  >
                    <span className={`text-xs font-medium ${isToday ? 'text-orange-600 font-bold' : 'dark:text-stone-300'}`}>
                      {format(day, 'd')}
                    </span>
                    {dayLeaves.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {dayLeaves.slice(0, 3).map((l, i) => {
                          const colors = LEAVE_COLORS[l.leave_type] || LEAVE_COLORS.annual;
                          const color = colors[l.status] || colors.pending;
                          return (
                            <div key={i} className={`${color} text-white text-[9px] rounded px-1 py-0.5 truncate leading-tight`}>
                              {l.employee_name?.split(' ')[0]}
                            </div>
                          );
                        })}
                        {dayLeaves.length > 3 && (
                          <div className="text-[9px] text-muted-foreground text-center">+{dayLeaves.length - 3} more</div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t dark:border-stone-700">
              {Object.entries(LEAVE_COLORS).map(([type, colors]) => (
                <div key={type} className="flex items-center gap-1.5 text-xs">
                  <div className={`w-3 h-3 rounded-sm ${colors.approved}`} />
                  <span className="capitalize dark:text-stone-300">{type}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-xs ml-4">
                <div className="w-3 h-3 rounded-sm bg-stone-300" />
                <span className="dark:text-stone-300">Lighter = Pending</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selected Day Detail */}
      <div>
        <Card className="dark:bg-stone-900 dark:border-stone-700 sticky top-20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-outfit dark:text-white">
              {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : 'Select a date'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedDate ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Click a date to see leave details</p>
            ) : selectedLeaves.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No leaves on this date</p>
            ) : (
              <div className="space-y-3">
                {selectedLeaves.map((l, i) => {
                  const sb = STATUS_BADGE[l.status] || STATUS_BADGE.pending;
                  const Icon = sb.icon;
                  return (
                    <div key={i} className="p-3 rounded-xl border dark:border-stone-700 dark:bg-stone-800" data-testid={`cal-leave-detail-${i}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-sm dark:text-white">{l.employee_name}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge variant="secondary" className="capitalize text-xs">{l.leave_type}</Badge>
                            <Badge className={`text-xs ${sb.className}`}>
                              <Icon size={10} className="mr-0.5" />{l.status}
                            </Badge>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">{l.days}d</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(parseISO(l.start_date), 'MMM d')} - {format(parseISO(l.end_date), 'MMM d, yyyy')}
                      </p>
                      {l.reason && <p className="text-xs mt-1 dark:text-stone-400">Reason: {l.reason}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LeaveApprovalsPage() {
  const { t } = useLanguage();
  const [leaves, setLeaves] = useState([]);
  const [allLeaves, setAllLeaves] = useState([]);
  const [requests, setRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState(null);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [announcement, setAnnouncement] = useState({ title: '', message: '', target: 'all' });
  const [responseText, setResponseText] = useState('');

  useEffect(() => { fetchLeaves(); fetchRequests(); fetchAllLeaves(); }, [filter]);

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

  const fetchAllLeaves = async () => {
    try {
      const res = await api.get('/leaves');
      setAllLeaves(res.data);
    } catch {}
  };

  const handleApprove = async (id) => {
    try {
      await api.put(`/leaves/${id}/approve`);
      toast.success('Leave approved');
      fetchLeaves(); fetchAllLeaves();
    } catch { toast.error('Failed to approve'); }
  };

  const handleReject = async (id) => {
    try {
      await api.put(`/leaves/${id}/reject`, { reason: rejectReason });
      toast.success('Leave rejected');
      setRejectingId(null); setRejectReason('');
      fetchLeaves(); fetchAllLeaves();
    } catch { toast.error('Failed to reject'); }
  };

  const getStatusBadge = (s) => {
    const cfg = STATUS_BADGE[s] || STATUS_BADGE.pending;
    const Icon = cfg.icon;
    return <Badge className={cfg.className}><Icon size={12} className="mr-1" />{s}</Badge>;
  };

  const handleRespondRequest = async (reqId, status) => {
    try {
      await api.put(`/employee-requests/${reqId}/respond`, { status, response: responseText });
      toast.success(`Request ${status}`);
      setResponseText('');
      fetchRequests();
    } catch { toast.error('Failed'); }
  };

  const sendAnnouncement = async () => {
    try {
      await api.post('/announcements/send', announcement);
      toast.success('Announcement sent');
      setShowAnnouncement(false);
      setAnnouncement({ title: '', message: '', target: 'all' });
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const pendingCount = leaves.filter(l => l.status === 'pending').length;
  const pendingReqs = requests.filter(r => r.status === 'pending').length;

  // Leave summary stats
  const approvedCount = allLeaves.filter(l => l.status === 'approved').length;
  const totalDays = allLeaves.filter(l => l.status === 'approved').reduce((s, l) => s + (l.days || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="leave-approvals-page">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-outfit dark:text-white" data-testid="leave-approvals-title">Leave Management</h1>
            <p className="text-muted-foreground text-sm mt-1">{pendingCount} pending leaves &middot; {pendingReqs} pending requests</p>
          </div>
          <div className="flex gap-2">
            <ExportButton dataType="leaves" label="Leaves" />
            <Button onClick={() => setShowAnnouncement(true)} data-testid="send-announcement-btn">
              <Send size={16} className="mr-1" />Announcement
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total Requests', value: allLeaves.length, color: 'stone' },
            { label: 'Pending', value: allLeaves.filter(l => l.status === 'pending').length, color: 'amber' },
            { label: 'Approved', value: approvedCount, color: 'emerald' },
            { label: 'Rejected', value: allLeaves.filter(l => l.status === 'rejected').length, color: 'red' },
            { label: 'Total Days Used', value: totalDays, color: 'blue' },
          ].map(s => (
            <Card key={s.label} className="border-0 shadow-sm dark:bg-stone-900">
              <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold font-outfit text-${s.color}-600`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="list">
          <TabsList>
            <TabsTrigger value="list" data-testid="tab-list"><List size={14} className="mr-1" />List View</TabsTrigger>
            <TabsTrigger value="calendar" data-testid="tab-calendar"><CalendarDays size={14} className="mr-1" />Calendar</TabsTrigger>
            {requests.length > 0 && <TabsTrigger value="requests">Requests ({pendingReqs})</TabsTrigger>}
          </TabsList>

          {/* List View */}
          <TabsContent value="list" className="mt-4">
            <div className="flex gap-2 mb-4">
              {['pending', 'approved', 'rejected', 'all'].map(f => (
                <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => { setFilter(f); setLoading(true); }} className="capitalize" data-testid={`filter-${f}`}>{f}</Button>
              ))}
            </div>

            {loading ? (
              <div className="py-12 text-center text-muted-foreground">Loading...</div>
            ) : (
              <Card className="dark:bg-stone-900 dark:border-stone-700">
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {leaves.map(l => (
                      <div key={l.id} className="p-4 border dark:border-stone-700 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors" data-testid="leave-request">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium dark:text-white">{l.employee_name}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="capitalize text-xs">{l.leave_type}</Badge>
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(l.start_date), 'MMM dd')} - {format(new Date(l.end_date), 'MMM dd, yyyy')}
                              </span>
                              <Badge variant="outline" className="text-xs">{l.days} days</Badge>
                            </div>
                            {l.reason && <p className="text-sm text-muted-foreground mt-2">Reason: {l.reason}</p>}
                            {l.rejection_reason && <p className="text-sm text-red-500 mt-1">Rejection: {l.rejection_reason}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            {l.status === 'pending' ? (
                              rejectingId === l.id ? (
                                <div className="flex gap-2 items-center">
                                  <Input placeholder="Reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="h-8 w-40 text-xs" />
                                  <Button size="sm" variant="destructive" onClick={() => handleReject(l.id)} className="h-8 text-xs">Reject</Button>
                                  <Button size="sm" variant="ghost" onClick={() => setRejectingId(null)} className="h-8 text-xs">Cancel</Button>
                                </div>
                              ) : (
                                <>
                                  <Button size="sm" onClick={() => handleApprove(l.id)} className="h-8" data-testid="approve-btn">
                                    <CheckCircle size={14} className="mr-1" />Approve
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setRejectingId(l.id)} className="h-8 text-red-500" data-testid="reject-btn">
                                    <XCircle size={14} className="mr-1" />Reject
                                  </Button>
                                </>
                              )
                            ) : getStatusBadge(l.status)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {leaves.length === 0 && <p className="text-center text-muted-foreground py-8">No leave requests</p>}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Calendar View */}
          <TabsContent value="calendar" className="mt-4">
            <LeaveCalendar leaves={allLeaves} />
          </TabsContent>

          {/* Requests View */}
          <TabsContent value="requests" className="mt-4">
            <Card className="dark:bg-stone-900 dark:border-stone-700">
              <CardHeader><CardTitle className="font-outfit dark:text-white">Employee Requests ({pendingReqs} pending)</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {requests.map(r => (
                    <div key={r.id} className="p-4 border dark:border-stone-700 rounded-xl" data-testid="admin-request-item">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium dark:text-white">{r.employee_name}</div>
                          <div className="text-sm mt-1"><Badge variant="secondary" className="capitalize mr-2">{r.request_type.replace('_', ' ')}</Badge>{r.subject}{r.amount ? ` - SAR ${r.amount}` : ''}</div>
                          {r.details && <p className="text-sm text-muted-foreground mt-1">{r.details}</p>}
                        </div>
                        {r.status === 'pending' ? (
                          <div className="flex gap-2 items-center">
                            <Input value={responseText} onChange={(e) => setResponseText(e.target.value)} placeholder="Response..." className="h-8 w-40 text-xs" />
                            <Button size="sm" onClick={() => handleRespondRequest(r.id, 'approved')} className="h-8"><CheckCircle size={14} className="mr-1" />Approve</Button>
                            <Button size="sm" variant="outline" onClick={() => handleRespondRequest(r.id, 'rejected')} className="h-8 text-red-500"><XCircle size={14} className="mr-1" />Reject</Button>
                          </div>
                        ) : (
                          <Badge className={r.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>{r.status}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {requests.length === 0 && <p className="text-center text-muted-foreground py-4">No requests</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Announcement Dialog */}
      <Dialog open={showAnnouncement} onOpenChange={setShowAnnouncement}>
        <DialogContent data-testid="announcement-dialog">
          <DialogHeader><DialogTitle className="font-outfit">Send Announcement</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>To</Label>
              <Select value={announcement.target} onValueChange={(v) => setAnnouncement({ ...announcement, target: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees.filter(e => e.user_id).map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Title *</Label><Input value={announcement.title} onChange={(e) => setAnnouncement({ ...announcement, title: e.target.value })} placeholder="Announcement title" /></div>
            <div><Label>Message *</Label><Textarea value={announcement.message} onChange={(e) => setAnnouncement({ ...announcement, message: e.target.value })} placeholder="Your message..." /></div>
            <div className="flex gap-3">
              <Button onClick={sendAnnouncement}><Send size={14} className="mr-2" />Send</Button>
              <Button variant="outline" onClick={() => setShowAnnouncement(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
