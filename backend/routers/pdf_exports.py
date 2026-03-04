from fastapi import APIRouter, HTTPException, Response, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
from io import BytesIO
import os
import uuid
import shutil

router = APIRouter(prefix="/pdf-exports", tags=["pdf-exports"])

LOGO_DIR = "/app/uploads/logos"
os.makedirs(LOGO_DIR, exist_ok=True)

def get_db():
    from server import db
    return db

class PDFExportRequest(BaseModel):
    report_type: str  # sales, expenses, supplier_statement, invoice, pnl, aging
    title: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    branch_id: Optional[str] = None
    supplier_id: Optional[str] = None
    customer_id: Optional[str] = None
    include_logo: bool = True
    include_footer: bool = True

class BrandingConfig(BaseModel):
    company_name: str = "SSC Track"
    company_address: Optional[str] = None
    company_phone: Optional[str] = None
    company_email: Optional[str] = None
    company_vat: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: str = "#10B981"
    footer_text: Optional[str] = None

async def get_branding_config(db) -> dict:
    """Get branding configuration from settings"""
    settings = await db.settings.find_one({"type": "branding"})
    if settings:
        return {
            "company_name": settings.get("company_name", "SSC Track"),
            "company_address": settings.get("company_address", ""),
            "company_phone": settings.get("company_phone", ""),
            "company_email": settings.get("company_email", ""),
            "company_vat": settings.get("company_vat", ""),
            "logo_url": settings.get("logo_url", ""),
            "primary_color": settings.get("primary_color", "#10B981"),
            "footer_text": settings.get("footer_text", "Thank you for your business!"),
        }
    return {
        "company_name": "SSC Track",
        "company_address": "",
        "company_phone": "",
        "company_email": "",
        "company_vat": "",
        "logo_url": "",
        "primary_color": "#10B981",
        "footer_text": "Thank you for your business!",
    }

