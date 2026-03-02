import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Package, Plus, Trash2, Edit2, DollarSign, TrendingDown, AlertTriangle,
  Wrench, Car, Building2, Sofa, Monitor, ChefHat, Box, FileText, Calendar,
  RefreshCw, Download, Upload, Clock, Shield, Loader2, BarChart3, Wallet,
  CreditCard, Receipt, Users, AlertCircle, CheckCircle2
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '@/lib/api';
import { format } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';

const ASSET_TYPES = [
  { id: 'equipment', name: 'Equipment', icon: Wrench, color: '#f97316' },
  { id: 'vehicle', name: 'Vehicle', icon: Car, color: '#3b82f6' },
  { id: 'property', name: 'Property', icon: Building2, color: '#22c55e' },
  { id: 'furniture', name: 'Furniture', icon: Sofa, color: '#a855f7' },
  { id: 'electronics', name: 'Electronics', icon: Monitor, color: '#ec4899' },
  { id: 'kitchen', name: 'Kitchen', icon: ChefHat, color: '#14b8a6' },
  { id: 'other', name: 'Other', icon: Box, color: '#6b7280' },
];

const STATUS_COLORS = {
  active: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  maintenance: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  disposed: { bg: 'bg-stone-100', text: 'text-stone-700', dot: 'bg-stone-500' },
  sold: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
};

const PIE_COLORS = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#ec4899', '#14b8a6', '#6b7280'];

