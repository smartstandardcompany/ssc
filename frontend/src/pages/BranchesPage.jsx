import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function BranchesPage() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [formData, setFormData] = useState({ name: '', location: '' });

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const response = await api.get('/branches');
      setBranches(response.data);
    } catch (error) {
      toast.error('Failed to fetch branches');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBranch) {
        await api.put(`/branches/${editingBranch.id}`, formData);
        toast.success('Branch updated successfully');
      } else {
        await api.post('/branches', formData);
        toast.success('Branch added successfully');
      }
      setShowDialog(false);
      resetForm();
      fetchBranches();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save branch');
    }
  };

  const handleEdit = (branch) => {
    setEditingBranch(branch);
    setFormData({ name: branch.name, location: branch.location || '' });
    setShowDialog(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this branch?')) {
      try {
        await api.delete(`/branches/${id}`);
        toast.success('Branch deleted successfully');
        fetchBranches();
      } catch (error) {
        toast.error('Failed to delete branch');
      }
    }
  };

  const resetForm = () => {
    setFormData({ name: '', location: '' });
    setEditingBranch(null);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold font-outfit mb-2" data-testid="branches-page-title">Branches</h1>
            <p className="text-muted-foreground">Manage your business branches</p>
          </div>
          <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="rounded-full" data-testid="add-branch-button">
                <Plus size={18} className="mr-2" />
                Add Branch
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="branch-dialog">
              <DialogHeader>
                <DialogTitle className="font-outfit">{editingBranch ? 'Edit Branch' : 'Add New Branch'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Branch Name *</Label>
                  <Input
                    value={formData.name}
                    data-testid="branch-name-input"
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="e.g., Downtown Store"
                  />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input
                    value={formData.location}
                    data-testid="branch-location-input"
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., New York"
                  />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" data-testid="submit-branch-button" className="rounded-full">
                    {editingBranch ? 'Update' : 'Add'} Branch
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowDialog(false)} className="rounded-full">
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches.map((branch) => (
            <Card key={branch.id} className="border-border hover:shadow-lg transition-shadow" data-testid="branch-card">
              <CardHeader>
                <CardTitle className="font-outfit flex items-start justify-between">
                  <span>{branch.name}</span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(branch)}
                      data-testid="edit-branch-button"
                    >
                      <Edit size={16} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(branch.id)}
                      data-testid="delete-branch-button"
                      className="text-error hover:text-error"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{branch.location || 'No location specified'}</p>
              </CardContent>
            </Card>
          ))}
          {branches.length === 0 && (
            <Card className="col-span-full border-dashed">
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">No branches yet. Add your first branch to get started!</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
