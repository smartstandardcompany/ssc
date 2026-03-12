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
import { BookOpen, Plus, Trash2, Search, ArrowUpDown, Check, X } from 'lucide-react';
import api from '@/lib/api';

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '', reference: '', entry_type: 'manual',
    lines: [
      { account_code: '', account_name: '', debit: 0, credit: 0, memo: '' },
      { account_code: '', account_name: '', debit: 0, credit: 0, memo: '' },
    ],
  });

  const fetchEntries = async () => {
    try {
      const res = await api.get(`/accounting/journal-entries?page=${page}&limit=50`);
      setEntries(res.data.entries);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch { toast.error('Failed to load journal entries'); }
  };

  const fetchAccounts = async () => {
    try {
      const res = await api.get('/accounting/accounts');
      setAccounts(res.data);
    } catch {}
  };

  useEffect(() => { fetchEntries(); fetchAccounts(); }, []);
  useEffect(() => { fetchEntries(); }, [page]);

  const totalDebit = form.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = form.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const addLine = () => setForm({ ...form, lines: [...form.lines, { account_code: '', account_name: '', debit: 0, credit: 0, memo: '' }] });
  const removeLine = (i) => { if (form.lines.length > 2) setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) }); };

  const updateLine = (i, field, val) => {
    const lines = [...form.lines];
    if (field === 'account_code') {
      const acc = accounts.find(a => a.code === val);
      lines[i] = { ...lines[i], account_code: val, account_name: acc?.name || '' };
    } else if (field === 'debit' || field === 'credit') {
      lines[i] = { ...lines[i], [field]: parseFloat(val) || 0 };
      if (field === 'debit' && parseFloat(val) > 0) lines[i].credit = 0;
      if (field === 'credit' && parseFloat(val) > 0) lines[i].debit = 0;
    } else {
      lines[i] = { ...lines[i], [field]: val };
    }
    setForm({ ...form, lines });
  };

  const handleSave = async () => {
    if (!form.description) { toast.error('Description is required'); return; }
    if (!isBalanced) { toast.error('Debits must equal Credits'); return; }
    try {
      await api.post('/accounting/journal-entries', {
        ...form,
        date: new Date(form.date).toISOString(),
      });
      toast.success('Journal entry created');
      setShowModal(false);
      fetchEntries();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to save'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this journal entry?')) return;
    try {
      await api.delete(`/accounting/journal-entries/${id}`);
      toast.success('Deleted');
      fetchEntries();
    } catch { toast.error('Failed to delete'); }
  };

  const openNew = () => {
    setForm({
      date: new Date().toISOString().split('T')[0],
      description: '', reference: '', entry_type: 'manual',
      lines: [
        { account_code: '', account_name: '', debit: 0, credit: 0, memo: '' },
        { account_code: '', account_name: '', debit: 0, credit: 0, memo: '' },
      ],
    });
    setShowModal(true);
  };

  const filtered = entries.filter(e =>
    !search || e.description?.toLowerCase().includes(search.toLowerCase()) || e.entry_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6" data-testid="journal-entries-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-800" data-testid="page-title">Journal Entries</h1>
            <p className="text-sm text-stone-500 mt-1">Manual debit and credit entries</p>
          </div>
          <Button onClick={openNew} className="bg-orange-500 hover:bg-orange-600 text-white" data-testid="add-entry-btn">
            <Plus className="w-4 h-4 mr-2" /> New Entry
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-stone-200 bg-white p-4" data-testid="summary-total">
            <p className="text-xs font-medium text-stone-500 uppercase">Total Entries</p>
            <p className="text-2xl font-bold text-stone-800 mt-1">{total}</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-4" data-testid="summary-debit">
            <p className="text-xs font-medium text-green-600 uppercase">Total Debits</p>
            <p className="text-2xl font-bold text-green-800 mt-1">SAR {entries.reduce((s, e) => s + (e.total_debit || 0), 0).toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4" data-testid="summary-credit">
            <p className="text-xs font-medium text-blue-600 uppercase">Total Credits</p>
            <p className="text-2xl font-bold text-blue-800 mt-1">SAR {entries.reduce((s, e) => s + (e.total_credit || 0), 0).toLocaleString()}</p>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <Input placeholder="Search entries..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" data-testid="search-entries" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-stone-500">Entry #</th>
                <th className="text-left px-4 py-3 font-medium text-stone-500">Date</th>
                <th className="text-left px-4 py-3 font-medium text-stone-500">Description</th>
                <th className="text-left px-4 py-3 font-medium text-stone-500">Type</th>
                <th className="text-right px-4 py-3 font-medium text-stone-500">Debit</th>
                <th className="text-right px-4 py-3 font-medium text-stone-500">Credit</th>
                <th className="text-right px-4 py-3 font-medium text-stone-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-stone-400">No journal entries yet</td></tr>
              ) : filtered.map(entry => (
                <tr key={entry.id} className="border-t border-stone-50 hover:bg-stone-50 transition-colors cursor-pointer"
                  onClick={() => setShowDetail(entry)} data-testid={`entry-row-${entry.id}`}>
                  <td className="px-4 py-3 font-mono text-stone-600">{entry.entry_number}</td>
                  <td className="px-4 py-3 text-stone-500">{entry.date ? new Date(entry.date).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-3 font-medium text-stone-800">{entry.description}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-600 capitalize">{entry.entry_type}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-green-700">SAR {entry.total_debit?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-medium text-blue-700">SAR {entry.total_credit?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleDelete(entry.id)} className="p-1.5 rounded-md hover:bg-red-50" data-testid={`delete-entry-${entry.id}`}>
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 py-3 border-t border-stone-100">
              {Array.from({length: pages}, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-sm ${p === page ? 'bg-orange-500 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{p}</button>
              ))}
            </div>
          )}
        </div>

        {/* New Entry Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-3xl" data-testid="entry-modal">
            <DialogHeader><DialogTitle>New Journal Entry</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-stone-600 mb-1 block">Date</label>
                  <Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} data-testid="entry-date" />
                </div>
                <div>
                  <label className="text-sm font-medium text-stone-600 mb-1 block">Reference</label>
                  <Input value={form.reference} onChange={e => setForm({...form, reference: e.target.value})} placeholder="e.g. INV-001" data-testid="entry-reference" />
                </div>
                <div>
                  <label className="text-sm font-medium text-stone-600 mb-1 block">Type</label>
                  <Select value={form.entry_type} onValueChange={v => setForm({...form, entry_type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="adjustment">Adjustment</SelectItem>
                      <SelectItem value="closing">Closing</SelectItem>
                      <SelectItem value="opening">Opening</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-stone-600 mb-1 block">Description *</label>
                <Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Entry description" data-testid="entry-description" />
              </div>

              {/* Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-stone-600">Entry Lines</label>
                  <Button size="sm" variant="outline" onClick={addLine} data-testid="add-line-btn"><Plus className="w-3 h-3 mr-1" /> Add Line</Button>
                </div>
                <div className="rounded-lg border border-stone-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-stone-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-stone-500 w-48">Account</th>
                        <th className="text-left px-3 py-2 font-medium text-stone-500">Memo</th>
                        <th className="text-right px-3 py-2 font-medium text-stone-500 w-32">Debit</th>
                        <th className="text-right px-3 py-2 font-medium text-stone-500 w-32">Credit</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.lines.map((line, i) => (
                        <tr key={i} className="border-t border-stone-100">
                          <td className="px-3 py-2">
                            <Select value={line.account_code || "none"} onValueChange={v => updateLine(i, 'account_code', v === "none" ? "" : v)}>
                              <SelectTrigger className="text-xs" data-testid={`line-account-${i}`}><SelectValue placeholder="Select account" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Select account</SelectItem>
                                {accounts.map(a => <SelectItem key={a.code} value={a.code}>{a.code} - {a.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <Input className="text-xs" value={line.memo} onChange={e => updateLine(i, 'memo', e.target.value)} placeholder="Optional memo" />
                          </td>
                          <td className="px-3 py-2">
                            <Input className="text-xs text-right" type="number" value={line.debit || ''} onChange={e => updateLine(i, 'debit', e.target.value)} placeholder="0.00" data-testid={`line-debit-${i}`} />
                          </td>
                          <td className="px-3 py-2">
                            <Input className="text-xs text-right" type="number" value={line.credit || ''} onChange={e => updateLine(i, 'credit', e.target.value)} placeholder="0.00" data-testid={`line-credit-${i}`} />
                          </td>
                          <td className="px-1">
                            {form.lines.length > 2 && (
                              <button onClick={() => removeLine(i)} className="p-1 rounded hover:bg-red-50">
                                <X className="w-3.5 h-3.5 text-red-400" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-stone-50 border-t border-stone-200">
                      <tr>
                        <td colSpan={2} className="px-3 py-2 font-semibold text-sm text-stone-600">Totals</td>
                        <td className="px-3 py-2 text-right font-bold text-green-700">SAR {totalDebit.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-bold text-blue-700">SAR {totalCredit.toFixed(2)}</td>
                        <td></td>
                      </tr>
                      <tr>
                        <td colSpan={5} className="px-3 py-2 text-center">
                          {isBalanced ? (
                            <span className="text-green-600 text-xs font-medium flex items-center justify-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Entry is balanced
                            </span>
                          ) : (
                            <span className="text-red-500 text-xs font-medium">
                              Difference: SAR {Math.abs(totalDebit - totalCredit).toFixed(2)} — Entry must be balanced to save
                            </span>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!isBalanced} className="bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50" data-testid="save-entry-btn">
                Post Entry
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail Modal */}
        <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
          <DialogContent className="max-w-lg" data-testid="entry-detail-modal">
            <DialogHeader><DialogTitle>Journal Entry Details</DialogTitle></DialogHeader>
            {showDetail && (
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-stone-500">Entry #:</span> <span className="font-mono font-medium">{showDetail.entry_number}</span></div>
                  <div><span className="text-stone-500">Date:</span> <span>{new Date(showDetail.date).toLocaleDateString()}</span></div>
                  <div className="col-span-2"><span className="text-stone-500">Description:</span> <span className="font-medium">{showDetail.description}</span></div>
                  {showDetail.reference && <div className="col-span-2"><span className="text-stone-500">Reference:</span> <span>{showDetail.reference}</span></div>}
                  <div><span className="text-stone-500">Type:</span> <span className="capitalize">{showDetail.entry_type}</span></div>
                  <div><span className="text-stone-500">By:</span> <span>{showDetail.created_by}</span></div>
                </div>
                <div className="border-t pt-3">
                  <table className="w-full text-sm">
                    <thead className="bg-stone-50">
                      <tr>
                        <th className="text-left px-3 py-2 text-stone-500">Account</th>
                        <th className="text-right px-3 py-2 text-stone-500">Debit</th>
                        <th className="text-right px-3 py-2 text-stone-500">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showDetail.lines || []).map((l, i) => (
                        <tr key={i} className="border-t border-stone-50">
                          <td className="px-3 py-2">{l.account_code} - {l.account_name}</td>
                          <td className="px-3 py-2 text-right text-green-700">{l.debit > 0 ? `SAR ${l.debit.toFixed(2)}` : ''}</td>
                          <td className="px-3 py-2 text-right text-blue-700">{l.credit > 0 ? `SAR ${l.credit.toFixed(2)}` : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-stone-50 border-t">
                      <tr>
                        <td className="px-3 py-2 font-semibold">Total</td>
                        <td className="px-3 py-2 text-right font-bold text-green-700">SAR {showDetail.total_debit?.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-bold text-blue-700">SAR {showDetail.total_credit?.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