export default function AssetsPage() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState([]);
  const [stats, setStats] = useState(null);
  const [liabilities, setLiabilities] = useState(null);
  const [branches, setBranches] = useState([]);
  
  const [activeTab, setActiveTab] = useState('assets');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [showMaintenanceLog, setShowMaintenanceLog] = useState(null);
  const [maintenanceLogs, setMaintenanceLogs] = useState([]);
  
  const [assetForm, setAssetForm] = useState({
    name: '', asset_type: 'equipment', description: '', purchase_date: '',
    purchase_price: '', current_value: '', depreciation_rate: '',
    serial_number: '', location: '', branch_id: '', status: 'active',
    warranty_expiry: '', notes: ''
  });
  
  const [maintenanceForm, setMaintenanceForm] = useState({
    type: 'maintenance', description: '', cost: '', performed_by: '', notes: ''
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [assetsRes, statsRes, liabRes, branchRes] = await Promise.all([
        api.get('/assets'),
        api.get('/assets/stats'),
        api.get('/liabilities/summary'),
        api.get('/branches'),
      ]);
      setAssets(assetsRes.data);
      setStats(statsRes.data);
      setLiabilities(liabRes.data);
      setBranches(branchRes.data);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredAssets = assets.filter(a => {
    if (filterType !== 'all' && a.asset_type !== filterType) return false;
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    return true;
  });

  const handleSaveAsset = async () => {
    if (!assetForm.name) { toast.error('Asset name is required'); return; }
    try {
      const data = {
        ...assetForm,
        purchase_price: parseFloat(assetForm.purchase_price) || 0,
        current_value: parseFloat(assetForm.current_value) || 0,
        depreciation_rate: parseFloat(assetForm.depreciation_rate) || 0,
      };
      
      if (editingAsset) {
        await api.put(`/assets/${editingAsset.id}`, data);
        toast.success('Asset updated');
      } else {
        await api.post('/assets', data);
        toast.success('Asset created');
      }
      setShowAddAsset(false);
      setEditingAsset(null);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save asset');
    }
  };

  const handleDeleteAsset = async (asset) => {
    if (!confirm(`Delete asset "${asset.name}"?`)) return;
    try {
      await api.delete(`/assets/${asset.id}`);
      toast.success('Asset deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete asset');
    }
  };

  const openEditAsset = (asset) => {
    setEditingAsset(asset);
    setAssetForm({
      name: asset.name || '',
      asset_type: asset.asset_type || 'equipment',
      description: asset.description || '',
      purchase_date: asset.purchase_date?.split('T')[0] || '',
      purchase_price: asset.purchase_price?.toString() || '',
      current_value: asset.current_value?.toString() || '',
      depreciation_rate: asset.depreciation_rate?.toString() || '',
      serial_number: asset.serial_number || '',
      location: asset.location || '',
      branch_id: asset.branch_id || '',
      status: asset.status || 'active',
      warranty_expiry: asset.warranty_expiry?.split('T')[0] || '',
      notes: asset.notes || '',
    });
    setShowAddAsset(true);
  };

  const resetForm = () => {
    setAssetForm({
      name: '', asset_type: 'equipment', description: '', purchase_date: '',
      purchase_price: '', current_value: '', depreciation_rate: '',
      serial_number: '', location: '', branch_id: '', status: 'active',
      warranty_expiry: '', notes: ''
    });
  };

  const openMaintenanceLog = async (asset) => {
    setShowMaintenanceLog(asset);
    try {
      const res = await api.get(`/assets/${asset.id}/maintenance`);
      setMaintenanceLogs(res.data);
    } catch {
      setMaintenanceLogs([]);
    }
  };

  const handleAddMaintenance = async () => {
    if (!maintenanceForm.description) { toast.error('Description required'); return; }
    try {
      await api.post(`/assets/${showMaintenanceLog.id}/maintenance`, {
        ...maintenanceForm,
        cost: parseFloat(maintenanceForm.cost) || 0,
      });
      toast.success('Maintenance logged');
      const res = await api.get(`/assets/${showMaintenanceLog.id}/maintenance`);
      setMaintenanceLogs(res.data);
      setMaintenanceForm({ type: 'maintenance', description: '', cost: '', performed_by: '', notes: '' });
    } catch (err) {
      toast.error('Failed to log maintenance');
    }
  };

  const getTypeIcon = (type) => {
    const t = ASSET_TYPES.find(at => at.id === type);
    return t ? t.icon : Box;
  };

  const getTypeColor = (type) => {
    const t = ASSET_TYPES.find(at => at.id === type);
    return t ? t.color : '#6b7280';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="assets-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-outfit tracking-tight dark:text-white">
              Assets & Liabilities
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Track company assets, depreciation, and all financial obligations
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchData} data-testid="refresh-assets">
              <RefreshCw size={16} className="mr-1" /> Refresh
            </Button>
            <Button onClick={() => { setEditingAsset(null); resetForm(); setShowAddAsset(true); }} data-testid="add-asset-btn">
              <Plus size={16} className="mr-1" /> Add Asset
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {stats && liabilities && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <Card className="border-0 shadow-sm dark:bg-stone-900">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Package size={14} /> Total Assets
                </div>
                <p className="text-2xl font-bold text-orange-600">{stats.total_assets}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm dark:bg-stone-900">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <DollarSign size={14} /> Asset Value
                </div>
                <p className="text-2xl font-bold text-emerald-600">SAR {stats.total_current_value?.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm dark:bg-stone-900">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <TrendingDown size={14} /> Depreciation
                </div>
                <p className="text-2xl font-bold text-red-500">SAR {stats.total_depreciation?.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm dark:bg-stone-900">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Wallet size={14} /> Total Liabilities
                </div>
                <p className="text-2xl font-bold text-amber-600">SAR {liabilities.total_liabilities?.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm dark:bg-stone-900">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <CreditCard size={14} /> Active Loans
                </div>
                <p className="text-2xl font-bold text-blue-600">{liabilities.loans?.active_count || 0}</p>
                <p className="text-xs text-muted-foreground">SAR {liabilities.loans?.remaining?.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm dark:bg-stone-900">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <AlertTriangle size={14} /> Unpaid Fines
                </div>
                <p className="text-2xl font-bold text-red-600">{liabilities.fines?.unpaid_count || 0}</p>
                <p className="text-xs text-muted-foreground">SAR {liabilities.fines?.remaining?.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-stone-100 dark:bg-stone-800">
            <TabsTrigger value="assets" data-testid="tab-assets">
              <Package size={14} className="mr-1" /> Assets
            </TabsTrigger>
            <TabsTrigger value="liabilities" data-testid="tab-liabilities">
              <Wallet size={14} className="mr-1" /> Liabilities
            </TabsTrigger>
            <TabsTrigger value="depreciation" data-testid="tab-depreciation">
              <TrendingDown size={14} className="mr-1" /> Depreciation
            </TabsTrigger>
          </TabsList>

          {/* ASSETS TAB */}
          <TabsContent value="assets" className="mt-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-36" data-testid="filter-type">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {ASSET_TYPES.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-36" data-testid="filter-status">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="disposed">Disposed</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Assets Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-orange-500" size={32} />
              </div>
            ) : filteredAssets.length === 0 ? (
              <Card className="border-dashed border-2">
                <CardContent className="p-12 text-center">
                  <Package size={48} className="mx-auto mb-4 text-stone-300" />
                  <h3 className="font-semibold text-lg mb-2">No assets found</h3>
                  <p className="text-muted-foreground text-sm mb-4">Start tracking your company assets</p>
                  <Button onClick={() => setShowAddAsset(true)}>
                    <Plus size={16} className="mr-1" /> Add First Asset
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredAssets.map(asset => {
                  const TypeIcon = getTypeIcon(asset.asset_type);
                  const statusStyle = STATUS_COLORS[asset.status] || STATUS_COLORS.active;
                  return (
                    <Card key={asset.id} className="hover:shadow-lg transition-shadow" data-testid={`asset-${asset.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${getTypeColor(asset.asset_type)}20` }}>
                              <TypeIcon size={20} style={{ color: getTypeColor(asset.asset_type) }} />
                            </div>
                            <div>
                              <h3 className="font-semibold text-sm truncate max-w-[140px]">{asset.name}</h3>
                              <p className="text-xs text-muted-foreground capitalize">{asset.asset_type}</p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => openEditAsset(asset)} className="p-1 rounded hover:bg-stone-100">
                              <Edit2 size={14} className="text-stone-500" />
                            </button>
                            <button onClick={() => handleDeleteAsset(asset)} className="p-1 rounded hover:bg-red-50">
                              <Trash2 size={14} className="text-red-500" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Book Value</span>
                            <span className="font-semibold text-emerald-600">
                              SAR {(asset.calculated_value || asset.current_value || 0).toLocaleString()}
                            </span>
                          </div>
                          {asset.total_depreciation > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Depreciation</span>
                              <span className="text-red-500">-SAR {asset.total_depreciation?.toLocaleString()}</span>
                            </div>
                          )}
                          {asset.location && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Location</span>
                              <span className="truncate max-w-[100px]">{asset.location}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between mt-3 pt-3 border-t">
                          <Badge className={`text-xs ${statusStyle.bg} ${statusStyle.text}`}>
                            {asset.status}
                          </Badge>
                          {asset.warranty_status === 'expiring_soon' && (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                              <AlertTriangle size={10} className="mr-1" />
                              Warranty {asset.warranty_days_left}d
                            </Badge>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openMaintenanceLog(asset)}>
                            <Wrench size={12} className="mr-1" /> Log
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* LIABILITIES TAB */}
          <TabsContent value="liabilities" className="mt-4">
            {liabilities && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Loans Section */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CreditCard size={18} className="text-blue-500" />
                      Company Loans
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center mb-4 p-3 bg-blue-50 rounded-lg">
                      <div>
                        <p className="text-xs text-muted-foreground">Total Outstanding</p>
                        <p className="text-xl font-bold text-blue-600">SAR {liabilities.loans?.remaining?.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Active Loans</p>
                        <p className="text-xl font-bold">{liabilities.loans?.active_count}</p>
                      </div>
                    </div>
                    {liabilities.loans?.details?.length > 0 ? (
                      <div className="space-y-2">
                        {liabilities.loans.details.map(loan => (
                          <div key={loan.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                            <div>
                              <p className="font-medium text-sm">{loan.name}</p>
                              <p className="text-xs text-muted-foreground">Monthly: SAR {loan.monthly_payment}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-blue-600">SAR {loan.remaining?.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">of SAR {loan.total?.toLocaleString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-4">No active loans</p>
                    )}
                    <Button variant="outline" className="w-full mt-3" onClick={() => window.location.href = '/company-loans'}>
                      View All Loans
                    </Button>
                  </CardContent>
                </Card>

                {/* Fines Section */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle size={18} className="text-red-500" />
                      Unpaid Fines
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center mb-4 p-3 bg-red-50 rounded-lg">
                      <div>
                        <p className="text-xs text-muted-foreground">Total Unpaid</p>
                        <p className="text-xl font-bold text-red-600">SAR {liabilities.fines?.remaining?.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Pending Fines</p>
                        <p className="text-xl font-bold">{liabilities.fines?.unpaid_count}</p>
                      </div>
                    </div>
                    {liabilities.fines?.details?.length > 0 ? (
                      <div className="space-y-2">
                        {liabilities.fines.details.map(fine => (
                          <div key={fine.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                            <div>
                              <p className="font-medium text-sm truncate max-w-[180px]">{fine.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Due: {fine.due_date ? format(new Date(fine.due_date), 'MMM d, yyyy') : '-'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-red-600">SAR {fine.remaining?.toLocaleString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-4">No unpaid fines</p>
                    )}
                    <Button variant="outline" className="w-full mt-3" onClick={() => window.location.href = '/fines'}>
                      View All Fines
                    </Button>
                  </CardContent>
                </Card>

                {/* Supplier Dues */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users size={18} className="text-amber-500" />
                      Supplier Dues
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center mb-4 p-3 bg-amber-50 rounded-lg">
                      <div>
                        <p className="text-xs text-muted-foreground">Total Dues</p>
                        <p className="text-xl font-bold text-amber-600">SAR {liabilities.suppliers?.total_dues?.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Suppliers</p>
                        <p className="text-xl font-bold">{liabilities.suppliers?.with_dues}</p>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full" onClick={() => window.location.href = '/supplier-payments'}>
                      View Supplier Payments
                    </Button>
                  </CardContent>
                </Card>

                {/* Document Alerts */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText size={18} className="text-purple-500" />
                      Document Alerts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-3 bg-red-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-red-600">{liabilities.documents?.expired || 0}</p>
                        <p className="text-xs text-muted-foreground">Expired</p>
                      </div>
                      <div className="p-3 bg-amber-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-amber-600">{liabilities.documents?.expiring_soon || 0}</p>
                        <p className="text-xs text-muted-foreground">Expiring Soon</p>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full" onClick={() => window.location.href = '/documents'}>
                      View Documents
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* DEPRECIATION TAB */}
          <TabsContent value="depreciation" className="mt-4">
            {stats && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Summary */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">Depreciation Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="p-4 bg-stone-50 rounded-xl text-center">
                        <p className="text-xs text-muted-foreground mb-1">Purchase Value</p>
                        <p className="text-xl font-bold">SAR {stats.total_purchase_value?.toLocaleString()}</p>
                      </div>
                      <div className="p-4 bg-red-50 rounded-xl text-center">
                        <p className="text-xs text-muted-foreground mb-1">Total Depreciation</p>
                        <p className="text-xl font-bold text-red-600">SAR {stats.total_depreciation?.toLocaleString()}</p>
                      </div>
                      <div className="p-4 bg-emerald-50 rounded-xl text-center">
                        <p className="text-xs text-muted-foreground mb-1">Current Book Value</p>
                        <p className="text-xl font-bold text-emerald-600">SAR {stats.total_current_value?.toLocaleString()}</p>
                      </div>
                    </div>
                    
                    {/* Depreciation by Type Chart */}
                    {stats.by_type?.length > 0 && (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.by_type} layout="vertical">
                            <XAxis type="number" />
                            <YAxis dataKey="type" type="category" width={80} tick={{ fontSize: 12 }} />
                            <Tooltip formatter={(v) => [`${v} assets`, 'Count']} />
                            <Bar dataKey="count" fill="#f97316" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Status Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Asset Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats.by_status && (
                      <>
                        <div className="h-48 mb-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={Object.entries(stats.by_status).map(([k, v]) => ({ name: k, value: v }))}
                                cx="50%" cy="50%" innerRadius={40} outerRadius={70}
                                paddingAngle={2} dataKey="value"
                              >
                                {Object.keys(stats.by_status).map((_, i) => (
                                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-2">
                          {Object.entries(stats.by_status).map(([status, count], i) => (
                            <div key={status} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                                <span className="text-sm capitalize">{status}</span>
                              </div>
                              <span className="font-semibold">{count}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {stats.warranty_expiring_soon > 0 && (
                      <div className="mt-4 p-3 bg-amber-50 rounded-lg flex items-center gap-2">
                        <AlertTriangle size={16} className="text-amber-500" />
                        <span className="text-sm">{stats.warranty_expiring_soon} warranties expiring soon</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Add/Edit Asset Dialog */}
      <Dialog open={showAddAsset} onOpenChange={setShowAddAsset}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAsset ? 'Edit Asset' : 'Add New Asset'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Asset Name *</Label>
                <Input
                  value={assetForm.name}
                  onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                  placeholder="e.g., Delivery Van, Coffee Machine"
                  className="mt-1"
                  data-testid="asset-name-input"
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={assetForm.asset_type} onValueChange={(v) => setAssetForm({ ...assetForm, asset_type: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={assetForm.status} onValueChange={(v) => setAssetForm({ ...assetForm, status: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="disposed">Disposed</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Purchase Date</Label>
                <Input
                  type="date"
                  value={assetForm.purchase_date}
                  onChange={(e) => setAssetForm({ ...assetForm, purchase_date: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Purchase Price (SAR)</Label>
                <Input
                  type="number"
                  value={assetForm.purchase_price}
                  onChange={(e) => setAssetForm({ ...assetForm, purchase_price: e.target.value })}
                  placeholder="0"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Current Value (SAR)</Label>
                <Input
                  type="number"
                  value={assetForm.current_value}
                  onChange={(e) => setAssetForm({ ...assetForm, current_value: e.target.value })}
                  placeholder="0"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Depreciation Rate (%/year)</Label>
                <Input
                  type="number"
                  value={assetForm.depreciation_rate}
                  onChange={(e) => setAssetForm({ ...assetForm, depreciation_rate: e.target.value })}
                  placeholder="e.g., 20"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Serial Number</Label>
                <Input
                  value={assetForm.serial_number}
                  onChange={(e) => setAssetForm({ ...assetForm, serial_number: e.target.value })}
                  placeholder="Optional"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  value={assetForm.location}
                  onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
                  placeholder="e.g., Main Branch Kitchen"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Branch</Label>
                <Select value={assetForm.branch_id} onValueChange={(v) => setAssetForm({ ...assetForm, branch_id: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No Branch</SelectItem>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Warranty Expiry</Label>
                <Input
                  type="date"
                  value={assetForm.warranty_expiry}
                  onChange={(e) => setAssetForm({ ...assetForm, warranty_expiry: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div className="col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={assetForm.description}
                  onChange={(e) => setAssetForm({ ...assetForm, description: e.target.value })}
                  placeholder="Optional details..."
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddAsset(false); setEditingAsset(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSaveAsset} data-testid="save-asset-btn">
              {editingAsset ? 'Update Asset' : 'Add Asset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Maintenance Log Dialog */}
      <Dialog open={!!showMaintenanceLog} onOpenChange={() => setShowMaintenanceLog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Maintenance Log - {showMaintenanceLog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {maintenanceLogs.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No maintenance records</p>
              ) : (
                maintenanceLogs.map(log => (
                  <div key={log.id} className="p-3 bg-stone-50 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <Badge variant="outline" className="text-xs mb-1">{log.type}</Badge>
                        <p className="text-sm">{log.description}</p>
                        {log.performed_by && <p className="text-xs text-muted-foreground">By: {log.performed_by}</p>}
                      </div>
                      <div className="text-right">
                        {log.cost > 0 && <p className="font-semibold text-sm">SAR {log.cost}</p>}
                        <p className="text-xs text-muted-foreground">{format(new Date(log.date), 'MMM d, yyyy')}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="border-t pt-4">
              <p className="font-medium text-sm mb-2">Add New Entry</p>
              <div className="space-y-2">
                <Select value={maintenanceForm.type} onValueChange={(v) => setMaintenanceForm({ ...maintenanceForm, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="inspection">Inspection</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Description *"
                  value={maintenanceForm.description}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Cost (SAR)"
                    type="number"
                    value={maintenanceForm.cost}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })}
                  />
                  <Input
                    placeholder="Performed by"
                    value={maintenanceForm.performed_by}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, performed_by: e.target.value })}
                  />
                </div>
                <Button className="w-full" onClick={handleAddMaintenance}>
                  <Plus size={14} className="mr-1" /> Add Entry
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
