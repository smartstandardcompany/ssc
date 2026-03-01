from fastapi import APIRouter, Depends
from typing import Optional
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import uuid
import math

from database import db, get_current_user
from models import User

router = APIRouter()


def _std_dev(values):
    """Calculate standard deviation."""
    if len(values) < 2:
        return 0
    mean = sum(values) / len(values)
    variance = sum((x - mean) ** 2 for x in values) / len(values)
    return math.sqrt(variance)


def _z_score(value, mean, std):
    """Calculate z-score."""
    if std == 0:
        return 0
    return (value - mean) / std


def _severity(z):
    """Map z-score to severity level."""
    az = abs(z)
    if az >= 3:
        return "critical"
    elif az >= 2:
        return "warning"
    elif az >= 1.5:
        return "info"
    return None


# =====================================================
# SALES ANOMALIES
# =====================================================

async def detect_sales_anomalies(days=90):
    """Detect anomalies in sales data."""
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=days)).isoformat()
    sales = await db.sales.find({"date": {"$gte": cutoff}}, {"_id": 0}).to_list(50000)
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    branch_map = {b["id"]: b.get("name", "Unknown") for b in branches}

    anomalies = []

    # === Daily Sales Volume Anomalies ===
    daily_totals = defaultdict(float)
    daily_counts = defaultdict(int)
    for s in sales:
        day = str(s.get("date", ""))[:10]
        if day:
            daily_totals[day] += s.get("final_amount", s.get("amount", 0))
            daily_counts[day] += 1

    if len(daily_totals) > 7:
        vals = list(daily_totals.values())
        mean_daily = sum(vals) / len(vals)
        std_daily = _std_dev(vals)

        sorted_days = sorted(daily_totals.keys())
        for day in sorted_days[-14:]:
            z = _z_score(daily_totals[day], mean_daily, std_daily)
            sev = _severity(z)
            if sev:
                direction = "spike" if z > 0 else "drop"
                anomalies.append({
                    "id": str(uuid.uuid4()),
                    "category": "sales",
                    "type": f"daily_sales_{direction}",
                    "severity": sev,
                    "title": f"Sales {direction} on {day}",
                    "description": f"Daily sales of SAR {daily_totals[day]:,.0f} is {abs(z):.1f} std devs {'above' if z > 0 else 'below'} the average of SAR {mean_daily:,.0f}",
                    "value": round(daily_totals[day], 2),
                    "expected": round(mean_daily, 2),
                    "z_score": round(z, 2),
                    "date": day,
                    "metric": "daily_sales_amount",
                })

    # === Transaction Count Anomalies ===
    if len(daily_counts) > 7:
        count_vals = list(daily_counts.values())
        mean_count = sum(count_vals) / len(count_vals)
        std_count = _std_dev(count_vals)

        sorted_days = sorted(daily_counts.keys())
        for day in sorted_days[-14:]:
            z = _z_score(daily_counts[day], mean_count, std_count)
            sev = _severity(z)
            if sev:
                direction = "high" if z > 0 else "low"
                anomalies.append({
                    "id": str(uuid.uuid4()),
                    "category": "sales",
                    "type": f"txn_count_{direction}",
                    "severity": sev,
                    "title": f"Transaction count {direction} on {day}",
                    "description": f"{daily_counts[day]} transactions vs average of {mean_count:.0f}",
                    "value": daily_counts[day],
                    "expected": round(mean_count),
                    "z_score": round(z, 2),
                    "date": day,
                    "metric": "daily_txn_count",
                })

    # === Payment Mode Shift Detection ===
    week_recent = (now - timedelta(days=7)).isoformat()
    week_prev = (now - timedelta(days=14)).isoformat()
    recent_modes = defaultdict(float)
    prev_modes = defaultdict(float)
    for s in sales:
        d = str(s.get("date", ""))
        for pd in s.get("payment_details", []):
            mode = pd.get("mode", "other")
            amt = pd.get("amount", 0)
            if d >= week_recent:
                recent_modes[mode] += amt
            elif d >= week_prev:
                prev_modes[mode] += amt

    recent_total = sum(recent_modes.values()) or 1
    prev_total = sum(prev_modes.values()) or 1
    for mode in set(list(recent_modes.keys()) + list(prev_modes.keys())):
        recent_pct = (recent_modes.get(mode, 0) / recent_total) * 100
        prev_pct = (prev_modes.get(mode, 0) / prev_total) * 100
        shift = recent_pct - prev_pct
        if abs(shift) >= 15:
            anomalies.append({
                "id": str(uuid.uuid4()),
                "category": "sales",
                "type": "payment_mode_shift",
                "severity": "warning" if abs(shift) >= 25 else "info",
                "title": f"Payment mode shift: {mode.title()}",
                "description": f"{mode.title()} shifted from {prev_pct:.0f}% to {recent_pct:.0f}% of sales ({'+' if shift > 0 else ''}{shift:.0f}pp)",
                "value": round(recent_pct, 1),
                "expected": round(prev_pct, 1),
                "z_score": round(shift / 10, 2),
                "date": now.strftime("%Y-%m-%d"),
                "metric": f"payment_mode_{mode}",
            })

    # === Branch Performance Anomalies ===
    branch_sales = defaultdict(float)
    for s in sales:
        if s.get("branch_id"):
            branch_sales[s["branch_id"]] += s.get("final_amount", s.get("amount", 0))

    if len(branch_sales) > 1:
        bvals = list(branch_sales.values())
        mean_branch = sum(bvals) / len(bvals)
        std_branch = _std_dev(bvals)

        for bid, bamt in branch_sales.items():
            z = _z_score(bamt, mean_branch, std_branch)
            sev = _severity(z)
            if sev and z < 0:
                anomalies.append({
                    "id": str(uuid.uuid4()),
                    "category": "sales",
                    "type": "branch_underperforming",
                    "severity": sev,
                    "title": f"Branch underperforming: {branch_map.get(bid, bid[:8])}",
                    "description": f"SAR {bamt:,.0f} total sales vs average SAR {mean_branch:,.0f} ({abs(z):.1f} std devs below)",
                    "value": round(bamt, 2),
                    "expected": round(mean_branch, 2),
                    "z_score": round(z, 2),
                    "date": now.strftime("%Y-%m-%d"),
                    "metric": "branch_total_sales",
                })

    return anomalies


