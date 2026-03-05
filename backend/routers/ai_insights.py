from fastapi import APIRouter, Depends
from database import db, get_current_user
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
