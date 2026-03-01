from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import Optional
from datetime import datetime, timezone, timedelta
from io import BytesIO
import uuid
import os
import re
import pandas as pd

from database import db, get_current_user
from models import User

router = APIRouter()

@router.post("/bank-statements/upload")
async def upload_bank_statement(file: UploadFile = File(...), bank_name: str = Form(""), branch_id: str = Form(""), current_user: User = Depends(get_current_user)):
    import pdfplumber
    content = await file.read()
    transactions = []
    if file.filename.endswith('.pdf'):
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        try:
            with pdfplumber.open(tmp_path) as pdf:
                for page in pdf.pages:
                    tables = page.extract_tables()
                    for table in tables:
                        for row in table:
                            if not row or len(row) < 3: continue
                            cells = [str(c or '').strip() for c in row]
                            date_match = None
                            for cell in cells:
                                m = re.search(r'(\d{2}/\d{2}/\d{4})', cell)
                                if m: date_match = m.group(1); break
                            if not date_match: continue
                            debit = 0; credit = 0; desc = ''; balance = 0
                            for cell in cells:
                                if cell == date_match: continue
                                clean = cell.replace(',', '').replace(' ', '')
                                try:
                                    num = float(clean)
                                    if num > 0:
                                        if credit == 0: credit = num
                                        else: balance = num
                                    elif num < 0: debit = abs(num)
                                except:
                                    if len(cell) > 5 and not desc: desc = cell[:200]
                            if (debit > 0 or credit > 0) and date_match:
                                transactions.append({"date": date_match, "description": desc, "debit": debit, "credit": credit, "balance": balance})
        finally:
            os.remove(tmp_path)
    else:
        try:
            if file.filename.endswith('.csv'):
                df = pd.read_csv(BytesIO(content))
            else:
                try: df = pd.read_excel(BytesIO(content))
                except: df = pd.read_excel(BytesIO(content), engine='xlrd')
            for idx in range(min(20, len(df))):
                row_vals = [str(v).lower() for v in df.iloc[idx].values if pd.notna(v)]
                row_str = ' '.join(row_vals)
                if 'transaction date' in row_str or '\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0639\u0645\u0644\u064a\u0629' in row_str:
                    data_df = df.iloc[idx+1:].reset_index(drop=True)
                    for _, row in data_df.iterrows():
                        vals = [v for v in row.values]
                        date_val = str(vals[-1]) if pd.notna(vals[-1]) else ''
                        if not any(c.isdigit() for c in date_val): continue
                        balance = float(str(vals[0]).replace(',','').replace('(','').replace(')','').strip()) if pd.notna(vals[0]) else 0
                        amount_str = str(vals[1]).replace(',','').strip() if pd.notna(vals[1]) else '0'
                        try: amount = float(amount_str)
                        except: continue
                        desc = str(vals[2]) if pd.notna(vals[2]) else ''
                        ref_val = str(vals[-3]) if pd.notna(vals[-3]) else ''
                        debit = abs(amount) if amount < 0 else 0
                        credit = amount if amount > 0 else 0
                        transactions.append({"date": date_val, "description": desc[:200], "debit": debit, "credit": credit, "balance": abs(balance), "reference": ref_val})
                    break
                if 'reference' in row_str and ('balance' in row_str or 'debit' in row_str):
                    header_vals = [str(v).lower().strip() if pd.notna(v) else '' for v in df.iloc[idx].values]
                    ref_col = next((j for j, v in enumerate(header_vals) if 'reference' in v), 1)
                    desc_col = next((j for j, v in enumerate(header_vals) if 'description' in v), 3)
                    detail_col = next((j for j, v in enumerate(header_vals) if 'detail' in v), 4)
                    bal_col = next((j for j, v in enumerate(header_vals) if 'balance' in v), 7)
                    deb_col = next((j for j, v in enumerate(header_vals) if 'debit' in v), 8)
                    cred_col = next((j for j, v in enumerate(header_vals) if 'credit' in v), 11)
                    data_df = df.iloc[idx+1:].reset_index(drop=True)
                    for _, row in data_df.iterrows():
                        vals = [v for v in row.values]
                        ref_val = str(vals[ref_col]) if pd.notna(vals[ref_col]) else ''
                        if not ref_val or ref_val == 'nan' or len(ref_val) < 3: continue
                        desc = str(vals[desc_col]) if pd.notna(vals[desc_col]) else ''
                        details = str(vals[detail_col]) if pd.notna(vals[detail_col]) else ''
                        full_desc = f"{desc} - {details}" if details and details != 'nan' else desc
                        debit = 0
                        deb_str = str(vals[deb_col]).replace(',','').replace('(','').replace(')','').strip() if pd.notna(vals[deb_col]) else ''
                        try: debit = abs(float(deb_str))
                        except: pass
                        credit = 0
                        cred_str = str(vals[cred_col]).replace(',','').strip() if pd.notna(vals[cred_col]) else ''
                        try: credit = abs(float(cred_str))
                        except: pass
                        balance = 0
                        bal_str = str(vals[bal_col]).replace(',','').strip() if pd.notna(vals[bal_col]) else ''
                        try: balance = float(bal_str)
                        except: pass
                        date_str = ''
                        for c in range(len(vals)-1, -1, -1):
                            if pd.notna(vals[c]):
                                ds = str(vals[c]).strip()
                                if '/' in ds and len(ds) >= 8 and ds[0].isdigit():
                                    date_str = ds; break
                        if debit > 0 or credit > 0:
                            txn = {"date": date_str, "description": full_desc[:200], "debit": debit, "credit": credit, "balance": balance, "reference": ref_val}
                            desc_lower = desc.lower()
                            details_str = details if details != 'nan' else ''
                            ben_match = re.search(r'Ben\s+(.+?)$', details_str)
                            if ben_match: txn["beneficiary"] = ben_match.group(1).strip()[:60]
                            if not txn.get("beneficiary"):
                                hash_parts = [p.strip() for p in details_str.split('#') if p.strip() and len(p.strip()) > 2]
                                for hp in hash_parts:
                                    if not re.match(r'^[\d/\s]+$', hp) and not hp.startswith('/SA') and hp != 'CIF':
                                        txn["beneficiary"] = hp[:60]; break
                            bill_match = re.match(r'(.+?)\s*BILL#(\d+)', details_str)
                            if bill_match:
                                txn["beneficiary"] = bill_match.group(1).strip()[:60]
                                txn["bill_number"] = bill_match.group(2)
                            iqama_match = re.match(r'Renew Iqama REF\s+[\d-]+(.+?)$', details_str)
                            if iqama_match:
                                txn["beneficiary"] = iqama_match.group(1).strip()[:60]
                                txn["sub_category"] = "iqama_renewal"
                            trm_match = re.search(r'(SPAN|VISA|MASTER)\s*TRM\s*(\d+)', details_str, re.IGNORECASE)
                            if trm_match:
                                txn["machine_id"] = trm_match.group(2)
                                card = trm_match.group(1).upper()
                                txn["card_type"] = "mada" if card == "SPAN" else "visa" if card == "VISA" else "mastercard"
                            elif not trm_match:
                                trm_match2 = re.search(r'TRM\s*(\d+)', details_str)
                                if trm_match2: txn["machine_id"] = trm_match2.group(1)
                            if 'recon-credit' in desc_lower:
                                txn["category"] = "pos_sales"
                                if 'SPAN' in details_str.upper(): txn["card_type"] = "mada"
                                elif 'VISA' in details_str.upper(): txn["card_type"] = "visa"
                                elif 'MASTER' in details_str.upper(): txn["card_type"] = "mastercard"
                            elif 'span transaction' in desc_lower: txn["category"] = "pos_fees"; txn["card_type"] = "mada"
                            elif 'visa transaction' in desc_lower: txn["category"] = "pos_fees"; txn["card_type"] = "visa"
                            elif 'master card transaction' in desc_lower or 'master card' in desc_lower: txn["category"] = "pos_fees"; txn["card_type"] = "mastercard"
                            elif 'up transaction' in desc_lower: txn["category"] = "pos_fees"; txn["card_type"] = "unionpay"
                            elif desc_lower == 'vat': txn["category"] = "vat_fees"
                            elif 'sarie outgoing' in desc_lower: txn["category"] = "outgoing_transfer"
                            elif 'incoming sarie' in desc_lower: txn["category"] = "incoming_transfer"
                            elif 'sadad bill' in desc_lower:
                                if 'renew iqama' in details_str.lower(): txn["category"] = "iqama_renewal"
                                elif 'hrsd' in details_str.upper(): txn["category"] = "sadad_payment"; txn["beneficiary"] = "HRSD (Human Resources)"
                                else: txn["category"] = "sadad_payment"
                            elif 'sadad refund' in desc_lower or 'BAB#' in details_str: txn["category"] = "sadad_refund"
                            elif 'account to account' in desc_lower: txn["category"] = "internal_transfer"
                            elif 'sarie charge' in desc_lower: txn["category"] = "bank_fees"
                            elif 'pos.fee' in desc_lower:
                                txn["category"] = "bank_fees"
                                fee_machine = re.search(r'Monthly Fees\s*(\d+)', details_str)
                                if fee_machine: txn["machine_id"] = fee_machine.group(1)
                            else: txn["category"] = "other"
                            transactions.append(txn)
                    break
            if not transactions:
                df.columns = [str(c).lower().strip() for c in df.columns]
                for _, row in df.iterrows():
                    r = {str(k): str(v) if pd.notna(v) else '' for k, v in row.items()}
                    date = r.get('date', r.get('transaction date', r.get('value date', '')))
                    desc = r.get('description', r.get('details', r.get('narrative', r.get('particulars', ''))))
                    debit = 0; credit = 0; balance = 0
                    for k, v in r.items():
                        try:
                            num = float(str(v).replace(',', ''))
                            if 'debit' in k or 'withdrawal' in k: debit = abs(num)
                            elif 'credit' in k or 'deposit' in k: credit = num
                            elif 'balance' in k: balance = num
                            elif 'amount' in k:
                                if num < 0: debit = abs(num)
                                else: credit = num
                        except: pass
                    if (debit > 0 or credit > 0) and date:
                        transactions.append({"date": str(date)[:10], "description": str(desc)[:200], "debit": debit, "credit": credit, "balance": balance})
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Cannot parse file: {str(e)}")
    if not transactions:
        raise HTTPException(status_code=400, detail="No transactions found in file. Try Excel format.")
    # Categorize uncategorized transactions
    for t in transactions:
        if t.get("category"): continue
        desc = t.get("description", "")
        desc_upper = desc.upper()
        iban_match = re.search(r'IBAN[:\s]*([A-Z]{2}\d{20,24})', desc_upper)
        t["iban"] = iban_match.group(1) if iban_match else None
        names = re.findall(r'#([^#]+?)(?:\s+in\s+|$)', desc)
        if not names: names = re.findall(r'#(.+?)(?:\s+in\s+|\s+Value|\s+with|$)', desc)
        t["beneficiary"] = names[0].strip()[:60] if names else None
        if 'INCOMING SARIE' in desc_upper:
            from_match = re.search(r'from\s+([A-Z\s]+?(?:ARABIA|LLC|COMPANY|CO\.|BANK|EST\.)?)(?:\s+#|\s+through|\s+$)', desc, re.IGNORECASE)
            if not from_match: from_match = re.search(r'\bfrom\s+([A-Z][A-Z\s]{3,}?)(?:\s{2,}|\s+#|\s+at\s+|\s+Value)', desc)
            if not from_match:
                all_froms = re.findall(r'from\s+([A-Z][A-Za-z\s]+?)(?:\s{2,}|$|through)', desc)
                if all_froms:
                    name = all_froms[-1].strip()
                    if len(name) > 3 and name.upper() not in ['ALINMA BANK', 'ALINMA HEAD OFFICE']: t["beneficiary"] = name[:60]
            elif from_match:
                name = from_match.group(1).strip()
                if len(name) > 3 and name.upper() not in ['ALINMA BANK', 'ALINMA HEAD OFFICE']: t["beneficiary"] = name[:60]
        sarie_ben = re.match(r'Sarie Ben\.\s*Customer#(\d+)', desc)
        if sarie_ben:
            t["beneficiary"] = f"Internal Transfer #{sarie_ben.group(1)}"
            t["category"] = "internal_transfer" if not t.get("category") else t.get("category")
        bank_match = re.search(r'in\s+([\w\s]+Bank|AlRajhi\s+Bank|Saudi\s+National\s+Bank)', desc, re.IGNORECASE)
        t["bank"] = bank_match.group(1).strip() if bank_match else None
        fee_match = re.search(r'Fees?\s*SAR\s*([\d.]+)', desc, re.IGNORECASE)
        vat_match = re.search(r'VAT\s*SAR\s*([\d.]+)', desc, re.IGNORECASE)
        t["transfer_fee"] = float(fee_match.group(1)) if fee_match else 0
        t["transfer_vat"] = float(vat_match.group(1)) if vat_match else 0
        if 'INTERNAL TRANSFER' in desc_upper:
            int_name = re.search(r'from\s+(.+?)\s*(?:value|\.|\s+Reference)', desc, re.IGNORECASE)
            if int_name:
                name_part = int_name.group(1).strip()
                name_part = re.sub(r'(?:Alinma-\s*)?ALINMA\s+Head\s+Office\s+from\s+', '', name_part, flags=re.IGNORECASE).strip()
                if name_part: t["beneficiary"] = name_part[:60]
        sadad_match = re.match(r'(\d{3})\s*-\s*(.+?)\s+Bill\s+(\d+)', desc)
        if sadad_match:
            t["beneficiary"] = sadad_match.group(2).strip()[:60]
            t["sadad_code"] = sadad_match.group(1)
        if 'Payroll Project' in desc or ('###' in desc and 'Customer' not in desc and '\u0627\u0644\u0627\u0633\u062a\u062d\u0642\u0627\u0642' not in desc):
            t["beneficiary"] = "Payroll Fee"; t["category"] = "bank_fees"; continue
        sarie_ben = re.match(r'Sarie Ben\.\s*Customer#(\d+)', desc)
        if sarie_ben: t["beneficiary"] = f"Internal Transfer #{sarie_ben.group(1)}"
        if any(k in desc_upper for k in ['SFEEMRC', 'BFEEMRC', 'VFEEMRC', 'FEE FOR', 'VAT OF FEE']):
            t["category"] = "vat_fees" if ('VAT' in desc_upper or 'VFEE' in desc_upper or 'BFEE' in desc_upper) else "bank_fees"
        elif any(k in desc_upper for k in ['SPANMRC', 'VISAMRC', 'BNETMRC', '\u0627\u0644\u0627\u0633\u062a\u062d\u0642\u0627\u0642']) and 'FEE' not in desc_upper:
            t["category"] = "pos_sales"
        elif any(k in desc_upper for k in ['OUTGOING SARIE', 'SARIE OUTGOING']): t["category"] = "outgoing_transfer"
        elif any(k in desc_upper for k in ['INCOMING SARIE', 'SARIE INCOMING', 'INCOMING']): t["category"] = "incoming_transfer"
        elif 'INTERNAL TRANSFER' in desc_upper or (sarie_ben is not None): t["category"] = "internal_transfer"
        elif sadad_match: t["category"] = "sadad_payment"
        elif any(k in desc_upper for k in ['SALARY', 'SAL']): t["category"] = "salary"
        elif 'CHARGE' in desc_upper: t["category"] = "bank_fees"
        else: t["category"] = "other"
        machine = re.search(r'(\d{16})', desc)
        t["machine_id"] = machine.group(1) if machine else None
    statement = {
        "id": str(uuid.uuid4()), "file_name": file.filename, "bank_name": bank_name or "Unknown",
        "branch_id": branch_id if branch_id else None,
        "period": f"{transactions[0]['date']} - {transactions[-1]['date']}" if transactions else "",
        "total_credit": sum(t["credit"] for t in transactions),
        "total_debit": sum(t["debit"] for t in transactions),
        "transaction_count": len(transactions), "transactions": transactions,
        "created_at": datetime.now(timezone.utc).isoformat(), "created_by": current_user.id
    }
    await db.bank_statements.insert_one(statement)
    cats = {}; machines = {}
    for t in transactions:
        cat = t["category"]
        cats[cat] = cats.get(cat, {"count": 0, "debit": 0, "credit": 0})
        cats[cat]["count"] += 1; cats[cat]["debit"] += t["debit"]; cats[cat]["credit"] += t["credit"]
        if t.get("machine_id"):
            mid = t["machine_id"]
            machines[mid] = machines.get(mid, {"count": 0, "total": 0})
            machines[mid]["count"] += 1; machines[mid]["total"] += t["credit"]
    return {"id": statement["id"], "file_name": file.filename, "transactions_parsed": len(transactions),
            "total_credit": statement["total_credit"], "total_debit": statement["total_debit"],
            "net": statement["total_credit"] - statement["total_debit"], "categories": cats, "pos_machines": machines}

