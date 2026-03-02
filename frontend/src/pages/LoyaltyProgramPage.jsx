import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Award, Settings, Trophy, Gift, Star, Crown, TrendingUp, Users, Coins } from 'lucide-react';

export default function LoyaltyProgramPage() {
  const [settings, setSettings] = useState(null);
  const [leaderboard, setLeaderboard] = useState({ leaderboard: [], total_points_issued: 0, total_points_redeemed: 0 });
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerLoyalty, setCustomerLoyalty] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [settingsRes, leaderboardRes, customersRes] = await Promise.all([
        api.get('/loyalty/settings'),
        api.get('/loyalty/leaderboard'),
        api.get('/customers')
      ]);
      setSettings(settingsRes.data);
      setLeaderboard(leaderboardRes.data);
      setCustomers(customersRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      await api.post('/loyalty/settings', newSettings);
      toast.success('Loyalty settings updated');
      setSettings(newSettings);
      setShowSettings(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update settings');
    }
  };

  const fetchCustomerLoyalty = async (customerId) => {
    try {
      const res = await api.get(`/customers/${customerId}/loyalty`);
      setCustomerLoyalty(res.data);
      setSelectedCustomer(customers.find(c => c.id === customerId));
    } catch (err) {
      toast.error('Failed to fetch customer loyalty data');
    }
  };

  const handleEarnPoints = async (customerId, amount) => {
    try {
      const res = await api.post(`/customers/${customerId}/loyalty/earn`, { amount });
      toast.success(`Earned ${res.data.points_earned} points!`);
      fetchCustomerLoyalty(customerId);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to earn points');
    }
  };

  const handleRedeemPoints = async (customerId, points) => {
    try {
      const res = await api.post(`/customers/${customerId}/loyalty/redeem`, { points });
      toast.success(`Redeemed ${points} points for SAR ${res.data.discount_value} discount!`);
      fetchCustomerLoyalty(customerId);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to redeem points');
    }
  };

  const getTierIcon = (tierName) => {
    switch (tierName?.toLowerCase()) {
      case 'platinum': return <Crown className="text-purple-500" size={16} />;
      case 'gold': return <Star className="text-yellow-500" size={16} />;
      case 'silver': return <Award className="text-gray-400" size={16} />;
      default: return <Award className="text-amber-700" size={16} />;
    }
  };

  const getTierColor = (tierName) => {
    switch (tierName?.toLowerCase()) {
      case 'platinum': return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'gold': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'silver': return 'bg-gray-100 text-gray-700 border-gray-300';
      default: return 'bg-amber-100 text-amber-700 border-amber-300';
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64">Loading...</div>;

  return (
    <div className="space-y-4 p-4" data-testid="loyalty-program-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Gift className="text-purple-500" /> Loyalty Program
        </h1>
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" data-testid="loyalty-settings-btn">
              <Settings size={16} className="mr-1" /> Settings
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Loyalty Program Settings</DialogTitle>
            </DialogHeader>
            {settings && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Program Enabled</Label>
                  <Switch 
                    checked={settings.enabled} 
                    onCheckedChange={(v) => setSettings({...settings, enabled: v})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Points per SAR</Label>
                    <Input 
                      type="number" 
                      value={settings.points_per_sar}
                      onChange={(e) => setSettings({...settings, points_per_sar: parseFloat(e.target.value)})}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">SAR per Point</Label>
                    <Input 
                      type="number" 
                      step="0.01"
                      value={settings.sar_per_point}
                      onChange={(e) => setSettings({...settings, sar_per_point: parseFloat(e.target.value)})}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Min Redeem Points</Label>
                    <Input 
                      type="number" 
                      value={settings.min_redeem_points}
                      onChange={(e) => setSettings({...settings, min_redeem_points: parseInt(e.target.value)})}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Welcome Bonus</Label>
                    <Input 
                      type="number" 
                      value={settings.welcome_bonus || 0}
                      onChange={(e) => setSettings({...settings, welcome_bonus: parseInt(e.target.value)})}
                    />
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <Label className="text-xs mb-2 block">Tier Levels</Label>
                  <div className="space-y-2">
                    {settings.tier_levels?.map((tier, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        {getTierIcon(tier.name)}
                        <span className="font-medium w-20">{tier.name}</span>
                        <Input 
                          className="h-8 w-20" 
                          type="number" 
                          value={tier.min_points}
                          onChange={(e) => {
                            const tiers = [...settings.tier_levels];
                            tiers[i].min_points = parseInt(e.target.value);
                            setSettings({...settings, tier_levels: tiers});
                          }}
                          placeholder="Min pts"
                        />
                        <Input 
                          className="h-8 w-16" 
                          type="number" 
                          step="0.1"
                          value={tier.multiplier}
                          onChange={(e) => {
                            const tiers = [...settings.tier_levels];
                            tiers[i].multiplier = parseFloat(e.target.value);
                            setSettings({...settings, tier_levels: tiers});
                          }}
                          placeholder="x"
                        />
                        <span className="text-xs text-muted-foreground">x</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Button className="w-full" onClick={() => updateSettings(settings)} data-testid="save-loyalty-settings">
                  Save Settings
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Status Banner */}
      {settings && (
        <Card className={`${settings.enabled ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className={settings.enabled ? 'bg-emerald-500' : 'bg-amber-500'}>
                  {settings.enabled ? 'Active' : 'Inactive'}
                </Badge>
                <span className="text-sm">
                  {settings.points_per_sar} point per SAR | 
                  1 point = SAR {settings.sar_per_point}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                Min redeem: {settings.min_redeem_points} pts
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="py-3 text-center">
            <Coins className="mx-auto mb-1 text-purple-500" size={24} />
            <p className="text-xs text-purple-600">Points Issued</p>
            <p className="text-xl font-bold text-purple-700">{leaderboard.total_points_issued?.toLocaleString() || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-pink-50 to-pink-100 border-pink-200">
          <CardContent className="py-3 text-center">
            <Gift className="mx-auto mb-1 text-pink-500" size={24} />
            <p className="text-xs text-pink-600">Points Redeemed</p>
            <p className="text-xl font-bold text-pink-700">{leaderboard.total_points_redeemed?.toLocaleString() || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="py-3 text-center">
            <Users className="mx-auto mb-1 text-blue-500" size={24} />
            <p className="text-xs text-blue-600">Members</p>
            <p className="text-xl font-bold text-blue-700">{leaderboard.total_customers_with_points || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardContent className="py-3 text-center">
            <TrendingUp className="mx-auto mb-1 text-emerald-500" size={24} />
            <p className="text-xs text-emerald-600">Total Value</p>
            <p className="text-xl font-bold text-emerald-700">
              SAR {((leaderboard.total_points_issued - leaderboard.total_points_redeemed) * (settings?.sar_per_point || 0.1)).toFixed(0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="leaderboard">
        <TabsList>
          <TabsTrigger value="leaderboard"><Trophy size={14} className="mr-1" /> Leaderboard</TabsTrigger>
          <TabsTrigger value="customers"><Users size={14} className="mr-1" /> All Customers</TabsTrigger>
        </TabsList>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Trophy className="text-yellow-500" size={18} /> Top Loyalty Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {leaderboard.leaderboard?.slice(0, 20).map((customer, index) => (
                  <div 
                    key={customer.customer_id} 
                    className={`flex items-center justify-between p-3 rounded-xl border ${
                      index === 0 ? 'bg-yellow-50 border-yellow-200' :
                      index === 1 ? 'bg-gray-50 border-gray-200' :
                      index === 2 ? 'bg-amber-50 border-amber-200' : 'bg-white'
                    }`}
                    data-testid={`leaderboard-item-${index}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        index === 0 ? 'bg-yellow-400 text-yellow-900' :
                        index === 1 ? 'bg-gray-300 text-gray-700' :
                        index === 2 ? 'bg-amber-400 text-amber-900' : 'bg-stone-100 text-stone-600'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{customer.customer_name}</p>
                        <div className="flex items-center gap-1">
                          {getTierIcon(customer.tier)}
                          <Badge variant="outline" className={`text-[10px] ${getTierColor(customer.tier)}`}>
                            {customer.tier}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-purple-600">{customer.points_balance.toLocaleString()} pts</p>
                      <p className="text-xs text-muted-foreground">SAR {customer.value_sar}</p>
                    </div>
                  </div>
                ))}
                {(!leaderboard.leaderboard || leaderboard.leaderboard.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Trophy size={48} className="mx-auto mb-2 opacity-30" />
                    <p>No loyalty members yet</p>
                    <p className="text-xs">Points will appear here after customers make purchases</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Customers Tab */}
        <TabsContent value="customers">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map(customer => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{customer.phone || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => fetchCustomerLoyalty(customer.id)}
                              data-testid={`view-loyalty-${customer.id}`}
                            >
                              <Award size={14} className="mr-1" /> View Loyalty
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>{selectedCustomer?.name}'s Loyalty</DialogTitle>
                            </DialogHeader>
                            {customerLoyalty && (
                              <div className="space-y-4">
                                {/* Points Summary */}
                                <div className="text-center p-4 bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl">
                                  <div className="flex items-center justify-center gap-2 mb-1">
                                    {getTierIcon(customerLoyalty.current_tier?.name)}
                                    <Badge className={getTierColor(customerLoyalty.current_tier?.name)}>
                                      {customerLoyalty.current_tier?.name}
                                    </Badge>
                                  </div>
                                  <p className="text-3xl font-bold text-purple-600">
                                    {customerLoyalty.points_balance?.toLocaleString()} pts
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    Worth SAR {customerLoyalty.points_value_sar}
                                  </p>
                                  {customerLoyalty.next_tier && (
                                    <p className="text-xs text-purple-500 mt-1">
                                      {customerLoyalty.points_to_next_tier} pts to {customerLoyalty.next_tier.name}
                                    </p>
                                  )}
                                </div>

                                {/* Quick Stats */}
                                <div className="grid grid-cols-2 gap-2 text-center text-sm">
                                  <div className="p-2 bg-emerald-50 rounded-lg">
                                    <p className="text-xs text-emerald-600">Earned</p>
                                    <p className="font-bold text-emerald-700">{customerLoyalty.points_earned_total?.toLocaleString()}</p>
                                  </div>
                                  <div className="p-2 bg-pink-50 rounded-lg">
                                    <p className="text-xs text-pink-600">Redeemed</p>
                                    <p className="font-bold text-pink-700">{customerLoyalty.points_redeemed_total?.toLocaleString()}</p>
                                  </div>
                                </div>

                                {/* Actions */}
                                {settings?.enabled && (
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <Label className="text-xs">Earn Points (SAR)</Label>
                                      <div className="flex gap-1">
                                        <Input 
                                          type="number" 
                                          placeholder="Amount" 
                                          id="earn-amount"
                                          className="h-8"
                                        />
                                        <Button 
                                          size="sm"
                                          onClick={() => {
                                            const amt = document.getElementById('earn-amount').value;
                                            if (amt) handleEarnPoints(customer.id, parseFloat(amt));
                                          }}
                                          data-testid="earn-points-btn"
                                        >
                                          +
                                        </Button>
                                      </div>
                                    </div>
                                    <div>
                                      <Label className="text-xs">Redeem Points</Label>
                                      <div className="flex gap-1">
                                        <Input 
                                          type="number" 
                                          placeholder="Points" 
                                          id="redeem-points"
                                          className="h-8"
                                        />
                                        <Button 
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            const pts = document.getElementById('redeem-points').value;
                                            if (pts) handleRedeemPoints(customer.id, parseInt(pts));
                                          }}
                                          data-testid="redeem-points-btn"
                                        >
                                          -
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Recent Transactions */}
                                {customerLoyalty.recent_transactions?.length > 0 && (
                                  <div>
                                    <Label className="text-xs mb-2 block">Recent Transactions</Label>
                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                      {customerLoyalty.recent_transactions.map((t, i) => (
                                        <div key={i} className="flex justify-between text-xs p-2 bg-stone-50 rounded">
                                          <span className={t.type === 'earn' ? 'text-emerald-600' : 'text-pink-600'}>
                                            {t.type === 'earn' ? '+' : ''}{t.points} pts
                                          </span>
                                          <span className="text-muted-foreground truncate max-w-[150px]">
                                            {t.notes}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
