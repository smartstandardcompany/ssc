import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, AlertTriangle, TrendingUp, TrendingDown, ShoppingCart, Truck, Calendar, Brain, Sparkles, RefreshCw, CheckCircle, Clock, X } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useBranchStore } from '@/stores';

function StockAIInsight() {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);
  const fetch = async () => {
    setLoading(true);
    try { const { data } = await api.get('/ai-insights/stock'); setInsight(data); } catch { setInsight({ insight: 'Unable to load.' }); }
    setLoading(false);
  };
  return (
    <Card className="border-purple-200 bg-gradient-to-r from-purple-50/50 to-indigo-50/30" data-testid="stock-ai-insight">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2"><Sparkles size={14} className="text-purple-500" /><span className="text-sm font-semibold">AI Stock Analysis</span></div>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={fetch} disabled={loading}><RefreshCw size={12} className={`mr-1 ${loading ? 'animate-spin' : ''}`} />{insight ? 'Refresh' : 'Generate'}</Button>
        </div>
        {loading && <p className="text-xs text-muted-foreground animate-pulse">Analyzing inventory data...</p>}
        {!loading && insight && <p className="text-sm leading-relaxed">{insight.insight}</p>}
        {!loading && !insight && <p className="text-xs text-muted-foreground">Click Generate to get AI-powered stock management insights</p>}
      </CardContent>
    </Card>
  );
}

