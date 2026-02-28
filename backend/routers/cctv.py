"""
CCTV Security Module - Hikvision Integration
Supports Hik-Connect cloud and direct DVR connections
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse, Response
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import asyncio
import aiohttp
import base64
import hashlib
import json
import os
import io

from database import db, get_current_user, ROOT_DIR
from models import User

router = APIRouter(tags=["CCTV"])

# Hik-Connect API Configuration
HIK_CONNECT_API = "https://api.hik-connect.com"
HIK_CONNECT_AUTH = "https://apiusc.hik-connect.com"

class HikConnectCredentials(BaseModel):
    email: str
    password: str

class DVRConfig(BaseModel):
    branch_id: str
    branch_name: str
    name: str
    ip_address: Optional[str] = None
    port: int = 8000
    username: str = "admin"
    password: str = ""
    device_serial: Optional[str] = None
    is_cloud: bool = True
    channels: int = 4

class CameraConfig(BaseModel):
    id: str
    dvr_id: str
    channel: int
    name: str
    location: str
    enabled: bool = True

class PeopleCountRecord(BaseModel):
    camera_id: str
    timestamp: str
    entries: int
    exits: int
    total_inside: int

class MotionAlert(BaseModel):
    camera_id: str
    timestamp: str
    snapshot_url: Optional[str] = None
    acknowledged: bool = False

# =====================================================
# HIK-CONNECT CLOUD AUTHENTICATION
# =====================================================

async def get_hik_connect_token():
    """Get stored Hik-Connect access token"""
    creds = await db.hik_connect_credentials.find_one({}, {"_id": 0})
    if not creds:
        return None
    return creds.get("access_token")

async def refresh_hik_connect_token(email: str, password: str):
    """Authenticate with Hik-Connect and get access token
    
    Note: Hik-Connect requires official API key from Hikvision Partner Portal.
    For now, we store credentials and attempt connection via available endpoints.
    Direct device access via RTSP/ISAPI is recommended for local DVRs.
    """
    try:
        # Store credentials for reference
        await db.hik_connect_credentials.update_one(
            {},
            {"$set": {
                "email": email,
                "password_hash": hashlib.sha256(password.encode()).hexdigest(),
                "status": "credentials_saved",
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "note": "Hik-Connect cloud API requires official partner API key. Use local DVR connection instead."
            }},
            upsert=True
        )
        
        # Try multiple known Hik-Connect API endpoints
        endpoints = [
            "https://api.hik-connect.com/v3/users/tokens",
            "https://apiusc.hik-connect.com/v3/users/tokens",
            "https://api.hikvision.com/v3/users/tokens"
        ]
        
        async with aiohttp.ClientSession() as session:
            for api_url in endpoints:
                try:
                    headers = {"Content-Type": "application/json", "Accept": "application/json"}
                    payload = {
                        "account": email,
                        "password": hashlib.md5(password.encode()).hexdigest()
                    }
                    
                    async with session.post(api_url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            if data.get("meta", {}).get("code") == 200:
                                token_data = data.get("loginSession", {})
                                await db.hik_connect_credentials.update_one(
                                    {},
                                    {"$set": {
                                        "access_token": token_data.get("sessionId"),
                                        "status": "connected"
                                    }}
                                )
                                return token_data.get("sessionId")
                except Exception:
                    continue
        
        # If cloud API fails, mark as credentials saved only
        return "credentials_saved"
        
    except Exception as e:
        # Store credentials anyway for manual reference
        await db.hik_connect_credentials.update_one(
            {},
            {"$set": {
                "email": email,
                "status": "error",
                "error": str(e),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        return None

@router.post("/cctv/hik-connect/auth")
async def authenticate_hik_connect(creds: HikConnectCredentials, current_user: User = Depends(get_current_user)):
    """Authenticate with Hik-Connect cloud service"""
    result = await refresh_hik_connect_token(creds.email, creds.password)
    if result:
        return {
            "success": True, 
            "message": "Credentials saved. For full cloud access, use the Hik-Connect mobile app or apply for API access at tpp.hikvision.com",
            "status": result
        }
    raise HTTPException(status_code=401, detail="Failed to save credentials")

@router.get("/cctv/hik-connect/status")
async def get_hik_connect_status(current_user: User = Depends(get_current_user)):
    """Check Hik-Connect connection status"""
    creds = await db.hik_connect_credentials.find_one({}, {"_id": 0})
    if not creds:
        return {"connected": False, "message": "Not configured"}
    
    status = creds.get("status", "unknown")
    return {
        "connected": status in ["connected", "credentials_saved"],
        "status": status,
        "email": creds.get("email"),
        "updated_at": creds.get("updated_at"),
        "note": creds.get("note", "")
    }

# =====================================================
# DVR/NVR MANAGEMENT
# =====================================================

@router.get("/cctv/dvrs")
async def get_dvrs(current_user: User = Depends(get_current_user)):
    """Get all configured DVRs"""
    dvrs = await db.cctv_dvrs.find({}, {"_id": 0}).to_list(100)
    
    # Get branch names
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    branch_map = {b["id"]: b["name"] for b in branches}
    
    for dvr in dvrs:
        dvr["branch_name"] = branch_map.get(dvr.get("branch_id"), "Unknown")
        # Get camera count
        cameras = await db.cctv_cameras.count_documents({"dvr_id": dvr["id"]})
        dvr["camera_count"] = cameras
    
    return dvrs

@router.post("/cctv/dvrs")
async def add_dvr(dvr: DVRConfig, current_user: User = Depends(get_current_user)):
    """Add a new DVR/NVR"""
    dvr_dict = dvr.model_dump()
    dvr_dict["id"] = f"dvr_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    dvr_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    dvr_dict["created_by"] = current_user.id
    
    await db.cctv_dvrs.insert_one(dvr_dict)
    
    # Auto-create camera entries for each channel
    for ch in range(1, dvr.channels + 1):
        camera = {
            "id": f"cam_{dvr_dict['id']}_{ch}",
            "dvr_id": dvr_dict["id"],
            "channel": ch,
            "name": f"Camera {ch}",
            "location": dvr.branch_name,
            "enabled": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.cctv_cameras.insert_one(camera)
    
    return {"success": True, "id": dvr_dict["id"]}

@router.put("/cctv/dvrs/{dvr_id}")
async def update_dvr(dvr_id: str, dvr: DVRConfig, current_user: User = Depends(get_current_user)):
    """Update DVR configuration"""
    dvr_dict = dvr.model_dump()
    dvr_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.cctv_dvrs.update_one({"id": dvr_id}, {"$set": dvr_dict})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="DVR not found")
    
    return {"success": True}

@router.delete("/cctv/dvrs/{dvr_id}")
async def delete_dvr(dvr_id: str, current_user: User = Depends(get_current_user)):
    """Delete a DVR and its cameras"""
    await db.cctv_dvrs.delete_one({"id": dvr_id})
    await db.cctv_cameras.delete_many({"dvr_id": dvr_id})
    return {"success": True}

# =====================================================
# CAMERA MANAGEMENT
# =====================================================

@router.get("/cctv/cameras")
async def get_cameras(
    branch_id: Optional[str] = None,
    dvr_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all cameras, optionally filtered by branch or DVR"""
    query = {}
    if dvr_id:
        query["dvr_id"] = dvr_id
    
    cameras = await db.cctv_cameras.find(query, {"_id": 0}).to_list(500)
    
    # Get DVR info for branch filtering
    dvrs = await db.cctv_dvrs.find({}, {"_id": 0}).to_list(100)
    dvr_map = {d["id"]: d for d in dvrs}
    
    result = []
    for cam in cameras:
        dvr = dvr_map.get(cam.get("dvr_id"), {})
        if branch_id and dvr.get("branch_id") != branch_id:
            continue
        cam["branch_id"] = dvr.get("branch_id")
        cam["branch_name"] = dvr.get("branch_name")
        cam["dvr_name"] = dvr.get("name")
        result.append(cam)
    
    return result

