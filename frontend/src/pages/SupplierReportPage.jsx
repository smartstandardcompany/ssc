import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ExportButtons } from '@/components/ExportButtons';
import { BranchFilter } from '@/components/BranchFilter';
import api from '@/lib/api';
import { toast } from 'sonner';

const COLORS = ['#7C3AED', '#0EA5E9', '#22C55E', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#06B6D4'];

export default function SupplierReportPage() {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');
  const [branchFilter, setBranchFilter] = useState([]);

  useEffect(() => {
    fetchReport();
  }, [period]);

  const fetchReport = async () => {
    try {
      const params = period !== 'all' ? `?period=${period}` : '';
      const response = await api.get(`/reports/supplier-balance${params}`);
      setReportData(response.data);
    } catch (error) {
      toast.error('Failed to fetch supplier report');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">Loading...</div>
      </DashboardLayout>
    );
  }

  const filtered = reportData.filter(s => branchFilter.length === 0 || branchFilter.includes(s.branch_id) || !s.branch_id);

  const totalExpenses = filtered.reduce((sum, s) => sum + s.total_expenses, 0);
  const totalPaid = filtered.reduce((sum, s) => sum + s.total_paid, 0);
  const totalCredit = filtered.reduce((sum, s) => sum + s.current_credit, 0);
  const totalCashPaid = filtered.reduce((sum, s) => sum + s.cash_paid, 0);
  const totalBankPaid = filtered.reduce((sum, s) => sum + s.bank_paid, 0);

  const chartData = filtered.filter(s => s.total_expenses > 0 || s.total_paid > 0).map(s => ({
    name: s.name.length > 12 ? s.name.slice(0, 12) + '...' : s.name,
    Expenses: s.total_expenses,
    'Cash Paid': s.cash_paid,
    'Bank Paid': s.bank_paid,
    Credit: s.current_credit,
  }));

  const paymentPieData = [
    { name: 'Cash', value: totalCashPaid },
    { name: 'Bank', value: totalBankPaid },
    { name: 'Credit Outstanding', value: totalCredit },
  ].filter(d => d.value > 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="supplier-report-title">Supplier Report</h1>
            <p className="text-muted-foreground">Supplier balance, expenses & payment breakdown</p>
          </div>
          <div className="flex gap-3 items-center flex-wrap">
            <BranchFilter onChange={setBranchFilter} />
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px]" data-testid="period-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
            <ExportButtons dataType="suppliers" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total Suppliers</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold font-outfit text-primary" data-testid="total-suppliers">{filtered.length}</div></CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total Expenses</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold font-outfit text-error" data-testid="total-supplier-expenses"> SAR {totalExpenses.toFixed(2)}</div></CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Cash Paid</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold font-outfit text-cash"> SAR {totalCashPaid.toFixed(2)}</div></CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Bank Paid</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold font-outfit text-bank"> SAR {totalBankPaid.toFixed(2)}</div></CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Outstanding Credit</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold font-outfit text-warning"> SAR {totalCredit.toFixed(2)}</div></CardContent>
          </Card>
        </div>

        {chartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border">
              <CardHeader><CardTitle className="font-outfit text-base">Supplier Expenses vs Payments</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Cash Paid" fill="#22C55E" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Bank Paid" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader><CardTitle className="font-outfit text-base">Payment Mode Breakdown</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={paymentPieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {paymentPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => `$${v.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="border-border">
          <CardHeader><CardTitle className="font-outfit">Supplier Balance Details</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="supplier-report-table">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-medium text-sm">Supplier</th>
                    <th className="text-left p-3 font-medium text-sm">Category</th>
                    <th className="text-right p-3 font-medium text-sm">Expenses</th>
                    <th className="text-right p-3 font-medium text-sm">Cash Paid</th>
                    <th className="text-right p-3 font-medium text-sm">Bank Paid</th>
                    <th className="text-right p-3 font-medium text-sm">Credit Owed</th>
                    <th className="text-center p-3 font-medium text-sm">Txns</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((supplier) => (
                    <tr key={supplier.id} className="border-b border-border hover:bg-secondary/50" data-testid="supplier-report-row">
                      <td className="p-3 text-sm font-medium">{supplier.name}</td>
                      <td className="p-3"><span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">{supplier.category || 'N/A'}</span></td>
                      <td className="p-3 text-sm text-right text-error font-medium"> SAR {supplier.total_expenses.toFixed(2)}</td>
                      <td className="p-3 text-sm text-right text-cash"> SAR {supplier.cash_paid.toFixed(2)}</td>
                      <td className="p-3 text-sm text-right text-bank"> SAR {supplier.bank_paid.toFixed(2)}</td>
                      <td className="p-3 text-sm text-right font-bold text-warning"> SAR {supplier.current_credit.toFixed(2)}</td>
                      <td className="p-3 text-center"><Badge variant="secondary">{supplier.transaction_count}</Badge></td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No supplier data available</td></tr>
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
