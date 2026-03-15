from fastapi import APIRouter, Depends
from database import db, get_current_user, get_tenant_filter, stamp_tenant
from models import User
from datetime import datetime, timezone, timedelta
import os

router = APIRouter()


async def get_ai_insight(data_summary: str, insight_type: str) -> str:
    """Generate AI insight from business data using OpenAI via Emergent."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            return "AI insights unavailable - API key not configured."

        chat = LlmChat(
            api_key=api_key,
            session_id=f"insight-{insight_type}-{datetime.now().strftime('%Y%m%d%H')}",
            system_message=(
                "You are a business analytics AI for a restaurant/retail business in Saudi Arabia. "
                "Provide concise, actionable insights in 2-3 sentences. Use SAR currency. "
                "Focus on trends, anomalies, and recommendations. Be direct and specific. "
                "Do not use markdown formatting - plain text only."
            ),
        ).with_model("openai", "gpt-4.1-mini")

        response = await chat.send_message(UserMessage(text=data_summary))
        return response if isinstance(response, str) else str(response)
    except Exception as e:
        return f"Unable to generate insight: {str(e)}"


@router.get("/ai-insights/dashboard")
async def dashboard_insights(current_user: User = Depends(get_current_user)):
    """Generate AI insights for the main dashboard."""
    now = datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).isoformat()[:10]
    two_weeks_ago = (now - timedelta(days=14)).isoformat()[:10]
    today = now.isoformat()[:10]

    # Gather data
    this_week_sales = await db.sales.find({"date": {"$gte": week_ago}}, {"_id": 0, "amount": 1, "discount": 1, "final_amount": 1, "payment_mode": 1, "sale_type": 1}).to_list(5000)
    last_week_sales = await db.sales.find({"date": {"$gte": two_weeks_ago, "$lt": week_ago}}, {"_id": 0, "amount": 1, "final_amount": 1}).to_list(5000)
    this_week_expenses = await db.expenses.find({"date": {"$gte": week_ago}}, {"_id": 0, "amount": 1, "category": 1}).to_list(5000)
    pending_credits = await db.customers.find({"credit_balance": {"$gt": 0}}, {"_id": 0, "name": 1, "credit_balance": 1}).to_list(100)

    tw_revenue = sum(s.get("final_amount") or s.get("amount", 0) for s in this_week_sales)
    lw_revenue = sum(s.get("final_amount") or s.get("amount", 0) for s in last_week_sales)
    tw_expenses = sum(e.get("amount", 0) for e in this_week_expenses)
    total_credit = sum(c.get("credit_balance", 0) for c in pending_credits)
    cash_sales = sum(1 for s in this_week_sales if s.get("payment_mode") == "cash")
    bank_sales = sum(1 for s in this_week_sales if s.get("payment_mode") == "bank")

    growth = ((tw_revenue - lw_revenue) / lw_revenue * 100) if lw_revenue > 0 else 0

    prompt = (
        f"Business summary for this week:\n"
        f"- This week revenue: SAR {tw_revenue:,.2f} ({len(this_week_sales)} transactions)\n"
        f"- Last week revenue: SAR {lw_revenue:,.2f} ({len(last_week_sales)} transactions)\n"
        f"- Growth: {growth:+.1f}%\n"
        f"- This week expenses: SAR {tw_expenses:,.2f}\n"
        f"- Profit margin: SAR {tw_revenue - tw_expenses:,.2f}\n"
        f"- Payment split: {cash_sales} cash, {bank_sales} bank\n"
        f"- Outstanding customer credit: SAR {total_credit:,.2f} from {len(pending_credits)} customers\n"
        f"Provide a quick business health summary with one key recommendation."
    )

    insight = await get_ai_insight(prompt, "dashboard")
    return {
        "insight": insight,
        "metrics": {
            "this_week_revenue": round(tw_revenue, 2),
            "last_week_revenue": round(lw_revenue, 2),
            "growth_pct": round(growth, 1),
            "expenses": round(tw_expenses, 2),
            "profit": round(tw_revenue - tw_expenses, 2),
            "outstanding_credit": round(total_credit, 2),
        },
    }


@router.get("/ai-insights/stock")
async def stock_insights(current_user: User = Depends(get_current_user)):
    """Generate AI insights for stock management."""
    items = await db.items.find({}, {"_id": 0, "id": 1, "name": 1, "min_stock_level": 1}).to_list(500)
    entries = await db.stock_entries.find({}, {"_id": 0, "item_id": 1, "quantity": 1}).to_list(10000)
    usage = await db.stock_usage.find({}, {"_id": 0, "item_id": 1, "quantity": 1, "date": 1}).to_list(10000)

    stock_in = {}
    for e in entries:
        stock_in[e["item_id"]] = stock_in.get(e["item_id"], 0) + e["quantity"]
    stock_out = {}
    for u in usage:
        stock_out[u["item_id"]] = stock_out.get(u["item_id"], 0) + u["quantity"]

    item_lines = []
    critical = []
    for item in items:
        bal = stock_in.get(item["id"], 0) - stock_out.get(item["id"], 0)
        min_lvl = item.get("min_stock_level", 0)
        if bal <= min_lvl and min_lvl > 0:
            critical.append(item["name"])
        item_lines.append(f"{item['name']}: balance={bal:.0f}, min={min_lvl}")

    prompt = (
        f"Stock inventory summary ({len(items)} items):\n"
        f"- Items below minimum level: {', '.join(critical[:10]) if critical else 'None'}\n"
        f"- Total critical items: {len(critical)}\n"
        f"Top items:\n" + "\n".join(item_lines[:15]) + "\n"
        f"Provide stock management insight and which items to reorder urgently."
    )

    insight = await get_ai_insight(prompt, "stock")
    return {"insight": insight, "critical_count": len(critical), "total_items": len(items), "critical_items": critical[:10]}


@router.get("/ai-insights/sales-trends")
async def sales_trends_insights(current_user: User = Depends(get_current_user)):
    """Generate AI insights for sales trends."""
    now = datetime.now(timezone.utc)
    daily_data = []
    for i in range(30, 0, -1):
        day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        sales = await db.sales.find({"date": {"$gte": day, "$lt": (now - timedelta(days=i-1)).strftime("%Y-%m-%d")}}, {"_id": 0, "final_amount": 1, "amount": 1}).to_list(1000)
        total = sum(s.get("final_amount") or s.get("amount", 0) for s in sales)
        daily_data.append(f"{day}: SAR {total:,.0f} ({len(sales)} txns)")

    prompt = (
        f"Daily sales for the last 30 days:\n" + "\n".join(daily_data) + "\n"
        f"Identify the trend, best/worst days, any patterns (weekday vs weekend), and forecast next week."
    )

    insight = await get_ai_insight(prompt, "sales-trends")
    return {"insight": insight, "period": "30 days"}


@router.get("/ai-insights/profit-analysis")
async def profit_analysis_insights(current_user: User = Depends(get_current_user)):
    """AI-powered profit per product/item analysis."""
    now = datetime.now(timezone.utc)
    month_ago = (now - timedelta(days=30)).strftime("%Y-%m-%d")

    items = await db.items.find({}, {"_id": 0, "id": 1, "name": 1, "unit_price": 1, "cost_price": 1}).to_list(500)
    item_map = {i["id"]: i for i in items}

    sales = await db.sales.find({"date": {"$gte": month_ago}}, {"_id": 0, "items": 1, "amount": 1, "final_amount": 1}).to_list(5000)
    item_revenue = {}
    for s in sales:
        for si in (s.get("items") or []):
            iid = si.get("item_id", si.get("id", ""))
            name = si.get("name", item_map.get(iid, {}).get("name", "Unknown"))
            qty = si.get("quantity", 1)
            price = si.get("price", si.get("unit_price", 0))
            revenue = qty * price
            if name not in item_revenue:
                item_revenue[name] = {"revenue": 0, "qty": 0, "cost": 0}
            item_revenue[name]["revenue"] += revenue
            item_revenue[name]["qty"] += qty
            cost = item_map.get(iid, {}).get("cost_price", 0) or 0
            item_revenue[name]["cost"] += qty * cost

    # Also check non-itemized sales
    total_revenue = sum(s.get("final_amount") or s.get("amount", 0) for s in sales)

    lines = []
    for name, data in sorted(item_revenue.items(), key=lambda x: x[1]["revenue"], reverse=True)[:20]:
        profit = data["revenue"] - data["cost"]
        margin = (profit / data["revenue"] * 100) if data["revenue"] > 0 else 0
        lines.append(f"{name}: Revenue=SAR {data['revenue']:,.0f}, Qty={data['qty']}, Profit=SAR {profit:,.0f}, Margin={margin:.0f}%")

    prompt = (
        f"Product profitability analysis (last 30 days):\n"
        f"Total revenue: SAR {total_revenue:,.2f} from {len(sales)} sales\n"
        f"Products with cost data:\n" + ("\n".join(lines) if lines else "No item-level data available. Sales are recorded at transaction level.") + "\n"
        f"Identify top performers, underperformers, and recommend pricing or menu changes."
    )

    insight = await get_ai_insight(prompt, "profit-analysis")
    return {
        "insight": insight,
        "items": [{"name": n, **d, "profit": d["revenue"] - d["cost"], "margin": round((d["revenue"] - d["cost"]) / d["revenue"] * 100, 1) if d["revenue"] > 0 else 0} for n, d in sorted(item_revenue.items(), key=lambda x: x[1]["revenue"], reverse=True)[:20]],
        "total_revenue": round(total_revenue, 2),
    }


@router.get("/ai-insights/customer-churn")
async def customer_churn_insights(current_user: User = Depends(get_current_user)):
    """AI-powered customer churn detection."""
    now = datetime.now(timezone.utc)
    customers = await db.customers.find({}, {"_id": 0, "id": 1, "name": 1, "phone": 1, "created_at": 1}).to_list(1000)
    thirty_days = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    sixty_days = (now - timedelta(days=60)).strftime("%Y-%m-%d")
    ninety_days = (now - timedelta(days=90)).strftime("%Y-%m-%d")

    churn_data = []
    for c in customers:
        cid = c.get("id")
        if not cid:
            continue
        c_sales = await db.sales.find({"customer_id": cid}, {"_id": 0, "date": 1, "final_amount": 1, "amount": 1}).sort("date", -1).to_list(100)
        if not c_sales:
            churn_data.append({"name": c["name"], "status": "never_purchased", "total_spent": 0, "last_purchase": "never"})
            continue

        total = sum(s.get("final_amount") or s.get("amount", 0) for s in c_sales)
        last_date = str(c_sales[0].get("date", ""))[:10]
        txn_count = len(c_sales)

        if last_date < ninety_days:
            status = "churned"
        elif last_date < sixty_days:
            status = "at_risk"
        elif last_date < thirty_days:
            status = "cooling"
        else:
            status = "active"

        churn_data.append({"name": c["name"], "status": status, "total_spent": round(total, 2), "last_purchase": last_date, "transactions": txn_count})

    counts = {}
    for cd in churn_data:
        counts[cd["status"]] = counts.get(cd["status"], 0) + 1

    at_risk = [cd for cd in churn_data if cd["status"] in ("at_risk", "churned")]
    at_risk.sort(key=lambda x: x["total_spent"], reverse=True)

    lines = [f"{cd['name']}: {cd['status']}, spent SAR {cd['total_spent']:,.0f}, last purchase {cd['last_purchase']}, {cd.get('transactions',0)} txns" for cd in at_risk[:15]]

    prompt = (
        f"Customer churn analysis ({len(customers)} total customers):\n"
        f"Active (last 30d): {counts.get('active', 0)}, Cooling (30-60d): {counts.get('cooling', 0)}, "
        f"At Risk (60-90d): {counts.get('at_risk', 0)}, Churned (90d+): {counts.get('churned', 0)}, "
        f"Never purchased: {counts.get('never_purchased', 0)}\n"
        f"Top at-risk/churned customers by spending:\n" + ("\n".join(lines) if lines else "No at-risk customers found.") + "\n"
        f"Provide retention strategies and identify which customers to re-engage first."
    )

    insight = await get_ai_insight(prompt, "customer-churn")
    return {
        "insight": insight,
        "summary": counts,
        "at_risk_customers": at_risk[:10],
        "total_customers": len(customers),
    }


@router.get("/ai-insights/revenue-prediction")
async def revenue_prediction_insights(current_user: User = Depends(get_current_user)):
    """AI-powered revenue prediction with confidence intervals."""
    now = datetime.now(timezone.utc)
    weekly_data = []
    for w in range(12, 0, -1):
        start = (now - timedelta(weeks=w)).strftime("%Y-%m-%d")
        end = (now - timedelta(weeks=w-1)).strftime("%Y-%m-%d")
        sales = await db.sales.find({"date": {"$gte": start, "$lt": end}}, {"_id": 0, "final_amount": 1, "amount": 1}).to_list(5000)
        total = sum(s.get("final_amount") or s.get("amount", 0) for s in sales)
        weekly_data.append({"week": start, "revenue": round(total, 2), "count": len(sales)})

    lines = [f"Week of {w['week']}: SAR {w['revenue']:,.0f} ({w['count']} txns)" for w in weekly_data]

    prompt = (
        f"Weekly revenue for last 12 weeks:\n" + "\n".join(lines) + "\n"
        f"Predict next 4 weeks' revenue with confidence levels (high/medium/low). "
        f"Also identify the overall trend direction and any seasonal patterns."
    )

    insight = await get_ai_insight(prompt, "revenue-prediction")
    return {
        "insight": insight,
        "history": weekly_data,
    }
