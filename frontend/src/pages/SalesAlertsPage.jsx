import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { 
  Bell, Mail, MessageCircle, Plus, Trash2, Save, 
  TestTube, AlertTriangle, CheckCircle, RefreshCw, Clock,
  TrendingDown, DollarSign
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function SalesAlertsPage() {
  const [config, setConfig] = useState({
    enabled: true,
    threshold_percentage: 20,
    alert_time: '08:00',
    email_enabled: true,
    whatsapp_enabled: true,
    recipients: []
  });
  const [preview, setPreview] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [newRecipient, setNewRecipient] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [configRes, previewRes, historyRes] = await Promise.all([
        api.get('/sales-alerts/config'),
        api.get('/sales-alerts/preview'),
        api.get('/sales-alerts/history?limit=10')
      ]);
      setConfig(configRes.data);
      setPreview(previewRes.data);
      setHistory(historyRes.data);
    } catch (err) {
      toast.error('Failed to load alert settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/sales-alerts/config', config);
      toast.success('Alert settings saved');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestAlert = async () => {
    if (config.recipients.length === 0) {
      toast.error('Add at least one recipient to test');
      return;
    }
    setTesting(true);
    try {
      const res = await api.post('/sales-alerts/send-test');
      const results = res.data.results;
      const sent = [...(results.email_sent || []), ...(results.whatsapp_sent || [])];
      if (sent.length > 0) {
        toast.success(`Test alert sent to ${sent.length} recipient(s)`);
      } else if (results.errors?.length > 0) {
        toast.error(results.errors[0]);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send test');
    } finally {
      setTesting(false);
    }
  };

  const addRecipient = () => {
    if (!newRecipient.trim()) return;
    
    // Validate email or phone
    const isEmail = newRecipient.includes('@');
    const isPhone = newRecipient.startsWith('+') && newRecipient.length >= 10;
    
    if (!isEmail && !isPhone) {
      toast.error('Enter a valid email or phone number (with +country code)');
      return;
    }
    
    if (config.recipients.includes(newRecipient)) {
      toast.error('Recipient already added');
      return;
    }
    
    setConfig(prev => ({
      ...prev,
      recipients: [...prev.recipients, newRecipient]
    }));
    setNewRecipient('');
  };

  const removeRecipient = (recipient) => {
    setConfig(prev => ({
      ...prev,
      recipients: prev.recipients.filter(r => r !== recipient)
    }));
  };

  const formatCurrency = (val) => `SAR ${(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin" size={32} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold font-outfit mb-1" data-testid="alerts-title">
              Sales Alerts
            </h1>
            <p className="text-sm text-muted-foreground">
              Get notified when predicted sales are below expected
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleTestAlert} disabled={testing} data-testid="test-alert-btn">
              <TestTube size={14} className={`mr-1 ${testing ? 'animate-pulse' : ''}`} />
              {testing ? 'Sending...' : 'Send Test'}
            </Button>
            <Button onClick={handleSave} disabled={saving} data-testid="save-config-btn">
              <Save size={14} className="mr-1" />
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>

        {/* Current Prediction Preview */}
        {preview && (
          <Card className={`border-2 ${preview.alert_needed ? 'border-amber-300 bg-amber-50/50' : 'border-emerald-200 bg-emerald-50/50'}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                {preview.alert_needed ? (
                  <AlertTriangle className="text-amber-600" size={20} />
                ) : (
                  <CheckCircle className="text-emerald-600" size={20} />
                )}
                <CardTitle className="text-lg font-outfit">
                  Tomorrow's Prediction ({preview.prediction_day})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Predicted</p>
                  <p className="text-xl font-bold">{formatCurrency(preview.predicted_sales)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">30-Day Avg</p>
                  <p className="text-xl font-bold">{formatCurrency(preview.historical_avg)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Difference</p>
                  <p className={`text-xl font-bold ${preview.difference_percentage > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {preview.difference_percentage > 0 ? '-' : '+'}{Math.abs(preview.difference_percentage)}%
                  </p>
                </div>
              </div>
              <p className="text-sm">
                {preview.alert_needed ? (
                  <span className="text-amber-700">⚠️ Alert would be triggered (below {config.threshold_percentage}% threshold)</span>
                ) : (
                  <span className="text-emerald-700">✅ No alert needed (within normal range)</span>
                )}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Alert Configuration */}
          <Card className="border-stone-100">
            <CardHeader>
              <CardTitle className="text-lg font-outfit flex items-center gap-2">
                <Bell size={18} />
                Alert Settings
              </CardTitle>
              <CardDescription>Configure when and how to receive alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable/Disable */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Alerts</Label>
                  <p className="text-xs text-muted-foreground">Receive daily sales predictions</p>
                </div>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enabled: checked }))}
                  data-testid="enable-alerts-switch"
                />
              </div>

              {/* Threshold */}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label>Alert Threshold</Label>
                  <span className="text-sm font-medium">{config.threshold_percentage}% below average</span>
                </div>
                <Slider
                  value={[config.threshold_percentage]}
                  onValueChange={([val]) => setConfig(prev => ({ ...prev, threshold_percentage: val }))}
                  min={5}
                  max={50}
                  step={5}
                  className="w-full"
                  data-testid="threshold-slider"
                />
                <p className="text-xs text-muted-foreground">
                  Alert when predicted sales are {config.threshold_percentage}% or more below the 30-day average
                </p>
              </div>

              {/* Alert Time */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock size={14} />
                  Daily Alert Time
                </Label>
                <Input
                  type="time"
                  value={config.alert_time}
                  onChange={(e) => setConfig(prev => ({ ...prev, alert_time: e.target.value }))}
                  className="w-32"
                  data-testid="alert-time-input"
                />
                <p className="text-xs text-muted-foreground">
                  Time to check and send daily alerts (server time)
                </p>
              </div>

              {/* Notification Channels */}
              <div className="space-y-3">
                <Label>Notification Channels</Label>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.email_enabled}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, email_enabled: checked }))}
                      data-testid="email-enabled-switch"
                    />
                    <Label className="flex items-center gap-1 cursor-pointer">
                      <Mail size={14} />Email
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.whatsapp_enabled}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, whatsapp_enabled: checked }))}
                      data-testid="whatsapp-enabled-switch"
                    />
                    <Label className="flex items-center gap-1 cursor-pointer">
                      <MessageCircle size={14} />WhatsApp
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recipients */}
          <Card className="border-stone-100">
            <CardHeader>
              <CardTitle className="text-lg font-outfit">Recipients</CardTitle>
              <CardDescription>Who should receive alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add recipient */}
              <div className="flex gap-2">
                <Input
                  placeholder="email@example.com or +1234567890"
                  value={newRecipient}
                  onChange={(e) => setNewRecipient(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addRecipient()}
                  data-testid="recipient-input"
                />
                <Button size="sm" onClick={addRecipient} data-testid="add-recipient-btn">
                  <Plus size={14} />
                </Button>
              </div>

              {/* Recipients list */}
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {config.recipients.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No recipients added yet
                  </p>
                ) : (
                  config.recipients.map((recipient, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-stone-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        {recipient.includes('@') ? (
                          <Mail size={14} className="text-blue-500" />
                        ) : (
                          <MessageCircle size={14} className="text-emerald-500" />
                        )}
                        <span className="text-sm">{recipient}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeRecipient(recipient)}
                        className="h-7 w-7 p-0 text-red-500"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Add email addresses for email alerts, or phone numbers with country code (e.g., +966...) for WhatsApp
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Alert History */}
        <Card className="border-stone-100">
          <CardHeader>
            <CardTitle className="text-lg font-outfit">Alert History</CardTitle>
            <CardDescription>Recent alerts sent</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No alerts sent yet
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="alert-history-table">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">Date</th>
                      <th className="text-right p-2 font-medium">Predicted</th>
                      <th className="text-right p-2 font-medium">Average</th>
                      <th className="text-right p-2 font-medium">Diff</th>
                      <th className="text-left p-2 font-medium">Sent To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((alert, i) => (
                      <tr key={i} className="border-b hover:bg-stone-50">
                        <td className="p-2">
                          {format(new Date(alert.sent_at), 'MMM dd, HH:mm')}
                        </td>
                        <td className="p-2 text-right">{formatCurrency(alert.predicted_sales)}</td>
                        <td className="p-2 text-right">{formatCurrency(alert.historical_avg)}</td>
                        <td className="p-2 text-right text-red-600">-{alert.difference_pct?.toFixed(1)}%</td>
                        <td className="p-2">
                          <div className="flex gap-1">
                            {alert.results?.email_sent?.length > 0 && (
                              <Badge variant="outline" className="text-[10px]">
                                <Mail size={10} className="mr-1" />{alert.results.email_sent.length}
                              </Badge>
                            )}
                            {alert.results?.whatsapp_sent?.length > 0 && (
                              <Badge variant="outline" className="text-[10px]">
                                <MessageCircle size={10} className="mr-1" />{alert.results.whatsapp_sent.length}
                              </Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
