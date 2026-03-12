import { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, DollarSign, ArrowDown, ArrowUp, CreditCard, Wallet, Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend } from 'recharts';
import api from '@/lib/api';

const CHART_COLORS = ['#f97316', '#3b82f6', '#22c55e', '#8b5cf6', '#ec4899', '#eab308', '#14b8a6', '#ef4444'];

function formatCurrency(val) {
  return `SAR ${(val || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function MetricCard({ title, value, subtitle, icon: Icon, color, trend }) {
  const colorMap = {
    green: 'border-green-200 bg-green-50',
    red: 'border-red-200 bg-red-50',
    blue: 'border-blue-200 bg-blue-50',
    orange: 'border-orange-200 bg-orange-50',
    purple: 'border-purple-200 bg-purple-50',
  };
  const textMap = {
    green: 'text-green-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
    orange: 'text-orange-600',
    purple: 'text-purple-600',
  };
  return (
    <div className={`rounded-xl border p-5 ${colorMap[color]}`} data-testid={`metric-${title.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-xs font-medium uppercase tracking-wide ${textMap[color]}`}>{title}</p>
          <p className={`text-2xl font-bold mt-2 ${textMap[color].replace('600', '800')}`}>{value}</p>
          {subtitle && <p className={`text-xs mt-1 ${textMap[color]}`}>{subtitle}</p>}
        </div>
        {Icon && <Icon className={`w-8 h-8 ${textMap[color]} opacity-40`} />}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload) return null;
  return (
    <div className="bg-white border border-stone-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-stone-800 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
          <span className="text-stone-500 capitalize">{entry.name}:</span>
          <span className="font-medium">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function FinancialDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/accounting/financial-dashboard');
        setData(res.data);
      } catch { toast.error('Failed to load financial dashboard'); }
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) return (
    <DashboardLayout>
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-stone-400">Loading Financial Dashboard...</div>
      </div>
    </DashboardLayout>
  );

  if (!data) return (
    <DashboardLayout>
      <div className="p-6 text-center text-stone-400">Failed to load data</div>
    </DashboardLayout>
  );

  const cashFlowIsPositive = data.cash_flow.net >= 0;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6" data-testid="financial-dashboard-page">
        <div>
          <h1 className="text-2xl font-bold text-stone-800" data-testid="page-title">Financial Dashboard</h1>
          <p className="text-sm text-stone-500 mt-1">Financial overview and trends</p>
        </div>

        {/* Top Metrics */}
        <div className="grid grid-cols-5 gap-4">
          <MetricCard title="Cash Inflow" value={formatCurrency(data.cash_flow.inflow)} subtitle="This month" icon={ArrowDown} color="green" />
          <MetricCard title="Cash Outflow" value={formatCurrency(data.cash_flow.outflow)} subtitle="This month" icon={ArrowUp} color="red" />
          <MetricCard title="Net Cash Flow" value={formatCurrency(data.cash_flow.net)} subtitle={cashFlowIsPositive ? 'Positive' : 'Negative'} icon={DollarSign} color={cashFlowIsPositive ? 'blue' : 'red'} />
          <MetricCard title="Receivable" value={formatCurrency(data.outstanding.receivable)} subtitle={`${data.outstanding.receivable_count} pending`} icon={CreditCard} color="orange" />
          <MetricCard title="Payable" value={formatCurrency(data.outstanding.payable)} subtitle={`${data.outstanding.payable_count} bills`} icon={Wallet} color="purple" />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-2 gap-6">
          {/* Revenue & Expense Trend */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h3 className="text-sm font-semibold text-stone-800 mb-4">Revenue vs Expenses (6 Months)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data.revenue_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#a8a29e" />
                <YAxis tick={{ fontSize: 11 }} stroke="#a8a29e" tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Profit Trend */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h3 className="text-sm font-semibold text-stone-800 mb-4">Net Profit Trend (6 Months)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.revenue_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#a8a29e" />
                <YAxis tick={{ fontSize: 11 }} stroke="#a8a29e" tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="profit" name="Net Profit" radius={[4, 4, 0, 0]}>
                  {data.revenue_trend.map((entry, i) => (
                    <Cell key={i} fill={entry.profit >= 0 ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-2 gap-6">
          {/* Expense Breakdown */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h3 className="text-sm font-semibold text-stone-800 mb-4">Expense Breakdown (This Month)</h3>
            {data.expense_breakdown.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-stone-400 text-sm">No expenses this month</div>
            ) : (
              <div className="flex gap-4">
                <ResponsiveContainer width="50%" height={250}>
                  <PieChart>
                    <Pie data={data.expense_breakdown} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={3}>
                      {data.expense_breakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2 overflow-y-auto max-h-[250px]">
                  {data.expense_breakdown.map((cat, i) => (
                    <div key={cat.category} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-stone-600">{cat.category}</span>
                      </div>
                      <span className="font-medium text-stone-800">{formatCurrency(cat.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Payment Method Breakdown */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h3 className="text-sm font-semibold text-stone-800 mb-4">Revenue by Payment Method</h3>
            {data.payment_breakdown.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-stone-400 text-sm">No revenue this month</div>
            ) : (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.payment_breakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="#a8a29e" tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="method" tick={{ fontSize: 11 }} stroke="#a8a29e" width={80} />
                    <Tooltip formatter={v => formatCurrency(v)} />
                    <Bar dataKey="amount" name="Amount" radius={[0, 4, 4, 0]}>
                      {data.payment_breakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {data.payment_breakdown.map((pm, i) => (
                    <div key={pm.method} className="flex items-center justify-between text-sm bg-stone-50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-stone-600">{pm.method}</span>
                      </div>
                      <span className="font-bold">{formatCurrency(pm.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Monthly Summary Table */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="p-4 border-b border-stone-100">
            <h3 className="text-sm font-semibold text-stone-800">Monthly Summary</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-stone-500">Month</th>
                <th className="text-right px-4 py-3 font-medium text-stone-500">Revenue</th>
                <th className="text-right px-4 py-3 font-medium text-stone-500">Expenses</th>
                <th className="text-right px-4 py-3 font-medium text-stone-500">Profit/Loss</th>
                <th className="text-right px-4 py-3 font-medium text-stone-500">Sales Count</th>
              </tr>
            </thead>
            <tbody>
              {data.revenue_trend.map(m => (
                <tr key={m.month} className="border-t border-stone-50 hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-800">{m.month}</td>
                  <td className="px-4 py-3 text-right text-green-700 font-medium">{formatCurrency(m.revenue)}</td>
                  <td className="px-4 py-3 text-right text-red-600 font-medium">{formatCurrency(m.expenses)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${m.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatCurrency(m.profit)}</td>
                  <td className="px-4 py-3 text-right text-stone-500">{m.sales_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
