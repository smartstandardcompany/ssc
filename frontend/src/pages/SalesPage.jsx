import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, DollarSign, X, Truck, Store, TrendingUp, FileDown, CalendarDays, Building2, AlertTriangle, Copy, ChevronLeft, ChevronRight } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ExportButtons } from '@/components/ExportButtons';
import { AdvancedSearch, applySearchFilters } from '@/components/AdvancedSearch';
import { useBranchStore } from '@/stores';
import { VirtualizedTable } from '@/components/VirtualizedTable';
import { DateQuickFilter } from '@/components/DateQuickFilter';
import { HelpCircle } from 'lucide-react';
import { PDFExportButton } from '@/components/PDFExportButton';

export default function SalesPage() {
  const [sales, setSales] = useState([]);
  const { branches, fetchBranches } = useBranchStore();
  const [customers, setCustomers] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [receivingSale, setReceivingSale] = useState(null);
  const [activeTab, setActiveTab] = useState('branch');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [dateRange, setDateRange] = useState(null);
  const [expandedSalesDates, setExpandedSalesDates] = useState({});

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
  const [bankAccounts, setBankAccounts] = useState([]);

  const [receivePayment, setReceivePayment] = useState({ payment_mode: 'cash', amount: '' });
  const [searchFilters, setSearchFilters] = useState({});
  const [searchParams] = useSearchParams();
  const urlDateFilter = searchParams.get('date');
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateCount, setDuplicateCount] = useState(0);

  // When URL date param changes, auto-set the search filter 
  useEffect(() => {
    if (urlDateFilter) {
      setSearchFilters(prev => ({ ...prev, date: { start: urlDateFilter, end: urlDateFilter } }));
    }
  }, [urlDateFilter]);

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
  }, [dateRange]);

  const fetchData = async (page = 1) => {
    try {
      // Use Zustand for branches
      fetchBranches();
      let salesUrl = `/sales?page=${page}&limit=200`;
      if (dateRange) {
        salesUrl += `&start_date=${dateRange.start}&end_date=${dateRange.end}`;
      }
      const [salesRes, customersRes, platformsRes, bankAccRes] = await Promise.all([
        api.get(salesUrl),
        api.get('/customers'),
        api.get('/platforms').catch(() => ({ data: [] })),
        api.get('/bank-accounts').catch(() => ({ data: [] })),
      ]);
      const salesData = salesRes.data;
      setSales(salesData.data || salesData || []);
      setCurrentPage(salesData.page || 1);
      setTotalPages(salesData.pages || 1);
      setTotalRecords(salesData.total || 0);
      setCustomers(customersRes.data?.data || customersRes.data || []);
      setPlatforms(platformsRes.data || []);
      setBankAccounts(bankAccRes.data || []);
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

    // Check for duplicates before saving
    if (formData.branch_id && totals.total > 0) {
      try {
        const checkRes = await api.get(`/sales/check-duplicate?branch_id=${formData.branch_id}&amount=${totals.total}&date=${formData.date}`);
        if (checkRes.data?.has_duplicate) {
          setDuplicateCount(checkRes.data.count);
          setShowDuplicateWarning(true);
          return;
        }
      } catch { /* proceed if check fails */ }
    }

    await submitSale();
  };

  const submitSale = async () => {
    const totals = calculateTotals();
    const hasOnlinePayment = formData.payment_details.some(p => p.mode === 'online_platform' && parseFloat(p.amount) > 0);

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
        date: `${formData.date}T${new Date().toTimeString().slice(0,8)}`,
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
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
            <div>
              <div className="h-8 w-48 bg-stone-200 rounded-lg animate-pulse" />
              <div className="h-4 w-64 bg-stone-100 rounded mt-2 animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="p-3 rounded-xl border bg-stone-50 animate-pulse">
                <div className="h-3 w-16 bg-stone-200 rounded mb-2" />
                <div className="h-6 w-24 bg-stone-200 rounded" />
              </div>
            ))}
          </div>
          <div className="h-64 bg-stone-50 rounded-xl border animate-pulse" />
        </div>
      </DashboardLayout>
    );
  }

  const totals = calculateTotals();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Branch-wise Monthly Sales Summary */}
        <Card className="border-0 shadow-sm bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20 card-enter">
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
            <ExportButtons dataType="sales" />
            <PDFExportButton reportType="sales" label="Branded PDF" />
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
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="font-outfit">All Sales</CardTitle>
              <Button size="sm" variant="ghost" className="text-xs gap-1 text-muted-foreground"
                onClick={() => { Object.keys(localStorage).filter(k => k.includes('sales_tour')).forEach(k => localStorage.removeItem(k)); localStorage.setItem('ssc_sales_tour_enabled', 'true'); window.location.reload(); }}
                data-testid="sales-help-btn">
                <HelpCircle size={14} /> Tour
              </Button>
            </div>
            <DateQuickFilter onFilterChange={(range) => setDateRange(range)} className="mt-2" />
          </CardHeader>
          <CardContent>
            {urlDateFilter && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-orange-50 rounded-lg border border-orange-200" data-testid="date-filter-banner">
                <CalendarDays size={14} className="text-orange-600" />
                <span className="text-xs font-medium text-orange-700">Filtered by date: {urlDateFilter}</span>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-orange-600 hover:text-orange-800 ml-auto"
                  onClick={() => window.location.href = '/sales'} data-testid="clear-date-filter">
                  Clear filter
                </Button>
              </div>
            )}
            {/* Advanced Search */}
            <AdvancedSearch 
              onSearch={(f) => {
                if (urlDateFilter && !f.date) {
                  setSearchFilters({ ...f, date: { start: urlDateFilter, end: urlDateFilter } });
                } else {
                  setSearchFilters(f);
                }
              }}
              config={{
                searchFields: ['notes'],
                placeholder: 'Search sales by notes...',
                filters: [
                  { 
                    key: 'branch_id', 
                    label: 'Branch', 
                    type: 'select', 
                    options: branches.map(b => ({ value: b.id, label: b.name }))
                  },
                  { 
                    key: 'payment_mode', 
                    label: 'Payment Mode', 
                    type: 'select', 
                    options: [
                      { value: 'cash', label: 'Cash' },
                      { value: 'bank', label: 'Bank' },
                      { value: 'credit', label: 'Credit' },
                      { value: 'online_platform', label: 'Online' }
                    ]
                  },
                  { key: 'final_amount', label: 'Amount', type: 'range' },
                  { key: 'date', label: 'Date', type: 'dateRange' }
                ]
              }}
              className="mb-4"
            />
            {/* Grand Total Summary Bar */}
            {(() => {
              const allSales = applySearchFilters(sales.map(s => ({
                ...s, payment_mode: s.payment_details?.[0]?.mode || 'cash'
              })), searchFilters);
              const totals = allSales.reduce((acc, s) => {
                const fa = s.final_amount != null ? s.final_amount : (s.amount - (s.discount || 0));
                acc.total += fa;
                (s.payment_details || []).forEach(p => {
                  const mode = p.mode || 'cash';
                  const pAmt = p.amount || 0;
                  if (mode === 'cash') acc.cash += pAmt;
                  else if (mode === 'bank' || mode === 'card') acc.bank += pAmt;
                  else if (mode === 'credit') acc.credit += pAmt;
                  else if (mode === 'online' || mode === 'online_platform') acc.online += pAmt;
                });
                return acc;
              }, { total: 0, cash: 0, bank: 0, credit: 0, online: 0 });
              return (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4 mt-3" data-testid="sales-summary-bar">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-stone-50 to-stone-100 border border-stone-200 card-enter">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Grand Total</div>
                    <div className="text-lg font-bold text-stone-900">SAR {totals.total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                    <div className="text-[10px] text-muted-foreground">{allSales.length} sales</div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 card-enter">
                    <div className="text-[10px] text-emerald-600 uppercase tracking-wider">Cash</div>
                    <div className="text-lg font-bold text-emerald-700">SAR {totals.cash.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 card-enter">
                    <div className="text-[10px] text-blue-600 uppercase tracking-wider">Bank</div>
                    <div className="text-lg font-bold text-blue-700">SAR {totals.bank.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 card-enter">
                    <div className="text-[10px] text-purple-600 uppercase tracking-wider">Online</div>
                    <div className="text-lg font-bold text-purple-700">SAR {totals.online.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 card-enter">
                    <div className="text-[10px] text-amber-600 uppercase tracking-wider">Credit</div>
                    <div className="text-lg font-bold text-amber-700">SAR {totals.credit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                  </div>
                </div>
              );
            })()}
            {/* Sales Daily Grouped Table with Expandable Rows */}
            {(() => {
              const filteredSales = applySearchFilters(sales.map(s => ({
                ...s,
                payment_mode: s.payment_details?.[0]?.mode || 'cash'
              })), searchFilters);
              const grouped = {};
              filteredSales.forEach(sale => {
                const dateKey = sale.date ? format(new Date(sale.date), 'yyyy-MM-dd') : 'unknown';
                if (!grouped[dateKey]) {
                  grouped[dateKey] = { date: sale.date, dateKey, cash: 0, bank: 0, credit: 0, online: 0, total: 0, final: 0, branches: {}, count: 0, items: [] };
                }
                const g = grouped[dateKey];
                g.count++;
                g.items.push(sale);
                (sale.payment_details || []).forEach(p => {
                  const amt = p.amount || 0;
                  const mode = p.mode || 'cash';
                  if (mode === 'cash') g.cash += amt;
                  else if (mode === 'bank' || mode === 'card') g.bank += amt;
                  else if (mode === 'credit') g.credit += amt;
                  else if (mode === 'online' || mode === 'online_platform') g.online += amt;
                });
                const saleTotal = sale.final_amount != null ? sale.final_amount : (sale.amount - (sale.discount || 0));
                g.total += sale.amount || 0;
                g.final += saleTotal;
                const bName = branches.find(b => b.id === sale.branch_id)?.name || 'Other';
                g.branches[bName] = (g.branches[bName] || 0) + saleTotal;
              });
              const dailyData = Object.values(grouped).sort((a, b) => new Date(b.date) - new Date(a.date));

              // Detect duplicate entries per day (same branch + same amount)
              dailyData.forEach(day => {
                const dupeKeys = {};
                day.items.forEach(sale => {
                  const key = `${sale.branch_id || 'none'}_${(sale.final_amount || sale.amount || 0).toFixed(2)}`;
                  if (!dupeKeys[key]) dupeKeys[key] = [];
                  dupeKeys[key].push(sale.id);
                });
                const dupeIds = new Set();
                Object.values(dupeKeys).forEach(ids => {
                  if (ids.length > 1) ids.forEach(id => dupeIds.add(id));
                });
                day.duplicateIds = dupeIds;
                day.hasDuplicates = dupeIds.size > 0;
              });

              if (dailyData.length === 0) return <div className="text-center py-8 text-muted-foreground">No sales recorded yet. Add your first sale above!</div>;

              return (
                <div className="border rounded-lg overflow-hidden" data-testid="sales-daily-table">
                  <div className="bg-stone-50 dark:bg-stone-800">
                    <table className="w-full text-sm table-fixed">
                      <thead><tr>
                        <th className="px-3 py-3 text-left font-medium text-stone-600 w-[4%]"></th>
                        <th className="px-3 py-3 text-left font-medium text-stone-600 w-[14%]">Date</th>
                        <th className="px-3 py-3 text-right font-medium text-stone-600 w-[12%]">Total</th>
                        <th className="px-3 py-3 text-right font-medium text-stone-600 w-[12%]">Cash</th>
                        <th className="px-3 py-3 text-right font-medium text-stone-600 w-[12%]">Bank</th>
                        <th className="px-3 py-3 text-right font-medium text-stone-600 w-[12%]">Online</th>
                        <th className="px-3 py-3 text-right font-medium text-stone-600 w-[12%]">Credit</th>
                        <th className="px-3 py-3 text-left font-medium text-stone-600 w-[22%]">Branches</th>
                      </tr></thead>
                    </table>
                  </div>
                  <div className="max-h-[600px] overflow-y-auto">
                    {dailyData.map(day => (
                      <div key={day.dateKey}>
                        <table className="w-full text-sm table-fixed">
                          <tbody>
                            <tr className={`border-b hover:bg-stone-50 cursor-pointer transition-colors ${day.hasDuplicates ? 'bg-orange-50/60' : ''}`}
                              onClick={() => setExpandedSalesDates(prev => ({ ...prev, [day.dateKey]: !prev[day.dateKey] }))}
                              data-testid={`sales-day-row-${day.dateKey}`}>
                              <td className="px-3 py-3 w-[4%]">
                                {expandedSalesDates[day.dateKey]
                                  ? <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground"><polyline points="6 9 12 15 18 9"/></svg>
                                  : <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground"><polyline points="9 18 15 12 9 6"/></svg>
                                }
                              </td>
                              <td className="px-3 py-3 w-[14%]">
                                <div className="font-semibold text-sm flex items-center gap-1.5">
                                  {day.date ? format(new Date(day.date), 'MMM dd, yyyy') : '-'}
                                  {day.hasDuplicates && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 text-[10px] font-bold border border-orange-300" data-testid={`duplicate-warning-${day.dateKey}`}>
                                      <AlertTriangle size={10} /> Duplicate
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-muted-foreground">{day.count} entries</div>
                              </td>
                              <td className="px-3 py-3 text-right w-[12%]"><span className="text-sm font-bold text-primary">SAR {day.final.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></td>
                              <td className="px-3 py-3 text-right w-[12%]">{day.cash > 0 ? <span className="inline-block px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">SAR {day.cash.toLocaleString(undefined, {minimumFractionDigits: 2})}</span> : <span className="text-xs text-muted-foreground">-</span>}</td>
                              <td className="px-3 py-3 text-right w-[12%]">{day.bank > 0 ? <span className="inline-block px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200">SAR {day.bank.toLocaleString(undefined, {minimumFractionDigits: 2})}</span> : <span className="text-xs text-muted-foreground">-</span>}</td>
                              <td className="px-3 py-3 text-right w-[12%]">{day.online > 0 ? <span className="inline-block px-2 py-1 rounded bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-200">SAR {day.online.toLocaleString(undefined, {minimumFractionDigits: 2})}</span> : <span className="text-xs text-muted-foreground">-</span>}</td>
                              <td className="px-3 py-3 text-right w-[12%]">{day.credit > 0 ? <span className="inline-block px-2 py-1 rounded bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200">SAR {day.credit.toLocaleString(undefined, {minimumFractionDigits: 2})}</span> : <span className="text-xs text-muted-foreground">-</span>}</td>
                              <td className="px-3 py-3 w-[22%]">
                                <div className="flex gap-1 flex-wrap">
                                  {Object.entries(day.branches || {}).map(([name, amt]) => (
                                    <span key={name} className="text-[10px] px-1.5 py-0.5 bg-stone-100 text-stone-700 rounded border border-stone-200">{name}: {amt.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        {/* Expanded Individual Entries */}
                        {expandedSalesDates[day.dateKey] && (
                          <div className="bg-stone-50/50 border-b">
                            <table className="w-full text-sm">
                              <tbody>
                                {day.items.map(sale => {
                                  const remaining = (sale.credit_amount || 0) - (sale.credit_received || 0);
                                  const isDuplicate = day.duplicateIds.has(sale.id);
                                  return (
                                    <tr key={sale.id} className={`border-b border-stone-100 hover:bg-white/50 ${isDuplicate ? 'bg-orange-50/80 border-l-4 border-l-orange-400' : ''}`} data-testid={`sale-detail-${sale.id}`}>
                                      <td className="px-3 py-2 pl-10 w-[14%]">
                                        <div className="flex items-center gap-1">
                                          <Badge variant="secondary" className="capitalize text-[10px]">{sale.sale_type}</Badge>
                                          {isDuplicate && (
                                            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-orange-100 text-orange-700 text-[9px] font-bold border border-orange-300" data-testid={`duplicate-badge-${sale.id}`}>
                                              <Copy size={8} /> Possible duplicate
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-sm w-[14%]">{branches.find(b => b.id === sale.branch_id)?.name || '-'}</td>
                                      <td className="px-3 py-2 text-right font-bold text-sm w-[12%]">SAR {(sale.final_amount || sale.amount || 0).toFixed(2)}</td>
                                      <td className="px-3 py-2 w-[22%]">
                                        <div className="flex gap-1 flex-wrap">
                                          {(sale.payment_details || []).map((p, i) => (
                                            <span key={i} className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                              p.mode === 'cash' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                              p.mode === 'bank' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                              p.mode === 'online_platform' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                              'bg-amber-50 text-amber-700 border-amber-200'
                                            }`}>{p.mode}: {p.amount?.toFixed(0)}</span>
                                          ))}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-sm text-muted-foreground truncate w-[10%]">{sale.notes || '-'}</td>
                                      <td className="px-3 py-2 w-[8%]">
                                        {sale.created_by_name && <span className="text-[10px] text-muted-foreground" data-testid={`sale-created-by-${sale.id}`}>{sale.created_by_name}</span>}
                                      </td>
                                      <td className="px-3 py-2 text-right w-[12%]">
                                        <div className="flex gap-1 justify-end">
                                          {remaining > 0 && (
                                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setReceivingSale(sale); setShowReceiveDialog(true); }} className="h-7 px-2 text-xs" data-testid="receive-credit-button">
                                              <DollarSign size={12} className="mr-0.5" />Receive
                                            </Button>
                                          )}
                                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleDelete(sale.id); }} className="h-7 px-2 text-error hover:text-error" data-testid="delete-sale-button">
                                            <Trash2 size={12} />
                                          </Button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2.5 text-xs text-muted-foreground bg-stone-50/80 border-t flex items-center justify-between">
                    <span>Showing {filteredSales.length.toLocaleString()} sales across {dailyData.length} days</span>
                    <span className="text-[10px] text-stone-400">Click a day to expand & manage entries</span>
                  </div>
                </div>
              );
            })()}
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 px-2" data-testid="sales-pagination">
                <span className="text-xs text-muted-foreground">{totalRecords.toLocaleString()} total records</span>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" disabled={currentPage <= 1} className="h-8 w-8 p-0"
                    onClick={() => fetchData(currentPage - 1)} data-testid="sales-prev-page"><ChevronLeft size={14} /></Button>
                  {(() => {
                    const pages = [];
                    const maxVisible = 5;
                    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                    let end = Math.min(totalPages, start + maxVisible - 1);
                    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
                    if (start > 1) { pages.push(1); if (start > 2) pages.push('...'); }
                    for (let i = start; i <= end; i++) pages.push(i);
                    if (end < totalPages) { if (end < totalPages - 1) pages.push('...'); pages.push(totalPages); }
                    return pages.map((p, idx) => p === '...' ? (
                      <span key={`dots-${idx}`} className="text-xs text-muted-foreground px-1">...</span>
                    ) : (
                      <Button key={p} size="sm" variant={p === currentPage ? 'default' : 'outline'} className="h-8 w-8 p-0 text-xs"
                        onClick={() => fetchData(p)} data-testid={`sales-page-${p}`}>{p}</Button>
                    ));
                  })()}
                  <Button size="sm" variant="outline" disabled={currentPage >= totalPages} className="h-8 w-8 p-0"
                    onClick={() => fetchData(currentPage + 1)} data-testid="sales-next-page"><ChevronRight size={14} /></Button>
                </div>
              </div>
            )}
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

        {/* Duplicate Warning Dialog */}
        <AlertDialog open={showDuplicateWarning} onOpenChange={setShowDuplicateWarning}>
          <AlertDialogContent data-testid="duplicate-warning-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
                <AlertTriangle size={20} /> Possible Duplicate Entry
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm">
                <span className="font-bold text-orange-700">{duplicateCount}</span> sale(s) with the same branch and amount
                (<span className="font-bold">SAR {calculateTotals().total.toFixed(2)}</span>) already exist on{' '}
                <span className="font-bold">{formData.date}</span>.
                <br /><br />
                Are you sure this is <span className="font-bold">not a duplicate</span> entry?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="cancel-duplicate-btn">Cancel & Review</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setShowDuplicateWarning(false); submitSale(); }} className="bg-orange-600 hover:bg-orange-700" data-testid="confirm-duplicate-btn">
                Yes, Save Anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
