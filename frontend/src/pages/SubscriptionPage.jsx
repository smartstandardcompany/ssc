import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import api from '@/lib/api';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CreditCard, Check, Users, Building2, Zap, Crown, ArrowRight, Shield, BarChart3, Globe } from 'lucide-react';

const PLAN_FEATURES = {
  starter: {
    icon: Zap,
    color: 'stone',
    gradient: 'from-stone-600 to-stone-700',
    features: ['POS & Sales', 'Expense Tracking', 'Basic Inventory', 'Up to 1 Branch', 'Up to 5 Users'],
  },
  business: {
    icon: BarChart3,
    color: 'orange',
    gradient: 'from-orange-500 to-amber-500',
    features: ['Everything in Starter', 'Full Accounting Suite', 'Advanced Analytics', 'HR Management', 'Up to 5 Branches', 'Up to 20 Users'],
  },
  enterprise: {
    icon: Crown,
    color: 'amber',
    gradient: 'from-amber-600 to-yellow-500',
    features: ['Everything in Business', 'Unlimited Branches', 'Unlimited Users', 'All Modules', 'Priority Support', 'Custom Integrations'],
  },
};

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);

  const fetchSubscription = useCallback(async () => {
    try {
      const res = await api.get('/tenants/subscription');
      setSubscription(res.data);
    } catch (e) {
      toast.error('Failed to load subscription');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSubscription(); }, [fetchSubscription]);

  const handleChangePlan = async (plan) => {
    if (plan === subscription?.plan) return;
    if (plan === 'enterprise') {
      toast.info('Contact sales for Enterprise plan');
      return;
    }
    setChanging(true);
    try {
      // Create Stripe checkout session
      const res = await api.post('/payments/checkout', {
        plan,
        origin_url: window.location.origin,
      });
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to initiate payment');
    } finally {
      setChanging(false);
    }
  };

  // Check for payment status from redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const status = params.get('status');

    if (sessionId && status === 'success') {
      const checkPayment = async () => {
        try {
          const res = await api.get(`/payments/status/${sessionId}`);
          if (res.data.payment_status === 'paid') {
            toast.success('Payment successful! Plan upgraded.');
            fetchSubscription();
          } else {
            toast.info('Payment is being processed...');
          }
        } catch {
          toast.error('Could not verify payment status');
        }
        // Clean URL
        window.history.replaceState({}, '', '/subscription');
      };
      checkPayment();
    } else if (status === 'cancelled') {
      toast.info('Payment was cancelled');
      window.history.replaceState({}, '', '/subscription');
    }
  }, []); // eslint-disable-line

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const s = subscription;
  const currentPlan = s?.plan || 'starter';
  const planDetails = s?.plan_details || {};
  const usage = s?.usage || {};
  const plans = s?.available_plans || {};

  return (
    <DashboardLayout>
      <div className="space-y-6 p-1" data-testid="subscription-page">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2" data-testid="subscription-title">
            <CreditCard className="w-6 h-6 text-orange-500" />
            Subscription & Billing
          </h1>
          <p className="text-sm text-stone-500 mt-1">Manage your plan, usage, and billing details</p>
        </div>

        {/* Current Plan + Status */}
        <Card className="border-stone-100 overflow-hidden" data-testid="current-plan-card">
          <div className={`h-1.5 bg-gradient-to-r ${PLAN_FEATURES[currentPlan]?.gradient || 'from-stone-400 to-stone-500'}`} />
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${PLAN_FEATURES[currentPlan]?.gradient} flex items-center justify-center`}>
                  {(() => { const Icon = PLAN_FEATURES[currentPlan]?.icon || Zap; return <Icon className="w-6 h-6 text-white" />; })()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-stone-800" data-testid="current-plan-name">
                    {planDetails.name || currentPlan} Plan
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={
                      s?.subscription_status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                      s?.subscription_status === 'trial' ? 'bg-blue-100 text-blue-700' :
                      'bg-stone-100 text-stone-600'
                    } data-testid="subscription-status">
                      {s?.subscription_status || 'trial'}
                    </Badge>
                    <span className="text-xs text-stone-400">
                      Since {new Date(s?.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-stone-800">
                  {planDetails.price > 0 ? (
                    <>{planDetails.currency} {planDetails.price}<span className="text-sm font-normal text-stone-400">/mo</span></>
                  ) : (
                    <span className="text-base text-stone-500">Contact Sales</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Usage Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <UsageCard
            icon={Users}
            label="Users"
            used={usage.users || 0}
            max={usage.max_users}
            color="blue"
            testId="usage-users"
          />
          <UsageCard
            icon={Building2}
            label="Branches"
            used={usage.branches || 0}
            max={usage.max_branches}
            color="orange"
            testId="usage-branches"
          />
          <UsageCard
            icon={Users}
            label="Employees"
            used={usage.employees || 0}
            max={-1}
            color="emerald"
            testId="usage-employees"
          />
        </div>

        {/* Plans Comparison */}
        <div>
          <h2 className="text-lg font-semibold text-stone-800 mb-4">Available Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(plans).map(([key, plan]) => {
              const isCurrentPlan = key === currentPlan;
              const features = PLAN_FEATURES[key] || PLAN_FEATURES.starter;
              const Icon = features.icon;
              return (
                <Card
                  key={key}
                  className={`border-2 transition-all ${isCurrentPlan ? 'border-orange-300 ring-2 ring-orange-100' : 'border-stone-100 hover:border-stone-200'}`}
                  data-testid={`plan-card-${key}`}
                >
                  <CardContent className="p-5">
                    {isCurrentPlan && (
                      <Badge className="bg-orange-100 text-orange-700 mb-3">Current Plan</Badge>
                    )}
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${features.gradient} flex items-center justify-center mb-3`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-stone-800">{plan.name}</h3>
                    <div className="mt-1 mb-4">
                      {plan.price > 0 ? (
                        <p className="text-2xl font-bold text-stone-800">
                          {plan.currency} {plan.price}<span className="text-sm font-normal text-stone-400">/mo</span>
                        </p>
                      ) : (
                        <p className="text-lg font-semibold text-stone-500">Custom Pricing</p>
                      )}
                    </div>

                    <div className="space-y-2 mb-5">
                      {features.features.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-stone-600">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                          {f}
                        </div>
                      ))}
                    </div>

                    {plan.max_branches > 0 && (
                      <div className="text-xs text-stone-400 mb-3 border-t border-stone-100 pt-3">
                        {plan.max_branches} branch{plan.max_branches > 1 ? 'es' : ''} &middot; {plan.max_users} users &middot;{' '}
                        {plan.modules.length} modules
                      </div>
                    )}

                    <Button
                      className={`w-full rounded-full ${
                        isCurrentPlan
                          ? 'bg-stone-100 text-stone-500 cursor-default'
                          : key === 'enterprise'
                          ? 'bg-amber-600 hover:bg-amber-700 text-white'
                          : 'bg-orange-500 hover:bg-orange-600 text-white'
                      }`}
                      disabled={isCurrentPlan || changing}
                      onClick={() => handleChangePlan(key)}
                      data-testid={`select-plan-${key}`}
                    >
                      {isCurrentPlan ? 'Current' : key === 'enterprise' ? 'Contact Sales' : 'Switch Plan'}
                      {!isCurrentPlan && <ArrowRight className="w-4 h-4 ml-1" />}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Payment History */}
        <PaymentHistory />
      </div>
    </DashboardLayout>
  );
}

