from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import FileResponse
from typing import Optional
from datetime import datetime, timezone
from pathlib import Path
import os

from database import db, get_current_user, ROOT_DIR, require_permission
from models import User, Document, DocumentCreate

router = APIRouter()

@router.get("/documents")
async def get_documents(current_user: User = Depends(get_current_user)):
    docs = await db.documents.find({}, {"_id": 0}).to_list(1000)
    now = datetime.now(timezone.utc)
    for d in docs:
        for f in ['created_at', 'issue_date', 'expiry_date']:
            if isinstance(d.get(f), str): d[f] = datetime.fromisoformat(d[f])
        if d.get('expiry_date'):
            exp = d['expiry_date'] if isinstance(d['expiry_date'], datetime) else datetime.fromisoformat(str(d['expiry_date']))
            if exp.tzinfo is None: exp = exp.replace(tzinfo=timezone.utc)
            days_left = (exp - now).days
            d['days_until_expiry'] = days_left
            if days_left < 0: d['status'] = 'expired'
            elif days_left <= d.get('alert_days', 30): d['status'] = 'expiring_soon'
            else: d['status'] = 'active'
    return docs

@router.post("/documents")
async def create_document(data: DocumentCreate, current_user: User = Depends(get_current_user)):
    doc = Document(**data.model_dump())
    doc_dict = doc.model_dump()
    for f in ['created_at', 'issue_date', 'expiry_date']:
        if doc_dict.get(f): doc_dict[f] = doc_dict[f].isoformat()
    await db.documents.insert_one(doc_dict)
    return {k: v for k, v in doc_dict.items() if k != '_id'}

@router.put("/documents/{doc_id}")
async def update_document(doc_id: str, data: DocumentCreate, current_user: User = Depends(get_current_user)):
    result = await db.documents.find_one({"id": doc_id})
    if not result: raise HTTPException(status_code=404, detail="Document not found")
    update = data.model_dump()
    for f in ['issue_date', 'expiry_date']:
        if update.get(f): update[f] = update[f].isoformat()
    await db.documents.update_one({"id": doc_id}, {"$set": update})
    return await db.documents.find_one({"id": doc_id}, {"_id": 0})

@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, current_user: User = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc: raise HTTPException(status_code=404, detail="Document not found")
    if doc.get("file_path") and os.path.exists(doc["file_path"]): os.remove(doc["file_path"])
    await db.documents.delete_one({"id": doc_id})
    return {"message": "Document deleted"}

@router.post("/documents/{doc_id}/upload")
async def upload_document_file(doc_id: str, file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc: raise HTTPException(status_code=404, detail="Document not found")
    upload_dir = ROOT_DIR / "uploads" / "documents"
    upload_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename).suffix
    file_path = upload_dir / f"{doc_id}{ext}"
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    await db.documents.update_one({"id": doc_id}, {"$set": {"file_path": str(file_path), "file_name": file.filename}})
    return {"message": "File uploaded", "file_name": file.filename}

@router.get("/documents/{doc_id}/download")
async def download_document_file(doc_id: str, current_user: User = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc or not doc.get("file_path"): raise HTTPException(status_code=404, detail="No file attached")
    if not os.path.exists(doc["file_path"]): raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(doc["file_path"], filename=doc.get("file_name", "document"))

@router.get("/documents/alerts/upcoming")
async def get_expiry_alerts(current_user: User = Depends(get_current_user)):
    docs = await db.documents.find({}, {"_id": 0}).to_list(1000)
    employees = await db.employees.find({}, {"_id": 0}).to_list(1000)
    now = datetime.now(timezone.utc)
    alerts = []
    for d in docs:
        exp = d.get('expiry_date')
        if not exp: continue
        if isinstance(exp, str): exp = datetime.fromisoformat(exp)
        if exp.tzinfo is None: exp = exp.replace(tzinfo=timezone.utc)
        days_left = (exp - now).days
        alert_days = d.get('alert_days', 30)
        if days_left <= alert_days:
            alerts.append({"type": "document", "name": d["name"], "related_to": d.get("related_to", "-"), "expiry_date": exp.isoformat(), "days_left": days_left, "status": "expired" if days_left < 0 else "expiring_soon", "id": d["id"]})
    for emp in employees:
        exp = emp.get('document_expiry')
        if not exp: continue
        if isinstance(exp, str): exp = datetime.fromisoformat(exp)
        if exp.tzinfo is None: exp = exp.replace(tzinfo=timezone.utc)
        days_left = (exp - now).days
        if days_left <= 30:
            alerts.append({"type": "employee_document", "name": f"{emp['name']} - ID Document", "related_to": emp["name"], "expiry_date": exp.isoformat(), "days_left": days_left, "status": "expired" if days_left < 0 else "expiring_soon", "id": emp["id"]})
    alerts.sort(key=lambda x: x["days_left"])
    return alerts
