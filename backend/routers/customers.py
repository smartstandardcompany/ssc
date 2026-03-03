from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import List
from datetime import datetime, timezone
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
from reportlab.lib.units import inch

from database import db, get_current_user, ROOT_DIR, require_permission, get_branch_filter_with_global
from models import User, Customer, CustomerCreate

router = APIRouter()

@router.get("/customers", response_model=List[Customer])
async def get_customers(current_user: User = Depends(get_current_user)):
    require_permission(current_user, "customers", "read")
    # Use centralized filter that includes branch-specific AND global (no branch) customers
    query = get_branch_filter_with_global(current_user)
    customers = await db.customers.find(query, {"_id": 0}).to_list(1000)
    for customer in customers:
        if isinstance(customer.get('created_at'), str):
            customer['created_at'] = datetime.fromisoformat(customer['created_at'])
    return customers

@router.post("/customers", response_model=Customer)
async def create_customer(customer_data: CustomerCreate, current_user: User = Depends(get_current_user)):
    require_permission(current_user, "customers", "write")
    customer = Customer(**customer_data.model_dump())
    customer_dict = customer.model_dump()
    customer_dict["created_at"] = customer_dict["created_at"].isoformat()
    await db.customers.insert_one(customer_dict)
    return customer

@router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(customer_id: str, customer_data: CustomerCreate, current_user: User = Depends(get_current_user)):
    require_permission(current_user, "customers", "write")
    result = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Customer not found")
    update_data = customer_data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.customers.update_one({"id": customer_id}, {"$set": update_data})
    updated = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return Customer(**updated)

@router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, current_user: User = Depends(get_current_user)):
    require_permission(current_user, "customers", "write")
    result = await db.customers.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer deleted successfully"}

@router.get("/customers/{customer_id}/balance")
async def get_customer_balance(customer_id: str, current_user: User = Depends(get_current_user)):
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    sales = await db.sales.find({"customer_id": customer_id}, {"_id": 0}).to_list(10000)
    total_sales = 0; total_cash = 0; total_bank = 0; total_credit_given = 0; total_credit_received = 0
    for sale in sales:
        total_sales += sale.get("final_amount", sale.get("amount", 0) - sale.get("discount", 0))
        for p in sale.get("payment_details", []):
            if p.get("mode") == "cash": total_cash += p["amount"]
            elif p.get("mode") == "bank": total_bank += p["amount"]
        total_credit_given += sale.get("credit_amount", 0)
        total_credit_received += sale.get("credit_received", 0)
    return {"customer_id": customer_id, "customer_name": customer["name"], "total_sales": total_sales, "total_cash": total_cash, "total_bank": total_bank, "total_credit_given": total_credit_given, "total_credit_received": total_credit_received, "credit_balance": total_credit_given - total_credit_received, "sales_count": len(sales)}

@router.get("/customers/{customer_id}/report")
async def get_customer_report(customer_id: str, current_user: User = Depends(get_current_user)):
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    sales = await db.sales.find({"customer_id": customer_id}, {"_id": 0}).sort("date", -1).to_list(10000)
    invoices_list = await db.invoices.find({"customer_id": customer_id}, {"_id": 0}).to_list(10000)
    inv_by_sale = {inv.get("sale_id"): inv for inv in invoices_list if inv.get("sale_id")}
    branches = {b["id"]: b["name"] for b in await db.branches.find({}, {"_id": 0}).to_list(100)}
    purchases = []
    for s in sales:
        payments_detail = [{"mode": p.get("mode",""), "amount": p.get("amount", 0)} for p in s.get("payment_details", [])]
        credit_given = s.get("credit_amount", 0); credit_received = s.get("credit_received", 0)
        inv = inv_by_sale.get(s["id"]); items = inv.get("items", []) if inv else []; inv_number = inv.get("invoice_number", "") if inv else ""
        purchases.append({"date": s["date"], "type": "Sale", "branch": branches.get(s.get("branch_id"), "-"), "amount": s.get("final_amount", s["amount"]), "discount": s.get("discount", 0), "payments": payments_detail, "payment": ", ".join(f'{p["mode"]}' for p in payments_detail), "credit_given": credit_given, "credit_received": credit_received, "credit": credit_given - credit_received, "invoice_number": inv_number, "items": items})
    total = sum(p["amount"] for p in purchases); total_disc = sum(p["discount"] for p in purchases); total_credit = sum(p["credit"] for p in purchases if p["credit"] > 0)
    return {"customer": customer, "purchases": purchases, "total": total, "total_discount": total_disc, "credit_balance": total_credit, "count": len(purchases)}