function UsageCard({ icon: Icon, label, used, max, color, testId }) {
  const isUnlimited = max === -1;
  const percentage = isUnlimited ? 0 : max > 0 ? Math.min((used / max) * 100, 100) : 0;
  const isNearLimit = percentage >= 80;

  const colors = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', progress: 'bg-blue-500' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600', progress: 'bg-orange-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', progress: 'bg-emerald-500' },
  };
  const c = colors[color] || colors.blue;

  return (
    <Card className="border-stone-100" data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-9 h-9 rounded-lg ${c.bg} ${c.text} flex items-center justify-center`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-stone-500">{label}</p>
            <p className="text-lg font-bold text-stone-800">
              {used}{!isUnlimited && <span className="text-sm font-normal text-stone-400"> / {max}</span>}
              {isUnlimited && <span className="text-sm font-normal text-stone-400"> (unlimited)</span>}
            </p>
          </div>
        </div>
        {!isUnlimited && max > 0 && (
          <div className="space-y-1">
            <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isNearLimit ? 'bg-red-500' : c.progress}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <p className="text-xs text-stone-400 text-right">{Math.round(percentage)}% used</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


function PaymentHistory() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/payments/history').then(res => setTransactions(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading || transactions.length === 0) return null;

  return (
    <Card className="border-stone-100" data-testid="payment-history">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-orange-500" />
          Payment History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {transactions.map(t => (
            <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-stone-50 text-sm">
              <div className="flex items-center gap-3">
                <Badge className={
                  t.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                  t.payment_status === 'pending' ? 'bg-amber-100 text-amber-700' :
                  'bg-stone-100 text-stone-500'
                }>{t.payment_status}</Badge>
                <span className="text-stone-700 font-medium capitalize">{t.plan} Plan</span>
              </div>
              <div className="flex items-center gap-4 text-stone-500">
                <span>${t.amount}</span>
                <span>{new Date(t.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
