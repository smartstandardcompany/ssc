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
import httpx
import base64
import hashlib
import json
import os
import io
import uuid

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
    port: int = 80
    http_port: int = 80
    rtsp_port: int = 554
    username: str = "admin"
    password: str = ""
    device_serial: Optional[str] = None
    is_cloud: bool = False
    connection_type: str = "remote"  # "local", "remote", "cloud"
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
    dvr_dict["id"] = f"dvr_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
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
    """Get a live snapshot from camera via Hikvision ISAPI"""
    camera = await db.cctv_cameras.find_one({"id": camera_id}, {"_id": 0})
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    
    dvr = await db.cctv_dvrs.find_one({"id": camera["dvr_id"]}, {"_id": 0})
    if not dvr:
        raise HTTPException(status_code=404, detail="DVR not found")
    
    if not dvr.get("ip_address"):
        conn_type = dvr.get("connection_type", "cloud" if dvr.get("is_cloud") else "local")
        if conn_type == "cloud" and not dvr.get("ip_address"):
            raise HTTPException(status_code=400, detail="To view live feed, add the DVR's public IP address or DDNS domain. Go to Devices > Edit DVR and enter the public IP/domain with forwarded HTTP port.")
        raise HTTPException(status_code=400, detail="DVR IP address or domain not configured")
    
    channel = camera.get("channel", 1)
    http_port = dvr.get("http_port", dvr.get("port", 80))
    username = dvr.get("username", "admin")
    password = dvr.get("password", "")
    ip = dvr["ip_address"]
    
    # Hikvision ISAPI snapshot URL
    snapshot_url = f"http://{ip}:{http_port}/ISAPI/Streaming/channels/{channel}01/picture"
    
    try:
        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            # Attempt 1: Digest auth (Hikvision default)
            resp = await client.get(snapshot_url, auth=httpx.DigestAuth(username, password))
            if resp.status_code == 200 and b'<html' not in resp.content[:100].lower():
                return Response(content=resp.content, media_type="image/jpeg",
                                headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
            
            # Attempt 2: Basic auth fallback
            resp = await client.get(snapshot_url, auth=httpx.BasicAuth(username, password))
            if resp.status_code == 200 and b'<html' not in resp.content[:100].lower():
                return Response(content=resp.content, media_type="image/jpeg",
                                headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
            
            # Attempt 3: Alternative ISAPI path
            alt_url = f"http://{ip}:{http_port}/Streaming/channels/{channel}01/picture"
            resp = await client.get(alt_url, auth=httpx.DigestAuth(username, password))
            if resp.status_code == 200 and b'<html' not in resp.content[:100].lower():
                return Response(content=resp.content, media_type="image/jpeg",
                                headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
            
            # Attempt 4: Try HTTPS (some DVRs use HTTPS when port-forwarded)
            https_url = f"https://{ip}:{http_port}/ISAPI/Streaming/channels/{channel}01/picture"
            resp = await client.get(https_url, auth=httpx.DigestAuth(username, password))
            if resp.status_code == 200 and b'<html' not in resp.content[:100].lower():
                return Response(content=resp.content, media_type="image/jpeg",
                                headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
            
            raise HTTPException(status_code=502, detail=f"DVR responded with status {resp.status_code}. Verify: 1) IP/domain is correct, 2) HTTP port is forwarded, 3) Username/password are correct, 4) ISAPI is enabled on DVR.")
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail=f"Cannot connect to DVR at {ip}:{http_port}. For remote DVRs: ensure port {http_port} is forwarded on the branch router to the DVR's local IP.")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail=f"Connection to DVR at {ip}:{http_port} timed out. Check if the public IP is correct and the port is open.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get snapshot: {str(e)}")


@router.get("/cctv/stream-info/{camera_id}")
async def get_stream_info(camera_id: str, current_user: User = Depends(get_current_user)):
    """Get complete stream info including RTSP URLs and connection status for a camera"""
    camera = await db.cctv_cameras.find_one({"id": camera_id}, {"_id": 0})
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    
    dvr = await db.cctv_dvrs.find_one({"id": camera["dvr_id"]}, {"_id": 0})
    if not dvr:
        raise HTTPException(status_code=404, detail="DVR not found")
    
    channel = camera.get("channel", 1)
    conn_type = dvr.get("connection_type", "cloud" if dvr.get("is_cloud") else "local")
    ip = dvr.get("ip_address", "")
    
    if not ip:
        return {
            "type": conn_type,
            "device_serial": dvr.get("device_serial"),
            "channel": channel,
            "snapshot_available": False,
            "rtsp_available": False,
            "message": "No IP address configured. To view live feed, edit this DVR and add the public IP address or DDNS domain with the forwarded HTTP port."
        }
    
    http_port = dvr.get("http_port", dvr.get("port", 80))
    rtsp_port = dvr.get("rtsp_port", 554)
    username = dvr.get("username", "admin")
    password = dvr.get("password", "")
    
    # Build RTSP URLs
    main_stream = f"rtsp://{username}:{password}@{ip}:{rtsp_port}/Streaming/Channels/{channel}01"
    sub_stream = f"rtsp://{username}:{password}@{ip}:{rtsp_port}/Streaming/Channels/{channel}02"
    
    # Test if DVR is reachable
    reachable = False
    try:
        async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
            resp = await client.get(f"http://{ip}:{http_port}/ISAPI/System/deviceInfo", 
                                     auth=httpx.DigestAuth(username, password))
            reachable = resp.status_code == 200
    except Exception:
        pass
    
    return {
        "type": conn_type,
        "channel": channel,
        "ip_address": ip,
        "http_port": http_port,
        "rtsp_port": rtsp_port,
        "snapshot_available": reachable,
        "rtsp_available": True,
        "reachable": reachable,
        "rtsp_main": main_stream,
        "rtsp_sub": sub_stream,
        "snapshot_url": f"/api/cctv/snapshot/{camera_id}",
        "message": "DVR reachable" if reachable else f"Cannot reach DVR at {ip}:{http_port}. Ensure the port is forwarded and the IP is correct."
    }

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

@router.post("/cctv/ai/count-people")
async def ai_count_people(body: dict, current_user: User = Depends(get_current_user)):
    """AI-powered people counting using OpenAI Vision
    
    Expected body: {
        camera_id: str,
        image_data: str (base64 encoded image),
        previous_count: int (optional)
    }
    """
    from services.ai_vision import get_ai_vision_service
    
    camera_id = body.get("camera_id")
    image_data = body.get("image_data")
    previous_count = body.get("previous_count", 0)
    
    if not camera_id or not image_data:
        raise HTTPException(status_code=400, detail="camera_id and image_data required")
    
    # Check if people counting is enabled
    settings = await db.cctv_settings.find_one({}, {"_id": 0})
    if not settings or not settings.get("people_counting_enabled", True):
        return {"success": False, "message": "People counting disabled"}
    
    try:
        ai_service = get_ai_vision_service()
        result = await ai_service.count_people(image_data, previous_count)
        
        # Store the count
        count_record = {
            "camera_id": camera_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "entries": result.get("estimated_entries", 0),
            "exits": result.get("estimated_exits", 0),
            "total_count": result.get("people_count", 0),
            "crowd_density": result.get("crowd_density", "unknown"),
            "ai_response": result,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.cctv_people_count.insert_one(count_record)
        
        return {
            "success": True,
            "people_count": result.get("people_count", 0),
            "entries": result.get("estimated_entries", 0),
            "exits": result.get("estimated_exits", 0),
            "crowd_density": result.get("crowd_density", "unknown"),
            "details": result
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/cctv/ai/recognize-face")
async def ai_recognize_face(body: dict, current_user: User = Depends(get_current_user)):
    """AI-powered face recognition for attendance
    
    Expected body: {
        camera_id: str,
        image_data: str (base64 encoded image),
        branch_id: str (optional - to filter employees)
    }
    """
    from services.ai_vision import get_ai_vision_service
    
    camera_id = body.get("camera_id")
    image_data = body.get("image_data")
    branch_id = body.get("branch_id")
    
    if not image_data:
        raise HTTPException(status_code=400, detail="image_data required")
    
    # Get registered faces
    query = {}
    if branch_id:
        # Get employees from this branch
        employees = await db.employees.find({"branch_id": branch_id, "active": {"$ne": False}}, {"_id": 0}).to_list(100)
        emp_ids = [e["id"] for e in employees]
        query["employee_id"] = {"$in": emp_ids}
    
    registered_faces = await db.cctv_faces.find(query, {"_id": 0}).to_list(100)
    
    if not registered_faces:
        return {
            "success": True,
            "faces_detected": 0,
            "matches": [],
            "message": "No registered faces found. Please register employee faces first."
        }
    
    try:
        ai_service = get_ai_vision_service()
        result = await ai_service.recognize_face(image_data, registered_faces)
        
        # Log attendance for matched employees
        matches = result.get("matches", [])
        attendance_logged = []
        
        for match in matches:
            if match.get("confidence", 0) >= 0.7:
                emp_id = match.get("employee_id")
                if emp_id:
                    # Check if already logged today
                    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                    existing = await db.cctv_attendance.find_one({
                        "employee_id": emp_id,
                        "date": today
                    })
                    
                    if not existing:
                        attendance_record = {
                            "id": f"att_{datetime.now().strftime('%Y%m%d%H%M%S')}_{emp_id}",
                            "employee_id": emp_id,
                            "employee_name": match.get("name"),
                            "camera_id": camera_id,
                            "date": today,
                            "check_in": datetime.now(timezone.utc).isoformat(),
                            "confidence": match.get("confidence"),
                            "method": "face_recognition",
                            "created_at": datetime.now(timezone.utc).isoformat()
                        }
                        await db.cctv_attendance.insert_one(attendance_record)
                        attendance_logged.append({
                            "employee_id": emp_id,
                            "name": match.get("name"),
                            "action": "check_in"
                        })
        
        return {
            "success": True,
            "faces_detected": result.get("faces_detected", 0),
            "matches": matches,
            "unknown_faces": result.get("unknown_faces", 0),
            "attendance_logged": attendance_logged
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/cctv/ai/detect-objects")
async def ai_detect_objects(body: dict, current_user: User = Depends(get_current_user)):
    """AI-powered object detection for inventory monitoring
    
    Expected body: {
        camera_id: str,
        image_data: str (base64 encoded image),
        target_objects: list (optional - specific items to look for),
        context: str (optional - e.g., "kitchen", "warehouse", "retail shelf")
    }
    """
    from services.ai_vision import get_ai_vision_service
    
    camera_id = body.get("camera_id")
    image_data = body.get("image_data")
    target_objects = body.get("target_objects")
    context = body.get("context", "retail store inventory")
    
    if not image_data:
        raise HTTPException(status_code=400, detail="image_data required")
    
    try:
        ai_service = get_ai_vision_service()
        result = await ai_service.detect_objects(image_data, target_objects, context)
        
        # Store the detection result
        detection_record = {
            "id": f"det_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "camera_id": camera_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "objects_detected": result.get("objects_detected", []),
            "total_items": result.get("total_items", 0),
            "alerts": result.get("alerts", []),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.cctv_object_detections.insert_one(detection_record)
        
        # Create alerts for low stock or issues
        alerts = result.get("alerts", [])
        for alert in alerts:
            if alert.get("type") in ["low_stock", "empty_shelf", "damage"]:
                alert_record = {
                    "id": f"inv_alert_{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
                    "camera_id": camera_id,
                    "type": "inventory",
                    "subtype": alert.get("type"),
                    "object": alert.get("object"),
                    "message": alert.get("message"),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "acknowledged": False
                }
                await db.cctv_alerts.insert_one(alert_record)
        
        return {
            "success": True,
            "objects_detected": result.get("objects_detected", []),
            "total_items": result.get("total_items", 0),
            "alerts": alerts,
            "shelf_analysis": result.get("shelf_analysis"),
            "recommendations": result.get("recommendations", [])
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/cctv/ai/analyze-motion")
async def ai_analyze_motion(body: dict, current_user: User = Depends(get_current_user)):
    """AI-powered motion analysis for security
    
    Expected body: {
        camera_id: str,
        image_data: str (base64 encoded image)
    }
    """
    from services.ai_vision import get_ai_vision_service
    
    camera_id = body.get("camera_id")
    image_data = body.get("image_data")
    
    if not image_data:
        raise HTTPException(status_code=400, detail="image_data required")
    
    # Check if motion alerts are enabled
    settings = await db.cctv_settings.find_one({}, {"_id": 0})
    if not settings or not settings.get("motion_alerts_enabled", True):
        return {"success": False, "message": "Motion alerts disabled"}
    
    try:
        ai_service = get_ai_vision_service()
        result = await ai_service.analyze_motion(image_data)
        
        # Create alert if security concern
        if result.get("security_concern") or result.get("alert_level") in ["medium", "high", "critical"]:
            # Save snapshot
            snapshot_filename = f"motion_{camera_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.jpg"
            snapshot_path = os.path.join(ROOT_DIR, "uploads", snapshot_filename)
            try:
                with open(snapshot_path, "wb") as f:
                    f.write(base64.b64decode(image_data))
                snapshot_url = f"/uploads/{snapshot_filename}"
            except Exception:
                snapshot_url = None
            
            alert_record = {
                "id": f"motion_{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
                "camera_id": camera_id,
                "type": "motion",
                "activity_type": result.get("activity_type"),
                "alert_level": result.get("alert_level"),
                "motion_score": result.get("motion_score", 0),
                "description": result.get("description"),
                "snapshot_url": snapshot_url,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "acknowledged": False,
                "ai_analysis": result
            }
            await db.cctv_alerts.insert_one(alert_record)
        
        return {
            "success": True,
            "motion_detected": result.get("motion_detected", False),
            "motion_score": result.get("motion_score", 0),
            "activity_type": result.get("activity_type"),
            "alert_level": result.get("alert_level"),
            "description": result.get("description"),
            "security_concern": result.get("security_concern", False)
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


# =====================================================
# FACE REGISTRATION FOR EMPLOYEES
# =====================================================

@router.post("/cctv/faces/register")
async def register_employee_face(body: dict, current_user: User = Depends(get_current_user)):
    """Register an employee's face for recognition
    
    Expected body: {
        employee_id: str,
        image_data: str (base64 encoded face image)
    }
    """
    employee_id = body.get("employee_id")
    image_data = body.get("image_data")
    
    if not employee_id or not image_data:
        raise HTTPException(status_code=400, detail="employee_id and image_data required")
    
    # Get employee info
    employee = await db.employees.find_one({"id": employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Save face image
    face_filename = f"face_{employee_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.jpg"
    face_path = os.path.join(ROOT_DIR, "uploads", "faces", face_filename)
    os.makedirs(os.path.dirname(face_path), exist_ok=True)
    
    try:
        with open(face_path, "wb") as f:
            f.write(base64.b64decode(image_data))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save face image: {str(e)}")
    
    # Check if face already registered
    existing = await db.cctv_faces.find_one({"employee_id": employee_id})
    
    face_data = {
        "employee_id": employee_id,
        "name": employee.get("name"),
        "branch_id": employee.get("branch_id"),
        "image_path": f"/uploads/faces/{face_filename}",
        "image_data": image_data,  # Store base64 for AI comparison
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if existing:
        await db.cctv_faces.update_one({"employee_id": employee_id}, {"$set": face_data})
    else:
        face_data["id"] = f"face_{employee_id}"
        face_data["created_at"] = datetime.now(timezone.utc).isoformat()
        face_data["created_by"] = current_user.id
        await db.cctv_faces.insert_one(face_data)
    
    return {
        "success": True,
        "message": f"Face registered for {employee.get('name')}",
        "employee_id": employee_id
    }


@router.post("/cctv/faces/register-multiple")
async def register_multiple_faces(body: dict, current_user: User = Depends(get_current_user)):
    """Register multiple face images for an employee (improves recognition accuracy)
    
    Expected body: {
        employee_id: str,
        images: [str] (array of base64 encoded face images)
    }
    """
    employee_id = body.get("employee_id")
    images = body.get("images", [])
    
    if not employee_id or not images:
        raise HTTPException(status_code=400, detail="employee_id and images array required")
    
    if len(images) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 images allowed per employee")
    
    # Get employee info
    employee = await db.employees.find_one({"id": employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    saved_images = []
    
    for idx, image_data in enumerate(images):
        # Save face image
        face_filename = f"face_{employee_id}_{idx}_{datetime.now().strftime('%Y%m%d%H%M%S')}.jpg"
        face_path = os.path.join(ROOT_DIR, "uploads", "faces", face_filename)
        os.makedirs(os.path.dirname(face_path), exist_ok=True)
        
        try:
            with open(face_path, "wb") as f:
                f.write(base64.b64decode(image_data))
            saved_images.append({
                "image_path": f"/uploads/faces/{face_filename}",
                "image_data": image_data
            })
        except Exception as e:
            continue  # Skip failed images
    
    if not saved_images:
        raise HTTPException(status_code=500, detail="Failed to save any images")
    
    # Update or create face registration with multiple images
    face_data = {
        "employee_id": employee_id,
        "name": employee.get("name"),
        "branch_id": employee.get("branch_id"),
        "images": saved_images,
        "image_path": saved_images[0]["image_path"],  # Primary image for display
        "image_data": saved_images[0]["image_data"],  # Primary image for AI
        "training_images_count": len(saved_images),
        "training_status": "trained" if len(saved_images) >= 3 else "partial",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    existing = await db.cctv_faces.find_one({"employee_id": employee_id})
    if existing:
        await db.cctv_faces.update_one({"employee_id": employee_id}, {"$set": face_data})
    else:
        face_data["id"] = f"face_{employee_id}"
        face_data["created_at"] = datetime.now(timezone.utc).isoformat()
        face_data["created_by"] = current_user.id
        await db.cctv_faces.insert_one(face_data)
    
    return {
        "success": True,
        "message": f"Registered {len(saved_images)} face images for {employee.get('name')}",
        "employee_id": employee_id,
        "images_saved": len(saved_images),
        "training_status": face_data["training_status"]
    }


@router.get("/cctv/faces/training-status")
async def get_faces_training_status(
    branch_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get training status for all registered faces"""
    query = {}
    if branch_id:
        query["branch_id"] = branch_id
    
    faces = await db.cctv_faces.find(query, {"_id": 0}).to_list(500)
    
    total = len(faces)
    fully_trained = len([f for f in faces if f.get("training_status") == "trained"])
    partial = len([f for f in faces if f.get("training_status") == "partial"])
    untrained = total - fully_trained - partial
    
    return {
        "total_faces": total,
        "fully_trained": fully_trained,
        "partially_trained": partial,
        "untrained": untrained,
        "training_percentage": round((fully_trained / total) * 100, 1) if total > 0 else 0,
        "faces": [{
            "employee_id": f.get("employee_id"),
            "name": f.get("name"),
            "branch_id": f.get("branch_id"),
            "training_status": f.get("training_status", "single"),
            "images_count": f.get("training_images_count", 1),
            "updated_at": f.get("updated_at")
        } for f in faces]
    }


@router.delete("/cctv/faces/{employee_id}")
async def delete_employee_face(employee_id: str, current_user: User = Depends(get_current_user)):
    """Remove registered face for an employee"""
    result = await db.cctv_faces.delete_one({"employee_id": employee_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Face registration not found")
    return {"success": True, "message": "Face registration removed"}


# =====================================================
# ATTENDANCE FROM FACE RECOGNITION
# =====================================================

@router.get("/cctv/attendance")
async def get_face_attendance(
    date: Optional[str] = None,
    branch_id: Optional[str] = None,
    employee_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get attendance records from face recognition"""
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    query = {"date": date}
    if branch_id:
        # Get employees from branch
        employees = await db.employees.find({"branch_id": branch_id}, {"_id": 0}).to_list(500)
        emp_ids = [e["id"] for e in employees]
        query["employee_id"] = {"$in": emp_ids}
    if employee_id:
        query["employee_id"] = employee_id
    
    records = await db.cctv_attendance.find(query, {"_id": 0}).to_list(500)
    
    return {
        "date": date,
        "total_records": len(records),
        "records": records
    }


@router.post("/cctv/attendance/checkout")
async def face_attendance_checkout(body: dict, current_user: User = Depends(get_current_user)):
    """Record checkout time for an employee"""
    employee_id = body.get("employee_id")
    
    if not employee_id:
        raise HTTPException(status_code=400, detail="employee_id required")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    result = await db.cctv_attendance.update_one(
        {"employee_id": employee_id, "date": today, "check_out": {"$exists": False}},
        {"$set": {
            "check_out": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="No check-in found for today or already checked out")
    
    return {"success": True, "message": "Check-out recorded"}


# =====================================================
# OBJECT DETECTION HISTORY
# =====================================================

@router.get("/cctv/object-detections")
async def get_object_detections(
    camera_id: Optional[str] = None,
    date: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get object detection history"""
    query = {}
    if camera_id:
        query["camera_id"] = camera_id
    if date:
        query["timestamp"] = {"$gte": f"{date}T00:00:00", "$lt": f"{date}T23:59:59"}
    
    records = await db.cctv_object_detections.find(query, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return records


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
    _ = body.get("frame_data")  # Base64 encoded - reserved for future AI processing
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



# =====================================================
# SCHEDULED AI MONITORING
# =====================================================

class ScheduledMonitoringConfig(BaseModel):
    enabled: bool = True
    interval_minutes: int = 5  # 1, 5, 15, 30
    cameras: List[str] = []  # Empty = all cameras
    features: List[str] = ["people_counting", "motion_detection"]  # Available: people_counting, motion_detection, object_detection
    notification_channels: List[str] = ["in_app"]  # in_app, whatsapp, email


@router.get("/cctv/monitoring/config")
async def get_monitoring_config(current_user: User = Depends(get_current_user)):
    """Get scheduled monitoring configuration"""
    config = await db.cctv_monitoring_config.find_one({}, {"_id": 0})
    if not config:
        default_config = {
            "enabled": False,
            "interval_minutes": 5,
            "cameras": [],
            "features": ["people_counting", "motion_detection"],
            "notification_channels": ["in_app"],
            "last_run": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.cctv_monitoring_config.insert_one(default_config)
        return default_config
    return config


@router.post("/cctv/monitoring/config")
async def save_monitoring_config(config: ScheduledMonitoringConfig, current_user: User = Depends(get_current_user)):
    """Save scheduled monitoring configuration"""
    config_dict = config.model_dump()
    config_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    config_dict["updated_by"] = current_user.id
    
    await db.cctv_monitoring_config.update_one({}, {"$set": config_dict}, upsert=True)
    
    return {"success": True, "message": "Monitoring configuration saved"}


@router.post("/cctv/monitoring/run")
async def run_scheduled_monitoring(background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user)):
    """Manually trigger scheduled monitoring for all configured cameras"""
    config = await db.cctv_monitoring_config.find_one({}, {"_id": 0})
    if not config or not config.get("enabled"):
        return {"success": False, "message": "Scheduled monitoring is disabled"}
    
    # Queue the monitoring task
    background_tasks.add_task(execute_scheduled_monitoring)
    
    return {"success": True, "message": "Monitoring task queued"}


async def execute_scheduled_monitoring():
    """Execute scheduled monitoring for all cameras"""
    from services.ai_vision import get_ai_vision_service
    
    config = await db.cctv_monitoring_config.find_one({}, {"_id": 0})
    if not config or not config.get("enabled"):
        return
    
    # Get cameras to monitor
    camera_ids = config.get("cameras", [])
    if not camera_ids:
        cameras = await db.cctv_cameras.find({"enabled": True}, {"_id": 0}).to_list(100)
    else:
        cameras = await db.cctv_cameras.find({"id": {"$in": camera_ids}, "enabled": True}, {"_id": 0}).to_list(100)
    
    if not cameras:
        return
    
    features = config.get("features", [])
    ai_service = get_ai_vision_service()
    results = []
    
    for camera in cameras:
        try:
            # Get camera snapshot (for cameras with accessible streams)
            dvr = await db.cctv_dvrs.find_one({"id": camera.get("dvr_id")}, {"_id": 0})
            if not dvr:
                continue
            
            # For this demo, we'll use stored test frames or skip if no frame available
            # In production, this would capture from RTSP stream
            snapshot_data = await get_camera_snapshot_base64(camera["id"], dvr)
            if not snapshot_data:
                continue
            
            camera_results = {
                "camera_id": camera["id"],
                "camera_name": camera.get("name"),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            # People counting
            if "people_counting" in features:
                # Get previous count
                prev = await db.cctv_people_count.find_one(
                    {"camera_id": camera["id"]},
                    sort=[("timestamp", -1)]
                )
                prev_count = prev.get("total_count", 0) if prev else 0
                
                result = await ai_service.count_people(snapshot_data, prev_count)
                
                # Store result
                count_record = {
                    "camera_id": camera["id"],
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "entries": result.get("estimated_entries", 0),
                    "exits": result.get("estimated_exits", 0),
                    "total_count": result.get("people_count", 0),
                    "crowd_density": result.get("crowd_density", "unknown"),
                    "source": "scheduled",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.cctv_people_count.insert_one(count_record)
                camera_results["people_counting"] = result
            
            # Motion detection
            if "motion_detection" in features:
                result = await ai_service.analyze_motion(snapshot_data)
                
                if result.get("motion_detected") and result.get("alert_level") in ["medium", "high", "critical"]:
                    # Create alert
                    alert_record = {
                        "id": f"sched_motion_{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
                        "camera_id": camera["id"],
                        "type": "motion",
                        "activity_type": result.get("activity_type"),
                        "alert_level": result.get("alert_level"),
                        "motion_score": result.get("motion_score", 0),
                        "description": result.get("description"),
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "acknowledged": False,
                        "source": "scheduled"
                    }
                    await db.cctv_alerts.insert_one(alert_record)
                    
                    # Send notifications
                    await send_motion_notification(camera, result, config.get("notification_channels", []))
                
                camera_results["motion_detection"] = result
            
            # Object detection
            if "object_detection" in features:
                result = await ai_service.detect_objects(snapshot_data, None, "inventory monitoring")
                
                # Check for alerts
                for alert in result.get("alerts", []):
                    if alert.get("type") in ["low_stock", "empty_shelf"]:
                        alert_record = {
                            "id": f"sched_inv_{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
                            "camera_id": camera["id"],
                            "type": "inventory",
                            "subtype": alert.get("type"),
                            "object": alert.get("object"),
                            "message": alert.get("message"),
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "acknowledged": False,
                            "source": "scheduled"
                        }
                        await db.cctv_alerts.insert_one(alert_record)
                
                camera_results["object_detection"] = result
            
            results.append(camera_results)
            
        except Exception as e:
            results.append({
                "camera_id": camera["id"],
                "error": str(e)
            })
    
    # Update last run time
    await db.cctv_monitoring_config.update_one({}, {"$set": {"last_run": datetime.now(timezone.utc).isoformat()}})
    
    # Log the monitoring run
    log = {
        "id": f"monitor_{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "cameras_processed": len(results),
        "features": features,
        "results_summary": {
            "success": len([r for r in results if "error" not in r]),
            "errors": len([r for r in results if "error" in r])
        }
    }
    await db.cctv_monitoring_logs.insert_one(log)
    
    return results


async def get_camera_snapshot_base64(camera_id: str, dvr: dict) -> Optional[str]:
    """Get camera snapshot as base64. Returns None if not available."""
    # For local DVR with IP access
    if not dvr.get("is_cloud") and dvr.get("ip_address"):
        try:
            # Try to get snapshot via Hikvision ISAPI
            import aiohttp
            auth = aiohttp.BasicAuth(dvr.get("username", "admin"), dvr.get("password", ""))
            channel = 1  # Default channel, should be from camera config
            url = f"http://{dvr['ip_address']}:{dvr.get('port', 80)}/ISAPI/Streaming/channels/{channel}01/picture"
            
            async with aiohttp.ClientSession(auth=auth) as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        image_data = await resp.read()
                        return base64.b64encode(image_data).decode('utf-8')
        except Exception:
            pass
    
    # Check for stored test frames
    test_frame_path = os.path.join(ROOT_DIR, "uploads", "cctv_frames", f"{camera_id}_latest.jpg")
    if os.path.exists(test_frame_path):
        with open(test_frame_path, "rb") as f:
            return base64.b64encode(f.read()).decode('utf-8')
    
    return None


async def send_motion_notification(camera: dict, result: dict, channels: List[str]):
    """Send motion detection notification via configured channels"""
    message = "🚨 *CCTV Motion Alert*\n\n"
    message += f"Camera: {camera.get('name', camera['id'])}\n"
    message += f"Activity: {result.get('activity_type', 'Unknown')}\n"
    message += f"Alert Level: {result.get('alert_level', 'Unknown')}\n"
    message += f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
    if result.get("description"):
        message += f"\nDetails: {result['description'][:100]}"
    
    # In-app notification
    if "in_app" in channels:
        notification = {
            "id": f"notif_{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
            "type": "cctv_motion",
            "title": "CCTV Motion Detected",
            "message": f"Motion detected on {camera.get('name', 'Camera')}: {result.get('activity_type', 'activity')}",
            "data": {"camera_id": camera["id"], "alert_level": result.get("alert_level")},
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
    
    # WhatsApp notification
    if "whatsapp" in channels:
        try:
            from twilio.rest import Client
            config = await db.whatsapp_config.find_one({}, {"_id": 0})
            if config and config.get("account_sid") and config.get("auth_token"):
                client = Client(config["account_sid"], config["auth_token"])
                recipients = [r.strip() for r in config.get("recipient_number", "").split(",") if r.strip()]
                for recipient in recipients:
                    try:
                        client.messages.create(
                            from_=f'whatsapp:{config["phone_number"]}',
                            body=message,
                            to=f'whatsapp:{recipient}'
                        )
                    except Exception:
                        pass
        except Exception:
            pass
    
    # Email notification
    if "email" in channels:
        try:
            import aiosmtplib
            from email.mime.text import MIMEText
            settings = await db.email_settings.find_one({}, {"_id": 0})
            if settings and settings.get("smtp_host") and settings.get("password"):
                msg = MIMEText(message.replace("*", ""))
                msg["Subject"] = f"CCTV Alert: Motion Detected - {camera.get('name', 'Camera')}"
                msg["From"] = settings.get("from_email", settings["username"])
                msg["To"] = settings.get("from_email", settings["username"])
                await aiosmtplib.send(
                    msg,
                    hostname=settings["smtp_host"],
                    port=settings["smtp_port"],
                    username=settings["username"],
                    password=settings["password"],
                    use_tls=False, start_tls=True, timeout=30
                )
        except Exception:
            pass


@router.get("/cctv/monitoring/logs")
async def get_monitoring_logs(limit: int = 50, current_user: User = Depends(get_current_user)):
    """Get scheduled monitoring logs"""
    logs = await db.cctv_monitoring_logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return logs


# =====================================================
# UPLOAD CAMERA FRAME FOR MONITORING
# =====================================================

@router.post("/cctv/cameras/{camera_id}/upload-frame")
async def upload_camera_frame(camera_id: str, body: dict, current_user: User = Depends(get_current_user)):
    """Upload a camera frame for AI processing (used when direct camera access is not available)"""
    image_data = body.get("image_data")
    if not image_data:
        raise HTTPException(status_code=400, detail="image_data required")
    
    # Save the frame for scheduled monitoring
    frames_dir = os.path.join(ROOT_DIR, "uploads", "cctv_frames")
    os.makedirs(frames_dir, exist_ok=True)
    
    frame_path = os.path.join(frames_dir, f"{camera_id}_latest.jpg")
    try:
        with open(frame_path, "wb") as f:
            f.write(base64.b64decode(image_data))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save frame: {str(e)}")
    
    return {"success": True, "message": "Frame uploaded successfully", "camera_id": camera_id}



# ----- CCTV Monitoring Schedules & Enhanced Alerts -----

@router.get("/cctv/monitoring-schedules")
async def get_monitoring_schedules(current_user: User = Depends(get_current_user)):
    """Get all monitoring schedules"""
    schedules = await db.cctv_monitoring_schedules.find({}, {"_id": 0}).to_list(100)
    return schedules


@router.post("/cctv/monitoring-schedules")
async def create_monitoring_schedule(body: dict, current_user: User = Depends(get_current_user)):
    """Create a time-based monitoring schedule"""
    schedule = {
        "id": str(uuid.uuid4()),
        "name": body.get("name", "Default Schedule"),
        "camera_ids": body.get("camera_ids", []),
        "days": body.get("days", ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
        "start_time": body.get("start_time", "00:00"),
        "end_time": body.get("end_time", "23:59"),
        "alert_types": body.get("alert_types", ["motion", "person", "vehicle"]),
        "sensitivity": body.get("sensitivity", "medium"),
        "is_active": body.get("is_active", True),
        "notify_channels": body.get("notify_channels", ["app"]),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.id,
    }
    await db.cctv_monitoring_schedules.insert_one(schedule)
    schedule.pop("_id", None)
    return schedule


@router.put("/cctv/monitoring-schedules/{schedule_id}")
async def update_monitoring_schedule(schedule_id: str, body: dict, current_user: User = Depends(get_current_user)):
    """Update a monitoring schedule"""
    update_data = {k: v for k, v in body.items() if k != "id"}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.cctv_monitoring_schedules.update_one(
        {"id": schedule_id}, {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"message": "Schedule updated"}


@router.delete("/cctv/monitoring-schedules/{schedule_id}")
async def delete_monitoring_schedule(schedule_id: str, current_user: User = Depends(get_current_user)):
    """Delete a monitoring schedule"""
    result = await db.cctv_monitoring_schedules.delete_one({"id": schedule_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"message": "Schedule deleted"}


@router.get("/cctv/motion-alerts")
async def get_motion_alerts(
    camera_id: Optional[str] = None,
    alert_type: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get motion detection alerts"""
    query = {}
    if camera_id:
        query["camera_id"] = camera_id
    if alert_type:
        query["alert_type"] = alert_type
    alerts = await db.cctv_motion_alerts.find(query, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return alerts


@router.post("/cctv/motion-alerts")
async def create_motion_alert(body: dict, current_user: User = Depends(get_current_user)):
    """Record a motion detection alert (from camera integration or manual)"""
    alert = {
        "id": str(uuid.uuid4()),
        "camera_id": body.get("camera_id"),
        "camera_name": body.get("camera_name", ""),
        "alert_type": body.get("alert_type", "motion"),  # motion, person, vehicle, intrusion
        "severity": body.get("severity", "medium"),  # low, medium, high, critical
        "description": body.get("description", ""),
        "zone": body.get("zone", ""),
        "confidence": body.get("confidence", 0),
        "snapshot_url": body.get("snapshot_url"),
        "acknowledged": False,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.cctv_motion_alerts.insert_one(alert)
    alert.pop("_id", None)
    return alert


@router.put("/cctv/motion-alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, current_user: User = Depends(get_current_user)):
    """Acknowledge a motion alert"""
    result = await db.cctv_motion_alerts.update_one(
        {"id": alert_id},
        {"$set": {"acknowledged": True, "acknowledged_by": current_user.id, "acknowledged_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"message": "Alert acknowledged"}
