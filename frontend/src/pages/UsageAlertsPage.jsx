import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Users, Building2, RefreshCw, ArrowUpCircle, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function UsageAlertsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { fetchAlerts(); }, []);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/usage-alerts');
      setData(res.data);
    } catch { toast.error('Failed to load usage data'); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </DashboardLayout>
  );

  const plan = data?.plan || 'starter';
  const usage = data?.usage || {};
  const limits = data?.limits || {};
  const alerts = data?.alerts || [];

  const userPct = limits.max_users > 0 ? Math.min(100, Math.round((usage.users / limits.max_users) * 100)) : 0;
  const branchPct = limits.max_branches > 0 ? Math.min(100, Math.round((usage.branches / limits.max_branches) * 100)) : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl mx-auto" data-testid="usage-alerts-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit flex items-center gap-2" data-testid="usage-alerts-title">
              <AlertTriangle className="text-orange-500" />
              Usage & Limits
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Monitor your plan usage and resource limits</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAlerts} data-testid="refresh-usage-btn">
            <RefreshCw size={14} className="mr-1" /> Refresh
          </Button>
        </div>

        {/* Plan Badge */}
        <Card className="border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-stone-500">Current Plan</p>
              <p className="text-2xl font-bold capitalize text-stone-800" data-testid="current-plan">{plan}</p>
            </div>
            <Button variant="outline" className="border-orange-300 text-orange-600 hover:bg-orange-50" onClick={() => navigate('/subscription')} data-testid="upgrade-btn">
              <ArrowUpCircle size={14} className="mr-1" /> Upgrade Plan
            </Button>
          </CardContent>
        </Card>

        {/* Active Alerts */}
        {alerts.length > 0 && (
          <Card className="border-red-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-red-700 flex items-center gap-2">
                <AlertTriangle size={16} /> Active Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${a.level === 'critical' ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`} data-testid={`alert-${a.type}`}>
                  <Badge className={a.level === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>{a.level}</Badge>
                  <span className="text-sm text-stone-700 flex-1">{a.message}</span>
                  <span className="text-xs text-stone-500 font-mono">{a.percentage?.toFixed(0)}%</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {alerts.length === 0 && (
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="p-5 flex items-center gap-3">
              <CheckCircle2 className="text-emerald-500" size={20} />
              <span className="text-sm text-emerald-700 font-medium" data-testid="no-alerts">All usage within limits. No alerts.</span>
            </CardContent>
          </Card>
        )}

        {/* Usage Meters */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-blue-500" />
                  <span className="font-medium text-stone-800">Users</span>
                </div>
                <span className="text-sm text-stone-500" data-testid="user-count">
                  {usage.users || 0} / {limits.max_users === -1 ? 'Unlimited' : limits.max_users}
                </span>
              </div>
              {limits.max_users > 0 && (
                <Progress value={userPct} className="h-2" data-testid="user-progress" />
              )}
              {limits.max_users === -1 && (
                <p className="text-xs text-emerald-600">Unlimited on Enterprise plan</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="text-purple-500" />
                  <span className="font-medium text-stone-800">Branches</span>
                </div>
                <span className="text-sm text-stone-500" data-testid="branch-count">
                  {usage.branches || 0} / {limits.max_branches === -1 ? 'Unlimited' : limits.max_branches}
                </span>
              </div>
              {limits.max_branches > 0 && (
                <Progress value={branchPct} className="h-2" data-testid="branch-progress" />
              )}
              {limits.max_branches === -1 && (
                <p className="text-xs text-emerald-600">Unlimited on Enterprise plan</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Plan Details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Plan Limits Reference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { name: 'Starter', users: 5, branches: 1 },
                { name: 'Business', users: 20, branches: 5 },
                { name: 'Enterprise', users: 'Unlimited', branches: 'Unlimited' },
              ].map(p => (
                <div key={p.name} className={`p-3 rounded-lg border ${plan === p.name.toLowerCase() ? 'border-orange-300 bg-orange-50' : 'border-stone-100 bg-stone-50'}`} data-testid={`plan-card-${p.name.toLowerCase()}`}>
                  <p className="font-semibold text-sm text-stone-800">{p.name}</p>
                  <p className="text-xs text-stone-500 mt-1">{p.users} users</p>
                  <p className="text-xs text-stone-500">{p.branches} branches</p>
                  {plan === p.name.toLowerCase() && <Badge className="mt-2 bg-orange-100 text-orange-700 text-[10px]">Current</Badge>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
