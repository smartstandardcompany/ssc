import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  BarChart3, TrendingUp, ShoppingCart, Package, Loader2,
  ArrowUpRight, ArrowDownRight, UtensilsCrossed, Layers
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import api from '@/lib/api';
import { useBranchStore } from '@/stores';

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
];

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b', '#06b6d4', '#ec4899'];

function StatCard({ title, value, subtitle, icon: Icon, color = 'orange' }) {
  const colorMap = {
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
  };
  return (
    <Card data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold mt-1 dark:text-white">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
            <Icon size={20} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TopItemsTable({ items, title }) {
  if (!items || items.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">No data for this period</p>;
  return (
    <div className="overflow-x-auto" data-testid="top-items-table">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 font-medium">#</th>
            <th className="pb-2 font-medium">Item</th>
            <th className="pb-2 font-medium text-right">Qty Sold</th>
            <th className="pb-2 font-medium text-right">Revenue</th>
            <th className="pb-2 font-medium text-right">Orders</th>
            <th className="pb-2 font-medium">Category</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.item_id || i} className="border-b last:border-0 hover:bg-stone-50 dark:hover:bg-stone-800/50" data-testid={`item-row-${i}`}>
              <td className="py-2.5 font-semibold text-muted-foreground">{i + 1}</td>
              <td className="py-2.5">
                <div>
                  <span className="font-medium dark:text-white">{item.name}</span>
                  {item.name_ar && <span className="text-xs text-muted-foreground ml-2" dir="rtl">{item.name_ar}</span>}
                </div>
              </td>
              <td className="py-2.5 text-right font-semibold dark:text-white">{item.total_qty}</td>
              <td className="py-2.5 text-right font-semibold text-orange-600">SAR {item.total_revenue.toLocaleString()}</td>
              <td className="py-2.5 text-right">{item.order_count}</td>
              <td className="py-2.5"><Badge variant="outline" className="text-[10px]">{item.category}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModifierTable({ modifiers, title }) {
  if (!modifiers || modifiers.length === 0) return <p className="text-sm text-muted-foreground text-center py-6">No {title.toLowerCase()} data yet</p>;
  return (
    <div className="space-y-2" data-testid={`modifier-table-${title.toLowerCase()}`}>
      {modifiers.map((m, i) => (
        <div key={i} className="flex items-center justify-between p-3 border rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800/50">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-muted-foreground w-6">{i + 1}</span>
            <div>
              <p className="text-sm font-medium dark:text-white">{m.name}</p>
              {m.used_with_items && m.used_with_items.length > 0 && (
                <p className="text-[11px] text-muted-foreground">Used with: {m.used_with_items.slice(0, 3).join(', ')}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 text-right">
            <div>
              <p className="text-sm font-semibold dark:text-white">{m.usage_count}x</p>
              <p className="text-[10px] text-muted-foreground">times used</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-orange-600">SAR {m.total_revenue}</p>
              <p className="text-[10px] text-muted-foreground">revenue</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MenuAnalyticsPage() {
  const { branches, fetchBranches } = useBranchStore();
  const [period, setPeriod] = useState('all');
  const [branchId, setBranchId] = useState('all');
  const [itemData, setItemData] = useState(null);
  const [addonData, setAddonData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchBranches(); }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const params = `period=${period}${branchId !== 'all' ? `&branch_id=${branchId}` : ''}`;
      const [itemRes, addonRes] = await Promise.all([
        api.get(`/menu-analytics/items?${params}`),
        api.get(`/menu-analytics/addons?${params}`),
      ]);
      setItemData(itemRes.data);
      setAddonData(addonRes.data);
    } catch (err) {
      toast.error('Failed to load analytics');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAnalytics(); }, [period, branchId]);

  const topBarData = (itemData?.items || []).slice(0, 8).map(i => ({
    name: i.name.length > 12 ? i.name.slice(0, 12) + '...' : i.name,
    revenue: i.total_revenue,
    qty: i.total_qty,
  }));

  const categoryPieData = (itemData?.category_summary || []).map((c, i) => ({
    name: c.category.charAt(0).toUpperCase() + c.category.slice(1),
    value: c.total_revenue,
    fill: COLORS[i % COLORS.length],
  }));

  const allModBarData = (addonData?.all_modifiers || []).slice(0, 10).map(m => ({
    name: m.name.length > 10 ? m.name.slice(0, 10) + '...' : m.name,
    count: m.usage_count,
    revenue: m.total_revenue,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="menu-analytics-page">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-outfit dark:text-white">Menu Analytics</h1>
            <p className="text-muted-foreground text-sm">Item sales performance & add-on usage insights</p>
          </div>
          <div className="flex gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-36" data-testid="period-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger className="w-40" data-testid="branch-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={32} className="animate-spin text-orange-500" /></div>
        ) : (
          <Tabs defaultValue="items" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="items" className="gap-1.5" data-testid="tab-items"><UtensilsCrossed size={14} />Item Sales</TabsTrigger>
              <TabsTrigger value="addons" className="gap-1.5" data-testid="tab-addons"><Package size={14} />Add-on Usage</TabsTrigger>
            </TabsList>

            {/* ---- ITEM SALES TAB ---- */}
            <TabsContent value="items" className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Items Sold" value={itemData?.total_qty || 0} subtitle={`${period === 'all' ? 'all time' : period}`} icon={ShoppingCart} color="orange" />
                <StatCard title="Menu Revenue" value={`SAR ${(itemData?.total_revenue || 0).toLocaleString()}`} subtitle="from POS orders" icon={TrendingUp} color="green" />
                <StatCard title="Unique Items" value={itemData?.items?.length || 0} subtitle="items ordered" icon={UtensilsCrossed} color="blue" />
                <StatCard title="Categories" value={itemData?.category_summary?.length || 0} subtitle="active categories" icon={Layers} color="purple" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base font-outfit">Top Items by Revenue</CardTitle></CardHeader>
                  <CardContent>
                    {topBarData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={topBarData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v) => [`SAR ${v}`, 'Revenue']} />
                          <Bar dataKey="revenue" fill="#f97316" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <p className="text-sm text-muted-foreground text-center py-12">No data</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base font-outfit">Revenue by Category</CardTitle></CardHeader>
                  <CardContent>
                    {categoryPieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie data={categoryPieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                            {categoryPieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                          </Pie>
                          <Tooltip formatter={(v) => [`SAR ${v}`, 'Revenue']} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <p className="text-sm text-muted-foreground text-center py-12">No data</p>}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base font-outfit">All Items Ranked</CardTitle></CardHeader>
                <CardContent>
                  <TopItemsTable items={itemData?.items || []} title="Items" />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ---- ADD-ON USAGE TAB ---- */}
            <TabsContent value="addons" className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Modifier Uses" value={addonData?.total_modifier_usage || 0} subtitle="total selections" icon={Package} color="orange" />
                <StatCard title="Modifier Revenue" value={`SAR ${(addonData?.total_modifier_revenue || 0).toLocaleString()}`} subtitle="extra revenue" icon={TrendingUp} color="green" />
                <StatCard title="Adoption Rate" value={`${addonData?.modifier_adoption_rate || 0}%`} subtitle={`${addonData?.orders_with_modifiers || 0} of ${addonData?.total_orders || 0} orders`} icon={BarChart3} color="blue" />
                <StatCard title="Total Orders" value={addonData?.total_orders || 0} subtitle={`${period === 'all' ? 'all time' : period}`} icon={ShoppingCart} color="purple" />
              </div>

              {allModBarData.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base font-outfit">Most Used Modifiers</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={allModBarData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="count" name="Times Used" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="revenue" name="Revenue (SAR)" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base font-outfit">Size Variants</CardTitle></CardHeader>
                  <CardContent><ModifierTable modifiers={addonData?.sizes || []} title="Sizes" /></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base font-outfit">Add-ons</CardTitle></CardHeader>
                  <CardContent><ModifierTable modifiers={addonData?.addons || []} title="Add-ons" /></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base font-outfit">Option Groups</CardTitle></CardHeader>
                  <CardContent><ModifierTable modifiers={addonData?.options || []} title="Options" /></CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
