"""
Barcode generation module for stock items with company logo.
Supports Code128 barcodes for inventory management.
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import Optional, List
from datetime import datetime, timezone
from io import BytesIO
import uuid

from database import db, get_current_user, ROOT_DIR, get_tenant_filter, stamp_tenant
from models import User

import barcode
from barcode.writer import ImageWriter
from PIL import Image, ImageDraw, ImageFont

router = APIRouter()


def generate_barcode_with_logo(
    item_code: str,
    item_name: str,
    price: float = 0,
    company_name: str = "SSC Track",
    logo_path: Optional[str] = None
) -> BytesIO:
    """
    Generate a barcode image with company logo and item details.
    
    Args:
        item_code: Unique code for the item (used in barcode)
        item_name: Name of the item to display
        price: Price to display on label
        company_name: Company name for branding
        logo_path: Path to company logo image
    
    Returns:
        BytesIO buffer containing the barcode label image
    """
    # Generate Code128 barcode
    code128 = barcode.get_barcode_class('code128')
    barcode_instance = code128(item_code, writer=ImageWriter())
    
    # Create barcode image in memory
    barcode_buffer = BytesIO()
    barcode_instance.write(barcode_buffer, {
        'module_width': 0.3,
        'module_height': 12,
        'font_size': 8,
        'text_distance': 3,
        'quiet_zone': 2
    })
    barcode_buffer.seek(0)
    barcode_img = Image.open(barcode_buffer)
    
    # Create label canvas (white background)
    label_width = 400
    label_height = 200
    label = Image.new('RGB', (label_width, label_height), 'white')
    draw = ImageDraw.Draw(label)
    
    # Try to load fonts (fallback to default if not available)
    try:
        font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
        font_medium = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 10)
    except:
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    y_offset = 5
    
    # Add company logo if available
    if logo_path:
        try:
            logo = Image.open(logo_path)
            # Resize logo to fit (max 60x40)
            logo.thumbnail((60, 40), Image.Resampling.LANCZOS)
            # Convert to RGB if necessary
            if logo.mode in ('RGBA', 'P'):
                logo = logo.convert('RGB')
            # Position logo at top-left
            label.paste(logo, (10, y_offset))
            logo_width = logo.size[0]
        except Exception as e:
            print(f"Could not load logo: {e}")
            logo_width = 0
    else:
        logo_width = 0
    
    # Add company name next to logo
    company_x = logo_width + 20 if logo_width > 0 else 10
    draw.text((company_x, y_offset + 10), company_name, font=font_large, fill='#F5841F')
    
    y_offset = 50
    
    # Add item name (truncate if too long)
    display_name = item_name[:35] + "..." if len(item_name) > 35 else item_name
    draw.text((10, y_offset), display_name, font=font_medium, fill='black')
    
    y_offset += 20
    
    # Add price
    if price > 0:
        price_text = f"SAR {price:.2f}"
        draw.text((10, y_offset), price_text, font=font_large, fill='#22C55E')
    
    y_offset += 25
    
    # Resize barcode to fit
    barcode_width = min(barcode_img.size[0], label_width - 20)
    barcode_height = int(barcode_img.size[1] * (barcode_width / barcode_img.size[0]))
    barcode_img = barcode_img.resize((barcode_width, barcode_height), Image.Resampling.LANCZOS)
    
    # Center barcode horizontally
    barcode_x = (label_width - barcode_width) // 2
    
    # Paste barcode
    if barcode_img.mode == 'RGBA':
        label.paste(barcode_img, (barcode_x, y_offset), barcode_img)
    else:
        label.paste(barcode_img, (barcode_x, y_offset))
    
    # Save to buffer
    output_buffer = BytesIO()
    label.save(output_buffer, format='PNG', quality=95)
    output_buffer.seek(0)
    
    return output_buffer


@router.get("/barcode/item/{item_id}")
async def get_item_barcode(item_id: str, current_user: User = Depends(get_current_user)):
    """
    Generate a barcode label for a specific item.
    Returns a PNG image with company logo, item name, price, and barcode.
    """
    # Get item details
    item = await db.items.find_one({"id": item_id, **get_tenant_filter(current_user)}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Get company settings for name and logo
    company = await db.company_settings.find_one(get_tenant_filter(current_user), {"_id": 0}) or {}
    company_name = company.get("company_name", "SSC Track")
    
    # Check for company logo
    logo_path = None
    for ext in ['jpg', 'jpeg', 'png']:
        potential_path = ROOT_DIR / "uploads" / "logos" / f"company_logo.{ext}"
        if potential_path.exists():
            logo_path = str(potential_path)
            break
    
    # Generate barcode using item ID as code
    barcode_buffer = generate_barcode_with_logo(
        item_code=item_id[:12].upper(),  # Use first 12 chars of ID
        item_name=item.get("name", "Unknown"),
        price=item.get("unit_price", 0),
        company_name=company_name,
        logo_path=logo_path
    )
    
    filename = f"barcode_{item.get('name', 'item').replace(' ', '_')}.png"
    
    return StreamingResponse(
        barcode_buffer,
        media_type="image/png",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/barcode/item/{item_id}/preview")
async def preview_item_barcode(item_id: str, current_user: User = Depends(get_current_user)):
    """
    Preview barcode label (inline display instead of download).
    """
    item = await db.items.find_one({"id": item_id, **get_tenant_filter(current_user)}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    company = await db.company_settings.find_one(get_tenant_filter(current_user), {"_id": 0}) or {}
    company_name = company.get("company_name", "SSC Track")
    
    logo_path = None
    for ext in ['jpg', 'jpeg', 'png']:
        potential_path = ROOT_DIR / "uploads" / "logos" / f"company_logo.{ext}"
        if potential_path.exists():
            logo_path = str(potential_path)
            break
    
    barcode_buffer = generate_barcode_with_logo(
        item_code=item_id[:12].upper(),
        item_name=item.get("name", "Unknown"),
        price=item.get("unit_price", 0),
        company_name=company_name,
        logo_path=logo_path
    )
    
    return StreamingResponse(
        barcode_buffer,
        media_type="image/png"
    )


@router.post("/barcode/batch")
async def generate_batch_barcodes(body: dict, current_user: User = Depends(get_current_user)):
    """
    Generate barcodes for multiple items and return as a single PDF.
    
    Body:
        item_ids: List of item IDs to generate barcodes for
        labels_per_item: Number of labels per item (default: 1)
    """
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas
    
    item_ids = body.get("item_ids", [])
    labels_per_item = body.get("labels_per_item", 1)
    
    if not item_ids:
        raise HTTPException(status_code=400, detail="No items specified")
    
    # Get items
    items = await db.items.find({"id": {"$in": item_ids}}, {"_id": 0}).to_list(100)
    if not items:
        raise HTTPException(status_code=404, detail="No items found")
    
    # Get company settings
    company = await db.company_settings.find_one(get_tenant_filter(current_user), {"_id": 0}) or {}
    company_name = company.get("company_name", "SSC Track")
    
    logo_path = None
    for ext in ['jpg', 'jpeg', 'png']:
        potential_path = ROOT_DIR / "uploads" / "logos" / f"company_logo.{ext}"
        if potential_path.exists():
            logo_path = str(potential_path)
            break
    
    # Create PDF buffer
    pdf_buffer = BytesIO()
    c = canvas.Canvas(pdf_buffer, pagesize=A4)
    page_width, page_height = A4
    
    # Label dimensions (2 columns, 5 rows per page = 10 labels per page)
    label_width = 90 * mm
    label_height = 55 * mm
    margin_x = 15 * mm
    margin_y = 10 * mm
    cols = 2
    rows = 5
    
    labels_on_page = 0
    
    for item in items:
        for _ in range(labels_per_item):
            # Calculate position
            col = labels_on_page % cols
            row = (labels_on_page // cols) % rows
            
            x = margin_x + col * label_width
            y = page_height - margin_y - (row + 1) * label_height
            
            # Generate barcode image
            barcode_img = generate_barcode_with_logo(
                item_code=item["id"][:12].upper(),
                item_name=item.get("name", "Unknown"),
                price=item.get("unit_price", 0),
                company_name=company_name,
                logo_path=logo_path
            )
            
            # Save temporarily and draw on PDF
            from reportlab.lib.utils import ImageReader
            barcode_img.seek(0)
            img = ImageReader(barcode_img)
            c.drawImage(img, x, y, width=label_width - 5*mm, height=label_height - 5*mm)
            
            # Draw border
            c.rect(x, y, label_width - 5*mm, label_height - 5*mm)
            
            labels_on_page += 1
            
            # New page if needed
            if labels_on_page >= cols * rows:
                c.showPage()
                labels_on_page = 0
    
    c.save()
    pdf_buffer.seek(0)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=barcodes_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"}
    )


@router.get("/barcode/items")
async def list_items_for_barcode(current_user: User = Depends(get_current_user)):
    """
    List all items available for barcode generation.
    """
    items = await db.items.find({"active": {"$ne": False}}, {"_id": 0}).to_list(1000)
    return [
        {
            "id": item["id"],
            "name": item.get("name", ""),
            "category": item.get("category", ""),
            "unit_price": item.get("unit_price", 0),
            "cost_price": item.get("cost_price", 0),
            "unit": item.get("unit", "piece")
        }
        for item in items
    ]
