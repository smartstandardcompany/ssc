import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3, TrendingUp, Activity, Zap, CalendarDays, FileText, CreditCard,
  Tags, ArrowDownUp, AlertTriangle, Handshake, CalendarClock, PieChart, FileSpreadsheet
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const reportSections = [
  {
    title: 'Financial Reports',
    color: 'emerald',
    items: [
      { path: '/daily-summary', icon: CalendarDays, label: 'Daily Summary', desc: 'Day-by-day sales, expenses & profit breakdown', badge: 'Popular' },
      { path: '/enhanced-pnl', icon: TrendingUp, label: 'Enhanced P&L', desc: 'Detailed profit & loss with trends' },
      { path: '/category-report', icon: Tags, label: 'Category Report', desc: 'Expenses grouped by category' },
      { path: '/credit-report', icon: CreditCard, label: 'Credit Report', desc: 'Customer credit balances & aging' },
      { path: '/supplier-report', icon: FileText, label: 'Supplier Report', desc: 'Supplier transactions & balances' },
      { path: '/bank-statements', icon: FileSpreadsheet, label: 'Bank Statements', desc: 'Upload & reconcile bank statements' },
      { path: '/reconciliation', icon: ArrowDownUp, label: 'Reconciliation', desc: 'Match transactions with bank records' },
    ]
  },
  {
    title: 'Analytics & Insights',
    color: 'blue',
    items: [
      { path: '/analytics', icon: BarChart3, label: 'Analytics Dashboard', desc: 'Overview charts and KPIs', badge: 'Popular' },
      { path: '/advanced-analytics', icon: Zap, label: 'Advanced Analytics', desc: 'AI-powered insights & comparisons' },
      { path: '/visualizations', icon: PieChart, label: 'Visualizations', desc: 'Interactive charts and graphs' },
      { path: '/sales-forecast', icon: TrendingUp, label: 'Sales Forecast', desc: 'AI-predicted sales trends' },
      { path: '/trend-comparison', icon: TrendingUp, label: 'Trend Comparison', desc: 'Compare periods side by side' },
      { path: '/anomaly-detection', icon: AlertTriangle, label: 'Anomaly Detection', desc: 'Spot unusual patterns in data' },
    ]
  },
  {
    title: 'Operations',
    color: 'amber',
    items: [
      { path: '/shift-report', icon: CalendarClock, label: 'Shift Report', desc: 'Sales & activity by shift/time' },
      { path: '/performance-report', icon: Activity, label: 'Performance Report', desc: 'Branch & staff performance metrics' },
      { path: '/partner-pl-report', icon: Handshake, label: 'Partner P&L', desc: 'Profit sharing with partners' },
    ]
  },
  {
    title: 'Tools',
    color: 'violet',
    items: [
      { path: '/report-builder', icon: FileText, label: 'Custom Report Builder', desc: 'Build your own reports with filters', badge: 'New' },
    ]
  },
];

const colorMap = {
  emerald: { bg: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200', icon: 'text-emerald-600', title: 'text-emerald-800', header: 'bg-emerald-500' },
  blue: { bg: 'bg-blue-50 hover:bg-blue-100 border-blue-200', icon: 'text-blue-600', title: 'text-blue-800', header: 'bg-blue-500' },
  amber: { bg: 'bg-amber-50 hover:bg-amber-100 border-amber-200', icon: 'text-amber-600', title: 'text-amber-800', header: 'bg-amber-500' },
  violet: { bg: 'bg-violet-50 hover:bg-violet-100 border-violet-200', icon: 'text-violet-600', title: 'text-violet-800', header: 'bg-violet-500' },
};

export default function ReportsPage() {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold font-outfit" data-testid="reports-hub-title">Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">Access all your reports and analytics from one place</p>
        </div>

        {reportSections.map((section) => {
          const colors = colorMap[section.color];
          return (
            <div key={section.title}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-1.5 h-5 rounded-full ${colors.header}`} />
                <h2 className={`text-lg font-semibold font-outfit ${colors.title}`}>{section.title}</h2>
                <Badge variant="outline" className="text-[10px]">{section.items.length}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Card
                      key={item.path}
                      className={`cursor-pointer transition-all duration-200 border ${colors.bg} hover:shadow-md hover:-translate-y-0.5`}
                      onClick={() => navigate(item.path)}
                      data-testid={`report-card-${item.path.replace('/', '')}`}
                    >
                      <CardContent className="p-4 flex items-start gap-3">
                        <div className={`p-2 rounded-lg bg-white/70 ${colors.icon}`}>
                          <Icon size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{item.label}</span>
                            {item.badge && (
                              <Badge className="text-[9px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-0">{item.badge}</Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{item.desc}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