# =====================================================
# EXPENSE ANOMALIES
# =====================================================

async def detect_expense_anomalies(days=180):
    """Detect anomalies in expense data."""
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=days)).isoformat()
    recent_cutoff = (now - timedelta(days=7)).isoformat()
    expenses = await db.expenses.find({"date": {"$gte": cutoff}}, {"_id": 0}).to_list(20000)

    anomalies = []

    # === Category Average Anomalies ===
    cat_amounts = defaultdict(list)
    for e in expenses:
        cat = e.get("category", "general")
        cat_amounts[cat].append(e.get("amount", 0))

    recent_expenses = [e for e in expenses if str(e.get("date", "")) >= recent_cutoff]
    for e in recent_expenses:
        cat = e.get("category", "general")
        if len(cat_amounts.get(cat, [])) < 5:
            continue
        vals = cat_amounts[cat]
        mean = sum(vals) / len(vals)
        std = _std_dev(vals)
        z = _z_score(e["amount"], mean, std)
        sev = _severity(z)
        if sev and z > 0:
            anomalies.append({
                "id": str(uuid.uuid4()),
                "category": "expenses",
                "type": "expense_above_average",
                "severity": sev,
                "title": f"High {cat.replace('_', ' ').title()} expense",
                "description": f"SAR {e['amount']:,.0f} vs category avg SAR {mean:,.0f} ({z:.1f}x std dev). {e.get('description', '')[:50]}",
                "value": round(e["amount"], 2),
                "expected": round(mean, 2),
                "z_score": round(z, 2),
                "date": str(e.get("date", ""))[:10],
                "metric": f"expense_{cat}",
            })

    # === Weekly Spending Trend Anomalies ===
    weekly_totals = defaultdict(float)
    for e in expenses:
        d = str(e.get("date", ""))[:10]
        if d:
            try:
                dt = datetime.fromisoformat(d)
                week_key = dt.strftime("%Y-W%W")
                weekly_totals[week_key] += e.get("amount", 0)
            except:
                pass

    if len(weekly_totals) > 4:
        wvals = list(weekly_totals.values())
        mean_week = sum(wvals) / len(wvals)
        std_week = _std_dev(wvals)
        sorted_weeks = sorted(weekly_totals.keys())

        for wk in sorted_weeks[-4:]:
            z = _z_score(weekly_totals[wk], mean_week, std_week)
            sev = _severity(z)
            if sev:
                direction = "spike" if z > 0 else "drop"
                anomalies.append({
                    "id": str(uuid.uuid4()),
                    "category": "expenses",
                    "type": f"weekly_expense_{direction}",
                    "severity": sev,
                    "title": f"Weekly expense {direction}: {wk}",
                    "description": f"SAR {weekly_totals[wk]:,.0f} vs weekly avg SAR {mean_week:,.0f}",
                    "value": round(weekly_totals[wk], 2),
                    "expected": round(mean_week, 2),
                    "z_score": round(z, 2),
                    "date": wk,
                    "metric": "weekly_expense_total",
                })

    # === Unusual Category Distribution ===
    cat_totals = {cat: sum(vals) for cat, vals in cat_amounts.items()}
    total_expense = sum(cat_totals.values()) or 1
    cat_pcts = {cat: (amt / total_expense) * 100 for cat, amt in cat_totals.items()}

    for cat, pct in cat_pcts.items():
        if pct >= 40:
            anomalies.append({
                "id": str(uuid.uuid4()),
                "category": "expenses",
                "type": "category_concentration",
                "severity": "warning",
                "title": f"High expense concentration: {cat.replace('_', ' ').title()}",
                "description": f"{pct:.0f}% of all expenses ({len(cat_amounts[cat])} entries, SAR {cat_totals[cat]:,.0f})",
                "value": round(pct, 1),
                "expected": round(100 / max(len(cat_totals), 1), 1),
                "z_score": 0,
                "date": now.strftime("%Y-%m-%d"),
                "metric": "expense_category_pct",
            })

    return anomalies


