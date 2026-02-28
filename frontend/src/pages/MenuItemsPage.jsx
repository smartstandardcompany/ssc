import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  Plus, Search, Edit, Trash2, ImagePlus, X, UtensilsCrossed,
  Save, Loader2, Star, Coffee, Cake, Pizza, Salad, Grid, Upload
} from 'lucide-react';
import api from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

const CATEGORIES = [
  { id: 'main', name: 'Main Dishes', icon: UtensilsCrossed },
  { id: 'appetizer', name: 'Appetizers', icon: Salad },
  { id: 'beverage', name: 'Beverages', icon: Coffee },
  { id: 'dessert', name: 'Desserts', icon: Cake },
  { id: 'sides', name: 'Sides', icon: Pizza },
];

export default function MenuItemsPage() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    name_ar: '',
    description: '',
    category: 'main',
    price: '',
    cost_price: '',
    preparation_time: '10',
    is_available: true,
    tags: [],
  });

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const { data } = await api.get('/cashier/menu');
      setItems(data);
    } catch (err) {
      toast.error('Failed to fetch menu items');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(q) || item.name_ar?.toLowerCase().includes(q);
    }
    return true;
  });

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      name_ar: item.name_ar || '',
      description: item.description || '',
      category: item.category || 'main',
      price: item.price?.toString() || '',
      cost_price: item.cost_price?.toString() || '',
      preparation_time: item.preparation_time?.toString() || '10',
      is_available: item.is_available !== false,
      tags: item.tags || [],
    });
    setShowDialog(true);
  };

  const handleCreate = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      name_ar: '',
      description: '',
      category: 'main',
      price: '',
      cost_price: '',
      preparation_time: '10',
      is_available: true,
      tags: [],
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price) {
      toast.error('Name and price are required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        cost_price: parseFloat(formData.cost_price) || 0,
        preparation_time: parseInt(formData.preparation_time) || 10,
      };

      if (editingItem) {
        await api.put(`/cashier/menu/${editingItem.id}`, payload);
        toast.success('Item updated successfully');
      } else {
        await api.post('/cashier/menu', payload);
        toast.success('Item created successfully');
      }

      setShowDialog(false);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    
    try {
      await api.delete(`/cashier/menu/${item.id}`);
      toast.success('Item deleted');
      fetchItems();
    } catch (err) {
      toast.error('Failed to delete item');
    }
  };

  const handleImageUpload = async (item, file) => {
    if (!file) return;
    
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.post(`/cashier/menu/${item.id}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Image uploaded');
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (item) => {
    try {
      await api.delete(`/cashier/menu/${item.id}/image`);
      toast.success('Image removed');
      fetchItems();
    } catch (err) {
      toast.error('Failed to remove image');
    }
  };

  const toggleTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) 
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  const getImageUrl = (item) => {
    if (!item.image_url) return null;
    // If it's a relative URL, prepend the backend URL
    if (item.image_url.startsWith('/')) {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      return `${backendUrl}${item.image_url}`;
    }
    return item.image_url;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="menu-items-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-outfit">Menu Items</h1>
            <p className="text-muted-foreground">Manage your restaurant menu</p>
          </div>
          <Button onClick={handleCreate} className="bg-orange-500 hover:bg-orange-600" data-testid="add-menu-item-btn">
            <Plus size={18} className="mr-2" />
            Add Item
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-3 text-stone-400" />
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Items Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-orange-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map(item => (
              <Card key={item.id} className="overflow-hidden group" data-testid={`menu-card-${item.id}`}>
                {/* Image Area */}
                <div className="relative h-40 bg-gradient-to-br from-orange-100 to-amber-100">
                  {item.image_url ? (
                    <img 
                      src={getImageUrl(item)} 
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <UtensilsCrossed size={48} className="text-orange-300" />
                    </div>
                  )}
                  
                  {/* Image Actions Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={(e) => {
                        if (e.target.files[0]) {
                          handleImageUpload(item, e.target.files[0]);
                        }
                      }}
                    />
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={() => {
                        fileInputRef.current.setAttribute('data-item-id', item.id);
                        fileInputRef.current.click();
                      }}
                      disabled={uploading}
                    >
                      <Upload size={14} className="mr-1" />
                      {item.image_url ? 'Change' : 'Upload'}
                    </Button>
                    {item.image_url && (
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleDeleteImage(item)}
                      >
                        <X size={14} />
                      </Button>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex gap-1">
                    {item.tags?.includes('popular') && (
                      <Badge className="bg-amber-500"><Star size={10} className="mr-1" />Popular</Badge>
                    )}
                    {!item.is_available && (
                      <Badge variant="destructive">Unavailable</Badge>
                    )}
                  </div>
                </div>

                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold">{item.name}</h3>
                      {item.name_ar && <p className="text-sm text-muted-foreground" dir="rtl">{item.name_ar}</p>}
                    </div>
                    <Badge variant="outline" className="capitalize">{item.category}</Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-orange-600">SAR {item.price}</span>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(item)}>
                        <Edit size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => handleDelete(item)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredItems.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No items found
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <Label>Name (English) *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Chicken Shawarma"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label>Name (Arabic)</Label>
                <Input
                  value={formData.name_ar}
                  onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                  placeholder="شاورما دجاج"
                  dir="rtl"
                />
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="A delicious..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category *</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prep Time (min)</Label>
                <Input
                  type="number"
                  value={formData.preparation_time}
                  onChange={(e) => setFormData({ ...formData, preparation_time: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price (SAR) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="25.00"
                />
              </div>
              <div>
                <Label>Cost Price (SAR)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.cost_price}
                  onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                  placeholder="12.00"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
              <div>
                <Label>Available</Label>
                <p className="text-xs text-muted-foreground">Show this item in POS</p>
              </div>
              <Switch
                checked={formData.is_available}
                onCheckedChange={(v) => setFormData({ ...formData, is_available: v })}
              />
            </div>

            <div>
              <Label>Tags</Label>
              <div className="flex gap-2 mt-2">
                {['popular', 'new', 'spicy', 'vegetarian'].map(tag => (
                  <Button
                    key={tag}
                    type="button"
                    size="sm"
                    variant={formData.tags.includes(tag) ? 'default' : 'outline'}
                    className={formData.tags.includes(tag) ? 'bg-orange-500' : ''}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
              {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
              {editingItem ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
