import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '@/lib/api';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Building2, Users, Store, Search, ToggleLeft, ToggleRight, Crown, Globe, Calendar, TrendingUp } from 'lucide-react';

const STATUS_COLORS = {
  trial: 'bg-blue-100 text-blue-700',
  active: 'bg-emerald-100 text-emerald-700',
  suspended: 'bg-red-100 text-red-700',
  cancelled: 'bg-stone-100 text-stone-500',
};

const PLAN_COLORS = {
  starter: 'bg-stone-100 text-stone-600',
  business: 'bg-orange-100 text-orange-700',
  enterprise: 'bg-amber-100 text-amber-800',
};

export default function SuperAdminPage() {
  const [tenants, setTenants] = useState([]);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [tenantsRes, statsRes] = await Promise.all([
        api.get('/admin/tenants'),
        api.get('/admin/dashboard'),
      ]);
      setTenants(tenantsRes.data);
      setStats(statsRes.data);
    } catch (e) {
      toast.error('Failed to load tenant data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleTenant = async (tenantId, currentStatus) => {
    try {
      await api.put(`/admin/tenants/${tenantId}`, { is_active: !currentStatus });
      toast.success(`Tenant ${!currentStatus ? 'activated' : 'suspended'}`);
      fetchData();
    } catch (e) {
      toast.error('Failed to update tenant');
    }
  };

  const filtered = tenants.filter(t =>
    t.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-1" data-testid="super-admin-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2" data-testid="super-admin-title">
              <Crown className="w-6 h-6 text-orange-500" />
              Platform Administration
            </h1>
            <p className="text-sm text-stone-500 mt-1">Manage all registered tenants and organizations</p>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Building2} label="Total Tenants" value={stats.total_tenants} color="orange" testId="stat-total-tenants" />
            <StatCard icon={Users} label="Total Users" value={stats.total_users} color="blue" testId="stat-total-users" />
            <StatCard icon={Store} label="Active Tenants" value={stats.active_tenants} color="emerald" testId="stat-active-tenants" />
            <StatCard icon={TrendingUp} label="This Month" value={stats.new_this_month || 0} color="violet" testId="stat-new-month" />
          </div>
        )}

        {/* Plan Distribution */}
        {stats?.plan_distribution && (
          <Card className="border-stone-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-stone-700">Plan Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                {Object.entries(stats.plan_distribution).map(([plan, count]) => (
                  <div key={plan} className="flex items-center gap-2">
                    <Badge className={PLAN_COLORS[plan] || 'bg-stone-100'}>{plan}</Badge>
                    <span className="text-sm font-semibold text-stone-700">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search + Tenant List */}
        <Card className="border-stone-100">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-stone-700">All Tenants</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <Input
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9"
                  data-testid="tenant-search"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-stone-400" data-testid="no-tenants">
                No tenants found
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(t => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-stone-100 hover:border-stone-200 bg-white transition-colors"
                    data-testid={`tenant-row-${t.id}`}
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {(t.company_name || '?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-stone-800 truncate" data-testid={`tenant-name-${t.id}`}>
                          {t.company_name}
                        </h3>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-stone-400">
                          <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{t.country || 'N/A'}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(t.created_at).toLocaleDateString()}</span>
                          <span>{t.email}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right text-xs text-stone-500">
                        <div>{t.user_count || 0} users</div>
                        <div>{t.branch_count || 0} branches</div>
                      </div>
                      <Badge className={PLAN_COLORS[t.plan] || 'bg-stone-100'}>
                        {t.plan || 'starter'}
                      </Badge>
                      <Badge className={STATUS_COLORS[t.subscription_status] || STATUS_COLORS.trial}>
                        {t.subscription_status || 'trial'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleTenant(t.id, t.is_active)}
                        className={t.is_active ? 'text-emerald-600 hover:text-emerald-700' : 'text-red-500 hover:text-red-600'}
                        data-testid={`toggle-tenant-${t.id}`}
                      >
                        {t.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        <span className="ml-1 text-xs">{t.is_active ? 'Active' : 'Inactive'}</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ icon: Icon, label, value, color, testId }) {
  const colors = {
    orange: 'bg-orange-50 text-orange-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
  };
  return (
    <Card className="border-stone-100" data-testid={testId}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-stone-500">{label}</p>
          <p className="text-xl font-bold text-stone-800">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
