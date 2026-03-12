import { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, DollarSign, Percent, Download, Calendar } from 'lucide-react';
import api from '@/lib/api';

function formatCurrency(val) {
  return `SAR ${(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ProfitLossPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');

  const fetchBranches = async () => {
    try {
      const res = await api.get('/branches');
      setBranches(res.data || []);
    } catch {}
  };

  const fetchPnL = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (branchId) params.append('branch_id', branchId);
      const res = await api.get(`/accounting/profit-loss?${params}`);
      setData(res.data);
    } catch { toast.error('Failed to load P&L report'); }
    setLoading(false);
  };

  useEffect(() => { fetchBranches(); fetchPnL(); }, []);

  const applyFilter = () => fetchPnL();

  const setQuickRange = (range) => {
    const now = new Date();
    let start;
    if (range === 'today') {
      start = new Date(now); start.setHours(0, 0, 0, 0);
    } else if (range === 'week') {
      start = new Date(now); start.setDate(start.getDate() - 7);
    } else if (range === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (range === 'quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), qMonth, 1);
    } else if (range === 'year') {
      start = new Date(now.getFullYear(), 0, 1);
    }
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(now.toISOString().split('T')[0]);
    setTimeout(fetchPnL, 100);
  };

  if (loading && !data) return (
    <DashboardLayout>
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-stone-400">Loading P&L Report...</div>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6" data-testid="profit-loss-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-800" data-testid="page-title">Profit & Loss Statement</h1>
            <p className="text-sm text-stone-500 mt-1">
              {data?.period?.start && data?.period?.end
                ? `${new Date(data.period.start).toLocaleDateString()} - ${new Date(data.period.end).toLocaleDateString()}`
                : 'Current month'}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-2">
              {[{k: 'today', l: 'Today'}, {k: 'week', l: 'Week'}, {k: 'month', l: 'Month'}, {k: 'quarter', l: 'Quarter'}, {k: 'year', l: 'Year'}].map(r => (
                <button key={r.k} onClick={() => setQuickRange(r.k)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
                  data-testid={`range-${r.k}`}>{r.l}</button>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40" data-testid="start-date" />
              <span className="text-stone-400">to</span>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40" data-testid="end-date" />
              {branches.length > 0 && (
                <Select value={branchId || "all"} onValueChange={v => setBranchId(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-40" data-testid="branch-filter"><SelectValue placeholder="All Branches" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Button onClick={applyFilter} className="bg-orange-500 hover:bg-orange-600 text-white" data-testid="apply-filter">Apply</Button>
            </div>
          </div>
        </div>

        {data && (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-xl border border-green-200 bg-green-50 p-5" data-testid="metric-revenue">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <span className="text-xs font-medium text-green-600 uppercase">Total Revenue</span>
                </div>
                <p className="text-2xl font-bold text-green-800 mt-2">{formatCurrency(data.revenue.total)}</p>
                <p className="text-xs text-green-600 mt-1">{data.revenue.sales_count} sales</p>
              </div>
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-5" data-testid="metric-cogs">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-orange-600" />
                  <span className="text-xs font-medium text-orange-600 uppercase">Cost of Sales</span>
                </div>
                <p className="text-2xl font-bold text-orange-800 mt-2">{formatCurrency(data.cost_of_sales.total)}</p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-5" data-testid="metric-gross">
                <div className="flex items-center gap-2">
                  <Percent className="w-5 h-5 text-blue-600" />
                  <span className="text-xs font-medium text-blue-600 uppercase">Gross Profit</span>
                </div>
                <p className="text-2xl font-bold text-blue-800 mt-2">{formatCurrency(data.gross_profit)}</p>
                <p className="text-xs text-blue-600 mt-1">Margin: {data.gross_margin}%</p>
              </div>
              <div className={`rounded-xl border p-5 ${data.net_profit >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`} data-testid="metric-net">
                <div className="flex items-center gap-2">
                  {data.net_profit >= 0 ? <TrendingUp className="w-5 h-5 text-emerald-600" /> : <TrendingDown className="w-5 h-5 text-red-600" />}
                  <span className={`text-xs font-medium uppercase ${data.net_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Net Profit</span>
                </div>
                <p className={`text-2xl font-bold mt-2 ${data.net_profit >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>{formatCurrency(data.net_profit)}</p>
                <p className={`text-xs mt-1 ${data.net_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Margin: {data.net_margin}%</p>
              </div>
            </div>

            {/* P&L Breakdown */}
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="p-4 border-b border-stone-100">
                <h2 className="text-lg font-semibold text-stone-800">Detailed Breakdown</h2>
              </div>

              {/* Revenue Section */}
              <div className="border-b border-stone-100">
                <div className="bg-green-50 px-6 py-3 flex justify-between items-center">
                  <span className="font-semibold text-green-800">Revenue</span>
                  <span className="font-bold text-green-800">{formatCurrency(data.revenue.total)}</span>
                </div>
                <div className="px-6 py-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-stone-50">
                    <span className="text-stone-600 pl-4">Sales Revenue</span>
                    <span className="font-medium">{formatCurrency(data.revenue.sales)}</span>
                  </div>
                  {data.revenue.by_method && Object.entries(data.revenue.by_method).map(([k, v]) => (
                    v > 0 && <div key={k} className="flex justify-between py-1.5 pl-8 text-stone-400 text-xs">
                      <span className="capitalize">{k}</span><span>{formatCurrency(v)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 border-b border-stone-50">
                    <span className="text-stone-600 pl-4">Other Income</span>
                    <span className="font-medium">{formatCurrency(data.revenue.other_income)}</span>
                  </div>
                </div>
              </div>

              {/* Cost of Sales */}
              <div className="border-b border-stone-100">
                <div className="bg-orange-50 px-6 py-3 flex justify-between items-center">
                  <span className="font-semibold text-orange-800">Cost of Sales</span>
                  <span className="font-bold text-orange-800">({formatCurrency(data.cost_of_sales.total)})</span>
                </div>
                <div className="px-6 py-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-stone-50">
                    <span className="text-stone-600 pl-4">Supplier Purchases</span>
                    <span className="font-medium">{formatCurrency(data.cost_of_sales.supplier_purchases)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-stone-50">
                    <span className="text-stone-600 pl-4">Supplier Expenses</span>
                    <span className="font-medium">{formatCurrency(data.cost_of_sales.supplier_expenses)}</span>
                  </div>
                </div>
              </div>

              {/* Gross Profit */}
              <div className="bg-blue-50 px-6 py-3 flex justify-between items-center border-b border-stone-100">
                <span className="font-bold text-blue-800">Gross Profit</span>
                <span className="font-bold text-blue-800 text-lg">{formatCurrency(data.gross_profit)} <span className="text-sm font-normal">({data.gross_margin}%)</span></span>
              </div>

              {/* Operating Expenses */}
              <div className="border-b border-stone-100">
                <div className="bg-red-50 px-6 py-3 flex justify-between items-center">
                  <span className="font-semibold text-red-800">Operating Expenses</span>
                  <span className="font-bold text-red-800">({formatCurrency(data.operating_expenses.total)})</span>
                </div>
                <div className="px-6 py-2 text-sm">
                  {Object.entries(data.operating_expenses.by_category || {}).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
                    <div key={cat} className="flex justify-between py-2 border-b border-stone-50">
                      <span className="text-stone-600 pl-4">{cat}</span>
                      <span className="font-medium">{formatCurrency(amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Net Profit */}
              <div className={`px-6 py-4 flex justify-between items-center ${data.net_profit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <span className={`font-bold text-lg ${data.net_profit >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>Net Profit / (Loss)</span>
                <span className={`font-bold text-xl ${data.net_profit >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                  {formatCurrency(data.net_profit)} <span className="text-sm font-normal">({data.net_margin}%)</span>
                </span>
              </div>

              {/* VAT */}
              {data.vat && (
                <div className="px-6 py-3 flex justify-between items-center bg-stone-50 border-t border-stone-200">
                  <span className="text-stone-600 text-sm">VAT Collected ({data.vat.rate}%)</span>
                  <span className="font-medium text-sm">{formatCurrency(data.vat.collected)}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