export default function StockReorderPage() {
  const { branches, fetchBranches } = useBranchStore();
  const [reorderData, setReorderData] = useState({ predictions: [], total_items: 0, items_needing_reorder: 0 });
  const [smartAlerts, setSmartAlerts] = useState({ alerts: [], summary: {} });
  const [demandForecast, setDemandForecast] = useState({ items: [], items_at_risk: 0 });
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [orderSupplier, setOrderSupplier] = useState('');

  useEffect(() => {
    fetchData();
    fetchBranches();
  }, [branchFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = branchFilter ? `?branch_id=${branchFilter}` : '';
      const [reorderRes, alertsRes, demandRes, suppliersRes] = await Promise.all([
        api.get(`/reports/stock-reorder${params}`),
        api.get(`/stock/smart-alerts${params}`),
        api.get('/predictions/inventory-demand'),
        api.get('/suppliers/names').catch(() => ({ data: [] })),
      ]);
      setReorderData(reorderRes.data);
      setSmartAlerts(alertsRes.data);
      setDemandForecast(demandRes.data);
      setSuppliers(suppliersRes.data || []);
    } catch (error) {
      toast.error('Failed to fetch reorder data');
    } finally {
      setLoading(false);
    }
  };

  const filteredPredictions = reorderData.predictions.filter(p => {
    if (urgencyFilter === 'all') return true;
    return p.urgency === urgencyFilter;
  });

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-300';
      case 'soon': return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'normal': return 'bg-blue-100 text-blue-700 border-blue-300';
      default: return 'bg-green-100 text-green-700 border-green-300';
    }
  };

  const getUrgencyIcon = (urgency) => {
    switch (urgency) {
      case 'critical': return <AlertTriangle className="text-red-500" size={16} />;
      case 'soon': return <Clock className="text-amber-500" size={16} />;
      default: return <CheckCircle className="text-green-500" size={16} />;
    }
  };

  const toggleItemSelection = (item) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.item_id === item.item_id);
      if (exists) {
        return prev.filter(i => i.item_id !== item.item_id);
      }
      return [...prev, { ...item, order_qty: item.suggested_reorder_qty }];
    });
  };

  const updateOrderQty = (itemId, qty) => {
    setSelectedItems(prev => prev.map(i => 
      i.item_id === itemId ? { ...i, order_qty: parseFloat(qty) || 0 } : i
    ));
  };

  const createPurchaseOrder = async () => {
    if (!orderSupplier) {
      toast.error('Select a supplier');
      return;
    }
    if (selectedItems.length === 0) {
      toast.error('Select items to order');
      return;
    }
    try {
      // Create stock entries as pending orders
      const items = selectedItems.map(i => ({
        item_id: i.item_id,
        item_name: i.item_name,
        quantity: i.order_qty,
        unit_cost: 0, // To be filled when received
        unit: i.unit,
      }));
      
      await api.post('/stock/entries/bulk', {
        items,
        supplier_id: orderSupplier,
        source: 'reorder_suggestion',
        branch_id: branchFilter || undefined,
      });
      
      toast.success(`Purchase order created for ${selectedItems.length} items`);
      setShowOrderDialog(false);
      setSelectedItems([]);
      setOrderSupplier('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create order');
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin mr-2" />
          Loading AI predictions...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit flex items-center gap-2" data-testid="reorder-page-title">
              <Brain className="text-purple-500" />
              AI Stock Reorder
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Intelligent reordering suggestions based on sales velocity and demand forecasting
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={branchFilter || "all"} onValueChange={(val) => setBranchFilter(val === "all" ? "" : val)}>
              <SelectTrigger className="w-40" data-testid="branch-filter">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={fetchData} variant="outline" size="sm">
              <RefreshCw size={14} className="mr-1" /> Refresh
            </Button>
            {selectedItems.length > 0 && (
              <Button onClick={() => setShowOrderDialog(true)} className="bg-purple-600 hover:bg-purple-700" data-testid="create-order-btn">
                <ShoppingCart size={14} className="mr-1" /> Create Order ({selectedItems.length})
              </Button>
            )}
          </div>
        </div>

        {/* AI Insight */}
        <StockAIInsight />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-red-200 bg-gradient-to-br from-red-50 to-red-100">
            <CardContent className="p-4 text-center">
              <AlertTriangle className="mx-auto text-red-500 mb-2" size={24} />
              <p className="text-2xl font-bold text-red-700" data-testid="critical-count">
                {reorderData.predictions.filter(p => p.urgency === 'critical').length}
              </p>
              <p className="text-xs text-red-600">Critical (Reorder Now)</p>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100">
            <CardContent className="p-4 text-center">
              <Clock className="mx-auto text-amber-500 mb-2" size={24} />
              <p className="text-2xl font-bold text-amber-700" data-testid="soon-count">
                {reorderData.predictions.filter(p => p.urgency === 'soon').length}
              </p>
              <p className="text-xs text-amber-600">Reorder Soon (7 days)</p>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-4 text-center">
              <Package className="mx-auto text-blue-500 mb-2" size={24} />
              <p className="text-2xl font-bold text-blue-700" data-testid="total-items">
                {reorderData.total_items}
              </p>
              <p className="text-xs text-blue-600">Total Items Tracked</p>
            </CardContent>
          </Card>
          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-4 text-center">
              <Sparkles className="mx-auto text-purple-500 mb-2" size={24} />
              <p className="text-2xl font-bold text-purple-700" data-testid="at-risk-count">
                {demandForecast.items_at_risk}
              </p>
              <p className="text-xs text-purple-600">At Risk (14-day forecast)</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="reorder" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="reorder" data-testid="tab-reorder">
              <ShoppingCart size={14} className="mr-1" /> Reorder Suggestions
            </TabsTrigger>
            <TabsTrigger value="alerts" data-testid="tab-alerts">
              <AlertTriangle size={14} className="mr-1" /> Smart Alerts
            </TabsTrigger>
            <TabsTrigger value="forecast" data-testid="tab-forecast">
              <TrendingUp size={14} className="mr-1" /> Demand Forecast
            </TabsTrigger>
          </TabsList>

          {/* Reorder Suggestions Tab */}
          <TabsContent value="reorder">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Reorder Suggestions</CardTitle>
                  <div className="flex gap-2">
                    {['all', 'critical', 'soon', 'normal'].map(filter => (
                      <Button
                        key={filter}
                        size="sm"
                        variant={urgencyFilter === filter ? 'default' : 'outline'}
                        onClick={() => setUrgencyFilter(filter)}
                        className="text-xs"
                      >
                        {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-stone-50">
                        <th className="px-3 py-2 text-left w-10">
                          <input 
                            type="checkbox" 
                            checked={selectedItems.length === filteredPredictions.length && filteredPredictions.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedItems(filteredPredictions.map(p => ({ ...p, order_qty: p.suggested_reorder_qty })));
                              } else {
                                setSelectedItems([]);
                              }
                            }}
                            className="rounded"
                          />
                        </th>
                        <th className="px-3 py-2 text-left">Item</th>
                        <th className="px-3 py-2 text-right">Current Stock</th>
                        <th className="px-3 py-2 text-right">Daily Usage</th>
                        <th className="px-3 py-2 text-right">Days Left</th>
                        <th className="px-3 py-2 text-center">Urgency</th>
                        <th className="px-3 py-2 text-right">Suggested Qty</th>
                        <th className="px-3 py-2 text-left">Reorder By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPredictions.map((item, idx) => {
                        const isSelected = selectedItems.find(i => i.item_id === item.item_id);
                        return (
                          <tr 
                            key={item.item_id} 
                            className={`border-b hover:bg-stone-50 transition-colors ${isSelected ? 'bg-purple-50' : ''}`}
                            data-testid={`reorder-row-${idx}`}
                          >
                            <td className="px-3 py-2">
                              <input 
                                type="checkbox"
                                checked={!!isSelected}
                                onChange={() => toggleItemSelection(item)}
                                className="rounded"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium">{item.item_name}</div>
                              <div className="text-xs text-muted-foreground">{item.category} • {item.unit}</div>
                            </td>
                            <td className="px-3 py-2 text-right font-mono">
                              {item.current_balance.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right font-mono">
                              {item.daily_usage.toFixed(1)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span className={`font-bold ${item.days_left <= 3 ? 'text-red-600' : item.days_left <= 7 ? 'text-amber-600' : 'text-green-600'}`}>
                                {item.days_left.toFixed(0)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Badge className={`${getUrgencyColor(item.urgency)} text-xs`}>
                                {getUrgencyIcon(item.urgency)}
                                <span className="ml-1">{item.urgency}</span>
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-purple-600">
                              {item.suggested_reorder_qty.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-left text-xs">
                              <Calendar size={12} className="inline mr-1" />
                              {item.reorder_date}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredPredictions.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                            No items need reordering
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Smart Alerts Tab */}
          <TabsContent value="alerts">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="text-purple-500" size={18} />
                  AI-Powered Smart Alerts
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Based on {smartAlerts.summary?.lookback_days || 30} days of sales velocity analysis
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {smartAlerts.alerts?.map((alert, idx) => (
                    <div 
                      key={alert.item_id}
                      className={`p-4 rounded-lg border ${
                        alert.alert_level === 'critical' ? 'border-red-300 bg-red-50' :
                        alert.alert_level === 'warning' ? 'border-amber-300 bg-amber-50' :
                        'border-blue-300 bg-blue-50'
                      }`}
                      data-testid={`smart-alert-${idx}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {alert.alert_level === 'critical' && <AlertTriangle className="text-red-500" size={16} />}
                            {alert.alert_level === 'warning' && <Clock className="text-amber-500" size={16} />}
                            {alert.alert_level === 'info' && <TrendingDown className="text-blue-500" size={16} />}
                            {alert.item_name}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{alert.alert_reason}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm">
                            <span className="text-muted-foreground">Stock: </span>
                            <span className="font-bold">{alert.current_balance} {alert.unit}</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">Daily avg: </span>
                            <span className="font-mono">{alert.avg_daily_usage}</span>
                          </div>
                          {alert.suggested_order_qty > 0 && (
                            <div className="text-sm text-purple-600 font-medium mt-1">
                              Order: {alert.suggested_order_qty} {alert.unit}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!smartAlerts.alerts || smartAlerts.alerts.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="mx-auto text-green-500 mb-2" size={32} />
                      No alerts - all stock levels are healthy
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Demand Forecast Tab */}
          <TabsContent value="forecast">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="text-green-500" size={18} />
                  14-Day Demand Forecast
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {demandForecast.items?.slice(0, 15).map((item, idx) => (
                    <div key={item.item_id} className="p-4 border rounded-lg" data-testid={`forecast-item-${idx}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-medium">{item.item_name}</span>
                          <Badge className="ml-2" variant="outline">{item.category || 'General'}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.trend === 'increasing' && <TrendingUp className="text-green-500" size={16} />}
                          {item.trend === 'decreasing' && <TrendingDown className="text-red-500" size={16} />}
                          <span className={`text-sm font-medium ${
                            item.trend_percent > 0 ? 'text-green-600' : item.trend_percent < 0 ? 'text-red-600' : 'text-stone-600'
                          }`}>
                            {item.trend_percent > 0 ? '+' : ''}{item.trend_percent}%
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Current Stock</span>
                          <p className="font-bold">{item.current_stock} {item.unit}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg Daily</span>
                          <p className="font-bold">{item.avg_daily_demand}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">14-Day Demand</span>
                          <p className="font-bold">{item.total_predicted_demand}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Days Until Out</span>
                          <p className={`font-bold ${item.days_until_stockout <= 7 ? 'text-red-600' : item.days_until_stockout <= 14 ? 'text-amber-600' : 'text-green-600'}`}>
                            {item.days_until_stockout}
                          </p>
                        </div>
                      </div>
                      {!item.stock_sufficient && (
                        <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700 flex items-center gap-2">
                          <AlertTriangle size={14} />
                          Stock will not last 14 days at current velocity
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Order Dialog */}
        <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="create-order-dialog">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="text-purple-500" />
                Create Purchase Order
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Select Supplier</label>
                <Select value={orderSupplier} onValueChange={setOrderSupplier}>
                  <SelectTrigger data-testid="order-supplier-select">
                    <SelectValue placeholder="Choose supplier..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-right">Current Stock</th>
                      <th className="px-3 py-2 text-right">Order Quantity</th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedItems.map(item => (
                      <tr key={item.item_id} className="border-t">
                        <td className="px-3 py-2">
                          <div className="font-medium">{item.item_name}</div>
                          <div className="text-xs text-muted-foreground">{item.unit}</div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {item.current_balance}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Input
                            type="number"
                            value={item.order_qty}
                            onChange={(e) => updateOrderQty(item.item_id, e.target.value)}
                            className="w-24 text-right ml-auto"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedItems(prev => prev.filter(i => i.item_id !== item.item_id))}
                          >
                            <X size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowOrderDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={createPurchaseOrder} className="bg-purple-600 hover:bg-purple-700" data-testid="confirm-order-btn">
                  <Truck size={14} className="mr-1" /> Create Order
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