# =====================================================
# BANK RECONCILIATION ANOMALIES
# =====================================================

async def detect_bank_anomalies():
    """Detect anomalies in bank reconciliation patterns."""
    now = datetime.now(timezone.utc)
    anomalies = []

    # Get reconciliation alert history
    alerts = await db.reconciliation_alerts.find({}, {"_id": 0}).sort("created_at", -1).to_list(20)

    if len(alerts) >= 2:
        # === Match Rate Trend ===
        match_rates = []
        for a in alerts:
            for ss in a.get("statement_summaries", []):
                match_rates.append(ss.get("match_rate", 0))

        if match_rates:
            latest_rate = match_rates[0] if match_rates else 0
            mean_rate = sum(match_rates) / len(match_rates)
            std_rate = _std_dev(match_rates)
            z = _z_score(latest_rate, mean_rate, std_rate) if std_rate > 0 else 0
            if latest_rate < mean_rate - 10 and abs(z) >= 1.5:
                anomalies.append({
                    "id": str(uuid.uuid4()),
                    "category": "bank",
                    "type": "match_rate_drop",
                    "severity": "warning" if abs(z) >= 2 else "info",
                    "title": "Match rate declining",
                    "description": f"Current {latest_rate:.0f}% vs historical avg {mean_rate:.0f}%",
                    "value": round(latest_rate, 1),
                    "expected": round(mean_rate, 1),
                    "z_score": round(z, 2),
                    "date": alerts[0].get("created_at", "")[:10],
                    "metric": "bank_match_rate",
                })

        # === Flagged Count Trend ===
        flagged_counts = [a.get("total_flagged", 0) for a in alerts]
        if len(flagged_counts) >= 2:
            latest_f = flagged_counts[0]
            prev_f = flagged_counts[1]
            if latest_f > prev_f * 1.5 and latest_f > 10:
                anomalies.append({
                    "id": str(uuid.uuid4()),
                    "category": "bank",
                    "type": "flagged_spike",
                    "severity": "critical" if latest_f > prev_f * 2 else "warning",
                    "title": "Flagged transactions spike",
                    "description": f"{latest_f} flagged items vs previous {prev_f} ({((latest_f - prev_f) / max(prev_f, 1) * 100):.0f}% increase)",
                    "value": latest_f,
                    "expected": prev_f,
                    "z_score": round((latest_f - prev_f) / max(prev_f, 1), 2),
                    "date": alerts[0].get("created_at", "")[:10],
                    "metric": "bank_flagged_count",
                })

    # === Large Unmatched Transactions ===
    statements = await db.bank_statements.find({}, {"_id": 0}).to_list(100)
    for stmt in statements:
        txns = stmt.get("transactions", [])
        if not txns:
            continue
        matches = await db.auto_matches.find({"statement_id": stmt["id"]}, {"_id": 0, "txn_index": 1}).to_list(50000)
        matched_idx = {m["txn_index"] for m in matches}

        amounts = []
        for idx, txn in enumerate(txns):
            if idx in matched_idx:
                continue
            amt = txn.get("credit", 0) or txn.get("debit", 0)
            if amt > 0:
                amounts.append(amt)

        if len(amounts) > 10:
            mean_amt = sum(amounts) / len(amounts)
            std_amt = _std_dev(amounts)
            for idx, txn in enumerate(txns):
                if idx in matched_idx:
                    continue
                amt = txn.get("credit", 0) or txn.get("debit", 0)
                z = _z_score(amt, mean_amt, std_amt)
                if z >= 3 and amt >= 5000:
                    anomalies.append({
                        "id": str(uuid.uuid4()),
                        "category": "bank",
                        "type": "large_unmatched_txn",
                        "severity": "critical" if amt >= 20000 else "warning",
                        "title": f"Large unmatched: SAR {amt:,.0f}",
                        "description": f"{txn.get('description', '')[:80]} ({txn.get('date', '')})",
                        "value": round(amt, 2),
                        "expected": round(mean_amt, 2),
                        "z_score": round(z, 2),
                        "date": txn.get("date", ""),
                        "metric": "bank_unmatched_amount",
                    })

    return anomalies


