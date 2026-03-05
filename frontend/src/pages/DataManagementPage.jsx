import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Database, Archive, RotateCcw, Trash2, Download, RefreshCw, HardDrive, AlertTriangle, CheckCircle, Clock, Timer } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function DataManagementPage() {
  const [stats, setStats] = useState([]);
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(null);
  const [autoSettings, setAutoSettings] = useState(null);
  const [savingAuto, setSavingAuto] = useState(false);

  useEffect(() => { fetchStats(); fetchAutoSettings(); }, []);

  const fetchStats = async () => {
    try {
      const res = await api.get('/data-management/stats');
      setStats(res.data.stats || []);
      setArchives(res.data.archives || []);
    } catch { toast.error('Failed to load data stats'); }
    finally { setLoading(false); }
  };

  const fetchAutoSettings = async () => {
    try {
      const res = await api.get('/data-management/auto-archive-settings');
      setAutoSettings(res.data);
    } catch { /* silent */ }
  };

  const saveAutoSettings = async () => {
    setSavingAuto(true);
    try {
      const res = await api.put('/data-management/auto-archive-settings', autoSettings);
      setAutoSettings(res.data);
      toast.success('Auto-archive settings saved');
    } catch { toast.error('Failed to save settings'); }
    finally { setSavingAuto(false); }
  };

  const handleArchive = async (collection, months) => {
    if (!window.confirm(`Archive all ${collection} records older than ${months} months? This will move them to an archive collection.`)) return;
    setArchiving(collection);
    try {
      const res = await api.post('/data-management/archive', { collection, months });
      toast.success(res.data.message);
      fetchStats();
    } catch { toast.error('Archive failed'); }
    finally { setArchiving(null); }
  };

  const handleRestore = async (archiveId) => {
    if (!window.confirm('Restore all records from this archive back to the original collection?')) return;
    try {
      const res = await api.post('/data-management/restore', { archive_id: archiveId });
      toast.success(res.data.message);
      fetchStats();
    } catch { toast.error('Restore failed'); }
  };

  const handlePurge = async (archiveId) => {
    if (!window.confirm('PERMANENTLY DELETE this archived data? This action CANNOT be undone!')) return;
    if (!window.confirm('Are you absolutely sure? This is irreversible.')) return;
    try {
      const res = await api.delete('/data-management/purge', { data: { archive_id: archiveId } });
      toast.success(res.data.message);
      fetchStats();
    } catch { toast.error('Purge failed'); }
  };

  const handleExport = async (collection) => {
    try {
      const res = await api.get(`/data-management/export/${collection}`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${collection}_export_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${res.data.count} records`);
    } catch { toast.error('Export failed'); }
  };

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><RefreshCw className="animate-spin text-orange-500" size={32} /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto" data-testid="data-management-page">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit flex items-center gap-2" data-testid="data-management-title">
              <Database className="text-orange-500" /> Data Management
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Archive, export, and manage your business data</p>
          </div>
          <Button variant="outline" onClick={fetchStats} data-testid="refresh-stats-btn" className="rounded-full">
            <RefreshCw size={14} className="mr-1" /> Refresh
          </Button>
        </div>

        {/* Collection Stats */}
        <div className="grid gap-4">
          {stats.map(s => (
            <CollectionCard
              key={s.collection}
              stat={s}
              onArchive={handleArchive}
              onExport={handleExport}
              archiving={archiving}
            />
          ))}
        </div>

        {/* Auto-Archive Settings */}
        {autoSettings && (
          <Card data-testid="auto-archive-settings">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2"><Timer size={18} /> Auto-Archive Schedule</CardTitle>
                  <CardDescription>Automatically archive old data on a schedule</CardDescription>
                </div>
                <Switch
                  checked={autoSettings.enabled}
                  onCheckedChange={(v) => setAutoSettings({ ...autoSettings, enabled: v })}
                  data-testid="auto-archive-toggle"
                />
              </div>
            </CardHeader>
            {autoSettings.enabled && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Frequency</Label>
                    <Select value={autoSettings.frequency || 'monthly'} onValueChange={(v) => setAutoSettings({ ...autoSettings, frequency: v })}>
                      <SelectTrigger className="h-9" data-testid="auto-freq-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {autoSettings.frequency === 'monthly' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Day of Month</Label>
                      <Input type="number" min={1} max={28} value={autoSettings.day_of_month || 1}
                        onChange={(e) => setAutoSettings({ ...autoSettings, day_of_month: parseInt(e.target.value) || 1 })}
                        className="h-9" />
                    </div>
                  )}
                  {autoSettings.frequency === 'weekly' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Day of Week</Label>
                      <Select value={autoSettings.day_of_week || 'sun'} onValueChange={(v) => setAutoSettings({ ...autoSettings, day_of_week: v })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(d => (
                            <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Time (24h)</Label>
                    <Input type="time" value={`${String(autoSettings.hour || 2).padStart(2, '0')}:${String(autoSettings.minute || 0).padStart(2, '0')}`}
                      onChange={(e) => {
                        const [h, m] = e.target.value.split(':');
                        setAutoSettings({ ...autoSettings, hour: parseInt(h) || 0, minute: parseInt(m) || 0 });
                      }}
                      className="h-9" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Collections to Auto-Archive</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(autoSettings.collections || {}).map(([coll, config]) => {
                      const label = stats.find(s => s.collection === coll)?.label || coll;
                      return (
                        <div key={coll} className="flex items-center justify-between p-2.5 rounded-lg border bg-stone-50/50 dark:bg-stone-900/30">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={config.enabled}
                              onCheckedChange={(v) => setAutoSettings({
                                ...autoSettings,
                                collections: { ...autoSettings.collections, [coll]: { ...config, enabled: v } }
                              })}
                              data-testid={`auto-toggle-${coll}`}
                            />
                            <span className="text-sm">{label}</span>
                          </div>
                          <Select
                            value={String(config.months || 12)}
                            onValueChange={(v) => setAutoSettings({
                              ...autoSettings,
                              collections: { ...autoSettings.collections, [coll]: { ...config, months: parseInt(v) } }
                            })}
                          >
                            <SelectTrigger className="w-[90px] h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="3">3 mo</SelectItem>
                              <SelectItem value="6">6 mo</SelectItem>
                              <SelectItem value="12">12 mo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {autoSettings.last_run && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock size={12} /> Last run: {new Date(autoSettings.last_run).toLocaleString()}
                  </p>
                )}
                <Button onClick={saveAutoSettings} disabled={savingAuto} className="rounded-xl" data-testid="save-auto-archive-btn">
                  {savingAuto ? <RefreshCw size={14} className="mr-1 animate-spin" /> : <Timer size={14} className="mr-1" />}
                  Save Auto-Archive Settings
                </Button>
              </CardContent>
            )}
          </Card>
        )}

        {/* Archive History */}
        {archives.length > 0 && (
          <Card data-testid="archive-history-section">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Archive size={18} /> Archive History</CardTitle>
              <CardDescription>Previously archived data batches</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {archives.map(a => (
                  <div key={a.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-lg border bg-stone-50/50 dark:bg-stone-900/50" data-testid={`archive-${a.id}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{a.label}</span>
                        <Badge variant="outline" className="text-xs">{a.archived_count} records</Badge>
                        <Badge variant="outline" className="text-xs">Before {a.cutoff_date}</Badge>
                        {a.restored_at && <Badge className="bg-green-100 text-green-700 text-xs">Restored</Badge>}
                        {a.purged_at && <Badge className="bg-red-100 text-red-700 text-xs">Purged</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Archived {new Date(a.archived_at).toLocaleDateString()} by {a.archived_by}
                      </p>
                    </div>
                    {!a.restored_at && !a.purged_at && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleRestore(a.id)} className="h-8 text-xs" data-testid={`restore-${a.id}`}>
                          <RotateCcw size={12} className="mr-1" /> Restore
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handlePurge(a.id)} className="h-8 text-xs text-red-600 hover:text-red-700 hover:border-red-300" data-testid={`purge-${a.id}`}>
                          <Trash2 size={12} className="mr-1" /> Purge
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

function CollectionCard({ stat, onArchive, onExport, archiving }) {
  const [months, setMonths] = useState("12");
  const archivableCount = months === "3" ? stat.older_than_3_months : months === "6" ? stat.older_than_6_months : stat.older_than_12_months;
  const pct = stat.total > 0 ? Math.round((archivableCount / stat.total) * 100) : 0;

  return (
    <Card className="transition-all hover:shadow-md" data-testid={`collection-card-${stat.collection}`}>
      <CardContent className="p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center shrink-0">
              <HardDrive size={22} className="text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base">{stat.label}</h3>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-sm text-muted-foreground">{stat.total.toLocaleString()} total records</span>
                {stat.oldest_date && <span className="text-xs text-muted-foreground">From {stat.oldest_date}</span>}
              </div>
              {archivableCount > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <AlertTriangle size={12} className="text-amber-500" />
                  <span className="text-xs text-amber-600">{archivableCount.toLocaleString()} records ({pct}%) older than {months} months</span>
                </div>
              )}
              {archivableCount === 0 && stat.total > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <CheckCircle size={12} className="text-green-500" />
                  <span className="text-xs text-green-600">All records are within {months} months</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Select value={months} onValueChange={setMonths}>
              <SelectTrigger className="w-[120px] h-8 text-xs" data-testid={`months-select-${stat.collection}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 months</SelectItem>
                <SelectItem value="6">6 months</SelectItem>
                <SelectItem value="12">12 months</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onArchive(stat.collection, parseInt(months))}
              disabled={archivableCount === 0 || archiving === stat.collection}
              className="h-8 text-xs"
              data-testid={`archive-btn-${stat.collection}`}
            >
              {archiving === stat.collection ? <RefreshCw size={12} className="mr-1 animate-spin" /> : <Archive size={12} className="mr-1" />}
              Archive ({archivableCount})
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onExport(stat.collection)}
              className="h-8 text-xs"
              data-testid={`export-btn-${stat.collection}`}
            >
              <Download size={12} className="mr-1" /> Export
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