def hex_to_rgb(hex_color: str) -> tuple:
    """Convert hex color to RGB tuple"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def create_pdf_header(canvas, doc, branding: dict, title: str):
    """Create branded PDF header with optional logo"""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.colors import HexColor
    from reportlab.lib.utils import ImageReader
    
    width, height = A4
    primary_color = HexColor(branding.get("primary_color", "#10B981"))
    
    # Header background
    canvas.setFillColor(primary_color)
    canvas.rect(0, height - 80, width, 80, fill=True, stroke=False)
    
    # Logo (if available)
    logo_x_offset = 40
    logo_url = branding.get("logo_url", "")
    if logo_url:
        logo_path = f"/app{logo_url}" if logo_url.startswith("/uploads") else logo_url
        if os.path.exists(logo_path):
            try:
                img = ImageReader(logo_path)
                canvas.drawImage(img, 40, height - 72, width=55, height=55, preserveAspectRatio=True, mask='auto')
                logo_x_offset = 105
            except Exception:
                pass
    
    # Company name
    canvas.setFillColor(HexColor("#FFFFFF"))
    canvas.setFont("Helvetica-Bold", 22)
    canvas.drawString(logo_x_offset, height - 45, branding.get("company_name", "SSC Track"))
    
    # Report title
    canvas.setFont("Helvetica", 11)
    canvas.drawString(logo_x_offset, height - 63, title)
    
    # Date on right side
    canvas.setFont("Helvetica", 10)
    canvas.drawRightString(width - 40, height - 45, f"Generated: {datetime.now().strftime('%d %b %Y, %H:%M')}")
    
    # Company details below header
    canvas.setFillColor(HexColor("#374151"))
    y = height - 100
    if branding.get("company_address"):
        canvas.setFont("Helvetica", 9)
        canvas.drawString(40, y, branding["company_address"])
        y -= 12
    
    contact_parts = []
    if branding.get("company_phone"):
        contact_parts.append(f"Tel: {branding['company_phone']}")
    if branding.get("company_email"):
        contact_parts.append(f"Email: {branding['company_email']}")
    if branding.get("company_vat"):
        contact_parts.append(f"VAT: {branding['company_vat']}")
    
    if contact_parts:
        canvas.setFont("Helvetica", 8)
        canvas.drawString(40, y, " | ".join(contact_parts))

def create_pdf_footer(canvas, doc, branding: dict, page_num: int):
    """Create branded PDF footer"""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.colors import HexColor
    
    width, height = A4
    primary_color = HexColor(branding.get("primary_color", "#10B981"))
    
    # Footer line
    canvas.setStrokeColor(primary_color)
    canvas.setLineWidth(2)
    canvas.line(40, 40, width - 40, 40)
    
    # Footer text
    canvas.setFillColor(HexColor("#6B7280"))
    canvas.setFont("Helvetica", 8)
    footer_text = branding.get("footer_text", "Thank you for your business!")
    canvas.drawString(40, 25, footer_text)
    
    # Page number
    canvas.drawRightString(width - 40, 25, f"Page {page_num}")

@router.get("/branding")
async def get_branding():
    """Get current branding configuration"""
    db = get_db()
    return await get_branding_config(db)

@router.post("/branding")
async def update_branding(config: BrandingConfig):
    """Update branding configuration"""
    db = get_db()
    
    await db.settings.update_one(
        {"type": "branding"},
        {"$set": {
            "type": "branding",
            **config.dict(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True
    )
    
    return {"message": "Branding updated", **config.dict()}

@router.post("/upload-logo")
async def upload_logo(file: UploadFile = File(...)):
    """Upload company logo for PDF branding"""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "png"
    filename = f"logo_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(LOGO_DIR, filename)
    
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    logo_url = f"/uploads/logos/{filename}"
    
    db = get_db()
    await db.settings.update_one(
        {"type": "branding"},
        {"$set": {"logo_url": logo_url, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {"logo_url": logo_url, "message": "Logo uploaded successfully"}

@router.post("/generate")
async def generate_branded_pdf(request: PDFExportRequest):
    """Generate a branded PDF report"""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.colors import HexColor
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    
    db = get_db()
    branding = await get_branding_config(db)
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=120, bottomMargin=60)
    
    styles = getSampleStyleSheet()
    primary_color = HexColor(branding.get("primary_color", "#10B981"))
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=primary_color,
        spaceAfter=20,
    )
    
    elements = []
    title = request.title or f"{request.report_type.replace('_', ' ').title()} Report"
    
    # Build query based on date range
    query = {}
    if request.start_date:
        query["date"] = {"$gte": request.start_date}
    if request.end_date:
        if "date" in query:
            query["date"]["$lte"] = request.end_date
        else:
            query["date"] = {"$lte": request.end_date}
    if request.branch_id:
        query["branch_id"] = request.branch_id
    
    data = []
    headers = []
    
    if request.report_type == "sales":
        headers = ["Date", "Description", "Customer", "Amount", "Payment"]
        sales = await db.sales.find(query).sort("date", -1).to_list(500)
        
        for s in sales:
            data.append([
                s.get("date", "")[:10] if s.get("date") else "",
                (s.get("description") or "Sale")[:30],
                (s.get("customer_name") or "-")[:20],
                f"SAR {s.get('amount', 0):,.2f}",
                s.get("payment_mode", "-"),
            ])
        
    elif request.report_type == "expenses":
        headers = ["Date", "Category", "Description", "Amount", "Payment"]
        expenses = await db.expenses.find(query).sort("date", -1).to_list(500)
        
        for e in expenses:
            data.append([
                e.get("date", "")[:10] if e.get("date") else "",
                (e.get("category") or "-")[:15],
                (e.get("description") or "-")[:25],
                f"SAR {e.get('amount', 0):,.2f}",
                e.get("payment_mode", "-"),
            ])
    
    elif request.report_type == "supplier_statement":
        if not request.supplier_id:
            raise HTTPException(status_code=400, detail="supplier_id required for supplier statement")
        
        headers = ["Date", "Description", "Debit", "Credit", "Balance"]
        
        # Get supplier info
        supplier = await db.suppliers.find_one({"$or": [
            {"_id": ObjectId(request.supplier_id)},
            {"id": request.supplier_id}
        ]})
        if supplier:
            title = f"Statement for {supplier.get('name', 'Supplier')}"
        
        # Get transactions
        sup_query = {"supplier_id": request.supplier_id}
        if request.start_date:
            sup_query["date"] = {"$gte": request.start_date}
        if request.end_date:
            if "date" in sup_query:
                sup_query["date"]["$lte"] = request.end_date
            else:
                sup_query["date"] = {"$lte": request.end_date}
        
        # Get expenses (bills)
        expenses = await db.expenses.find({**sup_query}).sort("date", 1).to_list(1000)
        # Get payments
        payments = await db.supplier_payments.find({**sup_query}).sort("date", 1).to_list(1000)
        
        transactions = []
        for e in expenses:
            transactions.append({
                "date": e.get("date", ""),
                "description": f"Bill: {e.get('description', '')}",
                "debit": e.get("amount", 0),
                "credit": 0,
            })
        for p in payments:
            transactions.append({
                "date": p.get("date", ""),
                "description": f"Payment ({p.get('payment_mode', '')})",
                "debit": 0,
                "credit": p.get("amount", 0),
            })
        
        transactions.sort(key=lambda x: x["date"])
        
        balance = 0
        for t in transactions:
            balance += t["debit"] - t["credit"]
            data.append([
                t["date"][:10] if t["date"] else "",
                t["description"][:30],
                f"SAR {t['debit']:,.2f}" if t["debit"] else "-",
                f"SAR {t['credit']:,.2f}" if t["credit"] else "-",
                f"SAR {balance:,.2f}",
            ])
    
    elif request.report_type == "pnl":
        headers = ["Category", "Amount"]
        
        # Get totals
        sales_total = 0
        expenses_total = 0
        
        sales = await db.sales.find(query).to_list(10000)
        for s in sales:
            sales_total += s.get("amount", 0)
        
        expenses = await db.expenses.find(query).to_list(10000)
        for e in expenses:
            expenses_total += e.get("amount", 0)
        
        data = [
            ["Total Revenue", f"SAR {sales_total:,.2f}"],
            ["Total Expenses", f"SAR {expenses_total:,.2f}"],
            ["Net Profit/Loss", f"SAR {sales_total - expenses_total:,.2f}"],
            ["Profit Margin", f"{((sales_total - expenses_total) / sales_total * 100) if sales_total > 0 else 0:.1f}%"],
        ]
    
    # Add title
    elements.append(Paragraph(title, title_style))
    
    # Add date range if specified
    if request.start_date or request.end_date:
        date_text = f"Period: {request.start_date or 'Start'} to {request.end_date or 'Present'}"
        elements.append(Paragraph(date_text, styles['Normal']))
        elements.append(Spacer(1, 10))
    
    # Create table
    if headers and data:
        table_data = [headers] + data
        
        col_widths = [1.2*inch] * len(headers)  # Default width
        if len(headers) == 5:
            col_widths = [0.9*inch, 1.5*inch, 1.2*inch, 1.0*inch, 0.8*inch]
        
        table = Table(table_data, colWidths=col_widths)
        
        table_style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), primary_color),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (-2, 1), (-1, -1), 'RIGHT'),  # Right align amounts
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('TOPPADDING', (0, 0), (-1, 0), 8),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
            ('TOPPADDING', (0, 1), (-1, -1), 5),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, HexColor("#F9FAFB")]),
        ])
        table.setStyle(table_style)
        elements.append(table)
    else:
        elements.append(Paragraph("No data found for the selected criteria.", styles['Normal']))
    
    # Build PDF with custom header/footer
    def add_page_elements(canvas, doc):
        create_pdf_header(canvas, doc, branding, title)
        if request.include_footer:
            create_pdf_footer(canvas, doc, branding, doc.page)
    
    doc.build(elements, onFirstPage=add_page_elements, onLaterPages=add_page_elements)
    
    buffer.seek(0)
    
    filename = f"{request.report_type}_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
