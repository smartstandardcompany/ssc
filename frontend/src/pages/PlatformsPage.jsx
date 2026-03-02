import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Truck, DollarSign, Receipt, CheckCircle, Clock, TrendingUp, Edit, Trash2, RefreshCw, Download, Calculator, Building2 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function PlatformsPage() {
  const [platforms, setPlatforms] = useState([]);
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({ platforms: [], totals: {} });
  const [branchSummary, setBranchSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPlatformForm, setShowPlatformForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [calculatedPayment, setCalculatedPayment] = useState(null);
  const [calculating, setCalculating] = useState(false);

  const [platformForm, setPlatformForm] = useState({
    name: '',
    name_ar: '',
    commission_rate: '',
    payment_terms: 'weekly',
    contact_email: '',
    contact_phone: '',
    notes: ''
  });

  const [paymentForm, setPaymentForm] = useState({
    platform_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    period_start: '',
    period_end: '',
    total_sales: '',
    commission_paid: '',
    amount_received: '',
    payment_method: 'bank_transfer',
    reference_number: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [platformsRes, paymentsRes, summaryRes, branchRes] = await Promise.all([
        api.get('/platforms'),
        api.get('/platform-payments'),
        api.get('/platforms/summary'),
        api.get('/platforms/branch-summary').catch(() => ({ data: [] }))
      ]);
      setPlatforms(platformsRes.data);
      setPayments(paymentsRes.data);
      setSummary(summaryRes.data);
      setBranchSummary(branchRes.data || []);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-calculate commission when platform and dates change
  const calculateExpected = async () => {
    if (!paymentForm.platform_id || !paymentForm.period_start || !paymentForm.period_end) {
      toast.error('Please select platform and date range first');
      return;
    }
    
    setCalculating(true);
    try {
      const res = await api.get(`/platform-payments/calculate?platform_id=${paymentForm.platform_id}&period_start=${paymentForm.period_start}&period_end=${paymentForm.period_end}`);
      const calc = res.data;
      setCalculatedPayment(calc);
      
      // Auto-fill the form
      setPaymentForm({
        ...paymentForm,
        total_sales: calc.total_sales.toString(),
        commission_paid: calc.calculated_commission.toString(),
        amount_received: calc.expected_amount.toString()
      });
      
      toast.success(`Found ${calc.sales_count} sales totaling SAR ${calc.total_sales.toLocaleString()}`);
    } catch (error) {
      toast.error('Failed to calculate');
    } finally {
      setCalculating(false);
    }
  };

  const seedDefaults = async () => {
    try {
      const res = await api.post('/platforms/seed-defaults');
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      toast.error('Failed to seed platforms');
    }
  };

  const handlePlatformSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPlatform) {
        await api.put(`/platforms/${editingPlatform.id}`, platformForm);
        toast.success('Platform updated');
      } else {
        await api.post('/platforms', platformForm);
        toast.success('Platform added');
      }
      setShowPlatformForm(false);
      setEditingPlatform(null);
      resetPlatformForm();
      fetchData();
    } catch (error) {
      toast.error('Failed to save platform');
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/platform-payments', {
        ...paymentForm,
        total_sales: parseFloat(paymentForm.total_sales) || 0,
        commission_paid: parseFloat(paymentForm.commission_paid) || 0,
        amount_received: parseFloat(paymentForm.amount_received) || 0
      });
      toast.success('Payment recorded');
      setShowPaymentForm(false);
      resetPaymentForm();
      fetchData();
    } catch (error) {
      toast.error('Failed to record payment');
    }
  };

  const deletePlatform = async (id) => {
    if (!window.confirm('Delete this platform?')) return;
    try {
      await api.delete(`/platforms/${id}`);
      toast.success('Platform deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const resetPlatformForm = () => {
    setPlatformForm({
      name: '', name_ar: '', commission_rate: '', payment_terms: 'weekly',
      contact_email: '', contact_phone: '', notes: ''
    });
  };

  const resetPaymentForm = () => {
    setPaymentForm({
      platform_id: '', payment_date: new Date().toISOString().split('T')[0],
      period_start: '', period_end: '', total_sales: '', commission_paid: '',
      amount_received: '', payment_method: 'bank_transfer', reference_number: '', notes: ''
    });
  };

  const editPlatform = (platform) => {
    setEditingPlatform(platform);
    setPlatformForm({
      name: platform.name,
      name_ar: platform.name_ar || '',
      commission_rate: platform.commission_rate || '',
      payment_terms: platform.payment_terms || 'weekly',
      contact_email: platform.contact_email || '',
      contact_phone: platform.contact_phone || '',
      notes: platform.notes || ''
    });
    setShowPlatformForm(true);
  };

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;
  }

  const { totals } = summary;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit mb-1 flex items-center gap-2" data-testid="platforms-page-title">
              <Truck className="text-purple-500" />
              Online Platforms
            </h1>
            <p className="text-sm text-muted-foreground">Manage delivery platforms: HungerStation, Jahez, ToYou, etc.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {platforms.length === 0 && (
              <Button variant="outline" onClick={seedDefaults} className="rounded-xl">
                <Download size={14} className="mr-1" />
                Load Default Platforms
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowPaymentForm(true)} className="rounded-xl" data-testid="record-payment-btn">
              <DollarSign size={14} className="mr-1" />
              Record Payment
            </Button>
            <Button onClick={() => { resetPlatformForm(); setEditingPlatform(null); setShowPlatformForm(true); }} className="rounded-xl bg-purple-600 hover:bg-purple-700" data-testid="add-platform-btn">
              <Plus size={14} className="mr-1" />
              Add Platform
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={16} className="text-purple-600" />
                <span className="text-sm text-muted-foreground">Total Sales</span>
              </div>
              <div className="text-2xl font-bold text-purple-700">SAR {(totals.total_sales || 0).toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-emerald-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={16} className="text-emerald-600" />
                <span className="text-sm text-muted-foreground">Received</span>
              </div>
              <div className="text-2xl font-bold text-emerald-700">SAR {(totals.total_received || 0).toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Receipt size={16} className="text-amber-600" />
                <span className="text-sm text-muted-foreground">Commission</span>
              </div>
              <div className="text-2xl font-bold text-amber-700">SAR {(totals.total_commission || 0).toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={16} className="text-red-600" />
                <span className="text-sm text-muted-foreground">Pending</span>
              </div>
              <div className="text-2xl font-bold text-red-700">SAR {(totals.total_pending || 0).toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="rounded-xl">
            <TabsTrigger value="overview" className="rounded-lg">Overview</TabsTrigger>
            <TabsTrigger value="platforms" className="rounded-lg">Platforms</TabsTrigger>
            <TabsTrigger value="payments" className="rounded-lg">Payments</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {summary.platforms.map(p => (
                <Card key={p.platform_id} className="hover:shadow-md transition-shadow" data-testid={`platform-card-${p.platform_id}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between">
                      <span className="font-outfit">{p.platform_name}</span>
                      <Badge variant={p.pending_amount > 0 ? 'destructive' : 'secondary'}>
                        {p.pending_amount > 0 ? `SAR ${p.pending_amount.toLocaleString()} pending` : 'Settled'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Sales:</span>
                        <span className="font-medium">SAR {p.total_sales.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Received:</span>
                        <span className="font-medium text-emerald-600">SAR {p.total_received.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Commission ({p.commission_rate}%):</span>
                        <span className="font-medium text-amber-600">SAR {p.total_commission.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                        <span>{p.sales_count} sales</span>
                        <span>{p.payments_count} payments</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {summary.platforms.length === 0 && (
                <Card className="col-span-full">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Truck size={48} className="mx-auto mb-3 opacity-30" />
                    <p>No platform sales yet. Add a platform and record online sales.</p>
                    <Button variant="outline" onClick={seedDefaults} className="mt-4">
                      Load Default Platforms
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="platforms" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {platforms.map(platform => (
                <Card key={platform.id} className={`${!platform.is_active ? 'opacity-50' : ''}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between">
                      <div>
                        <span className="font-outfit">{platform.name}</span>
                        {platform.name_ar && <span className="text-sm text-muted-foreground ml-2">({platform.name_ar})</span>}
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => editPlatform(platform)}>
                          <Edit size={14} />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-red-500" onClick={() => deletePlatform(platform.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Commission:</span>
                        <span className="font-medium">{platform.commission_rate || 0}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Payment Terms:</span>
                        <Badge variant="outline">{platform.payment_terms}</Badge>
                      </div>
                      {platform.pending_amount > 0 && (
                        <div className="flex justify-between pt-2 border-t mt-2">
                          <span className="text-muted-foreground">Pending:</span>
                          <span className="font-bold text-red-600">SAR {platform.pending_amount.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3">Date</th>
                        <th className="text-left p-3">Platform</th>
                        <th className="text-left p-3">Period</th>
                        <th className="text-right p-3">Total Sales</th>
                        <th className="text-right p-3">Commission</th>
                        <th className="text-right p-3">Received</th>
                        <th className="text-left p-3">Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(payment => (
                        <tr key={payment.id} className="border-t hover:bg-muted/30">
                          <td className="p-3">{format(new Date(payment.payment_date), 'dd MMM yyyy')}</td>
                          <td className="p-3 font-medium">{payment.platform_name}</td>
                          <td className="p-3 text-muted-foreground text-xs">
                            {payment.period_start && payment.period_end 
                              ? `${format(new Date(payment.period_start), 'dd MMM')} - ${format(new Date(payment.period_end), 'dd MMM')}`
                              : '-'
                            }
                          </td>
                          <td className="p-3 text-right">SAR {(payment.total_sales || 0).toLocaleString()}</td>
                          <td className="p-3 text-right text-amber-600">SAR {(payment.commission_paid || 0).toLocaleString()}</td>
                          <td className="p-3 text-right font-bold text-emerald-600">SAR {(payment.amount_received || 0).toLocaleString()}</td>
                          <td className="p-3"><Badge variant="outline">{payment.payment_method}</Badge></td>
                        </tr>
                      ))}
                      {payments.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-muted-foreground">
                            No payments recorded yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add/Edit Platform Dialog */}
        <Dialog open={showPlatformForm} onOpenChange={setShowPlatformForm}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingPlatform ? 'Edit Platform' : 'Add Delivery Platform'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handlePlatformSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Platform Name *</Label>
                  <Input
                    value={platformForm.name}
                    onChange={(e) => setPlatformForm({...platformForm, name: e.target.value})}
                    placeholder="e.g., HungerStation"
                    required
                  />
                </div>
                <div>
                  <Label>Arabic Name</Label>
                  <Input
                    value={platformForm.name_ar}
                    onChange={(e) => setPlatformForm({...platformForm, name_ar: e.target.value})}
                    placeholder="e.g., هنقرستيشن"
                    dir="rtl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Commission Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={platformForm.commission_rate}
                    onChange={(e) => setPlatformForm({...platformForm, commission_rate: e.target.value})}
                    placeholder="e.g., 20"
                  />
                </div>
                <div>
                  <Label>Payment Terms</Label>
                  <Select
                    value={platformForm.payment_terms}
                    onValueChange={(val) => setPlatformForm({...platformForm, payment_terms: val})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Bi-weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={platformForm.notes}
                  onChange={(e) => setPlatformForm({...platformForm, notes: e.target.value})}
                  placeholder="Additional notes..."
                  rows={2}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowPlatformForm(false)}>Cancel</Button>
                <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
                  {editingPlatform ? 'Update' : 'Add'} Platform
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Record Payment Dialog */}
        <Dialog open={showPaymentForm} onOpenChange={setShowPaymentForm}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Record Platform Payment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div>
                <Label>Platform *</Label>
                <Select
                  value={paymentForm.platform_id}
                  onValueChange={(val) => setPaymentForm({...paymentForm, platform_id: val})}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select platform..." />
                  </SelectTrigger>
                  <SelectContent>
                    {platforms.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Payment Date</Label>
                  <Input
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm({...paymentForm, payment_date: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Period Start</Label>
                  <Input
                    type="date"
                    value={paymentForm.period_start}
                    onChange={(e) => setPaymentForm({...paymentForm, period_start: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Period End</Label>
                  <Input
                    type="date"
                    value={paymentForm.period_end}
                    onChange={(e) => setPaymentForm({...paymentForm, period_end: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Total Sales</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={paymentForm.total_sales}
                    onChange={(e) => setPaymentForm({...paymentForm, total_sales: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Commission Paid</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={paymentForm.commission_paid}
                    onChange={(e) => setPaymentForm({...paymentForm, commission_paid: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Amount Received *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={paymentForm.amount_received}
                    onChange={(e) => setPaymentForm({...paymentForm, amount_received: e.target.value})}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Payment Method</Label>
                  <Select
                    value={paymentForm.payment_method}
                    onValueChange={(val) => setPaymentForm({...paymentForm, payment_method: val})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Reference #</Label>
                  <Input
                    value={paymentForm.reference_number}
                    onChange={(e) => setPaymentForm({...paymentForm, reference_number: e.target.value})}
                    placeholder="Transfer ref..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowPaymentForm(false)}>Cancel</Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">Record Payment</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