@router.get("/bank-statements")
async def get_bank_statements(current_user: User = Depends(get_current_user)):
    return await db.bank_statements.find({}, {"_id": 0, "transactions": 0}).sort("created_at", -1).to_list(100)

@router.get("/bank-statements/{stmt_id}")
async def get_bank_statement_detail(stmt_id: str, current_user: User = Depends(get_current_user)):
    stmt = await db.bank_statements.find_one({"id": stmt_id}, {"_id": 0})
    if not stmt: raise HTTPException(status_code=404, detail="Not found")
    txns = stmt.get("transactions", [])
    cats = {}; machines = {}; daily = {}
    for t in txns:
        cat = t.get("category", "other")
        cats[cat] = cats.get(cat, {"count": 0, "debit": 0, "credit": 0})
        cats[cat]["count"] += 1; cats[cat]["debit"] += t.get("debit", 0); cats[cat]["credit"] += t.get("credit", 0)
        if t.get("machine_id"):
            mid = t["machine_id"]
            machines[mid] = machines.get(mid, {"count": 0, "total": 0})
            machines[mid]["count"] += 1; machines[mid]["total"] += t.get("credit", 0)
        d = t.get("date", "")[:10]
        daily[d] = daily.get(d, {"credit": 0, "debit": 0})
        daily[d]["credit"] += t.get("credit", 0); daily[d]["debit"] += t.get("debit", 0)
    stmt["categories"] = cats; stmt["pos_machines"] = machines
    stmt["daily_summary"] = [{"date": k, **v} for k, v in sorted(daily.items())]
    return stmt

