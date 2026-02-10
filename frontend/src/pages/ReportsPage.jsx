import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, FileSpreadsheet, Send } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ReportsPage() {
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    branchId: 'all',
    type: 'all',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [salesRes, expensesRes, paymentsRes, branchesRes] = await Promise.all([
        api.get('/sales'),
        api.get('/expenses'),
        api.get('/supplier-payments'),
        api.get('/branches'),
      ]);
      setSales(salesRes.data);
      setExpenses(expensesRes.data);
      setSupplierPayments(paymentsRes.data);
      setBranches(branchesRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const filterData = (data, dateField = 'date') => {
    return data.filter((item) => {
      const itemDate = new Date(item[dateField]);
      const startMatch = !filters.startDate || itemDate >= new Date(filters.startDate);
      const endMatch = !filters.endDate || itemDate <= new Date(filters.endDate);
      const branchMatch = filters.branchId === 'all' || item.branch_id === filters.branchId;
      return startMatch && endMatch && branchMatch;
    });
  };

  const getFilteredSales = () => {
    let filtered = sales;
    if (filters.type !== 'all') {
      filtered = filtered.filter((s) => s.sale_type === filters.type);
    }
    return filterData(filtered);
  };

  const getFilteredExpenses = () => filterData(expenses);
  const getFilteredSupplierPayments = () => filterData(supplierPayments);

  const calculateStats = () => {
    const filteredSales = getFilteredSales();
    const filteredExpenses = getFilteredExpenses();
    const filteredPayments = getFilteredSupplierPayments();

    const totalSales = filteredSales.reduce((sum, s) => {
      if (s.payment_status === 'received' || s.payment_mode !== 'credit') {
        return sum + s.amount;
      }
      return sum;
    }, 0);

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalSupplierPayments = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
    const netProfit = totalSales - totalExpenses - totalSupplierPayments;

    const cashSales = filteredSales.reduce((sum, s) => {
      if (s.payment_mode === 'cash' || (s.payment_mode === 'credit' && s.received_mode === 'cash')) {
        return sum + s.amount;
      }
      return sum;
    }, 0);

    const bankSales = filteredSales.reduce((sum, s) => {
      if (s.payment_mode === 'bank' || (s.payment_mode === 'credit' && s.received_mode === 'bank')) {
        return sum + s.amount;
      }
      return sum;
    }, 0);

    const creditSales = filteredSales.reduce((sum, s) => {
      if (s.payment_mode === 'credit' && s.payment_status === 'pending') {
        return sum + s.amount;
      }
      return sum;
    }, 0);

    return { totalSales, totalExpenses, totalSupplierPayments, netProfit, cashSales, bankSales, creditSales };
  };

  const getBranchWiseReport = () => {
    const branchSales = {};
    const filteredSales = getFilteredSales().filter((s) => s.sale_type === 'branch');

    branches.forEach((branch) => {
      const sales = filteredSales.filter((s) => s.branch_id === branch.id);
      const total = sales.reduce((sum, s) => {
        if (s.payment_status === 'received' || s.payment_mode !== 'credit') {
          return sum + s.amount;
        }
        return sum;
      }, 0);
      branchSales[branch.name] = { total, count: sales.length };
    });

    return branchSales;
  };

  const getCategoryWiseExpenses = () => {
    const categoryExpenses = {};
    const filteredExpenses = getFilteredExpenses();

    filteredExpenses.forEach((expense) => {
      if (!categoryExpenses[expense.category]) {
        categoryExpenses[expense.category] = 0;
      }
      categoryExpenses[expense.category] += expense.amount;
    });

    return categoryExpenses;
  };

  const handleExport = async (format) => {
    try {
      toast.loading(`Generating ${format.toUpperCase()} report...`);
      
      const response = await api.post('/export/reports', {
        format: format,
        start_date: filters.startDate || null,
        end_date: filters.endDate || null,
        branch_id: filters.branchId !== 'all' ? filters.branchId : null
      }, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sales_report_${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.dismiss();
      toast.success(`${format.toUpperCase()} report downloaded successfully`);
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to export report');
    }
  };

  const handleSendWhatsApp = async () => {
    try {
      toast.loading('Sending WhatsApp report...');
      await api.post('/whatsapp/send-daily-report');
      toast.dismiss();
      toast.success('WhatsApp report sent successfully!');
    } catch (error) {
      toast.dismiss();
      toast.error(error.response?.data?.detail || 'Failed to send WhatsApp report. Please configure Twilio credentials.');
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">Loading...</div>
      </DashboardLayout>
    );
  }

  const stats = calculateStats();
  const branchWiseReport = getBranchWiseReport();
  const categoryWiseExpenses = getCategoryWiseExpenses();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="reports-page-title">Reports & Analytics</h1>
          <p className="text-muted-foreground">View detailed reports and insights</p>
        </div>

        {/* Filters */}
        <Card className="border-border" data-testid="filters-card">
          <CardHeader>
            <CardTitle className="font-outfit">Filter Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  data-testid="start-date-input"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  data-testid="end-date-input"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Branch</Label>
                <Select value={filters.branchId} onValueChange={(val) => setFilters({ ...filters, branchId: val })}>
                  <SelectTrigger data-testid="branch-filter-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sale Type</Label>
                <Select value={filters.type} onValueChange={(val) => setFilters({ ...filters, type: val })}>
                  <SelectTrigger data-testid="type-filter-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="branch">Branch Sales</SelectItem>
                    <SelectItem value="online">Online Sales</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4">
              <Button
                onClick={() => setFilters({ startDate: '', endDate: '', branchId: 'all', type: 'all' })}
                variant="outline"
                data-testid="clear-filters-button"
                className="rounded-full"
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-border" data-testid="report-total-sales-card">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-outfit text-success">${stats.totalSales.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card className="border-border" data-testid="report-total-expenses-card">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-outfit text-error">${stats.totalExpenses.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card className="border-border" data-testid="report-supplier-payments-card">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Supplier Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-outfit text-info">${stats.totalSupplierPayments.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card className="border-border" data-testid="report-net-profit-card">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold font-outfit ${stats.netProfit >= 0 ? 'text-success' : 'text-error'}`}>
                ${stats.netProfit.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Mode Breakdown */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-outfit">Payment Mode Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-cash/10 rounded-lg border border-cash/30" data-testid="cash-breakdown">
                <div className="text-sm text-muted-foreground mb-1">Cash Sales</div>
                <div className="text-2xl font-bold font-outfit text-cash">${stats.cashSales.toFixed(2)}</div>
              </div>
              <div className="p-4 bg-bank/10 rounded-lg border border-bank/30" data-testid="bank-breakdown">
                <div className="text-sm text-muted-foreground mb-1">Bank Sales</div>
                <div className="text-2xl font-bold font-outfit text-bank">${stats.bankSales.toFixed(2)}</div>
              </div>
              <div className="p-4 bg-credit/10 rounded-lg border border-credit/30" data-testid="credit-breakdown">
                <div className="text-sm text-muted-foreground mb-1">Pending Credits</div>
                <div className="text-2xl font-bold font-outfit text-credit">${stats.creditSales.toFixed(2)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Branch-wise Report */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-outfit">Branch-wise Sales Report</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(branchWiseReport).map(([branchName, data]) => (
                <div key={branchName} className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg" data-testid="branch-report-item">
                  <div>
                    <div className="font-medium">{branchName}</div>
                    <div className="text-sm text-muted-foreground">{data.count} transactions</div>
                  </div>
                  <div className="text-xl font-bold font-outfit">${data.total.toFixed(2)}</div>
                </div>
              ))}
              {Object.keys(branchWiseReport).length === 0 && (
                <div className="text-center text-muted-foreground py-8">No branch sales data available</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Category-wise Expenses */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-outfit">Category-wise Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(categoryWiseExpenses).map(([category, amount]) => (
                <div key={category} className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg" data-testid="category-expense-item">
                  <div className="font-medium capitalize">{category}</div>
                  <div className="text-xl font-bold font-outfit">${amount.toFixed(2)}</div>
                </div>
              ))}
              {Object.keys(categoryWiseExpenses).length === 0 && (
                <div className="text-center text-muted-foreground py-8">No expense data available</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
