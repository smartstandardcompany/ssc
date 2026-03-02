import { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, DollarSign, X, Truck, Store, TrendingUp } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ExportButtons } from '@/components/ExportButtons';
import { DateFilter } from '@/components/DateFilter';
import { BranchFilter } from '@/components/BranchFilter';

export default function SalesPage() {
  const [sales, setSales] = useState([]);
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [receivingSale, setReceivingSale] = useState(null);
  const [activeTab, setActiveTab] = useState('branch');

  const [formData, setFormData] = useState({
    sale_type: 'branch',
    branch_id: '',
    customer_id: '',
    platform_id: '',
    payment_details: [{ mode: 'cash', amount: '' }],
    discount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [receivePayment, setReceivePayment] = useState({ payment_mode: 'cash', amount: '' });
  const [dateFilter, setDateFilter] = useState({ start: null, end: null, period: 'all' });
  const [branchFilter, setBranchFilter] = useState([]);

  // Calculate branch-wise monthly sales
  const branchMonthlySales = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    
    const monthlySales = sales.filter(s => {
      try {
        const saleDate = parseISO(s.date);
        return saleDate >= monthStart && saleDate <= monthEnd;
      } catch { return false; }
    });

    // Group by branch
    const byBranch = {};
    let totalOnline = 0;
    let totalAll = 0;

    monthlySales.forEach(sale => {
      const branchId = sale.branch_id;
      const branch = branches.find(b => b.id === branchId);
      const branchName = branch?.name || 'Unknown';
      
      if (!byBranch[branchName]) {
        byBranch[branchName] = { cash: 0, bank: 0, credit: 0, online: 0, total: 0 };
      }
      
      // Sum by payment mode
      (sale.payment_details || []).forEach(p => {
        const amt = p.amount || 0;
        if (p.mode === 'cash') byBranch[branchName].cash += amt;
        else if (p.mode === 'bank') byBranch[branchName].bank += amt;
        else if (p.mode === 'credit') byBranch[branchName].credit += amt;
        else if (p.mode === 'online_platform' || p.mode === 'online') {
          byBranch[branchName].online += amt;
          totalOnline += amt;
        }
      });
      
      byBranch[branchName].total += sale.amount || 0;
      totalAll += sale.amount || 0;
    });

    return { byBranch, totalOnline, totalAll, month: format(now, 'MMMM yyyy') };
  }, [sales, branches]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [salesRes, branchesRes, customersRes, platformsRes] = await Promise.all([
        api.get('/sales'),
        api.get('/branches'),
        api.get('/customers'),
        api.get('/platforms').catch(() => ({ data: [] })),
      ]);
      setSales(salesRes.data);
      setBranches(branchesRes.data);
      setCustomers(customersRes.data);
      setPlatforms(platformsRes.data || []);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const addPaymentRow = () => {
    setFormData({
      ...formData,
      payment_details: [...formData.payment_details, { mode: 'cash', amount: '' }]
    });
  };

  const removePaymentRow = (index) => {
    const newPayments = formData.payment_details.filter((_, i) => i !== index);
    setFormData({ ...formData, payment_details: newPayments });
  };

  const updatePaymentRow = (index, field, value) => {
    const newPayments = [...formData.payment_details];
    newPayments[index][field] = value;
    setFormData({ ...formData, payment_details: newPayments });
  };

  const calculateTotals = () => {
    let cash = 0, bank = 0, credit = 0, online = 0;
    
    formData.payment_details.forEach(p => {
      const amount = parseFloat(p.amount) || 0;
      if (p.mode === 'cash') cash += amount;
      else if (p.mode === 'bank') bank += amount;
      else if (p.mode === 'credit') credit += amount;
      else if (p.mode === 'online_platform') online += amount;
    });

    const subtotal = cash + bank + credit + online;
    const discount = parseFloat(formData.discount) || 0;
    const total = subtotal - discount;
    
    return { cash, bank, credit, online, subtotal, discount, total };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const totals = calculateTotals();
    
    if (totals.subtotal === 0) {
      toast.error('Please add at least one payment entry');
      return;
    }

    // If online platform payment, require platform selection
    const hasOnlinePayment = formData.payment_details.some(p => p.mode === 'online_platform' && parseFloat(p.amount) > 0);
    if (hasOnlinePayment && !formData.platform_id) {
      toast.error('Please select a delivery platform for online sales');
      return;
    }

    try {
      const payload = {
        ...formData,
        amount: totals.subtotal,
        discount: totals.discount,
        payment_mode: hasOnlinePayment ? 'online_platform' : (totals.credit > 0 ? 'credit' : (totals.bank > 0 ? 'bank' : 'cash')),
        platform_status: hasOnlinePayment ? 'pending' : undefined,
        payment_details: formData.payment_details
          .filter(p => parseFloat(p.amount) > 0)
          .map(p => ({
            mode: p.mode,
            amount: parseFloat(p.amount)
          })),
        date: new Date(formData.date).toISOString(),
      };

      await api.post('/sales', payload);
      toast.success('Sale added successfully');
      setShowForm(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add sale');
    }
  };

  const resetForm = () => {
    setFormData({
      sale_type: activeTab,
      branch_id: '',
      customer_id: '',
      platform_id: '',
      payment_details: [{ mode: 'cash', amount: '' }],
      discount: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this sale?')) {
      try {
        await api.delete(`/sales/${id}`);
        toast.success('Sale deleted successfully');
        fetchData();
      } catch (error) {
        toast.error('Failed to delete sale');
      }
    }
  };

  const handleReceiveCredit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/sales/${receivingSale.id}/receive-credit`, {
        payment_mode: receivePayment.payment_mode,
        amount: parseFloat(receivePayment.amount)
      });
      toast.success('Credit payment received');
      setShowReceiveDialog(false);
      setReceivePayment({ payment_mode: 'cash', amount: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to receive payment');
    }
  };

  const getRemainingCredit = (sale) => {
    return (sale.credit_amount || 0) - (sale.credit_received || 0);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">Loading...</div>
      </DashboardLayout>
    );
  }

  const totals = calculateTotals();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Branch-wise Monthly Sales Summary */}
        <Card className="border-0 shadow-sm bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-emerald-600" />
                <h3 className="font-semibold text-sm">{branchMonthlySales.month} - Branch Sales</h3>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total This Month</p>
                <p className="text-xl font-bold text-emerald-600">SAR {branchMonthlySales.totalAll.toLocaleString()}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {Object.entries(branchMonthlySales.byBranch).map(([branchName, data]) => (
                <div key={branchName} className="bg-white dark:bg-stone-800 rounded-xl p-3 border">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Store size={14} className="text-blue-500" />
                    <span className="text-xs font-medium truncate">{branchName}</span>
                  </div>
                  <p className="text-lg font-bold text-emerald-600">SAR {data.total.toLocaleString()}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {data.cash > 0 && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">Cash: {data.cash.toLocaleString()}</span>}
                    {data.bank > 0 && <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">Bank: {data.bank.toLocaleString()}</span>}
                    {data.credit > 0 && <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">Credit: {data.credit.toLocaleString()}</span>}
                    {data.online > 0 && <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">Online: {data.online.toLocaleString()}</span>}
                  </div>
                </div>
              ))}
              
              {/* Online Sales Total */}
              {branchMonthlySales.totalOnline > 0 && (
                <div className="bg-purple-50 dark:bg-purple-900/30 rounded-xl p-3 border border-purple-200">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Truck size={14} className="text-purple-500" />
                    <span className="text-xs font-medium">Online Total</span>
                  </div>
                  <p className="text-lg font-bold text-purple-600">SAR {branchMonthlySales.totalOnline.toLocaleString()}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit mb-1" data-testid="sales-page-title">Sales Management</h1>
            <p className="text-sm text-muted-foreground">Track sales with flexible payment options</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <BranchFilter onChange={setBranchFilter} />
            <DateFilter onFilterChange={setDateFilter} />
            <ExportButtons dataType="sales" />
            <Button
            onClick={() => setShowForm(!showForm)}
            data-testid="add-sale-button"
            className="rounded-full"
            size="sm"
          >
            <Plus size={16} className="mr-1" />
            Add Sale
          </Button>
          </div>
        </div>

        {showForm && (
          <Card className="border-border" data-testid="sale-form-card">
            <CardHeader>
              <CardTitle className="font-outfit">Add New Sale</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(val) => { 
                setActiveTab(val); 
                // When switching to online, preset the payment mode to online_platform
                if (val === 'online') {
                  setFormData({ ...formData, sale_type: val, payment_details: [{ mode: 'online_platform', amount: '' }] });
                } else {
                  setFormData({ ...formData, sale_type: val, payment_details: [{ mode: 'cash', amount: '' }] });
                }
              }}>
                <TabsList className="mb-6">
                  <TabsTrigger value="branch" data-testid="branch-sale-tab">Branch Sale</TabsTrigger>
                  <TabsTrigger value="online" data-testid="online-sale-tab" className="bg-purple-100 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                    <Truck size={14} className="mr-1" /> Online Sale
                  </TabsTrigger>
                </TabsList>

                <form onSubmit={handleSubmit}>
                  <div className="space-y-6">
                    {/* Online Platform Selection - Show first for online sales */}
                    <TabsContent value="online" className="mt-0 space-y-4">
                      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-700">
                        <Label className="text-purple-700 dark:text-purple-300 mb-3 block text-sm font-medium">
                          <Truck size={16} className="inline mr-2" />
                          Select Delivery Platform *
                        </Label>
                        <div className="flex gap-2 flex-wrap">
                          {platforms.filter(p => p.is_active !== false).map((platform, i) => {
                            const colors = ['bg-red-100 border-red-300 text-red-700', 'bg-green-100 border-green-300 text-green-700', 'bg-blue-100 border-blue-300 text-blue-700', 'bg-yellow-100 border-yellow-300 text-yellow-700', 'bg-pink-100 border-pink-300 text-pink-700'];
                            return (
                              <button key={platform.id} type="button" onClick={() => setFormData({...formData, platform_id: platform.id})}
                                className={`px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${colors[i % colors.length]} ${formData.platform_id === platform.id ? 'ring-2 ring-purple-500 ring-offset-1 scale-105 shadow-md' : 'opacity-80 hover:opacity-100 hover:scale-105'}`}>
                                {platform.name}
                                {platform.commission_rate > 0 && <span className="text-xs ml-1 opacity-70">({platform.commission_rate}%)</span>}
                              </button>
                            );
                          })}
                        </div>
                        {platforms.length === 0 && (
                          <p className="text-sm text-purple-600 mt-2">
                            No platforms configured. <a href="/platforms" className="underline">Add platforms</a> first.
                          </p>
                        )}
                      </div>
                    </TabsContent>

                    {/* Branch Selection - Color Coded */}
                    <div>
                      <Label>Branch *</Label>
                      <div className="flex gap-2 flex-wrap mt-2">
                        {branches.map((branch, i) => {
                          const colors = ['bg-orange-100 border-orange-300 text-orange-700', 'bg-green-100 border-green-300 text-green-700', 'bg-blue-100 border-blue-300 text-blue-700', 'bg-purple-100 border-purple-300 text-purple-700', 'bg-cyan-100 border-cyan-300 text-cyan-700'];
                          return (
                            <button key={branch.id} type="button" onClick={() => setFormData({...formData, branch_id: branch.id})}
                              className={`px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${colors[i % colors.length]} ${formData.branch_id === branch.id ? 'ring-2 ring-primary ring-offset-1 scale-105 shadow-md' : 'opacity-80 hover:opacity-100 hover:scale-105'}`}>
                              {branch.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Customer Selection for Online Sales */}
                    <TabsContent value="online" className="mt-0">
                      <div>
                        <Label>Customer (Optional - for credit)</Label>
                        <div className="flex gap-2 flex-wrap mt-2">
                          <button type="button" onClick={() => setFormData({...formData, customer_id: ''})}
                            className={`px-3 py-1.5 rounded-xl border-2 text-xs font-medium transition-all bg-stone-100 border-stone-300 text-stone-700 ${!formData.customer_id ? 'ring-2 ring-primary ring-offset-1' : 'opacity-80 hover:opacity-100'}`}>
                            Walk-in
                          </button>
                          {customers.map((customer, i) => {
                            const colors = ['bg-amber-100 border-amber-300 text-amber-700', 'bg-teal-100 border-teal-300 text-teal-700', 'bg-rose-100 border-rose-300 text-rose-700', 'bg-indigo-100 border-indigo-300 text-indigo-700', 'bg-lime-100 border-lime-300 text-lime-700'];
                            return (
                              <button key={customer.id} type="button" onClick={() => setFormData({...formData, customer_id: customer.id})}
                                className={`px-3 py-1.5 rounded-xl border-2 text-xs font-medium transition-all ${colors[i % colors.length]} ${formData.customer_id === customer.id ? 'ring-2 ring-primary ring-offset-1 scale-105 shadow-md' : 'opacity-80 hover:opacity-100 hover:scale-105'}`}>
                                {customer.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </TabsContent>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Date *</Label>
                        <Input
                          type="date"
                          data-testid="date-input"
                          value={formData.date}
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <Label>Payment Details *</Label>
                        <Button type="button" size="sm" variant="outline" onClick={addPaymentRow} className="rounded-full">
                          <Plus size={14} className="mr-1" />
                          Add Payment
                        </Button>
                      </div>
                      <div className="space-y-3 border rounded-lg p-4 bg-secondary/30">
                        {formData.payment_details.map((payment, index) => (
                          <div key={index} className="flex gap-3 items-end">
                            <div className="flex-1">
                              <Label className="text-xs">Mode</Label>
                              <Select
                                value={payment.mode}
                                onValueChange={(val) => updatePaymentRow(index, 'mode', val)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="cash">Cash</SelectItem>
                                  <SelectItem value="bank">Bank</SelectItem>
                                  <SelectItem value="credit">Credit (Customer)</SelectItem>
                                  <SelectItem value="online_platform">Online Platform</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex-1">
                              <Label className="text-xs">Amount</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={payment.amount}
                                onChange={(e) => updatePaymentRow(index, 'amount', e.target.value)}
                                placeholder="0.00"
                              />
                            </div>
                            {formData.payment_details.length > 1 && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => removePaymentRow(index)}
                                className="text-error"
                              >
                                <X size={16} />
                              </Button>
                            )}
                          </div>
                        ))}
                        
                        <div className="pt-3 border-t space-y-2">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            <div className="p-2 bg-cash/10 rounded border border-cash/30">
                              <div className="text-xs text-muted-foreground">Cash</div>
                              <div className="font-bold text-cash"> SAR {totals.cash.toFixed(2)}</div>
                            </div>
                            <div className="p-2 bg-bank/10 rounded border border-bank/30">
                              <div className="text-xs text-muted-foreground">Bank</div>
                              <div className="font-bold text-bank"> SAR {totals.bank.toFixed(2)}</div>
                            </div>
                            <div className="p-2 bg-credit/10 rounded border border-credit/30">
                              <div className="text-xs text-muted-foreground">Credit</div>
                              <div className="font-bold text-credit"> SAR {totals.credit.toFixed(2)}</div>
                            </div>
                            <div className="p-2 bg-purple-500/10 rounded border border-purple-500/30">
                              <div className="text-xs text-muted-foreground flex items-center gap-1"><Truck size={12} />Online</div>
                              <div className="font-bold text-purple-600"> SAR {totals.online.toFixed(2)}</div>
                            </div>
                          </div>
                          
                          {/* Platform Selector - show when online payment selected */}
                          {totals.online > 0 && (
                            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                              <Label className="text-sm text-purple-700 dark:text-purple-300 mb-2 block">
                                <Truck size={14} className="inline mr-1" />
                                Select Delivery Platform *
                              </Label>
                              <Select
                                value={formData.platform_id}
                                onValueChange={(val) => setFormData({...formData, platform_id: val})}
                              >
                                <SelectTrigger className="bg-white dark:bg-stone-900">
                                  <SelectValue placeholder="Choose platform..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {platforms.filter(p => p.is_active !== false).map(platform => (
                                    <SelectItem key={platform.id} value={platform.id}>
                                      {platform.name} {platform.commission_rate > 0 && `(${platform.commission_rate}% commission)`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {platforms.length === 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  No platforms configured. Go to Settings → Platforms to add.
                                </p>
                              )}
                            </div>
                          )}
                          
                          <div className="space-y-2 pt-2 border-t">
                            <div className="flex justify-between text-sm">
                              <span>Subtotal:</span>
                              <span className="font-medium"> SAR {totals.subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">Discount:</span>
                              <Input
                                type="number"
                                step="0.01"
                                value={formData.discount}
                                onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                                placeholder="0.00"
                                className="h-8 max-w-[120px]"
                                data-testid="discount-input"
                              />
                            </div>
                            <div className="flex justify-between text-lg font-bold pt-2 border-t">
                              <span>Final Amount:</span>
                              <span className="text-primary"> SAR {totals.total.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label>Notes</Label>
                      <Textarea
                        data-testid="notes-input"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Optional notes"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <Button type="submit" data-testid="submit-sale-button" className="rounded-full">Add Sale</Button>
                    <Button type="button" variant="outline" onClick={() => { setShowForm(false); resetForm(); }} className="rounded-full">
                      Cancel
                    </Button>
                  </div>
                </form>
              </Tabs>
            </CardContent>
          </Card>
        )}

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-outfit">All Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="sales-table">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-medium text-sm">Date</th>
                    <th className="text-left p-3 font-medium text-sm">Type</th>
                    <th className="text-left p-3 font-medium text-sm">Branch</th>
                    <th className="text-left p-3 font-medium text-sm">Customer</th>
                    <th className="text-right p-3 font-medium text-sm">Amount</th>
                    <th className="text-right p-3 font-medium text-sm">Discount</th>
                    <th className="text-right p-3 font-medium text-sm">Final</th>
                    <th className="text-left p-3 font-medium text-sm">Payment</th>
                    <th className="text-left p-3 font-medium text-sm">Credit</th>
                    <th className="text-right p-3 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.filter(s => {
                    if (branchFilter.length > 0 && !branchFilter.includes(s.branch_id)) return false;
                    if (dateFilter.start && dateFilter.end) {
                      const d = new Date(s.date);
                      return d >= dateFilter.start && d <= dateFilter.end;
                    }
                    return true;
                  }).map((sale) => {
                    const branchName = branches.find((b) => b.id === sale.branch_id)?.name || '-';
                    const customerName = customers.find((c) => c.id === sale.customer_id)?.name || '-';
                    const remainingCredit = getRemainingCredit(sale);
                    const discount = sale.discount || 0;
                    const finalAmount = sale.final_amount || (sale.amount - discount);
                    
                    return (
                      <tr key={sale.id} className="border-b border-border hover:bg-secondary/50" data-testid="sale-row">
                        <td className="p-3 text-sm">{format(new Date(sale.date), 'MMM dd, yyyy')}</td>
                        <td className="p-3 text-sm capitalize">{sale.sale_type}</td>
                        <td className="p-3 text-sm">{branchName}</td>
                        <td className="p-3 text-sm">{sale.sale_type === 'online' ? customerName : '-'}</td>
                        <td className="p-3 text-sm text-right font-medium"> SAR {sale.amount.toFixed(2)}</td>
                        <td className="p-3 text-sm text-right text-error">
                          {discount > 0 ? `-SAR ${discount.toFixed(2)}` : '-'}
                        </td>
                        <td className="p-3 text-sm text-right font-bold text-primary"> SAR {finalAmount.toFixed(2)}</td>
                        <td className="p-3">
                          <div className="flex gap-1 flex-wrap">
                            {sale.payment_details?.map((p, i) => (
                              <span key={i} className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${
                                p.mode === 'cash' ? 'bg-cash/20 text-cash border-cash/30' : 
                                p.mode === 'bank' ? 'bg-bank/20 text-bank border-bank/30' :
                                'bg-credit/20 text-credit border-credit/30'
                              }`}>
                                {p.mode}: SAR {p.amount.toFixed(2)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3">
                          {remainingCredit > 0 ? (
                            <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-credit/20 text-credit border border-credit/30">
                              SAR {remainingCredit.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex gap-2 justify-end">
                            {remainingCredit > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setReceivingSale(sale); setShowReceiveDialog(true); }}
                                data-testid="receive-credit-button"
                                className="h-8"
                              >
                                <DollarSign size={14} className="mr-1" />
                                Receive
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(sale.id)}
                              data-testid="delete-sale-button"
                              className="h-8 text-error hover:text-error"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {sales.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-muted-foreground">
                        No sales recorded yet. Add your first sale above!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Receive Credit Dialog */}
        <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
          <DialogContent data-testid="receive-credit-dialog">
            <DialogHeader>
              <DialogTitle className="font-outfit">Receive Credit Payment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleReceiveCredit} className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Sale Amount: <span className="font-medium text-foreground"> SAR {receivingSale?.amount?.toFixed(2)}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Remaining Credit: <span className="font-bold text-credit"> SAR {getRemainingCredit(receivingSale || {}).toFixed(2)}</span>
                </p>
              </div>
              <div>
                <Label>Payment Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={receivePayment.amount}
                  data-testid="receive-amount-input"
                  onChange={(e) => setReceivePayment({ ...receivePayment, amount: e.target.value })}
                  required
                  max={getRemainingCredit(receivingSale || {})}
                />
              </div>
              <div>
                <Label>Payment Mode *</Label>
                <Select value={receivePayment.payment_mode} onValueChange={(val) => setReceivePayment({ ...receivePayment, payment_mode: val })}>
                  <SelectTrigger data-testid="receive-mode-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <Button type="submit" data-testid="submit-receive-button" className="rounded-full">Receive Payment</Button>
                <Button type="button" variant="outline" onClick={() => setShowReceiveDialog(false)} className="rounded-full">
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
