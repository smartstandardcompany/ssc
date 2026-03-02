import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import {
  CalendarDays, Plus, Clock, Users, Phone, Mail, Utensils, Check, X,
  RefreshCw, Loader2, ChevronRight, AlertCircle, PartyPopper, Briefcase,
  Heart, Gift, UserCheck, UserX, CalendarCheck
} from 'lucide-react';
import api from '@/lib/api';
import { format, addDays, parseISO, isToday } from 'date-fns';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  pending: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-700', icon: CalendarCheck },
  seated: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: Utensils },
  completed: { bg: 'bg-stone-100', text: 'text-stone-600', icon: Check },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700', icon: X },
  no_show: { bg: 'bg-red-100', text: 'text-red-700', icon: UserX },
};

const OCCASIONS = [
  { value: 'none', label: 'No occasion', icon: Utensils },
  { value: 'birthday', label: 'Birthday', icon: Gift },
  { value: 'anniversary', label: 'Anniversary', icon: Heart },
  { value: 'business', label: 'Business', icon: Briefcase },
  { value: 'celebration', label: 'Celebration', icon: PartyPopper },
];

const TIME_SLOTS = [
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30', '21:00', '21:30'
];

export default function ReservationsPage() {
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState([]);
  const [tables, setTables] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('today');
  
  const [showNewReservation, setShowNewReservation] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);
  
  const [form, setForm] = useState({
    table_id: '', customer_name: '', customer_phone: '', customer_email: '',
    party_size: '2', date: format(new Date(), 'yyyy-MM-dd'), time_slot: '19:00',
    duration_minutes: '90', special_requests: '', occasion: 'none'
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const [resRes, tablesRes, statsRes] = await Promise.all([
        activeTab === 'today' ? api.get('/reservations/today') :
        activeTab === 'upcoming' ? api.get('/reservations/upcoming?days=7') :
        api.get(`/reservations?date=${dateStr}`),
        api.get('/tables'),
        api.get('/reservations/stats'),
      ]);
      setReservations(resRes.data);
      setTables(tablesRes.data);
      setStats(statsRes.data);
    } catch (err) {
      toast.error('Failed to load reservations');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, activeTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateReservation = async () => {
    if (!form.table_id || !form.customer_name || !form.customer_phone) {
      toast.error('Please fill in required fields');
      return;
    }
    try {
      const data = {
        ...form,
        party_size: parseInt(form.party_size),
        duration_minutes: parseInt(form.duration_minutes),
        occasion: form.occasion === 'none' ? null : form.occasion,
      };
      await api.post('/reservations', data);
      toast.success('Reservation created!');
      setShowNewReservation(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create reservation');
    }
  };

  const handleStatusChange = async (reservationId, newStatus) => {
    try {
      await api.post(`/reservations/${reservationId}/status`, { status: newStatus });
      toast.success(`Reservation ${newStatus}`);
      fetchData();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteReservation = async (id) => {
    if (!confirm('Delete this reservation?')) return;
    try {
      await api.delete(`/reservations/${id}`);
      toast.success('Reservation deleted');
      setSelectedReservation(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const resetForm = () => {
    setForm({
      table_id: '', customer_name: '', customer_phone: '', customer_email: '',
      party_size: '2', date: format(new Date(), 'yyyy-MM-dd'), time_slot: '19:00',
      duration_minutes: '90', special_requests: '', occasion: 'none'
    });
  };

  const getAvailableTables = () => {
    const partySize = parseInt(form.party_size) || 2;
    return tables.filter(t => t.capacity >= partySize && t.is_active);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="reservations-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-outfit tracking-tight dark:text-white">
              Table Reservations
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage restaurant table bookings and walk-ins
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchData} data-testid="refresh-btn">
              <RefreshCw size={16} className="mr-1" /> Refresh
            </Button>
            <Button onClick={() => { resetForm(); setShowNewReservation(true); }} data-testid="new-reservation-btn">
              <Plus size={16} className="mr-1" /> New Reservation
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <Card className="border-0 shadow-sm dark:bg-stone-900">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <CalendarDays size={14} /> Today
                </div>
                <p className="text-2xl font-bold text-blue-600">{stats.today?.total || 0}</p>
                <p className="text-xs text-muted-foreground">{stats.today?.confirmed || 0} confirmed</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm dark:bg-stone-900">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <UserCheck size={14} /> Seated
                </div>
                <p className="text-2xl font-bold text-emerald-600">{stats.today?.seated || 0}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm dark:bg-stone-900">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Check size={14} /> Completed
                </div>
                <p className="text-2xl font-bold text-stone-600">{stats.today?.completed || 0}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm dark:bg-stone-900">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <X size={14} /> Cancelled
                </div>
                <p className="text-2xl font-bold text-red-500">{stats.today?.cancelled || 0}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm dark:bg-stone-900">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <UserX size={14} /> No Shows
                </div>
                <p className="text-2xl font-bold text-amber-600">{stats.today?.no_show || 0}</p>
                <p className="text-xs text-muted-foreground">{stats.weekly?.no_show_rate || 0}% weekly</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm dark:bg-stone-900">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Clock size={14} /> Popular Time
                </div>
                <p className="text-2xl font-bold">{stats.popular_times?.[0]?.time || '-'}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between">
            <TabsList className="bg-stone-100 dark:bg-stone-800">
              <TabsTrigger value="today" data-testid="tab-today">Today</TabsTrigger>
              <TabsTrigger value="upcoming" data-testid="tab-upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="calendar" data-testid="tab-calendar">Calendar</TabsTrigger>
            </TabsList>
            
            {activeTab === 'calendar' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-48">
                    <CalendarDays size={14} className="mr-2" />
                    {format(selectedDate, 'MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => d && setSelectedDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Reservations List */}
          <TabsContent value={activeTab} className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-primary" size={32} />
              </div>
            ) : reservations.length === 0 ? (
              <Card className="border-dashed border-2">
                <CardContent className="p-12 text-center">
                  <CalendarDays size={48} className="mx-auto mb-4 text-stone-300" />
                  <h3 className="font-semibold text-lg mb-2">No reservations</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    {activeTab === 'today' ? "No reservations for today" :
                     activeTab === 'upcoming' ? "No upcoming reservations" :
                     `No reservations for ${format(selectedDate, 'MMM d, yyyy')}`}
                  </p>
                  <Button onClick={() => setShowNewReservation(true)}>
                    <Plus size={16} className="mr-1" /> Create Reservation
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {reservations.map(res => {
                  const statusConfig = STATUS_CONFIG[res.status] || STATUS_CONFIG.pending;
                  const StatusIcon = statusConfig.icon;
                  const occasionObj = OCCASIONS.find(o => o.value === res.occasion);
                  
                  return (
                    <Card 
                      key={res.id} 
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setSelectedReservation(res)}
                      data-testid={`reservation-${res.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            {/* Time */}
                            <div className="text-center min-w-[60px]">
                              <p className="text-xl font-bold">{res.time_slot}</p>
                              {!isToday(parseISO(res.date)) && (
                                <p className="text-xs text-muted-foreground">{format(parseISO(res.date), 'MMM d')}</p>
                              )}
                            </div>
                            
                            {/* Divider */}
                            <div className="h-12 w-px bg-border" />
                            
                            {/* Details */}
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{res.customer_name}</h3>
                                {occasionObj && occasionObj.value !== 'none' && (
                                  <Badge variant="outline" className="text-xs">
                                    {occasionObj.label}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                                <span className="flex items-center gap-1">
                                  <Users size={12} /> {res.party_size}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Utensils size={12} /> {res.table_number || 'Table'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Phone size={12} /> {res.customer_phone}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Status & Actions */}
                          <div className="flex items-center gap-2">
                            <Badge className={cn('text-xs', statusConfig.bg, statusConfig.text)}>
                              <StatusIcon size={12} className="mr-1" />
                              {res.status}
                            </Badge>
                            
                            {res.status === 'confirmed' && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                                onClick={(e) => { e.stopPropagation(); handleStatusChange(res.id, 'seated'); }}
                              >
                                Seat
                              </Button>
                            )}
                            {res.status === 'seated' && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={(e) => { e.stopPropagation(); handleStatusChange(res.id, 'completed'); }}
                              >
                                Complete
                              </Button>
                            )}
                            
                            <ChevronRight size={16} className="text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* New Reservation Dialog */}
      <Dialog open={showNewReservation} onOpenChange={setShowNewReservation}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Reservation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Customer Name *</Label>
                <Input
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  placeholder="Guest name"
                  className="mt-1"
                  data-testid="customer-name-input"
                />
              </div>
              <div>
                <Label>Phone *</Label>
                <Input
                  value={form.customer_phone}
                  onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                  placeholder="+966..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.customer_email}
                  onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                  placeholder="Optional"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Time *</Label>
                <Select value={form.time_slot} onValueChange={(v) => setForm({ ...form, time_slot: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Party Size *</Label>
                <Select value={form.party_size} onValueChange={(v) => setForm({ ...form, party_size: v, table_id: '' })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map(n => (
                      <SelectItem key={n} value={n.toString()}>{n} {n === 1 ? 'guest' : 'guests'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Table *</Label>
                <Select value={form.table_id} onValueChange={(v) => setForm({ ...form, table_id: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select table" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableTables().map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.table_number} ({t.section}, {t.capacity} seats)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Occasion</Label>
                <Select value={form.occasion} onValueChange={(v) => setForm({ ...form, occasion: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OCCASIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Duration</Label>
                <Select value={form.duration_minutes} onValueChange={(v) => setForm({ ...form, duration_minutes: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="180">3 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Special Requests</Label>
                <Textarea
                  value={form.special_requests}
                  onChange={(e) => setForm({ ...form, special_requests: e.target.value })}
                  placeholder="Dietary requirements, preferences, etc."
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewReservation(false)}>Cancel</Button>
            <Button onClick={handleCreateReservation} data-testid="save-reservation-btn">
              Create Reservation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reservation Detail Dialog */}
      <Dialog open={!!selectedReservation} onOpenChange={() => setSelectedReservation(null)}>
        <DialogContent className="max-w-md">
          {selectedReservation && (
            <>
              <DialogHeader>
                <DialogTitle>Reservation Details</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold">{selectedReservation.customer_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedReservation.confirmation_code}
                    </p>
                  </div>
                  <Badge className={cn(
                    'text-sm',
                    STATUS_CONFIG[selectedReservation.status]?.bg,
                    STATUS_CONFIG[selectedReservation.status]?.text
                  )}>
                    {selectedReservation.status}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <CalendarDays size={16} className="text-muted-foreground" />
                    <span>{format(parseISO(selectedReservation.date), 'EEEE, MMM d, yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-muted-foreground" />
                    <span>{selectedReservation.time_slot} ({selectedReservation.duration_minutes}min)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-muted-foreground" />
                    <span>{selectedReservation.party_size} guests</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Utensils size={16} className="text-muted-foreground" />
                    <span>{selectedReservation.table_number || 'Table'} ({selectedReservation.section})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={16} className="text-muted-foreground" />
                    <span>{selectedReservation.customer_phone}</span>
                  </div>
                  {selectedReservation.customer_email && (
                    <div className="flex items-center gap-2">
                      <Mail size={16} className="text-muted-foreground" />
                      <span>{selectedReservation.customer_email}</span>
                    </div>
                  )}
                </div>
                
                {selectedReservation.special_requests && (
                  <div className="p-3 bg-stone-50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Special Requests</p>
                    <p className="text-sm">{selectedReservation.special_requests}</p>
                  </div>
                )}
                
                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {selectedReservation.status === 'pending' && (
                    <Button size="sm" variant="outline" className="text-blue-600"
                      onClick={() => handleStatusChange(selectedReservation.id, 'confirmed')}>
                      <Check size={14} className="mr-1" /> Confirm
                    </Button>
                  )}
                  {selectedReservation.status === 'confirmed' && (
                    <>
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => handleStatusChange(selectedReservation.id, 'seated')}>
                        <Utensils size={14} className="mr-1" /> Seat Guest
                      </Button>
                      <Button size="sm" variant="outline" className="text-amber-600"
                        onClick={() => handleStatusChange(selectedReservation.id, 'no_show')}>
                        <UserX size={14} className="mr-1" /> No Show
                      </Button>
                    </>
                  )}
                  {selectedReservation.status === 'seated' && (
                    <Button size="sm" variant="outline"
                      onClick={() => handleStatusChange(selectedReservation.id, 'completed')}>
                      <Check size={14} className="mr-1" /> Complete
                    </Button>
                  )}
                  {!['completed', 'cancelled', 'no_show'].includes(selectedReservation.status) && (
                    <Button size="sm" variant="outline" className="text-red-600"
                      onClick={() => handleStatusChange(selectedReservation.id, 'cancelled')}>
                      <X size={14} className="mr-1" /> Cancel
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-red-500 ml-auto"
                    onClick={() => handleDeleteReservation(selectedReservation.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
