"""
Bank Statement Parsers - Multi-Bank Format Support
Supports Saudi banks, international formats, and generic CSV/PDF parsing
"""

import re
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from io import BytesIO
import pandas as pd


class BankStatementParser:
    """Base parser class with common utilities"""
    
    @staticmethod
    def clean_amount(value: str) -> float:
        """Clean and parse amount string to float"""
        if not value or str(value).lower() == 'nan':
            return 0.0
        cleaned = str(value).replace(',', '').replace(' ', '').replace('SAR', '').replace('SR', '')
        cleaned = re.sub(r'[^\d.\-()]', '', cleaned)
        # Handle parentheses for negative
        if '(' in cleaned:
            cleaned = '-' + cleaned.replace('(', '').replace(')', '')
        try:
            return float(cleaned)
        except:
            return 0.0
    
    @staticmethod
    def parse_date(value: str, formats: List[str] = None) -> Optional[str]:
        """Parse date string to ISO format"""
        if not value or str(value).lower() == 'nan':
            return None
        
        default_formats = [
            '%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%m/%d/%Y',
            '%d %b %Y', '%d %B %Y', '%Y/%m/%d', '%d.%m.%Y',
            '%d/%m/%y', '%m/%d/%y', '%Y%m%d'
        ]
        formats = formats or default_formats
        
        value = str(value).strip()[:20]
        for fmt in formats:
            try:
                return datetime.strptime(value, fmt).strftime('%Y-%m-%d')
            except:
                continue
        return value[:10] if len(value) >= 10 else None