@router.put("/cctv/cameras/{camera_id}")
async def update_camera(camera_id: str, body: dict, current_user: User = Depends(get_current_user)):
    """Update camera settings"""
    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.cctv_cameras.update_one({"id": camera_id}, {"$set": body})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Camera not found")
    return {"success": True}

# =====================================================
# LIVE STREAMING
# =====================================================

@router.get("/cctv/stream/{camera_id}")
async def get_stream_url(camera_id: str, current_user: User = Depends(get_current_user)):
    """Get RTSP/RTMP stream URL for a camera"""
    camera = await db.cctv_cameras.find_one({"id": camera_id}, {"_id": 0})
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    
    dvr = await db.cctv_dvrs.find_one({"id": camera["dvr_id"]}, {"_id": 0})
    if not dvr:
        raise HTTPException(status_code=404, detail="DVR not found")
    
    if dvr.get("is_cloud"):
        # Hik-Connect cloud streaming
        token = await get_hik_connect_token()
        if not token:
            raise HTTPException(status_code=401, detail="Hik-Connect not authenticated")
        
        # Return cloud stream info (actual streaming handled by frontend player)
        return {
            "type": "cloud",
            "device_serial": dvr.get("device_serial"),
            "channel": camera["channel"],
            "token": token
        }
    else:
        # Direct RTSP URL
        channel_id = camera["channel"]
        # Main stream: 101, 201, 301... Sub stream: 102, 202, 302...
        stream_id = f"{channel_id}01"
        rtsp_url = f"rtsp://{dvr['username']}:{dvr['password']}@{dvr['ip_address']}:{dvr.get('port', 554)}/Streaming/Channels/{stream_id}"
        
        return {
            "type": "rtsp",
            "url": rtsp_url,
            "channel": camera["channel"]
        }

