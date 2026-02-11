import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileText, FileSpreadsheet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts';
import api from '@/lib/api';
import { toast } from 'sonner';

const COLORS = ['#F5841F', '#22C55E', '#0EA5E9', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#06B6D4'];

export default function ReportsPage() {
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchCashBank, setBranchCashBank] = useState([]);
  const [loading, setLoading] = useState(true);
  const [compareMode, setCompareMode] = useState('overview');
  const [compareBranch1, setCompareBranch1] = useState('');
  const [compareBranch2, setCompareBranch2] = useState('');
  const [comparePeriod, setComparePeriod] = useState('month');

  const [filters, setFilters] = useState({ startDate: '', endDate: '', branchId: 'all', type: 'all' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [sR, eR, pR, bR, cbR] = await Promise.all([api.get('/sales'), api.get('/expenses'), api.get('/supplier-payments'), api.get('/branches'), api.get('/reports/branch-cashbank')]);
      setSales(sR.data); setExpenses(eR.data); setSupplierPayments(pR.data); setBranches(bR.data); setBranchCashBank(cbR.data);
    } catch { toast.error('Failed to fetch data'); }
    finally { setLoading(false); }
  };

  const filterByDate = (data) => data.filter(item => {
    const d = new Date(item.date);
    const sm = !filters.startDate || d >= new Date(filters.startDate);
    const em = !filters.endDate || d <= new Date(filters.endDate);
    const bm = filters.branchId === 'all' || item.branch_id === filters.branchId;
    return sm && em && bm;
  });
  const filterByBranch = (data, bid) => data.filter(d => d.branch_id === bid);
  const filterByPeriod = (data, offset = 0) => {
    const now = new Date();
    let start, end;
    if (comparePeriod === 'month') {
      start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0, 23, 59, 59);
    } else if (comparePeriod === 'year') {
      start = new Date(now.getFullYear() - offset, 0, 1);
      end = new Date(now.getFullYear() - offset, 11, 31, 23, 59, 59);
    } else {
      const day = new Date(now); day.setDate(day.getDate() - offset);
      start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);
    }
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

  const handleExport = async (fmt) => {
    try {
      toast.loading(`Generating ${fmt.toUpperCase()}...`);
      const res = await api.post('/export/reports', { format: fmt, start_date: filters.startDate || null, end_date: filters.endDate || null, branch_id: filters.branchId !== 'all' ? filters.branchId : null }, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a'); link.href = url; link.setAttribute('download', `report.${fmt === 'pdf' ? 'pdf' : 'xlsx'}`);
      document.body.appendChild(link); link.click(); link.remove(); toast.dismiss(); toast.success('Downloaded');
    } catch { toast.dismiss(); toast.error('Failed'); }
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  const fSales = filterByDate(sales); const fExp = filterByDate(expenses); const fSP = filterByDate(supplierPayments);
  const stats = calcStats(fSales, fExp, fSP);
  const categoryExp = {}; fExp.forEach(e => { categoryExp[e.category] = (categoryExp[e.category] || 0) + e.amount; });
  const catData = Object.entries(categoryExp).map(([n, v]) => ({ name: n.charAt(0).toUpperCase() + n.slice(1), value: v })).sort((a, b) => b.value - a.value);
  const payPie = [{ name: 'Cash', value: stats.cash }, { name: 'Bank', value: stats.bank }].filter(d => d.value > 0);
  const salesTrend = getMonthlyTrend(sales, 6);
  const expTrend = getMonthlyTrend(expenses, 6);
  const combinedTrend = salesTrend.map((s, i) => ({ month: s.month, Sales: s.amount, Expenses: expTrend[i]?.amount || 0 }));

  // Period comparison
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

  // Branch comparison
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
      <div className="space-y-6">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 className="text-4xl font-bold font-outfit mb-2">Reports & Analytics</h1>
            <p className="text-muted-foreground">Compare branches, periods, and track performance</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => handleExport('pdf')} variant="outline" className="rounded-xl"><FileText size={16} className="mr-2" />PDF</Button>
            <Button onClick={() => handleExport('excel')} variant="outline" className="rounded-xl"><FileSpreadsheet size={16} className="mr-2" />Excel</Button>
          </div>
        </div>

        <Tabs value={compareMode} onValueChange={setCompareMode}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="period">Period Compare</TabsTrigger>
            <TabsTrigger value="branch">Branch Compare</TabsTrigger>
            <TabsTrigger value="trend">Trends</TabsTrigger>
            <TabsTrigger value="detailed">Detailed</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-6">
            <Card className="border-stone-100"><CardHeader><CardTitle className="font-outfit text-base">Filters</CardTitle></CardHeader><CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><Label>Start</Label><Input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} /></div>
                <div><Label>End</Label><Input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} /></div>
                <div><Label>Branch</Label><Select value={filters.branchId} onValueChange={(v) => setFilters({ ...filters, branchId: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="flex items-end"><Button onClick={() => setFilters({ startDate: '', endDate: '', branchId: 'all', type: 'all' })} variant="outline" className="rounded-xl w-full">Clear</Button></div>
              </div>
            </CardContent></Card>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-stone-100 stat-card"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Sales</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-success">${stats.totalSales.toFixed(2)}</div></CardContent></Card>
              <Card className="border-stone-100 stat-card"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Expenses</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-error">${stats.totalExpenses.toFixed(2)}</div></CardContent></Card>
              <Card className="border-stone-100 stat-card"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Supplier Pay</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-info">${stats.totalSP.toFixed(2)}</div></CardContent></Card>
              <Card className="border-stone-100 stat-card"><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Net Profit</CardTitle></CardHeader><CardContent><div className={`text-2xl font-bold ${stats.netProfit >= 0 ? 'text-success' : 'text-error'}`}>${stats.netProfit.toFixed(2)}</div></CardContent></Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {payPie.length > 0 && <Card className="border-stone-100"><CardHeader><CardTitle className="font-outfit text-base">Payment Mode</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={250}><PieChart><Pie data={payPie} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{payPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Pie><Tooltip formatter={(v) => `$${v.toFixed(2)}`} /></PieChart></ResponsiveContainer></CardContent></Card>}
              {catData.length > 0 && <Card className="border-stone-100"><CardHeader><CardTitle className="font-outfit text-base">Expense Categories</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={250}><BarChart data={catData}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v) => `$${v.toFixed(2)}`} /><Bar dataKey="value" fill="#EF4444" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>}
            </div>

            {branchCashBank.length > 0 && <Card className="border-stone-100"><CardHeader><CardTitle className="font-outfit text-base">Branch Cash vs Bank</CardTitle></CardHeader><CardContent>
              <ResponsiveContainer width="100%" height={300}><BarChart data={branchCashBank.map(b => ({ name: b.branch_name, 'Sales Cash': b.sales_cash, 'Sales Bank': b.sales_bank, 'Exp Cash': b.expenses_cash, 'Exp Bank': b.expenses_bank }))}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(v) => `$${v.toFixed(2)}`} /><Legend /><Bar dataKey="Sales Cash" fill="#22C55E" radius={[4, 4, 0, 0]} /><Bar dataKey="Sales Bank" fill="#0EA5E9" radius={[4, 4, 0, 0]} /><Bar dataKey="Exp Cash" fill="#F59E0B" radius={[4, 4, 0, 0]} /><Bar dataKey="Exp Bank" fill="#EF4444" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
            </CardContent></Card>}
          </TabsContent>

          {/* PERIOD COMPARE */}
          <TabsContent value="period" className="space-y-6">
            <Card className="border-stone-100"><CardContent className="pt-6">
              <div className="flex gap-4 items-center mb-6">
                <Label>Compare by:</Label>
                {['day', 'month', 'year'].map(p => <Button key={p} size="sm" variant={comparePeriod === p ? 'default' : 'outline'} onClick={() => setComparePeriod(p)} className="capitalize rounded-xl">{p}</Button>)}
              </div>
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/20"><div className="text-sm font-medium text-primary mb-1">Current: {periodLabel(0)}</div><div className="text-2xl font-bold font-outfit">${p1.totalSales.toFixed(2)} sales</div></div>
                <div className="p-4 bg-stone-50 rounded-xl border"><div className="text-sm font-medium text-muted-foreground mb-1">Previous: {periodLabel(1)}</div><div className="text-2xl font-bold font-outfit">${p2.totalSales.toFixed(2)} sales</div></div>
              </div>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={periodCompare}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="metric" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(v) => `$${v.toFixed(2)}`} /><Legend /><Bar dataKey="current" name={periodLabel(0)} fill="#F5841F" radius={[4, 4, 0, 0]} /><Bar dataKey="previous" name={periodLabel(1)} fill="#94A3B8" radius={[4, 4, 0, 0]} /></BarChart>
              </ResponsiveContainer>
              <div className="mt-4 overflow-x-auto"><table className="w-full"><thead><tr className="border-b"><th className="text-left p-3 text-sm font-medium">Metric</th><th className="text-right p-3 text-sm font-medium">{periodLabel(0)}</th><th className="text-right p-3 text-sm font-medium">{periodLabel(1)}</th><th className="text-right p-3 text-sm font-medium">Change</th></tr></thead>
              <tbody>{periodCompare.map(r => { const change = r.previous > 0 ? ((r.current - r.previous) / r.previous * 100).toFixed(1) : '0'; const up = r.current >= r.previous; return (<tr key={r.metric} className="border-b hover:bg-stone-50"><td className="p-3 text-sm font-medium">{r.metric}</td><td className="p-3 text-sm text-right font-bold">${r.current.toFixed(2)}</td><td className="p-3 text-sm text-right">${r.previous.toFixed(2)}</td><td className="p-3 text-sm text-right"><Badge className={up ? 'bg-success/20 text-success' : 'bg-error/20 text-error'}>{up ? '+' : ''}{change}%</Badge></td></tr>); })}</tbody></table></div>
            </CardContent></Card>
          </TabsContent>

          {/* BRANCH COMPARE */}
          <TabsContent value="branch" className="space-y-6">
            <Card className="border-stone-100"><CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div><Label>Branch 1</Label><Select value={compareBranch1} onValueChange={setCompareBranch1}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Branch 2</Label><Select value={compareBranch2} onValueChange={setCompareBranch2}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
              </div>
              {branchCompare.length > 0 ? (<>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={branchCompare}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="metric" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(v) => `$${v.toFixed(2)}`} /><Legend /><Bar dataKey={b1Name} fill="#F5841F" radius={[4, 4, 0, 0]} /><Bar dataKey={b2Name} fill="#0EA5E9" radius={[4, 4, 0, 0]} /></BarChart>
                </ResponsiveContainer>
                <div className="mt-4 overflow-x-auto"><table className="w-full"><thead><tr className="border-b"><th className="text-left p-3 text-sm font-medium">Metric</th><th className="text-right p-3 text-sm font-medium">{b1Name}</th><th className="text-right p-3 text-sm font-medium">{b2Name}</th><th className="text-right p-3 text-sm font-medium">Difference</th></tr></thead>
                <tbody>{branchCompare.map(r => (<tr key={r.metric} className="border-b hover:bg-stone-50"><td className="p-3 text-sm font-medium">{r.metric}</td><td className="p-3 text-sm text-right font-bold">${r[b1Name].toFixed(2)}</td><td className="p-3 text-sm text-right font-bold">${r[b2Name].toFixed(2)}</td><td className="p-3 text-sm text-right"><Badge className={r[b1Name] >= r[b2Name] ? 'bg-primary/20 text-primary' : 'bg-info/20 text-info'}>${Math.abs(r[b1Name] - r[b2Name]).toFixed(2)}</Badge></td></tr>))}</tbody></table></div>
              </>) : <p className="text-center text-muted-foreground py-12">Select two branches to compare</p>}
            </CardContent></Card>
          </TabsContent>

          {/* TRENDS */}
          <TabsContent value="trend" className="space-y-6">
            <Card className="border-stone-100"><CardHeader><CardTitle className="font-outfit text-base">Sales vs Expenses (6 Months)</CardTitle></CardHeader><CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={combinedTrend}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(v) => `$${v.toFixed(2)}`} /><Legend /><Area type="monotone" dataKey="Sales" stroke="#22C55E" fill="#22C55E" fillOpacity={0.1} strokeWidth={2} /><Area type="monotone" dataKey="Expenses" stroke="#EF4444" fill="#EF4444" fillOpacity={0.1} strokeWidth={2} /></AreaChart>
              </ResponsiveContainer>
            </CardContent></Card>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-stone-100"><CardHeader><CardTitle className="font-outfit text-base">Monthly Sales Trend</CardTitle></CardHeader><CardContent>
                <ResponsiveContainer width="100%" height={250}><LineChart data={salesTrend}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v) => `$${v.toFixed(2)}`} /><Line type="monotone" dataKey="amount" stroke="#F5841F" strokeWidth={3} dot={{ fill: '#F5841F', r: 5 }} /></LineChart></ResponsiveContainer>
              </CardContent></Card>
              <Card className="border-stone-100"><CardHeader><CardTitle className="font-outfit text-base">Monthly Expenses Trend</CardTitle></CardHeader><CardContent>
                <ResponsiveContainer width="100%" height={250}><LineChart data={expTrend}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(v) => `$${v.toFixed(2)}`} /><Line type="monotone" dataKey="amount" stroke="#EF4444" strokeWidth={3} dot={{ fill: '#EF4444', r: 5 }} /></LineChart></ResponsiveContainer>
              </CardContent></Card>
            </div>
          </TabsContent>

          {/* DETAILED */}
          <TabsContent value="detailed" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-stone-100"><CardHeader><CardTitle className="font-outfit text-base">Top Expense Categories</CardTitle></CardHeader><CardContent>
                <div className="space-y-2">{catData.slice(0, 8).map((c, i) => (
                  <div key={c.name} className="flex items-center gap-3"><div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} /><span className="text-sm flex-1">{c.name}</span><span className="font-bold text-sm">${c.value.toFixed(2)}</span><span className="text-xs text-muted-foreground">{stats.totalExpenses > 0 ? (c.value / stats.totalExpenses * 100).toFixed(1) : 0}%</span></div>
                ))}</div>
              </CardContent></Card>
              <Card className="border-stone-100"><CardHeader><CardTitle className="font-outfit text-base">Branch Performance</CardTitle></CardHeader><CardContent>
                <div className="space-y-3">{branches.map(b => {
                  const bs = calcStats(filterByBranch(sales, b.id), filterByBranch(expenses, b.id), filterByBranch(supplierPayments, b.id));
                  return (<div key={b.id} className="p-3 bg-stone-50 rounded-xl"><div className="flex justify-between items-center"><span className="font-medium text-sm">{b.name}</span><Badge className={bs.netProfit >= 0 ? 'bg-success/20 text-success' : 'bg-error/20 text-error'}>${bs.netProfit.toFixed(2)}</Badge></div>
                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground"><span>Sales: ${bs.totalSales.toFixed(0)}</span><span>Exp: ${bs.totalExpenses.toFixed(0)}</span><span>Txns: {bs.count}</span></div></div>);
                })}</div>
              </CardContent></Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
