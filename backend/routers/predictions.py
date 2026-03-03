from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import math

from database import db, get_current_user
from models import User

router = APIRouter()


@router.get("/predictions/inventory-demand")
async def get_inventory_demand_forecast(days: int = 14, current_user: User = Depends(get_current_user)):
    """Predict daily demand for top items using weighted moving average."""
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=90)).isoformat()[:10]

    sales = await db.sales.find({"date": {"$gte": start_date}}, {"_id": 0}).to_list(50000)
    items = await db.items.find({}, {"_id": 0}).to_list(1000)
    item_map = {i["id"]: i for i in items}

    # Calculate daily demand per item
    item_daily = defaultdict(lambda: defaultdict(float))
    for s in sales:
        sale_date = s.get("date", "")[:10]
        for si in s.get("items", []):
            iid = si.get("item_id")
            if iid:
                item_daily[iid][sale_date] += si.get("quantity", 1)

    forecasts = []
    for iid, daily_data in item_daily.items():
        item = item_map.get(iid)
        if not item:
            continue

        # Build time series (last 90 days)
        ts = []
        for i in range(90):
            d = (now - timedelta(days=90 - i)).strftime("%Y-%m-%d")
            ts.append(daily_data.get(d, 0))

        if sum(ts) == 0:
            continue

        # Weighted moving average (recent days weighted more)
        weights_7 = [0.05, 0.05, 0.1, 0.1, 0.15, 0.2, 0.35]
        recent_7 = ts[-7:]
        wma_7 = sum(w * v for w, v in zip(weights_7, recent_7))

        avg_30 = sum(ts[-30:]) / 30
        avg_90 = sum(ts) / 90

        # Trend: compare recent avg to older avg
        recent_avg = sum(ts[-14:]) / 14
        older_avg = sum(ts[-60:-14]) / max(len(ts[-60:-14]), 1)
        trend_pct = ((recent_avg - older_avg) / max(older_avg, 0.01)) * 100

        # Day-of-week pattern
        dow_demand = defaultdict(list)
        for i in range(90):
            d = now - timedelta(days=90 - i)
            dow_demand[d.weekday()].append(ts[i])
        dow_avg = {k: sum(v) / max(len(v), 1) for k, v in dow_demand.items()}

        # Generate forecast
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        predictions = []
        for i in range(days):
            fd = now + timedelta(days=i + 1)
            dow = fd.weekday()
            # Blend WMA with day-of-week pattern
            base = (wma_7 * 0.6 + dow_avg.get(dow, avg_30) * 0.4)
            # Apply trend
            trend_factor = 1 + (trend_pct / 100 * 0.3)
            predicted = max(0, round(base * trend_factor, 1))
            predictions.append({
                "date": fd.strftime("%Y-%m-%d"),
                "day": day_names[dow],
                "predicted_demand": predicted
            })

        current_stock = item.get("balance", item.get("quantity", 0))
        total_predicted = sum(p["predicted_demand"] for p in predictions)
        stock_sufficient = current_stock >= total_predicted

        forecasts.append({
            "item_id": iid,
            "item_name": item.get("name", "Unknown"),
            "category": item.get("category", ""),
            "unit": item.get("unit", "pcs"),
            "current_stock": current_stock,
            "avg_daily_demand": round(avg_30, 1),
            "trend": "increasing" if trend_pct > 10 else "decreasing" if trend_pct < -10 else "stable",
            "trend_percent": round(trend_pct, 1),
            "total_predicted_demand": round(total_predicted, 1),
            "stock_sufficient": stock_sufficient,
            "days_until_stockout": round(current_stock / max(avg_30, 0.01)),
            "predictions": predictions,
            "dow_pattern": [{"day": day_names[i], "avg_demand": round(dow_avg.get(i, 0), 1)} for i in range(7)]
        })

    forecasts.sort(key=lambda x: -x["avg_daily_demand"])

    return {
        "items": forecasts[:30],
        "total_items_tracked": len(forecasts),
        "items_at_risk": len([f for f in forecasts if not f["stock_sufficient"]]),
        "forecast_period": f"Next {days} days"
    }


