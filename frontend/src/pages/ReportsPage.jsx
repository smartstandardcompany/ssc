import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, FileSpreadsheet, Send } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '@/lib/api';
import { toast } from 'sonner';

const COLORS = ['#22C55E', '#0EA5E9', '#F59E0B', '#EF4444', '#7C3AED', '#EC4899'];

export default function ReportsPage() {
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchCashBank, setBranchCashBank] = useState([]);
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
      const [salesRes, expensesRes, paymentsRes, branchesRes, branchCBRes] = await Promise.all([
        api.get('/sales'),
        api.get('/expenses'),
        api.get('/supplier-payments'),
        api.get('/branches'),
        api.get('/reports/branch-cashbank'),
      ]);
      setSales(salesRes.data);
      setExpenses(expensesRes.data);
      setSupplierPayments(paymentsRes.data);
      setBranches(branchesRes.data);
      setBranchCashBank(branchCBRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const filterData = (data) => {
    return data.filter((item) => {
      const itemDate = new Date(item.date);
      const startMatch = !filters.startDate || itemDate >= new Date(filters.startDate);
      const endMatch = !filters.endDate || itemDate <= new Date(filters.endDate);
      const branchMatch = filters.branchId === 'all' || item.branch_id === filters.branchId;
      return startMatch && endMatch && branchMatch;
    });
  };

  const getFilteredSales = () => {
    let filtered = sales;
    if (filters.type !== 'all') filtered = filtered.filter((s) => s.sale_type === filters.type);
    return filterData(filtered);
  };

  const calculateStats = () => {
    const filteredSales = getFilteredSales();
    const filteredExpenses = filterData(expenses);
    const filteredPayments = filterData(supplierPayments);

    const totalSales = filteredSales.reduce((sum, s) => sum + (s.final_amount || s.amount - (s.discount || 0)), 0);
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalSupplierPayments = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
    const netProfit = totalSales - totalExpenses - totalSupplierPayments;

    let cashSales = 0, bankSales = 0, creditSales = 0;
    filteredSales.forEach((s) => {
      (s.payment_details || []).forEach((p) => {
        if (p.mode === 'cash') cashSales += p.amount;
        else if (p.mode === 'bank') bankSales += p.amount;
      });
      creditSales += (s.credit_amount || 0) - (s.credit_received || 0);
    });

    return { totalSales, totalExpenses, totalSupplierPayments, netProfit, cashSales, bankSales, creditSales };
  };

  const getCategoryWiseExpenses = () => {
    const cats = {};
    filterData(expenses).forEach((e) => {
      cats[e.category] = (cats[e.category] || 0) + e.amount;
    });
    return Object.entries(cats).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  };

  const handleExport = async (format) => {
    try {
      toast.loading(`Generating ${format.toUpperCase()} report...`);
      const response = await api.post('/export/reports', {
        format, start_date: filters.startDate || null, end_date: filters.endDate || null,
        branch_id: filters.branchId !== 'all' ? filters.branchId : null
      }, { responseType: 'blob' });
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.dismiss();
      toast.success(`${format.toUpperCase()} downloaded`);
    } catch {
      toast.dismiss();
      toast.error('Export failed');
    }
  };

  if (loading) {
    return (<DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>);
  }

  const stats = calculateStats();
  const categoryExpenses = getCategoryWiseExpenses();
  const paymentPieData = [
    { name: 'Cash', value: stats.cashSales },
    { name: 'Bank', value: stats.bankSales },
    { name: 'Credit', value: stats.creditSales },
  ].filter(d => d.value > 0);

  const branchChartData = branchCashBank.filter(b => b.sales_total > 0 || b.expenses_total > 0).map(b => ({
    name: b.branch_name.length > 10 ? b.branch_name.slice(0, 10) + '...' : b.branch_name,
    'Sales Cash': b.sales_cash,
    'Sales Bank': b.sales_bank,
    'Exp Cash': b.expenses_cash,
    'Exp Bank': b.expenses_bank,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="reports-page-title">Reports & Analytics</h1>
          <p className="text-muted-foreground">Detailed reports with charts and data export</p>
        </div>

        <Card className="border-border bg-gradient-to-r from-primary/5 to-accent/5">
          <CardHeader><CardTitle className="font-outfit">Export & Share</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => handleExport('pdf')} data-testid="export-pdf-button" className="rounded-full" variant="outline">
                <FileText size={18} className="mr-2" /> Export PDF
              </Button>
              <Button onClick={() => handleExport('excel')} data-testid="export-excel-button" className="rounded-full" variant="outline">
                <FileSpreadsheet size={18} className="mr-2" /> Export Excel
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border" data-testid="filters-card">
          <CardHeader><CardTitle className="font-outfit">Filters</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div><Label>Start Date</Label><Input type="date" data-testid="start-date-input" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} /></div>
              <div><Label>End Date</Label><Input type="date" data-testid="end-date-input" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} /></div>
              <div><Label>Branch</Label>
                <Select value={filters.branchId} onValueChange={(val) => setFilters({ ...filters, branchId: val })}>
                  <SelectTrigger data-testid="branch-filter-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Sale Type</Label>
                <Select value={filters.type} onValueChange={(val) => setFilters({ ...filters, type: val })}>
                  <SelectTrigger data-testid="type-filter-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="branch">Branch Sales</SelectItem>
                    <SelectItem value="online">Online Sales</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={() => setFilters({ startDate: '', endDate: '', branchId: 'all', type: 'all' })} variant="outline" data-testid="clear-filters-button" className="rounded-full mt-4">Clear Filters</Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-border" data-testid="report-total-sales-card"><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold font-outfit text-success">${stats.totalSales.toFixed(2)}</div></CardContent></Card>
          <Card className="border-border" data-testid="report-total-expenses-card"><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold font-outfit text-error">${stats.totalExpenses.toFixed(2)}</div></CardContent></Card>
          <Card className="border-border" data-testid="report-supplier-payments-card"><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Supplier Payments</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold font-outfit text-info">${stats.totalSupplierPayments.toFixed(2)}</div></CardContent></Card>
          <Card className="border-border" data-testid="report-net-profit-card"><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle></CardHeader><CardContent><div className={`text-3xl font-bold font-outfit ${stats.netProfit >= 0 ? 'text-success' : 'text-error'}`}>${stats.netProfit.toFixed(2)}</div></CardContent></Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {paymentPieData.length > 0 && (
            <Card className="border-border">
              <CardHeader><CardTitle className="font-outfit text-base">Sales Payment Mode</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={paymentPieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {paymentPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => `$${v.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {categoryExpenses.length > 0 && (
            <Card className="border-border">
              <CardHeader><CardTitle className="font-outfit text-base">Expenses by Category</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={categoryExpenses}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => `$${v.toFixed(2)}`} />
                    <Bar dataKey="value" fill="#EF4444" radius={[4, 4, 0, 0]} name="Amount" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {branchChartData.length > 0 && (
          <Card className="border-border">
            <CardHeader><CardTitle className="font-outfit">Branch-wise Cash vs Bank Breakdown</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={branchChartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `$${v.toFixed(2)}`} />
                  <Legend />
                  <Bar dataKey="Sales Cash" fill="#22C55E" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Sales Bank" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Exp Cash" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Exp Bank" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full" data-testid="branch-cashbank-table">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 font-medium text-sm">Branch</th>
                      <th className="text-right p-3 font-medium text-sm">Sales Cash</th>
                      <th className="text-right p-3 font-medium text-sm">Sales Bank</th>
                      <th className="text-right p-3 font-medium text-sm">Sales Credit</th>
                      <th className="text-right p-3 font-medium text-sm">Exp Cash</th>
                      <th className="text-right p-3 font-medium text-sm">Exp Bank</th>
                      <th className="text-right p-3 font-medium text-sm">Supplier Cash</th>
                      <th className="text-right p-3 font-medium text-sm">Supplier Bank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branchCashBank.map((b) => (
                      <tr key={b.branch_id} className="border-b border-border hover:bg-secondary/50" data-testid="branch-cashbank-row">
                        <td className="p-3 text-sm font-medium">{b.branch_name}</td>
                        <td className="p-3 text-sm text-right text-cash">${b.sales_cash.toFixed(2)}</td>
                        <td className="p-3 text-sm text-right text-bank">${b.sales_bank.toFixed(2)}</td>
                        <td className="p-3 text-sm text-right text-warning">${b.sales_credit.toFixed(2)}</td>
                        <td className="p-3 text-sm text-right text-cash">${b.expenses_cash.toFixed(2)}</td>
                        <td className="p-3 text-sm text-right text-bank">${b.expenses_bank.toFixed(2)}</td>
                        <td className="p-3 text-sm text-right text-cash">${b.supplier_cash.toFixed(2)}</td>
                        <td className="p-3 text-sm text-right text-bank">${b.supplier_bank.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
