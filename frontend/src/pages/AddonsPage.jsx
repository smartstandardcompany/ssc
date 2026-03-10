import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Search, Edit, Trash2, Save, Loader2, Package, X } from 'lucide-react';
import api from '@/lib/api';

const DEFAULT_ADDON_CATEGORIES = ['extras', 'sauces', 'toppings', 'sides', 'drinks'];

export default function AddonsPage() {
  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', name_ar: '', price: '', category: 'extras', is_active: true });
  const [newCategory, setNewCategory] = useState('');

  const fetchAddons = async () => {
    try {
      const { data } = await api.get('/addons');
      setAddons(data || []);
    } catch { toast.error('Failed to fetch add-ons'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAddons(); }, []);

  const allCategories = [...new Set([
    ...DEFAULT_ADDON_CATEGORIES,
    ...addons.map(a => a.category).filter(Boolean)
  ])].sort();

  const filtered = addons.filter(a => {
    if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return a.name.toLowerCase().includes(q) || (a.name_ar || '').includes(q);
    }
    return true;
  });

  const grouped = allCategories.reduce((acc, cat) => {
    const items = filtered.filter(a => a.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});
  // Add uncategorized
  const uncategorized = filtered.filter(a => !a.category || !allCategories.includes(a.category));
  if (uncategorized.length > 0) grouped['other'] = uncategorized;

  const handleCreate = () => {
    setEditing(null);
    setForm({ name: '', name_ar: '', price: '', category: 'extras', is_active: true });
    setShowDialog(true);
  };

  const handleEdit = (addon) => {
    setEditing(addon);
    setForm({ name: addon.name, name_ar: addon.name_ar || '', price: addon.price?.toString() || '0', category: addon.category || 'extras', is_active: addon.is_active !== false });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, price: parseFloat(form.price) || 0 };
      if (editing) {
        await api.put(`/addons/${editing.id}`, payload);
        toast.success('Add-on updated');
      } else {
        await api.post('/addons', payload);
        toast.success('Add-on created');
      }
      setShowDialog(false);
      fetchAddons();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (addon) => {
    if (!confirm(`Delete "${addon.name}"?`)) return;
    try {
      await api.delete(`/addons/${addon.id}`);
      toast.success('Add-on deleted');
      fetchAddons();
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="addons-page">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-outfit dark:text-white">Add-on Library</h1>
            <p className="text-muted-foreground text-sm">Central library of add-ons shared across menu items</p>
          </div>
          <Button onClick={handleCreate} className="bg-orange-500 hover:bg-orange-600" data-testid="create-addon-btn">
            <Plus size={16} className="mr-1" />New Add-on
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-3 text-stone-400" />
            <Input placeholder="Search add-ons..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" data-testid="addon-search" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-44" data-testid="addon-category-filter">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {allCategories.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={32} className="animate-spin text-orange-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Package size={48} className="mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium">No add-ons yet</p>
            <p className="text-sm">Create your first add-on to use across menu items</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {cat.charAt(0).toUpperCase() + cat.slice(1)} ({items.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {items.map(addon => (
                    <Card key={addon.id} className={`group transition-all hover:shadow-md ${!addon.is_active ? 'opacity-50' : ''}`} data-testid={`addon-card-${addon.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm dark:text-white truncate">{addon.name}</h3>
                            {addon.name_ar && <p className="text-xs text-muted-foreground truncate" dir="rtl">{addon.name_ar}</p>}
                          </div>
                          <span className="text-sm font-bold text-orange-600 ml-2 whitespace-nowrap">SAR {addon.price}</span>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <Badge variant="outline" className="text-[10px]">{addon.category}</Badge>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(addon)} data-testid={`edit-addon-${addon.id}`}>
                              <Edit size={13} />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => handleDelete(addon)} data-testid={`delete-addon-${addon.id}`}>
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-outfit">{editing ? 'Edit Add-on' : 'New Add-on'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name (English) *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Extra Cheese" data-testid="addon-form-name" />
            </div>
            <div>
              <Label>Name (Arabic)</Label>
              <Input value={form.name_ar} onChange={e => setForm({ ...form, name_ar: e.target.value })} placeholder="جبنة إضافية" dir="rtl" data-testid="addon-form-name-ar" />
            </div>
            <div>
              <Label>Default Price (SAR)</Label>
              <Input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} data-testid="addon-form-price" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger data-testid="addon-form-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allCategories.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex gap-2 mt-2">
                <Input placeholder="New category..." value={newCategory} onChange={e => setNewCategory(e.target.value)} className="flex-1 h-8 text-sm" />
                <Button size="sm" variant="outline" className="h-8" disabled={!newCategory.trim()} onClick={() => {
                  const cat = newCategory.trim().toLowerCase();
                  setForm({ ...form, category: cat });
                  setNewCategory('');
                }}>Add</Button>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-800 rounded-lg">
              <div><Label>Active</Label><p className="text-xs text-muted-foreground">Show in menu item add-on picker</p></div>
              <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600" data-testid="save-addon-btn">
              {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
              {editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
