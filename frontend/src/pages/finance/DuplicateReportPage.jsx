import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertTriangle, Trash2, Copy, DollarSign, Receipt, Truck, ShoppingCart, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function DuplicateReportPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('30');
  const [expandedGroups, setExpandedGroups] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/duplicate-report/scan?days=${days}`);
      setData(res.data);
    } catch { toast.error('Failed to scan for duplicates'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [days]);

  const handleDelete = async (module, id) => {
    if (!window.confirm('Delete this entry? This cannot be undone.')) return;
    try {
      const endpoint = module === 'sales' ? `/sales/${id}` : module === 'expenses' ? `/expenses/${id}` : `/supplier-payments/${id}`;
      await api.delete(endpoint);
      toast.success('Entry deleted');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to delete'); }
  };

  const toggleGroup = (key) => setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));

  const renderDuplicateGroup = (group, module, index) => {
    const groupKey = `${module}-${index}`;
    const isExpanded = expandedGroups[groupKey];
    return (
      <div key={groupKey} className="border rounded-lg overflow-hidden" data-testid={`dup-group-${groupKey}`}>
        <div className="p-3 cursor-pointer hover:bg-stone-50 transition-colors flex items-center justify-between gap-2 flex-wrap"
          onClick={() => toggleGroup(groupKey)}>
          <div className="flex items-center gap-3">
            {isExpanded ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
            <div>
              <div className="font-semibold text-sm flex items-center gap-2">
                <span>{group.date}</span>
                <Badge className="text-[10px] bg-orange-100 text-orange-700 border-0">
                  <Copy size={8} className="mr-0.5" /> {group.count}x duplicate
                </Badge>
                {module === 'supplier_payments' && group.supplier && (
                  <Badge variant="outline" className="text-[10px]">{group.supplier}</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {group.branch || 'No branch'} | SAR {group.amount.toLocaleString(undefined, {minimumFractionDigits: 2})} each
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-red-500">Potential Excess</div>
            <div className="font-bold text-red-600">SAR {group.potential_excess.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
          </div>
        </div>
        {isExpanded && (
          <div className="border-t bg-stone-50/50">
            <table className="w-full text-sm">
              <thead className="bg-stone-100">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-xs">#</th>
                  <th className="text-left px-3 py-2 font-medium text-xs">Details</th>
                  <th className="text-left px-3 py-2 font-medium text-xs">Notes</th>
                  <th className="text-left px-3 py-2 font-medium text-xs">Created</th>
                  <th className="text-right px-3 py-2 font-medium text-xs">Action</th>
                </tr>
              </thead>
              <tbody>
                {group.entries.map((entry, ei) => (
                  <tr key={entry.id} className={`border-t ${ei > 0 ? 'bg-orange-50/50' : ''}`} data-testid={`dup-entry-${entry.id}`}>
                    <td className="px-3 py-2 text-xs">
                      {ei === 0 ? (
                        <Badge className="text-[9px] bg-emerald-100 text-emerald-700 border-0">Original</Badge>
                      ) : (
                        <Badge className="text-[9px] bg-orange-100 text-orange-700 border-0">Dup #{ei}</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {module === 'sales' && <span>{entry.sale_type} | {entry.payment_modes}</span>}
                      {module === 'expenses' && <span>{entry.category} | {entry.payment_mode} | {entry.description}</span>}
                      {module === 'supplier_payments' && <span>{entry.payment_mode}</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[200px]">{entry.notes || '-'}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {entry.created_at ? new Date(entry.created_at).toLocaleString() : '-'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {ei > 0 && (
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => { e.stopPropagation(); handleDelete(module, entry.id); }}
                          data-testid={`delete-dup-${entry.id}`}>
                          <Trash2 size={10} className="mr-0.5" /> Remove
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Scanning for duplicates...</div></DashboardLayout>;

  const s = data?.summary || {};

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit" data-testid="duplicate-report-title">Duplicate Report</h1>
            <p className="text-sm text-muted-foreground">Find and remove duplicate entries across all modules</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-36" data-testid="dup-days-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="180">Last 180 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchData} disabled={loading} data-testid="rescan-btn">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3" data-testid="dup-summary-cards">
          <Card className={`border ${s.total_duplicate_groups > 0 ? 'border-orange-200 bg-orange-50/30' : 'border-emerald-200 bg-emerald-50/30'}`}>
            <CardContent className="p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Groups</div>
              <div className={`text-2xl font-bold ${s.total_duplicate_groups > 0 ? 'text-orange-700' : 'text-emerald-700'}`}>
                {s.total_duplicate_groups || 0}
              </div>
              <div className="text-xs text-muted-foreground">{s.scan_period}</div>
            </CardContent>
          </Card>
          <Card className="border-purple-200 bg-purple-50/30">
            <CardContent className="p-4">
              <div className="text-[10px] uppercase tracking-wider text-purple-600">Sales</div>
              <div className="text-2xl font-bold text-purple-700">{s.sales_groups || 0}</div>
              <div className="text-xs text-muted-foreground">SAR {(s.sales_excess || 0).toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50/30">
            <CardContent className="p-4">
              <div className="text-[10px] uppercase tracking-wider text-red-600">Expenses</div>
              <div className="text-2xl font-bold text-red-700">{s.expense_groups || 0}</div>
              <div className="text-xs text-muted-foreground">SAR {(s.expense_excess || 0).toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50/30">
            <CardContent className="p-4">
              <div className="text-[10px] uppercase tracking-wider text-blue-600">Supplier Payments</div>
              <div className="text-2xl font-bold text-blue-700">{s.sp_groups || 0}</div>
              <div className="text-xs text-muted-foreground">SAR {(s.sp_excess || 0).toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="border-red-300 bg-red-50/50">
            <CardContent className="p-4">
              <div className="text-[10px] uppercase tracking-wider text-red-600">Potential Excess</div>
              <div className="text-2xl font-bold text-red-700">SAR {(s.total_potential_excess || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
              <div className="text-xs text-muted-foreground">If all duplicates removed</div>
            </CardContent>
          </Card>
        </div>

        {s.total_duplicate_groups === 0 ? (
          <Card className="border-emerald-200 bg-emerald-50/30">
            <CardContent className="p-8 text-center">
              <div className="text-emerald-600 text-4xl mb-3">&#10003;</div>
              <p className="text-lg font-semibold text-emerald-700">No Duplicates Found</p>
              <p className="text-sm text-muted-foreground mt-1">Your data is clean for the selected period</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue={s.sales_groups > 0 ? 'sales' : s.expense_groups > 0 ? 'expenses' : 'supplier_payments'}>
            <TabsList>
              <TabsTrigger value="sales" className="gap-1">
                <ShoppingCart size={14} /> Sales
                {s.sales_groups > 0 && <Badge className="text-[10px] bg-purple-100 text-purple-700 border-0 ml-1">{s.sales_groups}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="expenses" className="gap-1">
                <Receipt size={14} /> Expenses
                {s.expense_groups > 0 && <Badge className="text-[10px] bg-red-100 text-red-700 border-0 ml-1">{s.expense_groups}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="supplier_payments" className="gap-1">
                <Truck size={14} /> Supplier Payments
                {s.sp_groups > 0 && <Badge className="text-[10px] bg-blue-100 text-blue-700 border-0 ml-1">{s.sp_groups}</Badge>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sales">
              <div className="space-y-2">
                {(data?.sales || []).length === 0 ? (
                  <Card className="border-dashed"><CardContent className="p-6 text-center text-muted-foreground">No sales duplicates found</CardContent></Card>
                ) : (data.sales.map((g, i) => renderDuplicateGroup(g, 'sales', i)))}
              </div>
            </TabsContent>

            <TabsContent value="expenses">
              <div className="space-y-2">
                {(data?.expenses || []).length === 0 ? (
                  <Card className="border-dashed"><CardContent className="p-6 text-center text-muted-foreground">No expense duplicates found</CardContent></Card>
                ) : (data.expenses.map((g, i) => renderDuplicateGroup(g, 'expenses', i)))}
              </div>
            </TabsContent>

            <TabsContent value="supplier_payments">
              <div className="space-y-2">
                {(data?.supplier_payments || []).length === 0 ? (
                  <Card className="border-dashed"><CardContent className="p-6 text-center text-muted-foreground">No supplier payment duplicates found</CardContent></Card>
                ) : (data.supplier_payments.map((g, i) => renderDuplicateGroup(g, 'supplier_payments', i)))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