@router.get("/customers/{customer_id}/report/pdf")
async def export_customer_report_pdf(customer_id: str, current_user: User = Depends(get_current_user)):
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    sales = await db.sales.find({"customer_id": customer_id}, {"_id": 0}).sort("date", -1).to_list(10000)
    branches = {b["id"]: b["name"] for b in await db.branches.find({}, {"_id": 0}).to_list(100)}
    company = await db.company_settings.find_one({}, {"_id": 0}) or {}
    co_name = company.get("company_name", "Smart Standard Company")
    co_addr = ", ".join([p for p in [company.get("address_line1",""), company.get("city",""), company.get("country","")] if p])
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=40, bottomMargin=40)
    elements = []; styles = getSampleStyleSheet()
    title_s = ParagraphStyle('T', parent=styles['Heading1'], fontSize=16, textColor=colors.HexColor('#F5841F'), alignment=1, spaceAfter=3)
    logo_path = ROOT_DIR / "uploads" / "logos" / "company_logo.jpg"
    if not logo_path.exists(): logo_path = ROOT_DIR / "uploads" / "logos" / "company_logo.png"
    if logo_path.exists():
        from reportlab.platypus import Image as RLImage
        try:
            logo = RLImage(str(logo_path), width=1.5*inch, height=0.7*inch); logo.hAlign = 'CENTER'; elements.append(logo)
        except: pass
    elements.append(Paragraph(co_name.upper(), title_s))
    if co_addr:
        elements.append(Paragraph(co_addr, ParagraphStyle('A', parent=styles['Normal'], fontSize=8, textColor=colors.grey, alignment=1)))
    elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#F5841F')))
    elements.append(Spacer(1, 0.2*inch))
    elements.append(Paragraph(f"<b>Customer Statement - {customer['name']}</b>", ParagraphStyle('H', parent=styles['Heading2'], fontSize=13, alignment=1)))
    elements.append(Paragraph(f"Phone: {customer.get('phone', '-')} | Date: {datetime.now().strftime('%d %b %Y')}", ParagraphStyle('S', parent=styles['Normal'], fontSize=9, textColor=colors.grey, alignment=1)))
    elements.append(Spacer(1, 0.15*inch))
    rows = [["Date", "Branch", "Amount", "Discount", "Payment", "Credit Due"]]
    total_amt = 0; total_disc = 0; total_credit = 0
    for s in sales:
        dt = datetime.fromisoformat(s["date"]).strftime("%d %b %Y") if isinstance(s["date"], str) else s["date"].strftime("%d %b %Y")
        amt = s.get("final_amount", s["amount"]); disc = s.get("discount", 0)
        modes = ", ".join(p["mode"] for p in s.get("payment_details", []))
        credit = s.get("credit_amount", 0) - s.get("credit_received", 0)
        rows.append([dt, branches.get(s.get("branch_id"), "-"), f"SAR {amt:.2f}", f"SAR {disc:.2f}" if disc > 0 else "-", modes, f"SAR {credit:.2f}" if credit > 0 else "-"])
        total_amt += amt; total_disc += disc
        if credit > 0: total_credit += credit
    rows.append(["", "", "", "", "", ""]); rows.append(["TOTAL", "", f"SAR {total_amt:.2f}", f"SAR {total_disc:.2f}", "", f"SAR {total_credit:.2f}"])
    t = Table(rows, colWidths=[1*inch, 1*inch, 1.1*inch, 0.9*inch, 1*inch, 1*inch])
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F5841F')), ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke), ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'), ('FONTSIZE', (0, 0), (-1, -1), 8), ('GRID', (0, 0), (-1, -1), 0.5, colors.grey), ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'), ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#FFF3E0')), ('ALIGN', (2, 0), (-1, -1), 'RIGHT')]))
    elements.append(t)
    doc.build(elements); buffer.seek(0)
    fname = f"statement_{customer['name'].replace(' ','_')}.pdf"
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={fname}"})