@router.get("/predictions/customer-clv")
async def get_customer_clv(current_user: User = Depends(get_current_user)):
    """Predict Customer Lifetime Value based on purchase history."""
    now = datetime.now(timezone.utc)
    customers = await db.customers.find({}, {"_id": 0}).to_list(10000)
    sales = await db.sales.find({"customer_id": {"$exists": True, "$ne": None}}, {"_id": 0}).to_list(50000)

    customer_sales = defaultdict(list)
    for s in sales:
        cid = s.get("customer_id")
        if cid:
            customer_sales[cid].append(s)

    results = []
    for c in customers:
        cid = c["id"]
        c_sales = customer_sales.get(cid, [])
        if not c_sales:
            continue

        amounts = [s.get("final_amount", s["amount"] - s.get("discount", 0)) for s in c_sales]
        dates = sorted([s.get("date", "")[:10] for s in c_sales if s.get("date")])

        total_spent = sum(amounts)
        avg_order = total_spent / len(amounts)
        order_count = len(amounts)

        # Purchase frequency (orders per month)
        if len(dates) >= 2:
            first = datetime.fromisoformat(dates[0])
            last = datetime.fromisoformat(dates[-1])
            span_months = max((last - first).days / 30, 1)
            frequency = order_count / span_months
        else:
            frequency = 0.5

        # Recency
        last_purchase = dates[-1] if dates else None
        if last_purchase:
            days_since = (now - datetime.fromisoformat(last_purchase).replace(tzinfo=timezone.utc)).days
        else:
            days_since = 999

        # Simple CLV projection (12-month)
        monthly_value = avg_order * frequency
        annual_clv = monthly_value * 12

        # Retention probability (decay based on recency)
        retention = max(0.1, min(1.0, 1 - (days_since / 365)))

        adjusted_clv = annual_clv * retention

        # Segment
        if adjusted_clv > 5000:
            segment = "Platinum"
            segment_color = "purple"
        elif adjusted_clv > 2000:
            segment = "Gold"
            segment_color = "amber"
        elif adjusted_clv > 500:
            segment = "Silver"
            segment_color = "blue"
        else:
            segment = "Bronze"
            segment_color = "stone"

        results.append({
            "customer_id": cid,
            "name": c.get("name", "Unknown"),
            "phone": c.get("phone", ""),
            "total_spent": round(total_spent, 2),
            "order_count": order_count,
            "avg_order_value": round(avg_order, 2),
            "purchase_frequency": round(frequency, 2),
            "days_since_last_purchase": days_since,
            "retention_probability": round(retention * 100, 1),
            "predicted_annual_clv": round(adjusted_clv, 2),
            "monthly_value": round(monthly_value, 2),
            "segment": segment,
            "segment_color": segment_color
        })

    results.sort(key=lambda x: -x["predicted_annual_clv"])

    segments = {"Platinum": 0, "Gold": 0, "Silver": 0, "Bronze": 0}
    for r in results:
        segments[r["segment"]] += 1

    total_projected = sum(r["predicted_annual_clv"] for r in results)

    return {
        "customers": results[:50],
        "total_customers": len(results),
        "total_projected_revenue": round(total_projected, 2),
        "segments": segments,
        "avg_clv": round(total_projected / max(len(results), 1), 2)
    }


