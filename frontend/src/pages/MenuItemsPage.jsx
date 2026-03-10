import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Plus, Search, Edit, Trash2, X, UtensilsCrossed,
  Save, Loader2, Star, Upload, Building2, Globe, Check, Download, Tag, Package, ListChecks
} from 'lucide-react';
import api from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBranchStore } from '@/stores';

const DEFAULT_CATEGORIES = [
  { id: 'main', name: 'Main Dishes' },
  { id: 'appetizer', name: 'Appetizers' },
  { id: 'beverage', name: 'Beverages' },
  { id: 'dessert', name: 'Desserts' },
  { id: 'sides', name: 'Sides' },
];

// ---- Small sub-components for the editor tabs ----

function SizesEditor({ sizes, onChange, branches, branchAvailability, onAvailChange }) {
  const addSize = () => onChange([...sizes, { name: '', price: 0 }]);
  const remove = (i) => onChange(sizes.filter((_, j) => j !== i));
  const update = (i, field, val) => {
    const next = [...sizes];
    next[i] = { ...next[i], [field]: field === 'price' ? (parseFloat(val) || 0) : val };
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
        <p className="text-xs text-blue-700 dark:text-blue-400">Add size variants. Each size has its own price. Toggle branch availability below each size.</p>
      </div>
      {sizes.map((size, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-3">
            <Input placeholder="Size name (e.g., Small)" value={size.name} onChange={e => update(i, 'name', e.target.value)} className="flex-1" data-testid={`size-name-${i}`} />
            <Input type="number" step="0.01" placeholder="Price" value={size.price} onChange={e => update(i, 'price', e.target.value)} className="w-28" data-testid={`size-price-${i}`} />
            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => remove(i)}><Trash2 size={14} /></Button>
          </div>
          {size.name && branches.length > 0 && (
            <div className="pl-2">
              <p className="text-[11px] text-muted-foreground mb-1">Available at:</p>
              <div className="flex flex-wrap gap-1">
                {branches.map(b => {
                  const avail = branchAvailability[b.id] || [];
                  const isOn = avail.includes(size.name);
                  return (
                    <Badge key={b.id} variant={isOn ? 'default' : 'outline'}
                      className={`text-[10px] cursor-pointer select-none ${isOn ? 'bg-orange-500' : ''}`}
                      onClick={() => {
                        const next = { ...branchAvailability };
                        const curr = next[b.id] || [];
                        next[b.id] = isOn ? curr.filter(s => s !== size.name) : [...curr, size.name];
                        onAvailChange(next);
                      }}
                      data-testid={`size-branch-${b.id}-${i}`}
                    >{b.name}</Badge>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ))}
      <Button variant="outline" className="w-full" onClick={addSize} data-testid="add-size-btn"><Plus size={16} className="mr-1" /> Add Size</Button>
    </div>
  );
}

function AddonsLinker({ linkedAddons, onChange, centralAddons, branches, branchAvailability, onAvailChange }) {
  const available = centralAddons.filter(a => a.is_active !== false);
  const toggle = (addonId) => {
    onChange(linkedAddons.includes(addonId) ? linkedAddons.filter(id => id !== addonId) : [...linkedAddons, addonId]);
  };

  return (
    <div className="space-y-4">
      <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg">
        <p className="text-xs text-emerald-700 dark:text-emerald-400">
          Select add-ons from the central library. Toggle branch availability for each.
          <a href="/addons" className="underline ml-1" target="_blank">Manage Library</a>
        </p>
      </div>
      {available.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No add-ons in library. <a href="/addons" className="text-orange-500 underline">Create some first</a>.</p>
      )}
      {available.map(addon => {
        const isLinked = linkedAddons.includes(addon.id);
        return (
          <div key={addon.id} className={`border rounded-lg p-3 space-y-2 transition-colors ${isLinked ? 'bg-emerald-50/50 border-emerald-300 dark:bg-emerald-900/10' : ''}`}>
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggle(addon.id)}>
              <Checkbox checked={isLinked} onCheckedChange={() => toggle(addon.id)} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">{addon.name}</span>
                {addon.name_ar && <span className="text-xs text-muted-foreground ml-2" dir="rtl">{addon.name_ar}</span>}
              </div>
              <Badge variant="outline" className="text-[10px]">{addon.category}</Badge>
              <span className="text-sm font-semibold text-orange-600">SAR {addon.price}</span>
            </div>
            {isLinked && branches.length > 0 && (
              <div className="pl-8">
                <p className="text-[11px] text-muted-foreground mb-1">Available at:</p>
                <div className="flex flex-wrap gap-1">
                  {branches.map(b => {
                    const avail = branchAvailability[b.id] || [];
                    const isOn = avail.includes(addon.id);
                    return (
                      <Badge key={b.id} variant={isOn ? 'default' : 'outline'}
                        className={`text-[10px] cursor-pointer select-none ${isOn ? 'bg-orange-500' : ''}`}
                        onClick={() => {
                          const next = { ...branchAvailability };
                          const curr = next[b.id] || [];
                          next[b.id] = isOn ? curr.filter(s => s !== addon.id) : [...curr, addon.id];
                          onAvailChange(next);
                        }}
                        data-testid={`addon-branch-${b.id}-${addon.id}`}
                      >{b.name}</Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OptionGroupsEditor({ groups, onChange, branches }) {
  const addGroup = () => onChange([...groups, { name: '', required: false, options: [{ name: '', price: 0 }], branch_availability: {} }]);
  const removeGroup = (i) => onChange(groups.filter((_, j) => j !== i));
  const updateGroup = (i, field, val) => {
    const next = [...groups];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };
  const addOption = (gi) => {
    const next = [...groups];
    next[gi].options = [...next[gi].options, { name: '', price: 0 }];
    onChange(next);
  };
  const removeOption = (gi, oi) => {
    const next = [...groups];
    next[gi].options = next[gi].options.filter((_, j) => j !== oi);
    onChange(next);
  };
  const updateOption = (gi, oi, field, val) => {
    const next = [...groups];
    const opts = [...next[gi].options];
    opts[oi] = { ...opts[oi], [field]: field === 'price' ? (parseFloat(val) || 0) : val };
    next[gi].options = opts;
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg">
        <p className="text-xs text-purple-700 dark:text-purple-400">
          Create single-choice modifier groups (e.g., "Bread Type": Pita / Saj). Customer picks one option.
        </p>
      </div>
      {groups.map((g, gi) => (
        <div key={gi} className="border rounded-lg p-3 space-y-3">
          <div className="flex items-center gap-3">
            <Input placeholder="Group name (e.g., Bread Type)" value={g.name} onChange={e => updateGroup(gi, 'name', e.target.value)} className="flex-1" data-testid={`optgroup-name-${gi}`} />
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Required</Label>
              <Switch checked={g.required} onCheckedChange={v => updateGroup(gi, 'required', v)} />
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => removeGroup(gi)}><Trash2 size={14} /></Button>
          </div>
          <div className="pl-2 space-y-2">
            {g.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <Input placeholder="Option name" value={opt.name} onChange={e => updateOption(gi, oi, 'name', e.target.value)} className="flex-1" data-testid={`optgroup-opt-name-${gi}-${oi}`} />
                <Input type="number" step="0.01" placeholder="Extra price" value={opt.price} onChange={e => updateOption(gi, oi, 'price', e.target.value)} className="w-24" data-testid={`optgroup-opt-price-${gi}-${oi}`} />
                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400" onClick={() => removeOption(gi, oi)}><X size={12} /></Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => addOption(gi)} data-testid={`add-option-${gi}`}><Plus size={12} className="mr-1" />Add Option</Button>
          </div>
          {branches.length > 0 && (
            <div className="pl-2">
              <p className="text-[11px] text-muted-foreground mb-1">Available at branches:</p>
              <div className="flex flex-wrap gap-1">
                {branches.map(b => {
                  const avail = g.branch_availability || {};
                  const isOn = avail[b.id] === true;
                  return (
                    <Badge key={b.id} variant={isOn ? 'default' : 'outline'}
                      className={`text-[10px] cursor-pointer select-none ${isOn ? 'bg-orange-500' : ''}`}
                      onClick={() => {
                        const next = { ...(g.branch_availability || {}) };
                        next[b.id] = !isOn;
                        updateGroup(gi, 'branch_availability', next);
                      }}
                    >{b.name}</Badge>
                  );
                })}
              </div>
              {Object.keys(g.branch_availability || {}).filter(k => g.branch_availability[k]).length === 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">No branches selected = available at all branches</p>
              )}
            </div>
          )}
        </div>
      ))}
      <Button variant="outline" className="w-full" onClick={addGroup} data-testid="add-optgroup-btn"><Plus size={16} className="mr-1" /> Add Option Group</Button>
    </div>
  );
}

// ---- Main Component ----

export default function MenuItemsPage() {
  const { t } = useLanguage();
  const { branches, fetchBranches } = useBranchStore();
  const [items, setItems] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [centralAddons, setCentralAddons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [bulkBranches, setBulkBranches] = useState([]);
  const [bulkPlatforms, setBulkPlatforms] = useState([]);
  const [showExport, setShowExport] = useState(false);
  const [exportPlatformId, setExportPlatformId] = useState('');
  const fileInputRef = useRef(null);
  const uploadItemRef = useRef(null);

  // Dynamic categories
  const [customCategories, setCustomCategories] = useState([]);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  const CATEGORIES = [
    ...DEFAULT_CATEGORIES,
    ...customCategories.map(c => ({ id: c.name.toLowerCase().replace(/\s+/g, '_'), name: c.name, dbId: c.id }))
  ];

  // V2 form state
  const emptyForm = {
    name: '', name_ar: '', description: '', category: 'main',
    price: '', cost_price: '', preparation_time: '10',
    is_available: true, tags: [], branch_ids: [], platform_ids: [], platform_prices: {},
    sizes: [], sizesBranchAvail: {},
    linkedAddonIds: [], addonsBranchAvail: {},
    optionGroups: [],
    branch_prices: {}
  };
  const [formData, setFormData] = useState(emptyForm);

  const fetchCategories = async () => {
    try { const { data } = await api.get('/categories?category_type=menu'); setCustomCategories(data || []); } catch {}
  };
  const addCategory = async () => {
    if (!newCategoryName.trim()) return;
    setSavingCategory(true);
    try {
      await api.post('/categories', { name: newCategoryName.trim(), type: 'menu' });
      toast.success(`Category "${newCategoryName.trim()}" added`);
      setNewCategoryName(''); setShowCategoryDialog(false); fetchCategories();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    finally { setSavingCategory(false); }
  };
  const deleteCategory = async (cat) => {
    if (!cat.dbId) return;
    try { await api.delete(`/categories/${cat.dbId}`); toast.success(`Category "${cat.name}" removed`); fetchCategories(); }
    catch { toast.error('Failed to delete category'); }
  };

  useEffect(() => {
    fetchBranches();
    fetchItems();
    fetchCategories();
    api.get('/platforms').then(r => setPlatforms(r.data || [])).catch(() => {});
    api.get('/addons').then(r => setCentralAddons(r.data || [])).catch(() => {});
  }, []);

  const fetchItems = async () => {
    try { const { data } = await api.get('/cashier/menu-all'); setItems(data); }
    catch { toast.error('Failed to fetch menu items'); }
    finally { setLoading(false); }
  };

  const filteredItems = items.filter(item => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (branchFilter !== 'all') {
      const bIds = item.branch_ids || [];
      if (bIds.length > 0 && !bIds.includes(branchFilter)) return false;
    }
    if (platformFilter !== 'all') {
      const pIds = item.platform_ids || [];
      if (!pIds.includes(platformFilter)) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(q) || item.name_ar?.toLowerCase().includes(q);
    }
    return true;
  });

  // Parse V2 modifier_groups back into form state for editing
  const parseModifierGroups = (item) => {
    const mgs = item.modifier_groups || [];
    const sizes = [];
    let sizesBranchAvail = {};
    const linkedAddonIds = [];
    let addonsBranchAvail = {};
    const optionGroups = [];

    // V2 groups
    for (const mg of mgs) {
      if (mg.type === 'size') {
        for (const opt of (mg.options || [])) sizes.push({ name: opt.name, price: opt.price || 0 });
        sizesBranchAvail = mg.branch_availability || {};
      } else if (mg.type === 'addon') {
        linkedAddonIds.push(...(mg.addon_ids || []));
        addonsBranchAvail = mg.branch_availability || {};
      } else if (mg.type === 'option') {
        optionGroups.push({
          name: mg.name, required: mg.required || false,
          options: mg.options || [], branch_availability: mg.branch_availability || {}
        });
      }
    }

    // Fallback: parse legacy V1 modifiers if no V2 groups exist
    if (mgs.length === 0 && (item.modifiers || []).length > 0) {
      for (const mod of item.modifiers) {
        if (mod.name === 'Size') {
          for (const opt of (mod.options || [])) sizes.push({ name: opt.name, price: opt.price || 0 });
        } else if (mod.name === 'Add-ons') {
          // V1 add-ons were inline, can't link to library - skip
        } else {
          optionGroups.push({
            name: mod.name, required: mod.required || false,
            options: mod.options || [], branch_availability: {}
          });
        }
      }
    }

    return { sizes, sizesBranchAvail, linkedAddonIds, addonsBranchAvail, optionGroups };
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    const parsed = parseModifierGroups(item);
    setFormData({
      name: item.name || '', name_ar: item.name_ar || '', description: item.description || '',
      category: item.category || 'main', price: item.price?.toString() || '',
      cost_price: item.cost_price?.toString() || '', preparation_time: item.preparation_time?.toString() || '10',
      is_available: item.is_available !== false, tags: item.tags || [],
      branch_ids: item.branch_ids || [], platform_ids: item.platform_ids || [],
      platform_prices: item.platform_prices || {},
      ...parsed,
      branch_prices: item.branch_prices || {}
    });
    setShowDialog(true);
  };

  const handleCreate = () => {
    setEditingItem(null);
    setFormData(emptyForm);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price) { toast.error('Name and price are required'); return; }
    setSaving(true);
    try {
      // Build V2 modifier_groups
      const modifier_groups = [];
      const validSizes = formData.sizes.filter(s => s.name);
      if (validSizes.length > 0) {
        modifier_groups.push({
          id: 'sizes', name: 'Size', type: 'size', required: true, multiple: false,
          options: validSizes.map(s => ({ name: s.name, price: s.price || 0 })),
          branch_availability: formData.sizesBranchAvail || {}
        });
      }
      if (formData.linkedAddonIds.length > 0) {
        modifier_groups.push({
          id: 'addons', name: 'Add-ons', type: 'addon', required: false, multiple: true,
          addon_ids: formData.linkedAddonIds,
          branch_availability: formData.addonsBranchAvail || {}
        });
      }
      for (const og of formData.optionGroups) {
        if (og.name && og.options.some(o => o.name)) {
          modifier_groups.push({
            id: og.name.toLowerCase().replace(/\s+/g, '_'),
            name: og.name, type: 'option', required: og.required || false, multiple: false,
            options: og.options.filter(o => o.name),
            branch_availability: og.branch_availability || {}
          });
        }
      }

      // Also build legacy modifiers for backward compat with POS orders
      const modifiers = [];
      if (validSizes.length > 0) {
        modifiers.push({ name: 'Size', required: true, multiple: false, options: validSizes });
      }
      // Resolve linked addons to inline options for legacy compat
      if (formData.linkedAddonIds.length > 0) {
        const addonOpts = formData.linkedAddonIds.map(id => {
          const a = centralAddons.find(x => x.id === id);
          return a ? { name: a.name, price: a.price, addon_id: a.id } : null;
        }).filter(Boolean);
        if (addonOpts.length > 0) modifiers.push({ name: 'Add-ons', required: false, multiple: true, options: addonOpts });
      }
      for (const og of formData.optionGroups) {
        if (og.name && og.options.some(o => o.name)) {
          modifiers.push({ name: og.name, required: og.required, multiple: false, options: og.options.filter(o => o.name) });
        }
      }

      const payload = {
        name: formData.name, name_ar: formData.name_ar, description: formData.description,
        category: formData.category, price: parseFloat(formData.price),
        cost_price: parseFloat(formData.cost_price) || 0,
        preparation_time: parseInt(formData.preparation_time) || 10,
        is_available: formData.is_available, tags: formData.tags,
        branch_ids: formData.branch_ids, platform_ids: formData.platform_ids,
        platform_prices: formData.platform_prices, branch_prices: formData.branch_prices || {},
        modifier_groups, modifiers
      };

      if (editingItem) {
        await api.put(`/cashier/menu/${editingItem.id}`, payload);
        toast.success('Item updated');
      } else {
        await api.post('/cashier/menu', payload);
        toast.success('Item created');
      }
      setShowDialog(false);
      fetchItems();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try { await api.delete(`/cashier/menu/${item.id}`); toast.success('Item deleted'); fetchItems(); }
    catch { toast.error('Failed to delete'); }
  };

  const handleImageUpload = async (item, file) => {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try { await api.post(`/cashier/menu/${item.id}/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); toast.success('Image uploaded'); fetchItems(); }
    catch { toast.error('Failed to upload'); }
    finally { setUploading(false); }
  };

  const toggleSelect = (id) => setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const selectAll = () => {
    if (selectedItems.length === filteredItems.length) setSelectedItems([]);
    else setSelectedItems(filteredItems.map(i => i.id));
  };

  const handleBulkAssign = async () => {
    try {
      if (bulkBranches.length > 0) await api.put('/cashier/menu/bulk-branch-assign', { item_ids: selectedItems, branch_ids: bulkBranches });
      if (bulkPlatforms.length > 0) await api.put('/cashier/menu/bulk-platform-assign', { item_ids: selectedItems, platform_ids: bulkPlatforms });
      toast.success(`Updated ${selectedItems.length} items`);
      setShowBulkAssign(false); setSelectedItems([]); fetchItems();
    } catch { toast.error('Failed to update'); }
  };

  const handleExport = async () => {
    if (!exportPlatformId) return;
    try {
      const { data } = await api.get(`/cashier/menu/export/${exportPlatformId}`);
      const text = data.items.map((item, i) => `${i+1}. ${item.name} | ${item.name_ar} | ${item.category} | SAR ${item.price} | ${item.preparation_time}min`).join('\n');
      const blob = new Blob([`Menu for ${data.platform} (${data.total_items} items)\n${'='.repeat(60)}\n\n${text}`], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `menu_${data.platform.replace(/\s/g,'_')}.txt`; a.click(); URL.revokeObjectURL(url);
      toast.success(`Exported ${data.total_items} items`); setShowExport(false);
    } catch { toast.error('Failed to export'); }
  };

  const toggleBranch = (branchId) => setFormData(prev => ({ ...prev, branch_ids: prev.branch_ids.includes(branchId) ? prev.branch_ids.filter(b => b !== branchId) : [...prev.branch_ids, branchId] }));
  const togglePlatform = (platformId) => setFormData(prev => ({ ...prev, platform_ids: prev.platform_ids.includes(platformId) ? prev.platform_ids.filter(p => p !== platformId) : [...prev.platform_ids, platformId] }));

  const getImageUrl = (item) => {
    if (!item.image_url) return null;
    if (item.image_url.startsWith('/')) return `${process.env.REACT_APP_BACKEND_URL || ''}${item.image_url}`;
    return item.image_url;
  };
  const getBranchName = (id) => branches.find(b => b.id === id)?.name || id;
  const getPlatformName = (id) => platforms.find(p => p.id === id)?.name || id;

  // Count modifier groups for display
  const getModifierCount = (item) => {
    const v2 = (item.modifier_groups || []).length;
    if (v2 > 0) return v2;
    return (item.modifiers || []).length;
  };

  const getModifierLabels = (item) => {
    const mgs = item.modifier_groups || [];
    if (mgs.length > 0) return mgs.map(mg => ({ name: mg.name, count: mg.type === 'addon' ? (mg.addon_ids || []).length : (mg.options || []).length }));
    return (item.modifiers || []).map(m => ({ name: m.name, count: m.options?.length || 0 }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="menu-items-page">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-outfit dark:text-white">Menu Management</h1>
            <p className="text-muted-foreground text-sm">Manage items, sizes, add-ons & branch availability</p>
          </div>
          <div className="flex gap-2">
            {selectedItems.length > 0 && (
              <Button variant="outline" onClick={() => setShowBulkAssign(true)} data-testid="bulk-assign-btn"><Building2 size={16} className="mr-1" />Assign ({selectedItems.length})</Button>
            )}
            <Button variant="outline" onClick={() => setShowExport(true)} data-testid="export-menu-btn"><Download size={16} className="mr-1" />Export</Button>
            <Button onClick={handleCreate} className="bg-orange-500 hover:bg-orange-600" data-testid="add-menu-item-btn"><Plus size={16} className="mr-1" />Add Item</Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-3 text-stone-400" />
            <Input placeholder="Search items..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <div className="flex gap-1">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-40" data-testid="category-filter"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="icon" variant="outline" className="h-10 w-10 shrink-0" onClick={() => setShowCategoryDialog(true)} data-testid="manage-categories-btn"><Tag size={16} /></Button>
          </div>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Branch" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Platform" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              {platforms.filter(p => p.name !== 'Other').map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox checked={selectedItems.length > 0 && selectedItems.length === filteredItems.length} onCheckedChange={selectAll} />
          <span className="text-sm text-muted-foreground">{selectedItems.length > 0 ? `${selectedItems.length} selected` : `${filteredItems.length} items`}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={32} className="animate-spin text-orange-500" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map(item => (
              <Card key={item.id} className={`overflow-hidden group transition-all ${selectedItems.includes(item.id) ? 'ring-2 ring-orange-500' : ''} ${!item.is_available ? 'opacity-60' : ''}`} data-testid={`menu-card-${item.id}`}>
                <div className="relative h-36 bg-gradient-to-br from-orange-100 to-amber-100 dark:from-stone-800 dark:to-stone-700 cursor-pointer" onClick={() => toggleSelect(item.id)}>
                  {item.image_url ? (
                    <img src={getImageUrl(item)} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><UtensilsCrossed size={40} className="text-orange-300 dark:text-stone-500" /></div>
                  )}
                  <div className="absolute top-2 left-2" onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selectedItems.includes(item.id)} onCheckedChange={() => toggleSelect(item.id)} className="bg-white/80" />
                  </div>
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" onClick={e => e.stopPropagation()}>
                    <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={e => { if (e.target.files[0] && uploadItemRef.current) handleImageUpload(uploadItemRef.current, e.target.files[0]); }} />
                    <Button size="sm" variant="secondary" onClick={() => { uploadItemRef.current = item; fileInputRef.current?.click(); }}>
                      <Upload size={14} className="mr-1" />{item.image_url ? 'Change' : 'Upload'}
                    </Button>
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1 flex-col items-end">
                    {item.tags?.includes('popular') && <Badge className="bg-amber-500 text-[10px]"><Star size={10} className="mr-0.5" />Popular</Badge>}
                    {!item.is_available && <Badge variant="destructive" className="text-[10px]">Unavailable</Badge>}
                  </div>
                </div>
                <CardContent className="p-3">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm dark:text-white truncate">{item.name}</h3>
                      {item.name_ar && <p className="text-xs text-muted-foreground truncate" dir="rtl">{item.name_ar}</p>}
                    </div>
                    <span className="text-sm font-bold text-orange-600 ml-2 whitespace-nowrap">SAR {item.price}</span>
                  </div>
                  {getModifierCount(item) > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {getModifierLabels(item).map((m, mi) => (
                        <Badge key={mi} variant="outline" className="text-[9px] py-0">{m.name}: {m.count}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(!item.branch_ids || item.branch_ids.length === 0) ? (
                      <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">All Branches</Badge>
                    ) : (
                      item.branch_ids.slice(0, 2).map(bid => (
                        <Badge key={bid} variant="outline" className="text-[9px]"><Building2 size={8} className="mr-0.5" />{getBranchName(bid)}</Badge>
                      ))
                    )}
                    {(item.branch_ids?.length || 0) > 2 && <Badge variant="outline" className="text-[9px]">+{item.branch_ids.length - 2}</Badge>}
                  </div>
                  {item.platform_ids?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.platform_ids.slice(0, 3).map(pid => (
                        <Badge key={pid} className="text-[9px] bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"><Globe size={8} className="mr-0.5" />{getPlatformName(pid)}</Badge>
                      ))}
                      {item.platform_ids.length > 3 && <Badge className="text-[9px] bg-blue-100 text-blue-700">+{item.platform_ids.length - 3}</Badge>}
                    </div>
                  )}
                  <div className="flex justify-end gap-1 mt-2">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(item)} data-testid={`edit-${item.id}`}><Edit size={13} /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => handleDelete(item)} data-testid={`delete-${item.id}`}><Trash2 size={13} /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredItems.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground">No items found</div>}
          </div>
        )}
      </div>

      {/* V2 Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-outfit">{editingItem ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="details" className="flex-1 min-w-[80px]">Details</TabsTrigger>
              <TabsTrigger value="sizes" className="flex-1 min-w-[80px]" data-testid="sizes-tab">Sizes</TabsTrigger>
              <TabsTrigger value="addons" className="flex-1 min-w-[80px]" data-testid="addons-tab">Add-ons</TabsTrigger>
              <TabsTrigger value="options" className="flex-1 min-w-[80px]" data-testid="options-tab">Options</TabsTrigger>
              <TabsTrigger value="branches" className="flex-1 min-w-[80px]" data-testid="branches-tab">Branches</TabsTrigger>
              <TabsTrigger value="platforms" className="flex-1 min-w-[80px]" data-testid="platforms-tab">Platforms</TabsTrigger>
            </TabsList>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Name (English) *</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Chicken Shawarma" /></div>
                <div><Label>Name (Arabic)</Label><Input value={formData.name_ar} onChange={e => setFormData({...formData, name_ar: e.target.value})} placeholder="شاورما دجاج" dir="rtl" /></div>
              </div>
              <div><Label>Description</Label><Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={2} /></div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Category</Label>
                  <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Price (SAR) *</Label><Input type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} /></div>
                <div><Label>Cost Price</Label><Input type="number" step="0.01" value={formData.cost_price} onChange={e => setFormData({...formData, cost_price: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Prep Time (min)</Label><Input type="number" value={formData.preparation_time} onChange={e => setFormData({...formData, preparation_time: e.target.value})} /></div>
                <div className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-800 rounded-lg">
                  <div><Label>Available</Label><p className="text-xs text-muted-foreground">Show in POS</p></div>
                  <Switch checked={formData.is_available} onCheckedChange={v => setFormData({...formData, is_available: v})} />
                </div>
              </div>
              <div>
                <Label>Tags</Label>
                <div className="flex gap-2 mt-2">
                  {['popular', 'new', 'spicy', 'vegetarian'].map(tag => (
                    <Button key={tag} type="button" size="sm"
                      variant={formData.tags.includes(tag) ? 'default' : 'outline'}
                      className={formData.tags.includes(tag) ? 'bg-orange-500' : ''}
                      onClick={() => setFormData(prev => ({...prev, tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag]}))}>
                      {tag}
                    </Button>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Sizes Tab */}
            <TabsContent value="sizes">
              <SizesEditor
                sizes={formData.sizes}
                onChange={sizes => setFormData({...formData, sizes})}
                branches={branches}
                branchAvailability={formData.sizesBranchAvail}
                onAvailChange={sizesBranchAvail => setFormData({...formData, sizesBranchAvail})}
              />
            </TabsContent>

            {/* Add-ons Tab (linked from library) */}
            <TabsContent value="addons">
              <AddonsLinker
                linkedAddons={formData.linkedAddonIds}
                onChange={linkedAddonIds => setFormData({...formData, linkedAddonIds})}
                centralAddons={centralAddons}
                branches={branches}
                branchAvailability={formData.addonsBranchAvail}
                onAvailChange={addonsBranchAvail => setFormData({...formData, addonsBranchAvail})}
              />
            </TabsContent>

            {/* Option Groups Tab */}
            <TabsContent value="options">
              <OptionGroupsEditor
                groups={formData.optionGroups}
                onChange={optionGroups => setFormData({...formData, optionGroups})}
                branches={branches}
              />
            </TabsContent>

            {/* Branches Tab */}
            <TabsContent value="branches" className="space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-400">Select which branches can sell this item. Leave empty for <strong>all branches</strong>. Set branch-specific prices.</p>
              </div>
              <div className="space-y-2">
                {branches.map(b => (
                  <div key={b.id} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${formData.branch_ids.includes(b.id) ? 'bg-orange-50 border-orange-300 dark:bg-orange-900/10 dark:border-orange-700' : 'dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800'}`}
                    onClick={() => toggleBranch(b.id)} data-testid={`branch-toggle-${b.id}`}>
                    <Checkbox checked={formData.branch_ids.includes(b.id)} onCheckedChange={() => toggleBranch(b.id)} />
                    <Building2 size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium dark:text-white flex-1">{b.name}</span>
                    {formData.branch_ids.includes(b.id) && (
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <Label className="text-xs whitespace-nowrap">Price:</Label>
                        <Input type="number" step="0.01" className="w-24 h-8 text-sm"
                          placeholder={formData.price || 'Same'}
                          value={formData.branch_prices[b.id] || ''}
                          onChange={e => setFormData(prev => ({ ...prev, branch_prices: {...prev.branch_prices, [b.id]: e.target.value ? parseFloat(e.target.value) : undefined} }))}
                          data-testid={`branch-price-${b.id}`}
                        />
                      </div>
                    )}
                    {formData.branch_ids.includes(b.id) && !formData.branch_prices[b.id] && <Check size={16} className="text-orange-500" />}
                  </div>
                ))}
              </div>
              {formData.branch_ids.length === 0 && <Badge className="bg-emerald-100 text-emerald-700 text-xs">Available at all branches</Badge>}
            </TabsContent>

            {/* Platforms Tab */}
            <TabsContent value="platforms" className="space-y-4">
              <div className="p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg">
                <p className="text-xs text-purple-700 dark:text-purple-400">Select delivery platforms. Set different prices per platform.</p>
              </div>
              <div className="space-y-2">
                {platforms.filter(p => p.name !== 'Other').map(p => (
                  <div key={p.id} className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${formData.platform_ids.includes(p.id) ? 'bg-purple-50 border-purple-300 dark:bg-purple-900/10 dark:border-purple-700' : 'dark:border-stone-700'}`}>
                    <Checkbox checked={formData.platform_ids.includes(p.id)} onCheckedChange={() => togglePlatform(p.id)} />
                    <Globe size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium dark:text-white flex-1">{p.name} <span className="text-xs text-muted-foreground">{p.name_ar}</span></span>
                    {formData.platform_ids.includes(p.id) && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs whitespace-nowrap">Platform Price:</Label>
                        <Input type="number" step="0.01" className="w-24 h-8 text-sm"
                          placeholder={formData.price || 'Same'}
                          value={formData.platform_prices[p.id] || ''}
                          onChange={e => setFormData(prev => ({ ...prev, platform_prices: {...prev.platform_prices, [p.id]: e.target.value ? parseFloat(e.target.value) : undefined} }))}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600" data-testid="save-menu-item-btn">
              {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
              {editingItem ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Dialog */}
      <Dialog open={showBulkAssign} onOpenChange={setShowBulkAssign}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-outfit">Bulk Assign ({selectedItems.length} items)</DialogTitle></DialogHeader>
          <Tabs defaultValue="branches">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="branches" className="flex-1">Branches</TabsTrigger>
              <TabsTrigger value="platforms" className="flex-1">Platforms</TabsTrigger>
            </TabsList>
            <TabsContent value="branches" className="space-y-2">
              {branches.map(b => (
                <div key={b.id} className="flex items-center gap-3 p-2 border rounded-lg dark:border-stone-700 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800"
                  onClick={() => setBulkBranches(prev => prev.includes(b.id) ? prev.filter(i => i !== b.id) : [...prev, b.id])}>
                  <Checkbox checked={bulkBranches.includes(b.id)} onCheckedChange={() => setBulkBranches(prev => prev.includes(b.id) ? prev.filter(i => i !== b.id) : [...prev, b.id])} />
                  <Building2 size={14} /><span className="text-sm">{b.name}</span>
                </div>
              ))}
            </TabsContent>
            <TabsContent value="platforms" className="space-y-2">
              {platforms.filter(p => p.name !== 'Other').map(p => (
                <div key={p.id} className="flex items-center gap-3 p-2 border rounded-lg dark:border-stone-700 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800"
                  onClick={() => setBulkPlatforms(prev => prev.includes(p.id) ? prev.filter(i => i !== p.id) : [...prev, p.id])}>
                  <Checkbox checked={bulkPlatforms.includes(p.id)} onCheckedChange={() => setBulkPlatforms(prev => prev.includes(p.id) ? prev.filter(i => i !== p.id) : [...prev, p.id])} />
                  <Globe size={14} /><span className="text-sm">{p.name}</span>
                </div>
              ))}
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkAssign(false)}>Cancel</Button>
            <Button onClick={handleBulkAssign} className="bg-orange-500 hover:bg-orange-600"><Check size={16} className="mr-1" />Apply to {selectedItems.length} items</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Menu Dialog */}
      <Dialog open={showExport} onOpenChange={setShowExport}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-outfit flex items-center gap-2"><Download size={18} className="text-orange-500" />Export Menu for Platform</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Platform</Label>
              <Select value={exportPlatformId} onValueChange={setExportPlatformId}>
                <SelectTrigger><SelectValue placeholder="Choose platform..." /></SelectTrigger>
                <SelectContent>
                  {platforms.filter(p => p.name !== 'Other').map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.name_ar})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExport(false)}>Cancel</Button>
            <Button onClick={handleExport} disabled={!exportPlatformId} className="bg-orange-500 hover:bg-orange-600"><Download size={16} className="mr-1" />Export Menu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Management Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-outfit">Manage Menu Categories</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input placeholder="New category name..." value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCategory()} className="flex-1" data-testid="new-category-input" />
              <Button onClick={addCategory} disabled={savingCategory || !newCategoryName.trim()} className="bg-orange-500 hover:bg-orange-600" data-testid="add-category-btn">
                {savingCategory ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              </Button>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Default Categories</p>
              <div className="space-y-1">
                {DEFAULT_CATEGORIES.map(c => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-stone-50 rounded-lg">
                    <span className="text-sm">{c.name}</span>
                    <Badge variant="outline" className="text-[10px]">Built-in</Badge>
                  </div>
                ))}
              </div>
            </div>
            {customCategories.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Custom Categories</p>
                <div className="space-y-1">
                  {customCategories.map(c => (
                    <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-orange-50 rounded-lg">
                      <span className="text-sm">{c.name}</span>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => deleteCategory({ dbId: c.id, name: c.name })} data-testid={`delete-cat-${c.id}`}><Trash2 size={14} /></Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
