import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileText, FileSpreadsheet, Users, UserCheck, CalendarDays, TrendingUp, TrendingDown, Save } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

function HRAnalyticsTab() {
  const [employees, setEmployees] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loans, setLo] = useState([]);
  const [loanStats, setLoanStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [empRes, leaveRes, loanRes, lsRes] = await Promise.all([
          api.get('/employees'), api.get('/leaves'),
          api.get('/loans'), api.get('/loans/summary/stats')
        ]);
        setEmployees(empRes.data.filter(e => e.active !== false));
        setLeaves(leaveRes.data);
        setLo(loanRes.data);
        setLoanStats(lsRes.data);
      } catch {}
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading HR data...</div>;

  // Department distribution
  const deptMap = {};
  employees.forEach(e => { const d = e.position || 'Unassigned'; deptMap[d] = (deptMap[d] || 0) + 1; });
  const deptData = Object.entries(deptMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);

  // Leave type distribution
  const leaveTypeMap = {};
  leaves.filter(l => l.status === 'approved').forEach(l => { leaveTypeMap[l.leave_type] = (leaveTypeMap[l.leave_type] || 0) + (l.days || 0); });
  const leaveTypeData = Object.entries(leaveTypeMap).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

  // Monthly leave trend
  const monthlyLeave = {};
  leaves.filter(l => l.status === 'approved').forEach(l => {
    const m = new Date(l.start_date).toLocaleDateString('en-US', { month: 'short' });
    monthlyLeave[m] = (monthlyLeave[m] || 0) + (l.days || 0);
  });
  const leaveMonthData = Object.entries(monthlyLeave).map(([month, days]) => ({ month, days }));

  // Loan type breakdown
  const loanTypeMap = {};
  loans.forEach(l => { loanTypeMap[l.loan_type] = (loanTypeMap[l.loan_type] || 0) + l.amount; });
  const loanTypeData = Object.entries(loanTypeMap).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' '), value }));

  // Radar chart: Department metrics
  const radarData = deptData.slice(0, 6).map(d => ({
    department: d.name.substring(0, 12),
    headcount: d.value,
    leaves: leaves.filter(l => employees.find(e => e.position === d.name && e.name === l.employee_name) && l.status === 'approved').length,
    loans: loans.filter(l => employees.find(e => e.position === d.name && e.name === l.employee_name)).length,
  }));

  // Salary distribution buckets
  const salaryBuckets = { '0-2K': 0, '2K-4K': 0, '4K-6K': 0, '6K-8K': 0, '8K+': 0 };
  employees.forEach(e => {
    const s = e.salary || 0;
    if (s <= 2000) salaryBuckets['0-2K']++;
    else if (s <= 4000) salaryBuckets['2K-4K']++;
    else if (s <= 6000) salaryBuckets['4K-6K']++;
    else if (s <= 8000) salaryBuckets['6K-8K']++;
    else salaryBuckets['8K+']++;
  });
  const salaryData = Object.entries(salaryBuckets).map(([range, count]) => ({ range, count }));

  const totalSalary = employees.reduce((s, e) => s + (e.salary || 0), 0);

  return (
    <>
      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'Employees', value: employees.length, color: 'text-blue-600' },
          { label: 'Monthly Payroll', value: `SAR ${totalSalary.toLocaleString()}`, color: 'text-emerald-600' },
          { label: 'Avg Salary', value: `SAR ${employees.length ? Math.round(totalSalary / employees.length).toLocaleString() : 0}`, color: 'text-purple-600' },
          { label: 'Active Loans', value: loanStats?.active_loans || 0, color: 'text-amber-600' },
          { label: 'Outstanding', value: `SAR ${(loanStats?.total_outstanding || 0).toLocaleString()}`, color: 'text-red-600' },
          { label: 'Total Leaves', value: leaves.filter(l => l.status === 'approved').length, color: 'text-orange-600' },
        ].map(s => (
          <Card key={s.label} className="dark:bg-stone-900 dark:border-stone-700">
            <CardContent className="p-4 text-center">
              <p className={`text-lg font-bold font-outfit ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1: Department Pie + Salary Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="dark:bg-stone-900 dark:border-stone-700">
          <CardHeader><CardTitle className="font-outfit text-base dark:text-white">Department Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={deptData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: ${value}`}>
                  {deptData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="dark:bg-stone-900 dark:border-stone-700">
          <CardHeader><CardTitle className="font-outfit text-base dark:text-white">Salary Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={salaryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name="Employees" fill="#F5841F" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Radar + Leave Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {radarData.length > 0 && (
          <Card className="dark:bg-stone-900 dark:border-stone-700" data-testid="radar-chart-card">
            <CardHeader><CardTitle className="font-outfit text-base dark:text-white">Department Radar</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="department" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis tick={{ fontSize: 10 }} />
                  <Radar name="Headcount" dataKey="headcount" stroke="#F5841F" fill="#F5841F" fillOpacity={0.3} />
                  <Radar name="Leaves" dataKey="leaves" stroke="#22C55E" fill="#22C55E" fillOpacity={0.2} />
                  <Radar name="Loans" dataKey="loans" stroke="#0EA5E9" fill="#0EA5E9" fillOpacity={0.2} />
                  <Legend />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card className="dark:bg-stone-900 dark:border-stone-700">
          <CardHeader><CardTitle className="font-outfit text-base dark:text-white">Leave by Type</CardTitle></CardHeader>
          <CardContent>
            {leaveTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={leaveTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={100} label={({ name, value }) => `${name}: ${value}d`}>
                    {leaveTypeData.map((_, i) => <Cell key={i} fill={['#22C55E', '#0EA5E9', '#F59E0B', '#EF4444', '#8B5CF6'][i % 5]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No approved leaves yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3: Loan Breakdown + Monthly Leave Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loanTypeData.length > 0 && (
          <Card className="dark:bg-stone-900 dark:border-stone-700">
            <CardHeader><CardTitle className="font-outfit text-base dark:text-white">Loan Breakdown by Type</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={loanTypeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tickFormatter={v => `SAR ${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={v => `SAR ${Number(v).toLocaleString()}`} />
                  <Bar dataKey="value" name="Amount" fill="#F59E0B" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {leaveMonthData.length > 0 && (
          <Card className="dark:bg-stone-900 dark:border-stone-700">
            <CardHeader><CardTitle className="font-outfit text-base dark:text-white">Monthly Leave Trend</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={leaveMonthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="days" name="Leave Days" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

function CustomReportsTab({ branches }) {
  const [reportType, setReportType] = useState('sales');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [branchId, setBranchId] = useState('');
  const [category, setCategory] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savedViews, setSavedViews] = useState([]);
  const [viewName, setViewName] = useState('');
  const [visibleCols, setVisibleCols] = useState([]);

  const columnDefs = {
    sales: ['date', 'amount', 'discount', 'final_amount', 'payment_mode', 'branch_id', 'customer_name', 'description'],
    expenses: ['date', 'amount', 'category', 'description', 'payment_mode', 'branch_id'],
    supplier_payments: ['date', 'amount', 'supplier_name', 'payment_mode', 'branch_id', 'description'],
    employees: ['name', 'email', 'phone', 'position', 'salary', 'branch_id', 'status'],
    customers: ['name', 'phone', 'email', 'credit_limit', 'current_credit'],
    stock: ['name', 'category', 'unit', 'balance', 'unit_price', 'cost_price'],
  };

  useEffect(() => { loadViews(); }, []);
  useEffect(() => { setVisibleCols(columnDefs[reportType] || []); }, [reportType]);

  const loadViews = async () => {
    try { const { data } = await api.get('/report-views'); setSavedViews(data); } catch {}
  };

  const loadReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      if (branchId) params.append('branch_id', branchId);
      if (category) params.append('category', category);
      const { data } = await api.get(`/report-views/data/${reportType}?${params}`);
      setData(data);
    } catch { toast.error('Failed to load report'); }
    finally { setLoading(false); }
  };

  const saveView = async () => {
    if (!viewName.trim()) return toast.error('Enter a view name');
    try {
      await api.post('/report-views', { name: viewName, report_type: reportType, filters: { startDate, endDate, branchId, category }, columns: visibleCols });
      toast.success('View saved');
      setViewName('');
      loadViews();
    } catch { toast.error('Failed to save view'); }
  };

  const loadView = (view) => {
    setReportType(view.report_type);
    setStartDate(view.filters?.startDate || '');
    setEndDate(view.filters?.endDate || '');
    setBranchId(view.filters?.branchId || '');
    setCategory(view.filters?.category || '');
    setVisibleCols(view.columns || columnDefs[view.report_type] || []);
    toast.success(`Loaded: ${view.name}`);
  };

  const deleteView = async (viewId) => {
    try { await api.delete(`/report-views/${viewId}`); loadViews(); toast.success('Deleted'); } catch { toast.error('Failed'); }
  };

  const toggleCol = (col) => {
    setVisibleCols(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  };

  const exportCSV = () => {
    if (!data?.data?.length) return;
    const rows = data.data.map(d => visibleCols.map(c => JSON.stringify(d[c] ?? '')).join(','));
    const csv = [visibleCols.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${reportType}_report.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="font-outfit text-base">Custom Report Builder</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <Label className="text-xs">Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="h-9" data-testid="report-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="expenses">Expenses</SelectItem>
                  <SelectItem value="supplier_payments">Supplier Payments</SelectItem>
                  <SelectItem value="employees">Employees</SelectItem>
                  <SelectItem value="customers">Customers</SelectItem>
                  <SelectItem value="stock">Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9" data-testid="custom-start-date" />
            </div>
            <div>
              <Label className="text-xs">End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9" data-testid="custom-end-date" />
            </div>
            <div>
              <Label className="text-xs">Branch</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={loadReport} className="w-full rounded-xl h-9" disabled={loading} data-testid="generate-report-btn">
                {loading ? 'Loading...' : 'Generate'}
              </Button>
            </div>
          </div>

          {/* Column Visibility */}
          <div>
            <Label className="text-xs mb-1 block">Visible Columns</Label>
            <div className="flex flex-wrap gap-1">
              {(columnDefs[reportType] || []).map(col => (
                <Badge key={col} variant={visibleCols.includes(col) ? 'default' : 'outline'}
                  className={`text-[10px] cursor-pointer select-none ${visibleCols.includes(col) ? 'bg-orange-500 hover:bg-orange-600' : 'hover:bg-stone-100'}`}
                  onClick={() => toggleCol(col)} data-testid={`col-toggle-${col}`}>
                  {col.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          </div>

          {/* Save View */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs">Save as View</Label>
              <Input placeholder="e.g. Monthly Sales Overview" value={viewName} onChange={e => setViewName(e.target.value)} className="h-9" data-testid="view-name-input" />
            </div>
            <Button onClick={saveView} variant="outline" className="rounded-xl h-9" data-testid="save-view-btn">Save View</Button>
          </div>
        </CardContent>
      </Card>

      {/* Saved Views */}
      {savedViews.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="font-outfit text-base">Saved Views</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {savedViews.map(v => (
                <div key={v.id} className="flex items-center justify-between p-2.5 bg-stone-50 rounded-lg border" data-testid={`saved-view-${v.id}`}>
                  <div className="min-w-0 cursor-pointer flex-1" onClick={() => loadView(v)}>
                    <p className="text-sm font-medium truncate">{v.name}</p>
                    <p className="text-[10px] text-muted-foreground">{v.report_type} • {v.columns?.length || 0} cols</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" onClick={() => deleteView(v.id)}>×</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report Data */}
      {data && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="font-outfit text-base">Results ({data.summary?.total_records || 0} records)</CardTitle>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={exportCSV} data-testid="export-csv-btn">
                <FileSpreadsheet size={14} className="mr-1" />Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {data.summary?.total_amount !== undefined && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-emerald-600">Total Amount</p>
                  <p className="text-lg font-bold font-outfit text-emerald-700">{fmt(data.summary.total_amount)}</p>
                </div>
                {data.summary.total_net && (
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-blue-600">Net Amount</p>
                    <p className="text-lg font-bold font-outfit text-blue-700">{fmt(data.summary.total_net)}</p>
                  </div>
                )}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="custom-report-table">
                <thead><tr className="border-b">
                  {visibleCols.map(col => (
                    <th key={col} className="text-left p-2 text-xs font-medium capitalize">{col.replace(/_/g, ' ')}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {data.data?.slice(0, 100).map((row, i) => (
                    <tr key={i} className="border-b hover:bg-stone-50 text-xs">
                      {visibleCols.map(col => (
                        <td key={col} className="p-2">
                          {typeof row[col] === 'number' ? (col.includes('amount') || col.includes('price') || col.includes('salary') || col.includes('cost') || col.includes('credit') ? fmt(row[col]) : row[col]) : String(row[col] ?? '-')}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {(!data.data || data.data.length === 0) && <tr><td colSpan={visibleCols.length} className="text-center py-8 text-muted-foreground">No data found</td></tr>}
                </tbody>
              </table>
              {data.data?.length > 100 && <p className="text-xs text-muted-foreground text-center mt-2">Showing first 100 of {data.data.length} records</p>}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

import { BranchFilter } from '@/components/BranchFilter';
import api from '@/lib/api';
import { useBranchStore } from '@/stores';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

const COLORS = ['#F5841F', '#22C55E', '#0EA5E9', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#06B6D4'];
const fmt = (v) => `SAR ${Number(v).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2})}`;

export default function ReportsPage() {
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [supplierPayments, setSupplierPayments] = useState([]);
  const { branches, fetchBranches: _fetchBr } = useBranchStore();
  const [branchCashBank, setBranchCashBank] = useState([]);
  const [loading, setLoading] = useState(true);
  const [compareMode, setCompareMode] = useState('overview');
  const [compareBranch1, setCompareBranch1] = useState('');
  const [compareBranch2, setCompareBranch2] = useState('');
  const [comparePeriod, setComparePeriod] = useState('month');
  const [branchFilter, setBranchFilter] = useState([]);
  const [itemPnl, setItemPnl] = useState(null);
  const [pnlBranch, setPnlBranch] = useState('');
  const [dailySummary, setDailySummary] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [cashierPerf, setCashierPerf] = useState([]);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', type: 'all' });
  const [eodSummary, setEodSummary] = useState(null);
  const [eodDate, setEodDate] = useState(new Date().toISOString().split('T')[0]);
  const [eodBranch, setEodBranch] = useState('');
  const [eodLoading, setEodLoading] = useState(false);
  const [partnerPnl, setPartnerPnl] = useState(null);
  const [partnerPnlLoading, setPartnerPnlLoading] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [sR, eR, pR, , cbR] = await Promise.all([api.get('/sales'), api.get('/expenses'), api.get('/supplier-payments'), Promise.resolve({ data: [] }), api.get('/reports/branch-cashbank')]);
      setSales(sR.data?.data || sR.data || []); setExpenses(eR.data?.data || eR.data || []); setSupplierPayments(pR.data?.data || pR.data || []); setBranchCashBank(cbR.data);
    } catch { toast.error('Failed to fetch data'); }
    finally { setLoading(false); }
  };

  const loadDailySummary = async () => {
    try { const { data } = await api.get('/reports/daily-summary'); setDailySummary(data); } catch { toast.error('Failed'); }
  };
  const loadTopCustomers = async () => {
    try { const { data } = await api.get('/reports/top-customers'); setTopCustomers(data); } catch { toast.error('Failed'); }
  };
  const loadCashierPerf = async () => {
    try { const { data } = await api.get('/reports/cashier-performance'); setCashierPerf(data); } catch { toast.error('Failed'); }
  };
  const loadEodSummary = async (date, branch) => {
    setEodLoading(true);
    try {
      const params = new URLSearchParams({ date: date || eodDate });
      if (branch) params.append('branch_id', branch);
      const { data } = await api.get(`/reports/eod-summary?${params}`);
      setEodSummary(data);
    } catch { toast.error('Failed to load EOD summary'); }
    finally { setEodLoading(false); }
  };
  const loadPartnerPnl = async () => {
    setPartnerPnlLoading(true);
    try { const { data } = await api.get('/reports/partner-pnl'); setPartnerPnl(data); }
    catch { toast.error('Failed to load partner P&L'); }
    finally { setPartnerPnlLoading(false); }
  };

  const filterByDate = (data) => data.filter(item => {
    const d = new Date(item.date);
    const sm = !filters.startDate || d >= new Date(filters.startDate);
    const em = !filters.endDate || d <= new Date(filters.endDate);
    const bm = branchFilter.length === 0 || branchFilter.includes(item.branch_id);
    return sm && em && bm;
  });
  const filterByBranch = (data, bid) => data.filter(d => d.branch_id === bid);
  const filterByPeriod = (data, offset = 0) => {
    const now = new Date();
    let start, end;
    if (comparePeriod === 'month') { start = new Date(now.getFullYear(), now.getMonth() - offset, 1); end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0, 23, 59, 59); }
    else if (comparePeriod === 'year') { start = new Date(now.getFullYear() - offset, 0, 1); end = new Date(now.getFullYear() - offset, 11, 31, 23, 59, 59); }
    else { const day = new Date(now); day.setDate(day.getDate() - offset); start = new Date(day.getFullYear(), day.getMonth(), day.getDate()); end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59); }
    return data.filter(d => { const dt = new Date(d.date); return dt >= start && dt <= end; });
  };
  const calcStats = (salesData, expData, spData) => {
    const ts = salesData.reduce((s, sale) => s + (sale.final_amount || sale.amount - (sale.discount || 0)), 0);
    const te = expData.reduce((s, e) => s + e.amount, 0);
    const tp = spData.reduce((s, p) => s + p.amount, 0);
    let cash = 0, bank = 0;
    salesData.forEach(s => (s.payment_details || []).forEach(p => { if (p.mode === 'cash') cash += p.amount; else if (p.mode === 'bank') bank += p.amount; }));
    return { totalSales: ts, totalExpenses: te, totalSP: tp, netProfit: ts - te - tp, cash, bank, count: salesData.length };
  };
  const getMonthlyTrend = (data, months = 6) => {
    const result = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const filtered = data.filter(item => { const dt = new Date(item.date); return dt >= start && dt <= end; });
      result.push({ month: label, amount: filtered.reduce((s, item) => s + (item.final_amount || item.amount || 0), 0) });
    }
    return result;
  };
  const periodLabel = (offset) => {
    const now = new Date();
    if (comparePeriod === 'month') { const d = new Date(now.getFullYear(), now.getMonth() - offset, 1); return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
    if (comparePeriod === 'year') return `${now.getFullYear() - offset}`;
    const d = new Date(now); d.setDate(d.getDate() - offset);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const handleExport = async (f) => {
    try {
      toast.loading(`Generating ${f.toUpperCase()}...`);
      const res = await api.post('/export/reports', { format: f, start_date: filters.startDate || null, end_date: filters.endDate || null, branch_id: filters.branchId !== 'all' ? filters.branchId : null }, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a'); link.href = url; link.setAttribute('download', `report.${f === 'pdf' ? 'pdf' : 'xlsx'}`);
      document.body.appendChild(link); link.click(); link.remove(); toast.dismiss(); toast.success('Downloaded');
    } catch { toast.dismiss(); toast.error('Failed'); }
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64"><div className="animate-pulse text-muted-foreground">Loading reports...</div></div></DashboardLayout>;

  const fSales = filterByDate(sales); const fExp = filterByDate(expenses); const fSP = filterByDate(supplierPayments);
  const stats = calcStats(fSales, fExp, fSP);
  const categoryExp = {}; fExp.forEach(e => { categoryExp[e.category] = (categoryExp[e.category] || 0) + e.amount; });
  const catData = Object.entries(categoryExp).map(([n, v]) => ({ name: n.charAt(0).toUpperCase() + n.slice(1), value: v })).sort((a, b) => b.value - a.value);
  const payPie = [{ name: 'Cash', value: stats.cash }, { name: 'Bank', value: stats.bank }].filter(d => d.value > 0);
  const salesTrend = getMonthlyTrend(sales, 6);
  const expTrend = getMonthlyTrend(expenses, 6);
  const combinedTrend = salesTrend.map((s, i) => ({ month: s.month, Sales: s.amount, Expenses: expTrend[i]?.amount || 0 }));

  const p1 = calcStats(filterByPeriod(sales, 0), filterByPeriod(expenses, 0), filterByPeriod(supplierPayments, 0));
  const p2 = calcStats(filterByPeriod(sales, 1), filterByPeriod(expenses, 1), filterByPeriod(supplierPayments, 1));
  const periodCompare = [
    { metric: 'Sales', current: p1.totalSales, previous: p2.totalSales },
    { metric: 'Expenses', current: p1.totalExpenses, previous: p2.totalExpenses },
    { metric: 'Supplier Pay', current: p1.totalSP, previous: p2.totalSP },
    { metric: 'Net Profit', current: p1.netProfit, previous: p2.netProfit },
    { metric: 'Cash', current: p1.cash, previous: p2.cash },
    { metric: 'Bank', current: p1.bank, previous: p2.bank },
  ];

  const b1Stats = compareBranch1 ? calcStats(filterByBranch(sales, compareBranch1), filterByBranch(expenses, compareBranch1), filterByBranch(supplierPayments, compareBranch1)) : null;
  const b2Stats = compareBranch2 ? calcStats(filterByBranch(sales, compareBranch2), filterByBranch(expenses, compareBranch2), filterByBranch(supplierPayments, compareBranch2)) : null;
  const b1Name = branches.find(b => b.id === compareBranch1)?.name || 'Branch 1';
  const b2Name = branches.find(b => b.id === compareBranch2)?.name || 'Branch 2';
  const branchCompare = b1Stats && b2Stats ? [
    { metric: 'Sales', [b1Name]: b1Stats.totalSales, [b2Name]: b2Stats.totalSales },
    { metric: 'Expenses', [b1Name]: b1Stats.totalExpenses, [b2Name]: b2Stats.totalExpenses },
    { metric: 'Net Profit', [b1Name]: b1Stats.netProfit, [b2Name]: b2Stats.netProfit },
    { metric: 'Cash', [b1Name]: b1Stats.cash, [b2Name]: b2Stats.cash },
    { metric: 'Bank', [b1Name]: b1Stats.bank, [b2Name]: b2Stats.bank },
  ] : [];

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="reports-page">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit mb-1" data-testid="reports-title">Reports & Analytics</h1>
            <p className="text-sm text-muted-foreground">Compare branches, periods, and track performance</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <BranchFilter onChange={setBranchFilter} />
            <Button onClick={() => handleExport('pdf')} variant="outline" size="sm" className="rounded-xl"><FileText size={14} className="mr-1" />PDF</Button>
            <Button onClick={() => handleExport('excel')} variant="outline" size="sm" className="rounded-xl"><FileSpreadsheet size={14} className="mr-1" />Excel</Button>
          </div>
        </div>

        <Tabs value={compareMode} onValueChange={(v) => {
          setCompareMode(v);
          if (v === 'daily' && dailySummary.length === 0) loadDailySummary();
          if (v === 'customers' && topCustomers.length === 0) loadTopCustomers();
          if (v === 'cashier' && cashierPerf.length === 0) loadCashierPerf();
          if (v === 'eod' && !eodSummary) loadEodSummary(eodDate, eodBranch);
          if (v === 'partner_pnl' && !partnerPnl) loadPartnerPnl();
        }}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="daily" className="text-xs sm:text-sm" data-testid="daily-tab">Daily</TabsTrigger>
            <TabsTrigger value="eod" className="text-xs sm:text-sm" data-testid="eod-tab">EOD Summary</TabsTrigger>
            <TabsTrigger value="branch_report" className="text-xs sm:text-sm">Branch</TabsTrigger>
            <TabsTrigger value="expense_report" className="text-xs sm:text-sm">Expense</TabsTrigger>
            <TabsTrigger value="customers" className="text-xs sm:text-sm" data-testid="customers-tab">Customers</TabsTrigger>
            <TabsTrigger value="cashier" className="text-xs sm:text-sm" data-testid="cashier-tab">Cashier</TabsTrigger>
            <TabsTrigger value="partner_pnl" className="text-xs sm:text-sm" data-testid="partner-pnl-tab">Partner P&L</TabsTrigger>
            <TabsTrigger value="period" className="text-xs sm:text-sm">Period</TabsTrigger>
            <TabsTrigger value="branch" className="text-xs sm:text-sm">Compare</TabsTrigger>
            <TabsTrigger value="trend" className="text-xs sm:text-sm">Trends</TabsTrigger>
            <TabsTrigger value="item_pnl" className="text-xs sm:text-sm" data-testid="item-pnl-tab">Item P&L</TabsTrigger>
            <TabsTrigger value="hr_analytics" className="text-xs sm:text-sm" data-testid="hr-analytics-tab">HR Analytics</TabsTrigger>
            <TabsTrigger value="custom_reports" className="text-xs sm:text-sm" data-testid="custom-reports-tab">Custom Reports</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-6">
            <Card className="border-stone-100"><CardHeader><CardTitle className="font-outfit text-base">Filters</CardTitle></CardHeader><CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div><Label className="text-xs">Start</Label><Input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="h-9" /></div>
                <div><Label className="text-xs">End</Label><Input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="h-9" /></div>
                <div className="flex items-end"><Button onClick={() => setFilters({ startDate: '', endDate: '', type: 'all' })} variant="outline" size="sm" className="rounded-xl w-full">Clear</Button></div>
              </div>
            </CardContent></Card>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Total Sales', value: stats.totalSales, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Total Expenses', value: stats.totalExpenses, color: 'text-red-600', bg: 'bg-red-50' },
                { label: 'Supplier Pay', value: stats.totalSP, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Net Profit', value: stats.netProfit, color: stats.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600', bg: stats.netProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
              ].map(c => (
                <Card key={c.label} className={`border-stone-100 ${c.bg}`}><CardContent className="p-4">
                  <p className="text-[11px] text-muted-foreground font-medium">{c.label}</p>
                  <p className={`text-lg sm:text-xl font-bold font-outfit ${c.color}`} data-testid={`stat-${c.label.toLowerCase().replace(/\s/g,'-')}`}>{fmt(c.value)}</p>
                </CardContent></Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {payPie.length > 0 && <Card className="border-stone-100"><CardHeader><CardTitle className="font-outfit text-base">Payment Mode</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={250}><PieChart><Pie data={payPie} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{payPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Pie><Tooltip formatter={(v) => fmt(v)} /></PieChart></ResponsiveContainer></CardContent></Card>}
              {catData.length > 0 && <Card className="border-stone-100"><CardHeader><CardTitle className="font-outfit text-base">Expense Categories</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={250}><BarChart data={catData}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v) => fmt(v)} /><Bar dataKey="value" fill="#EF4444" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>}
            </div>

            {branchCashBank.length > 0 && <Card className="border-stone-100"><CardHeader><CardTitle className="font-outfit text-base">Branch Cash vs Bank</CardTitle></CardHeader><CardContent>
              <ResponsiveContainer width="100%" height={300}><BarChart data={branchCashBank.map(b => ({ name: b.branch_name, 'Sales Cash': b.sales_cash, 'Sales Bank': b.sales_bank, 'Exp Cash': b.expenses_cash, 'Exp Bank': b.expenses_bank }))}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(v) => fmt(v)} /><Legend /><Bar dataKey="Sales Cash" fill="#22C55E" radius={[4, 4, 0, 0]} /><Bar dataKey="Sales Bank" fill="#0EA5E9" radius={[4, 4, 0, 0]} /><Bar dataKey="Exp Cash" fill="#F59E0B" radius={[4, 4, 0, 0]} /><Bar dataKey="Exp Bank" fill="#EF4444" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
            </CardContent></Card>}
          </TabsContent>

          {/* DAILY SUMMARY - NEW */}
          <TabsContent value="daily" className="space-y-4" data-testid="daily-summary-content">
            <Card className="border-stone-100">
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <CardTitle className="font-outfit text-base flex items-center gap-2"><CalendarDays size={16} />Daily Sales Summary</CardTitle>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={loadDailySummary}>Refresh</Button>
                </div>
              </CardHeader>
              <CardContent>
                {dailySummary.length > 0 && (
                  <div className="mb-4">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={dailySummary.slice(0, 14).reverse()}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(v) => v.slice(5)} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v) => fmt(v)} />
                        <Legend />
                        <Bar dataKey="sales" name="Sales" fill="#22C55E" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Mobile card view */}
                <div className="sm:hidden space-y-2">
                  {dailySummary.map(d => (
                    <div key={d.date} className="p-3 border rounded-xl bg-white space-y-1.5" data-testid={`daily-card-${d.date}`}>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold">{d.date}</span>
                        <Badge className="text-[10px]">{d.txn_count} txns</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div><p className="text-[10px] text-muted-foreground">Sales</p><p className="text-xs font-bold text-emerald-600">{fmt(d.sales)}</p></div>
                        <div><p className="text-[10px] text-muted-foreground">Expenses</p><p className="text-xs font-bold text-red-600">{fmt(d.expenses)}</p></div>
                        <div><p className="text-[10px] text-muted-foreground">Profit</p><p className={`text-xs font-bold ${d.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(d.profit)}</p></div>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {d.cash > 0 && <Badge variant="outline" className="text-[9px] border-emerald-200 text-emerald-600">Cash: {fmt(d.cash)}</Badge>}
                        {d.bank > 0 && <Badge variant="outline" className="text-[9px] border-blue-200 text-blue-600">Bank: {fmt(d.bank)}</Badge>}
                        {d.online > 0 && <Badge variant="outline" className="text-[9px] border-purple-200 text-purple-600">Online: {fmt(d.online)}</Badge>}
                        {d.credit > 0 && <Badge variant="outline" className="text-[9px] border-amber-200 text-amber-600">Credit: {fmt(d.credit)}</Badge>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full" data-testid="daily-summary-table">
                    <thead><tr className="border-b text-xs">
                      <th className="text-left p-2 font-medium">Date</th>
                      <th className="text-right p-2 font-medium">Sales</th>
                      <th className="text-right p-2 font-medium">Expenses</th>
                      <th className="text-right p-2 font-medium">Profit</th>
                      <th className="text-right p-2 font-medium">Cash</th>
                      <th className="text-right p-2 font-medium">Bank</th>
                      <th className="text-right p-2 font-medium">Online</th>
                      <th className="text-right p-2 font-medium">Credit</th>
                      <th className="text-center p-2 font-medium">Txns</th>
                    </tr></thead>
                    <tbody>
                      {dailySummary.map(d => (
                        <tr key={d.date} className={`border-b hover:bg-stone-50 text-sm ${d.profit < 0 ? 'bg-red-50/50' : ''}`} data-testid={`daily-row-${d.date}`}>
                          <td className="p-2 font-medium">{d.date}</td>
                          <td className="p-2 text-right text-emerald-600 font-medium">{fmt(d.sales)}</td>
                          <td className="p-2 text-right text-red-600">{fmt(d.expenses)}</td>
                          <td className={`p-2 text-right font-bold ${d.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(d.profit)}</td>
                          <td className="p-2 text-right text-stone-600">{d.cash > 0 ? fmt(d.cash) : '-'}</td>
                          <td className="p-2 text-right text-stone-600">{d.bank > 0 ? fmt(d.bank) : '-'}</td>
                          <td className="p-2 text-right text-stone-600">{d.online > 0 ? fmt(d.online) : '-'}</td>
                          <td className="p-2 text-right text-stone-600">{d.credit > 0 ? fmt(d.credit) : '-'}</td>
                          <td className="p-2 text-center"><Badge variant="outline" className="text-[10px]">{d.txn_count}</Badge></td>
                        </tr>
                      ))}
                      {dailySummary.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No data. Create some sales entries to see the daily summary.</td></tr>}
                    </tbody>
                    {dailySummary.length > 0 && (
                      <tfoot><tr className="border-t-2 bg-stone-50 font-bold text-sm">
                        <td className="p-2">Total</td>
                        <td className="p-2 text-right text-emerald-600">{fmt(dailySummary.reduce((s, d) => s + d.sales, 0))}</td>
                        <td className="p-2 text-right text-red-600">{fmt(dailySummary.reduce((s, d) => s + d.expenses, 0))}</td>
                        <td className="p-2 text-right">{fmt(dailySummary.reduce((s, d) => s + d.profit, 0))}</td>
                        <td className="p-2 text-right">{fmt(dailySummary.reduce((s, d) => s + d.cash, 0))}</td>
                        <td className="p-2 text-right">{fmt(dailySummary.reduce((s, d) => s + d.bank, 0))}</td>
                        <td className="p-2 text-right">{fmt(dailySummary.reduce((s, d) => s + d.online, 0))}</td>
                        <td className="p-2 text-right">{fmt(dailySummary.reduce((s, d) => s + d.credit, 0))}</td>
                        <td className="p-2 text-center">{dailySummary.reduce((s, d) => s + d.txn_count, 0)}</td>
                      </tr></tfoot>
                    )}
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* EOD SUMMARY */}
          <TabsContent value="eod" className="space-y-4" data-testid="eod-summary-content">
            <Card className="border-stone-100">
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <CardTitle className="font-outfit text-base flex items-center gap-2"><CalendarDays size={16} />End-of-Day Summary</CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input type="date" value={eodDate} onChange={e => setEodDate(e.target.value)} className="h-9 w-40" data-testid="eod-date-input" />
                    <Select value={eodBranch || "all"} onValueChange={v => setEodBranch(v === "all" ? "" : v)}>
                      <SelectTrigger className="h-9 w-40"><SelectValue placeholder="All Branches" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Branches</SelectItem>
                        {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="sm" className="rounded-xl" onClick={() => loadEodSummary(eodDate, eodBranch)} data-testid="eod-load-btn">
                      {eodLoading ? 'Loading...' : 'Generate'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!eodSummary ? (
                  <p className="text-center text-muted-foreground py-8">Select a date and click "Generate" to view the End-of-Day summary.</p>
                ) : (
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="text-center pb-4 border-b">
                      <h2 className="text-lg font-bold font-outfit" data-testid="eod-title">EOD Report — {eodSummary.date}</h2>
                      <p className="text-sm text-muted-foreground">{eodSummary.branch_name}</p>
                    </div>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-emerald-50 rounded-xl p-3 text-center" data-testid="eod-total-sales">
                        <p className="text-xs text-emerald-600 font-medium">Total Sales</p>
                        <p className="text-lg font-bold text-emerald-700">{fmt(eodSummary.sales.total)}</p>
                        <p className="text-[10px] text-emerald-500">{eodSummary.sales.transaction_count} transactions</p>
                      </div>
                      <div className="bg-red-50 rounded-xl p-3 text-center" data-testid="eod-total-expenses">
                        <p className="text-xs text-red-600 font-medium">Total Expenses</p>
                        <p className="text-lg font-bold text-red-700">{fmt(eodSummary.expenses.total)}</p>
                        <p className="text-[10px] text-red-500">{eodSummary.expenses.count} items</p>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3 text-center" data-testid="eod-supplier-payments">
                        <p className="text-xs text-amber-600 font-medium">Supplier Payments</p>
                        <p className="text-lg font-bold text-amber-700">{fmt(eodSummary.supplier_payments.total)}</p>
                        <p className="text-[10px] text-amber-500">{eodSummary.supplier_payments.count} payments</p>
                      </div>
                      <div className={`rounded-xl p-3 text-center ${eodSummary.summary.net_profit >= 0 ? 'bg-blue-50' : 'bg-red-50'}`} data-testid="eod-net-profit">
                        <p className={`text-xs font-medium ${eodSummary.summary.net_profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>Net Profit</p>
                        <p className={`text-lg font-bold ${eodSummary.summary.net_profit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmt(eodSummary.summary.net_profit)}</p>
                      </div>
                    </div>
                    {/* Sales Breakdown */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-white border rounded-xl p-4">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><TrendingUp size={14} className="text-emerald-500" />Sales Breakdown</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-stone-500">Cash</span><span className="font-medium">{fmt(eodSummary.sales.cash)}</span></div>
                          <div className="flex justify-between"><span className="text-stone-500">Bank</span><span className="font-medium">{fmt(eodSummary.sales.bank)}</span></div>
                          <div className="flex justify-between"><span className="text-stone-500">Online</span><span className="font-medium">{fmt(eodSummary.sales.online)}</span></div>
                          <div className="flex justify-between"><span className="text-stone-500">Credit Given</span><span className="font-medium text-amber-600">{fmt(eodSummary.sales.credit_given)}</span></div>
                          <div className="flex justify-between"><span className="text-stone-500">Credit Received</span><span className="font-medium text-emerald-600">{fmt(eodSummary.sales.credit_received)}</span></div>
                        </div>
                      </div>
                      <div className="bg-white border rounded-xl p-4">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><TrendingDown size={14} className="text-red-500" />Cash Flow Summary</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-stone-500">Cash In Hand</span><span className="font-bold text-emerald-600">{fmt(eodSummary.summary.cash_in_hand)}</span></div>
                          <div className="flex justify-between"><span className="text-stone-500">Bank Net</span><span className="font-medium">{fmt(eodSummary.summary.bank_total)}</span></div>
                          <div className="flex justify-between border-t pt-2 mt-2"><span className="text-stone-500">Expenses (Cash)</span><span className="font-medium text-red-600">{fmt(eodSummary.expenses.cash)}</span></div>
                          <div className="flex justify-between"><span className="text-stone-500">Expenses (Bank)</span><span className="font-medium text-red-600">{fmt(eodSummary.expenses.bank)}</span></div>
                          <div className="flex justify-between"><span className="text-stone-500">Supplier (Cash)</span><span className="font-medium text-amber-600">{fmt(eodSummary.supplier_payments.cash)}</span></div>
                          <div className="flex justify-between"><span className="text-stone-500">Supplier (Bank)</span><span className="font-medium text-amber-600">{fmt(eodSummary.supplier_payments.bank)}</span></div>
                        </div>
                      </div>
                    </div>
                    {/* Expense Categories */}
                    {eodSummary.expenses.by_category.length > 0 && (
                      <div className="bg-white border rounded-xl p-4">
                        <h3 className="text-sm font-semibold mb-3">Expenses by Category</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {eodSummary.expenses.by_category.map((c, i) => (
                            <div key={c.category} className="flex items-center justify-between bg-stone-50 rounded-lg px-3 py-2">
                              <span className="text-xs text-stone-600 truncate">{c.category}</span>
                              <span className="text-xs font-semibold text-red-600 ml-2">{fmt(c.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Branch Breakdown */}
                    {eodSummary.branch_breakdown.length > 0 && (
                      <div className="bg-white border rounded-xl p-4">
                        <h3 className="text-sm font-semibold mb-3">Branch Breakdown</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead><tr className="border-b text-xs text-muted-foreground">
                              <th className="text-left p-2">Branch</th><th className="text-right p-2">Sales</th><th className="text-right p-2">Expenses</th><th className="text-right p-2">Supplier</th><th className="text-right p-2">Net</th>
                            </tr></thead>
                            <tbody>
                              {eodSummary.branch_breakdown.map(b => (
                                <tr key={b.branch_id} className="border-b hover:bg-stone-50">
                                  <td className="p-2 font-medium">{b.branch_name}</td>
                                  <td className="p-2 text-right text-emerald-600">{fmt(b.sales)}</td>
                                  <td className="p-2 text-right text-red-600">{fmt(b.expenses)}</td>
                                  <td className="p-2 text-right text-amber-600">{fmt(b.supplier_payments)}</td>
                                  <td className={`p-2 text-right font-bold ${b.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(b.net)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {/* Print Button */}
                    <div className="flex justify-center">
                      <Button variant="outline" className="rounded-xl" onClick={() => window.print()} data-testid="eod-print-btn">
                        <FileText size={14} className="mr-2" />Print Report
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PARTNER P&L */}
          <TabsContent value="partner_pnl" className="space-y-4" data-testid="partner-pnl-content">
            <Card className="border-stone-100">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="font-outfit text-base flex items-center gap-2"><FileSpreadsheet size={16} />Partner Profit & Loss</CardTitle>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={loadPartnerPnl} data-testid="partner-pnl-refresh">Refresh</Button>
                </div>
              </CardHeader>
              <CardContent>
                {partnerPnlLoading ? (
                  <p className="text-center text-muted-foreground py-8">Loading partner P&L...</p>
                ) : !partnerPnl ? (
                  <p className="text-center text-muted-foreground py-8">Loading...</p>
                ) : (
                  <div className="space-y-6">
                    {/* Company Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="company-pnl-summary">
                      <div className="bg-emerald-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-emerald-600 font-medium">Total Revenue</p>
                        <p className="text-lg font-bold text-emerald-700">{fmt(partnerPnl.company_summary.total_revenue)}</p>
                      </div>
                      <div className="bg-red-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-red-600 font-medium">Total Expenses</p>
                        <p className="text-lg font-bold text-red-700">{fmt(partnerPnl.company_summary.total_expenses)}</p>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-amber-600 font-medium">Supplier Payments</p>
                        <p className="text-lg font-bold text-amber-700">{fmt(partnerPnl.company_summary.total_supplier_payments)}</p>
                      </div>
                      <div className={`rounded-xl p-3 text-center ${partnerPnl.company_summary.net_profit >= 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
                        <p className={`text-xs font-medium ${partnerPnl.company_summary.net_profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>Company Net Profit</p>
                        <p className={`text-lg font-bold ${partnerPnl.company_summary.net_profit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmt(partnerPnl.company_summary.net_profit)}</p>
                      </div>
                    </div>

                    {partnerPnl.partners.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No partners found. Add partners in the Partners page to see P&L.</p>
                    ) : (
                      <>
                        {/* Partner Cards */}
                        <div className="grid md:grid-cols-2 gap-4">
                          {partnerPnl.partners.map(p => (
                            <div key={p.partner_id} className="bg-white border rounded-xl p-4" data-testid={`partner-pnl-${p.partner_id}`}>
                              <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold">{p.name}</h3>
                                <Badge className="text-[10px]">{p.share_percentage}% Share</Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                <div className="bg-emerald-50 rounded-lg p-2">
                                  <p className="text-emerald-600">Total Invested</p>
                                  <p className="font-bold text-emerald-700">{fmt(p.total_invested)}</p>
                                </div>
                                <div className="bg-red-50 rounded-lg p-2">
                                  <p className="text-red-600">Total Withdrawn</p>
                                  <p className="font-bold text-red-700">{fmt(p.total_withdrawn)}</p>
                                </div>
                                <div className="bg-blue-50 rounded-lg p-2">
                                  <p className="text-blue-600">Current Balance</p>
                                  <p className="font-bold text-blue-700">{fmt(p.current_balance)}</p>
                                </div>
                                <div className="bg-amber-50 rounded-lg p-2">
                                  <p className="text-amber-600">Profit Share Entitled</p>
                                  <p className="font-bold text-amber-700">{fmt(p.profit_share_entitled)}</p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-xs text-stone-500 border-t pt-2">
                                <span>Salary Paid: {fmt(p.salary_paid)}</span>
                                <span>ROI: <span className={p.roi_pct >= 0 ? 'text-emerald-600' : 'text-red-600'}>{p.roi_pct}%</span></span>
                              </div>
                              {/* Monthly Chart */}
                              {p.monthly && p.monthly.some(m => m.invested > 0 || m.withdrawn > 0) && (
                                <div className="mt-3">
                                  <ResponsiveContainer width="100%" height={120}>
                                    <BarChart data={p.monthly}>
                                      <CartesianGrid strokeDasharray="3 3" />
                                      <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                                      <YAxis tick={{ fontSize: 9 }} />
                                      <Tooltip formatter={(v) => fmt(v)} />
                                      <Bar dataKey="invested" name="Invested" fill="#22C55E" />
                                      <Bar dataKey="withdrawn" name="Withdrawn" fill="#EF4444" />
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {/* Summary Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm" data-testid="partner-pnl-table">
                            <thead><tr className="border-b text-xs text-muted-foreground">
                              <th className="text-left p-2">Partner</th><th className="text-right p-2">Share %</th><th className="text-right p-2">Invested</th><th className="text-right p-2">Withdrawn</th><th className="text-right p-2">Balance</th><th className="text-right p-2">Profit Share</th><th className="text-right p-2">ROI</th>
                            </tr></thead>
                            <tbody>
                              {partnerPnl.partners.map(p => (
                                <tr key={p.partner_id} className="border-b hover:bg-stone-50">
                                  <td className="p-2 font-medium">{p.name}</td>
                                  <td className="p-2 text-right">{p.share_percentage}%</td>
                                  <td className="p-2 text-right text-emerald-600">{fmt(p.total_invested)}</td>
                                  <td className="p-2 text-right text-red-600">{fmt(p.total_withdrawn)}</td>
                                  <td className={`p-2 text-right font-bold ${p.current_balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{fmt(p.current_balance)}</td>
                                  <td className={`p-2 text-right font-bold ${p.profit_share_entitled >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(p.profit_share_entitled)}</td>
                                  <td className={`p-2 text-right ${p.roi_pct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{p.roi_pct}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>



          {/* TOP CUSTOMERS - NEW */}
          <TabsContent value="customers" className="space-y-4" data-testid="top-customers-content">
            <Card className="border-stone-100">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="font-outfit text-base flex items-center gap-2"><Users size={16} />Top Customers</CardTitle>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={loadTopCustomers}>Refresh</Button>
                </div>
              </CardHeader>
              <CardContent>
                {topCustomers.length > 0 && (
                  <div className="mb-4">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={topCustomers.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v) => fmt(v)} />
                        <Legend />
                        <Bar dataKey="total_purchases" name="Purchases" fill="#22C55E" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="credit_outstanding" name="Credit Due" fill="#EF4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Mobile card view */}
                <div className="sm:hidden space-y-2">
                  {topCustomers.map((c, i) => (
                    <div key={c.id} className="p-3 border rounded-xl bg-white" data-testid={`customer-card-${c.id}`}>
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-[10px] font-bold flex items-center justify-center">#{i+1}</span>
                          <span className="text-sm font-bold">{c.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{c.transaction_count} txns</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><p className="text-[10px] text-muted-foreground">Total</p><p className="text-xs font-bold text-emerald-600">{fmt(c.total_purchases)}</p></div>
                        <div><p className="text-[10px] text-muted-foreground">Credit Due</p><p className={`text-xs font-bold ${c.credit_outstanding > 0 ? 'text-red-600' : 'text-stone-400'}`}>{fmt(c.credit_outstanding)}</p></div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full" data-testid="top-customers-table">
                    <thead><tr className="border-b text-xs">
                      <th className="text-center p-2 font-medium w-10">#</th>
                      <th className="text-left p-2 font-medium">Customer</th>
                      <th className="text-left p-2 font-medium">Phone</th>
                      <th className="text-right p-2 font-medium">Total Purchases</th>
                      <th className="text-center p-2 font-medium">Transactions</th>
                      <th className="text-right p-2 font-medium">Credit Given</th>
                      <th className="text-right p-2 font-medium">Credit Received</th>
                      <th className="text-right p-2 font-medium">Outstanding</th>
                    </tr></thead>
                    <tbody>
                      {topCustomers.map((c, i) => (
                        <tr key={c.id} className="border-b hover:bg-stone-50 text-sm" data-testid={`customer-row-${c.id}`}>
                          <td className="p-2 text-center"><span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-[10px] font-bold inline-flex items-center justify-center">{i+1}</span></td>
                          <td className="p-2 font-medium">{c.name}</td>
                          <td className="p-2 text-muted-foreground text-xs">{c.phone || '-'}</td>
                          <td className="p-2 text-right font-bold text-emerald-600">{fmt(c.total_purchases)}</td>
                          <td className="p-2 text-center"><Badge variant="outline" className="text-[10px]">{c.transaction_count}</Badge></td>
                          <td className="p-2 text-right text-amber-600">{c.credit_given > 0 ? fmt(c.credit_given) : '-'}</td>
                          <td className="p-2 text-right text-emerald-600">{c.credit_received > 0 ? fmt(c.credit_received) : '-'}</td>
                          <td className={`p-2 text-right font-bold ${c.credit_outstanding > 0 ? 'text-red-600' : 'text-stone-400'}`}>{fmt(c.credit_outstanding)}</td>
                        </tr>
                      ))}
                      {topCustomers.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No customer data. Add customers and create sales to see rankings.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CASHIER PERFORMANCE - NEW */}
          <TabsContent value="cashier" className="space-y-4" data-testid="cashier-perf-content">
            <Card className="border-stone-100">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="font-outfit text-base flex items-center gap-2"><UserCheck size={16} />Cashier Performance</CardTitle>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={loadCashierPerf}>Refresh</Button>
                </div>
              </CardHeader>
              <CardContent>
                {cashierPerf.length > 0 && (
                  <div className="mb-4">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={cashierPerf}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v) => fmt(v)} />
                        <Legend />
                        <Bar dataKey="cash_collected" name="Cash" fill="#22C55E" radius={[4, 4, 0, 0]} stackId="a" />
                        <Bar dataKey="bank_collected" name="Bank" fill="#0EA5E9" radius={[4, 4, 0, 0]} stackId="a" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Mobile card view */}
                <div className="sm:hidden space-y-2">
                  {cashierPerf.map((u, i) => (
                    <div key={u.user_id} className="p-3 border rounded-xl bg-white" data-testid={`cashier-card-${u.user_id}`}>
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold flex items-center justify-center">#{i+1}</span>
                          <div>
                            <span className="text-sm font-bold">{u.name}</span>
                            <p className="text-[10px] text-muted-foreground">{u.branch}</p>
                          </div>
                        </div>
                        <Badge className="capitalize text-[10px]">{u.role}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div><p className="text-[10px] text-muted-foreground">Total</p><p className="text-xs font-bold text-emerald-600">{fmt(u.total_sales)}</p></div>
                        <div><p className="text-[10px] text-muted-foreground">Avg/Txn</p><p className="text-xs font-bold text-blue-600">{fmt(u.avg_transaction)}</p></div>
                        <div><p className="text-[10px] text-muted-foreground">Txns</p><p className="text-xs font-bold">{u.transaction_count}</p></div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full" data-testid="cashier-perf-table">
                    <thead><tr className="border-b text-xs">
                      <th className="text-center p-2 font-medium w-10">#</th>
                      <th className="text-left p-2 font-medium">Name</th>
                      <th className="text-left p-2 font-medium">Branch</th>
                      <th className="text-left p-2 font-medium">Role</th>
                      <th className="text-right p-2 font-medium">Total Sales</th>
                      <th className="text-center p-2 font-medium">Transactions</th>
                      <th className="text-right p-2 font-medium">Cash</th>
                      <th className="text-right p-2 font-medium">Bank</th>
                      <th className="text-right p-2 font-medium">Avg/Txn</th>
                    </tr></thead>
                    <tbody>
                      {cashierPerf.map((u, i) => (
                        <tr key={u.user_id} className="border-b hover:bg-stone-50 text-sm" data-testid={`cashier-row-${u.user_id}`}>
                          <td className="p-2 text-center"><span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold inline-flex items-center justify-center">{i+1}</span></td>
                          <td className="p-2 font-medium">{u.name}</td>
                          <td className="p-2 text-muted-foreground text-xs">{u.branch}</td>
                          <td className="p-2"><Badge variant="outline" className="capitalize text-[10px]">{u.role}</Badge></td>
                          <td className="p-2 text-right font-bold text-emerald-600">{fmt(u.total_sales)}</td>
                          <td className="p-2 text-center"><Badge variant="outline" className="text-[10px]">{u.transaction_count}</Badge></td>
                          <td className="p-2 text-right text-emerald-600">{fmt(u.cash_collected)}</td>
                          <td className="p-2 text-right text-blue-600">{fmt(u.bank_collected)}</td>
                          <td className="p-2 text-right font-medium">{fmt(u.avg_transaction)}</td>
                        </tr>
                      ))}
                      {cashierPerf.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No cashier data. Create sales to see performance rankings.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BRANCH REPORT */}
          <TabsContent value="branch_report" className="space-y-6">
            {branches.map(b => {
              const bs = calcStats(filterByBranch(sales, b.id), filterByBranch(expenses, b.id), filterByBranch(supplierPayments, b.id));
              const brExpenses = filterByBranch(expenses, b.id);
              const expCats = {};
              brExpenses.forEach(e => { expCats[e.category] = (expCats[e.category] || 0) + e.amount; });
              const brSP = filterByBranch(supplierPayments, b.id);
              const spCats = {};
              brSP.forEach(p => { const name = p.supplier_name || 'Unknown'; spCats[name] = (spCats[name] || 0) + p.amount; });
              return (
                <Card key={b.id} className="border-stone-100">
                  <CardHeader><CardTitle className="font-outfit">{b.name}</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
                      <div className="p-3 bg-emerald-50 rounded-xl text-center"><div className="text-[10px] text-muted-foreground">Sales</div><div className="text-base sm:text-lg font-bold text-emerald-600">{fmt(bs.totalSales)}</div></div>
                      <div className="p-3 bg-red-50 rounded-xl text-center"><div className="text-[10px] text-muted-foreground">Expenses</div><div className="text-base sm:text-lg font-bold text-red-600">{fmt(bs.totalExpenses)}</div></div>
                      <div className="p-3 bg-blue-50 rounded-xl text-center"><div className="text-[10px] text-muted-foreground">Supplier Pay</div><div className="text-base sm:text-lg font-bold text-blue-600">{fmt(bs.totalSP)}</div></div>
                      <div className="p-3 bg-emerald-50 rounded-xl text-center"><div className="text-[10px] text-muted-foreground">Cash</div><div className="text-base sm:text-lg font-bold text-emerald-600">{fmt(bs.cash)}</div></div>
                      <div className="p-3 bg-blue-50 rounded-xl text-center col-span-2 sm:col-span-1"><div className="text-[10px] text-muted-foreground">Bank</div><div className="text-base sm:text-lg font-bold text-blue-600">{fmt(bs.bank)}</div></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium mb-2">Expense Breakdown</p>
                        <div className="space-y-1">{Object.entries(expCats).sort((a,b) => b[1]-a[1]).map(([cat, amt]) => (
                          <div key={cat} className="flex justify-between items-center p-2 bg-stone-50 rounded-lg text-xs">
                            <span className="capitalize font-medium">{cat.replace('_',' ')}</span>
                            <div className="flex items-center gap-2"><div className="w-16 sm:w-20 h-1.5 bg-stone-200 rounded-full overflow-hidden"><div className="h-full bg-red-500 rounded-full" style={{width: `${bs.totalExpenses > 0 ? (amt/bs.totalExpenses*100) : 0}%`}} /></div><span className="font-bold w-20 text-right">{fmt(amt)}</span></div>
                          </div>
                        ))}</div>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-2">Supplier Payments</p>
                        <div className="space-y-1">{Object.entries(spCats).sort((a,b) => b[1]-a[1]).map(([name, amt]) => (
                          <div key={name} className="flex justify-between items-center p-2 bg-stone-50 rounded-lg text-xs">
                            <span className="font-medium">{name}</span>
                            <span className="font-bold">{fmt(amt)}</span>
                          </div>
                        ))}{Object.keys(spCats).length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No supplier payments</p>}</div>
                      </div>
                    </div>
                    <div className="flex justify-between p-3 bg-orange-50 rounded-xl border border-orange-200">
                      <span className="font-bold">Net Profit</span>
                      <span className={`font-bold text-lg ${bs.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(bs.netProfit)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* EXPENSE REPORT */}
          <TabsContent value="expense_report" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-stone-100">
                <CardHeader><CardTitle className="font-outfit text-base">Expenses by Category</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart><Pie data={catData} cx="50%" cy="50%" outerRadius={110} innerRadius={50} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>{catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v) => fmt(v)} /></PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">{catData.map((c, i) => (
                    <div key={c.name} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{background: COLORS[i % COLORS.length]}} />
                      <span className="text-sm flex-1">{c.name}</span>
                      <span className="text-sm font-bold">{fmt(c.value)}</span>
                      <span className="text-xs text-muted-foreground w-12 text-right">{stats.totalExpenses > 0 ? (c.value/stats.totalExpenses*100).toFixed(1) : 0}%</span>
                    </div>
                  ))}</div>
                </CardContent>
              </Card>

              <Card className="border-stone-100">
                <CardHeader><CardTitle className="font-outfit text-base">Expenses by Branch</CardTitle></CardHeader>
                <CardContent>
                  {(() => {
                    const brExp = {};
                    fExp.forEach(e => {
                      const bName = branches.find(b => b.id === e.branch_id)?.name || 'No Branch';
                      if (!brExp[bName]) brExp[bName] = { total: 0, cash: 0, bank: 0, categories: {} };
                      brExp[bName].total += e.amount;
                      if (e.payment_mode === 'cash') brExp[bName].cash += e.amount;
                      if (e.payment_mode === 'bank') brExp[bName].bank += e.amount;
                      brExp[bName].categories[e.category] = (brExp[bName].categories[e.category] || 0) + e.amount;
                    });
                    return (
                      <div className="space-y-4">{Object.entries(brExp).sort((a,b) => b[1].total-a[1].total).map(([bName, data]) => (
                        <div key={bName} className="border rounded-xl p-3 bg-stone-50">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 mb-2">
                            <span className="font-medium text-sm">{bName}</span>
                            <div className="flex gap-3 text-xs">
                              <span className="text-emerald-600">Cash: {fmt(data.cash)}</span>
                              <span className="text-blue-600">Bank: {fmt(data.bank)}</span>
                              <span className="font-bold">Total: {fmt(data.total)}</span>
                            </div>
                          </div>
                          <div className="flex gap-1 flex-wrap">{Object.entries(data.categories).sort((a,b) => b[1]-a[1]).map(([cat, amt]) => (
                            <Badge key={cat} variant="secondary" className="text-[10px] capitalize">{cat.replace('_',' ')}: {fmt(amt)}</Badge>
                          ))}</div>
                        </div>
                      ))}</div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>

            <Card className="border-stone-100">
              <CardHeader><CardTitle className="font-outfit text-base">Salary & Employee Costs by Branch</CardTitle></CardHeader>
              <CardContent>
                {(() => {
                  const salaryExp = fExp.filter(e => ['salary', 'tickets', 'id_card', 'bonus', 'overtime'].includes(e.category));
                  const brSalary = {};
                  salaryExp.forEach(e => {
                    const bName = branches.find(b => b.id === e.branch_id)?.name || 'No Branch';
                    if (!brSalary[bName]) brSalary[bName] = {};
                    brSalary[bName][e.category] = (brSalary[bName][e.category] || 0) + e.amount;
                  });
                  const barData = Object.entries(brSalary).map(([name, cats]) => ({ name, Salary: cats.salary || 0, Overtime: cats.overtime || 0, Bonus: cats.bonus || 0, Tickets: cats.tickets || 0, 'ID Card': cats.id_card || 0 }));
                  return barData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={barData}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="name" tick={{fontSize: 11}} /><YAxis tick={{fontSize: 11}} /><Tooltip formatter={(v) => fmt(v)} /><Legend />
                        <Bar dataKey="Salary" fill="#22C55E" radius={[4,4,0,0]} stackId="a" />
                        <Bar dataKey="Overtime" fill="#0EA5E9" radius={[0,0,0,0]} stackId="a" />
                        <Bar dataKey="Bonus" fill="#F5841F" radius={[0,0,0,0]} stackId="a" />
                        <Bar dataKey="Tickets" fill="#F59E0B" radius={[0,0,0,0]} stackId="a" />
                        <Bar dataKey="ID Card" fill="#EF4444" radius={[4,4,0,0]} stackId="a" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-center text-muted-foreground py-8">No salary expenses</p>;
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PERIOD COMPARE */}
          <TabsContent value="period" className="space-y-6">
            <Card className="border-stone-100"><CardContent className="pt-6">
              <div className="flex gap-2 sm:gap-4 items-center mb-6 flex-wrap">
                <Label className="text-sm">Compare by:</Label>
                {['day', 'month', 'year'].map(p => <Button key={p} size="sm" variant={comparePeriod === p ? 'default' : 'outline'} onClick={() => setComparePeriod(p)} className="capitalize rounded-xl text-xs">{p}</Button>)}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-6 mb-6">
                <div className="p-3 sm:p-4 bg-orange-50 rounded-xl border border-orange-200"><div className="text-xs sm:text-sm font-medium text-orange-600 mb-1">Current: {periodLabel(0)}</div><div className="text-lg sm:text-2xl font-bold font-outfit">{fmt(p1.totalSales)} sales</div></div>
                <div className="p-3 sm:p-4 bg-stone-50 rounded-xl border"><div className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">Previous: {periodLabel(1)}</div><div className="text-lg sm:text-2xl font-bold font-outfit">{fmt(p2.totalSales)} sales</div></div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={periodCompare}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="metric" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v) => fmt(v)} /><Legend /><Bar dataKey="current" name={periodLabel(0)} fill="#F5841F" radius={[4, 4, 0, 0]} /><Bar dataKey="previous" name={periodLabel(1)} fill="#94A3B8" radius={[4, 4, 0, 0]} /></BarChart>
              </ResponsiveContainer>
              <div className="mt-4 overflow-x-auto"><table className="w-full"><thead><tr className="border-b"><th className="text-left p-2 sm:p-3 text-xs font-medium">Metric</th><th className="text-right p-2 sm:p-3 text-xs font-medium">{periodLabel(0)}</th><th className="text-right p-2 sm:p-3 text-xs font-medium">{periodLabel(1)}</th><th className="text-right p-2 sm:p-3 text-xs font-medium">Change</th></tr></thead>
              <tbody>{periodCompare.map(r => { const change = r.previous > 0 ? ((r.current - r.previous) / r.previous * 100).toFixed(1) : '0'; const up = r.current >= r.previous; return (<tr key={r.metric} className="border-b hover:bg-stone-50"><td className="p-2 sm:p-3 text-xs sm:text-sm font-medium">{r.metric}</td><td className="p-2 sm:p-3 text-xs sm:text-sm text-right font-bold">{fmt(r.current)}</td><td className="p-2 sm:p-3 text-xs sm:text-sm text-right">{fmt(r.previous)}</td><td className="p-2 sm:p-3 text-right"><Badge className={up ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>{up ? '+' : ''}{change}%</Badge></td></tr>); })}</tbody></table></div>
            </CardContent></Card>
          </TabsContent>

          {/* BRANCH COMPARE */}
          <TabsContent value="branch" className="space-y-6">
            <Card className="border-stone-100"><CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div><Label className="text-xs">Branch 1</Label><Select value={compareBranch1} onValueChange={setCompareBranch1}><SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="text-xs">Branch 2</Label><Select value={compareBranch2} onValueChange={setCompareBranch2}><SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
              </div>
              {branchCompare.length > 0 ? (<>
                <ResponsiveContainer width="100%" height={300}><BarChart data={branchCompare}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="metric" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v) => fmt(v)} /><Legend /><Bar dataKey={b1Name} fill="#F5841F" radius={[4, 4, 0, 0]} /><Bar dataKey={b2Name} fill="#0EA5E9" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
              </>) : <p className="text-center text-muted-foreground py-12">Select two branches to compare</p>}
            </CardContent></Card>
          </TabsContent>

          {/* TRENDS */}
          <TabsContent value="trend" className="space-y-6">
            <Card className="border-stone-100"><CardHeader><CardTitle className="font-outfit text-base">Sales vs Expenses (6 Months)</CardTitle></CardHeader><CardContent>
              <ResponsiveContainer width="100%" height={300}><AreaChart data={combinedTrend}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(v) => fmt(v)} /><Legend /><Area type="monotone" dataKey="Sales" stroke="#22C55E" fill="#22C55E" fillOpacity={0.1} strokeWidth={2} /><Area type="monotone" dataKey="Expenses" stroke="#EF4444" fill="#EF4444" fillOpacity={0.1} strokeWidth={2} /></AreaChart></ResponsiveContainer>
            </CardContent></Card>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-stone-100"><CardHeader><CardTitle className="font-outfit text-base">Monthly Sales Trend</CardTitle></CardHeader><CardContent>
                <ResponsiveContainer width="100%" height={250}><LineChart data={salesTrend}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v) => fmt(v)} /><Line type="monotone" dataKey="amount" stroke="#F5841F" strokeWidth={3} dot={{ fill: '#F5841F', r: 5 }} /></LineChart></ResponsiveContainer>
              </CardContent></Card>
              <Card className="border-stone-100"><CardHeader><CardTitle className="font-outfit text-base">Monthly Expenses Trend</CardTitle></CardHeader><CardContent>
                <ResponsiveContainer width="100%" height={250}><LineChart data={expTrend}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v) => fmt(v)} /><Line type="monotone" dataKey="amount" stroke="#EF4444" strokeWidth={3} dot={{ fill: '#EF4444', r: 5 }} /></LineChart></ResponsiveContainer>
              </CardContent></Card>
            </div>
          </TabsContent>

          {/* ITEM P&L */}
          <TabsContent value="item_pnl" className="space-y-6" data-testid="item-pnl-content">
            <Card className="border-stone-100">
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <CardTitle className="font-outfit text-base">Item-Level Profit & Loss</CardTitle>
                  <div className="flex gap-2 flex-wrap">
                    <Select value={pnlBranch || "all"} onValueChange={async (v) => {
                      const bid = v === "all" ? "" : v;
                      setPnlBranch(bid);
                      try { const url = bid ? `/reports/item-pnl?branch_id=${bid}` : '/reports/item-pnl'; const r = await api.get(url); setItemPnl(r.data); } catch {}
                    }}>
                      <SelectTrigger className="w-36 h-9" data-testid="pnl-branch-filter"><SelectValue placeholder="All Branches" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">All Branches</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={async () => {
                      try { const url = pnlBranch ? `/reports/item-pnl?branch_id=${pnlBranch}` : '/reports/item-pnl'; const r = await api.get(url); setItemPnl(r.data); } catch {}
                    }}>Refresh</Button>
                    {itemPnl && <Button size="sm" variant="outline" className="rounded-xl" onClick={() => {
                      const csv = 'Item,Category,Unit,Purchased Qty,Purchased Cost,Avg Cost,Kitchen Used,Sold Qty,Revenue,Cost of Sold,Profit,Margin %,Stock\n' + itemPnl.rows.map(r => `${r.item_name},${r.category},${r.unit},${r.purchased_qty},${r.purchased_cost},${r.avg_cost},${r.used_qty},${r.sold_qty},${r.sold_revenue},${r.cost_of_sold},${r.profit},${r.margin},${r.current_stock}`).join('\n');
                      const blob = new Blob([csv], {type:'text/csv'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='item_pnl_report.csv'; a.click(); toast.success('Exported');
                    }}><FileSpreadsheet size={14} className="mr-1" />Export</Button>}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!itemPnl ? (
                  <div className="text-center py-8">
                    <Button className="rounded-xl" onClick={async () => { try { const r = await api.get('/reports/item-pnl'); setItemPnl(r.data); } catch { toast.error('Failed to load'); } }} data-testid="load-pnl-btn">Load P&L Report</Button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 mb-4">
                      <div className="p-3 bg-stone-50 rounded-xl text-center"><p className="text-[10px] text-muted-foreground">Items</p><p className="text-base sm:text-lg font-bold font-outfit">{itemPnl.summary.total_items}</p></div>
                      <div className="p-3 bg-red-50 rounded-xl text-center"><p className="text-[10px] text-muted-foreground">Total Cost</p><p className="text-base sm:text-lg font-bold text-red-600">{fmt(itemPnl.summary.total_cost)}</p></div>
                      <div className="p-3 bg-emerald-50 rounded-xl text-center"><p className="text-[10px] text-muted-foreground">Revenue</p><p className="text-base sm:text-lg font-bold text-emerald-600">{fmt(itemPnl.summary.total_revenue)}</p></div>
                      <div className={`p-3 rounded-xl text-center ${itemPnl.summary.total_profit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}><p className="text-[10px] text-muted-foreground">Profit</p><p className={`text-base sm:text-lg font-bold ${itemPnl.summary.total_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(itemPnl.summary.total_profit)}</p></div>
                      <div className="p-3 bg-orange-50 rounded-xl text-center col-span-2 sm:col-span-1"><p className="text-[10px] text-muted-foreground">Margin</p><p className="text-base sm:text-lg font-bold text-orange-600">{itemPnl.summary.overall_margin}%</p></div>
                    </div>
                    <div className="max-h-[500px] overflow-auto border rounded-xl">
                      <table className="w-full" data-testid="pnl-table">
                        <thead className="sticky top-0 bg-stone-50 z-10"><tr className="border-b text-[10px] sm:text-xs">
                          <th className="text-left p-2 font-medium">Item</th>
                          <th className="text-left p-2 font-medium hidden sm:table-cell">Category</th>
                          <th className="text-right p-2 font-medium hidden sm:table-cell">Purchased</th>
                          <th className="text-right p-2 font-medium hidden sm:table-cell">Cost</th>
                          <th className="text-right p-2 font-medium">Revenue</th>
                          <th className="text-right p-2 font-medium">Profit</th>
                          <th className="text-right p-2 font-medium">Margin</th>
                          <th className="text-right p-2 font-medium hidden sm:table-cell">Stock</th>
                        </tr></thead>
                        <tbody>
                          {itemPnl.rows.map(r => (
                            <tr key={r.item_id} className={`border-b hover:bg-stone-50 text-xs sm:text-sm ${r.profit < 0 ? 'bg-red-50/50' : ''}`} data-testid={`pnl-row-${r.item_id}`}>
                              <td className="p-2 font-medium">{r.item_name}</td>
                              <td className="p-2 text-muted-foreground text-xs capitalize hidden sm:table-cell">{r.category || '-'}</td>
                              <td className="p-2 text-right hidden sm:table-cell">{r.purchased_qty} {r.unit}</td>
                              <td className="p-2 text-right text-red-600 hidden sm:table-cell">{fmt(r.purchased_cost)}</td>
                              <td className="p-2 text-right text-emerald-600 font-medium">{fmt(r.sold_revenue)}</td>
                              <td className={`p-2 text-right font-bold ${r.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(r.profit)}</td>
                              <td className={`p-2 text-right ${r.margin >= 30 ? 'text-emerald-600' : r.margin >= 0 ? 'text-amber-600' : 'text-red-600'}`}>{r.margin}%</td>
                              <td className="p-2 text-right hidden sm:table-cell"><Badge variant="outline" className={r.current_stock <= 0 ? 'border-red-300 text-red-600' : 'text-[10px]'}>{r.current_stock} {r.unit}</Badge></td>
                            </tr>
                          ))}
                          {itemPnl.rows.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No item data. Add stock entries and create invoices with items to see P&L.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    {itemPnl.rows.length > 0 && (
                      <div className="mt-4">
                        <h3 className="text-sm font-medium mb-2">Top Items by Revenue</h3>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={itemPnl.rows.slice(0, 10)}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="item_name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v) => fmt(v)} /><Legend /><Bar dataKey="sold_revenue" name="Revenue" fill="#22C55E" /><Bar dataKey="cost_of_sold" name="Cost" fill="#EF4444" /><Bar dataKey="profit" name="Profit" fill="#F5841F" /></BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* HR ANALYTICS */}
          <TabsContent value="hr_analytics" className="space-y-6" data-testid="hr-analytics-content">
            <HRAnalyticsTab />
          </TabsContent>

          {/* CUSTOM REPORTS */}
          <TabsContent value="custom_reports" className="space-y-4" data-testid="custom-reports-content">
            <CustomReportsTab branches={branches} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