class AlRajhiParser(BankStatementParser):
    """Parser for Al Rajhi Bank statements"""
    
    BANK_NAME = "Al Rajhi Bank"
    
    def parse(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        transactions = []
        
        # Find header row
        header_idx = self._find_header(df)
        if header_idx < 0:
            return self._parse_generic(df)
        
        data_df = df.iloc[header_idx + 1:].reset_index(drop=True)
        headers = [str(c).lower().strip() for c in df.iloc[header_idx].values]
        
        # Map columns
        col_map = self._get_column_map(headers)
        
        for _, row in data_df.iterrows():
            txn = self._parse_row(row, col_map)
            if txn:
                transactions.append(txn)
        
        return transactions
    
    def _find_header(self, df: pd.DataFrame) -> int:
        """Find header row index"""
        keywords = ['transaction', 'date', 'amount', 'debit', 'credit', 'reference', 'balance']
        for idx in range(min(20, len(df))):
            row_str = ' '.join([str(v).lower() for v in df.iloc[idx].values if pd.notna(v)])
            if sum(1 for k in keywords if k in row_str) >= 3:
                return idx
        return -1
    
    def _get_column_map(self, headers: List[str]) -> Dict[str, int]:
        """Map column names to indices"""
        mapping = {}
        for i, h in enumerate(headers):
            if 'date' in h and 'value' not in h:
                mapping['date'] = i
            elif 'value date' in h or 'valuedate' in h:
                mapping['value_date'] = i
            elif 'reference' in h or 'ref' in h:
                mapping['reference'] = i
            elif 'description' in h or 'particular' in h or 'narrative' in h:
                mapping['description'] = i
            elif 'debit' in h or 'withdrawal' in h:
                mapping['debit'] = i
            elif 'credit' in h or 'deposit' in h:
                mapping['credit'] = i
            elif 'balance' in h:
                mapping['balance'] = i
            elif 'detail' in h:
                mapping['details'] = i
        return mapping
    
    def _parse_row(self, row, col_map: Dict[str, int]) -> Optional[Dict[str, Any]]:
        """Parse a single transaction row"""
        vals = list(row.values)
        
        date = self.parse_date(vals[col_map.get('date', 0)]) if col_map.get('date') is not None else None
        if not date:
            return None
        
        debit = self.clean_amount(vals[col_map.get('debit', -1)]) if col_map.get('debit') is not None else 0
        credit = self.clean_amount(vals[col_map.get('credit', -1)]) if col_map.get('credit') is not None else 0
        
        if debit == 0 and credit == 0:
            return None
        
        desc = str(vals[col_map.get('description', 2)]) if col_map.get('description') is not None else ''
        details = str(vals[col_map.get('details', -1)]) if col_map.get('details') is not None else ''
        if details and details != 'nan':
            desc = f"{desc} - {details}"
        
        return {
            'date': date,
            'description': desc[:200].strip(),
            'reference': str(vals[col_map.get('reference', 1)]) if col_map.get('reference') is not None else '',
            'debit': abs(debit),
            'credit': abs(credit),
            'balance': self.clean_amount(vals[col_map.get('balance', -1)]) if col_map.get('balance') is not None else 0,
            'bank': self.BANK_NAME,
            'category': self._categorize(desc)
        }
    
    def _categorize(self, desc: str) -> str:
        """Categorize transaction based on description"""
        desc_upper = desc.upper()
        if 'SPAN' in desc_upper or 'MADA' in desc_upper:
            return 'pos_sales' if 'FEE' not in desc_upper else 'pos_fees'
        if 'VISA' in desc_upper or 'MASTER' in desc_upper:
            return 'pos_fees' if 'FEE' in desc_upper else 'pos_sales'
        if 'SARIE' in desc_upper:
            return 'incoming_transfer' if 'INCOMING' in desc_upper else 'outgoing_transfer'
        if 'SADAD' in desc_upper:
            return 'sadad_payment'
        if 'SALARY' in desc_upper or 'PAYROLL' in desc_upper:
            return 'salary'
        if 'FEE' in desc_upper or 'CHARGE' in desc_upper:
            return 'bank_fees'
        if 'VAT' in desc_upper:
            return 'vat_fees'
        return 'other'
    
    def _parse_generic(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Fallback generic parsing"""
        return GenericCSVParser().parse(df)


class SNBParser(BankStatementParser):
    """Parser for Saudi National Bank (SNB/NCB) statements"""
    
    BANK_NAME = "Saudi National Bank"
    
    def parse(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        transactions = []
        
        # SNB format typically has Arabic column headers
        arabic_date = 'تاريخ'
        arabic_amount = 'المبلغ'
        arabic_desc = 'البيان'
        
        # Find header
        for idx in range(min(20, len(df))):
            row_str = ' '.join([str(v) for v in df.iloc[idx].values if pd.notna(v)])
            if arabic_date in row_str or 'Date' in row_str:
                headers = df.iloc[idx].values
                data_df = df.iloc[idx + 1:].reset_index(drop=True)
                
                for _, row in data_df.iterrows():
                    txn = self._parse_snb_row(row, headers)
                    if txn:
                        transactions.append(txn)
                break
        
        if not transactions:
            return GenericCSVParser().parse(df)
        
        return transactions
    
    def _parse_snb_row(self, row, headers) -> Optional[Dict[str, Any]]:
        vals = list(row.values)
        date = None
        amount = 0
        desc = ''
        balance = 0
        
        for i, h in enumerate(headers):
            h_str = str(h).lower() if pd.notna(h) else ''
            val = vals[i] if i < len(vals) else None
            
            if 'date' in h_str or 'تاريخ' in str(h):
                date = self.parse_date(val)
            elif 'amount' in h_str or 'المبلغ' in str(h):
                amount = self.clean_amount(val)
            elif 'description' in h_str or 'البيان' in str(h) or 'detail' in h_str:
                desc = str(val) if pd.notna(val) else ''
            elif 'balance' in h_str or 'الرصيد' in str(h):
                balance = self.clean_amount(val)
        
        if not date or amount == 0:
            return None
        
        return {
            'date': date,
            'description': desc[:200],
            'debit': abs(amount) if amount < 0 else 0,
            'credit': amount if amount > 0 else 0,
            'balance': balance,
            'bank': self.BANK_NAME,
            'category': AlRajhiParser()._categorize(desc)
        }


class RiyadBankParser(BankStatementParser):
    """Parser for Riyad Bank statements"""
    
    BANK_NAME = "Riyad Bank"
    
    def parse(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        # Riyad Bank format detection
        for idx in range(min(15, len(df))):
            row_str = ' '.join([str(v).lower() for v in df.iloc[idx].values if pd.notna(v)])
            if 'transaction date' in row_str or 'posting date' in row_str:
                return self._parse_riyad_format(df, idx)
        
        return GenericCSVParser().parse(df)
    
    def _parse_riyad_format(self, df: pd.DataFrame, header_idx: int) -> List[Dict[str, Any]]:
        transactions = []
        headers = [str(c).lower().strip() for c in df.iloc[header_idx].values]
        data_df = df.iloc[header_idx + 1:].reset_index(drop=True)
        
        date_col = next((i for i, h in enumerate(headers) if 'date' in h), 0)
        desc_col = next((i for i, h in enumerate(headers) if 'description' in h or 'narration' in h), 1)
        debit_col = next((i for i, h in enumerate(headers) if 'debit' in h or 'withdrawal' in h), None)
        credit_col = next((i for i, h in enumerate(headers) if 'credit' in h or 'deposit' in h), None)
        balance_col = next((i for i, h in enumerate(headers) if 'balance' in h), None)
        
        for _, row in data_df.iterrows():
            vals = list(row.values)
            date = self.parse_date(vals[date_col])
            if not date:
                continue
            
            debit = self.clean_amount(vals[debit_col]) if debit_col is not None else 0
            credit = self.clean_amount(vals[credit_col]) if credit_col is not None else 0
            
            if debit == 0 and credit == 0:
                continue
            
            transactions.append({
                'date': date,
                'description': str(vals[desc_col])[:200] if desc_col < len(vals) else '',
                'debit': abs(debit),
                'credit': abs(credit),
                'balance': self.clean_amount(vals[balance_col]) if balance_col is not None else 0,
                'bank': self.BANK_NAME,
                'category': AlRajhiParser()._categorize(str(vals[desc_col]))
            })
        
        return transactions


class AlinmaParser(BankStatementParser):
    """Parser for Alinma Bank statements"""
    
    BANK_NAME = "Alinma Bank"
    
    def parse(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        # Alinma specific format markers
        for idx in range(min(20, len(df))):
            row_vals = [str(v).lower() for v in df.iloc[idx].values if pd.notna(v)]
            row_str = ' '.join(row_vals)
            
            # Alinma uses specific header format
            if 'transaction date' in row_str or 'الاستحقاق' in row_str:
                return self._parse_alinma_format(df, idx)
        
        return GenericCSVParser().parse(df)
    
    def _parse_alinma_format(self, df: pd.DataFrame, header_idx: int) -> List[Dict[str, Any]]:
        transactions = []
        headers = df.iloc[header_idx].values
        data_df = df.iloc[header_idx + 1:].reset_index(drop=True)
        
        for _, row in data_df.iterrows():
            vals = list(row.values)
            # Alinma format: Date is often in last column
            date = None
            for v in reversed(vals):
                date = self.parse_date(v)
                if date:
                    break
            
            if not date:
                continue
            
            # Find amount columns
            debit = 0
            credit = 0
            desc = ''
            
            for i, v in enumerate(vals):
                v_str = str(v)
                clean_v = self.clean_amount(v_str)
                if clean_v != 0:
                    if clean_v < 0:
                        debit = abs(clean_v)
                    else:
                        # Check header or position to determine debit/credit
                        h_str = str(headers[i]).lower() if i < len(headers) else ''
                        if 'debit' in h_str or i == 8:  # Common debit column
                            debit = clean_v
                        else:
                            credit = clean_v
                elif len(v_str) > 10 and not v_str.replace(' ', '').isdigit():
                    desc = v_str[:200]
            
            if debit == 0 and credit == 0:
                continue
            
            transactions.append({
                'date': date,
                'description': desc,
                'debit': debit,
                'credit': credit,
                'balance': 0,
                'bank': self.BANK_NAME,
                'category': AlRajhiParser()._categorize(desc)
            })
        
        return transactions


class SABBParser(BankStatementParser):
    """Parser for Saudi British Bank (SABB) statements"""
    
    BANK_NAME = "SABB"
    
    def parse(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        return GenericCSVParser().parse(df, bank_name=self.BANK_NAME)


class ANBParser(BankStatementParser):
    """Parser for Arab National Bank statements"""
    
    BANK_NAME = "Arab National Bank"
    
    def parse(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        return GenericCSVParser().parse(df, bank_name=self.BANK_NAME)


class AlBiladParser(BankStatementParser):
    """Parser for Bank Albilad statements"""
    
    BANK_NAME = "Bank Albilad"
    
    def parse(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        return GenericCSVParser().parse(df, bank_name=self.BANK_NAME)


class GenericCSVParser(BankStatementParser):
    """Generic CSV/Excel parser that auto-detects columns"""
    
    def parse(self, df: pd.DataFrame, bank_name: str = "Unknown") -> List[Dict[str, Any]]:
        transactions = []
        
        # Normalize column names
        df.columns = [str(c).lower().strip() for c in df.columns]
        
        # Common column name mappings
        date_cols = ['date', 'transaction date', 'posting date', 'value date', 'txn date']
        desc_cols = ['description', 'details', 'narrative', 'particulars', 'memo', 'reference']
        debit_cols = ['debit', 'withdrawal', 'dr', 'out', 'payment']
        credit_cols = ['credit', 'deposit', 'cr', 'in', 'receipt']
        amount_cols = ['amount', 'transaction amount', 'value']
        balance_cols = ['balance', 'running balance', 'available balance']
        
        # Find columns
        date_col = self._find_column(df.columns, date_cols)
        desc_col = self._find_column(df.columns, desc_cols)
        debit_col = self._find_column(df.columns, debit_cols)
        credit_col = self._find_column(df.columns, credit_cols)
        amount_col = self._find_column(df.columns, amount_cols)
        balance_col = self._find_column(df.columns, balance_cols)
        
        if not date_col:
            # Try to find date by content
            for col in df.columns:
                sample = df[col].dropna().head(5)
                if any(self.parse_date(str(v)) for v in sample):
                    date_col = col
                    break
        
        if not date_col:
            return []
        
        for _, row in df.iterrows():
            date = self.parse_date(row.get(date_col, ''))
            if not date:
                continue
            
            desc = str(row.get(desc_col, ''))[:200] if desc_col else ''
            
            # Get amounts
            if debit_col and credit_col:
                debit = abs(self.clean_amount(row.get(debit_col, 0)))
                credit = abs(self.clean_amount(row.get(credit_col, 0)))
            elif amount_col:
                amount = self.clean_amount(row.get(amount_col, 0))
                debit = abs(amount) if amount < 0 else 0
                credit = amount if amount > 0 else 0
            else:
                # Try to find numeric columns
                debit = 0
                credit = 0
                for col, val in row.items():
                    if col in [date_col, desc_col, balance_col]:
                        continue
                    num = self.clean_amount(val)
                    if num != 0:
                        if num < 0:
                            debit = abs(num)
                        else:
                            credit = num
                        break
            
            if debit == 0 and credit == 0:
                continue
            
            transactions.append({
                'date': date,
                'description': desc,
                'debit': debit,
                'credit': credit,
                'balance': self.clean_amount(row.get(balance_col, 0)) if balance_col else 0,
                'bank': bank_name,
                'category': AlRajhiParser()._categorize(desc)
            })
        
        return transactions
    
    def _find_column(self, columns, keywords: List[str]) -> Optional[str]:
        """Find column by keyword matching"""
        for col in columns:
            for kw in keywords:
                if kw in col:
                    return col
        return None


class OFXParser(BankStatementParser):
    """Parser for OFX/QFX (Quicken) format"""
    
    def parse(self, content: bytes) -> List[Dict[str, Any]]:
        transactions = []
        
        # Simple OFX parsing (not full XML)
        content_str = content.decode('utf-8', errors='ignore')
        
        # Find all STMTTRN blocks
        txn_blocks = re.findall(r'<STMTTRN>(.*?)</STMTTRN>', content_str, re.DOTALL)
        
        for block in txn_blocks:
            txn = {}
            
            # Extract fields
            date_match = re.search(r'<DTPOSTED>(\d{8})', block)
            amount_match = re.search(r'<TRNAMT>([-\d.]+)', block)
            name_match = re.search(r'<NAME>(.+?)(?:<|$)', block)
            memo_match = re.search(r'<MEMO>(.+?)(?:<|$)', block)
            
            if date_match and amount_match:
                date_str = date_match.group(1)
                date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
                amount = float(amount_match.group(1))
                desc = name_match.group(1).strip() if name_match else ''
                if memo_match:
                    desc += ' ' + memo_match.group(1).strip()
                
                transactions.append({
                    'date': date,
                    'description': desc[:200],
                    'debit': abs(amount) if amount < 0 else 0,
                    'credit': amount if amount > 0 else 0,
                    'balance': 0,
                    'bank': 'OFX Import',
                    'category': AlRajhiParser()._categorize(desc)
                })
        
        return transactions


class MT940Parser(BankStatementParser):
    """Parser for MT940 (SWIFT) bank statement format"""
    
    def parse(self, content: bytes) -> List[Dict[str, Any]]:
        transactions = []
        content_str = content.decode('utf-8', errors='ignore')
        
        # Find transaction lines (tag 61)
        lines = content_str.split('\n')
        current_txn = None
        
        for line in lines:
            line = line.strip()
            
            if line.startswith(':61:'):
                # Transaction line format: :61:YYMMDDCD1234,56NTRF//REFERENCE
                if current_txn:
                    transactions.append(current_txn)
                
                data = line[4:]
                # Parse date (first 6 chars)
                date_str = data[:6]
                try:
                    date = datetime.strptime(date_str, '%y%m%d').strftime('%Y-%m-%d')
                except:
                    date = None
                
                # Find credit/debit indicator and amount
                cd_match = re.search(r'([CD])(\d+[,.]?\d*)', data[6:])
                if cd_match:
                    is_credit = cd_match.group(1) == 'C'
                    amount = float(cd_match.group(2).replace(',', '.'))
                else:
                    is_credit = True
                    amount = 0
                
                current_txn = {
                    'date': date,
                    'debit': 0 if is_credit else amount,
                    'credit': amount if is_credit else 0,
                    'description': '',
                    'balance': 0,
                    'bank': 'MT940 Import',
                    'category': 'other'
                }
            
            elif line.startswith(':86:') and current_txn:
                # Additional transaction info
                current_txn['description'] = line[4:][:200]
                current_txn['category'] = AlRajhiParser()._categorize(line[4:])
        
        if current_txn:
            transactions.append(current_txn)
        
        return transactions


def detect_bank_format(df: pd.DataFrame, filename: str = '') -> str:
    """Auto-detect bank format from content and filename"""
    
    filename_lower = filename.lower()
    
    # Check filename hints - Saudi Banks
    if 'rajhi' in filename_lower:
        return 'alrajhi'
    if 'snb' in filename_lower or 'ncb' in filename_lower or 'national' in filename_lower:
        return 'snb'
    if 'riyad' in filename_lower:
        return 'riyad'
    if 'alinma' in filename_lower:
        return 'alinma'
    if 'sabb' in filename_lower:
        return 'sabb'
    if 'anb' in filename_lower:
        return 'anb'
    if 'bilad' in filename_lower:
        return 'albilad'
    
    # Check filename hints - UAE Banks
    if 'enbd' in filename_lower or 'emirates' in filename_lower:
        return 'enbd'
    if 'rak' in filename_lower:
        return 'rakbank'
    if 'dib' in filename_lower or 'dubai islamic' in filename_lower:
        return 'dib'
    if 'mashreq' in filename_lower:
        return 'mashreq'
    if 'adcb' in filename_lower:
        return 'adcb'
    
    # Check content
    content_str = ' '.join([str(v) for v in df.values.flatten() if pd.notna(v)])
    content_lower = content_str.lower()
    
    if 'al rajhi' in content_lower or 'الراجحي' in content_str:
        return 'alrajhi'
    if 'saudi national' in content_lower or 'snb' in content_lower:
        return 'snb'
    if 'riyad bank' in content_lower:
        return 'riyad'
    if 'alinma' in content_lower or 'الإنماء' in content_str:
        return 'alinma'
    if 'sabb' in content_lower or 'ساب' in content_str:
        return 'sabb'
    if 'emirates nbd' in content_lower:
        return 'enbd'
    if 'rak bank' in content_lower:
        return 'rakbank'
    if 'dubai islamic' in content_lower:
        return 'dib'
    
    return 'generic'


class EmiratesNBDParser(BankStatementParser):
    """Parser for Emirates NBD statements"""
    
    BANK_NAME = "Emirates NBD"
    
    def parse(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        transactions = []
        
        # Find columns
        cols = [str(c).lower().strip() for c in df.columns]
        date_col = next((c for c in df.columns if 'date' in str(c).lower()), df.columns[0])
        desc_col = next((c for c in df.columns if 'desc' in str(c).lower() or 'narr' in str(c).lower()), df.columns[1])
        debit_col = next((c for c in df.columns if 'debit' in str(c).lower() or 'withdrawal' in str(c).lower()), None)
        credit_col = next((c for c in df.columns if 'credit' in str(c).lower() or 'deposit' in str(c).lower()), None)
        balance_col = next((c for c in df.columns if 'balance' in str(c).lower()), None)
        
        for _, row in df.iterrows():
            date = self.parse_date(str(row[date_col]))
            if not date:
                continue
            
            desc = str(row[desc_col]) if pd.notna(row[desc_col]) else ''
            debit = self.clean_amount(str(row[debit_col])) if debit_col and pd.notna(row[debit_col]) else 0
            credit = self.clean_amount(str(row[credit_col])) if credit_col and pd.notna(row[credit_col]) else 0
            balance = self.clean_amount(str(row[balance_col])) if balance_col and pd.notna(row[balance_col]) else 0
            
            if debit == 0 and credit == 0:
                continue
            
            transactions.append({
                'date': date,
                'description': desc[:200],
                'debit': debit,
                'credit': credit,
                'balance': balance,
                'bank': self.BANK_NAME,
                'category': self._categorize(desc)
            })
        
        return transactions
    
    def _categorize(self, desc: str) -> str:
        desc_lower = desc.lower()
        if any(w in desc_lower for w in ['salary', 'payroll']):
            return 'salary'
        if any(w in desc_lower for w in ['transfer', 'trf']):
            return 'transfer'
        if any(w in desc_lower for w in ['pos', 'purchase', 'shop']):
            return 'purchase'
        if any(w in desc_lower for w in ['atm', 'withdrawal', 'cash']):
            return 'cash'
        return 'other'


class RAKBankParser(BankStatementParser):
    """Parser for RAK Bank statements"""
    
    BANK_NAME = "RAK Bank"
    
    def parse(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        transactions = []
        
        cols = [str(c).lower().strip() for c in df.columns]
        
        for _, row in df.iterrows():
            # Try to find date
            date = None
            for col in df.columns:
                val = str(row[col])
                date = self.parse_date(val)
                if date:
                    break
            
            if not date:
                continue
            
            # Find description
            desc = ''
            for col in df.columns:
                if 'desc' in str(col).lower() or 'narr' in str(col).lower() or 'particular' in str(col).lower():
                    desc = str(row[col]) if pd.notna(row[col]) else ''
                    break
            
            # Find amounts
            debit = credit = balance = 0
            for col in df.columns:
                col_lower = str(col).lower()
                val = self.clean_amount(str(row[col])) if pd.notna(row[col]) else 0
                if 'debit' in col_lower or 'dr' == col_lower:
                    debit = val
                elif 'credit' in col_lower or 'cr' == col_lower:
                    credit = val
                elif 'balance' in col_lower:
                    balance = val
            
            if debit == 0 and credit == 0:
                continue
            
            transactions.append({
                'date': date,
                'description': desc[:200],
                'debit': debit,
                'credit': credit,
                'balance': balance,
                'bank': self.BANK_NAME,
                'category': 'other'
            })
        
        return transactions


class DubaiIslamicBankParser(BankStatementParser):
    """Parser for Dubai Islamic Bank statements"""
    
    BANK_NAME = "Dubai Islamic Bank"
    
    def parse(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        transactions = []
        
        # Similar to EmiratesNBD structure
        date_col = next((c for c in df.columns if 'date' in str(c).lower()), df.columns[0])
        desc_col = next((c for c in df.columns if 'desc' in str(c).lower() or 'particular' in str(c).lower()), df.columns[1])
        
        for _, row in df.iterrows():
            date = self.parse_date(str(row[date_col]))
            if not date:
                continue
            
            desc = str(row[desc_col]) if pd.notna(row[desc_col]) else ''
            
            # Find debit/credit
            debit = credit = balance = 0
            for col in df.columns:
                col_lower = str(col).lower()
                val = self.clean_amount(str(row[col])) if pd.notna(row[col]) else 0
                if 'debit' in col_lower or 'withdrawal' in col_lower:
                    debit = val
                elif 'credit' in col_lower or 'deposit' in col_lower:
                    credit = val
                elif 'balance' in col_lower:
                    balance = val
            
            if debit == 0 and credit == 0:
                continue
            
            transactions.append({
                'date': date,
                'description': desc[:200],
                'debit': debit,
                'credit': credit,
                'balance': balance,
                'bank': self.BANK_NAME,
                'category': 'other'
            })
        
        return transactions


def get_parser(bank_format: str) -> BankStatementParser:
    """Get appropriate parser for bank format"""
    parsers = {
        'alrajhi': AlRajhiParser(),
        'snb': SNBParser(),
        'riyad': RiyadBankParser(),
        'alinma': AlinmaParser(),
        'sabb': SABBParser(),
        'anb': ANBParser(),
        'albilad': AlBiladParser(),
        'generic': GenericCSVParser(),
    }
    return parsers.get(bank_format, GenericCSVParser())


def parse_bank_statement(content: bytes, filename: str) -> Tuple[List[Dict[str, Any]], str]:
    """Parse bank statement file and return transactions with detected bank name"""
    
    filename_lower = filename.lower()
    
    # Handle OFX/QFX
    if filename_lower.endswith(('.ofx', '.qfx')):
        parser = OFXParser()
        return parser.parse(content), 'OFX Import'
    
    # Handle MT940
    if filename_lower.endswith('.sta') or b':20:' in content[:500]:
        parser = MT940Parser()
        return parser.parse(content), 'MT940 Import'
    
    # Handle CSV/Excel
    try:
        if filename_lower.endswith('.csv'):
            df = pd.read_csv(BytesIO(content))
        else:
            try:
                df = pd.read_excel(BytesIO(content))
            except:
                df = pd.read_excel(BytesIO(content), engine='xlrd')
    except Exception as e:
        raise ValueError(f"Cannot read file: {str(e)}")
    
    # Detect bank and parse
    bank_format = detect_bank_format(df, filename)
    parser = get_parser(bank_format)
    transactions = parser.parse(df)
    
    bank_name = parser.BANK_NAME if hasattr(parser, 'BANK_NAME') else 'Unknown'
    return transactions, bank_name
