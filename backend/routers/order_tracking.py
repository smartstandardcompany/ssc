from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
import os

router = APIRouter(prefix="/order-tracking", tags=["order-tracking"])

def get_db():
    from server import db
    return db

# Order status flow
ORDER_STATUSES = ['placed', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled']

STATUS_MESSAGES = {
    'placed': 'Your order has been placed successfully!',
    'confirmed': 'Your order has been confirmed and will be prepared soon.',
    'preparing': 'Your order is now being prepared.',
    'ready': 'Your order is ready for pickup/delivery!',
    'out_for_delivery': 'Your order is out for delivery.',
    'delivered': 'Your order has been delivered. Thank you!',
    'cancelled': 'Your order has been cancelled.',
}

class OrderStatusUpdate(BaseModel):
    order_id: str
    status: str
    notes: Optional[str] = None
    notify_customer: bool = True

class OrderTrackingConfig(BaseModel):
    enabled: bool = True
    channels: List[str] = ['email', 'whatsapp']
    notify_on_statuses: List[str] = ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered']

async def send_order_notification(customer: dict, order: dict, status: str, message: str):
    """Send order status notification via email and/or WhatsApp"""
    db = get_db()
    
    # Get tracking config
    config = await db.settings.find_one({"type": "order_tracking"})
    if not config or not config.get("enabled", True):
        return
    
    channels = config.get("channels", ['email', 'whatsapp'])
    notify_statuses = config.get("notify_on_statuses", ['confirmed', 'preparing', 'ready', 'delivered'])
    
    if status not in notify_statuses:
        return
    
    customer_email = customer.get("email")
    customer_phone = customer.get("phone")
    customer_name = customer.get("name", "Customer")
    order_id = str(order.get("_id", order.get("id", "")))[-6:]
    
    # Send Email
    if 'email' in channels and customer_email:
        try:
            import aiosmtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            
            smtp_host = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
            smtp_port = int(os.environ.get('SMTP_PORT', 587))
            smtp_user = os.environ.get('SMTP_USER')
            smtp_pass = os.environ.get('SMTP_PASS')
            
            if smtp_user and smtp_pass:
                msg = MIMEMultipart('alternative')
                msg['Subject'] = f"Order #{order_id} - {status.replace('_', ' ').title()}"
                msg['From'] = smtp_user
                msg['To'] = customer_email
                
                html = f"""
                <html>
                <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #10B981, #059669); padding: 20px; border-radius: 10px 10px 0 0;">
                        <h1 style="color: white; margin: 0;">SSC Track</h1>
                    </div>
                    <div style="background: #f9fafb; padding: 20px; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #374151;">Order Update</h2>
                        <p>Hi {customer_name},</p>
                        <p style="font-size: 16px; color: #059669; font-weight: bold;">{message}</p>
                        <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                            <p><strong>Order #:</strong> {order_id}</p>
                            <p><strong>Status:</strong> {status.replace('_', ' ').title()}</p>
                            <p><strong>Total:</strong> SAR {order.get('amount', order.get('total', 0)):,.2f}</p>
                        </div>
                        <p style="color: #6b7280; font-size: 12px;">Track your order at our customer portal.</p>
                    </div>
                </body>
                </html>
                """
                msg.attach(MIMEText(html, 'html'))
                
                await aiosmtplib.send(msg, hostname=smtp_host, port=smtp_port, 
                                      username=smtp_user, password=smtp_pass, start_tls=True, timeout=30)
        except Exception as e:
            print(f"Email notification failed: {e}")
    
    # Send WhatsApp
    if 'whatsapp' in channels and customer_phone:
        try:
            twilio_sid = os.environ.get('TWILIO_ACCOUNT_SID')
            twilio_token = os.environ.get('TWILIO_AUTH_TOKEN')
            twilio_whatsapp = os.environ.get('TWILIO_WHATSAPP_NUMBER')
            
            if twilio_sid and twilio_token and twilio_whatsapp:
                from twilio.rest import Client
                client = Client(twilio_sid, twilio_token)
                
                # Format phone for WhatsApp
                phone = customer_phone.replace(' ', '').replace('-', '')
                if not phone.startswith('+'):
                    phone = '+966' + phone.lstrip('0')
                
                wa_message = f"""🛒 *Order Update*

Hi {customer_name}!

{message}

📦 Order #{order_id}
📊 Status: {status.replace('_', ' ').title()}
💰 Total: SAR {order.get('amount', order.get('total', 0)):,.2f}

Thank you for ordering with us!"""
                
                client.messages.create(
                    body=wa_message,
                    from_=f'whatsapp:{twilio_whatsapp}',
                    to=f'whatsapp:{phone}'
                )
        except Exception as e:
            print(f"WhatsApp notification failed: {e}")
    
    # Log notification
    await db.order_notifications.insert_one({
        "order_id": str(order.get("_id", order.get("id"))),
        "customer_id": str(customer.get("_id", customer.get("id"))),
        "status": status,
        "message": message,
        "channels": channels,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    })

@router.post("/update-status")
async def update_order_status(request: OrderStatusUpdate, background_tasks: BackgroundTasks):
    """Update order status and optionally notify customer"""
    db = get_db()
    
    if request.status not in ORDER_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {ORDER_STATUSES}")
    
    # Find the order (could be in sales or orders collection)
    order = await db.sales.find_one({"_id": ObjectId(request.order_id)})
    if not order:
        order = await db.orders.find_one({"_id": ObjectId(request.order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Update status
    old_status = order.get("order_status", "placed")
    
    update_data = {
        "order_status": request.status,
        "status_updated_at": datetime.now(timezone.utc).isoformat(),
    }
    
    # Add to status history
    status_history = order.get("status_history", [])
    status_history.append({
        "status": request.status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "notes": request.notes,
    })
    update_data["status_history"] = status_history
    
    # Update the order
    collection = db.sales if await db.sales.find_one({"_id": ObjectId(request.order_id)}) else db.orders
    await collection.update_one(
        {"_id": ObjectId(request.order_id)},
        {"$set": update_data}
    )
    
    # Send notification if requested
    if request.notify_customer:
        customer_id = order.get("customer_id")
        if customer_id:
            customer = await db.customers.find_one({"_id": ObjectId(customer_id)}) if ObjectId.is_valid(customer_id) else None
            if not customer:
                customer = await db.customers.find_one({"id": customer_id})
            
            if customer:
                message = STATUS_MESSAGES.get(request.status, f"Your order status has been updated to: {request.status}")
                if request.notes:
                    message += f" Note: {request.notes}"
                
                background_tasks.add_task(send_order_notification, customer, order, request.status, message)
    
    return {
        "message": "Order status updated",
        "order_id": request.order_id,
        "old_status": old_status,
        "new_status": request.status,
        "notification_sent": request.notify_customer,
    }

@router.get("/order/{order_id}")
async def get_order_tracking(order_id: str):
    """Get order tracking information - public endpoint, no auth required"""
    db = get_db()
    
    order = None
    # Try lookup by id field (UUID)
    order = await db.pos_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        order = await db.sales.find_one({"id": order_id}, {"_id": 0})
    if not order:
        # Try by order_number
        order = await db.pos_orders.find_one({"order_number": order_id}, {"_id": 0})
    if not order:
        try:
            from bson import ObjectId as ObjId
            if ObjId.is_valid(order_id):
                raw = await db.pos_orders.find_one({"_id": ObjId(order_id)})
                if raw: raw.pop("_id", None); order = raw
                if not order:
                    raw = await db.sales.find_one({"_id": ObjId(order_id)})
                    if raw: raw.pop("_id", None); order = raw
        except Exception:
            pass
    if not order:
        raise HTTPException(status_code=404, detail="Order not found. Please check the order number.")
    
    # Get customer info
    customer = None
    customer_id = order.get("customer_id")
    if customer_id:
        customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    
    return {
        "order_id": order.get("id", order_id),
        "order_number": order.get("order_number", ""),
        "status": order.get("order_status", order.get("status", "placed")),
        "status_history": order.get("status_history", []),
        "created_at": order.get("created_at"),
        "updated_at": order.get("status_updated_at"),
        "customer_name": customer.get("name") if customer else order.get("customer_name"),
        "total": order.get("final_amount", order.get("amount", order.get("total", 0))),
        "items": order.get("items", []),
        "table_number": order.get("table_number"),
        "order_type": order.get("order_type", "dine_in"),
    }

@router.get("/config")
async def get_tracking_config():
    """Get order tracking notification config"""
    db = get_db()
    config = await db.settings.find_one({"type": "order_tracking"})
    
    if not config:
        return {
            "enabled": True,
            "channels": ["email", "whatsapp"],
            "notify_on_statuses": ["confirmed", "preparing", "ready", "delivered"],
        }
    
    return {
        "enabled": config.get("enabled", True),
        "channels": config.get("channels", ["email", "whatsapp"]),
        "notify_on_statuses": config.get("notify_on_statuses", ["confirmed", "preparing", "ready", "delivered"]),
    }

@router.post("/config")
async def update_tracking_config(config: OrderTrackingConfig):
    """Update order tracking notification config"""
    db = get_db()
    
    await db.settings.update_one(
        {"type": "order_tracking"},
        {"$set": {
            "type": "order_tracking",
            "enabled": config.enabled,
            "channels": config.channels,
            "notify_on_statuses": config.notify_on_statuses,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True
    )
    
    return {"message": "Config updated", **config.dict()}

@router.get("/notifications/{order_id}")
async def get_order_notifications(order_id: str):
    """Get notification history for an order"""
    db = get_db()
    
    notifications = await db.order_notifications.find(
        {"order_id": order_id}
    ).sort("sent_at", -1).to_list(None)
    
    return [{
        "id": str(n["_id"]),
        "status": n.get("status"),
        "message": n.get("message"),
        "channels": n.get("channels"),
        "sent_at": n.get("sent_at"),
    } for n in notifications]

@router.get("/recent")
async def get_recent_orders_for_tracking(limit: int = 20):
    """Get recent orders for status management"""
    db = get_db()
    
    pipeline = [
        {"$match": {"customer_id": {"$exists": True, "$ne": None}}},
        {"$sort": {"created_at": -1}},
        {"$limit": limit},
        {"$lookup": {
            "from": "customers",
            "let": {"cust_id": "$customer_id"},
            "pipeline": [
                {"$match": {"$expr": {"$or": [
                    {"$eq": [{"$toString": "$_id"}, "$$cust_id"]},
                    {"$eq": ["$id", "$$cust_id"]}
                ]}}}
            ],
            "as": "customer"
        }},
        {"$addFields": {
            "customer_name": {"$ifNull": [{"$arrayElemAt": ["$customer.name", 0]}, "Unknown"]}
        }},
        {"$project": {
            "_id": 0,
            "id": {"$toString": "$_id"},
            "customer_name": 1,
            "amount": 1,
            "total": 1,
            "order_status": {"$ifNull": ["$order_status", "placed"]},
            "created_at": 1,
            "status_updated_at": 1,
            "payment_mode": 1,
            "description": 1,
        }}
    ]
    
    orders = await db.sales.aggregate(pipeline).to_list(None)
    return orders
