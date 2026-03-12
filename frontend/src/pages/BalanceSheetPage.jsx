import { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { Scale, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import api from '@/lib/api';

function formatCurrency(val) {
  return `SAR ${(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function BalanceSection({ title, color, items, total }) {
  const colorMap = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', header: 'bg-blue-100' },
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', header: 'bg-red-100' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', header: 'bg-purple-100' },
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <div className={`rounded-xl border ${c.border} overflow-hidden`}>
      <div className={`${c.header} px-6 py-3 flex justify-between items-center`}>
        <span className={`font-semibold ${c.text}`}>{title}</span>
        <span className={`font-bold text-lg ${c.text}`}>{formatCurrency(total)}</span>
      </div>
      {Object.entries(items).map(([section, entries]) => (
        Object.keys(entries).length > 0 && (
          <div key={section} className="border-t border-stone-100">
            <div className="px-6 py-2 bg-stone-50">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">{section.replace(/_/g, ' ')}</span>
            </div>
            {Object.entries(entries).map(([name, amount]) => (
              <div key={name} className="flex justify-between px-6 py-2.5 border-t border-stone-50 hover:bg-stone-50 text-sm">
                <span className="text-stone-600 pl-2">{name}</span>
                <span className="font-medium text-stone-800">{formatCurrency(amount)}</span>
              </div>
            ))}
          </div>
        )
      ))}
    </div>
  );
}

export default function BalanceSheetPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');

  const fetchBranches = async () => {
    try { const res = await api.get('/branches'); setBranches(res.data || []); } catch {}
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ as_of_date: asOfDate });
      if (branchId) params.append('branch_id', branchId);
      const res = await api.get(`/accounting/balance-sheet?${params}`);
      setData(res.data);
    } catch { toast.error('Failed to load balance sheet'); }
    setLoading(false);
  };

  useEffect(() => { fetchBranches(); fetchData(); }, []);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6" data-testid="balance-sheet-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-800" data-testid="page-title">Balance Sheet</h1>
            <p className="text-sm text-stone-500 mt-1">
              {data ? `As of ${new Date(data.as_of_date).toLocaleDateString()}` : 'Financial position snapshot'}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <div className="flex items-center gap-3">
            <div>
              <label className="text-xs font-medium text-stone-500 block mb-1">As of Date</label>
              <Input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} className="w-44" data-testid="date-input" />
            </div>
            {branches.length > 0 && (
              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">Branch</label>
                <Select value={branchId || "all"} onValueChange={v => setBranchId(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-44" data-testid="branch-filter"><SelectValue placeholder="All Branches" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="pt-5">
              <Button onClick={fetchData} className="bg-orange-500 hover:bg-orange-600 text-white" data-testid="apply-btn">Generate</Button>
            </div>
          </div>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="animate-pulse text-stone-400">Loading Balance Sheet...</div>
          </div>
        ) : data && (
          <>
            {/* Balance Check */}
            <div className={`rounded-xl border p-4 flex items-center gap-3 ${data.is_balanced ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`} data-testid="balance-check">
              {data.is_balanced ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-amber-600" />}
              <div>
                <p className={`font-semibold text-sm ${data.is_balanced ? 'text-green-800' : 'text-amber-800'}`}>
                  {data.is_balanced ? 'Balance Sheet is Balanced' : 'Balance Sheet has a variance'}
                </p>
                <p className="text-xs text-stone-500 mt-0.5">
                  Assets: {formatCurrency(data.assets.total)} | Liabilities + Equity: {formatCurrency(data.total_liabilities_equity)}
                </p>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-5" data-testid="total-assets">
                <p className="text-xs font-medium text-blue-600 uppercase">Total Assets</p>
                <p className="text-2xl font-bold text-blue-800 mt-2">{formatCurrency(data.assets.total)}</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-5" data-testid="total-liabilities">
                <p className="text-xs font-medium text-red-600 uppercase">Total Liabilities</p>
                <p className="text-2xl font-bold text-red-800 mt-2">{formatCurrency(data.liabilities.total)}</p>
              </div>
              <div className="rounded-xl border border-purple-200 bg-purple-50 p-5" data-testid="total-equity">
                <p className="text-xs font-medium text-purple-600 uppercase">Total Equity</p>
                <p className="text-2xl font-bold text-purple-800 mt-2">{formatCurrency(data.equity.total)}</p>
              </div>
            </div>

            {/* Detail Sections */}
            <div className="space-y-4">
              <BalanceSection
                title="Assets"
                color="blue"
                items={{ current_assets: data.assets.current_assets, fixed_assets: data.assets.fixed_assets }}
                total={data.assets.total}
              />
              <BalanceSection
                title="Liabilities"
                color="red"
                items={{ current_liabilities: data.liabilities.current_liabilities, long_term_liabilities: data.liabilities.long_term_liabilities }}
                total={data.liabilities.total}
              />
              <BalanceSection
                title="Equity"
                color="purple"
                items={{ equity: data.equity.items }}
                total={data.equity.total}
              />
            </div>

            {/* Accounting Equation */}
            <div className="bg-stone-800 rounded-xl p-6 text-center text-white">
              <p className="text-xs uppercase tracking-wider text-stone-400 mb-3">Accounting Equation</p>
              <div className="flex items-center justify-center gap-4 text-lg">
                <div>
                  <p className="text-xs text-stone-400">Assets</p>
                  <p className="font-bold text-blue-300">{formatCurrency(data.assets.total)}</p>
                </div>
                <span className="text-stone-500 text-2xl">=</span>
                <div>
                  <p className="text-xs text-stone-400">Liabilities</p>
                  <p className="font-bold text-red-300">{formatCurrency(data.liabilities.total)}</p>
                </div>
                <span className="text-stone-500 text-2xl">+</span>
                <div>
                  <p className="text-xs text-stone-400">Equity</p>
                  <p className="font-bold text-purple-300">{formatCurrency(data.equity.total)}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
