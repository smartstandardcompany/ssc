import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  UserCheck, Camera, Upload, Trash2, Loader2, CheckCircle, XCircle,
  Package, AlertTriangle, Clock, Calendar, Eye, Scan, Users
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function FaceRecognitionPanel({ employees = [], branches = [] }) {
  const [registeredFaces, setRegisteredFaces] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState('');
  const [testResult, setTestResult] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchRegisteredFaces();
    fetchAttendance();
  }, []);

  const fetchRegisteredFaces = async () => {
    try {
      const res = await api.get('/cctv/faces');
      setRegisteredFaces(res.data);
    } catch {}
  };

  const fetchAttendance = async () => {
    try {
      const res = await api.get('/cctv/attendance');
      setAttendance(res.data.records || []);
    } catch {}
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result.split(',')[1];
      setImageBase64(base64);
      setImagePreview(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const registerFace = async () => {
    if (!selectedEmployee || !imageBase64) {
      toast.error('Please select an employee and upload a face image');
      return;
    }

    setLoading(true);
    try {
      await api.post('/cctv/faces/register', {
        employee_id: selectedEmployee,
        image_data: imageBase64
      });
      toast.success('Face registered successfully!');
      setShowRegister(false);
      setSelectedEmployee('');
      setImagePreview(null);
      setImageBase64('');
      fetchRegisteredFaces();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to register face');
    } finally {
      setLoading(false);
    }
  };

  const deleteFace = async (employeeId) => {
    if (!confirm('Remove face registration?')) return;
    try {
      await api.delete(`/cctv/faces/${employeeId}`);
      toast.success('Face registration removed');
      fetchRegisteredFaces();
    } catch {
      toast.error('Failed to remove');
    }
  };

  const testRecognition = async () => {
    if (!imageBase64) {
      toast.error('Please upload an image to test');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/cctv/ai/recognize-face', {
        camera_id: 'test',
        image_data: imageBase64
      });
      setTestResult(res.data);
      if (res.data.matches?.length > 0) {
        toast.success(`Found ${res.data.matches.length} match(es)!`);
      } else {
        toast.info('No matches found');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Recognition failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg"><UserCheck size={18} className="text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{registeredFaces.length}</p>
                <p className="text-xs text-muted-foreground">Registered Faces</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-success/10 rounded-lg"><CheckCircle size={18} className="text-success" /></div>
              <div>
                <p className="text-2xl font-bold">{attendance.length}</p>
                <p className="text-xs text-muted-foreground">Check-ins Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-4">
            <Button onClick={() => setShowRegister(true)} className="w-full rounded-xl">
              <Upload size={14} className="mr-1" /> Register Face
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Registered Faces */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="font-outfit text-base flex items-center gap-2">
            <UserCheck size={18} />
            Registered Employees for Face Recognition
          </CardTitle>
        </CardHeader>
        <CardContent>
          {registeredFaces.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {registeredFaces.map((face) => (
                <div key={face.id} className="p-3 bg-stone-50 rounded-xl text-center relative group">
                  <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-stone-200 overflow-hidden">
                    {face.image_path ? (
                      <img src={face.image_path} alt={face.name} className="w-full h-full object-cover" />
                    ) : (
                      <UserCheck size={24} className="m-5 text-stone-400" />
                    )}
                  </div>
                  <p className="text-sm font-medium truncate">{face.name}</p>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                    onClick={() => deleteFace(face.employee_id)}
                  >
                    <Trash2 size={12} className="text-error" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <UserCheck size={32} className="mx-auto mb-2 opacity-30" />
              <p>No faces registered yet</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => setShowRegister(true)}>
                Register First Face
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's Attendance */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="font-outfit text-base flex items-center gap-2">
            <Calendar size={18} />
            Today's Face Recognition Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attendance.length > 0 ? (
            <div className="space-y-2">
              {attendance.map((record, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <CheckCircle size={18} className="text-success" />
                    <div>
                      <p className="text-sm font-medium">{record.employee_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Check-in: {format(new Date(record.check_in), 'HH:mm:ss')}
                        {record.check_out && ` • Check-out: ${format(new Date(record.check_out), 'HH:mm:ss')}`}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-success/20 text-success text-xs">
                    {Math.round((record.confidence || 0) * 100)}% match
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock size={32} className="mx-auto mb-2 opacity-30" />
              <p>No check-ins today</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Register Face Dialog */}
      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-outfit">Register Employee Face</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.filter(e => !registeredFaces.find(f => f.employee_id === e.id)).map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Face Photo</Label>
              <div className="mt-2">
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover rounded-xl" />
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="absolute top-2 right-2"
                      onClick={() => { setImagePreview(null); setImageBase64(''); }}
                    >
                      <XCircle size={14} />
                    </Button>
                  </div>
                ) : (
                  <div 
                    className="border-2 border-dashed border-stone-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera size={32} className="mx-auto mb-2 text-stone-400" />
                    <p className="text-sm text-muted-foreground">Click to upload face photo</p>
                    <p className="text-xs text-muted-foreground mt-1">Clear front-facing photo works best</p>
                  </div>
                )}
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageUpload}
                />
              </div>
            </div>
            {testResult && (
              <div className="p-3 bg-stone-50 rounded-xl">
                <p className="text-xs font-medium mb-1">Test Result:</p>
                <p className="text-xs text-muted-foreground">
                  Faces detected: {testResult.faces_detected} | 
                  Matches: {testResult.matches?.length || 0}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={testRecognition} disabled={loading || !imageBase64}>
              {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Scan size={14} className="mr-1" />}
              Test
            </Button>
            <Button onClick={registerFace} disabled={loading || !selectedEmployee || !imageBase64}>
              {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Upload size={14} className="mr-1" />}
              Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ObjectDetectionPanel({ cameras = [] }) {
  const [detections, setDetections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [testImage, setTestImage] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [targetObjects, setTargetObjects] = useState('');
  const [context, setContext] = useState('retail store inventory');
  const [selectedCamera, setSelectedCamera] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchDetections();
  }, []);

  const fetchDetections = async () => {
    try {
      const res = await api.get('/cctv/object-detections?limit=20');
      setDetections(res.data);
    } catch {}
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setTestImage({
        preview: event.target.result,
        base64: event.target.result.split(',')[1]
      });
    };
    reader.readAsDataURL(file);
  };

  const runDetection = async () => {
    if (!testImage?.base64) {
      toast.error('Please upload an image');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/cctv/ai/detect-objects', {
        camera_id: selectedCamera || 'test',
        image_data: testImage.base64,
        target_objects: targetObjects ? targetObjects.split(',').map(s => s.trim()) : null,
        context: context
      });
      setTestResult(res.data);
      toast.success(`Detected ${res.data.total_items || 0} items`);
      fetchDetections();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Detection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Test Detection */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="font-outfit text-base flex items-center gap-2">
            <Scan size={18} />
            AI Object Detection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload an image from your camera or inventory area to detect and count objects.
          </p>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Camera (optional)</Label>
              <Select value={selectedCamera} onValueChange={setSelectedCamera}>
                <SelectTrigger>
                  <SelectValue placeholder="Any camera" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any camera</SelectItem>
                  {cameras.map(cam => (
                    <SelectItem key={cam.id} value={cam.id}>{cam.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Context</Label>
              <Select value={context} onValueChange={setContext}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retail store inventory">Retail Store</SelectItem>
                  <SelectItem value="warehouse shelves">Warehouse</SelectItem>
                  <SelectItem value="restaurant kitchen">Kitchen</SelectItem>
                  <SelectItem value="office supplies">Office</SelectItem>
                  <SelectItem value="grocery store">Grocery</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Target Objects (optional)</Label>
              <Input 
                value={targetObjects} 
                onChange={(e) => setTargetObjects(e.target.value)}
                placeholder="e.g., bottles, boxes, cans"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              {testImage ? (
                <div className="relative">
                  <img src={testImage.preview} alt="Test" className="w-full h-48 object-cover rounded-xl" />
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="absolute top-2 right-2"
                    onClick={() => { setTestImage(null); setTestResult(null); }}
                  >
                    <XCircle size={14} />
                  </Button>
                </div>
              ) : (
                <div 
                  className="border-2 border-dashed border-stone-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary h-48 flex flex-col items-center justify-center"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Package size={32} className="mb-2 text-stone-400" />
                  <p className="text-sm text-muted-foreground">Upload image</p>
                </div>
              )}
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleImageUpload}
              />
              <Button 
                className="w-full mt-2 rounded-xl" 
                onClick={runDetection}
                disabled={loading || !testImage}
              >
                {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Scan size={14} className="mr-1" />}
                Run Detection
              </Button>
            </div>

            {/* Results */}
            <div className="p-4 bg-stone-50 rounded-xl">
              <h3 className="font-medium text-sm mb-3">Detection Results</h3>
              {testResult ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  <p className="text-xs text-muted-foreground">Total items: {testResult.total_items || 0}</p>
                  {testResult.objects_detected?.map((obj, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-white rounded-lg text-xs">
                      <span className="font-medium">{obj.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{obj.count}x</Badge>
                        <Badge className={obj.stock_level === 'low' || obj.stock_level === 'empty' ? 'bg-error/20 text-error' : 'bg-success/20 text-success'}>
                          {obj.stock_level}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {testResult.alerts?.length > 0 && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs font-medium text-warning mb-1">Alerts:</p>
                      {testResult.alerts.map((alert, idx) => (
                        <div key={idx} className="flex items-center gap-1 text-xs text-warning">
                          <AlertTriangle size={10} />
                          {alert.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Upload an image and run detection
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Detections */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="font-outfit text-base">Recent Object Detections</CardTitle>
        </CardHeader>
        <CardContent>
          {detections.length > 0 ? (
            <div className="space-y-2">
              {detections.slice(0, 10).map((det, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium">{det.total_items} items detected</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(det.timestamp), 'MMM dd, HH:mm')} • Camera: {det.camera_id}
                    </p>
                  </div>
                  {det.alerts?.length > 0 && (
                    <Badge className="bg-warning/20 text-warning">{det.alerts.length} alerts</Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package size={32} className="mx-auto mb-2 opacity-30" />
              <p>No detection history</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function PeopleCountingPanel({ cameras = [] }) {
  const [loading, setLoading] = useState(false);
  const [testImage, setTestImage] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [countHistory, setCountHistory] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchCountHistory();
  }, []);

  const fetchCountHistory = async () => {
    try {
      const res = await api.get('/cctv/people-count');
      setCountHistory(res.data.hourly_breakdown || []);
    } catch {}
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setTestImage({
        preview: event.target.result,
        base64: event.target.result.split(',')[1]
      });
    };
    reader.readAsDataURL(file);
  };

  const runPeopleCount = async () => {
    if (!testImage?.base64) {
      toast.error('Please upload an image');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/cctv/ai/count-people', {
        camera_id: selectedCamera || 'test',
        image_data: testImage.base64,
        previous_count: 0
      });
      setTestResult(res.data);
      if (res.data.success) {
        toast.success(`Counted ${res.data.people_count || 0} people`);
        fetchCountHistory();
      } else {
        toast.error(res.data.error || 'Counting failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'People counting failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* AI People Counting */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="font-outfit text-base flex items-center gap-2">
            <Users size={18} />
            AI People Counting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload an image from your camera to count people and analyze crowd density.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs mb-2 block">Select Camera (optional)</Label>
              <Select value={selectedCamera} onValueChange={setSelectedCamera}>
                <SelectTrigger>
                  <SelectValue placeholder="Any camera" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any camera</SelectItem>
                  {cameras.map(cam => (
                    <SelectItem key={cam.id} value={cam.id}>{cam.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              {testImage ? (
                <div className="relative">
                  <img src={testImage.preview} alt="Test" className="w-full h-48 object-cover rounded-xl" />
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="absolute top-2 right-2"
                    onClick={() => { setTestImage(null); setTestResult(null); }}
                  >
                    <XCircle size={14} />
                  </Button>
                </div>
              ) : (
                <div 
                  className="border-2 border-dashed border-stone-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary h-48 flex flex-col items-center justify-center"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Users size={32} className="mb-2 text-stone-400" />
                  <p className="text-sm text-muted-foreground">Upload image</p>
                </div>
              )}
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleImageUpload}
              />
              <Button 
                className="w-full mt-2 rounded-xl" 
                onClick={runPeopleCount}
                disabled={loading || !testImage}
                data-testid="count-people-btn"
              >
                {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Users size={14} className="mr-1" />}
                Count People
              </Button>
            </div>

            {/* Results */}
            <div className="p-4 bg-stone-50 rounded-xl">
              <h3 className="font-medium text-sm mb-3">Counting Results</h3>
              {testResult ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-white rounded-lg text-center">
                      <p className="text-2xl font-bold text-primary">{testResult.people_count || 0}</p>
                      <p className="text-xs text-muted-foreground">People Detected</p>
                    </div>
                    <div className="p-3 bg-white rounded-lg text-center">
                      <Badge className={`${
                        testResult.crowd_density === 'high' || testResult.crowd_density === 'very_high' 
                          ? 'bg-error/20 text-error' 
                          : testResult.crowd_density === 'medium' 
                            ? 'bg-warning/20 text-warning' 
                            : 'bg-success/20 text-success'
                      }`}>
                        {testResult.crowd_density || 'N/A'}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">Crowd Density</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-success/10 rounded-lg text-center">
                      <p className="font-bold text-success">{testResult.entries || 0}</p>
                      <p className="text-muted-foreground">Est. Entries</p>
                    </div>
                    <div className="p-2 bg-error/10 rounded-lg text-center">
                      <p className="font-bold text-error">{testResult.exits || 0}</p>
                      <p className="text-muted-foreground">Est. Exits</p>
                    </div>
                  </div>
                  {testResult.details?.notes && (
                    <p className="text-xs text-muted-foreground">{testResult.details.notes}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Upload an image to count people
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Today's Traffic */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="font-outfit text-base">Today's Foot Traffic</CardTitle>
        </CardHeader>
        <CardContent>
          {countHistory.length > 0 ? (
            <div className="space-y-2">
              {countHistory.slice(0, 12).map((record, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-stone-50 rounded-lg text-sm">
                  <span className="text-muted-foreground">{record.hour?.split('T')[1] || record.hour}</span>
                  <div className="flex gap-4">
                    <span className="text-success">+{record.entries} in</span>
                    <span className="text-error">-{record.exits} out</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users size={32} className="mx-auto mb-2 opacity-30" />
              <p>No traffic data today</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function MotionAnalysisPanel({ cameras = [] }) {
  const [loading, setLoading] = useState(false);
  const [testImage, setTestImage] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [alerts, setAlerts] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await api.get('/cctv/alerts?limit=20');
      setAlerts(res.data.filter(a => a.type === 'motion'));
    } catch {}
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setTestImage({
        preview: event.target.result,
        base64: event.target.result.split(',')[1]
      });
    };
    reader.readAsDataURL(file);
  };

  const runMotionAnalysis = async () => {
    if (!testImage?.base64) {
      toast.error('Please upload an image');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/cctv/ai/analyze-motion', {
        camera_id: selectedCamera || 'test',
        image_data: testImage.base64
      });
      setTestResult(res.data);
      if (res.data.success) {
        if (res.data.security_concern) {
          toast.warning('Security concern detected!');
        } else if (res.data.motion_detected) {
          toast.success('Motion detected');
        } else {
          toast.info('No significant motion detected');
        }
        fetchAlerts();
      } else {
        toast.error(res.data.error || 'Analysis failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Motion analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* AI Motion Analysis */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="font-outfit text-base flex items-center gap-2">
            <AlertTriangle size={18} />
            AI Motion & Security Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload a camera frame to analyze for motion, activity types, and potential security concerns.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs mb-2 block">Select Camera (optional)</Label>
              <Select value={selectedCamera} onValueChange={setSelectedCamera}>
                <SelectTrigger>
                  <SelectValue placeholder="Any camera" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any camera</SelectItem>
                  {cameras.map(cam => (
                    <SelectItem key={cam.id} value={cam.id}>{cam.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              {testImage ? (
                <div className="relative">
                  <img src={testImage.preview} alt="Test" className="w-full h-48 object-cover rounded-xl" />
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="absolute top-2 right-2"
                    onClick={() => { setTestImage(null); setTestResult(null); }}
                  >
                    <XCircle size={14} />
                  </Button>
                </div>
              ) : (
                <div 
                  className="border-2 border-dashed border-stone-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary h-48 flex flex-col items-center justify-center"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <AlertTriangle size={32} className="mb-2 text-stone-400" />
                  <p className="text-sm text-muted-foreground">Upload image</p>
                </div>
              )}
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleImageUpload}
              />
              <Button 
                className="w-full mt-2 rounded-xl" 
                onClick={runMotionAnalysis}
                disabled={loading || !testImage}
                data-testid="analyze-motion-btn"
              >
                {loading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Scan size={14} className="mr-1" />}
                Analyze Motion
              </Button>
            </div>

            {/* Results */}
            <div className="p-4 bg-stone-50 rounded-xl">
              <h3 className="font-medium text-sm mb-3">Analysis Results</h3>
              {testResult ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className={`${
                      testResult.alert_level === 'critical' || testResult.alert_level === 'high'
                        ? 'bg-error/20 text-error' 
                        : testResult.alert_level === 'medium' 
                          ? 'bg-warning/20 text-warning' 
                          : 'bg-success/20 text-success'
                    }`}>
                      {testResult.alert_level || 'none'} alert
                    </Badge>
                    {testResult.security_concern && (
                      <Badge className="bg-error text-white">Security Concern!</Badge>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-white rounded-lg">
                      <p className="font-medium">Motion Score</p>
                      <p className="text-lg font-bold">{Math.round((testResult.motion_score || 0) * 100)}%</p>
                    </div>
                    <div className="p-2 bg-white rounded-lg">
                      <p className="font-medium">Activity Type</p>
                      <p className="text-sm font-bold capitalize">{testResult.activity_type || 'none'}</p>
                    </div>
                  </div>

                  {testResult.description && (
                    <div className="p-2 bg-white rounded-lg">
                      <p className="text-xs font-medium mb-1">Description:</p>
                      <p className="text-xs text-muted-foreground">{testResult.description}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Upload an image to analyze motion
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Motion Alerts */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="font-outfit text-base">Recent Motion Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length > 0 ? (
            <div className="space-y-2">
              {alerts.slice(0, 10).map((alert, idx) => (
                <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl border ${
                  alert.acknowledged ? 'bg-stone-50 border-stone-200' : 'bg-warning/5 border-warning/30'
                }`}>
                  <div className={`p-2 rounded-lg ${
                    alert.alert_level === 'high' || alert.alert_level === 'critical' 
                      ? 'bg-error/20' 
                      : alert.alert_level === 'medium' 
                        ? 'bg-warning/20' 
                        : 'bg-stone-200'
                  }`}>
                    <AlertTriangle size={16} className={
                      alert.alert_level === 'high' || alert.alert_level === 'critical' 
                        ? 'text-error' 
                        : alert.alert_level === 'medium' 
                          ? 'text-warning' 
                          : 'text-stone-500'
                    } />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium capitalize">{alert.activity_type || 'Motion'}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(alert.timestamp), 'MMM dd, HH:mm:ss')}
                      {alert.motion_score && ` • Score: ${Math.round(alert.motion_score * 100)}%`}
                    </p>
                  </div>
                  {alert.snapshot_url && (
                    <Button size="sm" variant="outline" className="rounded-lg">
                      <Eye size={14} className="mr-1" /> View
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle size={32} className="mx-auto mb-2 opacity-30" />
              <p>No motion alerts</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