@router.delete("/bank-statements/{stmt_id}")
async def delete_bank_statement(stmt_id: str, current_user: User = Depends(get_current_user)):
    await db.bank_statements.delete_one({"id": stmt_id})
    return {"message": "Statement deleted"}

# POS Machine Mapping
@router.get("/pos-machines")
async def get_pos_machines(current_user: User = Depends(get_current_user)):
    return await db.pos_machines.find({}, {"_id": 0}).to_list(100)

@router.post("/pos-machines")
async def save_pos_machine(body: dict, current_user: User = Depends(get_current_user)):
    machine_id = body.get("machine_id", ""); branch_id = body.get("branch_id", ""); label = body.get("label", "")
    existing = await db.pos_machines.find_one({"machine_id": machine_id})
    if existing:
        await db.pos_machines.update_one({"machine_id": machine_id}, {"$set": {"branch_id": branch_id, "label": label}})
    else:
        await db.pos_machines.insert_one({"id": str(uuid.uuid4()), "machine_id": machine_id, "branch_id": branch_id, "label": label})
    return {"message": "POS machine mapped"}

@router.delete("/pos-machines/{machine_id}")
async def delete_pos_machine(machine_id: str, current_user: User = Depends(get_current_user)):
    await db.pos_machines.delete_one({"machine_id": machine_id})
    return {"message": "Deleted"}

