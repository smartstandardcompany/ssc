import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Plus, Trash2, Edit2, Users, CircleDot, Armchair, Square, Circle,
  RectangleHorizontal, LayoutGrid, ChevronDown, RefreshCw
} from 'lucide-react';
import api from '@/lib/api';

const STATUS_COLORS = {
  available: { bg: 'bg-emerald-100 border-emerald-400', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  occupied: { bg: 'bg-red-100 border-red-400', text: 'text-red-700', dot: 'bg-red-500' },
  reserved: { bg: 'bg-amber-100 border-amber-400', text: 'text-amber-700', dot: 'bg-amber-500' },
  cleaning: { bg: 'bg-blue-100 border-blue-400', text: 'text-blue-700', dot: 'bg-blue-500' },
};

const SHAPES = [
  { id: 'square', label: 'Square', icon: Square },
  { id: 'round', label: 'Round', icon: Circle },
  { id: 'rectangle', label: 'Rectangle', icon: RectangleHorizontal },
];

function TableCard({ table, onEdit, onStatusChange, onDelete }) {
  const status = STATUS_COLORS[table.status] || STATUS_COLORS.available;
  return (
    <div
      className={`relative border-2 rounded-xl p-4 transition-all hover:shadow-lg cursor-pointer ${status.bg}`}
      data-testid={`table-${table.table_number}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold font-outfit text-lg">{table.table_number}</span>
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); onEdit(table); }} className="p-1 rounded hover:bg-white/50">
            <Edit2 size={14} className="text-stone-600" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(table); }} className="p-1 rounded hover:bg-white/50">
            <Trash2 size={14} className="text-red-500" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mb-2">
        <Users size={14} className={status.text} />
        <span className={`text-sm font-medium ${status.text}`}>{table.customer_count || 0}/{table.capacity}</span>
      </div>
      <div className="flex items-center justify-between">
        <Badge variant="outline" className={`text-xs capitalize ${status.text} border-current`}>
          <CircleDot size={10} className="mr-1" />{table.status}
        </Badge>
        {table.status === 'occupied' && table.current_order && (
          <span className="text-xs font-medium text-red-600">SAR {table.current_order.total}</span>
        )}
      </div>
      {table.status === 'cleaning' && (
        <Button
          size="sm" variant="outline"
          className="w-full mt-2 text-xs h-7 border-blue-300 text-blue-600 hover:bg-blue-50"
          onClick={(e) => { e.stopPropagation(); onStatusChange(table.id, 'available'); }}
          data-testid={`mark-available-${table.table_number}`}
        >
          Mark Available
        </Button>
      )}
    </div>
  );
}

export default function TableManagementPage() {
  const [sections, setSections] = useState([]);
  const [tables, setTables] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('all');

  // Dialog states
  const [showAddTable, setShowAddTable] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [editingTable, setEditingTable] = useState(null);

  // Form states
  const [tableForm, setTableForm] = useState({ table_number: '', section: '', capacity: 4, shape: 'square' });
  const [sectionForm, setSectionForm] = useState({ name: '', color: '#f97316', floor: 1 });

  const fetchData = useCallback(async () => {
    try {
      const [secRes, tabRes, statsRes] = await Promise.all([
        api.get('/tables/sections'),
        api.get('/tables'),
        api.get('/tables/stats'),
      ]);
      setSections(secRes.data);
      setTables(tabRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredTables = activeSection === 'all'
    ? tables
    : tables.filter(t => t.section === activeSection);

  const handleAddTable = async () => {
    if (!tableForm.table_number) { toast.error('Table number is required'); return; }
    try {
      if (editingTable) {
        await api.put(`/tables/${editingTable.id}`, tableForm);
        toast.success('Table updated');
      } else {
        await api.post('/tables', { ...tableForm, section: tableForm.section || sections[0]?.name || 'Main Hall' });
        toast.success('Table created');
      }
      setShowAddTable(false);
      setEditingTable(null);
      setTableForm({ table_number: '', section: '', capacity: 4, shape: 'square' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save table');
    }
  };

  const handleAddSection = async () => {
    if (!sectionForm.name) { toast.error('Section name is required'); return; }
    try {
      await api.post('/tables/sections', sectionForm);
      toast.success('Section created');
      setShowAddSection(false);
      setSectionForm({ name: '', color: '#f97316', floor: 1 });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create section');
    }
  };

  const handleDeleteTable = async (table) => {
    if (table.status === 'occupied') { toast.error('Cannot delete an occupied table'); return; }
    try {
      await api.delete(`/tables/${table.id}`);
      toast.success('Table deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete table');
    }
  };

  const handleDeleteSection = async (sectionId) => {
    try {
      await api.delete(`/tables/sections/${sectionId}`);
      toast.success('Section deleted');
      if (activeSection === sectionId) setActiveSection('all');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete section');
    }
  };

  const handleStatusChange = async (tableId, newStatus) => {
    try {
      if (newStatus === 'available') {
        await api.post(`/tables/${tableId}/mark-available`);
      } else {
        await api.post(`/tables/${tableId}/status`, { status: newStatus });
      }
      fetchData();
    } catch (err) {
      toast.error('Failed to update table status');
    }
  };

  const openEditTable = (table) => {
    setEditingTable(table);
    setTableForm({
      table_number: table.table_number,
      section: table.section,
      capacity: table.capacity,
      shape: table.shape || 'square',
    });
    setShowAddTable(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="table-management-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-outfit tracking-tight">Table Management</h1>
            <p className="text-muted-foreground text-sm mt-1">Design your restaurant floor plan and manage tables</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAddSection(true)} data-testid="add-section-btn">
              <Plus size={16} className="mr-1" /> Section
            </Button>
            <Button onClick={() => { setEditingTable(null); setTableForm({ table_number: '', section: sections[0]?.name || '', capacity: 4, shape: 'square' }); setShowAddTable(true); }} data-testid="add-table-btn">
              <Plus size={16} className="mr-1" /> Add Table
            </Button>
            <Button variant="ghost" size="icon" onClick={fetchData} data-testid="refresh-tables">
              <RefreshCw size={16} />
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Total', value: stats.total_tables, color: 'stone' },
              { label: 'Available', value: stats.available, color: 'emerald' },
              { label: 'Occupied', value: stats.occupied, color: 'red' },
              { label: 'Reserved', value: stats.reserved, color: 'amber' },
              { label: 'Cleaning', value: stats.cleaning, color: 'blue' },
              { label: 'Customers', value: stats.current_customers, color: 'orange' },
              { label: 'Occupancy', value: `${stats.occupancy_rate}%`, color: 'purple' },
            ].map(s => (
              <Card key={s.label} className="border-0 shadow-sm">
                <CardContent className="p-4 text-center">
                  <p className={`text-2xl font-bold font-outfit text-${s.color}-600`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Section Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveSection('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeSection === 'all' ? 'bg-orange-500 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
            data-testid="section-all"
          >
            <LayoutGrid size={14} className="inline mr-1.5" />All Sections
          </button>
          {sections.map(sec => (
            <div key={sec.id} className="flex items-center gap-1">
              <button
                onClick={() => setActiveSection(sec.name)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  activeSection === sec.name ? 'text-white' : 'text-stone-600 hover:opacity-80'
                }`}
                style={{
                  backgroundColor: activeSection === sec.name ? sec.color : `${sec.color}20`,
                  color: activeSection === sec.name ? 'white' : sec.color,
                }}
                data-testid={`section-${sec.name.toLowerCase().replace(/\s/g, '-')}`}
              >
                {sec.name}
              </button>
              <button onClick={() => handleDeleteSection(sec.id)} className="p-1 rounded hover:bg-red-50">
                <Trash2 size={12} className="text-red-400" />
              </button>
            </div>
          ))}
        </div>

        {/* Tables Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-32 bg-stone-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredTables.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="p-12 text-center">
              <Armchair size={48} className="mx-auto mb-4 text-stone-300" />
              <h3 className="font-semibold text-lg mb-2">No tables yet</h3>
              <p className="text-muted-foreground text-sm mb-4">Start by adding tables to your restaurant floor plan</p>
              <Button onClick={() => { setEditingTable(null); setShowAddTable(true); }}>
                <Plus size={16} className="mr-1" /> Add First Table
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredTables.map(table => (
              <TableCard
                key={table.id}
                table={table}
                onEdit={openEditTable}
                onStatusChange={handleStatusChange}
                onDelete={handleDeleteTable}
              />
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          {Object.entries(STATUS_COLORS).map(([status, colors]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-full ${colors.dot}`} />
              <span className="capitalize">{status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit Table Dialog */}
      <Dialog open={showAddTable} onOpenChange={setShowAddTable}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTable ? 'Edit Table' : 'Add New Table'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Table Number / Name</Label>
              <Input
                value={tableForm.table_number}
                onChange={(e) => setTableForm({ ...tableForm, table_number: e.target.value })}
                placeholder="e.g., T1, A1, VIP-1"
                className="mt-1"
                data-testid="table-number-input"
              />
            </div>
            <div>
              <Label>Section</Label>
              <Select value={tableForm.section} onValueChange={(v) => setTableForm({ ...tableForm, section: v })}>
                <SelectTrigger className="mt-1" data-testid="table-section-select">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map(s => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Capacity (seats)</Label>
              <Input
                type="number" min={1} max={20}
                value={tableForm.capacity}
                onChange={(e) => setTableForm({ ...tableForm, capacity: parseInt(e.target.value) || 1 })}
                className="mt-1"
                data-testid="table-capacity-input"
              />
            </div>
            <div>
              <Label>Shape</Label>
              <div className="flex gap-2 mt-1">
                {SHAPES.map(s => (
                  <Button
                    key={s.id}
                    variant={tableForm.shape === s.id ? 'default' : 'outline'}
                    className={`flex-1 ${tableForm.shape === s.id ? 'bg-orange-500' : ''}`}
                    onClick={() => setTableForm({ ...tableForm, shape: s.id })}
                  >
                    <s.icon size={16} className="mr-1" /> {s.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddTable(false); setEditingTable(null); }}>Cancel</Button>
            <Button onClick={handleAddTable} data-testid="save-table-btn">
              {editingTable ? 'Update Table' : 'Add Table'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Section Dialog */}
      <Dialog open={showAddSection} onOpenChange={setShowAddSection}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add New Section</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Section Name</Label>
              <Input
                value={sectionForm.name}
                onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                placeholder="e.g., Outdoor, VIP Room"
                className="mt-1"
                data-testid="section-name-input"
              />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-1">
                {['#f97316', '#22c55e', '#a855f7', '#3b82f6', '#ef4444', '#ec4899', '#14b8a6', '#eab308'].map(c => (
                  <button
                    key={c}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${sectionForm.color === c ? 'border-stone-800 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setSectionForm({ ...sectionForm, color: c })}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label>Floor</Label>
              <Input
                type="number" min={1} max={10}
                value={sectionForm.floor}
                onChange={(e) => setSectionForm({ ...sectionForm, floor: parseInt(e.target.value) || 1 })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSection(false)}>Cancel</Button>
            <Button onClick={handleAddSection} data-testid="save-section-btn">Add Section</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
