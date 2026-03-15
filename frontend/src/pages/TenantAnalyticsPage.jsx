import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '@/lib/api';
import { DashboardLayout } from '@/components/DashboardLayout';
import { BarChart3, TrendingUp, DollarSign, Users, Building2, PieChart, Crown, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart as RechartsPie, Pie, Cell, Legend } from 'recharts';

const PLAN_COLORS = { starter: '#78716c', business: '#f97316', enterprise: '#d97706' };

export default function TenantAnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await api.get('/admin/analytics');
      setData(res.data);
    } catch (e) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  if (loading || !data) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const pieData = data.revenue_by_plan?.map(r => ({
    name: r.plan?.charAt(0).toUpperCase() + r.plan?.slice(1),
    value: r.mrr,
    count: r.count,
  })) || [];

  return (
    <DashboardLayout>
      <div className="space-y-6 p-1" data-testid="analytics-page">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2" data-testid="analytics-title">
            <BarChart3 className="w-6 h-6 text-orange-500" />
            Platform Analytics
          </h1>
          <p className="text-sm text-stone-500 mt-1">Revenue, growth, and tenant insights</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard icon={DollarSign} label="Monthly Revenue (MRR)" value={`$${data.mrr?.toLocaleString()}`} sub={`ARR: $${data.arr?.toLocaleString()}`} color="emerald" testId="kpi-mrr" />
          <KPICard icon={Building2} label="Total Tenants" value={data.total_tenants} sub={`${data.active_tenants} active`} color="blue" testId="kpi-tenants" />
          <KPICard icon={Activity} label="Active Rate" value={data.total_tenants ? `${Math.round((data.active_tenants / data.total_tenants) * 100)}%` : '0%'} sub={`${data.inactive_tenants} inactive`} color="orange" testId="kpi-active-rate" />
          <KPICard icon={DollarSign} label="Total Revenue" value={`$${data.payment_stats?.total_revenue?.toLocaleString() || 0}`} sub={`${data.payment_stats?.total_payments || 0} payments`} color="violet" testId="kpi-total-revenue" />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Tenant Growth */}
          <Card className="border-stone-100" data-testid="growth-chart">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-orange-500" />Tenant Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.monthly_growth || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#a8a29e' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#a8a29e' }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }} />
                  <Bar dataKey="new_tenants" name="New" fill="#f97316" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total_tenants" name="Total" fill="#fed7aa" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Revenue by Plan */}
          <Card className="border-stone-100" data-testid="revenue-pie">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><PieChart className="w-4 h-4 text-orange-500" />Revenue by Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <RechartsPie>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: $${value}`}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={Object.values(PLAN_COLORS)[i % 3]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `$${v}`} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Legend />
                </RechartsPie>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Plan Distribution + Subscription Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-stone-100" data-testid="plan-distribution">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Plan Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.revenue_by_plan?.map(r => (
                  <div key={r.plan} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAN_COLORS[r.plan] || '#78716c' }} />
                      <span className="text-sm font-medium text-stone-700 capitalize">{r.plan}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-stone-500">{r.count} tenants</span>
                      <span className="font-semibold text-stone-800">${r.mrr}/mo</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-stone-100" data-testid="status-distribution">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Subscription Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(data.status_distribution || {}).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <Badge className={
                      status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                      status === 'trial' ? 'bg-blue-100 text-blue-700' :
                      status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-stone-100 text-stone-600'
                    }>{status}</Badge>
                    <span className="text-sm font-semibold text-stone-800">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Tenants */}
        <Card className="border-stone-100" data-testid="top-tenants">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Crown className="w-4 h-4 text-orange-500" />Top Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.top_tenants?.map((t, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-stone-50">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                    <span className="text-sm font-medium text-stone-700">{t.company_name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-stone-500">
                    <Badge className="bg-stone-100 text-stone-600 capitalize">{t.plan}</Badge>
                    <span>{t.users} users</span>
                    <span>{t.branches} branches</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function KPICard({ icon: Icon, label, value, sub, color, testId }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
    violet: 'bg-violet-50 text-violet-600',
  };
  return (
    <Card className="border-stone-100" data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-stone-500">{label}</p>
            <p className="text-xl font-bold text-stone-800">{value}</p>
            {sub && <p className="text-xs text-stone-400">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
