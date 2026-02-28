import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Camera, Video, Bell, Users, Building2, Plus, 
  Maximize2, Grid3X3, LayoutGrid, AlertTriangle, CheckCircle, RefreshCw,
  Eye, Trash2, Wifi, WifiOff, Clock, TrendingUp, UserCheck, Package, Scan, Activity
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';
import { FaceRecognitionPanel, ObjectDetectionPanel, PeopleCountingPanel, MotionAnalysisPanel } from '@/components/cctv/AIFeatures';

export default function CCTVPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('live');
  const [branches, setBranches] = useState([]);
  const [dvrs, setDvrs] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [peopleCount, setPeopleCount] = useState(null);
  const [hikStatus, setHikStatus] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [gridSize, setGridSize] = useState(4); // 2x2, 3x3, 4x4
  const [loading, setLoading] = useState(true);
  const [showAddDVR, setShowAddDVR] = useState(false);
  const [showHikAuth, setShowHikAuth] = useState(false);
  const [hikCredentials, setHikCredentials] = useState({ email: '', password: '' });
  const [newDVR, setNewDVR] = useState({
    branch_id: '', name: '', ip_address: '', port: 8000,
    username: 'admin', password: '', device_serial: '', is_cloud: true, channels: 4
  });

  useEffect(() => {
    fetchData();
    fetchHikStatus();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [branchRes, dvrRes, camRes, alertRes, analyticsRes, countRes, empRes] = await Promise.all([
        api.get('/branches'),
        api.get('/cctv/dvrs'),
        api.get('/cctv/cameras'),
        api.get('/cctv/alerts?limit=20'),
        api.get('/cctv/analytics'),
        api.get('/cctv/people-count'),
        api.get('/employees')
      ]);
      setBranches(branchRes.data);
      setDvrs(dvrRes.data);
      setCameras(camRes.data);
      setAlerts(alertRes.data);
      setAnalytics(analyticsRes.data);
      setPeopleCount(countRes.data);
      setEmployees(empRes.data || []);
    } catch (err) {
      console.error('Failed to fetch CCTV data', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHikStatus = async () => {
    try {
      const res = await api.get('/cctv/hik-connect/status');
      setHikStatus(res.data);
    } catch {}
  };

  const handleHikAuth = async () => {
    try {
      await api.post('/cctv/hik-connect/auth', hikCredentials);
      toast.success('Connected to Hik-Connect!');
      setShowHikAuth(false);
      fetchHikStatus();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Authentication failed');
    }
  };

  const handleAddDVR = async () => {
    try {
      const branch = branches.find(b => b.id === newDVR.branch_id);
      await api.post('/cctv/dvrs', { ...newDVR, branch_name: branch?.name || '' });
      toast.success('DVR added successfully');
      setShowAddDVR(false);
      setNewDVR({ branch_id: '', name: '', ip_address: '', port: 8000, username: 'admin', password: '', device_serial: '', is_cloud: true, channels: 4 });
      fetchData();
    } catch (err) {
      toast.error('Failed to add DVR');
    }
  };

  const handleDeleteDVR = async (dvrId) => {
    if (!confirm('Delete this DVR and all its cameras?')) return;
    try {
      await api.delete(`/cctv/dvrs/${dvrId}`);
      toast.success('DVR deleted');
      fetchData();
    } catch {
      toast.error('Failed to delete DVR');
    }
  };

  const handleAcknowledgeAlert = async (alertId) => {
    try {
      await api.put(`/cctv/alerts/${alertId}/acknowledge`);
      setAlerts(alerts.map(a => a.id === alertId ? { ...a, acknowledged: true } : a));
      toast.success('Alert acknowledged');
    } catch {
      toast.error('Failed to acknowledge alert');
    }
  };

  const filteredCameras = selectedBranch 
    ? cameras.filter(c => c.branch_id === selectedBranch) 
    : cameras;

  const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit mb-1" data-testid="cctv-title">
              <Camera className="inline mr-2" size={28} />
              CCTV Security
            </h1>
            <p className="text-sm text-muted-foreground">Monitor cameras, view analytics, and manage alerts</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              size="sm" 
              variant={hikStatus?.connected ? "outline" : "default"}
              className="rounded-xl"
              onClick={() => setShowHikAuth(true)}
              data-testid="hik-connect-btn"
            >
              {hikStatus?.connected ? <Wifi size={14} className="mr-1 text-success" /> : <WifiOff size={14} className="mr-1" />}
              {hikStatus?.connected ? 'Hik-Connect' : 'Connect Hik'}
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowAddDVR(true)}>
              <Plus size={14} className="mr-1" /> Add DVR
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={fetchData}>
              <RefreshCw size={14} />
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="border-border">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg"><Video size={18} className="text-primary" /></div>
                <div>
                  <p className="text-2xl font-bold">{cameras.length}</p>
                  <p className="text-xs text-muted-foreground">Cameras</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-info/10 rounded-lg"><Building2 size={18} className="text-info" /></div>
                <div>
                  <p className="text-2xl font-bold">{dvrs.length}</p>
                  <p className="text-xs text-muted-foreground">DVRs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-success/10 rounded-lg"><Users size={18} className="text-success" /></div>
                <div>
                  <p className="text-2xl font-bold">{peopleCount?.total_entries || 0}</p>
                  <p className="text-xs text-muted-foreground">Visitors Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-warning/10 rounded-lg"><TrendingUp size={18} className="text-warning" /></div>
                <div>
                  <p className="text-2xl font-bold">{peopleCount?.current_inside || 0}</p>
                  <p className="text-xs text-muted-foreground">Currently Inside</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={`border-border ${unacknowledgedAlerts > 0 ? 'border-error/50 bg-error/5' : ''}`}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${unacknowledgedAlerts > 0 ? 'bg-error/20' : 'bg-stone-100'}`}>
                  <Bell size={18} className={unacknowledgedAlerts > 0 ? 'text-error' : ''} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{unacknowledgedAlerts}</p>
                  <p className="text-xs text-muted-foreground">New Alerts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 rounded-lg"><Clock size={18} className="text-purple-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{analytics?.summary?.peak_hour || '12:00'}</p>
                  <p className="text-xs text-muted-foreground">Peak Hour</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="live" data-testid="live-tab"><Video size={14} className="mr-1" /> Live View</TabsTrigger>
            <TabsTrigger value="analytics" data-testid="analytics-tab"><TrendingUp size={14} className="mr-1" /> Analytics</TabsTrigger>
            <TabsTrigger value="alerts" data-testid="alerts-tab">
              <Bell size={14} className="mr-1" /> Alerts
              {unacknowledgedAlerts > 0 && <Badge className="ml-1 bg-error text-white text-[10px] px-1">{unacknowledgedAlerts}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="devices" data-testid="devices-tab"><Settings size={14} className="mr-1" /> Devices</TabsTrigger>
          </TabsList>

          {/* Live View Tab */}
          <TabsContent value="live" className="mt-4">
            <div className="flex justify-between items-center mb-4">
              <div className="flex gap-2 items-center">
                <Select value={selectedBranch || "all"} onValueChange={(v) => setSelectedBranch(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant={gridSize === 4 ? "default" : "outline"} onClick={() => setGridSize(4)} className="rounded-lg px-2">
                  <Grid3X3 size={16} />
                </Button>
                <Button size="sm" variant={gridSize === 9 ? "default" : "outline"} onClick={() => setGridSize(9)} className="rounded-lg px-2">
                  <LayoutGrid size={16} />
                </Button>
              </div>
            </div>

            {/* Camera Grid */}
            <div className={`grid gap-3 ${gridSize === 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {filteredCameras.slice(0, gridSize).map((cam) => (
                <Card key={cam.id} className="border-border overflow-hidden" data-testid={`camera-${cam.id}`}>
                  <div className="relative aspect-video bg-stone-900 flex items-center justify-center">
                    {/* Placeholder for video stream */}
                    <div className="text-center text-white/60">
                      <Video size={48} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">{cam.name}</p>
                      <p className="text-xs opacity-60">{cam.branch_name}</p>
                    </div>
                    {/* Status indicator */}
                    <div className="absolute top-2 left-2">
                      <Badge className="bg-success/80 text-white text-[10px]">
                        <span className="w-1.5 h-1.5 bg-white rounded-full mr-1 animate-pulse" />
                        LIVE
                      </Badge>
                    </div>
                    {/* Controls overlay */}
                    <div className="absolute bottom-2 right-2 flex gap-1">
                      <Button size="sm" variant="secondary" className="h-7 w-7 p-0 rounded-full bg-black/50 hover:bg-black/70">
                        <Maximize2 size={12} className="text-white" />
                      </Button>
                    </div>
                  </div>
                  <CardContent className="p-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium truncate">{cam.name}</span>
                      <span className="text-[10px] text-muted-foreground">Ch {cam.channel}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredCameras.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Camera size={48} className="mx-auto mb-2 opacity-30" />
                  <p>No cameras configured</p>
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => setShowAddDVR(true)}>
                    Add DVR
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-4 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily Traffic Chart */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="font-outfit text-base">Daily Visitor Traffic</CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics?.daily_traffic?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={analytics.daily_traffic}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="entries" fill="#22C55E" name="Entries" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="exits" fill="#EF4444" name="Exits" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">No data available</div>
                  )}
                </CardContent>
              </Card>

              {/* Hourly Distribution */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="font-outfit text-base">Hourly Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics?.hourly_distribution?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={analytics.hourly_distribution}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={(h) => `${h}:00`} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip labelFormatter={(h) => `${h}:00`} />
                        <Line type="monotone" dataKey="visitors" stroke="#F5841F" strokeWidth={2} dot={{ fill: '#F5841F' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">No data available</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Today's People Count */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-outfit text-base">Today's Foot Traffic</CardTitle>
              </CardHeader>
              <CardContent>
                {peopleCount?.hourly_breakdown?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={peopleCount.hourly_breakdown}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={(h) => h.split('T')[1] || h} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="entries" fill="#22C55E" name="In" stackId="a" />
                      <Bar dataKey="exits" fill="#EF4444" name="Out" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users size={32} className="mx-auto mb-2 opacity-30" />
                    <p>People counting data will appear here</p>
                    <p className="text-xs mt-1">AI processes camera feeds to count entries/exits</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="mt-4">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-outfit text-base flex items-center gap-2">
                  <Bell size={18} />
                  Motion Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {alerts.map((alert) => (
                    <div 
                      key={alert.id} 
                      className={`flex items-center gap-3 p-3 rounded-xl border ${alert.acknowledged ? 'bg-stone-50 border-stone-200' : 'bg-warning/5 border-warning/30'}`}
                    >
                      <div className={`p-2 rounded-lg ${alert.acknowledged ? 'bg-stone-200' : 'bg-warning/20'}`}>
                        <AlertTriangle size={18} className={alert.acknowledged ? 'text-stone-500' : 'text-warning'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{alert.camera_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(alert.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                        </p>
                      </div>
                      {alert.snapshot_url && (
                        <Button size="sm" variant="outline" className="rounded-lg">
                          <Eye size={14} className="mr-1" /> View
                        </Button>
                      )}
                      {!alert.acknowledged && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="rounded-lg"
                          onClick={() => handleAcknowledgeAlert(alert.id)}
                        >
                          <CheckCircle size={14} className="mr-1" /> Ack
                        </Button>
                      )}
                    </div>
                  ))}
                  {alerts.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Bell size={32} className="mx-auto mb-2 opacity-30" />
                      <p>No alerts</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Devices Tab */}
          <TabsContent value="devices" className="mt-4 space-y-4">
            {dvrs.map((dvr) => (
              <Card key={dvr.id} className="border-border">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="font-outfit text-base flex items-center gap-2">
                      <Video size={18} />
                      {dvr.name}
                      <Badge variant="outline" className="text-[10px]">{dvr.branch_name}</Badge>
                    </CardTitle>
                    <div className="flex gap-2">
                      <Badge className={dvr.is_cloud ? 'bg-info/20 text-info' : 'bg-success/20 text-success'}>
                        {dvr.is_cloud ? 'Cloud' : 'Local'}
                      </Badge>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDeleteDVR(dvr.id)}>
                        <Trash2 size={14} className="text-error" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Cameras:</span>
                      <span className="ml-2 font-medium">{dvr.camera_count || dvr.channels}</span>
                    </div>
                    {dvr.is_cloud ? (
                      <div>
                        <span className="text-muted-foreground">Serial:</span>
                        <span className="ml-2 font-medium">{dvr.device_serial || 'N/A'}</span>
                      </div>
                    ) : (
                      <>
                        <div>
                          <span className="text-muted-foreground">IP:</span>
                          <span className="ml-2 font-medium">{dvr.ip_address}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Port:</span>
                          <span className="ml-2 font-medium">{dvr.port}</span>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {dvrs.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Video size={48} className="mx-auto mb-2 opacity-30" />
                <p>No DVRs configured</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => setShowAddDVR(true)}>
                  <Plus size={14} className="mr-1" /> Add DVR
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Add DVR Dialog */}
        <Dialog open={showAddDVR} onOpenChange={setShowAddDVR}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-outfit">Add DVR/NVR</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Branch</Label>
                <Select value={newDVR.branch_id} onValueChange={(v) => setNewDVR({ ...newDVR, branch_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>DVR Name</Label>
                <Input value={newDVR.name} onChange={(e) => setNewDVR({ ...newDVR, name: e.target.value })} placeholder="Main DVR" />
              </div>
              <div className="flex gap-2">
                <Button 
                  variant={newDVR.is_cloud ? "default" : "outline"} 
                  size="sm" 
                  className="flex-1 rounded-xl"
                  onClick={() => setNewDVR({ ...newDVR, is_cloud: true })}
                >
                  <Wifi size={14} className="mr-1" /> Cloud (Hik-Connect)
                </Button>
                <Button 
                  variant={!newDVR.is_cloud ? "default" : "outline"} 
                  size="sm" 
                  className="flex-1 rounded-xl"
                  onClick={() => setNewDVR({ ...newDVR, is_cloud: false })}
                >
                  <Building2 size={14} className="mr-1" /> Local IP
                </Button>
              </div>
              {newDVR.is_cloud ? (
                <div>
                  <Label>Device Serial Number</Label>
                  <Input value={newDVR.device_serial} onChange={(e) => setNewDVR({ ...newDVR, device_serial: e.target.value })} placeholder="DS-7208HQHI-K1" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>IP Address</Label>
                      <Input value={newDVR.ip_address} onChange={(e) => setNewDVR({ ...newDVR, ip_address: e.target.value })} placeholder="192.168.1.100" />
                    </div>
                    <div>
                      <Label>Port</Label>
                      <Input type="number" value={newDVR.port} onChange={(e) => setNewDVR({ ...newDVR, port: parseInt(e.target.value) })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Username</Label>
                      <Input value={newDVR.username} onChange={(e) => setNewDVR({ ...newDVR, username: e.target.value })} />
                    </div>
                    <div>
                      <Label>Password</Label>
                      <Input type="password" value={newDVR.password} onChange={(e) => setNewDVR({ ...newDVR, password: e.target.value })} />
                    </div>
                  </div>
                </>
              )}
              <div>
                <Label>Number of Channels</Label>
                <Select value={String(newDVR.channels)} onValueChange={(v) => setNewDVR({ ...newDVR, channels: parseInt(v) })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[4, 8, 16, 32].map(n => <SelectItem key={n} value={String(n)}>{n} Channels</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDVR(false)}>Cancel</Button>
              <Button onClick={handleAddDVR} disabled={!newDVR.branch_id || !newDVR.name}>Add DVR</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Hik-Connect Auth Dialog */}
        <Dialog open={showHikAuth} onOpenChange={setShowHikAuth}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-outfit flex items-center gap-2">
                <Wifi size={20} className="text-primary" />
                Hik-Connect Login
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {hikStatus?.connected ? (
                <div className="p-4 bg-success/10 rounded-xl border border-success/30">
                  <div className="flex items-center gap-2 text-success">
                    <CheckCircle size={20} />
                    <span className="font-medium">Connected</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{hikStatus.email}</p>
                </div>
              ) : (
                <>
                  <div>
                    <Label>Email</Label>
                    <Input 
                      type="email" 
                      value={hikCredentials.email} 
                      onChange={(e) => setHikCredentials({ ...hikCredentials, email: e.target.value })}
                      placeholder="your@email.com"
                    />
                  </div>
                  <div>
                    <Label>Password</Label>
                    <Input 
                      type="password" 
                      value={hikCredentials.password} 
                      onChange={(e) => setHikCredentials({ ...hikCredentials, password: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowHikAuth(false)}>Close</Button>
              {!hikStatus?.connected && (
                <Button onClick={handleHikAuth}>Connect</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
