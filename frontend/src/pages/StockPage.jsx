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
import { Plus, Package, TrendingDown, TrendingUp, AlertTriangle, Camera, Loader2, MessageCircle } from 'lucide-react';
import { WhatsAppSendDialog } from '@/components/WhatsAppSendDialog';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function StockPage() {
  const [items, setItems] = useState([]);
  const [branches, setBranches] = useState([]);
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

  const [newItem, setNewItem] = useState({ name: '', cost_price: '', unit_price: '', unit: 'piece', category: '', min_stock_level: '' });
  const [stockInData, setStockInData] = useState({ item_id: '', branch_id: '', quantity: '', unit_cost: '', supplier_id: '', date: new Date().toISOString().split('T')[0], notes: '' });

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { fetchBalance(); }, [branchFilter]);

  const fetchAll = async () => {
    try {
      const [iR, bR, sR, eR, uR] = await Promise.all([
        api.get('/items'), api.get('/branches'), api.get('/suppliers'),
        api.get('/stock/entries'), api.get('/stock/usage')
      ]);
      setItems(iR.data); setBranches(bR.data); setSuppliers(sR.data);
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

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading...</div></DashboardLayout>;

  const totalValue = balance.reduce((s, b) => s + (b.avg_cost * b.balance), 0);
  const lowStockCount = balance.filter(b => b.low_stock).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="stock-title">Stock Management</h1>
            <p className="text-muted-foreground">Track inventory, stock in/out, and item usage</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={branchFilter || "all"} onValueChange={(v) => setBranchFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-40" data-testid="stock-branch-filter"><SelectValue placeholder="All Branches" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowWhatsApp(true)} data-testid="stock-whatsapp-btn">
              <MessageCircle size={14} className="mr-1" />WhatsApp
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowScanDialog(true)} data-testid="scan-invoice-btn">
              <Camera size={14} className="mr-1" />Scan Invoice
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowStockIn(true)} data-testid="stock-in-btn">
              <TrendingUp size={14} className="mr-1" />Stock In
            </Button>
            <Button size="sm" className="rounded-xl" onClick={() => setShowAddItem(true)} data-testid="add-item-btn">
              <Plus size={14} className="mr-1" />New Item
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-stone-100">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Total Items</p>
              <p className="text-2xl font-bold font-outfit" data-testid="total-items">{balance.length}</p>
            </CardContent>
          </Card>
          <Card className="border-stone-100">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Stock Value</p>
              <p className="text-2xl font-bold font-outfit text-primary">SAR {totalValue.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="border-stone-100">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Low Stock</p>
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
            <TabsTrigger value="entries">Stock In Log ({entries.length})</TabsTrigger>
            <TabsTrigger value="usage">Usage Log ({usage.length})</TabsTrigger>
            <TabsTrigger value="items">Item Master ({items.length})</TabsTrigger>
          </TabsList>

          {/* CURRENT STOCK BALANCE */}
          <TabsContent value="balance">
            <Card className="border-stone-100">
              <CardContent className="pt-4">
                <table className="w-full" data-testid="stock-balance-table">
                  <thead><tr className="border-b">
                    <th className="text-left p-3 text-sm font-medium">Item</th>
                    <th className="text-left p-3 text-sm font-medium">Unit</th>
                    <th className="text-right p-3 text-sm font-medium">Stock In</th>
                    <th className="text-right p-3 text-sm font-medium">Used</th>
                    <th className="text-right p-3 text-sm font-medium">Balance</th>
                    <th className="text-right p-3 text-sm font-medium">Avg Cost</th>
                    <th className="text-right p-3 text-sm font-medium">Value</th>
                    <th className="text-center p-3 text-sm font-medium">Status</th>
                  </tr></thead>
                  <tbody>
                    {balance.map(b => (
                      <tr key={b.item_id} className={`border-b hover:bg-stone-50 ${b.low_stock ? 'bg-error/5' : ''}`} data-testid={`stock-row-${b.item_id}`}>
                        <td className="p-3 text-sm font-medium">{b.item_name}</td>
                        <td className="p-3 text-sm capitalize">{b.unit}</td>
                        <td className="p-3 text-sm text-right text-success">{b.stock_in}</td>
                        <td className="p-3 text-sm text-right text-error">{b.stock_used}</td>
                        <td className="p-3 text-sm text-right font-bold">{b.balance}</td>
                        <td className="p-3 text-sm text-right">SAR {b.avg_cost}</td>
                        <td className="p-3 text-sm text-right font-medium">SAR {(b.avg_cost * b.balance).toFixed(2)}</td>
                        <td className="p-3 text-center">
                          {b.low_stock ? <Badge className="bg-error/20 text-error">Low Stock</Badge> : <Badge className="bg-success/20 text-success">OK</Badge>}
                        </td>
                      </tr>
                    ))}
                    {balance.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No stock data yet. Add items and stock entries to get started.</td></tr>}
                  </tbody>
                </table>
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
                <table className="w-full">
                  <thead><tr className="border-b">
                    <th className="text-left p-3 text-sm font-medium">Name</th>
                    <th className="text-left p-3 text-sm font-medium">Category</th>
                    <th className="text-left p-3 text-sm font-medium">Unit</th>
                    <th className="text-right p-3 text-sm font-medium">Cost Price</th>
                    <th className="text-right p-3 text-sm font-medium">Sale Price</th>
                    <th className="text-right p-3 text-sm font-medium">Min Level</th>
                  </tr></thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id} className="border-b hover:bg-stone-50">
                        <td className="p-3 text-sm font-medium">{item.name}</td>
                        <td className="p-3 text-sm">{item.category || '-'}</td>
                        <td className="p-3 text-sm capitalize">{item.unit || 'piece'}</td>
                        <td className="p-3 text-sm text-right">SAR {(item.cost_price || 0).toFixed(2)}</td>
                        <td className="p-3 text-sm text-right">SAR {(item.unit_price || 0).toFixed(2)}</td>
                        <td className="p-3 text-sm text-right">{item.min_stock_level || 0}</td>
                      </tr>
                    ))}
                    {items.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No items yet</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>
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
      </div>
    </DashboardLayout>
  );
}