@router.get("/predictions/peak-hours")
async def get_peak_hours_analysis(current_user: User = Depends(get_current_user)):
    """Analyze peak business hours for staff scheduling optimization."""
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=60)).isoformat()[:10]

    # Get POS orders with timestamps
    orders = await db.orders.find({"created_at": {"$exists": True}}, {"_id": 0}).to_list(50000)
    sales = await db.sales.find({"date": {"$gte": start_date}}, {"_id": 0}).to_list(50000)

    # Analyze order times
    hour_data = defaultdict(lambda: {"count": 0, "revenue": 0, "days": set()})
    dow_hour = defaultdict(lambda: defaultdict(lambda: {"count": 0, "revenue": 0}))

    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    for order in orders:
        created = order.get("created_at", "")
        if not created:
            continue
        try:
            dt = datetime.fromisoformat(created.replace("Z", "+00:00")) if isinstance(created, str) else created
            hour = dt.hour
            dow = dt.weekday()
            amount = order.get("total", 0)

            hour_data[hour]["count"] += 1
            hour_data[hour]["revenue"] += amount
            hour_data[hour]["days"].add(dt.strftime("%Y-%m-%d"))

            dow_hour[dow][hour]["count"] += 1
            dow_hour[dow][hour]["revenue"] += amount
        except Exception:
            pass

    # Also analyze sales timestamps
    for s in sales:
        created = s.get("created_at", s.get("date", ""))
        if not created:
            continue
        try:
            dt = datetime.fromisoformat(created.replace("Z", "+00:00")) if isinstance(created, str) else created
            hour = dt.hour
            dow = dt.weekday()
            amount = s.get("final_amount", s.get("amount", 0))

            hour_data[hour]["count"] += 1
            hour_data[hour]["revenue"] += amount
            hour_data[hour]["days"].add(dt.strftime("%Y-%m-%d"))

            dow_hour[dow][hour]["count"] += 1
            dow_hour[dow][hour]["revenue"] += amount
        except Exception:
            pass

    # Build hourly analysis
    hourly_analysis = []
    total_transactions = sum(h["count"] for h in hour_data.values())
    for h in range(24):
        data = hour_data.get(h, {"count": 0, "revenue": 0, "days": set()})
        num_days = max(len(data["days"]), 1)
        avg_per_day = data["count"] / num_days
        hourly_analysis.append({
            "hour": h,
            "label": f"{h:02d}:00",
            "total_orders": data["count"],
            "avg_orders_per_day": round(avg_per_day, 1),
            "total_revenue": round(data["revenue"], 2),
            "avg_revenue_per_day": round(data["revenue"] / num_days, 2),
            "share_percent": round(data["count"] / max(total_transactions, 1) * 100, 1)
        })

    # Find peak hours
    sorted_hours = sorted(hourly_analysis, key=lambda x: -x["total_orders"])
    peak_hours = sorted_hours[:3]
    slow_hours = [h for h in sorted_hours if h["total_orders"] > 0][-3:]

    # Day-of-week heatmap data
    heatmap = []
    for dow in range(7):
        for h in range(24):
            data = dow_hour.get(dow, {}).get(h, {"count": 0, "revenue": 0})
            if data["count"] > 0:
                heatmap.append({
                    "day": day_names[dow],
                    "day_num": dow,
                    "hour": h,
                    "label": f"{h:02d}:00",
                    "orders": data["count"],
                    "revenue": round(data["revenue"], 2)
                })

    # Staff recommendations
    recommendations = []
    for ph in peak_hours:
        if ph["total_orders"] > 0:
            recommendations.append(f"Schedule extra staff at {ph['label']} ({ph['avg_orders_per_day']} avg orders/day)")
    for sh in slow_hours:
        if sh["total_orders"] > 0:
            recommendations.append(f"Consider reduced staffing at {sh['label']} ({sh['avg_orders_per_day']} avg orders/day)")

    return {
        "hourly_analysis": hourly_analysis,
        "peak_hours": peak_hours,
        "slow_hours": slow_hours,
        "heatmap": heatmap,
        "total_transactions_analyzed": total_transactions,
        "recommendations": recommendations,
        "period": "Last 60 days"
    }


