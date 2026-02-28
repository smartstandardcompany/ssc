import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Clock, DollarSign, Banknote, CreditCard, Building2, 
  PlayCircle, StopCircle, AlertTriangle, CheckCircle2, Loader2
} from 'lucide-react';
import api from '@/lib/api';

export default function CashierShiftModal({ open, onClose, onShiftChange }) {
  const [currentShift, setCurrentShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      fetchCurrentShift();
    }
  }, [open]);

  const fetchCurrentShift = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('cashier_token');
      const headers = { Authorization: `Bearer ${token}` };
      const { data } = await api.get('/cashier/shift/current', { headers });
      setCurrentShift(data);
      if (data) {
        setClosingCash(data.expected_cash?.toString() || '');
      }
    } catch (err) {
      console.error('Failed to fetch shift:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartShift = async () => {
    if (!openingCash || parseFloat(openingCash) < 0) {
      toast.error('Please enter a valid opening cash amount');
      return;
    }

    setActionLoading(true);
    try {
      const token = localStorage.getItem('cashier_token');
      const userData = JSON.parse(localStorage.getItem('cashier_user') || '{}');
      const headers = { Authorization: `Bearer ${token}` };
      
      const { data } = await api.post('/cashier/shift/start', {
        branch_id: userData.branch_id || 'default',
        opening_cash: parseFloat(openingCash),
        notes
      }, { headers });
      
      setCurrentShift(data);
      toast.success('Shift started successfully!');
      onShiftChange?.(data);
      setOpeningCash('');
      setNotes('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start shift');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndShift = async () => {
    if (!closingCash || parseFloat(closingCash) < 0) {
      toast.error('Please enter a valid closing cash amount');
      return;
    }

    setActionLoading(true);
    try {
      const token = localStorage.getItem('cashier_token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const { data } = await api.post('/cashier/shift/end', {
        closing_cash: parseFloat(closingCash),
        notes
      }, { headers });
      
      toast.success('Shift ended successfully!');
      onShiftChange?.(null);
      setCurrentShift(null);
      setClosingCash('');
      setNotes('');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to end shift');
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (val) => `SAR ${(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatTime = (isoStr) => {
    if (!isoStr) return '-';
    return new Date(isoStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-orange-500" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="shift-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-outfit">
            <Clock size={24} className="text-orange-500" />
            {currentShift ? 'Current Shift' : 'Start New Shift'}
          </DialogTitle>
        </DialogHeader>

        {currentShift ? (
          <div className="space-y-4">
            {/* Active Shift Info */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <Badge className="bg-emerald-500">Active Shift</Badge>
                <span className="text-sm text-emerald-700">Started: {formatTime(currentShift.started_at)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Opening Cash</p>
                  <p className="font-bold text-lg">{formatCurrency(currentShift.opening_cash)}</p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Total Sales</p>
                  <p className="font-bold text-lg text-emerald-600">{formatCurrency(currentShift.total_sales)}</p>
                </div>
              </div>
            </div>

            {/* Payment Breakdown */}
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium mb-3">Payment Breakdown</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg">
                    <Banknote size={16} className="text-emerald-600" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Cash</p>
                      <p className="font-semibold text-sm">{formatCurrency(currentShift.payment_breakdown?.cash)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                    <CreditCard size={16} className="text-blue-600" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Card</p>
                      <p className="font-semibold text-sm">{formatCurrency(currentShift.payment_breakdown?.card)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg">
                    <Building2 size={16} className="text-purple-600" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Online</p>
                      <p className="font-semibold text-sm">{formatCurrency(currentShift.payment_breakdown?.online)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg">
                    <DollarSign size={16} className="text-amber-600" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Credit</p>
                      <p className="font-semibold text-sm">{formatCurrency(currentShift.payment_breakdown?.credit)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Expected Cash */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={18} className="text-amber-600" />
                <span className="font-medium text-amber-800">Expected Cash in Drawer</span>
              </div>
              <p className="text-2xl font-bold text-amber-700">{formatCurrency(currentShift.expected_cash)}</p>
              <p className="text-xs text-amber-600 mt-1">Opening ({formatCurrency(currentShift.opening_cash)}) + Cash Sales ({formatCurrency(currentShift.payment_breakdown?.cash)})</p>
            </div>

            {/* End Shift Form */}
            <div className="space-y-3">
              <div>
                <Label>Closing Cash Count *</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">SAR</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={closingCash}
                    onChange={(e) => setClosingCash(e.target.value)}
                    className="pl-12 h-12 text-lg font-bold"
                    placeholder="0.00"
                    data-testid="closing-cash-input"
                  />
                </div>
              </div>
              
              {closingCash && parseFloat(closingCash) !== currentShift.expected_cash && (
                <div className={`p-3 rounded-lg ${parseFloat(closingCash) > currentShift.expected_cash ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'} border`}>
                  <div className="flex items-center gap-2">
                    {parseFloat(closingCash) > currentShift.expected_cash ? (
                      <CheckCircle2 size={18} className="text-emerald-600" />
                    ) : (
                      <AlertTriangle size={18} className="text-red-600" />
                    )}
                    <span className="font-medium">
                      Difference: {formatCurrency(parseFloat(closingCash) - currentShift.expected_cash)}
                    </span>
                  </div>
                  <p className="text-xs mt-1 text-muted-foreground">
                    {parseFloat(closingCash) > currentShift.expected_cash ? 'Overage detected' : 'Shortage detected'}
                  </p>
                </div>
              )}

              <div>
                <Label>Notes (optional)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes about this shift..."
                  className="mt-1"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button 
                onClick={handleEndShift}
                className="bg-red-500 hover:bg-red-600"
                disabled={actionLoading}
                data-testid="end-shift-btn"
              >
                {actionLoading ? (
                  <Loader2 size={16} className="animate-spin mr-2" />
                ) : (
                  <StopCircle size={16} className="mr-2" />
                )}
                End Shift
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Start Shift Form */}
            <p className="text-muted-foreground">Count the cash in your drawer to start your shift.</p>
            
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <Label className="text-orange-800">Opening Cash Count *</Label>
              <div className="relative mt-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">SAR</span>
                <Input
                  type="number"
                  step="0.01"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  className="pl-12 h-14 text-xl font-bold"
                  placeholder="0.00"
                  autoFocus
                  data-testid="opening-cash-input"
                />
              </div>
            </div>

            <div>
              <Label>Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes for this shift..."
                className="mt-1"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button 
                onClick={handleStartShift}
                className="bg-emerald-500 hover:bg-emerald-600"
                disabled={actionLoading || !openingCash}
                data-testid="start-shift-btn"
              >
                {actionLoading ? (
                  <Loader2 size={16} className="animate-spin mr-2" />
                ) : (
                  <PlayCircle size={16} className="mr-2" />
                )}
                Start Shift
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