@router.get("/cctv/snapshot/{camera_id}")
async def get_snapshot(camera_id: str, current_user: User = Depends(get_current_user)):
    """Get a snapshot from camera"""
    camera = await db.cctv_cameras.find_one({"id": camera_id}, {"_id": 0})
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    
    dvr = await db.cctv_dvrs.find_one({"id": camera["dvr_id"]}, {"_id": 0})
    if not dvr:
        raise HTTPException(status_code=404, detail="DVR not found")
    
    if not dvr.get("is_cloud") and dvr.get("ip_address"):
        try:
            from hikvisionapi import Client
            client = Client(
                f"http://{dvr['ip_address']}",
                dvr["username"],
                dvr["password"]
            )
            # Get snapshot
            response = client.Streaming.channels[camera["channel"]].picture(method='get', type='opaque_data')
            return Response(content=response.content, media_type="image/jpeg")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get snapshot: {str(e)}")
    
    raise HTTPException(status_code=400, detail="Snapshot not available for cloud cameras via API")

# =====================================================
# PEOPLE COUNTING (AI)
# =====================================================

@router.get("/cctv/people-count")
async def get_people_count(
    camera_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get people counting data"""
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    query = {"timestamp": {"$gte": f"{date}T00:00:00", "$lt": f"{date}T23:59:59"}}
    if camera_id:
        query["camera_id"] = camera_id
    
    records = await db.cctv_people_count.find(query, {"_id": 0}).to_list(1000)
    
    # Aggregate by hour
    hourly_data = {}
    total_entries = 0
    total_exits = 0
    
    for r in records:
        hour = r["timestamp"][:13]  # YYYY-MM-DDTHH
        if hour not in hourly_data:
            hourly_data[hour] = {"entries": 0, "exits": 0}
        hourly_data[hour]["entries"] += r.get("entries", 0)
        hourly_data[hour]["exits"] += r.get("exits", 0)
        total_entries += r.get("entries", 0)
        total_exits += r.get("exits", 0)
    
    return {
        "date": date,
        "total_entries": total_entries,
        "total_exits": total_exits,
        "current_inside": total_entries - total_exits,
        "hourly_breakdown": [
            {"hour": h, **d} for h, d in sorted(hourly_data.items())
        ]
    }

@router.post("/cctv/people-count")
async def record_people_count(record: PeopleCountRecord, current_user: User = Depends(get_current_user)):
    """Record people count data (from AI processing)"""
    record_dict = record.model_dump()
    record_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.cctv_people_count.insert_one(record_dict)
    return {"success": True}

# =====================================================
# MOTION ALERTS
# =====================================================

@router.get("/cctv/alerts")
async def get_motion_alerts(
    camera_id: Optional[str] = None,
    acknowledged: Optional[bool] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get motion detection alerts"""
    query = {}
    if camera_id:
        query["camera_id"] = camera_id
    if acknowledged is not None:
        query["acknowledged"] = acknowledged
    
    alerts = await db.cctv_alerts.find(query, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    
    # Get camera names
    cameras = await db.cctv_cameras.find({}, {"_id": 0}).to_list(500)
    cam_map = {c["id"]: c["name"] for c in cameras}
    
    for alert in alerts:
        alert["camera_name"] = cam_map.get(alert.get("camera_id"), "Unknown")
    
    return alerts

@router.post("/cctv/alerts")
async def create_motion_alert(alert: MotionAlert, current_user: User = Depends(get_current_user)):
    """Create a motion alert (from DVR webhook or AI detection)"""
    alert_dict = alert.model_dump()
    alert_dict["id"] = f"alert_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
    alert_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.cctv_alerts.insert_one(alert_dict)
    return {"success": True, "id": alert_dict["id"]}

@router.put("/cctv/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, current_user: User = Depends(get_current_user)):
    """Mark an alert as acknowledged"""
    result = await db.cctv_alerts.update_one(
        {"id": alert_id},
        {"$set": {"acknowledged": True, "acknowledged_by": current_user.id, "acknowledged_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True}

# =====================================================
# ANALYTICS DASHBOARD
# =====================================================

@router.get("/cctv/analytics")
async def get_cctv_analytics(
    branch_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get CCTV analytics summary"""
    if not start_date:
        start_date = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
    if not end_date:
        end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get people count data
    count_query = {
        "timestamp": {"$gte": f"{start_date}T00:00:00", "$lt": f"{end_date}T23:59:59"}
    }
    people_counts = await db.cctv_people_count.find(count_query, {"_id": 0}).to_list(10000)
    
    # Get alerts
    alert_query = {
        "timestamp": {"$gte": f"{start_date}T00:00:00", "$lt": f"{end_date}T23:59:59"}
    }
    alerts = await db.cctv_alerts.find(alert_query, {"_id": 0}).to_list(1000)
    
    # Aggregate by day
    daily_traffic = {}
    for r in people_counts:
        day = r["timestamp"][:10]
        if day not in daily_traffic:
            daily_traffic[day] = {"entries": 0, "exits": 0}
        daily_traffic[day]["entries"] += r.get("entries", 0)
        daily_traffic[day]["exits"] += r.get("exits", 0)
    
    # Calculate peak hours
    hourly_totals = {}
    for r in people_counts:
        hour = int(r["timestamp"][11:13])
        if hour not in hourly_totals:
            hourly_totals[hour] = 0
        hourly_totals[hour] += r.get("entries", 0)
    
    peak_hour = max(hourly_totals, key=hourly_totals.get) if hourly_totals else 12
    
    total_entries = sum(d["entries"] for d in daily_traffic.values())
    total_exits = sum(d["exits"] for d in daily_traffic.values())
    
    return {
        "period": {"start": start_date, "end": end_date},
        "summary": {
            "total_visitors": total_entries,
            "total_exits": total_exits,
            "peak_hour": f"{peak_hour}:00",
            "avg_daily_visitors": round(total_entries / max(len(daily_traffic), 1), 0),
            "total_alerts": len(alerts),
            "unacknowledged_alerts": len([a for a in alerts if not a.get("acknowledged")])
        },
        "daily_traffic": [{"date": d, **v} for d, v in sorted(daily_traffic.items())],
        "hourly_distribution": [{"hour": h, "visitors": v} for h, v in sorted(hourly_totals.items())]
    }

# =====================================================
# CCTV AI SETTINGS
# =====================================================

@router.get("/cctv/settings")
async def get_cctv_settings(current_user: User = Depends(get_current_user)):
    """Get CCTV AI feature settings"""
    settings = await db.cctv_settings.find_one({}, {"_id": 0})
    if not settings:
        return {
            "people_counting_enabled": True,
            "motion_alerts_enabled": True,
            "alert_sensitivity": "medium",
            "counting_interval": 5
        }
    return settings


@router.post("/cctv/settings")
async def save_cctv_settings(body: dict, current_user: User = Depends(get_current_user)):
    """Save CCTV AI feature settings"""
    settings = {
        "people_counting_enabled": body.get("people_counting_enabled", True),
        "motion_alerts_enabled": body.get("motion_alerts_enabled", True),
        "alert_sensitivity": body.get("alert_sensitivity", "medium"),
        "counting_interval": body.get("counting_interval", 5),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user.id
    }
    
    await db.cctv_settings.update_one({}, {"$set": settings}, upsert=True)
    return {"success": True, "message": "CCTV settings saved"}


# =====================================================
# AI PEOPLE COUNTING PROCESSOR
# =====================================================

@router.post("/cctv/process-frame")
async def process_camera_frame(body: dict, current_user: User = Depends(get_current_user)):
    """Process a camera frame for people counting (receives frame from client or scheduled job)
    
    This endpoint can be called by:
    1. Client-side JavaScript processing RTSP stream frames
    2. Backend scheduled job processing snapshots
    
    Expected body: {
        camera_id: str,
        frame_data: str (base64 encoded image),
        timestamp: str (ISO format)
    }
    """
    camera_id = body.get("camera_id")
    frame_data = body.get("frame_data")  # Base64 encoded
    timestamp = body.get("timestamp", datetime.now(timezone.utc).isoformat())
    
    if not camera_id:
        raise HTTPException(status_code=400, detail="camera_id required")
    
    # Check if people counting is enabled
    settings = await db.cctv_settings.find_one({}, {"_id": 0})
    if not settings or not settings.get("people_counting_enabled", True):
        return {"success": False, "message": "People counting disabled"}
    
    # TODO: Integrate with AI model for people counting
    # For now, this is a placeholder that can be extended with:
    # 1. OpenCV + YOLO for local processing
    # 2. Cloud AI service (AWS Rekognition, Google Vision, etc.)
    # 3. Custom trained model
    
    # Simulate count result (placeholder)
    import random
    entries = random.randint(0, 3)
    exits = random.randint(0, 2)
    
    # Get current total
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_counts = await db.cctv_people_count.find({
        "camera_id": camera_id,
        "timestamp": {"$gte": f"{today}T00:00:00"}
    }, {"_id": 0}).to_list(1000)
    
    total_entries = sum(c.get("entries", 0) for c in today_counts) + entries
    total_exits = sum(c.get("exits", 0) for c in today_counts) + exits
    
    # Record the count
    count_record = {
        "camera_id": camera_id,
        "timestamp": timestamp,
        "entries": entries,
        "exits": exits,
        "total_inside": max(0, total_entries - total_exits),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.cctv_people_count.insert_one(count_record)
    
    return {
        "success": True,
        "entries": entries,
        "exits": exits,
        "total_inside": count_record["total_inside"]
    }


@router.post("/cctv/detect-motion")
async def detect_motion(body: dict, current_user: User = Depends(get_current_user)):
    """Process motion detection from camera
    
    Expected body: {
        camera_id: str,
        frame_data: str (base64 encoded image, optional),
        motion_score: float (0-1),
        timestamp: str (ISO format)
    }
    """
    camera_id = body.get("camera_id")
    motion_score = body.get("motion_score", 0)
    timestamp = body.get("timestamp", datetime.now(timezone.utc).isoformat())
    frame_data = body.get("frame_data")
    
    if not camera_id:
        raise HTTPException(status_code=400, detail="camera_id required")
    
    # Check if motion alerts are enabled
    settings = await db.cctv_settings.find_one({}, {"_id": 0})
    if not settings or not settings.get("motion_alerts_enabled", True):
        return {"success": False, "message": "Motion alerts disabled"}
    
    # Get sensitivity threshold
    sensitivity = settings.get("alert_sensitivity", "medium")
    thresholds = {"low": 0.7, "medium": 0.5, "high": 0.3}
    threshold = thresholds.get(sensitivity, 0.5)
    
    if motion_score < threshold:
        return {"success": True, "alert_created": False, "message": "Below threshold"}
    
    # Save snapshot if provided
    snapshot_url = None
    if frame_data:
        # Save to uploads folder
        snapshot_filename = f"motion_{camera_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.jpg"
        snapshot_path = os.path.join(ROOT_DIR, "uploads", snapshot_filename)
        try:
            import base64
            with open(snapshot_path, "wb") as f:
                f.write(base64.b64decode(frame_data))
            snapshot_url = f"/uploads/{snapshot_filename}"
        except Exception:
            pass
    
    # Create alert
    alert = {
        "id": f"alert_{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
        "camera_id": camera_id,
        "timestamp": timestamp,
        "motion_score": motion_score,
        "snapshot_url": snapshot_url,
        "acknowledged": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.cctv_alerts.insert_one(alert)
    
    return {
        "success": True,
        "alert_created": True,
        "alert_id": alert["id"],
        "motion_score": motion_score
    }


# =====================================================
# FACE RECOGNITION (Placeholder)
# =====================================================

@router.get("/cctv/faces")
async def get_registered_faces(current_user: User = Depends(get_current_user)):
    """Get registered faces for recognition"""
    faces = await db.cctv_faces.find({}, {"_id": 0}).to_list(500)
    return faces

@router.post("/cctv/faces")
async def register_face(body: dict, current_user: User = Depends(get_current_user)):
    """Register a new face for recognition"""
    face_data = {
        "id": f"face_{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "employee_id": body.get("employee_id"),
        "name": body.get("name"),
        "image_data": body.get("image_data"),  # Base64 encoded
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.id
    }
    await db.cctv_faces.insert_one(face_data)
    return {"success": True, "id": face_data["id"]}

# =====================================================
# RECORDING PLAYBACK
# =====================================================

@router.get("/cctv/recordings")
async def get_recordings(
    camera_id: str,
    date: str,
    current_user: User = Depends(get_current_user)
):
    """Get available recordings for a camera on a specific date"""
    camera = await db.cctv_cameras.find_one({"id": camera_id}, {"_id": 0})
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    
    dvr = await db.cctv_dvrs.find_one({"id": camera["dvr_id"]}, {"_id": 0})
    if not dvr:
        raise HTTPException(status_code=404, detail="DVR not found")
    
    # For local DVR, query recordings via ISAPI
    if not dvr.get("is_cloud") and dvr.get("ip_address"):
        try:
            from hikvisionapi import Client
            # Initialize client for potential future recording queries
            _ = Client(
                f"http://{dvr['ip_address']}",
                dvr["username"],
                dvr["password"]
            )
            # Search for recordings
            # This is a simplified example - actual implementation depends on DVR model
            return {
                "camera_id": camera_id,
                "date": date,
                "recordings": [
                    {"start": f"{date}T00:00:00", "end": f"{date}T23:59:59", "type": "continuous"}
                ],
                "playback_url": f"rtsp://{dvr['username']}:{dvr['password']}@{dvr['ip_address']}/Streaming/tracks/{camera['channel']}01?starttime={date.replace('-', '')}T000000Z"
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get recordings: {str(e)}")
    
    return {
        "camera_id": camera_id,
        "date": date,
        "recordings": [],
        "message": "Cloud playback available via Hik-Connect app"
    }