@router.get("/predictions/profit-decomposition")
async def get_profit_decomposition(current_user: User = Depends(get_current_user)):
    """Decompose profit into trend, seasonality, and identify anomalies."""
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=180)).isoformat()[:10]

    sales = await db.sales.find({"date": {"$gte": start_date}}, {"_id": 0}).to_list(50000)
    expenses = await db.expenses.find({"date": {"$gte": start_date}}, {"_id": 0}).to_list(20000)
    supplier_payments = await db.supplier_payments.find({"date": {"$gte": start_date}}, {"_id": 0}).to_list(20000)

    # Aggregate daily data
    daily = defaultdict(lambda: {"sales": 0, "expenses": 0, "sp": 0})
    for s in sales:
        d = s.get("date", "")[:10]
        daily[d]["sales"] += s.get("final_amount", s["amount"] - s.get("discount", 0))
    for e in expenses:
        d = e.get("date", "")[:10]
        daily[d]["expenses"] += e["amount"]
    for sp in supplier_payments:
        d = sp.get("date", "")[:10]
        if sp.get("payment_mode") != "credit":
            daily[d]["sp"] += sp["amount"]

    # Build sorted time series
    all_dates = sorted(daily.keys())
    if not all_dates:
        return {"daily": [], "trend": [], "seasonality": {}, "anomalies": [], "summary": {}}

    ts_data = []
    for d in all_dates:
        v = daily[d]
        profit = v["sales"] - v["expenses"] - v["sp"]
        ts_data.append({"date": d, "sales": round(v["sales"], 2), "expenses": round(v["expenses"] + v["sp"], 2), "profit": round(profit, 2)})

    # Calculate 7-day moving average (trend)
    profits = [t["profit"] for t in ts_data]
    trend = []
    for i in range(len(profits)):
        window = profits[max(0, i - 6):i + 1]
        trend.append(round(sum(window) / len(window), 2))

    # Seasonality: average profit by day of week
    dow_profits = defaultdict(list)
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    for t in ts_data:
        try:
            dt = datetime.fromisoformat(t["date"])
            dow_profits[dt.weekday()].append(t["profit"])
        except Exception:
            pass

    seasonality = {}
    for dow, vals in dow_profits.items():
        seasonality[day_names[dow]] = round(sum(vals) / max(len(vals), 1), 2)

    # Month-over-month comparison
    monthly = defaultdict(lambda: {"sales": 0, "expenses": 0, "profit": 0})
    for t in ts_data:
        m = t["date"][:7]
        monthly[m]["sales"] += t["sales"]
        monthly[m]["expenses"] += t["expenses"]
        monthly[m]["profit"] += t["profit"]

    monthly_data = []
    sorted_months = sorted(monthly.keys())
    for i, m in enumerate(sorted_months):
        v = monthly[m]
        prev_profit = monthly[sorted_months[i - 1]]["profit"] if i > 0 else 0
        growth = round(((v["profit"] - prev_profit) / max(abs(prev_profit), 1)) * 100, 1) if prev_profit else 0
        monthly_data.append({
            "month": m,
            "sales": round(v["sales"], 2),
            "expenses": round(v["expenses"], 2),
            "profit": round(v["profit"], 2),
            "growth": growth
        })

    # Anomaly detection (profit deviating >2 std from trend)
    anomalies = []
    if len(profits) > 14:
        avg_profit = sum(profits) / len(profits)
        std_profit = math.sqrt(sum((p - avg_profit) ** 2 for p in profits) / len(profits))
        threshold = 2 * std_profit

        for i, t in enumerate(ts_data):
            deviation = abs(t["profit"] - trend[i])
            if deviation > threshold and deviation > 0:
                anomalies.append({
                    "date": t["date"],
                    "actual_profit": t["profit"],
                    "expected": trend[i],
                    "deviation": round(deviation, 2),
                    "type": "spike" if t["profit"] > trend[i] else "dip"
                })

    # Enrich ts_data with trend
    for i, t in enumerate(ts_data):
        t["trend"] = trend[i]

    # Summary
    recent_30 = [t["profit"] for t in ts_data[-30:]]
    older_30 = [t["profit"] for t in ts_data[-60:-30]] if len(ts_data) >= 60 else []
    recent_avg = sum(recent_30) / max(len(recent_30), 1)
    older_avg = sum(older_30) / max(len(older_30), 1) if older_30 else recent_avg

    return {
        "daily": ts_data[-90:],
        "monthly": monthly_data,
        "seasonality": seasonality,
        "anomalies": anomalies[-10:],
        "summary": {
            "avg_daily_profit": round(recent_avg, 2),
            "profit_trend": "improving" if recent_avg > older_avg * 1.05 else "declining" if recent_avg < older_avg * 0.95 else "stable",
            "best_day": max(seasonality, key=seasonality.get) if seasonality else "-",
            "worst_day": min(seasonality, key=seasonality.get) if seasonality else "-",
            "total_anomalies": len(anomalies)
        }
    }



