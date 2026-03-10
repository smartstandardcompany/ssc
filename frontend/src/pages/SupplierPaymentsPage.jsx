import { useEffect, useState, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Receipt, DollarSign, Banknote, CreditCard, FileText, Building2, RotateCcw, Upload, Image as ImageIcon, Eye, AlertTriangle, Copy } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import api from '@/lib/api';
import { useBranchStore } from '@/stores';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ExportButtons } from '@/components/ExportButtons';
import { DateFilter } from '@/components/DateFilter';
import { BranchFilter } from '@/components/BranchFilter';
import { useLanguage } from '@/contexts/LanguageContext';
import { SearchableSelect } from '@/components/SearchableSelect';

export default function SupplierPaymentsPage() {
  const { t } = useLanguage();
  const [payments, setPayments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const { branches, fetchBranches: _fetchBr } = useBranchStore();
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('payment'); // 'payment' or 'bill'
  const [formData, setFormData] = useState({
    supplier_id: '',
    amount: '',
    payment_mode: 'cash',
    branch_id: '',
    expense_for_branch_id: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    category: 'Supplier Purchase',
  });
  const [dateFilter, setDateFilter] = useState({ start: null, end: null, period: 'all' });
  const [branchFilter, setBranchFilter] = useState([]);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returns, setReturns] = useState([]);
  const [returnData, setReturnData] = useState({
    supplier_id: '', amount: '', return_type: 'credit_return', reason: '', invoice_ref: '',
    branch_id: '', date: new Date().toISOString().split('T')[0], bill_image_url: '',
  });
  const [uploading, setUploading] = useState(false);
  const [billUploading, setBillUploading] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [pendingSubmitType, setPendingSubmitType] = useState(null);
  const billFileRef = useRef(null);
  const returnBillRef = useRef(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async (page = 1) => {
    try {
      const [paymentsRes, suppliersRes, branchesRes, returnsRes] = await Promise.all([
        api.get(`/supplier-payments?page=${page}&limit=100`),
        api.get('/suppliers'),
        Promise.resolve({ data: [] }),
        api.get('/supplier-returns').catch(() => ({ data: [] })),
      ]);
      const payData = paymentsRes.data;
      setPayments(payData.data || payData);
      setTotalPages(payData.pages || 1);
      setTotalRecords(payData.total || 0);
      setCurrentPage(payData.page || 1);
      setSuppliers(suppliersRes.data);
      setReturns(returnsRes.data);
    } catch { toast.error('Failed to fetch data'); }
    finally { setLoading(false); }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!formData.supplier_id) { toast.error('Please select a supplier'); return; }

    // Check for duplicates before saving
    const amt = parseFloat(formData.amount);
    if (formData.supplier_id && amt > 0) {
      try {
        const checkRes = await api.get(`/supplier-payments/check-duplicate?supplier_id=${formData.supplier_id}&amount=${amt}&date=${formData.date}`);
        if (checkRes.data?.has_duplicate) {
          setDuplicateCount(checkRes.data.count);
          setPendingSubmitType('payment');
          setShowDuplicateWarning(true);
          return;
        }
      } catch { /* proceed if check fails */ }
    }

    await submitPayment();
  };

  const submitPayment = async () => {
    try {
      const payload = {
        supplier_id: formData.supplier_id,
        amount: parseFloat(formData.amount),
        payment_mode: formData.payment_mode,
        branch_id: formData.branch_id || null,
        expense_for_branch_id: formData.expense_for_branch_id || null,
        date: `${formData.date}T${new Date().toTimeString().slice(0,8)}`,
        notes: formData.notes,
      };
      await api.post('/supplier-payments', payload);
      
      // Also record as expense so it appears in expense reports
      await api.post('/expenses', {
        amount: parseFloat(formData.amount),
        category: 'Supplier Payment',
        description: `Payment to ${suppliers.find(s => s.id === formData.supplier_id)?.name || 'supplier'} - ${formData.notes || 'Credit payment'}`,
        payment_mode: formData.payment_mode,
        supplier_id: formData.supplier_id,
        branch_id: formData.branch_id || '',
        expense_for_branch_id: formData.expense_for_branch_id || '',
        date: `${formData.date}T${new Date().toTimeString().slice(0,8)}`,
      }).catch(() => {}); // Don't fail if expense recording fails
      
      toast.success('Payment recorded successfully');
      setShowForm(false);
      resetForm();
      fetchData();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to add payment'); }
  };

  const handleBillSubmit = async (e) => {
    e.preventDefault();
    if (!formData.supplier_id) { toast.error('Please select a supplier'); return; }

    // Check for duplicates
    const amt = parseFloat(formData.amount);
    if (formData.supplier_id && amt > 0) {
      try {
        const checkRes = await api.get(`/supplier-payments/check-duplicate?supplier_id=${formData.supplier_id}&amount=${amt}&date=${formData.date}`);
        if (checkRes.data?.has_duplicate) {
          setDuplicateCount(checkRes.data.count);
          setPendingSubmitType('bill');
          setShowDuplicateWarning(true);
          return;
        }
      } catch { /* proceed if check fails */ }
    }

    await submitBill();
  };

  const submitBill = async () => {
    try {
      const supplierName = suppliers.find(s => s.id === formData.supplier_id)?.name || 'supplier';
      await api.post('/expenses', {
        amount: parseFloat(formData.amount),
        category: formData.category || 'Supplier Purchase',
        description: formData.notes || `Purchase from ${supplierName}`,
        payment_mode: formData.payment_mode,
        supplier_id: formData.supplier_id,
        branch_id: formData.branch_id || '',
        expense_for_branch_id: formData.expense_for_branch_id || '',
        date: `${formData.date}T${new Date().toTimeString().slice(0,8)}`,
      });
      
      const modeText = formData.payment_mode === 'credit'
        ? 'Added to supplier credit balance'
        : 'Paid immediately (no balance change)';
      toast.success(`Purchase bill recorded! ${modeText}`);
      setShowForm(false);
      resetForm();
      fetchData();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to add bill'); }
  };

  const resetForm = () => {
    setFormData({
      supplier_id: '', amount: '', payment_mode: formType === 'bill' ? 'credit' : 'cash',
      branch_id: '', expense_for_branch_id: '', date: new Date().toISOString().split('T')[0], notes: '', category: 'Supplier Purchase',
    });
  };

  const handleBillUpload = async (e, target = 'form') => {
    const file = e.target.files[0];
    if (!file) return;
    setBillUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/supplier-payments/upload-bill', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (target === 'form') setFormData(d => ({ ...d, bill_image_url: res.data.bill_url }));
      else setReturnData(d => ({ ...d, bill_image_url: res.data.bill_url }));
      toast.success('Bill image uploaded');
    } catch { toast.error('Upload failed'); }
    finally { setBillUploading(false); }
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!returnData.supplier_id) { toast.error('Select a supplier'); return; }
    try {
      await api.post('/supplier-returns', {
        ...returnData,
        amount: parseFloat(returnData.amount),
        date: new Date(returnData.date).toISOString(),
      });
      const typeLabel = returnData.return_type === 'cash_refund' ? 'Cash refund' : returnData.return_type === 'credit_return' ? 'Credit return' : 'Full invoice return';
      toast.success(`${typeLabel} recorded for SAR ${returnData.amount}`);
      setShowReturnForm(false);
      setReturnData({ supplier_id: '', amount: '', return_type: 'credit_return', reason: '', invoice_ref: '', branch_id: '', date: new Date().toISOString().split('T')[0], bill_image_url: '' });
      fetchData();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to record return'); }
  };

  const handleDeleteReturn = async (id) => {
    if (window.confirm('Delete this return? Balance changes will be reversed.')) {
      try {
        await api.delete(`/supplier-returns/${id}`);
        toast.success('Return deleted and balance reversed');
        fetchData();
      } catch { toast.error('Failed to delete'); }
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this payment? Supplier balance will be updated.')) {
      try {
        await api.delete(`/supplier-payments/${id}`);
        toast.success('Payment deleted and balance updated');
        fetchData();
      } catch (error) { toast.error(error.response?.data?.detail || 'Failed to delete'); }
    }
  };

  const openForm = (type) => {
    setFormType(type);
    setFormData({
      supplier_id: '', amount: '', payment_mode: type === 'bill' ? 'credit' : 'cash',
      branch_id: '', expense_for_branch_id: '', date: new Date().toISOString().split('T')[0], notes: '', category: 'Supplier Purchase',
    });
    setShowForm(true);
  };

  const selectedSupplier = suppliers.find(s => s.id === formData.supplier_id);

  const filteredPayments = payments.filter(p => {
    if (branchFilter.length > 0 && !branchFilter.includes(p.branch_id)) return false;
    if (dateFilter.start && dateFilter.end) {
      const d = new Date(p.date);
      return d >= dateFilter.start && d <= dateFilter.end;
    }
    return true;
  });

  // Detect duplicates: same supplier + same amount on same day
  const spDuplicateIds = new Set();
  (() => {
    const dupeKeys = {};
    filteredPayments.forEach(p => {
      const dateKey = p.date ? p.date.substring(0, 10) : 'unknown';
      const key = `${dateKey}_${p.supplier_id || 'none'}_${(p.amount || 0).toFixed(2)}`;
      if (!dupeKeys[key]) dupeKeys[key] = [];
      dupeKeys[key].push(p.id);
    });
    Object.values(dupeKeys).forEach(ids => {
      if (ids.length > 1) ids.forEach(id => spDuplicateIds.add(id));
    });
  })();

  if (loading) {
    return (<DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit mb-2" data-testid="supplier-payments-page-title">Supplier Payments</h1>
            <p className="text-muted-foreground text-sm">Record payments, purchase bills, and track supplier transactions</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <BranchFilter onChange={setBranchFilter} />
            <DateFilter onFilterChange={setDateFilter} />
            <ExportButtons dataType="supplier-payments" />
            <Button onClick={() => openForm('bill')} variant="outline" data-testid="add-bill-button"
              className="rounded-full text-amber-600 border-amber-300 hover:bg-amber-50">
              <Receipt size={16} className="mr-1" /> Add Bill
            </Button>
            <Button onClick={() => setShowReturnForm(true)} variant="outline" data-testid="add-return-button"
              className="rounded-full text-red-600 border-red-300 hover:bg-red-50">
              <RotateCcw size={16} className="mr-1" /> Return
            </Button>
            <Button onClick={() => openForm('payment')} data-testid="add-payment-button" className="rounded-full">
              <DollarSign size={16} className="mr-1" /> Pay Credit
            </Button>
          </div>
        </div>

        {/* Form Card */}
        {showForm && (
          <Card className="border-2 border-primary/20" data-testid="payment-form-card">
            <CardHeader className="pb-3">
              <CardTitle className="font-outfit flex items-center gap-2">
                {formType === 'bill' ? (
                  <><Receipt className="text-amber-500" size={20} /> Add Purchase Bill</>
                ) : (
                  <><DollarSign className="text-blue-500" size={20} /> Pay Supplier Credit</>
                )}
              </CardTitle>
              {formType === 'bill' ? (
                <p className="text-sm text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 mt-2">
                  Record a purchase from a supplier. Choose <strong>Credit</strong> to pay later (adds to balance), or <strong>Cash/Bank</strong> if paid now. All bills are recorded as expenses automatically.
                </p>
              ) : (
                <p className="text-sm text-blue-700 bg-blue-50 p-2 rounded-lg border border-blue-200 mt-2">
                  Make a payment to reduce a supplier's outstanding credit balance. This will also be recorded as an expense.
                </p>
              )}
            </CardHeader>
            <CardContent>
              <form onSubmit={formType === 'bill' ? handleBillSubmit : handlePaymentSubmit}>
                <div className="space-y-4">
                  {/* Supplier Selection - Searchable */}
                  <div>
                    <Label>Supplier *</Label>
                    <SearchableSelect
                      items={suppliers}
                      value={formData.supplier_id}
                      onChange={(id) => {
                        const sup = suppliers.find(s => s.id === id);
                        setFormData({...formData, supplier_id: id, branch_id: sup?.branch_id || formData.branch_id});
                      }}
                      placeholder="Search supplier by name..."
                      className="mt-2"
                    />
                    {selectedSupplier && (
                      <div className="mt-2 p-2 bg-stone-50 rounded-lg text-xs text-stone-600 flex gap-4">
                        <span>Credit: <strong className="text-red-600">SAR {selectedSupplier.current_credit?.toFixed(2) || '0.00'}</strong></span>
                        <span>Limit: <strong>SAR {selectedSupplier.credit_limit?.toFixed(2) || '0.00'}</strong></span>
                        <span>Total Purchases: <strong className="text-amber-600">SAR {(selectedSupplier.total_purchases || 0).toFixed(2)}</strong></span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Amount (SAR) *</Label>
                      <Input type="number" step="0.01" data-testid="amount-input"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        required placeholder="0.00" className="text-lg font-bold" />
                    </div>

                    <div>
                      <Label>Payment Mode *</Label>
                      {formType === 'bill' ? (
                        <div className="flex gap-2 mt-1">
                          {['credit', 'cash', 'bank'].map(mode => (
                            <button key={mode} type="button" onClick={() => setFormData({ ...formData, payment_mode: mode })}
                              data-testid={`mode-${mode}`}
                              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all border ${
                                formData.payment_mode === mode
                                  ? mode === 'credit' ? 'bg-amber-500 text-white border-amber-500'
                                    : mode === 'cash' ? 'bg-emerald-500 text-white border-emerald-500'
                                    : 'bg-blue-500 text-white border-blue-500'
                                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                              }`}>
                              {mode === 'credit' && <Receipt size={14} className="inline mr-1" />}
                              {mode === 'cash' && <Banknote size={14} className="inline mr-1" />}
                              {mode === 'bank' && <CreditCard size={14} className="inline mr-1" />}
                              {mode.charAt(0).toUpperCase() + mode.slice(1)}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <Select value={formData.payment_mode} onValueChange={(val) => setFormData({ ...formData, payment_mode: val })}>
                          <SelectTrigger data-testid="payment-mode-select"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash"><div className="flex items-center gap-2"><Banknote size={14} /> Cash</div></SelectItem>
                            <SelectItem value="bank"><div className="flex items-center gap-2"><CreditCard size={14} /> Bank Transfer</div></SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formType === 'bill'
                          ? (formData.payment_mode === 'credit' ? 'Will add to supplier balance (pay later)' : 'Paid now - no balance change')
                          : 'Payment will reduce supplier credit balance'}
                      </p>
                    </div>

                    <div>
                      <Label>Paid By (Branch)</Label>
                      <Select value={formData.branch_id || "all"} onValueChange={(val) => setFormData({ ...formData, branch_id: val === "all" ? "" : val })}>
                        <SelectTrigger data-testid="sp-branch-select"><SelectValue placeholder="Select branch" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Branches</SelectItem>
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Expense For (Branch)</Label>
                      <Select value={formData.expense_for_branch_id || "none"} onValueChange={(val) => setFormData({ ...formData, expense_for_branch_id: val === "none" ? "" : val })}>
                        <SelectTrigger data-testid="sp-expense-for-branch"><SelectValue placeholder="Same as Paid By" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Same as Paid By</SelectItem>
                          {branches.filter(b => b.id !== formData.branch_id).map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-0.5">Select if a different branch bears this expense</p>
                    </div>

                    <div>
                      <Label>Date *</Label>
                      <Input type="date" data-testid="date-input" value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })} required />
                    </div>

                    {formType === 'bill' && (
                      <div>
                        <Label>Category</Label>
                        <Select value={formData.category || "Supplier Purchase"} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                          <SelectTrigger data-testid="bill-category-select"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Supplier Purchase">Supplier Purchase</SelectItem>
                            <SelectItem value="Inventory">Inventory</SelectItem>
                            <SelectItem value="Raw Materials">Raw Materials</SelectItem>
                            <SelectItem value="Supplies">Supplies</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className={formType === 'bill' ? '' : 'md:col-span-2'}>
                      <Label>Notes / Invoice #{formType === 'payment' ? '' : ' (Optional)'}</Label>
                      <Textarea data-testid="notes-input" value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder={formType === 'bill' ? 'e.g., Invoice #1234 - Chicken, Rice, etc.' : 'Payment reference / notes'} />
                    </div>

                    {/* Bill Image Upload */}
                    <div className="md:col-span-2">
                      <Label>Bill / Invoice Image</Label>
                      <div className="flex items-center gap-3 mt-1">
                        <input ref={billFileRef} type="file" accept="image/*,application/pdf" onChange={(e) => handleBillUpload(e, 'form')} className="hidden" />
                        <Button type="button" variant="outline" size="sm" onClick={() => billFileRef.current?.click()} disabled={billUploading} data-testid="upload-bill-btn">
                          {billUploading ? 'Uploading...' : <><Upload size={14} className="mr-1" /> {formData.bill_image_url ? 'Change' : 'Upload'}</>}
                        </Button>
                        {formData.bill_image_url && (
                          <a href={`${process.env.REACT_APP_BACKEND_URL}${formData.bill_image_url}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline flex items-center gap-1">
                            <Eye size={12} /> View Bill
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-2">
                    <Button type="submit" data-testid="submit-form-button"
                      className={`rounded-xl ${formType === 'bill' ? 'bg-amber-500 hover:bg-amber-600' : ''}`}>
                      {formType === 'bill' ? <><Receipt size={16} className="mr-1" /> Add Purchase Bill</> : <><DollarSign size={16} className="mr-1" /> Record Payment</>}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => { setShowForm(false); resetForm(); }} className="rounded-xl">Cancel</Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Return Form Card */}
        {showReturnForm && (
          <Card className="border-2 border-red-200" data-testid="return-form-card">
            <CardHeader className="pb-3">
              <CardTitle className="font-outfit flex items-center gap-2">
                <RotateCcw className="text-red-500" size={20} /> Supplier Return
              </CardTitle>
              <p className="text-sm text-red-700 bg-red-50 p-2 rounded-lg border border-red-200 mt-2">
                Record goods returned to a supplier. Choose: <strong>Cash Refund</strong> (get money back), <strong>Credit Return</strong> (reduce balance owed), or <strong>Full Invoice Return</strong> (return entire invoice).
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleReturnSubmit}>
                <div className="space-y-4">
                  <div>
                    <Label>Supplier *</Label>
                    <SearchableSelect
                      items={suppliers}
                      value={returnData.supplier_id}
                      onChange={(id) => setReturnData({ ...returnData, supplier_id: id })}
                      placeholder="Search supplier by name..."
                      className="mt-2"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Return Type *</Label>
                      <Select value={returnData.return_type} onValueChange={(v) => setReturnData({ ...returnData, return_type: v })}>
                        <SelectTrigger data-testid="return-type-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash_refund">Cash Refund (get money back)</SelectItem>
                          <SelectItem value="credit_return">Credit Return (reduce balance)</SelectItem>
                          <SelectItem value="full_invoice_return">Full Invoice Return</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Amount (SAR) *</Label>
                      <Input type="number" step="0.01" value={returnData.amount} data-testid="return-amount-input"
                        onChange={(e) => setReturnData({ ...returnData, amount: e.target.value })} required placeholder="0.00" className="text-lg font-bold" />
                    </div>
                    <div>
                      <Label>Date *</Label>
                      <Input type="date" value={returnData.date} onChange={(e) => setReturnData({ ...returnData, date: e.target.value })} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Invoice Reference</Label>
                      <Input value={returnData.invoice_ref} onChange={(e) => setReturnData({ ...returnData, invoice_ref: e.target.value })} placeholder="Invoice #1234" />
                    </div>
                    <div>
                      <Label>Reason</Label>
                      <Input value={returnData.reason} onChange={(e) => setReturnData({ ...returnData, reason: e.target.value })} placeholder="Damaged goods, wrong order, etc." />
                    </div>
                  </div>
                  <div>
                    <Label>Bill / Return Document</Label>
                    <div className="flex items-center gap-3 mt-1">
                      <input ref={returnBillRef} type="file" accept="image/*,application/pdf" onChange={(e) => handleBillUpload(e, 'return')} className="hidden" />
                      <Button type="button" variant="outline" size="sm" onClick={() => returnBillRef.current?.click()} disabled={billUploading}>
                        {billUploading ? 'Uploading...' : <><Upload size={14} className="mr-1" /> Upload</>}
                      </Button>
                      {returnData.bill_image_url && (
                        <a href={`${process.env.REACT_APP_BACKEND_URL}${returnData.bill_image_url}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline flex items-center gap-1">
                          <Eye size={12} /> View
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button type="submit" className="rounded-xl bg-red-500 hover:bg-red-600" data-testid="submit-return-button">
                      <RotateCcw size={16} className="mr-1" /> Record Return
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowReturnForm(false)} className="rounded-xl">Cancel</Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Returns History */}
        {returns.length > 0 && (
          <Card className="border-red-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-outfit text-red-700 flex items-center gap-2"><RotateCcw size={18} /> Supplier Returns</CardTitle>
                <Badge variant="outline" className="text-xs text-red-600">{returns.length} returns</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="returns-table">
                  <thead><tr className="border-b bg-red-50/50">
                    <th className="text-left p-3 text-sm font-medium">Date</th>
                    <th className="text-left p-3 text-sm font-medium">Supplier</th>
                    <th className="text-left p-3 text-sm font-medium">Type</th>
                    <th className="text-right p-3 text-sm font-medium">Amount</th>
                    <th className="text-left p-3 text-sm font-medium">Invoice</th>
                    <th className="text-left p-3 text-sm font-medium">Reason</th>
                    <th className="text-right p-3 text-sm font-medium">Actions</th>
                  </tr></thead>
                  <tbody>
                    {returns.map(r => (
                      <tr key={r.id} className="border-b hover:bg-red-50/30">
                        <td className="p-3 text-sm">{r.date ? format(new Date(r.date), 'MMM dd, yyyy') : '-'}</td>
                        <td className="p-3 text-sm font-medium">{r.supplier_name}</td>
                        <td className="p-3"><Badge variant="outline" className="text-xs capitalize bg-red-50 text-red-700">{r.return_type?.replace('_', ' ')}</Badge></td>
                        <td className="p-3 text-sm text-right font-bold text-red-600">SAR {r.amount?.toFixed(2)}</td>
                        <td className="p-3 text-sm">{r.invoice_ref || '-'}</td>
                        <td className="p-3 text-sm text-muted-foreground truncate max-w-[150px]">{r.reason || '-'}</td>
                        <td className="p-3 text-right flex gap-1 justify-end">
                          {r.bill_image_url && (
                            <a href={`${process.env.REACT_APP_BACKEND_URL}${r.bill_image_url}`} target="_blank" rel="noreferrer">
                              <Button size="sm" variant="ghost" className="h-7"><Eye size={12} /></Button>
                            </a>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteReturn(r.id)} className="h-7 text-red-500"><Trash2 size={12} /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payments Table */}
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-outfit">All Supplier Transactions</CardTitle>
              <Badge variant="outline" className="text-xs">{filteredPayments.length} records</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="payments-table">
                <thead>
                  <tr className="border-b border-border bg-stone-50">
                    <th className="text-left p-3 font-medium text-sm">Date</th>
                    <th className="text-left p-3 font-medium text-sm">Supplier</th>
                    <th className="text-left p-3 font-medium text-sm hidden md:table-cell">Paid By</th>
                    <th className="text-left p-3 font-medium text-sm hidden md:table-cell">Expense For</th>
                    <th className="text-right p-3 font-medium text-sm">Amount</th>
                    <th className="text-left p-3 font-medium text-sm">Mode</th>
                    <th className="text-left p-3 font-medium text-sm hidden lg:table-cell">Notes</th>
                    <th className="text-center p-3 font-medium text-sm hidden md:table-cell">Bill</th>
                    <th className="text-right p-3 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => {
                    const branchName = branches.find(b => b.id === payment.branch_id)?.name || '-';
                    const expForName = payment.expense_for_branch_id ? branches.find(b => b.id === payment.expense_for_branch_id)?.name : null;
                    return (
                      <tr key={payment.id} className={`border-b border-border hover:bg-secondary/50 ${spDuplicateIds.has(payment.id) ? 'bg-orange-50/80 border-l-4 border-l-orange-400' : ''}`} data-testid="payment-row">
                        <td className="p-3 text-sm">
                          <div className="flex items-center gap-1">
                            {format(new Date(payment.date), 'MMM dd, yyyy')}
                            {spDuplicateIds.has(payment.id) && (
                              <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-orange-100 text-orange-700 text-[9px] font-bold border border-orange-300" data-testid={`sp-duplicate-badge-${payment.id}`}>
                                <Copy size={8} /> Duplicate
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-sm font-medium">{payment.supplier_name}</td>
                        <td className="p-3 text-sm text-muted-foreground hidden md:table-cell">{branchName}</td>
                        <td className="p-3 text-sm hidden md:table-cell">{expForName ? <Badge variant="outline" className="bg-amber-50 border-amber-300 text-amber-700 text-[10px]">{expForName}</Badge> : <span className="text-muted-foreground">-</span>}</td>
                        <td className="p-3 text-sm text-right font-bold">SAR {payment.amount.toFixed(2)}</td>
                        <td className="p-3">
                          <Badge variant="outline" className={`text-xs ${
                            payment.payment_mode === 'cash' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : payment.payment_mode === 'bank' ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {payment.payment_mode === 'cash' && <Banknote size={12} className="mr-1 inline" />}
                            {payment.payment_mode === 'bank' && <CreditCard size={12} className="mr-1 inline" />}
                            {payment.payment_mode === 'credit' && <Receipt size={12} className="mr-1 inline" />}
                            {payment.payment_mode}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground max-w-[200px] truncate hidden lg:table-cell">{payment.notes || '-'}</td>
                        <td className="p-3 hidden md:table-cell">
                          {payment.bill_image_url ? (
                            <a href={`${process.env.REACT_APP_BACKEND_URL}${payment.bill_image_url}`} target="_blank" rel="noreferrer">
                              <Button size="sm" variant="ghost" className="h-7 text-blue-600"><Eye size={12} className="mr-0.5" />Bill</Button>
                            </a>
                          ) : <span className="text-xs text-muted-foreground">-</span>}
                        </td>
                        <td className="p-3 text-right">
                          <Button size="sm" variant="outline" onClick={() => handleDelete(payment.id)}
                            data-testid="delete-payment-button" className="h-8 text-red-500 hover:text-red-700 hover:bg-red-50">
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredPayments.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        No supplier payments recorded yet. Use the buttons above to add a purchase bill or pay credit.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 px-2">
                <span className="text-xs text-muted-foreground">{totalRecords} total records</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={currentPage <= 1}
                    onClick={() => fetchData(currentPage - 1)} data-testid="prev-page">Previous</Button>
                  <span className="text-sm">Page {currentPage} of {totalPages}</span>
                  <Button size="sm" variant="outline" disabled={currentPage >= totalPages}
                    onClick={() => fetchData(currentPage + 1)} data-testid="next-page">Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Duplicate Warning Dialog */}
      <AlertDialog open={showDuplicateWarning} onOpenChange={setShowDuplicateWarning}>
        <AlertDialogContent data-testid="sp-duplicate-warning-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle size={20} /> Possible Duplicate Entry
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              <span className="font-bold text-orange-700">{duplicateCount}</span> payment(s) with the same supplier and amount
              (<span className="font-bold">SAR {parseFloat(formData.amount || 0).toFixed(2)}</span>) already exist on{' '}
              <span className="font-bold">{formData.date}</span>.
              <br /><br />
              Are you sure this is <span className="font-bold">not a duplicate</span> entry?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-sp-duplicate-btn">Cancel & Review</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowDuplicateWarning(false); pendingSubmitType === 'bill' ? submitBill() : submitPayment(); }} className="bg-orange-600 hover:bg-orange-700" data-testid="confirm-sp-duplicate-btn">
              Yes, Save Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