@router.get("/customers-balance")
async def get_all_customers_balance(current_user: User = Depends(get_current_user)):
    customers = await db.customers.find({}, {"_id": 0}).to_list(1000)
    sales = await db.sales.find({}, {"_id": 0}).to_list(10000)
    result = []
    for customer in customers:
        cid = customer["id"]
        cust_sales = [s for s in sales if s.get("customer_id") == cid]
        total_sales = sum(s.get("final_amount", s.get("amount", 0)) for s in cust_sales)
        total_cash = sum(p["amount"] for s in cust_sales for p in s.get("payment_details", []) if p.get("mode") == "cash")
        total_bank = sum(p["amount"] for s in cust_sales for p in s.get("payment_details", []) if p.get("mode") == "bank")
        total_credit = sum(s.get("credit_amount", 0) for s in cust_sales)
        total_received = sum(s.get("credit_received", 0) for s in cust_sales)
        result.append({"id": cid, "name": customer["name"], "phone": customer.get("phone", ""), "branch_id": customer.get("branch_id"), "total_sales": total_sales, "cash": total_cash, "bank": total_bank, "credit_given": total_credit, "credit_received": total_received, "credit_balance": total_credit - total_received, "sales_count": len(cust_sales)})
    return result


# ===========================
# CUSTOMER LOYALTY PROGRAM
# ===========================

@router.get("/loyalty/settings")
async def get_loyalty_settings(current_user: User = Depends(get_current_user)):
    """Get loyalty program settings."""
    settings = await db.loyalty_settings.find_one({}, {"_id": 0})
    if not settings:
        # Default settings
        settings = {
            "id": "default",
            "enabled": False,
            "points_per_sar": 1,  # 1 point per 1 SAR spent
            "sar_per_point": 0.1,  # Each point worth 0.1 SAR
            "min_redeem_points": 100,
            "max_redeem_per_transaction": 50,  # Max % of bill payable with points
            "welcome_bonus": 0,
            "birthday_bonus": 0,
            "tier_levels": [
                {"name": "Bronze", "min_points": 0, "multiplier": 1.0},
                {"name": "Silver", "min_points": 500, "multiplier": 1.25},
                {"name": "Gold", "min_points": 1000, "multiplier": 1.5},
                {"name": "Platinum", "min_points": 2500, "multiplier": 2.0}
            ]
        }
    return settings