# =====================================================
# COMBINED ANOMALY API
# =====================================================

@router.get("/anomaly-detection/scan")
async def run_anomaly_scan(
    days: int = 90,
    current_user: User = Depends(get_current_user),
):
    """Run full anomaly detection scan across all areas."""
    now = datetime.now(timezone.utc)

    sales_anomalies = await detect_sales_anomalies(days)
    expense_anomalies = await detect_expense_anomalies(days)
    bank_anomalies = await detect_bank_anomalies()

    all_anomalies = sales_anomalies + expense_anomalies + bank_anomalies
    all_anomalies.sort(key=lambda x: ({"critical": 0, "warning": 1, "info": 2}.get(x["severity"], 3), x.get("date", "")))

    # Save scan results
    scan_record = {
        "id": str(uuid.uuid4()),
        "scanned_at": now.isoformat(),
        "period_days": days,
        "total_anomalies": len(all_anomalies),
        "critical": len([a for a in all_anomalies if a["severity"] == "critical"]),
        "warning": len([a for a in all_anomalies if a["severity"] == "warning"]),
        "info": len([a for a in all_anomalies if a["severity"] == "info"]),
        "by_category": {
            "sales": len(sales_anomalies),
            "expenses": len(expense_anomalies),
            "bank": len(bank_anomalies),
        },
    }
    await db.anomaly_scans.insert_one(scan_record)
    del scan_record["_id"]

    return {
        "scan": scan_record,
        "anomalies": all_anomalies,
    }


@router.get("/anomaly-detection/history")
async def get_anomaly_history(current_user: User = Depends(get_current_user)):
    """Get anomaly scan history."""
    scans = await db.anomaly_scans.find({}, {"_id": 0}).sort("scanned_at", -1).to_list(20)
    return scans