# Statement Analysis
@router.get("/bank-statements/{stmt_id}/analysis")
async def analyze_statement(stmt_id: str, current_user: User = Depends(get_current_user)):
    stmt = await db.bank_statements.find_one({"id": stmt_id}, {"_id": 0})
    if not stmt: raise HTTPException(status_code=404, detail="Not found")
    txns = stmt.get("transactions", [])
    pos_mappings = {m["machine_id"]: m for m in await db.pos_machines.find({}, {"_id": 0}).to_list(100)}
    branches = {b["id"]: b["name"] for b in await db.branches.find({}, {"_id": 0}).to_list(100)}
    suppliers = await db.suppliers.find({}, {"_id": 0}).to_list(1000)
    raw_senders = {}
    for t in txns:
        cat = t.get("category", ""); mid = t.get("machine_id")
        if mid and cat in ("pos_sales", "pos_fees", "bank_fees", "vat_fees"):
            key = f"POS Machine {mid}"
            if key not in raw_senders:
                raw_senders[key] = {"count": 0, "total_credit": 0, "total_debit": 0, "first_date": t.get("date",""), "last_date": t.get("date",""), "ibans": set(), "banks": set(), "fees": 0, "vat": 0, "is_pos": True}
            raw_senders[key]["count"] += 1; raw_senders[key]["total_credit"] += t.get("credit", 0); raw_senders[key]["total_debit"] += t.get("debit", 0); raw_senders[key]["last_date"] = t.get("date", "")
            continue
        key = t.get("beneficiary") or ""
        if not key or len(key) < 3:
            desc = t.get("description", "").strip()
            if not desc or desc.upper() == 'NAN' or len(desc) < 3: continue
            clean = re.sub(r'\d{10,}', '', desc); clean = re.sub(r'\d{2}/\d{2}/\d{4}', '', clean)
            parts = [p.strip() for p in re.split(r'[-/|,]', clean) if len(p.strip()) > 2]
            key = parts[0].strip()[:50] if parts else clean[:50].strip()
        key = re.sub(r'\s+', ' ', key).strip()
        if len(key) < 3: continue
        if key not in raw_senders:
            raw_senders[key] = {"count": 0, "total_credit": 0, "total_debit": 0, "first_date": t.get("date",""), "last_date": t.get("date",""), "ibans": set(), "banks": set(), "fees": 0, "vat": 0}
        raw_senders[key]["count"] += 1; raw_senders[key]["total_credit"] += t.get("credit", 0); raw_senders[key]["total_debit"] += t.get("debit", 0)
        raw_senders[key]["last_date"] = t.get("date", ""); raw_senders[key]["fees"] += t.get("transfer_fee", 0); raw_senders[key]["vat"] += t.get("transfer_vat", 0)
        if t.get("iban"): raw_senders[key]["ibans"].add(t["iban"])
        if t.get("bank"): raw_senders[key]["banks"].add(t["bank"])
    sender_list = [{"name": k, "count": v["count"], "total_credit": v["total_credit"], "total_debit": v["total_debit"], "first_date": v["first_date"], "last_date": v["last_date"], "net": v["total_credit"] - v["total_debit"], "iban": list(v["ibans"])[:2], "bank": list(v["banks"])[:1], "fees": v["fees"], "vat": v["vat"]} for k, v in raw_senders.items()]
    sender_list.sort(key=lambda x: x["total_credit"] + x["total_debit"], reverse=True)
    pos_by_machine = {}
    for t in txns:
        mid = t.get("machine_id")
        if not mid: continue
        if mid not in pos_by_machine:
            mapping = pos_mappings.get(mid, {})
            bname = branches.get(mapping.get("branch_id", ""), mapping.get("label", "Unmapped"))
            pos_by_machine[mid] = {"branch": bname, "sales_count": 0, "sales_total": 0, "fees": 0, "vat": 0, "net": 0, "mada": 0, "visa": 0, "mastercard": 0, "mada_fee": 0, "visa_fee": 0, "mc_fee": 0}
        cat = t.get("category", ""); desc_upper = t.get("description", "").upper(); card_type = t.get("card_type", "")
        if cat == "pos_sales":
            pos_by_machine[mid]["sales_count"] += 1; pos_by_machine[mid]["sales_total"] += t.get("credit", 0)
            if card_type == "mada" or "SPANMRC" in desc_upper: pos_by_machine[mid]["mada"] += t.get("credit", 0)
            elif card_type == "visa" or "VISAMRC" in desc_upper: pos_by_machine[mid]["visa"] += t.get("credit", 0)
            elif card_type == "mastercard" or "BNETMRC" in desc_upper: pos_by_machine[mid]["mastercard"] += t.get("credit", 0)
        elif cat in ("bank_fees", "vat_fees", "pos_fees"):
            fee_type = "fees" if cat != "vat_fees" else "vat"
            pos_by_machine[mid][fee_type] += t.get("debit", 0)
            if card_type == "mada" or "SFEEMRC" in desc_upper: pos_by_machine[mid]["mada_fee"] += t.get("debit", 0)
            elif card_type == "visa" or "VFEEMRC" in desc_upper: pos_by_machine[mid]["visa_fee"] += t.get("debit", 0)
            elif card_type == "mastercard" or "BFEEMRC" in desc_upper: pos_by_machine[mid]["mc_fee"] += t.get("debit", 0)
    for mid, data in pos_by_machine.items(): data["net"] = data["sales_total"] - data["fees"] - data["vat"]
    pos_by_branch = {}
    for mid, data in pos_by_machine.items():
        bname = data["branch"]
        if bname not in pos_by_branch: pos_by_branch[bname] = {"count": 0, "total": 0, "fees": 0, "vat": 0, "machines": []}
        pos_by_branch[bname]["count"] += data["sales_count"]; pos_by_branch[bname]["total"] += data["sales_total"]
        pos_by_branch[bname]["fees"] += data["fees"]; pos_by_branch[bname]["vat"] += data["vat"]; pos_by_branch[bname]["machines"].append(mid)
    system_sales = await db.sales.find({}, {"_id": 0}).to_list(10000)
    sys_by_branch = {}
    for s in system_sales:
        bid = s.get("branch_id", ""); bname = branches.get(bid, "Unknown")
        bank_amt = sum(p["amount"] for p in s.get("payment_details", []) if p.get("mode") == "bank")
        if bank_amt > 0: sys_by_branch[bname] = sys_by_branch.get(bname, 0) + bank_amt
    mismatches = []
    for bname, pos_data in pos_by_branch.items():
        sys_amt = sys_by_branch.get(bname, 0); diff = pos_data["total"] - sys_amt
        if abs(diff) > 1: mismatches.append({"branch": bname, "bank_amount": pos_data["total"], "system_amount": sys_amt, "difference": diff})
    supplier_matches = []
    for t in txns:
        desc = t.get("description", ""); desc_upper = desc.upper()
        for sup in suppliers:
            if sup.get("account_number") and sup["account_number"] in desc:
                supplier_matches.append({"transaction": desc[:80], "amount": t.get("debit",0) or t.get("credit",0), "type": "credit" if t.get("credit",0) > 0 else "debit", "supplier": sup["name"], "supplier_id": sup["id"], "date": t.get("date",""), "match_type": "account"}); break
            if t.get("debit", 0) > 0 and sup["name"].upper() in desc_upper:
                supplier_matches.append({"transaction": desc[:80], "amount": t["debit"], "type": "debit", "supplier": sup["name"], "supplier_id": sup["id"], "date": t.get("date",""), "match_type": "name"}); break
    sup_summary = {}
    for m in supplier_matches:
        key = m["supplier"]
        if key not in sup_summary: sup_summary[key] = {"count": 0, "total": 0, "first_date": m["date"], "last_date": m["date"], "match_type": m["match_type"]}
        sup_summary[key]["count"] += 1; sup_summary[key]["total"] += m["amount"]; sup_summary[key]["last_date"] = m["date"]
    return {"senders": sender_list[:80], "pos_by_branch": pos_by_branch, "pos_by_machine": pos_by_machine, "mismatches": mismatches, "supplier_matches": supplier_matches[:50],
            "supplier_summary": [{"name": k, **v} for k, v in sorted(sup_summary.items(), key=lambda x: -x[1]["total"])],
            "total_bank_fees": sum(t.get("debit",0) for t in txns if t.get("category") == "bank_fees"),
            "total_pos_sales": sum(t.get("credit",0) for t in txns if t.get("category") == "pos_sales")}

