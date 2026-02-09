import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function SalesPage() {
  const [sales, setSales] = useState([]);
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('branch');

  const [formData, setFormData] = useState({
    sale_type: 'branch',
    branch_id: '',
    customer_id: '',
    amount: '',
    payment_mode: 'cash',
    payment_status: 'received',
    received_mode: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        date: new Date(formData.date).toISOString(),
        payment_status: formData.payment_mode === 'credit' ? 'pending' : 'received',
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
      amount: '',
      payment_mode: 'cash',
      payment_status: 'received',
      received_mode: '',
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

  const handleMarkReceived = async (sale) => {
    const receivedMode = window.prompt('Enter received mode (cash/bank):');
    if (receivedMode && ['cash', 'bank'].includes(receivedMode.toLowerCase())) {
      try {
        await api.put(`/sales/${sale.id}`, {
          payment_status: 'received',
          received_mode: receivedMode.toLowerCase(),
        });
        toast.success('Sale marked as received');
        fetchData();
      } catch (error) {
        toast.error('Failed to update sale');
      }
    } else {
      toast.error('Invalid received mode');
    }
  };

  const getPaymentBadgeClass = (mode) => {
    switch (mode) {
      case 'cash':
        return 'bg-cash/20 text-cash border-cash/30';
      case 'bank':
        return 'bg-bank/20 text-bank border-bank/30';
      case 'credit':
        return 'bg-credit/20 text-credit border-credit/30';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="sales-page-title">Sales Management</h1>
            <p className="text-muted-foreground">Track and manage all your sales transactions</p>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TabsContent value="branch" className="col-span-2 mt-0">
                      <div className="space-y-4">
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
                      </div>
                    </TabsContent>

                    <TabsContent value="online" className="col-span-2 mt-0">
                      <div className="space-y-4">
                        <div>
                          <Label>Customer *</Label>
                          <Select value={formData.customer_id} onValueChange={(val) => setFormData({ ...formData, customer_id: val })} required>
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
                      </div>
                    </TabsContent>

                    <div>
                      <Label>Amount *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        data-testid="amount-input"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <Label>Payment Mode *</Label>
                      <Select value={formData.payment_mode} onValueChange={(val) => setFormData({ ...formData, payment_mode: val })}>
                        <SelectTrigger data-testid="payment-mode-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="bank">Bank</SelectItem>
                          <SelectItem value="credit">Credit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

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
                    <th className="text-left p-3 font-medium text-sm">Branch/Customer</th>
                    <th className="text-right p-3 font-medium text-sm">Amount</th>
                    <th className="text-left p-3 font-medium text-sm">Payment</th>
                    <th className="text-left p-3 font-medium text-sm">Status</th>
                    <th className="text-right p-3 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => {
                    const branchName = branches.find((b) => b.id === sale.branch_id)?.name || '-';
                    const customerName = customers.find((c) => c.id === sale.customer_id)?.name || '-';
                    return (
                      <tr key={sale.id} className="border-b border-border hover:bg-secondary/50" data-testid="sale-row">
                        <td className="p-3 text-sm">{format(new Date(sale.date), 'MMM dd, yyyy')}</td>
                        <td className="p-3 text-sm capitalize">{sale.sale_type}</td>
                        <td className="p-3 text-sm">{sale.sale_type === 'branch' ? branchName : customerName}</td>
                        <td className="p-3 text-sm text-right font-medium">${sale.amount.toFixed(2)}</td>
                        <td className="p-3">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getPaymentBadgeClass(sale.payment_mode)}`}>
                            {sale.payment_mode}
                          </span>
                        </td>
                        <td className="p-3">
                          {sale.payment_status === 'pending' ? (
                            <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-warning/20 text-warning border border-warning/30">
                              Pending
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-success/20 text-success border border-success/30">
                              Received
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex gap-2 justify-end">
                            {sale.payment_status === 'pending' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarkReceived(sale)}
                                data-testid="mark-received-button"
                                className="h-8"
                              >
                                <CheckCircle size={14} className="mr-1" />
                                Mark Received
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
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No sales recorded yet. Add your first sale above!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
