import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Package, TrendingDown, TrendingUp, AlertTriangle, Camera, Loader2, MessageCircle, BarChart3, Barcode, Printer, Download, FileDown } from 'lucide-react';
import { WhatsAppSendDialog } from '@/components/WhatsAppSendDialog';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useBranchStore } from '@/stores';
import { VirtualizedTable } from '@/components/VirtualizedTable';

export default function StockPage() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const { branches, fetchBranches } = useBranchStore();
  const [suppliers, setSuppliers] = useState([]);
  const [balance, setBalance] = useState([]);
  const [entries, setEntries] = useState([]);
  const [usage, setUsage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);
  const [showStockIn, setShowStockIn] = useState(false);
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [consumptionReport, setConsumptionReport] = useState(null);
  const [profitReport, setProfitReport] = useState(null);
  const [wastageReport, setWastageReport] = useState(null);
  const [reportDays, setReportDays] = useState(30);
  const [smartAlerts, setSmartAlerts] = useState({ alerts: [], summary: {} });
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [showBarcodePreview, setShowBarcodePreview] = useState(false);
  const [selectedBarcodeItem, setSelectedBarcodeItem] = useState(null);
  const [barcodeImageUrl, setBarcodeImageUrl] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [selectedItemsForBatch, setSelectedItemsForBatch] = useState([]);

  const [newItem, setNewItem] = useState({ name: '', cost_price: '', unit_price: '', unit: 'piece', category: '', min_stock_level: '' });
  const [stockInData, setStockInData] = useState({ item_id: '', branch_id: '', quantity: '', unit_cost: '', supplier_id: '', date: new Date().toISOString().split('T')[0], notes: '' });

  useEffect(() => { fetchAll(); fetchSmartAlerts(); }, []);
  useEffect(() => { fetchBalance(); fetchSmartAlerts(); }, [branchFilter]);

  const fetchAll = async () => {
    try {
      fetchBranches();
      const [iR, sR, eR, uR] = await Promise.all([
        api.get('/items'), api.get('/suppliers'),
        api.get('/stock/entries'), api.get('/stock/usage')
      ]);
      setItems(iR.data); setSuppliers(sR.data);
      setEntries(eR.data); setUsage(uR.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const fetchBalance = async () => {
    try {
      const url = branchFilter ? `/stock/balance?branch_id=${branchFilter}` : '/stock/balance';
      const res = await api.get(url);
      setBalance(res.data);
    } catch {}
  };

  const fetchSmartAlerts = async () => {
    setAlertsLoading(true);
    try {
      const url = branchFilter 
        ? `/stock/smart-alerts?branch_id=${branchFilter}&days_lookback=30&days_forecast=7` 
        : '/stock/smart-alerts?days_lookback=30&days_forecast=7';
      const res = await api.get(url);
      setSmartAlerts(res.data);
    } catch (err) {
      console.error('Failed to fetch smart alerts:', err);
    } finally {
      setAlertsLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.name) { toast.error('Name required'); return; }
    try {
      await api.post('/items', {
        ...newItem,
        cost_price: parseFloat(newItem.cost_price) || 0,
        unit_price: parseFloat(newItem.unit_price) || 0,
        min_stock_level: parseFloat(newItem.min_stock_level) || 0
      });
      toast.success('Item added');
      setNewItem({ name: '', cost_price: '', unit_price: '', unit: 'piece', category: '', min_stock_level: '' });
      setShowAddItem(false);
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleStockIn = async () => {
    if (!stockInData.item_id || !stockInData.branch_id || !stockInData.quantity) {
      toast.error('Select item, branch and quantity'); return;
    }
    try {
      await api.post('/stock/entries', {
        ...stockInData,
        quantity: parseFloat(stockInData.quantity),
        unit_cost: parseFloat(stockInData.unit_cost) || 0,
        supplier_id: stockInData.supplier_id || null,
        date: new Date(stockInData.date).toISOString()
      });
      toast.success('Stock added');
      setStockInData({ item_id: '', branch_id: '', quantity: '', unit_cost: '', supplier_id: '', date: new Date().toISOString().split('T')[0], notes: '' });
      setShowStockIn(false);
      fetchAll(); fetchBalance();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleScanInvoice = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setScanning(true);
    setScanResult(null);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        try {
          const res = await api.post('/stock/scan-invoice', { image: base64 });
          setScanResult(res.data);
          toast.success('Invoice scanned successfully');
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Scan failed');
        }
        setScanning(false);
      };
      reader.readAsDataURL(file);
    } catch { setScanning(false); toast.error('Failed to read file'); }
  };

  const handleImportScanned = async () => {
    if (!scanResult?.items?.length || !stockInData.branch_id) {
      toast.error('Select a branch first'); return;
    }
    try {
      await api.post('/stock/entries/bulk', {
        branch_id: stockInData.branch_id,
        supplier_id: stockInData.supplier_id || null,
        source: 'invoice_scan',
        date: new Date(stockInData.date).toISOString(),
        items: scanResult.items.map(i => ({
          item_name: i.name,
          quantity: i.quantity || 1,
          unit_cost: i.unit_cost || 0,
          unit: i.unit || 'piece'
        }))
      });
      toast.success(`${scanResult.items.length} items added to stock`);
      setScanResult(null);
      setShowScanDialog(false);
      fetchAll(); fetchBalance();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  // Barcode functions
  const handlePreviewBarcode = async (item) => {
    setSelectedBarcodeItem(item);
    setBarcodeLoading(true);
    setShowBarcodePreview(true);
    try {
      const response = await api.get(`/barcode/item/${item.id}/preview`, { responseType: 'blob' });
      const imageUrl = URL.createObjectURL(response.data);
      setBarcodeImageUrl(imageUrl);
    } catch (err) {
      toast.error('Failed to generate barcode');
      setShowBarcodePreview(false);
    } finally {
      setBarcodeLoading(false);
    }
  };

  const handleDownloadBarcode = async (itemId) => {
    try {
      const response = await api.get(`/barcode/item/${itemId}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `barcode_${itemId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Barcode downloaded');
    } catch (err) {
      toast.error('Failed to download barcode');
    }
  };

  const handlePrintBarcode = () => {
    if (!barcodeImageUrl) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head><title>Print Barcode</title></head>
        <body style="margin: 0; padding: 20px; display: flex; justify-content: center;">
          <img src="${barcodeImageUrl}" style="max-width: 100%;" />
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleBatchPrint = async () => {
    if (selectedItemsForBatch.length === 0) {
      toast.error('Select items to print barcodes');
      return;
    }
    try {
      const response = await api.post('/barcode/batch', 
        { item_ids: selectedItemsForBatch, labels_per_item: 1 },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(response.data);
      window.open(url, '_blank');
      toast.success('Batch barcodes generated');
    } catch (err) {
      toast.error('Failed to generate batch barcodes');
    }
  };

  const toggleItemSelection = (itemId) => {
    setSelectedItemsForBatch(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  const totalValue = balance.reduce((s, b) => s + (b.avg_cost * b.balance), 0);
  const lowStockCount = balance.filter(b => b.low_stock).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit mb-1" data-testid="stock-title">{t('stock_title')}</h1>
            <p className="text-sm text-muted-foreground">{t('stock_subtitle')}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={branchFilter || "all"} onValueChange={(v) => setBranchFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-40" data-testid="stock-branch-filter"><SelectValue placeholder={t('all_branches')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_branches')}</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowWhatsApp(true)} data-testid="stock-whatsapp-btn">
              <MessageCircle size={14} className="mr-1" />WhatsApp
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowScanDialog(true)} data-testid="scan-invoice-btn">
              <Camera size={14} className="mr-1" />{t('scan_invoice')}
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowStockIn(true)} data-testid="stock-in-btn">
              <TrendingUp size={14} className="mr-1" />{t('stock_in')}
            </Button>
            <Button size="sm" className="rounded-xl" onClick={() => setShowAddItem(true)} data-testid="add-item-btn">
              <Plus size={14} className="mr-1" />{t('add_item')}
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-stone-100">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{t('items')}</p>
              <p className="text-2xl font-bold font-outfit" data-testid="total-items">{balance.length}</p>
            </CardContent>
          </Card>
          <Card className="border-stone-100">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{t('stock_value')}</p>
              <p className="text-2xl font-bold font-outfit text-primary">SAR {totalValue.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="border-stone-100">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{t('min_stock')}</p>
              <p className="text-2xl font-bold font-outfit text-error" data-testid="low-stock-count">{lowStockCount}</p>
            </CardContent>
          </Card>
          <Card className="border-stone-100">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Stock Entries</p>
              <p className="text-2xl font-bold font-outfit">{entries.length}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="balance">
          <TabsList>
            <TabsTrigger value="balance">Current Stock</TabsTrigger>
            <TabsTrigger value="alerts" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
              <AlertTriangle size={14} className="mr-1" />
              Smart Alerts {smartAlerts.summary?.critical > 0 && `(${smartAlerts.summary.critical})`}
            </TabsTrigger>
            <TabsTrigger value="entries">Stock In Log ({entries.length})</TabsTrigger>
            <TabsTrigger value="usage">Usage Log ({usage.length})</TabsTrigger>
            <TabsTrigger value="items">Item Master ({items.length})</TabsTrigger>
            <TabsTrigger value="reports" data-testid="stock-reports-tab" onClick={async () => {
              try {
                const br = branchFilter || undefined;
                const [cR, pR, wR] = await Promise.all([
                  api.get('/stock/report/consumption', { params: { days: reportDays, branch_id: br } }),
                  api.get('/stock/report/profitability', { params: { branch_id: br } }),
                  api.get('/stock/report/wastage', { params: { days: reportDays, branch_id: br } }),
                ]);
                setConsumptionReport(cR.data); setProfitReport(pR.data); setWastageReport(wR.data);
              } catch { toast.error('Failed to load reports'); }
            }}>Reports</TabsTrigger>
          </TabsList>

          {/* SMART ALERTS */}
          <TabsContent value="alerts">
            <Card className="border-stone-100">
              <CardContent className="pt-4">
                {alertsLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="animate-spin mr-2" />
                    Analyzing stock velocity...
                  </div>
                ) : (
                  <>
                    {/* Alert Summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      <div className="p-3 bg-red-50 rounded-xl text-center border border-red-200">
                        <p className="text-xs text-red-600">Critical</p>
                        <p className="text-2xl font-bold text-red-600">{smartAlerts.summary?.critical || 0}</p>
                      </div>
                      <div className="p-3 bg-amber-50 rounded-xl text-center border border-amber-200">
                        <p className="text-xs text-amber-600">Warning</p>
                        <p className="text-2xl font-bold text-amber-600">{smartAlerts.summary?.warning || 0}</p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-xl text-center border border-blue-200">
                        <p className="text-xs text-blue-600">Info</p>
                        <p className="text-2xl font-bold text-blue-600">{smartAlerts.summary?.info || 0}</p>
                      </div>
                      <div className="p-3 bg-stone-50 rounded-xl text-center border border-stone-200">
                        <p className="text-xs text-stone-600">Total Alerts</p>
                        <p className="text-2xl font-bold text-stone-700">{smartAlerts.summary?.total_alerts || 0}</p>
                      </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground mb-3">
                      Based on {smartAlerts.summary?.lookback_days || 30} days consumption, forecasting {smartAlerts.summary?.forecast_days || 7} days ahead
                    </p>

                    {/* Alert List */}
                    <div className="space-y-2">
                      {smartAlerts.alerts?.map(alert => (
                        <div 
                          key={alert.item_id} 
                          className={`p-3 rounded-xl border ${
                            alert.alert_level === 'critical' ? 'bg-red-50/70 border-red-300' :
                            alert.alert_level === 'warning' ? 'bg-amber-50/70 border-amber-300' :
                            'bg-blue-50/70 border-blue-300'
                          }`}
                          data-testid={`alert-${alert.item_id}`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-semibold text-sm">{alert.item_name}</p>
                              <p className="text-xs text-muted-foreground">{alert.category} • {alert.unit}</p>
                            </div>
                            <Badge 
                              variant={alert.alert_level === 'critical' ? 'destructive' : alert.alert_level === 'warning' ? 'warning' : 'secondary'}
                              className={`text-xs ${
                                alert.alert_level === 'critical' ? 'bg-red-500' :
                                alert.alert_level === 'warning' ? 'bg-amber-500 text-white' :
                                'bg-blue-500 text-white'
                              }`}
                            >
                              {alert.alert_level.toUpperCase()}
                            </Badge>
                          </div>
                          
                          <p className={`text-xs font-medium mb-2 ${
                            alert.alert_level === 'critical' ? 'text-red-700' :
                            alert.alert_level === 'warning' ? 'text-amber-700' :
                            'text-blue-700'
                          }`}>
                            {alert.alert_reason}
                          </p>
                          
                          <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                            <div className="p-1.5 bg-white/70 rounded border">
                              <p className="text-muted-foreground">Current</p>
                              <p className="font-bold">{alert.current_balance}</p>
                            </div>
                            <div className="p-1.5 bg-white/70 rounded border">
                              <p className="text-muted-foreground">Daily Avg</p>
                              <p className="font-bold">{alert.avg_daily_usage}</p>
                            </div>
                            <div className="p-1.5 bg-white/70 rounded border">
                              <p className="text-muted-foreground">Days Left</p>
                              <p className="font-bold">{alert.days_until_stockout || '∞'}</p>
                            </div>
                            <div className="p-1.5 bg-emerald-50 rounded border border-emerald-200">
                              <p className="text-muted-foreground">Suggest Order</p>
                              <p className="font-bold text-emerald-600">{alert.suggested_order_qty}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {smartAlerts.alerts?.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <Package size={48} className="mx-auto mb-2 opacity-30" />
                          <p>No stock alerts - all items are well stocked!</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CURRENT STOCK BALANCE */}
          <TabsContent value="balance">
            <Card className="border-stone-100">
              <CardContent className="pt-4">
                {/* Mobile card view */}
                <div className="sm:hidden space-y-2">
                  {balance.map(b => (
                    <div key={b.item_id} className={`p-3 border rounded-xl ${b.low_stock ? 'bg-red-50/50 border-red-200' : 'bg-white'}`} data-testid={`stock-card-${b.item_id}`}>
                      <div className="flex justify-between items-start mb-1.5">
                        <div>
                          <p className="text-sm font-bold">{b.item_name}</p>
                          <span className="text-[10px] text-muted-foreground capitalize">{b.unit}</span>
                        </div>
                        {b.low_stock ? <Badge className="bg-red-100 text-red-600 text-[10px]">Low Stock</Badge> : <Badge className="bg-emerald-100 text-emerald-600 text-[10px]">OK</Badge>}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                        <div className="p-1 bg-emerald-50 rounded"><p className="text-muted-foreground">In</p><p className="font-bold text-emerald-600">{b.stock_in}</p></div>
                        <div className="p-1 bg-red-50 rounded"><p className="text-muted-foreground">Used</p><p className="font-bold text-red-600">{b.stock_used}</p></div>
                        <div className="p-1 bg-stone-50 rounded"><p className="text-muted-foreground">Bal</p><p className="font-bold">{b.balance}</p></div>
                        <div className="p-1 bg-blue-50 rounded"><p className="text-muted-foreground">Value</p><p className="font-bold text-blue-600">SAR {(b.avg_cost * b.balance).toFixed(0)}</p></div>
                      </div>
                    </div>
                  ))}
                  {balance.length === 0 && <p className="text-center text-muted-foreground py-8">No stock data yet</p>}
                </div>
                {/* Desktop table */}
                <div className="hidden sm:block">
                <VirtualizedTable
                  data={balance}
                  maxHeight={550}
                  rowHeight={48}
                  emptyMessage="No stock data yet. Add items and stock entries to get started."
                  columns={[
                    {
                      key: 'item_name', header: 'Item', width: '20%',
                      render: (val) => <span className="text-sm font-medium">{val}</span>
                    },
                    {
                      key: 'unit', header: 'Unit', width: '8%',
                      render: (val) => <span className="text-sm capitalize">{val}</span>
                    },
                    {
                      key: 'stock_in', header: 'Stock In', width: '10%', align: 'right',
                      render: (val) => <span className="text-sm text-success">{val}</span>
                    },
                    {
                      key: 'stock_used', header: 'Used', width: '10%', align: 'right',
                      render: (val) => <span className="text-sm text-error">{val}</span>
                    },
                    {
                      key: 'balance', header: 'Balance', width: '10%', align: 'right',
                      render: (val) => <span className="text-sm font-bold">{val}</span>
                    },
                    {
                      key: 'avg_cost', header: 'Avg Cost', width: '12%', align: 'right',
                      render: (val) => <span className="text-sm">SAR {val}</span>
                    },
                    {
                      key: 'avg_cost', header: 'Value', width: '15%', align: 'right',
                      render: (val, row) => <span className="text-sm font-medium">SAR {(val * row.balance).toFixed(2)}</span>
                    },
                    {
                      key: 'low_stock', header: 'Status', width: '12%', align: 'center',
                      render: (val) => val 
                        ? <Badge className="bg-error/20 text-error text-[10px]">Low Stock</Badge> 
                        : <Badge className="bg-success/20 text-success text-[10px]">OK</Badge>
                    },
                  ]}
                  data-testid="stock-balance-table"
                />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* STOCK IN LOG */}
          <TabsContent value="entries">
            <Card className="border-stone-100">
              <CardContent className="pt-4">
                <table className="w-full">
                  <thead><tr className="border-b">
                    <th className="text-left p-3 text-sm font-medium">Date</th>
                    <th className="text-left p-3 text-sm font-medium">Item</th>
                    <th className="text-left p-3 text-sm font-medium">Branch</th>
                    <th className="text-right p-3 text-sm font-medium">Qty</th>
                    <th className="text-right p-3 text-sm font-medium">Unit Cost</th>
                    <th className="text-right p-3 text-sm font-medium">Total</th>
                    <th className="text-left p-3 text-sm font-medium">Source</th>
                  </tr></thead>
                  <tbody>
                    {entries.map(e => (
                      <tr key={e.id} className="border-b hover:bg-stone-50">
                        <td className="p-3 text-sm">{format(new Date(e.date), 'MMM dd, yyyy')}</td>
                        <td className="p-3 text-sm font-medium">{e.item_name}</td>
                        <td className="p-3 text-sm">{branches.find(b => b.id === e.branch_id)?.name || '-'}</td>
                        <td className="p-3 text-sm text-right">{e.quantity}</td>
                        <td className="p-3 text-sm text-right">SAR {e.unit_cost?.toFixed(2)}</td>
                        <td className="p-3 text-sm text-right font-medium">SAR {(e.quantity * (e.unit_cost || 0)).toFixed(2)}</td>
                        <td className="p-3"><Badge variant="outline" className="capitalize">{e.source}</Badge></td>
                      </tr>
                    ))}
                    {entries.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No stock entries yet</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* USAGE LOG */}
          <TabsContent value="usage">
            <Card className="border-stone-100">
              <CardContent className="pt-4">
                <table className="w-full">
                  <thead><tr className="border-b">
                    <th className="text-left p-3 text-sm font-medium">Date</th>
                    <th className="text-left p-3 text-sm font-medium">Item</th>
                    <th className="text-left p-3 text-sm font-medium">Branch</th>
                    <th className="text-right p-3 text-sm font-medium">Qty Used</th>
                    <th className="text-left p-3 text-sm font-medium">Used By</th>
                    <th className="text-left p-3 text-sm font-medium">Notes</th>
                  </tr></thead>
                  <tbody>
                    {usage.map(u => (
                      <tr key={u.id} className="border-b hover:bg-stone-50">
                        <td className="p-3 text-sm">{format(new Date(u.date), 'MMM dd, yyyy')}</td>
                        <td className="p-3 text-sm font-medium">{u.item_name}</td>
                        <td className="p-3 text-sm">{branches.find(b => b.id === u.branch_id)?.name || '-'}</td>
                        <td className="p-3 text-sm text-right font-bold text-error">{u.quantity}</td>
                        <td className="p-3 text-sm">{u.used_by}</td>
                        <td className="p-3 text-sm text-muted-foreground">{u.notes || '-'}</td>
                      </tr>
                    ))}
                    {usage.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No usage recorded yet</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ITEM MASTER */}
          <TabsContent value="items">
            <Card className="border-stone-100">
              <CardContent className="pt-4">
                {/* Batch barcode actions */}
                {selectedItemsForBatch.length > 0 && (
                  <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
                    <span className="text-sm font-medium text-blue-700">{selectedItemsForBatch.length} items selected</span>
                    <Button size="sm" variant="outline" className="ml-auto rounded-xl" onClick={handleBatchPrint} data-testid="batch-print-btn">
                      <Printer size={14} className="mr-1" />Print Batch Labels
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedItemsForBatch([])}>Clear</Button>
                  </div>
                )}
                <table className="w-full" data-testid="items-table">
                  <thead><tr className="border-b">
                    <th className="p-3 w-10">
                      <input 
                        type="checkbox" 
                        className="rounded border-stone-300"
                        checked={selectedItemsForBatch.length === items.length && items.length > 0}
                        onChange={(e) => setSelectedItemsForBatch(e.target.checked ? items.map(i => i.id) : [])}
                      />
                    </th>
                    <th className="text-left p-3 text-sm font-medium">Name</th>
                    <th className="text-left p-3 text-sm font-medium">Category</th>
                    <th className="text-left p-3 text-sm font-medium">Unit</th>
                    <th className="text-right p-3 text-sm font-medium">Cost Price</th>
                    <th className="text-right p-3 text-sm font-medium">Sale Price</th>
                    <th className="text-right p-3 text-sm font-medium">Min Level</th>
                    <th className="text-center p-3 text-sm font-medium">Barcode</th>
                  </tr></thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id} className={`border-b hover:bg-stone-50 ${selectedItemsForBatch.includes(item.id) ? 'bg-blue-50/50' : ''}`}>
                        <td className="p-3">
                          <input 
                            type="checkbox" 
                            className="rounded border-stone-300"
                            checked={selectedItemsForBatch.includes(item.id)}
                            onChange={() => toggleItemSelection(item.id)}
                          />
                        </td>
                        <td className="p-3 text-sm font-medium">{item.name}</td>
                        <td className="p-3 text-sm">{item.category || '-'}</td>
                        <td className="p-3 text-sm capitalize">{item.unit || 'piece'}</td>
                        <td className="p-3 text-sm text-right">SAR {(item.cost_price || 0).toFixed(2)}</td>
                        <td className="p-3 text-sm text-right">SAR {(item.unit_price || 0).toFixed(2)}</td>
                        <td className="p-3 text-sm text-right">{item.min_stock_level || 0}</td>
                        <td className="p-3 text-center">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 w-8 p-0"
                            onClick={() => handlePreviewBarcode(item)}
                            data-testid={`barcode-btn-${item.id}`}
                          >
                            <Barcode size={16} className="text-orange-500" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No items yet</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* REPORTS */}
          <TabsContent value="reports">
            <div className="space-y-4" data-testid="stock-reports">
              {/* Summary Cards */}
              {profitReport && (
                <div className="grid grid-cols-4 gap-3">
                  <Card className="border-stone-100"><CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground">Total Consumption Cost</p>
                    <p className="text-lg font-bold font-outfit text-red-600">SAR {consumptionReport?.total_consumption_cost?.toLocaleString() || 0}</p>
                    <p className="text-[10px] text-muted-foreground">Last {reportDays} days</p>
                  </CardContent></Card>
                  <Card className="border-stone-100"><CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground">Potential Revenue</p>
                    <p className="text-lg font-bold font-outfit text-emerald-600">SAR {profitReport?.total_consumed_revenue?.toLocaleString() || 0}</p>
                  </CardContent></Card>
                  <Card className="border-stone-100"><CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground">Gross Profit</p>
                    <p className="text-lg font-bold font-outfit text-blue-600">SAR {profitReport?.total_profit?.toLocaleString() || 0}</p>
                    <p className="text-[10px] text-muted-foreground">Avg Margin: {profitReport?.avg_margin_pct || 0}%</p>
                  </CardContent></Card>
                  <Card className="border-stone-100"><CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground">Wastage Loss</p>
                    <p className="text-lg font-bold font-outfit text-amber-600">SAR {wastageReport?.total_waste_cost?.toLocaleString() || 0}</p>
                    <p className="text-[10px] text-muted-foreground">{wastageReport?.total_waste_entries || 0} entries</p>
                  </CardContent></Card>
                </div>
              )}

              {/* Consumption Chart */}
              {consumptionReport?.daily_trend?.length > 0 && (
                <Card className="border-stone-100">
                  <CardHeader className="py-3"><CardTitle className="text-sm font-outfit">Daily Consumption Trend</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={consumptionReport.daily_trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="total" fill="#f97316" radius={[4, 4, 0, 0]} name="Units Used" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Profitability Table */}
              {profitReport?.items?.length > 0 && (
                <Card className="border-stone-100">
                  <CardHeader className="py-3"><CardTitle className="text-sm font-outfit">Item Profitability</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" data-testid="profitability-table">
                        <thead><tr className="bg-stone-50 border-y border-stone-100">
                          <th className="text-left p-2 font-medium text-xs">Item</th>
                          <th className="text-right p-2 font-medium text-xs">Avg Cost</th>
                          <th className="text-right p-2 font-medium text-xs">Sale Price</th>
                          <th className="text-right p-2 font-medium text-xs">Margin %</th>
                          <th className="text-right p-2 font-medium text-xs">Consumed</th>
                          <th className="text-right p-2 font-medium text-xs">Cost</th>
                          <th className="text-right p-2 font-medium text-xs">Revenue</th>
                          <th className="text-right p-2 font-medium text-xs">Profit</th>
                        </tr></thead>
                        <tbody>
                          {profitReport.items.map((item, i) => (
                            <tr key={i} className="border-b border-stone-50 hover:bg-stone-50/50">
                              <td className="p-2 font-medium">{item.item_name} <span className="text-xs text-stone-400">{item.unit}</span></td>
                              <td className="p-2 text-right font-mono text-xs">{item.avg_cost?.toFixed(2)}</td>
                              <td className="p-2 text-right font-mono text-xs">{item.sale_price?.toFixed(2)}</td>
                              <td className="p-2 text-right"><Badge variant="outline" className={`text-[10px] ${item.margin_pct > 30 ? 'border-emerald-300 text-emerald-600' : item.margin_pct > 0 ? 'border-amber-300 text-amber-600' : 'border-red-300 text-red-600'}`}>{item.margin_pct}%</Badge></td>
                              <td className="p-2 text-right font-mono text-xs">{item.qty_consumed}</td>
                              <td className="p-2 text-right font-mono text-xs text-red-600">{item.consumed_cost?.toLocaleString()}</td>
                              <td className="p-2 text-right font-mono text-xs text-emerald-600">{item.consumed_revenue?.toLocaleString()}</td>
                              <td className={`p-2 text-right font-mono text-xs font-medium ${item.consumed_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{item.consumed_profit?.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Consumption Table */}
              {consumptionReport?.items?.length > 0 && (
                <Card className="border-stone-100">
                  <CardHeader className="py-3"><CardTitle className="text-sm font-outfit">Consumption Analysis (Last {reportDays} days)</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" data-testid="consumption-table">
                        <thead><tr className="bg-stone-50 border-y border-stone-100">
                          <th className="text-left p-2 font-medium text-xs">Item</th>
                          <th className="text-right p-2 font-medium text-xs">Total Used</th>
                          <th className="text-right p-2 font-medium text-xs">Daily Avg</th>
                          <th className="text-right p-2 font-medium text-xs">Active Days</th>
                          <th className="text-right p-2 font-medium text-xs">Cost/Unit</th>
                          <th className="text-right p-2 font-medium text-xs">Total Cost</th>
                        </tr></thead>
                        <tbody>
                          {consumptionReport.items.map((item, i) => (
                            <tr key={i} className="border-b border-stone-50 hover:bg-stone-50/50">
                              <td className="p-2 font-medium">{item.item_name} <span className="text-xs text-stone-400">{item.unit}</span></td>
                              <td className="p-2 text-right font-mono text-xs">{item.total_used}</td>
                              <td className="p-2 text-right font-mono text-xs">{item.daily_avg}</td>
                              <td className="p-2 text-right text-xs">{item.active_days}</td>
                              <td className="p-2 text-right font-mono text-xs">{item.cost_per_unit?.toFixed(2)}</td>
                              <td className="p-2 text-right font-mono text-xs font-medium">{item.total_cost?.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Wastage Table */}
              {wastageReport?.items?.length > 0 && (
                <Card className="border-stone-100">
                  <CardHeader className="py-3"><CardTitle className="text-sm font-outfit">Wastage Report</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" data-testid="wastage-table">
                        <thead><tr className="bg-stone-50 border-y border-stone-100">
                          <th className="text-left p-2 font-medium text-xs">Item</th>
                          <th className="text-right p-2 font-medium text-xs">Wasted</th>
                          <th className="text-right p-2 font-medium text-xs">Normal Use</th>
                          <th className="text-right p-2 font-medium text-xs">Waste %</th>
                          <th className="text-right p-2 font-medium text-xs">Waste Cost</th>
                        </tr></thead>
                        <tbody>
                          {wastageReport.items.map((item, i) => (
                            <tr key={i} className="border-b border-stone-50 hover:bg-stone-50/50">
                              <td className="p-2 font-medium">{item.item_name}</td>
                              <td className="p-2 text-right font-mono text-xs text-red-600">{item.waste_qty} {item.unit}</td>
                              <td className="p-2 text-right font-mono text-xs">{item.normal_qty} {item.unit}</td>
                              <td className="p-2 text-right"><Badge variant="outline" className={`text-[10px] ${item.waste_pct > 10 ? 'border-red-300 text-red-600' : 'border-amber-300 text-amber-600'}`}>{item.waste_pct}%</Badge></td>
                              <td className="p-2 text-right font-mono text-xs font-medium text-red-600">SAR {item.waste_cost?.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!consumptionReport && !profitReport && (
                <Card className="border-border border-dashed">
                  <CardContent className="py-12 text-center">
                    <BarChart3 size={36} className="mx-auto text-stone-300 mb-2" />
                    <p className="text-muted-foreground">Click the Reports tab to load stock analytics</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

        </Tabs>

        {/* ADD ITEM DIALOG */}
        <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
          <DialogContent data-testid="add-item-dialog">
            <DialogHeader><DialogTitle className="font-outfit">Add New Item</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Item Name *</Label><Input value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="e.g. Chicken Breast" data-testid="item-name-input" /></div>
                <div><Label>Category</Label><Input value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} placeholder="e.g. Meat" /></div>
                <div><Label>Cost Price (SAR)</Label><Input type="number" step="0.01" value={newItem.cost_price} onChange={(e) => setNewItem({ ...newItem, cost_price: e.target.value })} placeholder="0.00" /></div>
                <div><Label>Sale Price (SAR)</Label><Input type="number" step="0.01" value={newItem.unit_price} onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })} placeholder="0.00" /></div>
                <div><Label>Unit</Label>
                  <Select value={newItem.unit} onValueChange={(v) => setNewItem({ ...newItem, unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="piece">Piece</SelectItem>
                      <SelectItem value="kg">Kg</SelectItem>
                      <SelectItem value="gram">Gram</SelectItem>
                      <SelectItem value="liter">Liter</SelectItem>
                      <SelectItem value="box">Box</SelectItem>
                      <SelectItem value="pack">Pack</SelectItem>
                      <SelectItem value="bag">Bag</SelectItem>
                      <SelectItem value="bottle">Bottle</SelectItem>
                      <SelectItem value="can">Can</SelectItem>
                      <SelectItem value="carton">Carton</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Min Stock Level</Label><Input type="number" value={newItem.min_stock_level} onChange={(e) => setNewItem({ ...newItem, min_stock_level: e.target.value })} placeholder="0" /></div>
              </div>
              <Button className="rounded-xl w-full" onClick={handleAddItem} data-testid="save-item-btn">Save Item</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* STOCK IN DIALOG */}
        <Dialog open={showStockIn} onOpenChange={setShowStockIn}>
          <DialogContent data-testid="stock-in-dialog">
            <DialogHeader><DialogTitle className="font-outfit">Add Stock</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Item *</Label>
                  <Select value={stockInData.item_id || "none"} onValueChange={(v) => setStockInData({ ...stockInData, item_id: v === "none" ? "" : v })}>
                    <SelectTrigger data-testid="stock-item-select"><SelectValue placeholder="Select item" /></SelectTrigger>
                    <SelectContent>{items.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Branch *</Label>
                  <Select value={stockInData.branch_id || "none"} onValueChange={(v) => setStockInData({ ...stockInData, branch_id: v === "none" ? "" : v })}>
                    <SelectTrigger data-testid="stock-branch-select"><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Quantity *</Label><Input type="number" step="0.01" value={stockInData.quantity} onChange={(e) => setStockInData({ ...stockInData, quantity: e.target.value })} placeholder="0" data-testid="stock-qty-input" /></div>
                <div><Label>Unit Cost (SAR)</Label><Input type="number" step="0.01" value={stockInData.unit_cost} onChange={(e) => setStockInData({ ...stockInData, unit_cost: e.target.value })} placeholder="0.00" /></div>
                <div><Label>Supplier</Label>
                  <Select value={stockInData.supplier_id || "none"} onValueChange={(v) => setStockInData({ ...stockInData, supplier_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">No Supplier</SelectItem>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Date</Label><Input type="date" value={stockInData.date} onChange={(e) => setStockInData({ ...stockInData, date: e.target.value })} /></div>
              </div>
              <div><Label>Notes</Label><Input value={stockInData.notes} onChange={(e) => setStockInData({ ...stockInData, notes: e.target.value })} placeholder="Optional" /></div>
              <Button className="rounded-xl w-full" onClick={handleStockIn} data-testid="save-stock-btn">Add Stock</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* SCAN INVOICE DIALOG */}
        <Dialog open={showScanDialog} onOpenChange={setShowScanDialog}>
          <DialogContent className="max-w-2xl" data-testid="scan-dialog">
            <DialogHeader><DialogTitle className="font-outfit">Scan Supplier Invoice</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Take a photo or upload an image of the supplier invoice. AI will extract all items automatically.</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Branch *</Label>
                  <Select value={stockInData.branch_id || "none"} onValueChange={(v) => setStockInData({ ...stockInData, branch_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Supplier</Label>
                  <Select value={stockInData.supplier_id || "none"} onValueChange={(v) => setStockInData({ ...stockInData, supplier_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">No Supplier</SelectItem>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-2 border-dashed border-stone-300 rounded-xl p-6 text-center">
                <input type="file" accept="image/*" capture="environment" onChange={handleScanInvoice} className="hidden" id="invoice-upload" data-testid="invoice-file-input" />
                <label htmlFor="invoice-upload" className="cursor-pointer">
                  {scanning ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 size={32} className="animate-spin text-primary" />
                      <p className="text-sm font-medium">Scanning invoice...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Camera size={32} className="text-muted-foreground" />
                      <p className="text-sm font-medium">Tap to take photo or upload invoice image</p>
                      <p className="text-xs text-muted-foreground">Supports JPG, PNG, WEBP</p>
                    </div>
                  )}
                </label>
              </div>

              {scanResult && (
                <div className="space-y-3">
                  {scanResult.supplier_name && <p className="text-sm"><strong>Supplier:</strong> {scanResult.supplier_name}</p>}
                  {scanResult.invoice_number && <p className="text-sm"><strong>Invoice #:</strong> {scanResult.invoice_number}</p>}
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-stone-50 border-b">
                        <th className="text-left p-2">Item</th>
                        <th className="text-right p-2">Qty</th>
                        <th className="text-left p-2">Unit</th>
                        <th className="text-right p-2">Cost</th>
                        <th className="text-right p-2">Total</th>
                      </tr></thead>
                      <tbody>
                        {scanResult.items?.map((item, i) => (
                          <tr key={i} className="border-b">
                            <td className="p-2">{item.name}</td>
                            <td className="p-2 text-right">{item.quantity}</td>
                            <td className="p-2">{item.unit || 'piece'}</td>
                            <td className="p-2 text-right">SAR {(item.unit_cost || 0).toFixed(2)}</td>
                            <td className="p-2 text-right font-medium">SAR {(item.total || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {scanResult.total && <p className="text-right font-bold">Total: SAR {scanResult.total.toFixed(2)}</p>}
                  <Button className="rounded-xl w-full" onClick={handleImportScanned} data-testid="import-scanned-btn">
                    <Package size={14} className="mr-2" />Import {scanResult.items?.length || 0} Items to Stock
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
        <WhatsAppSendDialog open={showWhatsApp} onClose={() => setShowWhatsApp(false)} defaultType="low_stock" branches={branches} branchId={branchFilter} />

        {/* BARCODE PREVIEW DIALOG */}
        <Dialog open={showBarcodePreview} onOpenChange={(open) => {
          setShowBarcodePreview(open);
          if (!open) {
            setBarcodeImageUrl('');
            setSelectedBarcodeItem(null);
          }
        }}>
          <DialogContent className="max-w-md" data-testid="barcode-preview-dialog">
            <DialogHeader>
              <DialogTitle className="font-outfit">Barcode Label</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {barcodeLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={32} className="animate-spin text-primary" />
                </div>
              ) : barcodeImageUrl ? (
                <>
                  <div className="border rounded-xl p-4 bg-white">
                    <img 
                      src={barcodeImageUrl} 
                      alt={`Barcode for ${selectedBarcodeItem?.name}`} 
                      className="w-full"
                      data-testid="barcode-image"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground text-center">
                    <p className="font-medium">{selectedBarcodeItem?.name}</p>
                    <p>SAR {(selectedBarcodeItem?.unit_price || 0).toFixed(2)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      className="flex-1 rounded-xl" 
                      variant="outline"
                      onClick={handlePrintBarcode}
                      data-testid="print-barcode-btn"
                    >
                      <Printer size={14} className="mr-1" />Print
                    </Button>
                    <Button 
                      className="flex-1 rounded-xl"
                      onClick={() => handleDownloadBarcode(selectedBarcodeItem?.id)}
                      data-testid="download-barcode-btn"
                    >
                      <Download size={14} className="mr-1" />Download
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Failed to load barcode preview</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
