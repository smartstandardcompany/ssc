import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, AlertTriangle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function SupplierAgingPage() {
  const [report, setReport] = useState(null);
  const [branches, setBranches] = useState([]);
  const [branchFilter, setBranchFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedSupplier, setExpandedSupplier] = useState(null);

  useEffect(() => { fetchData(); }, [branchFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reportRes, branchesRes] = await Promise.all([
        api.get(`/suppliers/aging-report${branchFilter ? `?branch_id=${branchFilter}` : ''}`),
        api.get('/branches'),
      ]);
      setReport(reportRes.data);
      setBranches(branchesRes.data);
    } catch { toast.error('Failed to load aging report'); }
    finally { setLoading(false); }
  };

  const exportReport = async (format) => {
    try {
      const url = `/suppliers/aging-report/export?format=${format}${branchFilter ? `&branch_id=${branchFilter}` : ''}`;
      const res = await api.get(url, { responseType: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([res.data]));
      link.download = `aging_report.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      link.click();
      toast.success(`Report exported as ${format.toUpperCase()}`);
    } catch { toast.error('Export failed'); }
  };

  const getBucketColor = (bucket) => {
    const colors = {
      '0_30': 'bg-emerald-100 text-emerald-700 border-emerald-300',
      '31_60': 'bg-amber-100 text-amber-700 border-amber-300',
      '61_90': 'bg-orange-100 text-orange-700 border-orange-300',
      '90_plus': 'bg-red-100 text-red-700 border-red-300',
    };
    return colors[bucket] || '';
  };

  const getBucketBg = (bucket) => {
    const colors = {
      '0_30': 'from-emerald-50 to-emerald-100',
      '31_60': 'from-amber-50 to-amber-100',
      '61_90': 'from-orange-50 to-orange-100',
      '90_plus': 'from-red-50 to-red-100',
    };
    return colors[bucket] || '';
  };

  if (loading && !report) {
    return (<DashboardLayout><div className="flex items-center justify-center h-64">Loading aging report...</div></DashboardLayout>);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit mb-2" data-testid="aging-report-title">Supplier Aging Report</h1>
            <p className="text-muted-foreground text-sm">Outstanding balances grouped by age - prioritize payments</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <Select value={branchFilter || "all"} onValueChange={v => setBranchFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[160px] h-9" data-testid="aging-branch-filter">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => exportReport('pdf')}
              className="text-red-600 border-red-200" data-testid="export-aging-pdf">
              <Download size={14} className="mr-1" /> PDF
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportReport('excel')}
              className="text-green-600 border-green-200" data-testid="export-aging-excel">
              <Download size={14} className="mr-1" /> Excel
            </Button>
          </div>
        </div>

        {report && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3" data-testid="aging-summary">
              {[
                { key: '0_30', label: '0-30 Days', desc: 'Current' },
                { key: '31_60', label: '31-60 Days', desc: 'Attention' },
                { key: '61_90', label: '61-90 Days', desc: 'Overdue' },
                { key: '90_plus', label: '90+ Days', desc: 'Critical' },
                { key: 'total', label: 'Total', desc: `${report.supplier_count} suppliers` },
              ].map(({ key, label, desc }) => (
                <Card key={key} className={`border ${key === 'total' ? 'col-span-2 sm:col-span-1 bg-stone-900 text-white' : ''}`}>
                  <CardContent className={`p-4 text-center ${key !== 'total' ? `bg-gradient-to-b ${getBucketBg(key)} rounded-lg` : ''}`}>
                    <p className={`text-xs font-medium ${key === 'total' ? 'text-stone-300' : 'opacity-70'}`}>{label}</p>
                    <p className={`text-xl sm:text-2xl font-bold mt-1 ${key === '90_plus' ? 'text-red-700' : ''} ${key === 'total' ? 'text-white' : ''}`}
                      data-testid={`aging-total-${key}`}>
                      SAR {(report.totals[key] || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${key === 'total' ? 'text-stone-400' : 'opacity-60'}`}>{desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Visual Bar */}
            {report.totals.total > 0 && (
              <div className="h-6 rounded-full overflow-hidden flex" data-testid="aging-bar">
                {['0_30', '31_60', '61_90', '90_plus'].map(key => {
                  const pct = (report.totals[key] / report.totals.total) * 100;
                  if (pct === 0) return null;
                  const colors = { '0_30': 'bg-emerald-400', '31_60': 'bg-amber-400', '61_90': 'bg-orange-400', '90_plus': 'bg-red-500' };
                  return (
                    <div key={key} className={`${colors[key]} h-full flex items-center justify-center text-white text-[10px] font-bold`}
                      style={{ width: `${Math.max(pct, 5)}%` }} title={`${key.replace('_', '-')}: ${pct.toFixed(1)}%`}>
                      {pct > 10 ? `${pct.toFixed(0)}%` : ''}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Supplier Detail */}
            <div className="space-y-3" data-testid="aging-suppliers-list">
              {report.suppliers.map(s => (
                <Card key={s.supplier_id} className="border hover:shadow-md transition-shadow">
                  <CardContent className="p-0">
                    {/* Supplier Row */}
                    <button className="w-full p-4 flex items-center gap-4 text-left"
                      onClick={() => setExpandedSupplier(expandedSupplier === s.supplier_id ? null : s.supplier_id)}
                      data-testid={`aging-supplier-${s.supplier_id}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{s.supplier_name}</span>
                          {s.buckets['90_plus'] > 0 && (
                            <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200">
                              <AlertTriangle size={10} className="mr-0.5" /> Overdue
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Limit: SAR {s.credit_limit.toLocaleString()} | Credit: SAR {s.current_credit.toLocaleString()}
                        </p>
                      </div>
                      {/* Bucket chips */}
                      <div className="hidden sm:flex gap-1.5 items-center">
                        {['0_30', '31_60', '61_90', '90_plus'].map(key => (
                          s.buckets[key] > 0 ? (
                            <span key={key} className={`px-2 py-1 rounded text-[10px] font-medium border ${getBucketColor(key)}`}>
                              {key.replace('_', '-')}d: {s.buckets[key].toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                          ) : null
                        ))}
                      </div>
                      <span className="text-lg font-bold text-stone-800 shrink-0">
                        SAR {s.total_outstanding.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                      {expandedSupplier === s.supplier_id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>

                    {/* Expanded Detail */}
                    {expandedSupplier === s.supplier_id && (
                      <div className="border-t px-4 py-3 bg-stone-50 space-y-3">
                        {/* Mobile bucket chips */}
                        <div className="flex sm:hidden gap-1.5 flex-wrap">
                          {['0_30', '31_60', '61_90', '90_plus'].map(key => (
                            s.buckets[key] > 0 ? (
                              <span key={key} className={`px-2 py-1 rounded text-xs font-medium border ${getBucketColor(key)}`}>
                                {key.replace('_', '-')} days: SAR {s.buckets[key].toFixed(2)}
                              </span>
                            ) : null
                          ))}
                        </div>
                        {/* Unpaid invoices */}
                        <div>
                          <p className="text-xs font-medium text-stone-500 mb-2 flex items-center gap-1">
                            <Clock size={12} /> Unpaid Invoices ({s.unpaid_invoices?.length || 0})
                          </p>
                          <div className="space-y-1">
                            {(s.unpaid_invoices || []).map((inv, i) => (
                              <div key={i} className="flex items-center gap-3 text-xs bg-white rounded px-3 py-2 border">
                                <span className="text-muted-foreground w-20">
                                  {inv.date ? new Date(inv.date).toLocaleDateString() : '-'}
                                </span>
                                <span className="flex-1 truncate">{inv.description || 'Purchase'}</span>
                                <span className="font-medium">SAR {inv.unpaid.toFixed(2)}</span>
                                <Badge variant="outline" className={`text-[10px] ${
                                  inv.age_days > 90 ? 'bg-red-50 text-red-600' :
                                  inv.age_days > 60 ? 'bg-orange-50 text-orange-600' :
                                  inv.age_days > 30 ? 'bg-amber-50 text-amber-600' :
                                  'bg-emerald-50 text-emerald-600'
                                }`}>
                                  {inv.age_days}d
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {report.suppliers.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="p-12 text-center">
                    <p className="text-muted-foreground">No outstanding supplier balances. All clear!</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
