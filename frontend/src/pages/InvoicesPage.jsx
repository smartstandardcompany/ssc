import { useEffect, useState, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, X, FileText, DollarSign, Printer, Image, Upload } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { BranchFilter } from '@/components/BranchFilter';
import { DateFilter } from '@/components/DateFilter';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [masterItems, setMasterItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [receivingInvoice, setReceivingInvoice] = useState(null);
  const [receiveData, setReceiveData] = useState({ payment_mode: 'cash', amount: '', discount: '' });
  const [newItem, setNewItem] = useState({ name: '', unit_price: '', category: '' });
  const [customerSearch, setCustomerSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState([]);
  const [dateFilter, setDateFilter] = useState({ start: null, end: null, period: 'all' });
  const [printInvoice, setPrintInvoice] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [companySettings, setCompanySettings] = useState({});
  const [scanning, setScanning] = useState(false);
  const [formData, setFormData] = useState({
    branch_id: '', customer_id: '', payment_mode: 'cash', discount: '',
    date: new Date().toISOString().split('T')[0], notes: '',
    items: [{ description: '', quantity: 1, unit_price: '' }]
  });

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin' || user.role === 'manager';

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [iRes, bRes, cRes, itemsRes, coRes] = await Promise.all([api.get('/invoices'), api.get('/branches'), api.get('/customers'), api.get('/items'), api.get('/settings/company').catch(() => ({ data: {} }))]);
      setInvoices(iRes.data); setBranches(bRes.data); setCustomers(cRes.data); setMasterItems(itemsRes.data);
      if (coRes.data) setCompanySettings(coRes.data);
    } catch { toast.error('Failed to fetch data'); }
    finally { setLoading(false); }
  };

  const addItem = () => setFormData({ ...formData, items: [...formData.items, { description: '', quantity: 1, unit_price: '' }] });
  const removeItem = (i) => setFormData({ ...formData, items: formData.items.filter((_, idx) => idx !== i) });
  const updateItem = (i, field, val) => {
    const items = [...formData.items];
    items[i][field] = val;
    setFormData({ ...formData, items });
  };
  const selectMasterItem = (i, itemId) => {
    const mi = masterItems.find(m => m.id === itemId);
    if (mi) {
      const items = [...formData.items];
      items[i] = { description: mi.name, quantity: items[i].quantity || 1, unit_price: mi.unit_price };
      setFormData({ ...formData, items });
    }
  };
  const handleAddMasterItem = async () => {
    if (!newItem.name) return;
    try {
      await api.post('/items', { ...newItem, unit_price: parseFloat(newItem.unit_price) || 0 });
      toast.success('Item added');
      setNewItem({ name: '', unit_price: '', category: '' });
      setShowItemForm(false);
      const res = await api.get('/items');
      setMasterItems(res.data);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };
  const filteredCustomers = customers.filter(c => !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase()));

  const handleOcrScan = async (file) => {
    if (!file) return;
    setScanning(true);
    toast.loading('Scanning invoice with AI...', { id: 'ocr-scan' });
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
      });
      const { data } = await api.post('/invoices/ocr-scan', { image: base64 });
      // Auto-fill form
      const items = (data.items || []).map(item => ({
        description: item.description || item.name || '',
        quantity: item.quantity || 1,
        unit_price: item.unit_price || item.total || ''
      }));
      if (items.length === 0) items.push({ description: '', quantity: 1, unit_price: '' });
      setFormData(prev => ({
        ...prev,
        items,
        discount: data.discount || '',
        notes: data.notes || prev.notes,
        payment_mode: data.payment_mode || prev.payment_mode,
        date: data.date || prev.date,
        customer_id: data.customer_name ? (customers.find(c => c.name.toLowerCase().includes((data.customer_name || '').toLowerCase()))?.id || prev.customer_id) : prev.customer_id,
      }));
      toast.success(`Scanned ${items.length} items from invoice`, { id: 'ocr-scan' });
      setShowForm(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'OCR scan failed', { id: 'ocr-scan' });
    } finally {
      setScanning(false);
    }
  };

  const calcTotals = () => {
    const subtotal = formData.items.reduce((s, item) => s + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 0);
    const discount = parseFloat(formData.discount) || 0;
    const total = subtotal - discount;
    const vatEnabled = companySettings.vat_enabled;
    const vatRate = parseFloat(companySettings.vat_rate || 15);
    const vatAmount = vatEnabled ? Math.round(total * vatRate / 100 * 100) / 100 : 0;
    return { subtotal, discount, total, vatEnabled, vatRate, vatAmount, totalWithVat: total + vatAmount };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const totals = calcTotals();
    if (totals.subtotal === 0) { toast.error('Add at least one item'); return; }
    try {
      const payload = {
        branch_id: formData.branch_id || null,
        customer_id: formData.customer_id || null,
        items: formData.items.filter(i => i.description && parseFloat(i.unit_price) > 0).map(i => ({ description: i.description, quantity: parseFloat(i.quantity) || 1, unit_price: parseFloat(i.unit_price) })),
        discount: totals.discount,
        payment_mode: formData.payment_mode,
        date: new Date(formData.date).toISOString(),
        notes: formData.notes || null
      };
      await api.post('/invoices', payload);
      toast.success('Invoice created & sale recorded');
      setShowForm(false);
      setFormData({ branch_id: '', customer_id: '', payment_mode: 'cash', discount: '', date: new Date().toISOString().split('T')[0], notes: '', items: [{ description: '', quantity: 1, unit_price: '' }] });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete invoice and linked sale?')) {
      try { await api.delete(`/invoices/${id}`); toast.success('Deleted'); fetchData(); }
      catch { toast.error('Failed'); }
    }
  };

  const handleReceiveCredit = async (e) => {
    e.preventDefault();
    if (!receivingInvoice?.sale_id) return;
    try {
      const amount = parseFloat(receiveData.amount) || 0;
      const discount = parseFloat(receiveData.discount) || 0;
      await api.post(`/sales/${receivingInvoice.sale_id}/receive-credit`, { payment_mode: receiveData.payment_mode, amount, discount });
      toast.success(`SAR ${(amount + discount).toFixed(2)} settled`);
      setShowReceiveDialog(false);
      setReceiveData({ payment_mode: 'cash', amount: '', discount: '' });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  // Get credit remaining for an invoice by checking its linked sale
  const [salesData, setSalesData] = useState([]);
  const [uploadingId, setUploadingId] = useState(null);
  const [viewImage, setViewImage] = useState(null);
  const imageInputRef = useRef(null);
  useEffect(() => {
    api.get('/sales').then(r => setSalesData(r.data)).catch(() => {});
  }, [invoices]);
  const getCreditRemaining = (inv) => {
    if (!inv.sale_id) return 0;
    const sale = salesData.find(s => s.id === inv.sale_id);
    if (!sale) return 0;
    return (sale.credit_amount || 0) - (sale.credit_received || 0);
  };

  const handleImageUpload = async (invoiceId, file) => {
    if (!file) return;
    setUploadingId(invoiceId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post(`/invoices/${invoiceId}/upload-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Image uploaded to invoice');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploadingId(null);
    }
  };

  const handleDeleteImage = async (invoiceId) => {
    try {
      await api.delete(`/invoices/${invoiceId}/image`);
      toast.success('Image removed');
      fetchData();
    } catch {
      toast.error('Failed to remove image');
    }
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  const totals = calcTotals();
  const filtered = invoices.filter(inv => {
    if (branchFilter.length > 0 && !branchFilter.includes(inv.branch_id)) return false;
    if (dateFilter.start && dateFilter.end) { const d = new Date(inv.date); return d >= dateFilter.start && d <= dateFilter.end; }
    return true;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit mb-1" data-testid="invoices-title">Invoices</h1>
            <p className="text-sm text-muted-foreground">Create invoices with items - auto-added as sales</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <BranchFilter onChange={setBranchFilter} />
            <DateFilter onFilterChange={setDateFilter} />
            <Button onClick={() => setShowForm(!showForm)} className="rounded-full" size="sm" data-testid="create-invoice-btn"><Plus size={16} className="mr-1" />New Invoice</Button>
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && handleOcrScan(e.target.files[0])} />
              <Button variant="outline" className="rounded-full" size="sm" asChild disabled={scanning} data-testid="ocr-scan-btn">
                <span>{scanning ? 'Scanning...' : <><Image size={16} className="mr-1" />Scan Invoice (AI)</>}</span>
              </Button>
            </label>
          </div>
        </div>

        {showForm && (
          <Card className="border-border" data-testid="invoice-form">
            <CardHeader><CardTitle className="font-outfit">Create Invoice</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><Label>Branch *</Label>
                    <Select value={formData.branch_id || "none"} onValueChange={(v) => setFormData({ ...formData, branch_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                      <SelectContent><SelectItem value="none">No Branch</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Customer</Label>
                    <Input placeholder="Search customer..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="h-9 mb-1" data-testid="customer-search" />
                    <Select value={formData.customer_id || "none"} onValueChange={(v) => setFormData({ ...formData, customer_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                      <SelectContent><SelectItem value="none">Walk-in</SelectItem>{filteredCustomers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Payment Mode</Label>
                    <Select value={formData.payment_mode} onValueChange={(v) => setFormData({ ...formData, payment_mode: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank</SelectItem><SelectItem value="credit">Credit</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>Date</Label><Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} /></div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <Label>Items</Label>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={addItem} className="rounded-full"><Plus size={14} className="mr-1" />Add Row</Button>
                      {isAdmin && <Button type="button" size="sm" variant="outline" onClick={() => setShowItemForm(!showItemForm)} className="rounded-full text-primary"><Plus size={14} className="mr-1" />New Product</Button>}
                    </div>
                  </div>
                  {showItemForm && isAdmin && (
                    <div className="flex gap-2 items-end p-3 bg-primary/5 rounded-lg border border-primary/20 mb-3">
                      <div className="flex-1"><Label className="text-xs">Product Name</Label><Input value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="Product name" className="h-8" /></div>
                      <div className="w-28"><Label className="text-xs">Price</Label><Input type="number" step="0.01" value={newItem.unit_price} onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })} placeholder="0.00" className="h-8" /></div>
                      <Button type="button" size="sm" onClick={handleAddMasterItem} className="h-8 rounded-full">Save</Button>
                    </div>
                  )}
                  {masterItems.length > 0 && (
                    <div className="mb-3 p-3 bg-secondary/30 rounded-lg border">
                      <p className="text-xs text-muted-foreground mb-2">Click items to add to invoice:</p>
                      <div className="flex gap-2 flex-wrap">
                        {masterItems.filter(m => m.active !== false).map((m, idx) => {
                          const colors = ['bg-primary/10 border-primary/30 text-primary hover:bg-primary/20', 'bg-success/10 border-success/30 text-success hover:bg-success/20', 'bg-info/10 border-info/30 text-info hover:bg-info/20', 'bg-warning/10 border-warning/30 text-warning hover:bg-warning/20', 'bg-error/10 border-error/30 text-error hover:bg-error/20', 'bg-cash/10 border-cash/30 text-cash hover:bg-cash/20', 'bg-bank/10 border-bank/30 text-bank hover:bg-bank/20'];
                          const isSelected = formData.items.some(i => i.description === m.name);
                          return (
                            <Button key={m.id} type="button" size="sm" variant="outline"
                              className={`h-9 text-xs rounded-full border-2 transition-all ${isSelected ? 'ring-2 ring-primary ring-offset-1 font-bold' : ''} ${colors[idx % colors.length]}`}
                              data-testid={`quick-item-SAR {m.id}`}
                              onClick={() => setFormData({ ...formData, items: [...formData.items.filter(i => i.description), { description: m.name, quantity: 1, unit_price: m.unit_price }] })}>
                              {m.name} - SAR {m.unit_price}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead><tr className="bg-secondary/50 border-b">
                        <th className="text-left p-2 text-xs font-medium">Description</th>
                        <th className="text-center p-2 text-xs font-medium w-20">Qty</th>
                        <th className="text-right p-2 text-xs font-medium w-28">Unit Price</th>
                        <th className="text-right p-2 text-xs font-medium w-28">Total</th>
                        <th className="w-10"></th>
                      </tr></thead>
                      <tbody>
                        {formData.items.map((item, i) => (
                          <tr key={i} className="border-b">
                            <td className="p-1">
                              {masterItems.length > 0 ? (
                                <Select value="" onValueChange={(v) => selectMasterItem(i, v)}>
                                  <SelectTrigger className="h-8 border-0"><SelectValue placeholder={item.description || "Select item"} /></SelectTrigger>
                                  <SelectContent>{masterItems.filter(m => m.active !== false).map(m => <SelectItem key={m.id} value={m.id}>{m.name} - SAR {m.unit_price}</SelectItem>)}</SelectContent>
                                </Select>
                              ) : (
                                <Input value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} placeholder="Item description" className="h-8 border-0" data-testid={`item-desc-SAR {i}`} />
                              )}
                            </td>
                            <td className="p-1"><Input type="number" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} className="h-8 border-0 text-center" /></td>
                            <td className="p-1"><Input type="number" step="0.01" value={item.unit_price} onChange={(e) => updateItem(i, 'unit_price', e.target.value)} placeholder="0.00" className="h-8 border-0 text-right" data-testid={`item-price-SAR {i}`} /></td>
                            <td className="p-2 text-right text-sm font-medium"> SAR {((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)).toFixed(2)}</td>
                            <td className="p-1">{formData.items.length > 1 && <Button type="button" size="sm" variant="ghost" onClick={() => removeItem(i)} className="h-6 w-6 p-0 text-error"><X size={14} /></Button>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="p-3 bg-secondary/30 space-y-1 text-sm">
                      <div className="flex justify-between"><span>Subtotal:</span><span className="font-medium"> SAR {totals.subtotal.toFixed(2)}</span></div>
                      <div className="flex items-center gap-2"><span>Discount:</span><Input type="number" step="0.01" value={formData.discount} onChange={(e) => setFormData({ ...formData, discount: e.target.value })} className="h-7 w-24 text-right" placeholder="0.00" data-testid="invoice-discount" /></div>
                      <div className="flex justify-between"><span>Net:</span><span className="font-medium"> SAR {totals.total.toFixed(2)}</span></div>
                      {totals.vatEnabled && (
                        <div className="flex justify-between text-blue-600"><span>VAT ({totals.vatRate}%):</span><span className="font-medium">SAR {totals.vatAmount.toFixed(2)}</span></div>
                      )}
                      <div className="flex justify-between text-lg font-bold border-t pt-1"><span>Total{totals.vatEnabled ? ' (incl. VAT)' : ''}:</span><span className="text-primary"> SAR {(totals.vatEnabled ? totals.totalWithVat : totals.total).toFixed(2)}</span></div>
                    </div>
                  </div>
                </div>

                <div><Label>Notes</Label><Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Optional" /></div>
                <div className="flex gap-3">
                  <Button type="submit" className="rounded-full" data-testid="submit-invoice">Create Invoice & Record Sale</Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="rounded-full">Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="border-border">
          <CardHeader><CardTitle className="font-outfit">All Invoices</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="invoices-table">
                <thead><tr className="border-b border-border">
                  <th className="text-left p-3 font-medium text-sm">Invoice #</th>
                  <th className="text-left p-3 font-medium text-sm">Date</th>
                  <th className="text-left p-3 font-medium text-sm">Customer</th>
                  <th className="text-center p-3 font-medium text-sm">Items</th>
                  <th className="text-right p-3 font-medium text-sm">Subtotal</th>
                  <th className="text-right p-3 font-medium text-sm">Discount</th>
                  <th className="text-right p-3 font-medium text-sm">Total</th>
                  <th className="text-right p-3 font-medium text-sm">VAT</th>
                  <th className="text-left p-3 font-medium text-sm">Payment</th>
                  <th className="text-center p-3 font-medium text-sm">Img</th>
                  <th className="text-right p-3 font-medium text-sm">Credit Due</th>
                  <th className="text-right p-3 font-medium text-sm">Actions</th>
                </tr></thead>
                <tbody>
                  {filtered.map(inv => {
                    const creditRem = getCreditRemaining(inv);
                    return (
                    <tr key={inv.id} className="border-b border-border hover:bg-secondary/50" data-testid="invoice-row">
                      <td className="p-3 text-sm font-medium text-primary">{inv.invoice_number}</td>
                      <td className="p-3 text-sm">{format(new Date(inv.date), 'MMM dd, yyyy')}</td>
                      <td className="p-3 text-sm">{inv.customer_name || 'Walk-in'}</td>
                      <td className="p-3 text-center"><Badge variant="secondary">{inv.items?.length || 0}</Badge></td>
                      <td className="p-3 text-sm text-right"> SAR {inv.subtotal.toFixed(2)}</td>
                      <td className="p-3 text-sm text-right text-error">{inv.discount > 0 ? `-SAR ${inv.discount.toFixed(2)}` : '-'}</td>
                      <td className="p-3 text-sm text-right font-bold"> SAR {(inv.total_with_vat || inv.total)?.toFixed(2)}</td>
                      <td className="p-3 text-sm text-right text-blue-600">{(inv.vat_amount || 0) > 0 ? `SAR ${inv.vat_amount.toFixed(2)}` : '-'}</td>
                      <td className="p-3"><Badge className={inv.payment_mode === 'cash' ? 'bg-cash/20 text-cash' : inv.payment_mode === 'bank' ? 'bg-bank/20 text-bank' : 'bg-credit/20 text-credit'}>{inv.payment_mode}</Badge></td>
                      <td className="p-3 text-center">
                        {inv.image_url ? (
                          <button onClick={() => setViewImage(inv)} className="inline-flex items-center justify-center" data-testid={`view-image-${inv.id}`}>
                            <img src={`${process.env.REACT_APP_BACKEND_URL}${inv.image_url}`} alt="" className="w-8 h-8 rounded object-cover border border-stone-200 hover:ring-2 hover:ring-orange-300 transition-all" />
                          </button>
                        ) : (
                          <label className="cursor-pointer inline-flex items-center justify-center">
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && handleImageUpload(inv.id, e.target.files[0])} />
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded border border-dashed border-stone-300 text-stone-400 hover:border-orange-400 hover:text-orange-500 transition-all ${uploadingId === inv.id ? 'animate-pulse' : ''}`} data-testid={`upload-image-${inv.id}`}>
                              <Upload size={14} />
                            </span>
                          </label>
                        )}
                      </td>
                      <td className="p-3 text-right">{creditRem > 0 ? <span className="font-bold text-warning"> SAR {creditRem.toFixed(2)}</span> : <span className="text-muted-foreground">-</span>}</td>
                      <td className="p-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="outline" className="h-8 text-xs" data-testid="print-invoice-btn"
                            onClick={async () => {
                              setPrintInvoice(inv);
                              try {
                                const { data: qr } = await api.get(`/invoices/${inv.id}/zatca-qr`);
                                setQrData(qr.qr_data);
                              } catch { setQrData(null); }
                            }}>
                            <Printer size={14} className="mr-1" />Print
                          </Button>
                          {creditRem > 0 && (
                            <Button size="sm" variant="outline" onClick={() => { setReceivingInvoice({ ...inv, credit_remaining: creditRem }); setReceiveData({ payment_mode: 'cash', amount: '', discount: '' }); setShowReceiveDialog(true); }} className="h-8 text-xs" data-testid="receive-invoice-credit">
                              <DollarSign size={14} className="mr-1" />Receive
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => handleDelete(inv.id)} className="h-8 text-error hover:text-error"><Trash2 size={14} /></Button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                  {filtered.length === 0 && <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">No invoices yet</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Receive Credit Dialog */}
        <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
          <DialogContent data-testid="receive-invoice-dialog">
            <DialogHeader><DialogTitle className="font-outfit">Receive Credit - {receivingInvoice?.invoice_number}</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Customer: {receivingInvoice?.customer_name || 'Walk-in'} | Outstanding: <span className="font-bold text-warning"> SAR {receivingInvoice?.credit_remaining?.toFixed(2)}</span></p>
            <form onSubmit={handleReceiveCredit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Payment Amount</Label><Input type="number" step="0.01" value={receiveData.amount} onChange={(e) => setReceiveData({ ...receiveData, amount: e.target.value })} placeholder="0.00" /></div>
                <div><Label>Discount</Label><Input type="number" step="0.01" value={receiveData.discount} onChange={(e) => setReceiveData({ ...receiveData, discount: e.target.value })} placeholder="0.00" /></div>
              </div>
              {(parseFloat(receiveData.amount) > 0 || parseFloat(receiveData.discount) > 0) && (
                <div className="p-3 bg-secondary/50 rounded-lg space-y-1 text-sm">
                  <div className="flex justify-between"><span>Payment:</span><span> SAR {(parseFloat(receiveData.amount) || 0).toFixed(2)}</span></div>
                  {parseFloat(receiveData.discount) > 0 && <div className="flex justify-between"><span>Discount:</span><span className="text-error">-SAR {(parseFloat(receiveData.discount) || 0).toFixed(2)}</span></div>}
                  <div className="flex justify-between border-t pt-1 font-bold"><span>Total Settled:</span><span className="text-success"> SAR {((parseFloat(receiveData.amount) || 0) + (parseFloat(receiveData.discount) || 0)).toFixed(2)}</span></div>
                </div>
              )}
              <div><Label>Payment Mode</Label>
                <Select value={receiveData.payment_mode} onValueChange={(v) => setReceiveData({ ...receiveData, payment_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <Button type="submit" className="rounded-full">Receive Payment</Button>
                <Button type="button" variant="outline" onClick={() => setShowReceiveDialog(false)} className="rounded-full">Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ZATCA Invoice Print Dialog */}
        <Dialog open={!!printInvoice} onOpenChange={(v) => !v && setPrintInvoice(null)}>
          <DialogContent className="max-w-lg" data-testid="print-invoice-dialog">
            <DialogHeader><DialogTitle className="font-outfit">Tax Invoice / فاتورة ضريبية</DialogTitle></DialogHeader>
            {printInvoice && (
              <div id="invoice-print-area">
                <div className="border rounded-lg p-4 space-y-3 text-sm bg-white" data-testid="invoice-preview">
                  {/* Header */}
                  <div className="text-center border-b pb-3">
                    <p className="text-lg font-bold">{companySettings.company_name || 'SSC Track'}</p>
                    <p className="text-xs text-muted-foreground">{companySettings.address || ''}</p>
                    {companySettings.vat_number && <p className="text-xs mt-1">VAT No / الرقم الضريبي: <strong>{companySettings.vat_number}</strong></p>}
                    <p className="text-base font-bold mt-2 border-y py-1">TAX INVOICE / فاتورة ضريبية</p>
                  </div>
                  {/* Invoice Info */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div>Invoice No / رقم الفاتورة: <strong>{printInvoice.invoice_number}</strong></div>
                    <div className="text-right">Date / التاريخ: <strong>{new Date(printInvoice.date).toLocaleDateString('en-GB')}</strong></div>
                    <div>Customer / العميل: <strong>{printInvoice.customer_name || 'Walk-in / عميل نقدي'}</strong></div>
                    <div className="text-right">Payment / الدفع: <strong>{printInvoice.payment_mode}</strong></div>
                    {printInvoice.buyer_vat_number && <div>Buyer VAT / ضريبة المشتري: <strong>{printInvoice.buyer_vat_number}</strong></div>}
                  </div>
                  {/* Items Table */}
                  <table className="w-full text-xs border">
                    <thead><tr className="bg-stone-100 border-b">
                      <th className="p-1.5 text-left"># </th>
                      <th className="p-1.5 text-left">Description / الوصف</th>
                      <th className="p-1.5 text-center">Qty / الكمية</th>
                      <th className="p-1.5 text-right">Price / السعر</th>
                      <th className="p-1.5 text-right">Total / المجموع</th>
                    </tr></thead>
                    <tbody>
                      {(printInvoice.items || []).map((item, i) => (
                        <tr key={i} className="border-b"><td className="p-1.5">{i + 1}</td>
                          <td className="p-1.5">{item.description}</td>
                          <td className="p-1.5 text-center">{item.quantity}</td>
                          <td className="p-1.5 text-right">{item.unit_price?.toFixed(2)}</td>
                          <td className="p-1.5 text-right">{item.total?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Totals */}
                  <div className="space-y-1 text-xs border-t pt-2">
                    <div className="flex justify-between"><span>Subtotal / المجموع الفرعي</span><span>SAR {printInvoice.subtotal?.toFixed(2)}</span></div>
                    {printInvoice.discount > 0 && <div className="flex justify-between text-red-600"><span>Discount / الخصم</span><span>-SAR {printInvoice.discount?.toFixed(2)}</span></div>}
                    <div className="flex justify-between"><span>Taxable Amount / المبلغ الخاضع للضريبة</span><span>SAR {printInvoice.total?.toFixed(2)}</span></div>
                    {(printInvoice.vat_amount || 0) > 0 && (
                      <div className="flex justify-between text-blue-600 font-medium"><span>VAT ({printInvoice.vat_rate || 15}%) / ضريبة القيمة المضافة</span><span>SAR {printInvoice.vat_amount?.toFixed(2)}</span></div>
                    )}
                    <div className="flex justify-between text-base font-bold border-t pt-1"><span>Total / الإجمالي</span><span>SAR {(printInvoice.total_with_vat || printInvoice.total)?.toFixed(2)}</span></div>
                  </div>
                  {/* QR Code */}
                  {qrData && (
                    <div className="flex items-center gap-3 border-t pt-2">
                      <QRCodeSVG value={qrData} size={80} data-testid="zatca-qr" />
                      <div className="text-[10px] text-muted-foreground">
                        <p className="font-medium">ZATCA QR / رمز هيئة الزكاة</p>
                        <p>Seller / البائع: {companySettings.company_name || 'SSC Track'}</p>
                        {companySettings.vat_number && <p>VAT No: {companySettings.vat_number}</p>}
                      </div>
                    </div>
                  )}
                  {/* Attached Image */}
                  {printInvoice.image_url && (
                    <div className="border-t pt-2 mt-2">
                      <p className="text-xs font-medium mb-1">Attached Image / صورة مرفقة</p>
                      <img src={`${process.env.REACT_APP_BACKEND_URL}${printInvoice.image_url}`} alt="Invoice attachment" className="max-w-full max-h-48 rounded border" />
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button className="flex-1 rounded-xl" data-testid="print-btn" onClick={() => {
                    const area = document.getElementById('invoice-print-area');
                    if (area) {
                      const w = window.open('', '_blank', 'width=600,height=800');
                      w.document.write(`<html><head><title>${printInvoice.invoice_number}</title><style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:4px}th{background:#f5f5f5;text-align:left}.text-right{text-align:right}.text-center{text-align:center}.bold{font-weight:bold}.border-t{border-top:1px solid #ddd;padding-top:4px;margin-top:4px}svg{display:block}</style></head><body>${area.innerHTML}</body></html>`);
                      w.document.close();
                      w.print();
                    }
                  }}><Printer size={14} className="mr-1" />Print</Button>
                  <Button variant="outline" className="rounded-xl" onClick={() => setPrintInvoice(null)}>Close</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Image Viewer Dialog */}
        <Dialog open={!!viewImage} onOpenChange={(v) => !v && setViewImage(null)}>
          <DialogContent className="max-w-lg" data-testid="image-viewer-dialog">
            <DialogHeader><DialogTitle className="font-outfit">Invoice Image - {viewImage?.invoice_number}</DialogTitle></DialogHeader>
            {viewImage && (
              <div className="space-y-3">
                <img
                  src={`${process.env.REACT_APP_BACKEND_URL}${viewImage.image_url}`}
                  alt={`Invoice ${viewImage.invoice_number}`}
                  className="w-full rounded-lg border"
                  data-testid="invoice-image-preview"
                />
                <div className="flex gap-2">
                  <label className="flex-1 cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      if (e.target.files[0]) {
                        handleImageUpload(viewImage.id, e.target.files[0]);
                        setViewImage(null);
                      }
                    }} />
                    <Button variant="outline" className="w-full rounded-xl" asChild><span><Upload size={14} className="mr-1" />Replace</span></Button>
                  </label>
                  <Button variant="outline" className="rounded-xl text-red-600 hover:text-red-700" data-testid="delete-invoice-image"
                    onClick={() => { handleDeleteImage(viewImage.id); setViewImage(null); }}>
                    <Trash2 size={14} className="mr-1" />Remove
                  </Button>
                  <Button variant="outline" className="rounded-xl" onClick={() => setViewImage(null)}>Close</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