# POS Reconciliation
@router.get("/bank-statements/{stmt_id}/reconciliation")
async def get_pos_reconciliation(stmt_id: str, current_user: User = Depends(get_current_user)):
    stmt = await db.bank_statements.find_one({"id": stmt_id}, {"_id": 0})
    if not stmt: raise HTTPException(status_code=404, detail="Statement not found")
    txns = stmt.get("transactions", [])
    branches_list = await db.branches.find({}, {"_id": 0}).to_list(100)
    branch_map = {b["id"]: b["name"] for b in branches_list}
    pos_mappings = {m["machine_id"]: m for m in await db.pos_machines.find({}, {"_id": 0}).to_list(100)}
    bank_pos_by_date = {}
    for t in txns:
        if t.get("category") != "pos_sales": continue
        date_str = t.get("date", "")[:10]
        if not date_str: continue
        mid = t.get("machine_id", ""); mapping = pos_mappings.get(mid, {})
        branch_name = branch_map.get(mapping.get("branch_id", ""), "Unmapped")
        key = f"{date_str}|{branch_name}"
        if key not in bank_pos_by_date: bank_pos_by_date[key] = {"date": date_str, "branch": branch_name, "bank_amount": 0, "txn_count": 0, "machines": set()}
        bank_pos_by_date[key]["bank_amount"] += t.get("credit", 0); bank_pos_by_date[key]["txn_count"] += 1
        if mid: bank_pos_by_date[key]["machines"].add(mid)
    all_sales = await db.sales.find({}, {"_id": 0}).to_list(50000)
    app_sales_by_date = {}
    for s in all_sales:
        bid = s.get("branch_id", ""); bname = branch_map.get(bid, "Unknown")
        bank_amt = sum(p["amount"] for p in s.get("payment_details", []) if p.get("mode") == "bank")
        if bank_amt <= 0: continue
        sale_date = s.get("date", "")[:10]
        if not sale_date: continue
        try:
            sale_dt = datetime.fromisoformat(sale_date)
            deposit_date = (sale_dt + timedelta(days=1)).strftime("%Y-%m-%d")
        except: deposit_date = sale_date
        key = f"{deposit_date}|{bname}"
        if key not in app_sales_by_date: app_sales_by_date[key] = {"date": deposit_date, "sale_date": sale_date, "branch": bname, "app_amount": 0, "sale_count": 0}
        app_sales_by_date[key]["app_amount"] += bank_amt; app_sales_by_date[key]["sale_count"] += 1
    all_keys = set(list(bank_pos_by_date.keys()) + list(app_sales_by_date.keys()))
    rows = []; total_bank = 0; total_app = 0; matched_count = 0; discrepancy_count = 0
    for key in sorted(all_keys):
        bank_data = bank_pos_by_date.get(key); app_data = app_sales_by_date.get(key)
        bank_amt = bank_data["bank_amount"] if bank_data else 0; app_amt = app_data["app_amount"] if app_data else 0
        diff = bank_amt - app_amt; date_str = key.split("|")[0]; branch = key.split("|")[1] if "|" in key else ""
        status = "matched" if abs(diff) < 1 else ("bank_only" if app_amt == 0 else ("app_only" if bank_amt == 0 else "mismatch"))
        if status == "matched": matched_count += 1
        else: discrepancy_count += 1
        total_bank += bank_amt; total_app += app_amt
        rows.append({"deposit_date": date_str, "sale_date": app_data["sale_date"] if app_data else "", "branch": branch, "bank_amount": round(bank_amt, 2), "app_amount": round(app_amt, 2), "difference": round(diff, 2), "status": status, "bank_txns": bank_data["txn_count"] if bank_data else 0, "app_sales": app_data["sale_count"] if app_data else 0, "machines": list(bank_data["machines"]) if bank_data else []})
    return {"rows": rows, "summary": {"total_bank_pos": round(total_bank, 2), "total_app_sales": round(total_app, 2), "total_difference": round(total_bank - total_app, 2), "matched_count": matched_count, "discrepancy_count": discrepancy_count, "total_rows": len(rows)}}