@router.post("/loyalty/settings")
async def update_loyalty_settings(settings: dict, current_user: User = Depends(get_current_user)):
    """Update loyalty program settings. Admin only."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings["id"] = "default"
    settings["updated_at"] = datetime.now(timezone.utc).isoformat()
    settings["updated_by"] = current_user.id
    
    await db.loyalty_settings.update_one(
        {"id": "default"},
        {"$set": settings},
        upsert=True
    )
    return {"message": "Loyalty settings updated", "settings": settings}


@router.get("/customers/{customer_id}/loyalty")
async def get_customer_loyalty(customer_id: str, current_user: User = Depends(get_current_user)):
    """Get customer's loyalty points and history."""
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Get loyalty settings
    settings = await db.loyalty_settings.find_one({}, {"_id": 0}) or {
        "points_per_sar": 1, "sar_per_point": 0.1, "tier_levels": [
            {"name": "Bronze", "min_points": 0, "multiplier": 1.0},
            {"name": "Silver", "min_points": 500, "multiplier": 1.25},
            {"name": "Gold", "min_points": 1000, "multiplier": 1.5},
            {"name": "Platinum", "min_points": 2500, "multiplier": 2.0}
        ]
    }
    
    # Get customer's points transactions
    transactions = await db.loyalty_transactions.find(
        {"customer_id": customer_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    # Calculate current balance
    points_earned = sum(t.get("points", 0) for t in transactions if t.get("type") == "earn")
    points_redeemed = sum(abs(t.get("points", 0)) for t in transactions if t.get("type") == "redeem")
    points_balance = points_earned - points_redeemed
    
    # Determine tier
    current_tier = settings["tier_levels"][0]
    for tier in settings["tier_levels"]:
        if points_earned >= tier["min_points"]:
            current_tier = tier
    
    # Points to next tier
    next_tier = None
    for i, tier in enumerate(settings["tier_levels"]):
        if tier["name"] == current_tier["name"] and i < len(settings["tier_levels"]) - 1:
            next_tier = settings["tier_levels"][i + 1]
            break
    
    points_to_next_tier = next_tier["min_points"] - points_earned if next_tier else 0
    
    return {
        "customer_id": customer_id,
        "customer_name": customer["name"],
        "points_balance": points_balance,
        "points_earned_total": points_earned,
        "points_redeemed_total": points_redeemed,
        "current_tier": current_tier,
        "next_tier": next_tier,
        "points_to_next_tier": max(0, points_to_next_tier),
        "points_value_sar": round(points_balance * settings["sar_per_point"], 2),
        "recent_transactions": transactions[:10]
    }


@router.post("/customers/{customer_id}/loyalty/earn")
async def earn_loyalty_points(customer_id: str, body: dict, current_user: User = Depends(get_current_user)):
    """Add loyalty points for a purchase."""
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    settings = await db.loyalty_settings.find_one({}, {"_id": 0}) or {"points_per_sar": 1, "enabled": False}
    
    if not settings.get("enabled", False):
        return {"message": "Loyalty program is not enabled", "points_earned": 0}
    
    purchase_amount = float(body.get("amount", 0))
    sale_id = body.get("sale_id")
    notes = body.get("notes", "")
    
    # Calculate points (with tier multiplier)
    base_points = int(purchase_amount * settings["points_per_sar"])
    
    # Get customer's current tier for multiplier
    transactions = await db.loyalty_transactions.find({"customer_id": customer_id}, {"_id": 0}).to_list(10000)
    points_earned_total = sum(t.get("points", 0) for t in transactions if t.get("type") == "earn")
    
    tier_levels = settings.get("tier_levels", [{"multiplier": 1.0}])
    multiplier = 1.0
    for tier in tier_levels:
        if points_earned_total >= tier.get("min_points", 0):
            multiplier = tier.get("multiplier", 1.0)
    
    final_points = int(base_points * multiplier)
    
    # Record transaction
    import uuid
    transaction = {
        "id": str(uuid.uuid4()),
        "customer_id": customer_id,
        "type": "earn",
        "points": final_points,
        "purchase_amount": purchase_amount,
        "sale_id": sale_id,
        "notes": notes or f"Points earned from purchase of SAR {purchase_amount}",
        "multiplier_applied": multiplier,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.id
    }
    await db.loyalty_transactions.insert_one(transaction)
    
    return {
        "message": f"Earned {final_points} points",
        "points_earned": final_points,
        "base_points": base_points,
        "multiplier": multiplier,
        "new_balance": points_earned_total + final_points - sum(abs(t.get("points", 0)) for t in transactions if t.get("type") == "redeem")
    }


@router.post("/customers/{customer_id}/loyalty/redeem")
async def redeem_loyalty_points(customer_id: str, body: dict, current_user: User = Depends(get_current_user)):
    """Redeem loyalty points for discount."""
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    settings = await db.loyalty_settings.find_one({}, {"_id": 0}) or {
        "sar_per_point": 0.1, "min_redeem_points": 100, "enabled": False
    }
    
    if not settings.get("enabled", False):
        raise HTTPException(status_code=400, detail="Loyalty program is not enabled")
    
    points_to_redeem = int(body.get("points", 0))
    sale_id = body.get("sale_id")
    notes = body.get("notes", "")
    
    if points_to_redeem < settings.get("min_redeem_points", 100):
        raise HTTPException(
            status_code=400, 
            detail=f"Minimum {settings['min_redeem_points']} points required to redeem"
        )
    
    # Check balance
    transactions = await db.loyalty_transactions.find({"customer_id": customer_id}, {"_id": 0}).to_list(10000)
    points_earned = sum(t.get("points", 0) for t in transactions if t.get("type") == "earn")
    points_redeemed = sum(abs(t.get("points", 0)) for t in transactions if t.get("type") == "redeem")
    balance = points_earned - points_redeemed
    
    if points_to_redeem > balance:
        raise HTTPException(status_code=400, detail=f"Insufficient points. Balance: {balance}")
    
    # Calculate discount value
    discount_value = round(points_to_redeem * settings["sar_per_point"], 2)
    
    # Record redemption
    import uuid
    transaction = {
        "id": str(uuid.uuid4()),
        "customer_id": customer_id,
        "type": "redeem",
        "points": -points_to_redeem,
        "discount_value": discount_value,
        "sale_id": sale_id,
        "notes": notes or f"Redeemed {points_to_redeem} points for SAR {discount_value} discount",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.id
    }
    await db.loyalty_transactions.insert_one(transaction)
    
    return {
        "message": f"Redeemed {points_to_redeem} points for SAR {discount_value} discount",
        "points_redeemed": points_to_redeem,
        "discount_value": discount_value,
        "new_balance": balance - points_to_redeem
    }


@router.get("/loyalty/leaderboard")
async def get_loyalty_leaderboard(current_user: User = Depends(get_current_user)):
    """Get top customers by loyalty points."""
    customers = await db.customers.find({}, {"_id": 0}).to_list(1000)
    transactions = await db.loyalty_transactions.find({}, {"_id": 0}).to_list(50000)
    
    settings = await db.loyalty_settings.find_one({}, {"_id": 0}) or {
        "sar_per_point": 0.1, 
        "tier_levels": [
            {"name": "Bronze", "min_points": 0},
            {"name": "Silver", "min_points": 500},
            {"name": "Gold", "min_points": 1000},
            {"name": "Platinum", "min_points": 2500}
        ]
    }
    
    # Calculate points per customer
    customer_points = {}
    for t in transactions:
        cid = t.get("customer_id")
        if cid not in customer_points:
            customer_points[cid] = {"earned": 0, "redeemed": 0}
        if t.get("type") == "earn":
            customer_points[cid]["earned"] += t.get("points", 0)
        elif t.get("type") == "redeem":
            customer_points[cid]["redeemed"] += abs(t.get("points", 0))
    
    # Build leaderboard
    leaderboard = []
    customer_map = {c["id"]: c for c in customers}
    
    for cid, points in customer_points.items():
        customer = customer_map.get(cid)
        if not customer:
            continue
        
        balance = points["earned"] - points["redeemed"]
        
        # Determine tier
        tier = "Bronze"
        for t in settings["tier_levels"]:
            if points["earned"] >= t["min_points"]:
                tier = t["name"]
        
        leaderboard.append({
            "customer_id": cid,
            "customer_name": customer["name"],
            "phone": customer.get("phone", ""),
            "points_earned": points["earned"],
            "points_redeemed": points["redeemed"],
            "points_balance": balance,
            "tier": tier,
            "value_sar": round(balance * settings["sar_per_point"], 2)
        })
    
    # Sort by points earned (descending)
    leaderboard.sort(key=lambda x: x["points_earned"], reverse=True)
    
    return {
        "leaderboard": leaderboard[:50],
        "total_customers_with_points": len(leaderboard),
        "total_points_issued": sum(p["points_earned"] for p in leaderboard),
        "total_points_redeemed": sum(p["points_redeemed"] for p in leaderboard)
    }