@router.get("/predictions/sales-forecast")
async def get_sales_forecast(
    days: int = 30,
    branch_id: str = None,
    current_user: User = Depends(get_current_user)
):
    """
    AI-powered sales forecasting using historical data analysis.
    Predicts daily sales for the next N days with confidence intervals.
    """
    now = datetime.now(timezone.utc)
    
    # Get historical sales data (last 180 days for better patterns)
    start_date = (now - timedelta(days=180)).isoformat()
    query = {"date": {"$gte": start_date}}
    if branch_id:
        query["branch_id"] = branch_id
    
    sales = await db.sales.find(query, {"_id": 0}).to_list(50000)
    
    # Aggregate daily sales
    daily_sales = defaultdict(float)
    for s in sales:
        d = s.get("date", "")[:10]
        daily_sales[d] += s.get("final_amount", s.get("amount", 0))
    
    # Build time series
    ts = []
    for i in range(180):
        d = (now - timedelta(days=180 - i)).strftime("%Y-%m-%d")
        ts.append(daily_sales.get(d, 0))
    
    if sum(ts) == 0:
        return {
            "message": "Insufficient data for forecasting",
            "forecast": [],
            "summary": {}
        }
    
    # Calculate statistics
    recent_30 = ts[-30:]
    recent_7 = ts[-7:]
    
    avg_30 = sum(recent_30) / len(recent_30)
    avg_7 = sum(recent_7) / len(recent_7)
    avg_all = sum(ts) / len(ts)
    
    # Standard deviation for confidence
    variance = sum((x - avg_30) ** 2 for x in recent_30) / len(recent_30)
    std_dev = math.sqrt(variance)
    
    # Day-of-week patterns
    dow_sales = defaultdict(list)
    for i in range(180):
        d = now - timedelta(days=180 - i)
        dow_sales[d.weekday()].append(ts[i])
    
    dow_avg = {}
    dow_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    for dow in range(7):
        vals = dow_sales[dow]
        if vals:
            dow_avg[dow] = sum(vals) / len(vals)
        else:
            dow_avg[dow] = avg_30
    
    # Trend calculation
    first_half = sum(ts[:90]) / 90
    second_half = sum(ts[90:]) / 90
    trend_pct = ((second_half - first_half) / max(first_half, 1)) * 100
    trend_direction = "up" if trend_pct > 5 else "down" if trend_pct < -5 else "stable"
    
    # Monthly patterns (for seasonality)
    monthly_avg = defaultdict(list)
    for i in range(180):
        d = now - timedelta(days=180 - i)
        monthly_avg[d.month].append(ts[i])
    
    month_factors = {}
    for m, vals in monthly_avg.items():
        month_factors[m] = (sum(vals) / len(vals)) / max(avg_all, 1)
    
    # Generate forecast
    forecasts = []
    total_forecast = 0
    
    for i in range(days):
        fd = now + timedelta(days=i + 1)
        dow = fd.weekday()
        month = fd.month
        
        # Base prediction using day-of-week pattern
        base = dow_avg.get(dow, avg_30)
        
        # Apply monthly seasonality
        season_factor = month_factors.get(month, 1)
        
        # Apply trend
        trend_factor = 1 + (trend_pct / 100 * 0.3)
        
        # Final prediction
        predicted = base * season_factor * trend_factor
        
        # Confidence interval (95%)
        lower = max(0, predicted - 1.96 * std_dev)
        upper = predicted + 1.96 * std_dev
        
        total_forecast += predicted
        
        forecasts.append({
            "date": fd.strftime("%Y-%m-%d"),
            "day_name": dow_names[dow],
            "predicted": round(predicted, 2),
            "lower_bound": round(lower, 2),
            "upper_bound": round(upper, 2),
            "confidence": 0.95
        })
    
    # Weekly and monthly projections
    next_7_days = sum(f["predicted"] for f in forecasts[:7])
    next_30_days = sum(f["predicted"] for f in forecasts[:min(30, days)])
    
    # Best/worst day predictions
    dow_predictions = defaultdict(list)
    for f in forecasts:
        dow_predictions[f["day_name"]].append(f["predicted"])
    
    best_day = max(dow_predictions.items(), key=lambda x: sum(x[1])/len(x[1]))[0] if dow_predictions else "-"
    worst_day = min(dow_predictions.items(), key=lambda x: sum(x[1])/len(x[1]))[0] if dow_predictions else "-"
    
    return {
        "forecast": forecasts,
        "summary": {
            "forecast_period_days": days,
            "total_predicted": round(total_forecast, 2),
            "next_7_days": round(next_7_days, 2),
            "next_30_days": round(next_30_days, 2),
            "avg_daily_predicted": round(total_forecast / days, 2),
            "trend": trend_direction,
            "trend_percentage": round(trend_pct, 1),
            "best_day": best_day,
            "worst_day": worst_day,
            "confidence_level": "95%"
        },
        "historical": {
            "avg_last_7_days": round(avg_7, 2),
            "avg_last_30_days": round(avg_30, 2),
            "avg_last_180_days": round(avg_all, 2),
            "std_deviation": round(std_dev, 2)
        },
        "day_of_week_pattern": {
            dow_names[k]: round(v, 2) for k, v in dow_avg.items()
        }
    }
