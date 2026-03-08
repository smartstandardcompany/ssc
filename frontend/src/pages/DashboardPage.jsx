import { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, Wallet, Building2, CreditCard, AlertTriangle, ArrowLeftRight, MessageCircle, Settings2, Eye, EyeOff, GripVertical, Lock, Unlock, Package, Clock, Users, Brain, Sparkles, Zap, Plus, Receipt, FileText, CalendarCheck, Banknote, ShoppingCart, UserPlus, FileSpreadsheet, Camera, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { BranchFilter } from '@/components/BranchFilter';
import { useLanguage } from '@/contexts/LanguageContext';
import { DateFilter } from '@/components/DateFilter';
import { WhatsAppSendDialog } from '@/components/WhatsAppSendDialog';
import AIInsightsWidget from '@/components/AIInsightsWidget';
import { useVisibility } from '@/hooks/useVisibility';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import DashboardTour, { resetDashboardTour } from '@/components/DashboardTour';
import { useBranchStore, useAuthStore } from '@/stores';

const Sparkline = ({ data = [], color = '#22C55E', width = 60, height = 24 }) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(' ');
  return <svg width={width} height={height} className="opacity-60"><polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
};

const THEMES = {
  default: { bg: 'from-[#FDFBF7] to-[#FFF8F0]', card: 'border-stone-100', accent: 'text-primary' },
  dark: { bg: 'from-stone-900 to-stone-800', card: 'border-stone-700 bg-stone-800/50 text-white', accent: 'text-orange-400' },
  blue: { bg: 'from-blue-50 to-indigo-50', card: 'border-blue-100', accent: 'text-blue-600' },
  green: { bg: 'from-emerald-50 to-teal-50', card: 'border-emerald-100', accent: 'text-emerald-600' },
};
const PIE_COLORS = ['#F5841F', '#22C55E', '#0EA5E9', '#EF4444', '#F59E0B', '#8B5CF6'];

const DEFAULT_WIDGETS = { stats: true, charts: true, quickActions: true, cashBank: true, paymentMode: true, spending: true, dues: true, branchDues: true, vatSummary: true, lowStock: true, peakHours: true, customerInsights: true, profitTrend: true };

const WIDGET_OPTIONS = [
  { key: 'stats', labelKey: 'widget_stats', descKey: 'widget_desc_stats' },
  { key: 'charts', labelKey: 'widget_charts', descKey: 'widget_desc_charts' },
  { key: 'quickActions', labelKey: 'Quick Actions', descKey: 'Role-based shortcuts' },
  { key: 'cashBank', labelKey: 'widget_cash_bank', descKey: 'widget_desc_cash' },
  { key: 'paymentMode', labelKey: 'widget_payment_mode', descKey: 'widget_desc_payment' },
  { key: 'spending', labelKey: 'widget_spending', descKey: 'widget_desc_spending' },
  { key: 'dues', labelKey: 'widget_dues', descKey: 'widget_desc_dues' },
  { key: 'branchDues', labelKey: 'widget_branch_dues', descKey: 'widget_desc_branch' },
  { key: 'vatSummary', labelKey: 'widget_vat', descKey: 'widget_desc_vat' },
  { key: 'lowStock', labelKey: 'AI: Low Stock Alerts', descKey: 'Items predicted to run low' },
  { key: 'peakHours', labelKey: 'AI: Peak Hours', descKey: 'Optimal staffing insights' },
  { key: 'customerInsights', labelKey: 'AI: Customer CLV', descKey: 'Top value customers' },
  { key: 'profitTrend', labelKey: 'AI: Profit Analysis', descKey: 'Daily profit decomposition' },
];

// Quick Actions configuration - role-based shortcuts
const QUICK_ACTIONS = [
  { id: 'add_sale', label: 'Record Sale', labelAr: 'تسجيل بيع', icon: ShoppingCart, path: '/quick-entry', color: 'bg-emerald-500 hover:bg-emerald-600', perm: 'sales' },
  { id: 'add_expense', label: 'Add Expense', labelAr: 'إضافة مصروف', icon: Receipt, path: '/quick-entry', color: 'bg-red-500 hover:bg-red-600', perm: 'expenses' },
  { id: 'pay_supplier', label: 'Pay Supplier', labelAr: 'دفع مورد', icon: Building2, path: '/suppliers', color: 'bg-blue-500 hover:bg-blue-600', perm: 'suppliers' },
  { id: 'new_invoice', label: 'New Invoice', labelAr: 'فاتورة جديدة', icon: FileText, path: '/invoices/new', color: 'bg-orange-500 hover:bg-orange-600', perm: 'invoices' },
  { id: 'approve_leave', label: 'Approve Leave', labelAr: 'اعتماد إجازة', icon: CalendarCheck, path: '/leave-approvals', color: 'bg-purple-500 hover:bg-purple-600', perm: 'employees' },
  { id: 'pay_salary', label: 'Pay Salary', labelAr: 'دفع راتب', icon: Banknote, path: '/employees', color: 'bg-teal-500 hover:bg-teal-600', perm: 'employees' },
  { id: 'add_customer', label: 'Add Customer', labelAr: 'إضافة عميل', icon: UserPlus, path: '/customers', color: 'bg-indigo-500 hover:bg-indigo-600', perm: 'customers' },
  { id: 'view_reports', label: 'View Reports', labelAr: 'عرض التقارير', icon: FileSpreadsheet, path: '/reports', color: 'bg-amber-500 hover:bg-amber-600', perm: 'reports' },
  { id: 'stock_entry', label: 'Stock Entry', labelAr: 'إدخال مخزون', icon: Package, path: '/stock', color: 'bg-cyan-500 hover:bg-cyan-600', perm: 'stock' },
  { id: 'cctv_view', label: 'CCTV Live', labelAr: 'كاميرات مباشر', icon: Camera, path: '/cctv', color: 'bg-stone-600 hover:bg-stone-700', perm: 'branches' },
];

