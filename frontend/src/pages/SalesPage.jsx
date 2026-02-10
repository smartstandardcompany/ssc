import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, DollarSign, X } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function SalesPage() {
  const [sales, setSales] = useState([]);
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [receivingSale, setReceivingSale] = useState(null);
  const [activeTab, setActiveTab] = useState('branch');

  const [formData, setFormData] = useState({
    sale_type: 'branch',
    branch_id: '',
    customer_id: '',
    payment_details: [{ mode: 'cash', amount: '' }],
    discount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [receivePayment, setReceivePayment] = useState({ payment_mode: 'cash', amount: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [salesRes, branchesRes, customersRes] = await Promise.all([
        api.get('/sales'),
        api.get('/branches'),
        api.get('/customers'),
      ]);
      setSales(salesRes.data);
      setBranches(branchesRes.data);
      setCustomers(customersRes.data);
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
    let cash = 0, bank = 0, credit = 0;
    
    formData.payment_details.forEach(p => {
      const amount = parseFloat(p.amount) || 0;
      if (p.mode === 'cash') cash += amount;
      else if (p.mode === 'bank') bank += amount;
      else if (p.mode === 'credit') credit += amount;
    });

    const total = cash + bank + credit;
    return { cash, bank, credit, total };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const totals = calculateTotals();
    
    if (totals.total === 0) {
      toast.error('Please add at least one payment entry');
      return;
    }

    try {
      const payload = {
        ...formData,
        amount: totals.total,
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
      payment_details: [{ mode: 'cash', amount: '' }],
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="sales-page-title">Sales Management</h1>
            <p className="text-muted-foreground">Track sales with flexible payment options</p>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            data-testid="add-sale-button"
            className="rounded-full"
          >
            <Plus size={18} className="mr-2" />
            Add Sale
          </Button>
        </div>

        {showForm && (
          <Card className="border-border" data-testid="sale-form-card">
            <CardHeader>
              <CardTitle className="font-outfit">Add New Sale</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setFormData({ ...formData, sale_type: val }); }}>
                <TabsList className="mb-6">
                  <TabsTrigger value="branch" data-testid="branch-sale-tab">Branch Sale</TabsTrigger>
                  <TabsTrigger value="online" data-testid="online-sale-tab">Online Sale</TabsTrigger>
                </TabsList>

                <form onSubmit={handleSubmit}>
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Branch *</Label>
                        <Select value={formData.branch_id} onValueChange={(val) => setFormData({ ...formData, branch_id: val })} required>
                          <SelectTrigger data-testid="branch-select">
                            <SelectValue placeholder="Select branch" />
                          </SelectTrigger>
                          <SelectContent>
                            {branches.map((branch) => (
                              <SelectItem key={branch.id} value={branch.id}>
                                {branch.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <TabsContent value="online" className="mt-0">
                        <div>
                          <Label>Customer *</Label>
                          <Select value={formData.customer_id} onValueChange={(val) => setFormData({ ...formData, customer_id: val })} required={activeTab === 'online'}>
                            <SelectTrigger data-testid="customer-select">
                              <SelectValue placeholder="Select customer" />
                            </SelectTrigger>
                            <SelectContent>
                              {customers.map((customer) => (
                                <SelectItem key={customer.id} value={customer.id}>
                                  {customer.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TabsContent>

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
                                  <SelectItem value="credit">Credit</SelectItem>
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
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="p-2 bg-cash/10 rounded border border-cash/30">
                              <div className="text-xs text-muted-foreground">Cash</div>
                              <div className="font-bold text-cash">${totals.cash.toFixed(2)}</div>
                            </div>
                            <div className="p-2 bg-bank/10 rounded border border-bank/30">
                              <div className="text-xs text-muted-foreground">Bank</div>
                              <div className="font-bold text-bank">${totals.bank.toFixed(2)}</div>
                            </div>
                            <div className="p-2 bg-credit/10 rounded border border-credit/30">
                              <div className="text-xs text-muted-foreground">Credit</div>
                              <div className="font-bold text-credit">${totals.credit.toFixed(2)}</div>
                            </div>
                          </div>
                          <div className="flex justify-between text-lg font-bold pt-2 border-t">
                            <span>Total Sale Amount:</span>
                            <span className="text-primary">${totals.total.toFixed(2)}</span>
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
                    <th className="text-left p-3 font-medium text-sm">Payment</th>
                    <th className="text-left p-3 font-medium text-sm">Credit</th>
                    <th className="text-right p-3 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => {
                    const branchName = branches.find((b) => b.id === sale.branch_id)?.name || '-';
                    const customerName = customers.find((c) => c.id === sale.customer_id)?.name || '-';
                    const remainingCredit = getRemainingCredit(sale);
                    
                    return (
                      <tr key={sale.id} className="border-b border-border hover:bg-secondary/50" data-testid="sale-row">
                        <td className="p-3 text-sm">{format(new Date(sale.date), 'MMM dd, yyyy')}</td>
                        <td className="p-3 text-sm capitalize">{sale.sale_type}</td>
                        <td className="p-3 text-sm">{branchName}</td>
                        <td className="p-3 text-sm">{sale.sale_type === 'online' ? customerName : '-'}</td>
                        <td className="p-3 text-sm text-right font-medium">${sale.amount.toFixed(2)}</td>
                        <td className="p-3">
                          <div className="flex gap-1 flex-wrap">
                            {sale.payment_details?.map((p, i) => (
                              <span key={i} className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${
                                p.mode === 'cash' ? 'bg-cash/20 text-cash border-cash/30' : 
                                p.mode === 'bank' ? 'bg-bank/20 text-bank border-bank/30' :
                                'bg-credit/20 text-credit border-credit/30'
                              }`}>
                                {p.mode}: ${p.amount.toFixed(2)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3">
                          {remainingCredit > 0 ? (
                            <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-credit/20 text-credit border border-credit/30">
                              ${remainingCredit.toFixed(2)}
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
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
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
                  Sale Amount: <span className="font-medium text-foreground">${receivingSale?.amount?.toFixed(2)}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Remaining Credit: <span className="font-bold text-credit">${getRemainingCredit(receivingSale || {}).toFixed(2)}</span>
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