# Manual reconciliation flags
@router.post("/bank-statements/{stmt_id}/reconciliation/flag")
async def flag_reconciliation_row(stmt_id: str, body: dict, current_user: User = Depends(get_current_user)):
    row_key = body.get("row_key", "")
    flag = body.get("flag", "")
    notes = body.get("notes", "")
    await db.reconciliation_flags.update_one(
        {"statement_id": stmt_id, "row_key": row_key},
        {"$set": {"flag": flag, "notes": notes, "updated_by": current_user.id, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"message": "Flag saved"}

@router.get("/bank-statements/{stmt_id}/reconciliation/flags")
async def get_reconciliation_flags(stmt_id: str, current_user: User = Depends(get_current_user)):
    flags = await db.reconciliation_flags.find({"statement_id": stmt_id}, {"_id": 0}).to_list(10000)
    return {f["row_key"]: {"flag": f["flag"], "notes": f.get("notes", "")} for f in flags}


# =====================================================
# AUTO-MATCHING ENGINE
# =====================================================

@router.post("/bank-statements/{stmt_id}/auto-match")
async def auto_match_transactions(stmt_id: str, tolerance: float = 1.0, date_range: int = 2, current_user: User = Depends(get_current_user)):
    """Smart auto-matching of bank transactions to system records."""
    stmt = await db.bank_statements.find_one({"id": stmt_id}, {"_id": 0})
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")

    txns = stmt.get("transactions", [])
    existing_matches = await db.auto_matches.find({"statement_id": stmt_id}, {"_id": 0}).to_list(50000)
    matched_txn_indices = {m["txn_index"] for m in existing_matches}

    # Load system records
    sales = await db.sales.find({}, {"_id": 0}).to_list(50000)
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(20000)
    supplier_payments = await db.supplier_payments.find({}, {"_id": 0}).to_list(20000)
    suppliers = {s["id"]: s["name"] for s in await db.suppliers.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(1000)}

    def parse_date(d):
        if not d:
            return None
        for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y", "%Y/%m/%d"):
            try:
                return datetime.strptime(d[:10], fmt).date()
            except:
                pass
        return None

    matched = []
    unmatched = []
    stats = {"total_txns": len(txns), "auto_matched": 0, "already_matched": len(matched_txn_indices), "unmatched": 0}

    for idx, txn in enumerate(txns):
        if idx in matched_txn_indices:
            continue

        # Skip internal/fee transactions
        cat = txn.get("category", "")
        if cat in ("bank_fees", "vat_fees", "pos_fees"):
            continue

        txn_amount = txn.get("credit", 0) or txn.get("debit", 0)
        if txn_amount == 0:
            continue

        txn_date = parse_date(txn.get("date", ""))
        is_credit = txn.get("credit", 0) > 0

        best_match = None
        best_score = 0

        # Try matching against sales (credits)
        if is_credit:
            for s in sales:
                sale_amt = s.get("final_amount", s.get("amount", 0) - s.get("discount", 0))
                # Check bank payment component
                bank_amt = sum(p["amount"] for p in s.get("payment_details", []) if p.get("mode") == "bank")
                check_amt = bank_amt if bank_amt > 0 else sale_amt

                if abs(check_amt - txn_amount) <= tolerance:
                    sale_date = parse_date(s.get("date", ""))
                    date_diff = abs((txn_date - sale_date).days) if txn_date and sale_date else 99
                    if date_diff <= date_range:
                        score = 100 - (date_diff * 10) - (abs(check_amt - txn_amount) * 5)
                        if score > best_score:
                            best_score = score
                            best_match = {"type": "sale", "id": s["id"], "amount": check_amt, "date": s.get("date", "")[:10], "desc": s.get("description", "")[:50] or f"Sale #{s['id'][:8]}", "score": round(score)}

        # Try matching against expenses (debits)
        if not is_credit:
            for e in expenses:
                if abs(e["amount"] - txn_amount) <= tolerance:
                    exp_date = parse_date(e.get("date", ""))
                    date_diff = abs((txn_date - exp_date).days) if txn_date and exp_date else 99
                    if date_diff <= date_range:
                        score = 100 - (date_diff * 10) - (abs(e["amount"] - txn_amount) * 5)
                        if score > best_score:
                            best_score = score
                            best_match = {"type": "expense", "id": e["id"], "amount": e["amount"], "date": e.get("date", "")[:10], "desc": e.get("description", "")[:50] or e.get("category", "Expense"), "score": round(score)}

            # Try supplier payments
            for sp in supplier_payments:
                if abs(sp["amount"] - txn_amount) <= tolerance:
                    sp_date = parse_date(sp.get("date", ""))
                    date_diff = abs((txn_date - sp_date).days) if txn_date and sp_date else 99
                    if date_diff <= date_range:
                        score = 100 - (date_diff * 10) - (abs(sp["amount"] - txn_amount) * 5)
                        sup_name = suppliers.get(sp.get("supplier_id", ""), "")
                        # Boost score if supplier name appears in description
                        if sup_name and sup_name.upper() in txn.get("description", "").upper():
                            score += 20
                        if score > best_score:
                            best_score = score
                            best_match = {"type": "supplier_payment", "id": sp["id"], "amount": sp["amount"], "date": sp.get("date", "")[:10], "desc": f"To {sup_name}" if sup_name else sp.get("description", "")[:50], "score": round(score)}

        if best_match and best_score >= 60:
            match_record = {
                "id": str(uuid.uuid4()),
                "statement_id": stmt_id,
                "txn_index": idx,
                "txn_date": txn.get("date", ""),
                "txn_amount": txn_amount,
                "txn_desc": txn.get("description", "")[:100],
                "match_type": best_match["type"],
                "match_id": best_match["id"],
                "match_amount": best_match["amount"],
                "match_date": best_match["date"],
                "match_desc": best_match["desc"],
                "confidence": best_match["score"],
                "status": "auto",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.auto_matches.insert_one(match_record)
            del match_record["_id"]
            matched.append(match_record)
            stats["auto_matched"] += 1
        else:
            unmatched.append({
                "index": idx,
                "date": txn.get("date", ""),
                "amount": txn_amount,
                "type": "credit" if is_credit else "debit",
                "description": txn.get("description", "")[:100],
                "best_score": best_score if best_match else 0
            })
            stats["unmatched"] += 1

    return {"matched": matched, "unmatched": unmatched[:50], "stats": stats}


@router.get("/bank-statements/{stmt_id}/matches")
async def get_auto_matches(stmt_id: str, current_user: User = Depends(get_current_user)):
    """Get all auto-matched transactions for a statement."""
    matches = await db.auto_matches.find({"statement_id": stmt_id}, {"_id": 0}).to_list(50000)
    return matches


@router.post("/bank-statements/{stmt_id}/matches/{match_id}/confirm")
async def confirm_match(stmt_id: str, match_id: str, current_user: User = Depends(get_current_user)):
    """Confirm an auto-match."""
    result = await db.auto_matches.update_one(
        {"id": match_id, "statement_id": stmt_id},
        {"$set": {"status": "confirmed", "confirmed_by": current_user.id, "confirmed_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Match not found")
    return {"message": "Match confirmed"}


@router.delete("/bank-statements/{stmt_id}/matches/{match_id}")
async def reject_match(stmt_id: str, match_id: str, current_user: User = Depends(get_current_user)):
    """Reject/delete an auto-match."""
    await db.auto_matches.delete_one({"id": match_id, "statement_id": stmt_id})
    return {"message": "Match rejected"}


# =====================================================
# UNMATCHED TRANSACTIONS WITH SUGGESTIONS
# =====================================================

@router.get("/bank-statements/{stmt_id}/unmatched")
async def get_unmatched_transactions(stmt_id: str, current_user: User = Depends(get_current_user)):
    """Get unmatched bank transactions with best match suggestions."""
    stmt = await db.bank_statements.find_one({"id": stmt_id}, {"_id": 0})
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")

    txns = stmt.get("transactions", [])
    existing_matches = await db.auto_matches.find({"statement_id": stmt_id}, {"_id": 0}).to_list(50000)
    matched_indices = {m["txn_index"] for m in existing_matches}

    sales = await db.sales.find({}, {"_id": 0}).to_list(50000)
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(20000)
    supplier_payments = await db.supplier_payments.find({}, {"_id": 0}).to_list(20000)
    suppliers = {s["id"]: s["name"] for s in await db.suppliers.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(1000)}

    def parse_date(d):
        if not d:
            return None
        for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y", "%Y/%m/%d"):
            try:
                return datetime.strptime(d[:10], fmt).date()
            except:
                pass
        return None

    unmatched = []
    for idx, txn in enumerate(txns):
        if idx in matched_indices:
            continue
        cat = txn.get("category", "")
        if cat in ("bank_fees", "vat_fees", "pos_fees"):
            continue
        txn_amount = txn.get("credit", 0) or txn.get("debit", 0)
        if txn_amount == 0:
            continue

        txn_date = parse_date(txn.get("date", ""))
        is_credit = txn.get("credit", 0) > 0

        # Find top 3 suggestions
        suggestions = []
        if is_credit:
            for s in sales:
                bank_amt = sum(p["amount"] for p in s.get("payment_details", []) if p.get("mode") == "bank")
                check_amt = bank_amt if bank_amt > 0 else s.get("final_amount", s.get("amount", 0))
                amt_diff = abs(check_amt - txn_amount)
                if amt_diff <= max(txn_amount * 0.15, 50):
                    sale_date = parse_date(s.get("date", ""))
                    date_diff = abs((txn_date - sale_date).days) if txn_date and sale_date else 99
                    score = max(0, 100 - (date_diff * 8) - (amt_diff / max(txn_amount, 1) * 100))
                    tier = "exact" if score >= 90 else "probable" if score >= 65 else "possible"
                    suggestions.append({"type": "sale", "id": s["id"], "amount": check_amt, "date": s.get("date", "")[:10], "desc": s.get("description", "")[:60] or f"Sale #{s['id'][:8]}", "score": round(score), "tier": tier, "amt_diff": round(amt_diff, 2)})
        else:
            for e in expenses:
                amt_diff = abs(e["amount"] - txn_amount)
                if amt_diff <= max(txn_amount * 0.15, 50):
                    exp_date = parse_date(e.get("date", ""))
                    date_diff = abs((txn_date - exp_date).days) if txn_date and exp_date else 99
                    score = max(0, 100 - (date_diff * 8) - (amt_diff / max(txn_amount, 1) * 100))
                    tier = "exact" if score >= 90 else "probable" if score >= 65 else "possible"
                    suggestions.append({"type": "expense", "id": e["id"], "amount": e["amount"], "date": e.get("date", "")[:10], "desc": e.get("description", "")[:60] or e.get("category", "Expense"), "score": round(score), "tier": tier, "amt_diff": round(amt_diff, 2)})
            for sp in supplier_payments:
                amt_diff = abs(sp["amount"] - txn_amount)
                if amt_diff <= max(txn_amount * 0.15, 50):
                    sp_date = parse_date(sp.get("date", ""))
                    date_diff = abs((txn_date - sp_date).days) if txn_date and sp_date else 99
                    score = max(0, 100 - (date_diff * 8) - (amt_diff / max(txn_amount, 1) * 100))
                    sup_name = suppliers.get(sp.get("supplier_id", ""), "")
                    if sup_name and sup_name.upper() in txn.get("description", "").upper():
                        score = min(score + 20, 100)
                    tier = "exact" if score >= 90 else "probable" if score >= 65 else "possible"
                    suggestions.append({"type": "supplier_payment", "id": sp["id"], "amount": sp["amount"], "date": sp.get("date", "")[:10], "desc": f"To {sup_name}" if sup_name else sp.get("description", "")[:60], "score": round(score), "tier": tier, "amt_diff": round(amt_diff, 2)})

        suggestions.sort(key=lambda x: -x["score"])
        unmatched.append({
            "index": idx,
            "date": txn.get("date", ""),
            "amount": txn_amount,
            "type": "credit" if is_credit else "debit",
            "description": txn.get("description", "")[:120],
            "category": txn.get("category", ""),
            "beneficiary": txn.get("beneficiary", ""),
            "suggestions": suggestions[:3],
        })

    return {"unmatched": unmatched, "total": len(unmatched)}


# =====================================================
# MANUAL MATCH (link bank txn to system record)
# =====================================================

@router.post("/bank-statements/{stmt_id}/manual-match")
async def manual_match_transaction(stmt_id: str, body: dict, current_user: User = Depends(get_current_user)):
    """Manually link a bank transaction to a system record."""
    stmt = await db.bank_statements.find_one({"id": stmt_id}, {"_id": 0})
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")

    txn_index = body.get("txn_index")
    match_type = body.get("match_type")  # sale, expense, supplier_payment
    match_id = body.get("match_id")

    if txn_index is None or not match_type or not match_id:
        raise HTTPException(status_code=400, detail="txn_index, match_type, and match_id required")

    txns = stmt.get("transactions", [])
    if txn_index < 0 or txn_index >= len(txns):
        raise HTTPException(status_code=400, detail="Invalid txn_index")

    # Check not already matched
    existing = await db.auto_matches.find_one({"statement_id": stmt_id, "txn_index": txn_index}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=409, detail="Transaction already matched")

    txn = txns[txn_index]
    txn_amount = txn.get("credit", 0) or txn.get("debit", 0)

    # Lookup the system record
    coll_map = {"sale": "sales", "expense": "expenses", "supplier_payment": "supplier_payments"}
    coll_name = coll_map.get(match_type)
    if not coll_name:
        raise HTTPException(status_code=400, detail="Invalid match_type")

    record = await db[coll_name].find_one({"id": match_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail=f"{match_type} record not found")

    record_amount = record.get("amount", 0)
    if match_type == "sale":
        bank_amt = sum(p["amount"] for p in record.get("payment_details", []) if p.get("mode") == "bank")
        record_amount = bank_amt if bank_amt > 0 else record.get("final_amount", record_amount)

    match_record = {
        "id": str(uuid.uuid4()),
        "statement_id": stmt_id,
        "txn_index": txn_index,
        "txn_date": txn.get("date", ""),
        "txn_amount": txn_amount,
        "txn_desc": txn.get("description", "")[:100],
        "match_type": match_type,
        "match_id": match_id,
        "match_amount": record_amount,
        "match_date": record.get("date", "")[:10],
        "match_desc": record.get("description", "")[:50] or f"{match_type} #{match_id[:8]}",
        "confidence": 100,
        "status": "manual",
        "created_by": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.auto_matches.insert_one(match_record)
    del match_record["_id"]
    return match_record
