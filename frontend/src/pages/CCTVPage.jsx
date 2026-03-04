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
  Eye, Trash2, Wifi, WifiOff, Clock, TrendingUp, UserCheck, Package, Scan, Activity,
  Tv, HelpCircle, Monitor, Smartphone, Globe, Copy, ExternalLink, Play, Pause, Info
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '@/lib/api';
import { useBranchStore } from '@/stores';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';
import { FaceRecognitionPanel, ObjectDetectionPanel, PeopleCountingPanel, MotionAnalysisPanel } from '@/components/cctv/AIFeatures';

export default function CCTVPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('live');
  const { branches, fetchBranches: _fetchBr } = useBranchStore();
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
  const [snapshotUrls, setSnapshotUrls] = useState({});
  const [snapshotErrors, setSnapshotErrors] = useState({});
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [fullscreenCam, setFullscreenCam] = useState(null);
  const refreshIntervalRef = useRef(null);
  const [newDVR, setNewDVR] = useState({
    branch_id: '', name: '', ip_address: '', port: 80, http_port: 80, rtsp_port: 554,
    username: 'admin', password: '', device_serial: '', is_cloud: false, connection_type: 'remote', channels: 4
  });

  useEffect(() => {
    fetchData();
    fetchHikStatus();
  }, []);

  // Auto-refresh snapshots
  useEffect(() => {
    if (autoRefresh && activeTab === 'live' && filteredCameras.length > 0) {
      fetchAllSnapshots();
      refreshIntervalRef.current = setInterval(fetchAllSnapshots, 3000);
    }
    return () => { if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current); };
  }, [autoRefresh, activeTab, cameras, selectedBranch]);

  const fetchAllSnapshots = async () => {
    const camsToFetch = selectedBranch ? cameras.filter(c => c.branch_id === selectedBranch) : cameras;
    for (const cam of camsToFetch.slice(0, gridSize)) {
      try {
        const res = await api.get(`/cctv/snapshot/${cam.id}`, { responseType: 'blob' });
        const url = URL.createObjectURL(res.data);
        setSnapshotUrls(prev => {
          if (prev[cam.id]) URL.revokeObjectURL(prev[cam.id]);
          return { ...prev, [cam.id]: url };
        });
        setSnapshotErrors(prev => ({ ...prev, [cam.id]: null }));
      } catch (err) {
        let msg = 'Cannot connect to camera';
        try {
          if (err.response?.data instanceof Blob) {
            const text = await err.response.data.text();
            const parsed = JSON.parse(text);
            msg = parsed.detail || msg;
          } else if (err.response?.data?.detail) {
            msg = err.response.data.detail;
          }
        } catch {}
        setSnapshotErrors(prev => ({ ...prev, [cam.id]: msg }));
      }
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [branchRes, dvrRes, camRes, alertRes, analyticsRes, countRes, empRes] = await Promise.all([
        Promise.resolve({ data: [] }),
        api.get('/cctv/dvrs'),
        api.get('/cctv/cameras'),
        api.get('/cctv/alerts?limit=20'),
        api.get('/cctv/analytics'),
        api.get('/cctv/people-count'),
        api.get('/employees')
      ]);
      // branches from store
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
      setNewDVR({ branch_id: '', name: '', ip_address: '', port: 80, http_port: 80, rtsp_port: 554, username: 'admin', password: '', device_serial: '', is_cloud: false, connection_type: 'remote', channels: 4 });
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
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="live" data-testid="live-tab"><Video size={14} className="mr-1" /> Live View</TabsTrigger>
            <TabsTrigger value="analytics" data-testid="analytics-tab"><TrendingUp size={14} className="mr-1" /> Analytics</TabsTrigger>
            <TabsTrigger value="face" data-testid="face-tab"><UserCheck size={14} className="mr-1" /> Face Recognition</TabsTrigger>
            <TabsTrigger value="objects" data-testid="objects-tab"><Package size={14} className="mr-1" /> Object Detection</TabsTrigger>
            <TabsTrigger value="people" data-testid="people-tab"><Users size={14} className="mr-1" /> People Count</TabsTrigger>
            <TabsTrigger value="motion" data-testid="motion-tab"><Activity size={14} className="mr-1" /> Motion</TabsTrigger>
            <TabsTrigger value="alerts" data-testid="alerts-tab">
              <Bell size={14} className="mr-1" /> Alerts
              {unacknowledgedAlerts > 0 && <Badge className="ml-1 bg-error text-white text-[10px] px-1">{unacknowledgedAlerts}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="devices" data-testid="devices-tab"><Camera size={14} className="mr-1" /> Devices</TabsTrigger>
            <TabsTrigger value="guide" data-testid="guide-tab"><HelpCircle size={14} className="mr-1" /> Setup Guide</TabsTrigger>
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
                <Button 
                  size="sm" 
                  variant={autoRefresh ? "default" : "outline"} 
                  onClick={() => setAutoRefresh(!autoRefresh)} 
                  className="rounded-lg"
                  data-testid="auto-refresh-btn"
                >
                  {autoRefresh ? <Pause size={14} className="mr-1" /> : <Play size={14} className="mr-1" />}
                  {autoRefresh ? 'Pause' : 'Live'}
                </Button>
                <Button size="sm" variant="outline" onClick={fetchAllSnapshots} className="rounded-lg">
                  <RefreshCw size={14} />
                </Button>
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
            <div className={`grid gap-3 ${gridSize === 4 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
              {filteredCameras.slice(0, gridSize).map((cam) => (
                <Card key={cam.id} className="border-border overflow-hidden" data-testid={`camera-${cam.id}`}>
                  <div className="relative aspect-video bg-stone-900 flex items-center justify-center overflow-hidden">
                    {snapshotUrls[cam.id] ? (
                      <img 
                        src={snapshotUrls[cam.id]} 
                        alt={cam.name} 
                        className="w-full h-full object-cover"
                        data-testid={`camera-feed-${cam.id}`}
                      />
                    ) : snapshotErrors[cam.id] ? (
                      <div className="text-center text-white/60 p-4">
                        <WifiOff size={36} className="mx-auto mb-2 opacity-50" />
                        <p className="text-xs font-medium">{cam.name}</p>
                        <p className="text-[10px] opacity-60 mt-1 max-w-[200px] mx-auto">{snapshotErrors[cam.id]}</p>
                      </div>
                    ) : (
                      <div className="text-center text-white/60">
                        <Video size={36} className="mx-auto mb-2 opacity-50 animate-pulse" />
                        <p className="text-xs">{cam.name}</p>
                        <p className="text-[10px] opacity-60">Connecting...</p>
                      </div>
                    )}
                    {/* Status indicator */}
                    <div className="absolute top-2 left-2">
                      {snapshotUrls[cam.id] ? (
                        <Badge className="bg-success/80 text-white text-[10px]">
                          <span className="w-1.5 h-1.5 bg-white rounded-full mr-1 animate-pulse" />
                          LIVE
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/80 text-white text-[10px]">
                          <WifiOff size={10} className="mr-1" />
                          OFFLINE
                        </Badge>
                      )}
                    </div>
                    {/* Camera name overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <p className="text-white text-xs font-medium truncate">{cam.name}</p>
                      <p className="text-white/60 text-[10px]">{cam.branch_name} &middot; Ch {cam.channel}</p>
                    </div>
                    {/* Fullscreen button */}
                    <div className="absolute top-2 right-2">
                      <Button 
                        size="sm" variant="secondary" 
                        className="h-7 w-7 p-0 rounded-full bg-black/50 hover:bg-black/70"
                        onClick={() => setFullscreenCam(fullscreenCam === cam.id ? null : cam.id)}
                      >
                        <Maximize2 size={12} className="text-white" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
              {filteredCameras.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Camera size={48} className="mx-auto mb-2 opacity-30" />
                  <p>No cameras configured</p>
                  <p className="text-xs mt-1">Add a DVR first, then cameras will be auto-created</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowAddDVR(true)}>
                    <Plus size={14} className="mr-1" /> Add DVR
                  </Button>
                </div>
              )}
            </div>

            {/* Fullscreen View */}
            {fullscreenCam && snapshotUrls[fullscreenCam] && (
              <Dialog open={!!fullscreenCam} onOpenChange={() => setFullscreenCam(null)}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden">
                  <img 
                    src={snapshotUrls[fullscreenCam]} 
                    alt="Fullscreen Camera" 
                    className="w-full h-auto"
                  />
                  <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center">
                    <Badge className="bg-success/80 text-white">
                      <span className="w-1.5 h-1.5 bg-white rounded-full mr-1 animate-pulse" />
                      LIVE - {filteredCameras.find(c => c.id === fullscreenCam)?.name}
                    </Badge>
                    <Button size="sm" variant="secondary" onClick={() => setFullscreenCam(null)}>Close</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
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

          {/* Face Recognition Tab */}
          <TabsContent value="face" className="mt-4">
            <FaceRecognitionPanel employees={employees} branches={branches} />
          </TabsContent>

          {/* Object Detection Tab */}
          <TabsContent value="objects" className="mt-4">
            <ObjectDetectionPanel cameras={cameras} />
          </TabsContent>

          {/* People Counting Tab */}
          <TabsContent value="people" className="mt-4">
            <PeopleCountingPanel cameras={cameras} />
          </TabsContent>

          {/* Motion Analysis Tab */}
          <TabsContent value="motion" className="mt-4">
            <MotionAnalysisPanel cameras={cameras} />
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
                      <Badge className={dvr.connection_type === 'remote' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : dvr.is_cloud ? 'bg-info/20 text-info' : 'bg-success/20 text-success'}>
                        {dvr.connection_type === 'remote' ? 'Remote IP' : dvr.connection_type === 'local' ? 'Local IP' : dvr.is_cloud ? 'Cloud' : 'Local'}
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
                          <span className="text-muted-foreground">HTTP:</span>
                          <span className="ml-2 font-medium">{dvr.http_port || dvr.port}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">RTSP:</span>
                          <span className="ml-2 font-medium">{dvr.rtsp_port || 554}</span>
                        </div>
                      </>
                    )}
                  </div>
                  {!dvr.is_cloud && dvr.ip_address && (
                    <div className="mt-3 p-2 bg-stone-50 dark:bg-stone-800 rounded-lg">
                      <p className="text-[10px] text-muted-foreground mb-1">RTSP URL (for VLC / TV apps):</p>
                      <code className="text-[11px] text-orange-600 dark:text-orange-400 break-all">
                        rtsp://{dvr.username}:****@{dvr.ip_address}:{dvr.rtsp_port || 554}/Streaming/Channels/101
                      </code>
                    </div>
                  )}
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

          {/* Setup Guide Tab */}
          <TabsContent value="guide" className="mt-4 space-y-6">
            {/* Remote DVR Setup - Most Important */}
            <Card className="border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-900/10">
              <CardHeader>
                <CardTitle className="font-outfit text-base flex items-center gap-2">
                  <Globe size={18} className="text-orange-500" />
                  Remote DVR Setup (Branch DVRs with Internet)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Your DVRs are at branch locations with internet. To view them in SSC Track, you need to set up <strong>Port Forwarding</strong> on each branch's router so the DVR is accessible from the internet.
                </p>
                <div className="p-4 border rounded-xl dark:border-stone-700 bg-white dark:bg-stone-900 space-y-3">
                  <h4 className="text-sm font-medium dark:text-white">Step-by-Step Port Forwarding:</h4>
                  <ol className="text-xs text-muted-foreground space-y-3 pl-5 list-decimal">
                    <li>
                      <strong className="dark:text-white">Find DVR's Local IP:</strong> On the DVR, go to <code className="bg-stone-100 dark:bg-stone-700 px-1 rounded">Configuration &gt; Network &gt; TCP/IP</code>. Note the IP (e.g., 192.168.1.64)
                    </li>
                    <li>
                      <strong className="dark:text-white">Find DVR's HTTP Port:</strong> Go to <code className="bg-stone-100 dark:bg-stone-700 px-1 rounded">Configuration &gt; Network &gt; Port</code>. Note the HTTP port (default: 80) and RTSP port (default: 554)
                    </li>
                    <li>
                      <strong className="dark:text-white">Enable ISAPI:</strong> Go to <code className="bg-stone-100 dark:bg-stone-700 px-1 rounded">Configuration &gt; Network &gt; Advanced &gt; Integration Protocol</code>. Enable <strong>ISAPI</strong> and <strong>CGIS</strong>
                    </li>
                    <li>
                      <strong className="dark:text-white">Login to Branch Router:</strong> Open your router's admin page (usually 192.168.1.1). Go to <strong>Port Forwarding</strong> or <strong>Virtual Server</strong> section
                    </li>
                    <li>
                      <strong className="dark:text-white">Add Port Forward Rules:</strong>
                      <div className="mt-1 p-2 bg-stone-100 dark:bg-stone-800 rounded text-[11px] space-y-1">
                        <div>Rule 1: External Port <strong>80</strong> &rarr; Internal IP <strong>192.168.1.64</strong> Port <strong>80</strong> (HTTP)</div>
                        <div>Rule 2: External Port <strong>554</strong> &rarr; Internal IP <strong>192.168.1.64</strong> Port <strong>554</strong> (RTSP)</div>
                      </div>
                      <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">Tip: If port 80 is blocked by your ISP, use a different external port (e.g., 8080) and enter that as the HTTP port in SSC Track</p>
                    </li>
                    <li>
                      <strong className="dark:text-white">Find Branch Public IP:</strong> On any device at the branch, visit <a href="https://whatismyip.com" target="_blank" rel="noreferrer" className="text-blue-500 underline">whatismyip.com</a> to get the public IP
                    </li>
                    <li>
                      <strong className="dark:text-white">Add DVR in SSC Track:</strong> Go to Devices tab &gt; Add DVR &gt; Select "Remote IP" &gt; Enter the public IP and forwarded ports
                    </li>
                    <li>
                      <strong className="dark:text-white">Test:</strong> Go to Live View tab - you should see camera feeds!
                    </li>
                  </ol>
                </div>
                <div className="p-4 border rounded-xl dark:border-stone-700 bg-white dark:bg-stone-900 space-y-3">
                  <h4 className="text-sm font-medium dark:text-white">Alternative: Use Hikvision DDNS (No Static IP Needed)</h4>
                  <p className="text-xs text-muted-foreground">If your branch doesn't have a static public IP, enable DDNS on the DVR:</p>
                  <ol className="text-xs text-muted-foreground space-y-2 pl-5 list-decimal">
                    <li>On DVR: <code className="bg-stone-100 dark:bg-stone-700 px-1 rounded">Configuration &gt; Network &gt; DDNS</code></li>
                    <li>Enable DDNS, select "HiDDNS" as the server type</li>
                    <li>Enter a device domain name (e.g., "mybranch-dvr")</li>
                    <li>Your DVR will be accessible at: <code className="bg-stone-100 dark:bg-stone-700 px-1 rounded">mybranch-dvr.hik-online.com</code></li>
                    <li>Use this domain as the IP address when adding DVR in SSC Track</li>
                  </ol>
                  <Badge className="bg-blue-100 text-blue-700 text-[10px]">Works even when your public IP changes</Badge>
                </div>
              </CardContent>
            </Card>

            {/* TV Display Guide */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-outfit text-base flex items-center gap-2">
                  <Tv size={18} className="text-orange-500" />
                  Display Cameras on TV
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-xl dark:border-stone-700 space-y-2" data-testid="guide-hdmi">
                    <div className="flex items-center gap-2 font-medium text-sm dark:text-white">
                      <Monitor size={16} className="text-blue-500" />
                      Option 1: Direct HDMI (Recommended)
                    </div>
                    <ol className="text-xs text-muted-foreground space-y-1 pl-5 list-decimal">
                      <li>Connect an HDMI cable from your DVR's HDMI output to the TV</li>
                      <li>Switch TV input to the correct HDMI port</li>
                      <li>Use the DVR's remote or mouse to navigate and select camera layout</li>
                      <li>Choose 4/8/16 split screen view as needed</li>
                    </ol>
                    <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Best quality - No internet needed</Badge>
                  </div>

                  <div className="p-4 border rounded-xl dark:border-stone-700 space-y-2" data-testid="guide-web">
                    <div className="flex items-center gap-2 font-medium text-sm dark:text-white">
                      <Globe size={16} className="text-purple-500" />
                      Option 2: SSC Track Web App on Smart TV
                    </div>
                    <ol className="text-xs text-muted-foreground space-y-1 pl-5 list-decimal">
                      <li>Open the browser on your Smart TV (or use a Fire Stick / Chromecast)</li>
                      <li>Navigate to this SSC Track URL and login</li>
                      <li>Go to CCTV &gt; Live View to see all cameras</li>
                      <li>Use the grid layout buttons to adjust the view</li>
                    </ol>
                    <Badge className="bg-blue-100 text-blue-700 text-[10px]">Works remotely over internet</Badge>
                  </div>

                  <div className="p-4 border rounded-xl dark:border-stone-700 space-y-2" data-testid="guide-hikconnect">
                    <div className="flex items-center gap-2 font-medium text-sm dark:text-white">
                      <Smartphone size={16} className="text-green-500" />
                      Option 3: Hik-Connect Mobile App
                    </div>
                    <ol className="text-xs text-muted-foreground space-y-1 pl-5 list-decimal">
                      <li>Download "Hik-Connect" app from App Store / Play Store</li>
                      <li>Create account and add your DVR using its serial number</li>
                      <li>View cameras on your phone from anywhere</li>
                      <li>Cast to TV using Screen Mirroring / AirPlay / Chromecast</li>
                    </ol>
                    <Badge className="bg-green-100 text-green-700 text-[10px]">Best for remote mobile access</Badge>
                  </div>

                  <div className="p-4 border rounded-xl dark:border-stone-700 space-y-2" data-testid="guide-ivms">
                    <div className="flex items-center gap-2 font-medium text-sm dark:text-white">
                      <Monitor size={16} className="text-amber-500" />
                      Option 4: iVMS-4200 on PC/Laptop
                    </div>
                    <ol className="text-xs text-muted-foreground space-y-1 pl-5 list-decimal">
                      <li>Download iVMS-4200 from hikvision.com</li>
                      <li>Add your DVR using IP address or Hik-Connect</li>
                      <li>View live cameras and playback recordings</li>
                      <li>Connect PC to TV via HDMI for large display</li>
                    </ol>
                    <Badge className="bg-amber-100 text-amber-700 text-[10px]">Full feature access + recording playback</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* DVR Setup Guide */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-outfit text-base flex items-center gap-2">
                  <Video size={18} className="text-blue-500" />
                  DVR Web View Setup (SSC Track Live View)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  To view live camera feeds directly in SSC Track, your DVR must be accessible from this server over the network.
                </p>
                <div className="p-4 border rounded-xl dark:border-stone-700 space-y-3">
                  <h4 className="text-sm font-medium dark:text-white">Requirements:</h4>
                  <ul className="text-xs text-muted-foreground space-y-2 pl-5 list-disc">
                    <li><strong>Local Network:</strong> SSC Track server and DVR must be on the same network, OR the DVR must be port-forwarded to the internet</li>
                    <li><strong>HTTP Port:</strong> Default is <code className="bg-stone-100 dark:bg-stone-700 px-1 rounded">80</code>. Check your DVR settings under Network &gt; Port Settings</li>
                    <li><strong>RTSP Port:</strong> Default is <code className="bg-stone-100 dark:bg-stone-700 px-1 rounded">554</code>. Used for video streaming (VLC, etc.)</li>
                    <li><strong>Authentication:</strong> Use the same username/password you use to log into the DVR web interface</li>
                  </ul>
                </div>
                <div className="p-4 border rounded-xl dark:border-stone-700 space-y-3">
                  <h4 className="text-sm font-medium dark:text-white">Troubleshooting - No Display:</h4>
                  <ul className="text-xs text-muted-foreground space-y-2 pl-5 list-disc">
                    <li><strong>Check DVR IP:</strong> Log into DVR locally, go to Configuration &gt; Network &gt; TCP/IP to find the IP address</li>
                    <li><strong>Check Ports:</strong> Go to Configuration &gt; Network &gt; Port to verify HTTP port (default: 80) and RTSP port (default: 554)</li>
                    <li><strong>Test Connection:</strong> Open <code className="bg-stone-100 dark:bg-stone-700 px-1 rounded">http://DVR_IP:HTTP_PORT</code> in a browser - you should see the Hikvision login page</li>
                    <li><strong>Enable ISAPI:</strong> Go to Configuration &gt; Network &gt; Advanced Settings &gt; Integration Protocol &gt; Enable ISAPI</li>
                    <li><strong>Firewall:</strong> Ensure no firewall is blocking ports 80 and 554 between this server and the DVR</li>
                    <li><strong>Port Forwarding (Remote):</strong> If DVR is behind a router, forward HTTP and RTSP ports to the DVR's local IP</li>
                  </ul>
                </div>
                <div className="p-4 border rounded-xl dark:border-stone-700 bg-blue-50 dark:bg-blue-900/10 space-y-2">
                  <h4 className="text-sm font-medium dark:text-white flex items-center gap-1.5"><Info size={14} className="text-blue-500" />RTSP URL for VLC / External Players:</h4>
                  <p className="text-xs text-muted-foreground">You can also view cameras using VLC Player or any RTSP-compatible player:</p>
                  <code className="block text-xs bg-stone-900 text-green-400 p-3 rounded-lg overflow-x-auto">
                    rtsp://USERNAME:PASSWORD@DVR_IP:554/Streaming/Channels/101
                  </code>
                  <p className="text-[10px] text-muted-foreground">Channel format: 101 (Camera 1 Main), 102 (Camera 1 Sub), 201 (Camera 2 Main), etc.</p>
                </div>
              </CardContent>
            </Card>
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
              <div>
                <Label className="mb-2 block">Connection Type</Label>
                <div className="flex gap-2">
                  <Button 
                    variant={newDVR.connection_type === 'remote' ? "default" : "outline"} 
                    size="sm" 
                    className="flex-1 rounded-xl"
                    onClick={() => setNewDVR({ ...newDVR, connection_type: 'remote', is_cloud: false })}
                  >
                    <Globe size={14} className="mr-1" /> Remote IP
                  </Button>
                  <Button 
                    variant={newDVR.connection_type === 'local' ? "default" : "outline"} 
                    size="sm" 
                    className="flex-1 rounded-xl"
                    onClick={() => setNewDVR({ ...newDVR, connection_type: 'local', is_cloud: false })}
                  >
                    <Building2 size={14} className="mr-1" /> Local IP
                  </Button>
                  <Button 
                    variant={newDVR.connection_type === 'cloud' ? "default" : "outline"} 
                    size="sm" 
                    className="flex-1 rounded-xl"
                    onClick={() => setNewDVR({ ...newDVR, connection_type: 'cloud', is_cloud: true })}
                  >
                    <Wifi size={14} className="mr-1" /> Cloud
                  </Button>
                </div>
                {newDVR.connection_type === 'remote' && (
                  <p className="text-[10px] text-muted-foreground mt-1.5">DVR at branch with internet. Requires port forwarding on branch router.</p>
                )}
                {newDVR.connection_type === 'local' && (
                  <p className="text-[10px] text-muted-foreground mt-1.5">DVR on same network as this server (e.g. 192.168.x.x)</p>
                )}
                {newDVR.connection_type === 'cloud' && (
                  <p className="text-[10px] text-muted-foreground mt-1.5">Hik-Connect cloud. Add public IP for live view in SSC Track.</p>
                )}
              </div>
              {newDVR.connection_type === 'cloud' && (
                <div>
                  <Label>Device Serial Number</Label>
                  <Input value={newDVR.device_serial} onChange={(e) => setNewDVR({ ...newDVR, device_serial: e.target.value })} placeholder="DS-7208HQHI-K1" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{newDVR.connection_type === 'remote' ? 'Public IP / DDNS Domain' : 'IP Address'}</Label>
                  <Input value={newDVR.ip_address} onChange={(e) => setNewDVR({ ...newDVR, ip_address: e.target.value })} placeholder={newDVR.connection_type === 'remote' ? '203.0.113.10 or dvr.example.com' : '192.168.1.100'} />
                </div>
                <div>
                  <Label>HTTP Port</Label>
                  <Input type="number" value={newDVR.http_port} onChange={(e) => setNewDVR({ ...newDVR, http_port: parseInt(e.target.value) || 80, port: parseInt(e.target.value) || 80 })} placeholder="80" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>RTSP Port</Label>
                  <Input type="number" value={newDVR.rtsp_port} onChange={(e) => setNewDVR({ ...newDVR, rtsp_port: parseInt(e.target.value) || 554 })} placeholder="554" />
                </div>
                <div>
                  <Label>Username</Label>
                  <Input value={newDVR.username} onChange={(e) => setNewDVR({ ...newDVR, username: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Password</Label>
                <Input type="password" value={newDVR.password} onChange={(e) => setNewDVR({ ...newDVR, password: e.target.value })} />
              </div>
              {newDVR.connection_type === 'remote' && (
                <div className="p-3 border rounded-xl bg-amber-50 dark:bg-amber-900/10 dark:border-amber-700">
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1"><Info size={12} /> Port Forwarding Required</p>
                  <p className="text-[10px] text-muted-foreground mt-1">On your branch router, forward port {newDVR.http_port || 80} (HTTP) and port {newDVR.rtsp_port || 554} (RTSP) to the DVR's local IP address (usually 192.168.1.x). See Setup Guide for details.</p>
                </div>
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
