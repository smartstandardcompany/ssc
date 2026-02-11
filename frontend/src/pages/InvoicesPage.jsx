import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, X, FileText, DollarSign } from 'lucide-react';
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
      const [iRes, bRes, cRes, itemsRes] = await Promise.all([api.get('/invoices'), api.get('/branches'), api.get('/customers'), api.get('/items')]);
      setInvoices(iRes.data); setBranches(bRes.data); setCustomers(cRes.data); setMasterItems(itemsRes.data);
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

  const calcTotals = () => {
    const subtotal = formData.items.reduce((s, item) => s + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 0);
    const discount = parseFloat(formData.discount) || 0;
    return { subtotal, discount, total: subtotal - discount };
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
  useEffect(() => {
    api.get('/sales').then(r => setSalesData(r.data)).catch(() => {});
  }, [invoices]);
  const getCreditRemaining = (inv) => {
    if (!inv.sale_id) return 0;
    const sale = salesData.find(s => s.id === inv.sale_id);
    if (!sale) return 0;
    return (sale.credit_amount || 0) - (sale.credit_received || 0);
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
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="invoices-title">Invoices</h1>
            <p className="text-muted-foreground">Create invoices with items - auto-added as sales</p>
          </div>
          <div className="flex gap-3 items-center flex-wrap">
            <BranchFilter onChange={setBranchFilter} />
            <DateFilter onFilterChange={setDateFilter} />
            <Button onClick={() => setShowForm(!showForm)} className="rounded-full" data-testid="create-invoice-btn"><Plus size={18} className="mr-2" />New Invoice</Button>
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
                              {m.name} - ${m.unit_price}
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
                                  <SelectContent>{masterItems.filter(m => m.active !== false).map(m => <SelectItem key={m.id} value={m.id}>{m.name} - ${m.unit_price}</SelectItem>)}</SelectContent>
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
                      <div className="flex justify-between text-lg font-bold border-t pt-1"><span>Total:</span><span className="text-primary"> SAR {totals.total.toFixed(2)}</span></div>
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
                  <th className="text-left p-3 font-medium text-sm">Payment</th>
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
                      <td className="p-3 text-sm text-right font-bold"> SAR {inv.total.toFixed(2)}</td>
                      <td className="p-3"><Badge className={inv.payment_mode === 'cash' ? 'bg-cash/20 text-cash' : inv.payment_mode === 'bank' ? 'bg-bank/20 text-bank' : 'bg-credit/20 text-credit'}>{inv.payment_mode}</Badge></td>
                      <td className="p-3 text-right">{creditRem > 0 ? <span className="font-bold text-warning"> SAR {creditRem.toFixed(2)}</span> : <span className="text-muted-foreground">-</span>}</td>
                      <td className="p-3 text-right">
                        <div className="flex gap-1 justify-end">
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
                  {filtered.length === 0 && <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No invoices yet</td></tr>}
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
      </div>
    </DashboardLayout>
  );
}
