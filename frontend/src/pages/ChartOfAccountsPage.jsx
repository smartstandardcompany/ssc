import { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { BookOpen, Plus, Pencil, Trash2, Search, ChevronDown, ChevronRight } from 'lucide-react';
import api from '@/lib/api';

const ACCOUNT_TYPES = [
  { value: 'asset', label: 'Asset', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'liability', label: 'Liability', color: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'equity', label: 'Equity', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'revenue', label: 'Revenue', color: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'expense', label: 'Expense', color: 'bg-orange-50 text-orange-700 border-orange-200' },
];

const SUB_TYPES = {
  asset: ['current_asset', 'fixed_asset', 'other_asset'],
  liability: ['current_liability', 'long_term_liability'],
  equity: ['equity'],
  revenue: ['operating_revenue', 'other_revenue'],
  expense: ['cost_of_sales', 'operating_expense', 'other_expense'],
};

function getTypeColor(type) {
  return ACCOUNT_TYPES.find(t => t.value === type)?.color || 'bg-gray-50 text-gray-700';
}

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editAcc, setEditAcc] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', type: 'asset', sub_type: 'current_asset', description: '' });
  const [expandedTypes, setExpandedTypes] = useState(['asset', 'liability', 'equity', 'revenue', 'expense']);

  const fetchAccounts = async () => {
    try {
      const res = await api.get('/accounting/accounts');
      setAccounts(res.data);
    } catch { toast.error('Failed to load accounts'); }
  };

  useEffect(() => { fetchAccounts(); }, []);

  const handleSave = async () => {
    if (!form.code || !form.name) { toast.error('Code and name are required'); return; }
    try {
      if (editAcc) {
        await api.put(`/accounting/accounts/${editAcc.id}`, form);
        toast.success('Account updated');
      } else {
        await api.post('/accounting/accounts', form);
        toast.success('Account created');
      }
      setShowModal(false);
      setEditAcc(null);
      fetchAccounts();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to save'); }
  };

  const handleDelete = async (acc) => {
    if (acc.is_system) { toast.error('Cannot delete system accounts'); return; }
    if (!window.confirm(`Delete account "${acc.name}"?`)) return;
    try {
      await api.delete(`/accounting/accounts/${acc.id}`);
      toast.success('Account deleted');
      fetchAccounts();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to delete'); }
  };

  const openNew = () => {
    setEditAcc(null);
    setForm({ code: '', name: '', type: 'asset', sub_type: 'current_asset', description: '' });
    setShowModal(true);
  };

  const openEdit = (acc) => {
    setEditAcc(acc);
    setForm({ code: acc.code, name: acc.name, type: acc.type, sub_type: acc.sub_type || '', description: acc.description || '' });
    setShowModal(true);
  };

  const toggleType = (type) => {
    setExpandedTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const filtered = accounts.filter(a => {
    if (filterType !== 'all' && a.type !== filterType) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.code.includes(search)) return false;
    return true;
  });

  const groupedByType = ACCOUNT_TYPES.map(type => ({
    ...type,
    accounts: filtered.filter(a => a.type === type.value),
    total: filtered.filter(a => a.type === type.value).reduce((s, a) => s + (a.balance || 0), 0),
  })).filter(g => g.accounts.length > 0);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6" data-testid="chart-of-accounts-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-800" data-testid="page-title">Chart of Accounts</h1>
            <p className="text-sm text-stone-500 mt-1">Manage your accounting structure</p>
          </div>
          <Button onClick={openNew} className="bg-orange-500 hover:bg-orange-600 text-white" data-testid="add-account-btn">
            <Plus className="w-4 h-4 mr-2" /> Add Account
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-5 gap-4">
          {ACCOUNT_TYPES.map(type => {
            const typeAccounts = accounts.filter(a => a.type === type.value);
            return (
              <div key={type.value} className={`rounded-xl border p-4 ${type.color}`} data-testid={`summary-${type.value}`}>
                <p className="text-xs font-medium uppercase tracking-wide opacity-70">{type.label}</p>
                <p className="text-xl font-bold mt-1">{typeAccounts.length}</p>
                <p className="text-xs mt-1 opacity-60">accounts</p>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <Input
                placeholder="Search accounts by name or code..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
                data-testid="search-accounts"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filterType === 'all' ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                data-testid="filter-all">All</button>
              {ACCOUNT_TYPES.map(t => (
                <button key={t.value} onClick={() => setFilterType(t.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filterType === t.value ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                  data-testid={`filter-${t.value}`}>{t.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Account Groups */}
        <div className="space-y-3">
          {groupedByType.map(group => (
            <div key={group.value} className="bg-white rounded-xl border border-stone-200 overflow-hidden" data-testid={`group-${group.value}`}>
              <button
                onClick={() => toggleType(group.value)}
                className="w-full flex items-center justify-between p-4 hover:bg-stone-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandedTypes.includes(group.value) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${group.color}`}>{group.label}</span>
                  <span className="text-sm text-stone-500">{group.accounts.length} accounts</span>
                </div>
              </button>
              {expandedTypes.includes(group.value) && (
                <div className="border-t border-stone-100">
                  <table className="w-full text-sm">
                    <thead className="bg-stone-50">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-medium text-stone-500 w-24">Code</th>
                        <th className="text-left px-4 py-2.5 font-medium text-stone-500">Account Name</th>
                        <th className="text-left px-4 py-2.5 font-medium text-stone-500 w-40">Sub Type</th>
                        <th className="text-left px-4 py-2.5 font-medium text-stone-500">Description</th>
                        <th className="text-right px-4 py-2.5 font-medium text-stone-500 w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.accounts.map(acc => (
                        <tr key={acc.id} className="border-t border-stone-50 hover:bg-stone-50 transition-colors" data-testid={`account-row-${acc.code}`}>
                          <td className="px-4 py-3 font-mono text-stone-600">{acc.code}</td>
                          <td className="px-4 py-3 font-medium text-stone-800">{acc.name}</td>
                          <td className="px-4 py-3 text-stone-500 capitalize">{(acc.sub_type || '').replace(/_/g, ' ')}</td>
                          <td className="px-4 py-3 text-stone-500">{acc.description}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => openEdit(acc)} className="p-1.5 rounded-md hover:bg-stone-100" data-testid={`edit-${acc.code}`}>
                                <Pencil className="w-3.5 h-3.5 text-stone-400" />
                              </button>
                              {!acc.is_system && (
                                <button onClick={() => handleDelete(acc)} className="p-1.5 rounded-md hover:bg-red-50" data-testid={`delete-${acc.code}`}>
                                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent data-testid="account-modal">
            <DialogHeader>
              <DialogTitle>{editAcc ? 'Edit Account' : 'Add Account'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-stone-600 mb-1 block">Account Code *</label>
                  <Input value={form.code} onChange={e => setForm({...form, code: e.target.value})}
                    placeholder="e.g. 1300" disabled={!!editAcc} data-testid="account-code-input" />
                </div>
                <div>
                  <label className="text-sm font-medium text-stone-600 mb-1 block">Account Name *</label>
                  <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    placeholder="Account name" data-testid="account-name-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-stone-600 mb-1 block">Type</label>
                  <Select value={form.type} onValueChange={v => setForm({...form, type: v, sub_type: SUB_TYPES[v]?.[0] || ''})}>
                    <SelectTrigger data-testid="account-type-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-stone-600 mb-1 block">Sub Type</label>
                  <Select value={form.sub_type} onValueChange={v => setForm({...form, sub_type: v})}>
                    <SelectTrigger data-testid="account-subtype-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(SUB_TYPES[form.type] || []).map(st => (
                        <SelectItem key={st} value={st}>{st.replace(/_/g, ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-stone-600 mb-1 block">Description</label>
                <Input value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  placeholder="Optional description" data-testid="account-description-input" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleSave} className="bg-orange-500 hover:bg-orange-600 text-white" data-testid="save-account-btn">
                {editAcc ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