const DEFAULT_LAYOUT = [
  { i: 'stats', x: 0, y: 0, w: 12, h: 4, minW: 6 },
  { i: 'quickActions', x: 0, y: 4, w: 12, h: 3, minW: 6 },
  { i: 'charts', x: 0, y: 7, w: 12, h: 5, minW: 6 },
  { i: 'lowStock', x: 0, y: 12, w: 6, h: 4, minW: 4 },
  { i: 'peakHours', x: 6, y: 12, w: 6, h: 4, minW: 4 },
  { i: 'customerInsights', x: 0, y: 16, w: 6, h: 4, minW: 4 },
  { i: 'profitTrend', x: 6, y: 16, w: 6, h: 4, minW: 4 },
  { i: 'cashBank', x: 0, y: 20, w: 12, h: 4, minW: 6 },
  { i: 'paymentMode', x: 0, y: 24, w: 12, h: 4, minW: 6 },
  { i: 'spending', x: 0, y: 28, w: 12, h: 5, minW: 6 },
  { i: 'dues', x: 0, y: 33, w: 12, h: 5, minW: 6 },
];

function getWidgetPrefs() {
  try { return { ...DEFAULT_WIDGETS, ...JSON.parse(localStorage.getItem('dashboard_widgets') || '{}') }; }
  catch { return DEFAULT_WIDGETS; }
}
function saveWidgetPrefs(prefs) { localStorage.setItem('dashboard_widgets', JSON.stringify(prefs)); }
function getLayoutPrefs() {
  try { return JSON.parse(localStorage.getItem('dashboard_layout') || 'null') || DEFAULT_LAYOUT; }
  catch { return DEFAULT_LAYOUT; }
}
function saveLayoutPrefs(layout) { localStorage.setItem('dashboard_layout', JSON.stringify(layout)); }

