import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, AlertTriangle, DollarSign, Settings2, MessageCircle, FileDown, RotateCcw, CalendarDays, ChevronDown, ChevronRight, HelpCircle, Copy, Store, TrendingDown, ChevronLeft } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ExportButtons } from '@/components/ExportButtons';
import { WhatsAppSendDialog } from '@/components/WhatsAppSendDialog';
import { AdvancedSearch, applySearchFilters } from '@/components/AdvancedSearch';
import { useBranchStore, useAuthStore } from '@/stores';
import { VirtualizedTable } from '@/components/VirtualizedTable';
import { PDFExportButton } from '@/components/PDFExportButton';
import { DateQuickFilter } from '@/components/DateQuickFilter';
import { SearchableSelect } from '@/components/SearchableSelect';

export default function ExpensesPage() {
  const { t } = useLanguage();
  const [expenses, setExpenses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const { branches, fetchBranches } = useBranchStore();
  const { user } = useAuthStore();
  const [categories, setCategories] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [recurringExpenses, setRecurringExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchFilters, setSearchFilters] = useState({});
  const [searchParams] = useSearchParams();
  const urlDateFilter = searchParams.get('date');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [expandedDates, setExpandedDates] = useState({});
  const [dateRange, setDateRange] = useState(null);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [activeBackendFilters, setActiveBackendFilters] = useState({});

  useEffect(() => {
    if (urlDateFilter) {
      setSearchFilters(prev => ({ ...prev, date: { start: urlDateFilter, end: urlDateFilter } }));
    }
  }, [urlDateFilter]);
  const [showCatManager, setShowCatManager] = useState(false);
  const [showRenewDialog, setShowRenewDialog] = useState(false);
  const [renewingRec, setRenewingRec] = useState(null);
  const [renewData, setRenewData] = useState({ amount: '', payment_mode: 'cash', branch_id: '' });
  const [newCat, setNewCat] = useState('');
  const [newSubCat, setNewSubCat] = useState({ name: '', parent: '' });
  const [newRecData, setNewRecData] = useState({ name: '', category: 'rent', amount: '', frequency: 'monthly', branch_id: '', next_due_date: '', alert_days: 7 });
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [refundData, setRefundData] = useState({ amount: '', reason: '', refund_mode: 'cash', category: 'Refund', branch_id: '', date: new Date().toISOString().split('T')[0] });

  const [formData, setFormData] = useState({
    category: '', sub_category: '', description: '', amount: '',
    payment_mode: 'cash', branch_id: '', expense_for_branch_id: '', supplier_id: '', employee_id: '',
    date: new Date().toISOString().split('T')[0], notes: '', bill_image_url: ''
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  // Calculate branch-wise monthly expenses (like Sales page)
  const branchMonthlyExpenses = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    
    const monthlyExps = expenses.filter(e => {
      try {
        const expDate = parseISO(typeof e.date === 'string' ? e.date : e.date?.toISOString?.() || '');
        return expDate >= monthStart && expDate <= monthEnd;
      } catch { return false; }
    });

    const byBranch = {};
    let totalAll = 0;

    monthlyExps.forEach(exp => {
      const branchId = exp.branch_id;
      const branch = branches.find(b => b.id === branchId);
      const branchName = branch?.name || 'Unassigned';
      
      if (!byBranch[branchName]) {
        byBranch[branchName] = { cash: 0, bank: 0, credit: 0, total: 0 };
      }
      
      const amt = exp.amount || 0;
      if (exp.payment_mode === 'cash') byBranch[branchName].cash += amt;
      else if (exp.payment_mode === 'bank') byBranch[branchName].bank += amt;
      else if (exp.payment_mode === 'credit') byBranch[branchName].credit += amt;
      
      byBranch[branchName].total += amt;
      totalAll += amt;
    });

    return { byBranch, totalAll, month: format(now, 'MMMM yyyy') };
  }, [expenses, branches]);

  // Category translation helper
  const catMap = {
    'Salary': 'cat_salary', 'Rent': 'cat_rent', 'Utilities': 'cat_utilities', 'Vehicle': 'cat_vehicle',
    'Maintenance': 'cat_maintenance', 'Supplier': 'cat_supplier', 'Tickets': 'cat_tickets',
    'ID Card': 'cat_id_card', 'Other': 'cat_other',
    'Basic Salary': 'cat_basic_salary', 'Overtime': 'cat_overtime', 'Bonus': 'cat_bonus',
    'Office Rent': 'cat_office_rent', 'Warehouse Rent': 'cat_warehouse_rent', 'Shop Rent': 'cat_shop_rent',
    'Electricity': 'cat_electricity', 'Water': 'cat_water', 'Internet': 'cat_internet', 'Phone': 'cat_phone',
    'Fuel': 'cat_fuel', 'Insurance': 'cat_insurance', 'Office Maintenance': 'cat_office_maintenance',
    'Equipment Repair': 'cat_equipment_repair'
  };
  const tc = (cat) => t(catMap[cat]) || cat;

  const defaultCats = [
    { name: 'Salary', subs: ['Basic Salary', 'Overtime', 'Bonus'] },
    { name: 'Rent', subs: ['Office Rent', 'Warehouse Rent', 'Shop Rent'] },
    { name: 'Utilities', subs: ['Electricity', 'Water', 'Internet', 'Phone'] },
    { name: 'Vehicle', subs: ['Fuel', 'Maintenance', 'Insurance'] },
    { name: 'Maintenance', subs: ['Office Maintenance', 'Equipment Repair'] },
    { name: 'Supplier', subs: [] },
    { name: 'Tickets', subs: [] },
    { name: 'ID Card', subs: [] },
    { name: 'Other', subs: [] },
  ];

  useEffect(() => { fetchData(); }, [dateRange, activeBackendFilters]);

  const fetchData = async (page = 1) => {
    try {
      // Use Zustand for branches
      fetchBranches();
      let expUrl = `/expenses?page=${page}&limit=200`;
      if (dateRange) {
        expUrl += `&start_date=${dateRange.start}&end_date=${dateRange.end}`;
      }
      if (activeBackendFilters.branch_id) {
        expUrl += `&branch_id=${activeBackendFilters.branch_id}`;
      }
      if (activeBackendFilters.category) {
        expUrl += `&category=${encodeURIComponent(activeBackendFilters.category)}`;
      }
      if (activeBackendFilters.payment_mode) {
        expUrl += `&payment_mode=${activeBackendFilters.payment_mode}`;
      }
      const [eR, sR, cR, rR, empR] = await Promise.all([api.get(expUrl), api.get('/suppliers'), api.get('/categories?category_type=expense'), api.get('/recurring-expenses'), api.get('/employees').catch(() => ({ data: [] }))]);
      const expData = eR.data;
      setExpenses(expData.data || expData || []);
      setCurrentPage(expData.page || 1);
      setTotalPages(expData.pages || 1);
      setTotalRecords(expData.total || 0);
      setSuppliers(sR.data); setCategories(cR.data); setRecurringExpenses(rR.data);
      setEmployees(Array.isArray(empR.data) ? empR.data : []);
    } catch { toast.error('Failed'); } finally { setLoading(false); }
  };

  // Build category tree
  const mainCats = [...defaultCats.map(c => c.name), ...categories.filter(c => !c.parent_id).map(c => c.name)].filter((v, i, a) => a.indexOf(v) === i);
  const getSubCats = (mainCat) => {
    const defaultSubs = defaultCats.find(c => c.name === mainCat)?.subs || [];
    const customSubs = categories.filter(c => c.parent_id).filter(c => {
      const parent = categories.find(p => p.id === c.parent_id);
      return parent?.name === mainCat;
    }).map(c => c.name);
    return [...defaultSubs, ...customSubs].filter((v, i, a) => a.indexOf(v) === i);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.category || !formData.amount) { toast.error('Select category and amount'); return; }

    // Check for duplicates before saving
    const amt = parseFloat(formData.amount);
    if (formData.branch_id && amt > 0) {
      try {
        const checkRes = await api.get(`/expenses/check-duplicate?branch_id=${formData.branch_id}&amount=${amt}&date=${formData.date}&category=${encodeURIComponent(formData.sub_category || formData.category)}`);
        if (checkRes.data?.has_duplicate) {
          setDuplicateCount(checkRes.data.count);
          setShowDuplicateWarning(true);
          return;
        }
      } catch { /* proceed if check fails */ }
    }

    await submitExpense();
  };

  const submitExpense = async () => {
    try {
      // Auto-add employee name to description for employee-related expenses
      let description = formData.description || '';
      if (formData.employee_id && ['Salary', 'Tickets', 'ID Card'].includes(formData.category)) {
        const emp = employees.find(e => e.id === formData.employee_id);
        if (emp && !description.toLowerCase().includes(emp.name.toLowerCase())) {
          description = description ? `${emp.name} - ${description}` : emp.name;
        }
      }
      await api.post('/expenses', {
        ...formData, description,
        category: formData.sub_category || formData.category,
        sub_category: formData.sub_category ? formData.category : null,
        amount: parseFloat(formData.amount),
        branch_id: formData.branch_id || null, supplier_id: formData.supplier_id || null,
        expense_for_branch_id: formData.expense_for_branch_id || null,
        date: `${formData.date}T${new Date().toTimeString().slice(0,8)}`,
        notes: formData.employee_id ? `Employee: ${employees.find(e => e.id === formData.employee_id)?.name || ''}` : formData.notes,
      });
      toast.success('Expense added');
      setFormData({ category: '', sub_category: '', description: '', amount: '', payment_mode: 'cash', branch_id: '', expense_for_branch_id: '', supplier_id: '', employee_id: '', date: new Date().toISOString().split('T')[0], notes: '' });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleAddCat = async () => {
    if (!newCat.trim()) return;
    try { await api.post('/categories', { name: newCat.trim(), type: 'expense' }); toast.success('Category added'); setNewCat(''); fetchData(); }
    catch { toast.error('Failed'); }
  };

  const handleAddSubCat = async () => {
    if (!newSubCat.name.trim() || !newSubCat.parent) return;
    const parent = categories.find(c => c.name === newSubCat.parent && !c.parent_id);
    try { await api.post('/categories', { name: newSubCat.name.trim(), type: 'expense', parent_id: parent?.id || null }); toast.success('Sub-category added'); setNewSubCat({ name: '', parent: '' }); fetchData(); }
    catch { toast.error('Failed'); }
  };

  const handleRefundSubmit = async (e) => {
    e.preventDefault();
    if (!refundData.amount || parseFloat(refundData.amount) <= 0) { toast.error('Enter a valid refund amount'); return; }
    try {
      await api.post('/expense-refunds', {
        ...refundData,
        amount: parseFloat(refundData.amount),
        date: `${refundData.date}T${new Date().toTimeString().slice(0,8)}`,
      });
      toast.success(`Refund of SAR ${refundData.amount} recorded`);
      setShowRefundDialog(false);
      setRefundData({ amount: '', reason: '', refund_mode: 'cash', category: 'Refund', branch_id: '', date: new Date().toISOString().split('T')[0] });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  const filtered = applySearchFilters(expenses, searchFilters);
  const totalExp = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Branch-wise Monthly Expenses Summary */}
        <Card className="border-0 shadow-sm bg-gradient-to-r from-red-50 to-amber-50 dark:from-red-900/20 dark:to-amber-900/20 card-enter" data-testid="expenses-branch-summary">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingDown size={18} className="text-red-600" />
                <h3 className="font-semibold text-sm">{branchMonthlyExpenses.month} - Branch Expenses</h3>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total This Month</p>
                <p className="text-xl font-bold text-red-600">SAR {branchMonthlyExpenses.totalAll.toLocaleString()}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {Object.entries(branchMonthlyExpenses.byBranch).map(([branchName, data]) => (
                <div key={branchName} className="bg-white dark:bg-stone-800 rounded-xl p-3 border">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Store size={14} className="text-red-500" />
                    <span className="text-xs font-medium truncate">{branchName}</span>
                  </div>
                  <p className="text-lg font-bold text-red-600">SAR {data.total.toLocaleString()}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {data.cash > 0 && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">Cash: {data.cash.toLocaleString()}</span>}
                    {data.bank > 0 && <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">Bank: {data.bank.toLocaleString()}</span>}
                    {data.credit > 0 && <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">Credit: {data.credit.toLocaleString()}</span>}
                  </div>
                </div>
              ))}
              {Object.keys(branchMonthlyExpenses.byBranch).length === 0 && (
                <div className="col-span-full text-center py-3 text-sm text-muted-foreground">No expenses recorded this month</div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit mb-1">{t('expenses_title')}</h1>
            <p className="text-sm text-muted-foreground">{t('expenses_subtitle')}</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <ExportButtons dataType="expenses" />
            <PDFExportButton reportType="expenses" label="Branded PDF" />
            <Button size="sm" variant="outline" className="rounded-xl text-red-600 border-red-200 hover:bg-red-50" onClick={() => setShowRefundDialog(true)} data-testid="add-refund-btn"><RotateCcw size={14} className="mr-1" />Refund</Button>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowWhatsApp(true)} data-testid="expenses-whatsapp-btn"><MessageCircle size={14} className="mr-1" />WhatsApp</Button>
            {isAdmin && <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowCatManager(true)}><Settings2 size={14} className="mr-1" />{t('category')}</Button>}
            <Button size="sm" variant="ghost" className="text-xs gap-1 text-muted-foreground"
              onClick={() => { Object.keys(localStorage).filter(k => k.includes('expenses_tour')).forEach(k => localStorage.removeItem(k)); localStorage.setItem('ssc_expenses_tour_enabled', 'true'); window.location.reload(); }}
              data-testid="expenses-help-btn">
              <HelpCircle size={14} /> Tour
            </Button>
          </div>
        </div>

        {/* Date Quick Filter */}
        <DateQuickFilter onFilterChange={(range) => setDateRange(range)} />

        {urlDateFilter && (
          <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-orange-50 rounded-lg border border-orange-200" data-testid="date-filter-banner">
            <CalendarDays size={14} className="text-orange-600" />
            <span className="text-xs font-medium text-orange-700">Filtered by date: {urlDateFilter}</span>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-orange-600 hover:text-orange-800 ml-auto"
              onClick={() => window.location.href = '/expenses'} data-testid="clear-date-filter">
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
            // Pass server-filterable fields to backend
            const newBackendFilters = {};
            if (f.branch_id && f.branch_id !== 'all') newBackendFilters.branch_id = f.branch_id;
            if (f.category && f.category !== 'all') newBackendFilters.category = f.category;
            if (f.payment_mode && f.payment_mode !== 'all') newBackendFilters.payment_mode = f.payment_mode;
            setActiveBackendFilters(newBackendFilters);
          }}
          config={{
            searchFields: ['description', 'notes'],
            placeholder: 'Search expenses...',
            filters: [
              { 
                key: 'branch_id', 
                label: 'Branch', 
                type: 'select', 
                options: branches.map(b => ({ value: b.id, label: b.name }))
              },
              { 
                key: 'category', 
                label: 'Category', 
                type: 'select', 
                options: mainCats.map(c => ({ value: c, label: tc(c) }))
              },
              { 
                key: 'payment_mode', 
                label: 'Payment', 
                type: 'select', 
                options: [
                  { value: 'cash', label: 'Cash' },
                  { value: 'bank', label: 'Bank' },
                  { value: 'credit', label: 'Credit' }
                ]
              },
              { key: 'amount', label: 'Amount', type: 'range' },
              { key: 'date', label: 'Date', type: 'dateRange' }
            ]
          }}
        />

        <Tabs defaultValue={urlDateFilter ? "list" : "add"}>
          <TabsList><TabsTrigger value="add">{t('add_expense')}</TabsTrigger><TabsTrigger value="list">{t('all_expenses')} ({filtered.length})</TabsTrigger><TabsTrigger value="recurring">Recurring</TabsTrigger></TabsList>

          {/* ADD EXPENSE - Simplified */}
          <TabsContent value="add">
            <Card className="border-stone-100">
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>{t('category')} *</Label>
                    <div className="flex gap-2 flex-wrap mt-2">
                      {mainCats.map((c, i) => {
                        const colors = ['bg-orange-100 border-orange-300 text-orange-700', 'bg-green-100 border-green-300 text-green-700', 'bg-blue-100 border-blue-300 text-blue-700', 'bg-purple-100 border-purple-300 text-purple-700', 'bg-red-100 border-red-300 text-red-700', 'bg-cyan-100 border-cyan-300 text-cyan-700', 'bg-amber-100 border-amber-300 text-amber-700', 'bg-pink-100 border-pink-300 text-pink-700', 'bg-stone-100 border-stone-300 text-stone-700'];
                        return (
                          <button key={c} type="button" onClick={() => setFormData({...formData, category: c, sub_category: ''})}
                            className={`px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${colors[i % colors.length]} ${formData.category === c ? 'ring-2 ring-primary ring-offset-1 scale-105 shadow-md' : 'opacity-80 hover:opacity-100 hover:scale-105'}`}>
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {formData.category && getSubCats(formData.category).length > 0 && (
                    <div>
                      <Label>Sub-Category</Label>
                      <div className="flex gap-2 flex-wrap mt-2">
                        <button type="button" onClick={() => setFormData({...formData, sub_category: ''})}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${!formData.sub_category ? 'bg-primary text-white' : 'bg-stone-50 border-stone-200 hover:bg-stone-100'}`}>General</button>
                        {getSubCats(formData.category).map(s => (
                          <button key={s} type="button" onClick={() => setFormData({...formData, sub_category: s})}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${formData.sub_category === s ? 'bg-primary text-white' : 'bg-stone-50 border-stone-200 hover:bg-stone-100'}`}>{s}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label>{t('amount')} *</Label>
                      <Input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="SAR 0.00" className="h-10" required />
                    </div>
                    <div>
                      <Label>{t('payment_mode')}</Label>
                      <Select value={formData.payment_mode} onValueChange={(v) => setFormData({ ...formData, payment_mode: v })}>
                        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="cash">{t('pos_cash')}</SelectItem><SelectItem value="bank">{t('pos_bank')}</SelectItem><SelectItem value="credit">{t('pos_credit')}</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>{['Salary', 'Tickets', 'ID Card'].includes(formData.category) ? 'Employee' : 'Supplier'}</Label>
                      {['Salary', 'Tickets', 'ID Card'].includes(formData.category) ? (
                        <SearchableSelect
                          items={[{id: '', name: '- No Employee -'}, ...employees.map(e => ({id: e.id, name: e.name}))]}
                          value={formData.employee_id || ''}
                          onChange={(v) => setFormData({ ...formData, employee_id: v, supplier_id: '' })}
                          placeholder="Search employee..."
                          data-testid="expense-employee-select"
                        />
                      ) : (
                        <SearchableSelect
                          items={[{id: '', name: '- No Supplier -'}, ...suppliers]}
                          value={formData.supplier_id || ''}
                          onChange={(v) => setFormData({ ...formData, supplier_id: v, employee_id: '' })}
                          placeholder="Search supplier..."
                        />
                      )}
                    </div>
                    <div>
                      <Label>Paid By (Branch)</Label>
                      <Select value={formData.branch_id || "none"} onValueChange={(v) => setFormData({ ...formData, branch_id: v === "none" ? "" : v })}>
                        <SelectTrigger className="h-10" data-testid="expense-paid-from-branch"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="none">-</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Credit warning for supplier */}
                  {formData.supplier_id && formData.payment_mode === 'credit' && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg flex items-start gap-2">
                      <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-700 dark:text-amber-300">Credit Purchase</p>
                        <p className="text-amber-600 dark:text-amber-400 text-xs">
                          This expense will be added to supplier's credit balance. Pay later via Supplier Payments.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <Label>Expense For (Branch)</Label>
                      <Select value={formData.expense_for_branch_id || "none"} onValueChange={(v) => setFormData({ ...formData, expense_for_branch_id: v === "none" ? "" : v })}>
                        <SelectTrigger className="h-10" data-testid="expense-for-branch"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="none">-</SelectItem>{branches.filter(b => b.id !== formData.branch_id).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>{t('date')}</Label>
                      <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="h-10" />
                    </div>
                    <div>
                      <Label>{t('description')}</Label>
                      <div className="relative">
                        <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder={t('description')} className="h-10 pr-16"
                          onBlur={async () => {
                            if (formData.description && formData.description.length > 3 && !formData.category) {
                              try {
                                const { data } = await api.post('/expenses/auto-categorize', { description: formData.description });
                                if (data.category && data.category !== 'general') {
                                  const matched = mainCats.find(c => c.toLowerCase() === data.category.toLowerCase());
                                  if (matched) { setFormData(f => ({ ...f, category: matched })); toast.info(`AI suggested: ${matched}`); }
                                }
                              } catch {}
                            }
                          }}
                        />
                        {!formData.category && formData.description?.length > 3 && (
                          <span className="absolute right-2 top-2.5 text-[9px] text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded" data-testid="ai-cat-hint">AI</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label>Invoice (Optional)</Label>
                      <Input type="file" accept="image/*,.pdf" className="h-10 text-xs" data-testid="expense-invoice-upload"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          try {
                            const fd = new FormData();
                            fd.append('file', file);
                            const res = await api.post('/expenses/upload-bill', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                            setFormData(f => ({ ...f, bill_image_url: res.data.bill_url }));
                            toast.success('Invoice uploaded');
                          } catch { toast.error('Upload failed'); }
                        }}
                      />
                      {formData.bill_image_url && <span className="text-[10px] text-emerald-600 mt-0.5 block">Attached</span>}
                    </div>
                    <div className="flex items-end">
                      <Button type="submit" className="rounded-xl w-full h-10" data-testid="add-expense-btn"><Plus size={16} className="mr-2" />{t('add')}</Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ALL EXPENSES */}
          <TabsContent value="list">
            <Card className="border-stone-100">
              <CardHeader><CardTitle className="font-outfit text-base flex justify-between">{t('all_expenses')} <span className="text-error">{t('total_label')}: SAR {totalExp.toFixed(2)}</span></CardTitle></CardHeader>
              <CardContent>
                {/* Grand Total Summary */}
                {filtered.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4" data-testid="expenses-summary-bar">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-red-50 to-red-100 border border-red-200 card-enter">
                      <div className="text-[10px] text-red-600 uppercase tracking-wider">Total Expenses</div>
                      <div className="text-lg font-bold text-red-700">SAR {totalExp.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                      <div className="text-[10px] text-muted-foreground">{filtered.length} entries</div>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 card-enter">
                      <div className="text-[10px] text-emerald-600 uppercase tracking-wider">Cash</div>
                      <div className="text-lg font-bold text-emerald-700">SAR {filtered.filter(e => e.payment_mode === 'cash').reduce((s, e) => s + e.amount, 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 card-enter">
                      <div className="text-[10px] text-blue-600 uppercase tracking-wider">Bank</div>
                      <div className="text-lg font-bold text-blue-700">SAR {filtered.filter(e => e.payment_mode === 'bank').reduce((s, e) => s + e.amount, 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 card-enter">
                      <div className="text-[10px] text-amber-600 uppercase tracking-wider">Credit</div>
                      <div className="text-lg font-bold text-amber-700">SAR {filtered.filter(e => e.payment_mode === 'credit').reduce((s, e) => s + e.amount, 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                    </div>
                  </div>
                )}
                {/* Mobile card view */}
                <div className="sm:hidden space-y-2">
                  {filtered.map(e => (
                    <div key={e.id} className="p-3 border rounded-xl bg-white space-y-2" data-testid={`expense-card-${e.id}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <Badge variant="secondary" className="capitalize text-xs">{e.category?.replace('_',' ')}</Badge>
                          {e.sub_category && <Badge variant="outline" className="ml-1 text-[10px] capitalize">{e.sub_category}</Badge>}
                        </div>
                        <span className="text-base font-bold text-red-600">SAR {e.amount.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-stone-600">{e.description || t('no_data')}</p>
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span>{format(new Date(e.date), 'MMM dd, yyyy')}</span>
                          {e.created_by_name && <span className="text-stone-500">by {e.created_by_name}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`capitalize text-[10px] ${e.payment_mode === 'cash' ? 'bg-cash/20 text-cash' : e.payment_mode === 'bank' ? 'bg-bank/20 text-bank' : 'bg-credit/20 text-credit'}`}>{e.payment_mode}</Badge>
                          <span>{branches.find(b => b.id === e.branch_id)?.name || '-'}</span>
                          <Button size="sm" variant="ghost" data-testid={`delete-expense-mobile-${e.id}`} onClick={async () => { if(window.confirm('Delete this expense?')) { try { await api.delete(`/expenses/${e.id}`); toast.success('Expense deleted'); fetchData(); } catch(err) { toast.error(err.response?.data?.detail || 'Failed to delete expense'); } }}} className="h-6 w-6 p-0 text-error"><Trash2 size={12} /></Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">{t('no_data')}</p>}
                </div>
                {/* Desktop: Daily Grouped View */}
                <div className="hidden sm:block">
                  {(() => {
                    // Group expenses by date
                    const grouped = {};
                    filtered.forEach(exp => {
                      const dateKey = exp.date ? format(new Date(exp.date), 'yyyy-MM-dd') : 'unknown';
                      if (!grouped[dateKey]) {
                        grouped[dateKey] = { date: exp.date, dateKey, cash: 0, bank: 0, credit: 0, total: 0, categories: {}, branches: {}, items: [], count: 0 };
                      }
                      const g = grouped[dateKey];
                      g.count++;
                      g.total += exp.amount || 0;
                      if (exp.payment_mode === 'cash') g.cash += exp.amount || 0;
                      else if (exp.payment_mode === 'bank') g.bank += exp.amount || 0;
                      else g.credit += exp.amount || 0;
                      const cat = exp.category || 'Other';
                      g.categories[cat] = (g.categories[cat] || 0) + (exp.amount || 0);
                      const bName = branches.find(b => b.id === exp.branch_id)?.name || 'Other';
                      g.branches[bName] = (g.branches[bName] || 0) + (exp.amount || 0);
                      g.items.push(exp);
                    });
                    const dailyData = Object.values(grouped).sort((a, b) => new Date(b.date) - new Date(a.date));

                    // Detect duplicate entries per day (same branch + same amount)
                    dailyData.forEach(day => {
                      const dupeKeys = {};
                      day.items.forEach(exp => {
                        const key = `${exp.branch_id || 'none'}_${(exp.amount || 0).toFixed(2)}`;
                        if (!dupeKeys[key]) dupeKeys[key] = [];
                        dupeKeys[key].push(exp.id);
                      });
                      const dupeIds = new Set();
                      Object.values(dupeKeys).forEach(ids => {
                        if (ids.length > 1) ids.forEach(id => dupeIds.add(id));
                      });
                      day.duplicateIds = dupeIds;
                      day.hasDuplicates = dupeIds.size > 0;
                    });

                    if (dailyData.length === 0) return <div className="text-center py-8 text-muted-foreground">{t('no_data')}</div>;

                    return (
                      <div className="border rounded-lg overflow-hidden">
                        {/* Header */}
                        <div className="bg-stone-50 dark:bg-stone-800">
                          <table className="w-full text-sm table-fixed">
                            <thead><tr>
                              <th className="px-3 py-3 text-left font-medium text-stone-600 w-[4%]"></th>
                              <th className="px-3 py-3 text-left font-medium text-stone-600 w-[14%]">Date</th>
                              <th className="px-3 py-3 text-right font-medium text-stone-600 w-[12%]">Total</th>
                              <th className="px-3 py-3 text-right font-medium text-stone-600 w-[12%]">Cash</th>
                              <th className="px-3 py-3 text-right font-medium text-stone-600 w-[12%]">Bank</th>
                              <th className="px-3 py-3 text-right font-medium text-stone-600 w-[12%]">Credit</th>
                              <th className="px-3 py-3 text-left font-medium text-stone-600 w-[34%]">Categories</th>
                            </tr></thead>
                          </table>
                        </div>
                        {/* Body */}
                        <div className="max-h-[600px] overflow-y-auto">
                          {dailyData.map(day => (
                            <div key={day.dateKey}>
                              {/* Day Summary Row */}
                              <table className="w-full text-sm table-fixed">
                                <tbody>
                                  <tr className={`border-b hover:bg-stone-50 cursor-pointer transition-colors ${day.hasDuplicates ? 'bg-orange-50/60' : ''}`}
                                    onClick={() => setExpandedDates(prev => ({ ...prev, [day.dateKey]: !prev[day.dateKey] }))}
                                    data-testid={`expense-day-row-${day.dateKey}`}>
                                    <td className="px-3 py-3 w-[4%]">
                                      {expandedDates[day.dateKey] ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
                                    </td>
                                    <td className="px-3 py-3 w-[14%]">
                                      <div className="font-semibold text-sm flex items-center gap-1.5">
                                        {format(new Date(day.date), 'MMM dd, yyyy')}
                                        {day.hasDuplicates && (
                                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 text-[10px] font-bold border border-orange-300" data-testid={`exp-duplicate-warning-${day.dateKey}`}>
                                            <AlertTriangle size={10} /> Duplicate
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-muted-foreground">{day.count} entries</div>
                                    </td>
                                    <td className="px-3 py-3 text-right w-[12%]"><span className="text-sm font-bold text-red-600">SAR {day.total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></td>
                                    <td className="px-3 py-3 text-right w-[12%]">{day.cash > 0 ? <span className="inline-block px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">SAR {day.cash.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span> : <span className="text-xs text-muted-foreground">-</span>}</td>
                                    <td className="px-3 py-3 text-right w-[12%]">{day.bank > 0 ? <span className="inline-block px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200">SAR {day.bank.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span> : <span className="text-xs text-muted-foreground">-</span>}</td>
                                    <td className="px-3 py-3 text-right w-[12%]">{day.credit > 0 ? <span className="inline-block px-2 py-1 rounded bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200">SAR {day.credit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span> : <span className="text-xs text-muted-foreground">-</span>}</td>
                                    <td className="px-3 py-3 w-[34%]">
                                      <div className="flex gap-1 flex-wrap">
                                        {Object.entries(day.categories).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([cat, amt]) => (
                                          <span key={cat} className="text-[10px] px-1.5 py-0.5 bg-stone-100 text-stone-700 rounded border border-stone-200">{cat}: {amt.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                                        ))}
                                        {Object.keys(day.categories).length > 4 && <span className="text-[10px] text-muted-foreground">+{Object.keys(day.categories).length - 4} more</span>}
                                      </div>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                              {/* Expanded Individual Entries */}
                              {expandedDates[day.dateKey] && (
                                <div className="bg-stone-50/50 border-b">
                                  <table className="w-full text-sm">
                                    <tbody>
                                      {day.items.map(exp => (
                                        <tr key={exp.id} className={`border-b border-stone-100 hover:bg-white/50 ${day.duplicateIds.has(exp.id) ? 'bg-orange-50/80 border-l-4 border-l-orange-400' : ''}`} data-testid={`expense-detail-${exp.id}`}>
                                          <td className="px-3 py-2 pl-10 w-[18%]">
                                            <div className="flex items-center gap-1 flex-wrap">
                                              <Badge variant="secondary" className="capitalize text-[10px]">{exp.category?.replace('_',' ')}</Badge>
                                              {exp.sub_category && <Badge variant="outline" className="text-[10px] capitalize">{exp.sub_category}</Badge>}
                                              {day.duplicateIds.has(exp.id) && (
                                                <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-orange-100 text-orange-700 text-[9px] font-bold border border-orange-300" data-testid={`exp-duplicate-badge-${exp.id}`}>
                                                  <Copy size={8} /> Possible duplicate
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 text-sm truncate w-[22%]">{exp.description || '-'}</td>
                                          <td className="px-3 py-2 text-sm w-[12%]">{branches.find(b => b.id === exp.branch_id)?.name || '-'}</td>
                                          <td className="px-3 py-2 text-right w-[12%]"><span className="font-bold text-sm">SAR {exp.amount.toFixed(2)}</span></td>
                                          <td className="px-3 py-2 w-[10%]">
                                            <Badge className={`capitalize text-[10px] ${exp.payment_mode === 'cash' ? 'bg-cash/20 text-cash' : exp.payment_mode === 'bank' ? 'bg-bank/20 text-bank' : 'bg-credit/20 text-credit'}`}>{exp.payment_mode}</Badge>
                                          </td>
                                          <td className="px-3 py-2 w-[10%]">
                                            {exp.created_by_name && <span className="text-[10px] text-muted-foreground" data-testid={`expense-created-by-${exp.id}`}>{exp.created_by_name}</span>}
                                          </td>
                                          <td className="px-3 py-2 text-right w-[6%]">
                                            <Button size="sm" variant="ghost" data-testid={`delete-expense-${exp.id}`} onClick={async (e) => { e.stopPropagation(); if(window.confirm('Delete this expense?')) { try { await api.delete(`/expenses/${exp.id}`); toast.success('Expense deleted'); fetchData(); } catch(err) { toast.error(err.response?.data?.detail || 'Failed to delete expense'); } }}} className="h-7 text-error"><Trash2 size={12} /></Button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {/* Footer */}
                        <div className="px-3 py-2 text-xs text-muted-foreground bg-stone-50 border-t">
                          Showing {filtered.length.toLocaleString()} expenses across {dailyData.length} days
                        </div>
                      </div>
                    );
                  })()}
                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 px-2" data-testid="expenses-pagination">
                      <span className="text-xs text-muted-foreground">{totalRecords} total records</span>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" disabled={currentPage <= 1} className="h-8 w-8 p-0"
                          onClick={() => fetchData(currentPage - 1)} data-testid="expenses-prev-page"><ChevronLeft size={14} /></Button>
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
                              onClick={() => fetchData(p)} data-testid={`expenses-page-${p}`}>{p}</Button>
                          ));
                        })()}
                        <Button size="sm" variant="outline" disabled={currentPage >= totalPages} className="h-8 w-8 p-0"
                          onClick={() => fetchData(currentPage + 1)} data-testid="expenses-next-page"><ChevronRight size={14} /></Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* RECURRING & PLANNED */}
          <TabsContent value="recurring">
            <div className="space-y-4">
              <Card className="border-stone-100">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="font-outfit text-base">Recurring Expenses (Rent, Insurance, Renewals)</CardTitle>
                    <Button size="sm" className="rounded-xl" onClick={() => document.getElementById('rec-form').classList.toggle('hidden')}><Plus size={14} className="mr-1" />Add Recurring</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div id="rec-form" className="hidden mb-4 p-4 bg-stone-50 rounded-xl border space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div><Label className="text-xs">Name *</Label><Input value={newRecData.name} onChange={(e) => setNewRecData({...newRecData, name: e.target.value})} placeholder="Office Rent" className="h-8" /></div>
                      <div><Label className="text-xs">Category</Label><Input value={newRecData.category} onChange={(e) => setNewRecData({...newRecData, category: e.target.value})} placeholder="rent" className="h-8" /></div>
                      <div><Label className="text-xs">Amount *</Label><Input type="number" step="0.01" value={newRecData.amount} onChange={(e) => setNewRecData({...newRecData, amount: e.target.value})} className="h-8" /></div>
                      <div><Label className="text-xs">Frequency</Label><Select value={newRecData.frequency} onValueChange={(v) => setNewRecData({...newRecData, frequency: v})}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="yearly">Yearly</SelectItem></SelectContent></Select></div>
                      <div><Label className="text-xs">Branch</Label><Select value={newRecData.branch_id || "none"} onValueChange={(v) => setNewRecData({...newRecData, branch_id: v === "none" ? "" : v})}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">All</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
                      <div><Label className="text-xs">Next Due *</Label><Input type="date" value={newRecData.next_due_date} onChange={(e) => setNewRecData({...newRecData, next_due_date: e.target.value})} className="h-8" /></div>
                      <div><Label className="text-xs">Alert Days</Label><Input type="number" value={newRecData.alert_days} onChange={(e) => setNewRecData({...newRecData, alert_days: e.target.value})} className="h-8" /></div>
                      <div className="flex items-end"><Button size="sm" className="h-8 rounded-xl w-full" onClick={async () => {
                        if (!newRecData.name || !newRecData.amount || !newRecData.next_due_date) { toast.error('Fill required'); return; }
                        try { await api.post('/recurring-expenses', {...newRecData, amount: parseFloat(newRecData.amount), alert_days: parseInt(newRecData.alert_days) || 7, branch_id: newRecData.branch_id || null, next_due_date: new Date(newRecData.next_due_date).toISOString()}); toast.success('Added'); setNewRecData({name:'',category:'rent',amount:'',frequency:'monthly',branch_id:'',next_due_date:'',alert_days:7}); fetchData(); }
                        catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
                      }}>Save</Button></div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {recurringExpenses.map(r => {
                      const dl = r.days_until_due;
                      const overdue = dl != null && dl < 0;
                      const near = dl != null && dl <= (r.alert_days || 7) && dl >= 0;
                      return (
                        <div key={r.id} className={`flex justify-between items-center p-4 rounded-xl border ${overdue ? 'bg-error/5 border-error/30' : near ? 'bg-warning/5 border-warning/30' : 'bg-stone-50'}`}>
                          <div>
                            <div className="font-medium">{r.name}</div>
                            <div className="text-xs text-muted-foreground mt-1 capitalize">{r.category} | {r.frequency} | SAR {r.amount.toFixed(2)}{r.branch_id ? ` | ${branches.find(b => b.id === r.branch_id)?.name || ''}` : ''}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            {dl != null && <Badge className={overdue ? 'bg-error/20 text-error' : near ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'}>{overdue ? `${Math.abs(dl)}d overdue` : `${dl}d left`}</Badge>}
                            <Button size="sm" variant="default" className="rounded-xl" onClick={() => { setRenewingRec(r); setRenewData({ amount: r.amount.toString(), payment_mode: 'cash', branch_id: r.branch_id || '' }); setShowRenewDialog(true); }}><DollarSign size={14} className="mr-1" />Renew & Pay</Button>
                            <Button size="sm" variant="ghost" className="text-error" onClick={async () => { if(window.confirm('Delete?')) { await api.delete(`/recurring-expenses/${r.id}`); fetchData(); }}}><Trash2 size={12} /></Button>
                          </div>
                        </div>
                      );
                    })}
                    {recurringExpenses.length === 0 && <div className="text-center py-8 text-muted-foreground"><AlertTriangle size={24} className="mx-auto mb-2 text-warning" /><p>No recurring expenses set up yet.</p><p className="text-xs mt-1">Add rent, insurance, subscriptions etc. to get alerts before they're due.</p></div>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Category Manager Dialog */}
        <Dialog open={showCatManager} onOpenChange={setShowCatManager}>
          <DialogContent className="max-w-lg"><DialogHeader><DialogTitle className="font-outfit">Manage Expense Categories</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Add Main Category</Label>
                <div className="flex gap-2 mt-1"><Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="e.g. Marketing" className="h-9" /><Button size="sm" className="rounded-xl h-9" onClick={handleAddCat}>Add</Button></div>
              </div>
              <div>
                <Label className="text-sm font-medium">Add Sub-Category</Label>
                <div className="flex gap-2 mt-1">
                  <Select value={newSubCat.parent || "none"} onValueChange={(v) => setNewSubCat({...newSubCat, parent: v === "none" ? "" : v})}><SelectTrigger className="h-9 w-36"><SelectValue placeholder="Parent" /></SelectTrigger><SelectContent><SelectItem value="none">Select</SelectItem>{mainCats.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                  <Input value={newSubCat.name} onChange={(e) => setNewSubCat({...newSubCat, name: e.target.value})} placeholder="Sub-category name" className="h-9 flex-1" />
                  <Button size="sm" className="rounded-xl h-9" onClick={handleAddSubCat}>Add</Button>
                </div>
              </div>
              <div className="border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Current Categories:</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">{mainCats.map(cat => (
                  <div key={cat} className="p-2 bg-stone-50 rounded-lg">
                    <span className="font-medium text-sm">{cat}</span>
                    {getSubCats(cat).length > 0 && <div className="flex gap-1 mt-1 flex-wrap">{getSubCats(cat).map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}</div>}
                  </div>
                ))}</div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Renew & Pay Dialog */}
        <Dialog open={showRenewDialog} onOpenChange={setShowRenewDialog}>
          <DialogContent><DialogHeader><DialogTitle className="font-outfit">Renew & Pay - {renewingRec?.name}</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground capitalize">{renewingRec?.category} | {renewingRec?.frequency}</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Amount *</Label><Input type="number" step="0.01" value={renewData.amount} onChange={(e) => setRenewData({...renewData, amount: e.target.value})} /></div>
                <div><Label>Mode</Label><Select value={renewData.payment_mode} onValueChange={(v) => setRenewData({...renewData, payment_mode: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent></Select></div>
                <div><Label>Branch</Label><Select value={renewData.branch_id || "none"} onValueChange={(v) => setRenewData({...renewData, branch_id: v === "none" ? "" : v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No Branch</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <Button className="rounded-xl" onClick={async () => {
                try { const res = await api.post(`/recurring-expenses/${renewingRec.id}/renew-pay`, {amount: parseFloat(renewData.amount), payment_mode: renewData.payment_mode, branch_id: renewData.branch_id || null}); toast.success(res.data.message); setShowRenewDialog(false); fetchData(); }
                catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
              }}>Pay & Renew</Button>
            </div>
          </DialogContent>
        </Dialog>
        {/* Expense Refund Dialog */}
        <Dialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
          <DialogContent className="max-w-md" data-testid="refund-dialog">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><RotateCcw className="text-red-500" size={18} /> Record Expense Refund</DialogTitle></DialogHeader>
            <form onSubmit={handleRefundSubmit} className="space-y-4">
              <div className="text-sm text-red-700 bg-red-50 p-2 rounded-lg border border-red-200">
                Record a refund for a returned item or cancelled service. This will create a negative expense entry.
              </div>
              <div className="space-y-2">
                <Label>Refund Amount (SAR) *</Label>
                <Input type="number" step="0.01" value={refundData.amount} data-testid="refund-amount"
                  onChange={(e) => setRefundData({ ...refundData, amount: e.target.value })} required placeholder="0.00" className="text-lg font-bold" />
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Input value={refundData.reason} onChange={(e) => setRefundData({ ...refundData, reason: e.target.value })} placeholder="Returned item, cancelled service, etc." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Refund Mode</Label>
                  <Select value={refundData.refund_mode} onValueChange={(v) => setRefundData({ ...refundData, refund_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={refundData.date} onChange={(e) => setRefundData({ ...refundData, date: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-3">
                <Button type="submit" className="bg-red-500 hover:bg-red-600 rounded-xl" data-testid="submit-refund-btn">
                  <RotateCcw size={14} className="mr-1" /> Record Refund
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowRefundDialog(false)} className="rounded-xl">Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <WhatsAppSendDialog open={showWhatsApp} onClose={() => setShowWhatsApp(false)} defaultType="expense_summary" branches={branches} />

        {/* Duplicate Warning Dialog */}
        <AlertDialog open={showDuplicateWarning} onOpenChange={setShowDuplicateWarning}>
          <AlertDialogContent data-testid="expense-duplicate-warning-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
                <AlertTriangle size={20} /> Possible Duplicate Expense
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm">
                <span className="font-bold text-orange-700">{duplicateCount}</span> expense(s) with the same branch and amount
                (<span className="font-bold">SAR {parseFloat(formData.amount || 0).toFixed(2)}</span>) already exist on{' '}
                <span className="font-bold">{formData.date}</span>.
                <br /><br />
                Are you sure this is <span className="font-bold">not a duplicate</span> entry?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="cancel-exp-duplicate-btn">Cancel & Review</AlertDialogCancel>
              <AlertDialogAction onClick={() => { setShowDuplicateWarning(false); submitExpense(); }} className="bg-orange-600 hover:bg-orange-700" data-testid="confirm-exp-duplicate-btn">
                Yes, Save Anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
