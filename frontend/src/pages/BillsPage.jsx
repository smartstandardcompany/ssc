import { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { FileText, Plus, Search, DollarSign, Clock, CheckCircle, AlertTriangle, CreditCard, Trash2, Eye } from 'lucide-react';
import api from '@/lib/api';

const STATUS_COLORS = {
  unpaid: 'bg-red-50 text-red-700 border-red-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  paid: 'bg-green-50 text-green-700 border-green-200',
};

const PAYMENT_TERMS = [
  { value: 'due_on_receipt', label: 'Due on Receipt' },
  { value: 'net_15', label: 'Net 15' },
  { value: 'net_30', label: 'Net 30' },
  { value: 'net_60', label: 'Net 60' },
  { value: 'net_90', label: 'Net 90' },
];

export default function BillsPage() {
  const [bills, setBills] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [suppliers, setSuppliers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [payBill, setPayBill] = useState(null);
  const [payForm, setPayForm] = useState({ amount: 0, method: 'cash', reference: '' });
  const [form, setForm] = useState({
    supplier_id: '', supplier_name: '', items: [{ description: '', quantity: 1, unit_price: 0 }],
    tax_rate: 15, discount: 0, due_date: '', payment_terms: 'net_30', notes: '', category: '', currency: 'SAR',
  });

  const fetchBills = async () => {
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const res = await api.get(`/accounting/bills?${params}`);
      setBills(res.data.bills);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch { toast.error('Failed to load bills'); }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/suppliers');
      setSuppliers(Array.isArray(res.data) ? res.data : res.data.suppliers || []);
    } catch {}
  };

  useEffect(() => { fetchBills(); fetchSuppliers(); }, []);
  useEffect(() => { fetchBills(); }, [page, statusFilter]);

  const addItem = () => setForm({ ...form, items: [...form.items, { description: '', quantity: 1, unit_price: 0 }] });
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  const updateItem = (i, field, val) => {
    const items = [...form.items];
    items[i] = { ...items[i], [field]: field === 'description' ? val : parseFloat(val) || 0 };
    setForm({ ...form, items });
  };

  const subtotal = form.items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
  const taxAmount = subtotal * form.tax_rate / 100;
  const billTotal = subtotal + taxAmount - form.discount;

  const handleSave = async () => {
    if (!form.supplier_name) { toast.error('Supplier is required'); return; }
    if (form.items.length === 0 || !form.items[0].description) { toast.error('At least one item is required'); return; }
    try {
      await api.post('/accounting/bills', {
        ...form,
        issue_date: new Date().toISOString(),
        due_date: form.due_date ? new Date(form.due_date).toISOString() : new Date(Date.now() + 30 * 86400000).toISOString(),
      });
      toast.success('Bill created');
      setShowModal(false);
      fetchBills();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to create bill'); }
  };

  const handlePayment = async () => {
    if (payForm.amount <= 0) { toast.error('Amount must be positive'); return; }
    try {
      await api.post(`/accounting/bills/${payBill.id}/payment`, payForm);
      toast.success('Payment recorded');
      setShowPayModal(false);
      setPayBill(null);
      fetchBills();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to record payment'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this bill?')) return;
    try {
      await api.delete(`/accounting/bills/${id}`);
      toast.success('Bill deleted');
      fetchBills();
    } catch { toast.error('Failed to delete'); }
  };

  const openNewBill = () => {
    setForm({
      supplier_id: '', supplier_name: '', items: [{ description: '', quantity: 1, unit_price: 0 }],
      tax_rate: 15, discount: 0, due_date: '', payment_terms: 'net_30', notes: '', category: '', currency: 'SAR',
    });
    setShowModal(true);
  };

  const openPay = (bill) => {
    setPayBill(bill);
    setPayForm({ amount: bill.balance_due, method: 'cash', reference: '' });
    setShowPayModal(true);
  };

  const summaryStats = {
    total: bills.length,
    unpaid: bills.filter(b => b.status === 'unpaid').reduce((s, b) => s + b.balance_due, 0),
    partial: bills.filter(b => b.status === 'partial').reduce((s, b) => s + b.balance_due, 0),
    paid: bills.filter(b => b.status === 'paid').reduce((s, b) => s + b.total, 0),
    overdue: bills.filter(b => b.status !== 'paid' && b.due_date && new Date(b.due_date) < new Date()).length,
  };

  const filteredBills = bills.filter(b =>
    !search || b.supplier_name?.toLowerCase().includes(search.toLowerCase()) || b.bill_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6" data-testid="bills-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-800" data-testid="page-title">Bills</h1>
            <p className="text-sm text-stone-500 mt-1">Manage supplier bills and payments</p>
          </div>
          <Button onClick={openNewBill} className="bg-orange-500 hover:bg-orange-600 text-white" data-testid="add-bill-btn">
            <Plus className="w-4 h-4 mr-2" /> New Bill
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4" data-testid="summary-unpaid">
            <p className="text-xs font-medium text-red-600 uppercase">Unpaid</p>
            <p className="text-xl font-bold text-red-700 mt-1">SAR {summaryStats.unpaid.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4" data-testid="summary-partial">
            <p className="text-xs font-medium text-amber-600 uppercase">Partially Paid</p>
            <p className="text-xl font-bold text-amber-700 mt-1">SAR {summaryStats.partial.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-4" data-testid="summary-paid">
            <p className="text-xs font-medium text-green-600 uppercase">Paid</p>
            <p className="text-xl font-bold text-green-700 mt-1">SAR {summaryStats.paid.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4" data-testid="summary-overdue">
            <p className="text-xs font-medium text-stone-600 uppercase">Overdue</p>
            <p className="text-xl font-bold text-stone-800 mt-1">{summaryStats.overdue} bills</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <Input placeholder="Search by supplier or bill number..." value={search}
                onChange={e => setSearch(e.target.value)} className="pl-10" data-testid="search-bills" />
            </div>
            <div className="flex gap-2">
              {['all', 'unpaid', 'partial', 'paid'].map(s => (
                <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${statusFilter === s ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                  data-testid={`filter-${s}`}>{s}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Bills Table */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-stone-500">Bill #</th>
                <th className="text-left px-4 py-3 font-medium text-stone-500">Supplier</th>
                <th className="text-left px-4 py-3 font-medium text-stone-500">Issue Date</th>
                <th className="text-left px-4 py-3 font-medium text-stone-500">Due Date</th>
                <th className="text-right px-4 py-3 font-medium text-stone-500">Total</th>
                <th className="text-right px-4 py-3 font-medium text-stone-500">Balance</th>
                <th className="text-center px-4 py-3 font-medium text-stone-500">Status</th>
                <th className="text-right px-4 py-3 font-medium text-stone-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-stone-400">No bills found. Create your first bill.</td></tr>
              ) : filteredBills.map(bill => {
                const isOverdue = bill.status !== 'paid' && bill.due_date && new Date(bill.due_date) < new Date();
                return (
                  <tr key={bill.id} className="border-t border-stone-50 hover:bg-stone-50 transition-colors" data-testid={`bill-row-${bill.id}`}>
                    <td className="px-4 py-3 font-mono text-stone-600">{bill.bill_number}</td>
                    <td className="px-4 py-3 font-medium text-stone-800">{bill.supplier_name}</td>
                    <td className="px-4 py-3 text-stone-500">{bill.issue_date ? new Date(bill.issue_date).toLocaleDateString() : '-'}</td>
                    <td className={`px-4 py-3 ${isOverdue ? 'text-red-600 font-medium' : 'text-stone-500'}`}>
                      {bill.due_date ? new Date(bill.due_date).toLocaleDateString() : '-'}
                      {isOverdue && <AlertTriangle className="inline w-3.5 h-3.5 ml-1" />}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{bill.currency || 'SAR'} {bill.total?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-medium text-red-600">{bill.balance_due > 0 ? `${bill.currency || 'SAR'} ${bill.balance_due.toLocaleString()}` : '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${STATUS_COLORS[bill.status] || ''}`}>{bill.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setShowDetail(bill)} className="p-1.5 rounded-md hover:bg-stone-100" data-testid={`view-bill-${bill.id}`}>
                          <Eye className="w-3.5 h-3.5 text-stone-400" />
                        </button>
                        {bill.status !== 'paid' && (
                          <button onClick={() => openPay(bill)} className="p-1.5 rounded-md hover:bg-green-50" data-testid={`pay-bill-${bill.id}`}>
                            <DollarSign className="w-3.5 h-3.5 text-green-600" />
                          </button>
                        )}
                        <button onClick={() => handleDelete(bill.id)} className="p-1.5 rounded-md hover:bg-red-50" data-testid={`delete-bill-${bill.id}`}>
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 py-3 border-t border-stone-100">
              {Array.from({length: pages}, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-sm ${p === page ? 'bg-orange-500 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{p}</button>
              ))}
            </div>
          )}
        </div>

        {/* New Bill Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-2xl" data-testid="bill-modal">
            <DialogHeader><DialogTitle>New Bill</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-stone-600 mb-1 block">Supplier *</label>
                  <Select value={form.supplier_id} onValueChange={v => {
                    const sup = suppliers.find(s => s.id === v);
                    setForm({...form, supplier_id: v, supplier_name: sup?.name || ''});
                  }}>
                    <SelectTrigger data-testid="supplier-select"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-stone-600 mb-1 block">Currency</label>
                  <Select value={form.currency} onValueChange={v => setForm({...form, currency: v})}>
                    <SelectTrigger data-testid="currency-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['SAR', 'AED', 'KWD', 'BHD', 'OMR', 'QAR', 'USD', 'EUR'].map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-stone-600 mb-1 block">Due Date</label>
                  <Input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} data-testid="due-date-input" />
                </div>
                <div>
                  <label className="text-sm font-medium text-stone-600 mb-1 block">Payment Terms</label>
                  <Select value={form.payment_terms} onValueChange={v => setForm({...form, payment_terms: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TERMS.map(pt => <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-stone-600 mb-1 block">VAT Rate (%)</label>
                  <Input type="number" value={form.tax_rate} onChange={e => setForm({...form, tax_rate: parseFloat(e.target.value) || 0})} data-testid="tax-rate-input" />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-stone-600">Line Items</label>
                  <Button size="sm" variant="outline" onClick={addItem} data-testid="add-line-item"><Plus className="w-3 h-3 mr-1" /> Add Item</Button>
                </div>
                <div className="space-y-2">
                  {form.items.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <Input className="col-span-5" placeholder="Description" value={item.description}
                        onChange={e => updateItem(i, 'description', e.target.value)} data-testid={`item-desc-${i}`} />
                      <Input className="col-span-2" type="number" placeholder="Qty" value={item.quantity}
                        onChange={e => updateItem(i, 'quantity', e.target.value)} data-testid={`item-qty-${i}`} />
                      <Input className="col-span-3" type="number" placeholder="Price" value={item.unit_price}
                        onChange={e => updateItem(i, 'unit_price', e.target.value)} data-testid={`item-price-${i}`} />
                      <div className="col-span-1 text-right text-sm font-medium">{(item.quantity * item.unit_price).toFixed(2)}</div>
                      <button className="col-span-1" onClick={() => removeItem(i)}><Trash2 className="w-4 h-4 text-red-400" /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="bg-stone-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-stone-500">Subtotal</span><span className="font-medium">{form.currency} {subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-stone-500">VAT ({form.tax_rate}%)</span><span className="font-medium">{form.currency} {taxAmount.toFixed(2)}</span></div>
                {form.discount > 0 && <div className="flex justify-between"><span className="text-stone-500">Discount</span><span className="font-medium text-green-600">-{form.currency} {form.discount.toFixed(2)}</span></div>}
                <div className="flex justify-between border-t border-stone-200 pt-2"><span className="font-bold">Total</span><span className="font-bold text-lg">{form.currency} {billTotal.toFixed(2)}</span></div>
              </div>

              <div>
                <label className="text-sm font-medium text-stone-600 mb-1 block">Notes</label>
                <Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Optional notes" data-testid="notes-input" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleSave} className="bg-orange-500 hover:bg-orange-600 text-white" data-testid="save-bill-btn">Create Bill</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payment Modal */}
        <Dialog open={showPayModal} onOpenChange={setShowPayModal}>
          <DialogContent data-testid="payment-modal">
            <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
            {payBill && (
              <div className="space-y-4 py-2">
                <div className="bg-stone-50 rounded-lg p-3 text-sm">
                  <p className="font-medium">{payBill.supplier_name} - {payBill.bill_number}</p>
                  <p className="text-stone-500">Balance: {payBill.currency || 'SAR'} {payBill.balance_due?.toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-stone-600 mb-1 block">Amount</label>
                  <Input type="number" value={payForm.amount} onChange={e => setPayForm({...payForm, amount: parseFloat(e.target.value) || 0})} data-testid="payment-amount" />
                </div>
                <div>
                  <label className="text-sm font-medium text-stone-600 mb-1 block">Method</label>
                  <Select value={payForm.method} onValueChange={v => setPayForm({...payForm, method: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-stone-600 mb-1 block">Reference</label>
                  <Input value={payForm.reference} onChange={e => setPayForm({...payForm, reference: e.target.value})} placeholder="Payment reference" data-testid="payment-reference" />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPayModal(false)}>Cancel</Button>
              <Button onClick={handlePayment} className="bg-green-600 hover:bg-green-700 text-white" data-testid="confirm-payment-btn">Record Payment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bill Detail Modal */}
        <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
          <DialogContent className="max-w-lg" data-testid="bill-detail-modal">
            <DialogHeader><DialogTitle>Bill Details</DialogTitle></DialogHeader>
            {showDetail && (
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-stone-500">Bill #:</span> <span className="font-medium">{showDetail.bill_number}</span></div>
                  <div><span className="text-stone-500">Supplier:</span> <span className="font-medium">{showDetail.supplier_name}</span></div>
                  <div><span className="text-stone-500">Issue Date:</span> <span>{showDetail.issue_date ? new Date(showDetail.issue_date).toLocaleDateString() : '-'}</span></div>
                  <div><span className="text-stone-500">Due Date:</span> <span>{showDetail.due_date ? new Date(showDetail.due_date).toLocaleDateString() : '-'}</span></div>
                  <div><span className="text-stone-500">Status:</span> <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${STATUS_COLORS[showDetail.status]}`}>{showDetail.status}</span></div>
                  <div><span className="text-stone-500">Currency:</span> <span>{showDetail.currency || 'SAR'}</span></div>
                </div>
                <div className="border-t pt-3">
                  <p className="text-sm font-medium mb-2">Items</p>
                  {(showDetail.items || []).map((it, i) => (
                    <div key={i} className="flex justify-between text-sm py-1 border-b border-stone-50">
                      <span>{it.description}</span>
                      <span>{it.quantity} x {it.unit_price} = {(it.quantity * it.unit_price).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-stone-50 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span>Subtotal</span><span>{showDetail.subtotal?.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>VAT ({showDetail.tax_rate}%)</span><span>{showDetail.tax_amount?.toFixed(2)}</span></div>
                  <div className="flex justify-between font-bold border-t pt-1"><span>Total</span><span>{showDetail.currency || 'SAR'} {showDetail.total?.toFixed(2)}</span></div>
                  <div className="flex justify-between text-green-600"><span>Paid</span><span>{showDetail.amount_paid?.toFixed(2)}</span></div>
                  <div className="flex justify-between text-red-600 font-bold"><span>Balance</span><span>{showDetail.balance_due?.toFixed(2)}</span></div>
                </div>
                {showDetail.payments?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Payment History</p>
                    {showDetail.payments.map((p, i) => (
                      <div key={i} className="flex justify-between text-sm py-1.5 border-b border-stone-50">
                        <span>{new Date(p.date).toLocaleDateString()} - {p.method}</span>
                        <span className="text-green-600 font-medium">{(showDetail.currency || 'SAR')} {p.amount?.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