export default function DashboardPage() {
  const navigate = useNavigate();
  // Zustand stores
  const { branches, fetchBranches } = useBranchStore();
  const { user } = useAuthStore();
  const vis = useVisibility();
  
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [branchDues, setBranchDues] = useState(null);
  const [pendingSalaries, setPendingSalaries] = useState({ employees: [], branch_summary: {}, totals: { total_salary: 0, total_paid: 0, total_pending: 0 }, period: '' });
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState([]);
  const [showVat, setShowVat] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('dashboard_theme') || 'default');
  const [showPaybackDialog, setShowPaybackDialog] = useState(false);
  const [paybackData, setPaybackData] = useState({ from_branch_id: '', to_branch_id: '', amount: '', payment_mode: 'cash' });
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [widgets, setWidgets] = useState(getWidgetPrefs());
  const [showWidgetSettings, setShowWidgetSettings] = useState(false);
  const [todayVsYest, setTodayVsYest] = useState(null);
  const [dailyTrend, setDailyTrend] = useState({ sales: [], expenses: [], profit: [] });
  const [isEditMode, setIsEditMode] = useState(false);
  const [layout, setLayout] = useState(getLayoutPrefs());
  const [predictiveData, setPredictiveData] = useState({
    lowStock: { items_at_risk: 0, forecasts: [] },
    peakHours: { peak_hours: [], total_transactions_analyzed: 0 },
    customerCLV: { high_value_customers: [], total_projected_revenue: 0 },
    profitTrend: { summary: {}, daily_breakdown: [] }
  });
  const [missingDataAlerts, setMissingDataAlerts] = useState([]);
  const [showDuesDetail, setShowDuesDetail] = useState(false);
  const [duesDetailData, setDuesDetailData] = useState([]);
  const t = THEMES[theme] || THEMES.default;
  const { t: tr, language } = useLanguage();
  const [showTour, setShowTour] = useState(false);

  // User permissions from Zustand
  const userPermissions = user?.permissions || {};

  const handleViewDuesDetail = async () => {
    try {
      const res = await api.get('/reports/branch-dues-detail');
      setDuesDetailData(res.data?.entries || []);
      setShowDuesDetail(true);
    } catch { toast.error('Failed to load dues detail'); }
  };

  // Check if should show tour on mount - only show if explicitly enabled
  useEffect(() => {
    const tourEnabled = localStorage.getItem('ssc_dashboard_tour_enabled');
    const tourCompleted = localStorage.getItem('ssc_dashboard_tour_completed');
    if (tourEnabled === 'true' && !tourCompleted) {
      const timer = setTimeout(() => setShowTour(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleTourComplete = () => {
    setShowTour(false);
    toast.success(tr('tour_completed') || 'Tour completed! Explore your dashboard.');
  };

  const startTour = () => {
    resetDashboardTour();
    localStorage.setItem('ssc_dashboard_tour_enabled', 'true');
    setShowTour(true);
  };

  const toggleWidget = (key) => {
    const updated = { ...widgets, [key]: !widgets[key] };
    setWidgets(updated);
    saveWidgetPrefs(updated);
    // Save to backend for persistence across devices
    api.post('/dashboard/layout', { widgets: updated }).catch(() => {});
  };

  const handleLayoutChange = useCallback((newLayout) => {
    setLayout(newLayout);
    saveLayoutPrefs(newLayout);
    // Save to backend for persistence across devices
    api.post('/dashboard/layout', { layout: newLayout }).catch(() => {});
  }, []);

  const resetLayout = () => {
    setLayout(DEFAULT_LAYOUT);
    saveLayoutPrefs(DEFAULT_LAYOUT);
    toast.success(tr('reset_layout') || 'Layout reset');
  };

  const changeTheme = (newTheme) => { setTheme(newTheme); localStorage.setItem('dashboard_theme', newTheme); };
  const [dateFilter, setDateFilter] = useState({ start: null, end: null, period: 'all' });

  useEffect(() => {
    fetchStats();
    fetchBranches(); // Use Zustand for branches
    // Load user's saved layout preferences from backend
    api.get('/dashboard/layout').then(res => {
      if (res.data?.widgets) {
        const merged = { ...DEFAULT_WIDGETS, ...res.data.widgets };
        setWidgets(merged);
        saveWidgetPrefs(merged);
      }
      if (res.data?.layout) {
        setLayout(res.data.layout);
        saveLayoutPrefs(res.data.layout);
      }
    }).catch(() => {});
  }, [branchFilter, dateFilter, fetchBranches]);

  // Check if user has permission for a quick action
  const hasPermission = (perm) => {
    if (!perm) return true;
    const level = userPermissions[perm];
    return level === 'read' || level === 'write';
  };

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (branchFilter.length > 0) params.set('branch_ids', branchFilter.join(','));
      if (dateFilter.start) params.set('start_date', dateFilter.start.toISOString());
      if (dateFilter.end) params.set('end_date', dateFilter.end.toISOString());
      const q = params.toString() ? `?${params.toString()}` : '';
      const [statsRes, alertsRes, duesRes, pendRes] = await Promise.all([
        api.get(`/dashboard/stats${q}`),
        api.get('/documents/alerts/upcoming'),
        api.get('/reports/branch-dues-net'),
        api.get('/employees/pending-summary'),
      ]);
      setStats(statsRes.data);
      setAlerts(alertsRes.data);
      setBranchDues(duesRes.data);
      setPendingSalaries(pendRes.data);
      // Fetch today vs yesterday
      try { const tvyRes = await api.get(`/dashboard/today-vs-yesterday${q}`); setTodayVsYest(tvyRes.data); } catch {}
      // Fetch daily trend for sparklines
      try {
        const dsRes = await api.get('/reports/daily-summary');
        const days = (dsRes.data || []).slice(0, 7).reverse();
        setDailyTrend({
          sales: days.map(d => d.sales || 0),
          expenses: days.map(d => d.expenses || 0),
          profit: days.map(d => (d.sales || 0) - (d.expenses || 0)),
        });
      } catch {}
      // Fetch predictive analytics data for widgets
      try {
        const [lowStockRes, peakHoursRes, clvRes, profitRes] = await Promise.all([
          api.get('/predictions/inventory-demand').catch(() => ({ data: { items_at_risk: 0, forecasts: [] } })),
          api.get('/predictions/peak-hours').catch(() => ({ data: { peak_hours: [], total_transactions_analyzed: 0 } })),
          api.get('/predictions/customer-clv').catch(() => ({ data: { high_value_customers: [], total_projected_revenue: 0 } })),
          api.get('/predictions/profit-decomposition').catch(() => ({ data: { summary: {}, daily_breakdown: [] } })),
        ]);
        setPredictiveData({
          lowStock: lowStockRes.data,
          peakHours: peakHoursRes.data,
          customerCLV: clvRes.data,
          profitTrend: profitRes.data,
        });
      } catch {}
      // Fetch missing data alerts
      try { const mdRes = await api.get('/dashboard/missing-data-alerts'); setMissingDataAlerts(mdRes.data?.alerts || []); } catch {}
    } catch (error) {
      toast.error('Failed to fetch dashboard stats');
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

  const pctChange = (current, prev) => {
    if (!prev || prev === 0) return current > 0 ? 100 : 0;
    return ((current - prev) / Math.abs(prev) * 100).toFixed(1);
  };
  const pctOfSales = (val) => stats?.total_sales > 0 ? (val / stats.total_sales * 100).toFixed(1) : 0;
  const ChangeIndicator = ({ current, previous, invert = false }) => {
    if (!previous && previous !== 0) return null;
    const change = pctChange(current, previous);
    const isUp = parseFloat(change) > 0;
    const isGood = invert ? !isUp : isUp;
    return (
      <span className={`inline-flex items-center text-xs font-medium ml-2 ${isGood ? 'text-success' : 'text-error'}`}>
        {isUp ? '▲' : '▼'} {Math.abs(change)}%
      </span>
    );
  };
  const PctBadge = ({ value }) => value > 0 ? <span className="text-xs text-muted-foreground ml-1">({value}% of sales)</span> : null;

  const statCards = [
    {
      title: tr('total_sales'),
      value: `SAR ${stats?.total_sales?.toFixed(2) || '0.00'}`,
      prev: stats?.prev_sales,
      icon: DollarSign,
      color: 'text-success',
      bgColor: 'bg-success/10',
      testId: 'total-sales-card',
      sparkline: dailyTrend.sales,
      sparkColor: '#22C55E',
    },
    ...(!vis.hide_financials ? [{
      title: tr('total_expenses'),
      value: `SAR ${stats?.total_expenses?.toFixed(2) || '0.00'}`,
      prev: stats?.prev_expenses,
      pct: stats?.expenses_pct_of_sales,
      invert: true,
      icon: TrendingDown,
      color: 'text-error',
      bgColor: 'bg-error/10',
      testId: 'total-expenses-card',
      sparkline: dailyTrend.expenses,
      sparkColor: '#EF4444',
    }] : []),
    ...(!vis.hide_financials ? [{
      title: tr('supplier_payments'),
      value: `SAR ${stats?.total_supplier_payments?.toFixed(2) || '0.00'}`,
      pct: stats?.sp_pct_of_sales,
      icon: Building2,
      color: 'text-info',
      bgColor: 'bg-info/10',
      testId: 'supplier-payments-card',
    }] : []),
    ...(!vis.hide_profit ? [{
      title: tr('net_profit'),
      value: `SAR ${stats?.net_profit?.toFixed(2) || '0.00'}`,
      prev: stats?.prev_net,
      pct: stats?.profit_pct_of_sales,
      icon: TrendingUp,
      color: stats?.net_profit >= 0 ? 'text-success' : 'text-error',
      bgColor: stats?.net_profit >= 0 ? 'bg-success/10' : 'bg-error/10',
      testId: 'net-profit-card',
      sparkline: dailyTrend.profit,
      sparkColor: '#F5841F',
    }] : []),
    {
      title: tr('pending_credits'),
      value: `SAR ${stats?.pending_credits?.toFixed(2) || '0.00'}`,
      icon: AlertCircle,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      testId: 'pending-credits-card'
    },
  ];

  const paymentModeCards = [
    {
      title: 'Cash Sales',
      value: `SAR ${stats?.cash_sales?.toFixed(2) || '0.00'}`,
      icon: Wallet,
      color: 'text-cash',
      bgColor: 'bg-cash/10',
      testId: 'cash-sales-card'
    },
    {
      title: 'Bank Sales',
      value: `SAR ${stats?.bank_sales?.toFixed(2) || '0.00'}`,
      icon: Building2,
      color: 'text-bank',
      bgColor: 'bg-bank/10',
      testId: 'bank-sales-card'
    },
    {
      title: 'Credit Sales',
      value: `SAR ${stats?.credit_sales?.toFixed(2) || '0.00'}`,
      icon: CreditCard,
      color: 'text-credit',
      bgColor: 'bg-credit/10',
      testId: 'credit-sales-card'
    },
  ];

  return (
    <DashboardLayout>
      <div className={`space-y-8 min-h-screen p-1 rounded-2xl ${theme === 'dark' ? 'bg-gradient-to-br ' + t.bg + ' text-white' : ''}`}>
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 className={`text-2xl sm:text-4xl font-bold font-outfit mb-1 ${t.accent}`} data-testid="dashboard-title">{tr('dash_title')}</h1>
            <p className={theme === 'dark' ? 'text-stone-400' : 'text-muted-foreground'}>{tr('dash_subtitle')}</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowWhatsApp(true)} data-testid="dashboard-whatsapp-btn">
              <MessageCircle size={14} className="mr-1" />WhatsApp
            </Button>
            <Button size="sm" variant={isEditMode ? 'default' : 'outline'} className={`rounded-xl ${isEditMode ? 'bg-orange-500 hover:bg-orange-600' : ''}`} onClick={() => setIsEditMode(!isEditMode)} data-testid="edit-layout-btn">
              {isEditMode ? <><Lock size={14} className="mr-1" />{tr('reset_layout')}</> : <><Unlock size={14} className="mr-1" />{tr('customize_widgets')}</>}
            </Button>
            {isEditMode && (
              <Button size="sm" variant="outline" className="rounded-xl" onClick={resetLayout} data-testid="reset-layout-btn">
                {tr('reset_layout')}
              </Button>
            )}
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowWidgetSettings(true)} data-testid="widget-settings-btn">
              <Settings2 size={14} className="mr-1" />{tr('customize_widgets')}
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl text-orange-600 border-orange-200 hover:bg-orange-50" onClick={startTour} data-testid="start-tour-btn">
              <HelpCircle size={14} className="mr-1" />{tr('take_tour') || 'Take Tour'}
            </Button>
            {Object.keys(THEMES).map(th => (
              <button key={th} onClick={() => changeTheme(th)} className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all capitalize ${theme === th ? 'bg-primary text-white border-primary' : 'bg-white border-stone-200 hover:border-primary'}`}>{th}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-4 items-center flex-wrap">
          <BranchFilter onChange={setBranchFilter} />
          <DateFilter onFilterChange={setDateFilter} />
        </div>

        {/* Main Stats Grid */}
        {widgets.stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {statCards.map((card) => {
            const Icon = card.icon;
            const rawVal = parseFloat(card.value.replace('$', '').replace(',', '')) || 0;
            // Today vs yesterday comparison
            const tvyKey = card.title === 'Total Sales' ? 'sales' : card.title === 'Total Expenses' ? 'expenses' : card.title === 'Net Profit' ? 'profit' : null;
            const tvyChange = todayVsYest && tvyKey ? todayVsYest.change[tvyKey] : null;
            const tvyToday = todayVsYest && tvyKey ? todayVsYest.today[tvyKey] : null;
            return (
              <Card key={card.title} className="stat-card border-border" data-testid={card.testId}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                  <div className={`${card.bgColor} p-2 rounded-lg`}><Icon className={`h-5 w-5 ${card.color}`} strokeWidth={2} /></div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl sm:text-3xl font-bold font-outfit" data-testid={`${card.testId}-value`}>{card.value}</span>
                    </div>
                    {card.sparkline && card.sparkline.length > 1 && (
                      <Sparkline data={card.sparkline} color={card.sparkColor} />
                    )}
                  </div>
                  <div className="flex items-center mt-1 flex-wrap gap-1">
                    {card.prev !== undefined && <ChangeIndicator current={rawVal} previous={card.prev} invert={card.invert} />}
                    {card.pct !== undefined && card.pct > 0 && <PctBadge value={card.pct} />}
                  </div>
                  {tvyChange !== null && (
                    <div className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-between" data-testid={`tvy-${tvyKey}`}>
                      <span className="text-[10px] text-muted-foreground">Today: SAR {tvyToday?.toLocaleString()}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tvyChange > 0 && !card.invert ? 'bg-emerald-100 text-emerald-700' : tvyChange < 0 && !card.invert ? 'bg-red-100 text-red-700' : tvyChange > 0 && card.invert ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {tvyChange > 0 ? '+' : ''}{tvyChange}% vs yesterday
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        )}

        {/* AI Insights */}
        {widgets.stats && <AIInsightsWidget />}

        {/* Branch Loss Alerts */}
        {stats?.branch_loss_alerts?.length > 0 && (
          <Card className="border-error/50 bg-error/5">
            <CardHeader><CardTitle className="font-outfit flex items-center gap-2 text-error"><AlertTriangle size={18} />Branch Loss Alert</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">{stats.branch_loss_alerts.map((a, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-background rounded-xl border border-error/20">
                  <div><div className="font-medium text-sm">{a.branch}</div><div className="text-xs text-muted-foreground">Sales: SAR {a.sales.toFixed(0)} | Expenses: SAR {a.expenses.toFixed(0)}</div></div>
                  <Badge className="bg-error/20 text-error text-sm">Loss: SAR {Math.abs(a.profit).toFixed(2)}</Badge>
                </div>
              ))}</div>
            </CardContent>
          </Card>
        )}

        {/* Missing Data Alerts */}
        {missingDataAlerts.length > 0 && (
          <Card className="border-amber-300/50 bg-amber-50/50" data-testid="missing-data-alerts">
            <CardHeader className="pb-2">
              <CardTitle className="font-outfit flex items-center gap-2 text-amber-700 text-base">
                <AlertCircle size={18} /> Data Entry Alerts
                <Badge className="bg-amber-100 text-amber-800 text-xs ml-auto">{missingDataAlerts.length} alerts</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {missingDataAlerts.map((alert, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${alert.is_today ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${alert.is_today ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{alert.branch_name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        No <span className="font-semibold text-amber-800">{alert.missing.join(' or ')}</span> for {alert.is_today ? 'today' : alert.date}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs shrink-0"
                      onClick={() => navigate(alert.missing.includes('sales') ? '/sales' : '/expenses')}
                      data-testid={`alert-action-${i}`}>
                      Enter
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions Widget */}
        {widgets.quickActions && (
        <Card className="border-border bg-gradient-to-r from-stone-50 to-stone-100 dark:from-stone-800 dark:to-stone-900" data-testid="quick-actions-widget">
          <CardHeader className="pb-3">
            <CardTitle className="font-outfit text-base flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <Zap size={16} className="text-orange-600 dark:text-orange-400" />
              </div>
              <span>{tr('quick_actions') || 'Quick Actions'}</span>
              <Badge className="ml-auto bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 text-xs">
                {QUICK_ACTIONS.filter(a => hasPermission(a.perm)).length} available
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
              {QUICK_ACTIONS.filter(action => hasPermission(action.perm)).map(action => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.id}
                    variant="ghost"
                    className={`h-auto py-3 px-2 flex flex-col items-center gap-2 ${action.color} text-white rounded-xl transition-all hover:scale-105 shadow-sm`}
                    onClick={() => navigate(action.path)}
                    data-testid={`quick-action-${action.id}`}
                  >
                    <Icon size={20} />
                    <span className="text-xs font-medium text-center leading-tight">
                      {language === 'ar' ? action.labelAr : action.label}
                    </span>
                  </Button>
                );
              })}
            </div>
            {QUICK_ACTIONS.filter(a => hasPermission(a.perm)).length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                <Lock size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No quick actions available for your role</p>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Quick Charts */}
        {widgets.charts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {stats?.expense_by_category && Object.keys(stats.expense_by_category).length > 0 && (
            <Card className={t.card}>
              <CardHeader className="pb-2"><CardTitle className="font-outfit text-base">Expense Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart><Pie data={Object.entries(stats.expense_by_category).map(([k,v]) => ({name: k.replace('_',' '), value: v}))} cx="50%" cy="50%" outerRadius={75} innerRadius={40} dataKey="value" label={({name, percent}) => `${name} ${(percent*100).toFixed(0)}%`}>{Object.keys(stats.expense_by_category).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip formatter={(v) => `SAR ${v.toFixed(0)}`} /></PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          <Card className={t.card}>
            <CardHeader className="pb-2"><CardTitle className="font-outfit text-base">Sales vs Expenses</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={[{name: 'Sales', amount: stats?.total_sales || 0}, {name: 'Expenses', amount: stats?.total_expenses || 0}, {name: 'Supplier', amount: stats?.total_supplier_payments || 0}, {name: 'Profit', amount: stats?.net_profit || 0}]}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="name" tick={{fontSize: 11}} /><YAxis tick={{fontSize: 10}} /><Tooltip formatter={(v) => `SAR ${v.toFixed(0)}`} />
                  <Bar dataKey="amount" radius={[6,6,0,0]}>{[{fill:'#22C55E'},{fill:'#EF4444'},{fill:'#0EA5E9'},{fill: (stats?.net_profit || 0) >= 0 ? '#22C55E' : '#EF4444'}].map((c,i) => <Cell key={i} fill={c.fill} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Cash & Bank In Hand */}
        {widgets.cashBank && (
        <div>
          <h2 className="text-lg sm:text-2xl font-bold font-outfit mb-4">Cash & Bank In Hand</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="stat-card border-border border-cash/30 bg-gradient-to-br from-cash/5 to-cash/10" data-testid="cash-in-hand-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Cash In Hand</CardTitle>
                <div className="bg-cash/20 p-2 rounded-lg"><Wallet className="h-5 w-5 text-cash" strokeWidth={2} /></div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold font-outfit ${(stats?.cash_in_hand || 0) >= 0 ? 'text-cash' : 'text-error'}`} data-testid="cash-in-hand-value">SAR {(stats?.cash_in_hand || 0).toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">Cash Sales - Cash Expenses - Cash Supplier Payments</p>
              </CardContent>
            </Card>
            <Card className="stat-card border-border border-bank/30 bg-gradient-to-br from-bank/5 to-bank/10" data-testid="bank-in-hand-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Bank In Hand</CardTitle>
                <div className="bg-bank/20 p-2 rounded-lg"><Building2 className="h-5 w-5 text-bank" strokeWidth={2} /></div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold font-outfit ${(stats?.bank_in_hand || 0) >= 0 ? 'text-bank' : 'text-error'}`} data-testid="bank-in-hand-value">SAR {(stats?.bank_in_hand || 0).toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">Bank Sales - Bank Expenses - Bank Supplier Payments</p>
              </CardContent>
            </Card>
          </div>
        </div>
        )}

        {/* Payment Mode Breakdown */}
        {widgets.paymentMode && (
        <div>
          <h2 className="text-lg sm:text-2xl font-bold font-outfit mb-4">Payment Mode Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {paymentModeCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.title} className="stat-card border-border" data-testid={card.testId}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                    <div className={`${card.bgColor} p-2 rounded-lg`}>
                      <Icon className={`h-5 w-5 ${card.color}`} strokeWidth={2} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold font-outfit">{card.value}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
        )}

        {/* Spending Breakdown */}
        {widgets.spending && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border">
            <CardHeader><CardTitle className="font-outfit text-base">Cash vs Bank Spending</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-cash/10 rounded-lg"><span className="text-sm">Expenses (Cash)</span><span className="font-bold text-cash"> SAR {(stats?.expenses_cash || 0).toFixed(2)}</span></div>
                <div className="flex justify-between items-center p-3 bg-bank/10 rounded-lg"><span className="text-sm">Expenses (Bank)</span><span className="font-bold text-bank"> SAR {(stats?.expenses_bank || 0).toFixed(2)}</span></div>
                <div className="flex justify-between items-center p-3 bg-cash/10 rounded-lg"><span className="text-sm">Supplier Pay (Cash)</span><span className="font-bold text-cash"> SAR {(stats?.sp_cash || 0).toFixed(2)}</span></div>
                <div className="flex justify-between items-center p-3 bg-bank/10 rounded-lg"><span className="text-sm">Supplier Pay (Bank)</span><span className="font-bold text-bank"> SAR {(stats?.sp_bank || 0).toFixed(2)}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader><CardTitle className="font-outfit text-base">Expense Categories</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats?.expense_by_category && Object.entries(stats.expense_by_category).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between items-center p-2 bg-secondary/50 rounded" data-testid="expense-cat-item">
                    <span className="text-sm capitalize">{cat.replace('_', ' ')}</span>
                    <span className="font-bold text-sm"> SAR {amt.toFixed(2)}</span>
                  </div>
                ))}
                {(!stats?.expense_by_category || Object.keys(stats.expense_by_category).length === 0) && <p className="text-sm text-muted-foreground text-center py-4">No expenses</p>}
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Supplier Dues, Due Fines & Due Salaries */}
        {widgets.dues && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-border border-warning/30 bg-warning/5">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Supplier Dues</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold font-outfit text-warning" data-testid="supplier-dues"> SAR {(stats?.supplier_dues || 0).toFixed(2)}</div><p className="text-xs text-muted-foreground mt-1">Total owed to suppliers</p></CardContent>
          </Card>

          <Card className="border-border border-orange-300 bg-orange-50">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Due Fines</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-outfit text-orange-600" data-testid="due-fines">SAR {(stats?.due_fines || 0).toFixed(2)}</div>
              {stats?.due_fines_list?.length > 0 && (
                <div className="mt-2 space-y-1">{stats.due_fines_list.map((f, i) => (
                  <div key={i} className="flex justify-between text-xs p-1.5 bg-background rounded"><span className="capitalize">{f.department}</span><span className="font-bold text-orange-600">SAR {f.amount.toFixed(0)}</span></div>
                ))}</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border border-error/30 bg-error/5">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Due Salaries</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-outfit text-error" data-testid="due-salaries"> SAR {(pendingSalaries.totals?.total_pending || 0).toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">{pendingSalaries.period} | {(pendingSalaries.employees || []).filter(e => e.pending_salary > 0).length} employee(s)</p>
              {Object.keys(pendingSalaries.branch_summary || {}).length > 0 && (
                <div className="mt-2 space-y-1">
                  {Object.entries(pendingSalaries.branch_summary).map(([bName, bs]) => (
                    <div key={bName} className="flex justify-between text-xs p-1.5 bg-background rounded">
                      <span>{bName}</span>
                      <span><span className="text-success">Paid: SAR {bs.total_paid.toFixed(0)}</span> <span className="text-error font-bold">Due: SAR {bs.total_pending.toFixed(0)}</span></span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {branchDues && (Object.keys(branchDues.dues || {}).length > 0 || Object.keys(branchDues.paybacks || {}).length > 0) && (
            <Card className="border-border md:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="font-outfit text-base">Branch-to-Branch Dues</CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={handleViewDuesDetail} data-testid="view-dues-detail-btn">View Details</Button>
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowPaybackDialog(true)}><ArrowLeftRight size={14} className="mr-1" />Record Payback</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(branchDues.dues || {}).map(([key, amt]) => (
                    <div key={key} className="flex justify-between items-center p-3 bg-error/5 rounded-lg border border-error/20 cursor-pointer hover:bg-error/10 transition-colors"
                      onClick={handleViewDuesDetail} data-testid="branch-due-item">
                      <span className="text-sm font-medium">{key}</span>
                      <span className="font-bold text-error"> SAR {amt.toFixed(2)}</span>
                    </div>
                  ))}
                  {Object.entries(branchDues.paybacks || {}).map(([key, amt]) => (
                    <div key={key} className="flex justify-between items-center p-3 bg-success/5 rounded-lg border border-success/20 cursor-pointer hover:bg-success/10 transition-colors"
                      onClick={handleViewDuesDetail}>
                      <span className="text-sm font-medium">{key}</span>
                      <span className="font-bold text-success"> SAR {amt.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/20 mt-2">
                    <span className="text-sm font-bold">Net Due</span>
                    <span className="font-bold text-primary"> SAR {((branchDues.total_dues || 0) - (branchDues.total_paybacks || 0)).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        )}

        {/* VAT Section (toggleable) */}
        {widgets.vatSummary && (
        <>
        <div className="flex items-center gap-3 mt-2">
          <Checkbox checked={showVat} onCheckedChange={setShowVat} id="vat-toggle" />
          <Label htmlFor="vat-toggle" className="cursor-pointer text-sm font-medium">Show VAT 15% Calculation</Label>
        </div>
        {showVat && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-stone-100 bg-blue-50 border-blue-200">
              <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">VAT on Sales (Output)</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold font-outfit text-blue-600">SAR {(stats?.vat_on_sales || 0).toFixed(2)}</div><p className="text-xs text-muted-foreground mt-1">15% of SAR {(stats?.total_sales || 0).toFixed(0)}</p></CardContent>
            </Card>
            <Card className="border-stone-100 bg-green-50 border-green-200">
              <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">VAT on Purchases (Input)</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold font-outfit text-green-600">SAR {(stats?.vat_on_purchases || 0).toFixed(2)}</div><p className="text-xs text-muted-foreground mt-1">15% of SAR {(stats?.total_supplier_payments || 0).toFixed(0)}</p></CardContent>
            </Card>
            <Card className="border-stone-100 bg-orange-50 border-orange-200">
              <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">VAT Payable</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold font-outfit text-orange-600">SAR {(stats?.vat_payable || 0).toFixed(2)}</div><p className="text-xs text-muted-foreground mt-1">Output VAT - Input VAT</p></CardContent>
            </Card>
          </div>
        )}
        </>
        )}

        {/* AI Predictive Analytics Widgets */}
        {widgets.lowStock && (
        <Card className="border-border border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 dark:border-purple-700" data-testid="low-stock-widget">
          <CardHeader className="pb-2">
            <CardTitle className="font-outfit text-base flex items-center gap-2">
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Package size={16} className="text-purple-600 dark:text-purple-400" />
              </div>
              <span>AI: Low Stock Alerts</span>
              <Badge className="ml-auto bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                <Brain size={10} className="mr-1" />Predictive
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {predictiveData.lowStock.items_at_risk > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">Items at risk of running low</span>
                  <span className="text-2xl font-bold text-purple-600">{predictiveData.lowStock.items_at_risk}</span>
                </div>
                {(predictiveData.lowStock.forecasts || []).slice(0, 3).map((item, i) => (
                  <div key={i} className="flex justify-between items-center p-2 bg-white/60 dark:bg-stone-800/60 rounded-lg border border-purple-100 dark:border-purple-800" data-testid="low-stock-item">
                    <div>
                      <span className="font-medium text-sm">{item.item_name}</span>
                      <p className="text-xs text-muted-foreground">Stock: {item.current_stock} | Reorder: {item.reorder_point}</p>
                    </div>
                    <Badge className={item.days_until_stockout <= 7 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>
                      {item.days_until_stockout}d left
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <Package size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">All stock levels healthy</p>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {widgets.peakHours && (
        <Card className="border-border border-cyan-200 bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-900/20 dark:to-sky-900/20 dark:border-cyan-700" data-testid="peak-hours-widget">
          <CardHeader className="pb-2">
            <CardTitle className="font-outfit text-base flex items-center gap-2">
              <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                <Clock size={16} className="text-cyan-600 dark:text-cyan-400" />
              </div>
              <span>AI: Peak Hours</span>
              <Badge className="ml-auto bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300">
                <Brain size={10} className="mr-1" />Staffing
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(predictiveData.peakHours.peak_hours || []).length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-3">Based on {predictiveData.peakHours.total_transactions_analyzed} transactions</p>
                <div className="grid grid-cols-3 gap-2">
                  {(predictiveData.peakHours.peak_hours || []).slice(0, 3).map((h, i) => (
                    <div key={i} className="text-center p-3 bg-white/60 dark:bg-stone-800/60 rounded-lg border border-cyan-100 dark:border-cyan-800" data-testid="peak-hour-item">
                      <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400">{h.label}</div>
                      <p className="text-xs text-muted-foreground mt-1">{h.total_transactions} orders</p>
                      <p className="text-xs font-medium text-cyan-700">{h.share_percent?.toFixed(1)}% of traffic</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-center text-muted-foreground mt-2">Consider extra staff during these hours</p>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <Clock size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Not enough data for analysis</p>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {widgets.customerInsights && (
        <Card className="border-border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 dark:border-emerald-700" data-testid="customer-clv-widget">
          <CardHeader className="pb-2">
            <CardTitle className="font-outfit text-base flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                <Users size={16} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <span>AI: Customer Value</span>
              <Badge className="ml-auto bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                <Sparkles size={10} className="mr-1" />CLV
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(predictiveData.customerCLV.high_value_customers || []).length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">Projected 12-month revenue</span>
                  <span className="text-lg font-bold text-emerald-600">SAR {(predictiveData.customerCLV.total_projected_revenue || 0).toLocaleString()}</span>
                </div>
                {(predictiveData.customerCLV.high_value_customers || []).slice(0, 3).map((c, i) => (
                  <div key={i} className="flex justify-between items-center p-2 bg-white/60 dark:bg-stone-800/60 rounded-lg border border-emerald-100 dark:border-emerald-800" data-testid="clv-customer-item">
                    <div>
                      <span className="font-medium text-sm">{c.customer_name}</span>
                      <p className="text-xs text-muted-foreground">{c.total_orders} orders | {c.days_as_customer}d active</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-emerald-600">SAR {(c.predicted_clv || 0).toLocaleString()}</span>
                      <p className="text-xs text-muted-foreground">lifetime value</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <Users size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Add customers to see CLV insights</p>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {widgets.profitTrend && (
        <Card className="border-border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 dark:border-amber-700" data-testid="profit-trend-widget">
          <CardHeader className="pb-2">
            <CardTitle className="font-outfit text-base flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp size={16} className="text-amber-600 dark:text-amber-400" />
              </div>
              <span>AI: Profit Analysis</span>
              <Badge className="ml-auto bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                <Brain size={10} className="mr-1" />Trend
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {predictiveData.profitTrend.summary ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white/60 dark:bg-stone-800/60 rounded-lg border border-amber-100 dark:border-amber-800 text-center">
                    <p className="text-xs text-muted-foreground">Avg Daily Profit</p>
                    <span className={`text-lg font-bold ${(predictiveData.profitTrend.summary.avg_daily_profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      SAR {(predictiveData.profitTrend.summary.avg_daily_profit || 0).toFixed(0)}
                    </span>
                  </div>
                  <div className="p-3 bg-white/60 dark:bg-stone-800/60 rounded-lg border border-amber-100 dark:border-amber-800 text-center">
                    <p className="text-xs text-muted-foreground">Trend</p>
                    <span className={`text-lg font-bold capitalize ${predictiveData.profitTrend.summary.profit_trend === 'improving' ? 'text-emerald-600' : predictiveData.profitTrend.summary.profit_trend === 'declining' ? 'text-red-600' : 'text-amber-600'}`}>
                      {predictiveData.profitTrend.summary.profit_trend || 'Stable'}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2 bg-white/60 dark:bg-stone-800/60 rounded-lg border border-amber-100 dark:border-amber-800">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-100 text-emerald-700">Best</Badge>
                    <span className="text-sm font-medium">{predictiveData.profitTrend.summary.best_day || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-red-100 text-red-700">Worst</Badge>
                    <span className="text-sm font-medium">{predictiveData.profitTrend.summary.worst_day || 'N/A'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <TrendingUp size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Not enough data for profit analysis</p>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Upcoming Recurring Expenses */}
        {stats?.upcoming_expenses?.length > 0 && (
          <Card className="border-border border-error/30 bg-error/5">
            <CardHeader><CardTitle className="font-outfit flex items-center gap-2"><AlertTriangle size={18} className="text-error" />Upcoming Expenses ({stats.upcoming_expenses.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.upcoming_expenses.map((e, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-background rounded-lg border" data-testid="upcoming-expense">
                    <div><div className="font-medium text-sm">{e.name}</div><div className="text-xs text-muted-foreground capitalize">{e.category} | Due: {format(new Date(e.due_date), 'MMM dd, yyyy')}</div></div>
                    <div className="text-right"><div className="font-bold"> SAR {e.amount.toFixed(2)}</div><Badge className={e.days_left < 0 ? 'bg-error/20 text-error' : 'bg-warning/20 text-warning'}>{e.days_left < 0 ? `${Math.abs(e.days_left)}d overdue` : `${e.days_left}d left`}</Badge></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Document Expiry Alerts */}
        {alerts.length > 0 && (
          <Card className="border-border border-warning/50 bg-warning/5">
            <CardHeader>
              <CardTitle className="font-outfit flex items-center gap-2">
                <AlertTriangle size={18} className="text-warning" />
                Document Expiry Alerts ({alerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alerts.slice(0, 5).map((a) => (
                  <div key={a.id + a.type} className={`flex justify-between items-center p-3 rounded-lg ${a.days_left < 0 ? 'bg-error/10' : 'bg-warning/10'}`} data-testid="dashboard-alert">
                    <div>
                      <div className="font-medium text-sm">{a.name}</div>
                      <div className="text-xs text-muted-foreground">{a.related_to} | {format(new Date(a.expiry_date), 'MMM dd, yyyy')}</div>
                    </div>
                    <Badge className={a.days_left < 0 ? 'bg-error/20 text-error' : 'bg-warning/20 text-warning'}>
                      {a.days_left < 0 ? `${Math.abs(a.days_left)}d overdue` : `${a.days_left}d left`}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payback Dialog */}
        <Dialog open={showPaybackDialog} onOpenChange={setShowPaybackDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-outfit">Record Branch Payback</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground mb-3">When one branch pays back another branch for expenses paid on their behalf</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Paying Branch (who owes)</Label>
                  <Select value={paybackData.from_branch_id || "none"} onValueChange={(v) => setPaybackData({...paybackData, from_branch_id: v === "none" ? "" : v})}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Receiving Branch (who paid)</Label>
                  <Select value={paybackData.to_branch_id || "none"} onValueChange={(v) => setPaybackData({...paybackData, to_branch_id: v === "none" ? "" : v})}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Amount *</Label><Input type="number" step="0.01" value={paybackData.amount} onChange={(e) => setPaybackData({...paybackData, amount: e.target.value})} placeholder="SAR 0.00" /></div>
                <div><Label>Mode</Label>
                  <Select value={paybackData.payment_mode} onValueChange={(v) => setPaybackData({...paybackData, payment_mode: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="rounded-xl w-full" onClick={async () => {
                if (!paybackData.from_branch_id || !paybackData.to_branch_id || !paybackData.amount) { toast.error('Fill all fields'); return; }
                try {
                  await api.post('/branch-paybacks', {...paybackData, amount: parseFloat(paybackData.amount), date: new Date().toISOString()});
                  toast.success('Payback recorded - dues updated');
                  setShowPaybackDialog(false);
                  setPaybackData({ from_branch_id: '', to_branch_id: '', amount: '', payment_mode: 'cash' });
                  fetchStats();
                } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
              }}>Record Payback</Button>
            </div>
          </DialogContent>
        </Dialog>
        <WhatsAppSendDialog open={showWhatsApp} onClose={() => setShowWhatsApp(false)} defaultType="daily_sales" branches={branches} />

        {/* Widget Customization Dialog */}
        <Dialog open={showWidgetSettings} onOpenChange={setShowWidgetSettings}>
          <DialogContent className="max-w-md" data-testid="widget-settings-dialog">
            <DialogHeader><DialogTitle className="font-outfit">{tr('customize_widgets')}</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground mb-2">{tr('customize_widgets')}</p>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {WIDGET_OPTIONS.map(w => (
                <div 
                  key={w.key} 
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${widgets[w.key] ? 'bg-success/5 border-success/30' : 'bg-stone-50 border-stone-200 hover:border-stone-300'}`} 
                  onClick={() => toggleWidget(w.key)}
                >
                  <button 
                    className={`w-10 h-6 rounded-full relative transition-colors flex-shrink-0 ${widgets[w.key] ? 'bg-success' : 'bg-stone-300'}`} 
                    data-testid={`widget-toggle-${w.key}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${widgets[w.key] ? 'left-5' : 'left-1'}`} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{tr(w.labelKey)}</p>
                    <p className="text-xs text-muted-foreground truncate">{tr(w.descKey)}</p>
                  </div>
                  {widgets[w.key] ? <Eye size={16} className="text-success flex-shrink-0" /> : <EyeOff size={16} className="text-stone-400 flex-shrink-0" />}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 rounded-xl" 
                onClick={() => { 
                  const all = {}; 
                  WIDGET_OPTIONS.forEach(w => all[w.key] = true); 
                  setWidgets(all); 
                  saveWidgetPrefs(all);
                  api.post('/dashboard/layout', { widgets: all }).catch(() => {});
                  toast.success('All widgets enabled');
                }}
              >
                {tr('show_all')}
              </Button>
              <Button 
                variant="outline"
                size="sm" 
                className="flex-1 rounded-xl" 
                onClick={() => { 
                  const none = {}; 
                  WIDGET_OPTIONS.forEach(w => none[w.key] = false); 
                  none.stats = true; // Keep at least stats visible
                  setWidgets(none); 
                  saveWidgetPrefs(none);
                  api.post('/dashboard/layout', { widgets: none }).catch(() => {});
                  toast.success('Minimized dashboard');
                }}
              >
                {tr('minimize')}
              </Button>
              <Button size="sm" className="flex-1 rounded-xl" onClick={() => setShowWidgetSettings(false)}>{tr('done')}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dashboard Tour */}
        {showTour && (
          <DashboardTour 
            onComplete={handleTourComplete} 
            language={language}
          />
        )}

        {/* Branch Dues Detail Dialog */}
        <Dialog open={showDuesDetail} onOpenChange={setShowDuesDetail}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid="dues-detail-dialog">
            <DialogHeader>
              <DialogTitle className="font-outfit">Branch Dues - Transaction Details</DialogTitle>
            </DialogHeader>
            {duesDetailData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No cross-branch transactions found</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Date</th>
                      <th className="text-left px-3 py-2 font-medium">Type</th>
                      <th className="text-left px-3 py-2 font-medium">From Branch</th>
                      <th className="text-left px-3 py-2 font-medium">To Branch</th>
                      <th className="text-right px-3 py-2 font-medium">Amount</th>
                      <th className="text-left px-3 py-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duesDetailData.map((entry, i) => (
                      <tr key={i} className="border-t hover:bg-stone-50/50" data-testid={`dues-entry-${i}`}>
                        <td className="px-3 py-2 text-xs">{entry.date ? new Date(entry.date).toLocaleDateString() : '-'}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={`text-[10px] capitalize ${
                            entry.type === 'transfer' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                            entry.type === 'expense' ? 'bg-red-50 border-red-200 text-red-700' :
                            entry.type === 'salary' ? 'bg-purple-50 border-purple-200 text-purple-700' :
                            'bg-amber-50 border-amber-200 text-amber-700'
                          }`}>{entry.type.replace('_', ' ')}</Badge>
                        </td>
                        <td className="px-3 py-2 text-sm font-medium">{entry.from_branch}</td>
                        <td className="px-3 py-2 text-sm">{entry.to_branch}</td>
                        <td className="px-3 py-2 text-right font-bold text-sm">SAR {entry.amount?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[200px]">{entry.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-2 bg-stone-50 text-xs text-muted-foreground border-t">
                  {duesDetailData.length} cross-branch transactions
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
