"""Bank statement PDF extraction. Never invent missing transaction data."""

from __future__ import annotations

import hashlib
import io
import re
from datetime import datetime
from typing import Any

import pdfplumber

AMOUNT_RE = re.compile(
    r"^\(?\$?-?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\)?$|^\(?\$?-?\d+(?:\.\d{1,2})?\)?$"
)
DATE_RE = re.compile(
    r"^("
    r"\d{1,2}[/-]\d{1,2}[/-]\d{2,4}"
    r"|\d{4}[/-]\d{1,2}[/-]\d{1,2}"
    r"|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}"
    r"|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4}"
    r")$"
)
HEADER_HINTS = {
    "date": ("date", "txn date", "trans date", "posting date", "value date", "posted"),
    "value_date": ("value date", "value dt", "val date"),
    "description": ("description", "narration", "particulars", "details", "payee", "memo", "transaction"),
    "reference": ("ref", "reference", "cheque", "check", "chq", "txn id", "utr", "instrument"),
    "debit": ("debit", "withdrawal", "withdrawals", "dr", "money out", "paid out"),
    "credit": ("credit", "deposit", "deposits", "money in", "paid in"),
    "balance": ("balance", "running balance", "closing"),
    "amount": ("amount", "transaction amount"),
}
OPENING_HINTS = ("opening balance", "brought forward", "b/f", "balance brought forward", "opening bal")
CLOSING_HINTS = ("closing balance", "carried forward", "c/f", "balance carried forward", "closing bal")
BANK_HINTS = (
    ("JPMorgan Chase", ("jpmorgan", "chase")),
    ("Bank of America", ("bank of america", "bofa")),
    ("Wells Fargo", ("wells fargo",)),
    ("Citibank NA", ("citibank", "citi ")),
    ("Silicon Valley Bank", ("silicon valley", "svb")),
    ("Mercury Technologies", ("mercury",)),
    ("Barclays Corporate", ("barclays",)),
    ("HDFC Bank", ("hdfc",)),
    ("ICICI Bank", ("icici",)),
    ("State Bank of India", ("state bank of india", "sbi")),
)


def extract_statement(pdf_bytes: bytes, filename: str) -> dict[str, Any]:
    sha256 = hashlib.sha256(pdf_bytes).hexdigest()
    warnings: list[str] = []
    ocr_used = False
    method = "pdfplumber"

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        page_count = len(pdf.pages)
        native_text = "\n".join((page.extract_text() or "") for page in pdf.pages)
        tables = []
        for page in pdf.pages:
            for table in page.extract_tables() or []:
                if table:
                    tables.append(table)

    if _text_is_sparse(native_text) and not tables:
        ocr_text, ocr_warning = _ocr_fallback(pdf_bytes)
        if ocr_warning:
            warnings.append(ocr_warning)
        if ocr_text:
            native_text = ocr_text
            ocr_used = True
            method = "ocr"
        else:
            return {
                "ok": False,
                "error": "No readable text found in this PDF. It may be blank or scanned. Please upload a valid bank statement.",
                "sha256": sha256,
                "pageCount": page_count,
                "ocrUsed": ocr_used,
                "extractionMethod": method,
                "warnings": warnings,
                "transactions": [],
            }

    full_text = native_text
    bank_hint = _detect_bank(full_text)
    opening, opening_uncertain = _find_labeled_amount(full_text, OPENING_HINTS)
    stated_closing, closing_uncertain = _find_labeled_amount(full_text, CLOSING_HINTS)

    transactions = _extract_from_tables(tables)
    if not transactions:
       transactions = _extract_from_text_lines(full_text.splitlines(), opening)
       method = f"{method}+line-parse"

    if ocr_used:
        for tx in transactions:
            tx["flags"] = sorted(set(tx.get("flags") or []) | {"ocr"})
            if tx.get("confidence", 1) > 0.75:
                tx["confidence"] = 0.75

    if opening_uncertain:
        warnings.append("Opening balance was parsed with low confidence.")
    if closing_uncertain:
        warnings.append("Stated closing balance was parsed with low confidence.")
    print("DEBUG PARSED TRANSACTIONS:", transactions)

    if not transactions:
        return {
            "ok": False,
            "error": "No transactions could be extracted. No values were invented.",
            "sha256": sha256,
            "pageCount": page_count,
            "ocrUsed": ocr_used,
            "extractionMethod": method,
            "bankHint": bank_hint,
            "openingBalance": opening,
            "statedClosingBalance": stated_closing,
            "warnings": warnings,
            "transactions": [],
            "filename": filename,
        }

    return {
        "ok": True,
        "sha256": sha256,
        "pageCount": page_count,
        "ocrUsed": ocr_used,
        "extractionMethod": method,
        "bankHint": bank_hint,
        "openingBalance": opening,
        "statedClosingBalance": stated_closing,
        "warnings": warnings,
        "transactions": transactions,
        "filename": filename,
        "accountHint": _find_account_hint(full_text),
    }


def _text_is_sparse(text: str) -> bool:
    compact = re.sub(r"\s+", "", text or "")
    return len(compact) < 80


def _ocr_fallback(pdf_bytes: bytes) -> tuple[str, str | None]:
    try:
        from pdf2image import convert_from_bytes
        import pytesseract
    except Exception:
        return "", "OCR libraries are not available (pdf2image/pytesseract)."

    try:
        images = convert_from_bytes(pdf_bytes, dpi=300)
        parts = []
        for image in images:
            parts.append(pytesseract.image_to_string(image) or "")
        text = "\n".join(parts)
        if _text_is_sparse(text):
            return text, "OCR completed but produced very little text."
        return text, None
    except Exception as exc:
        return "", f"OCR fallback failed: {exc}"


def _detect_bank(text: str) -> str | None:
    lower = text.lower()
    for label, needles in BANK_HINTS:
        if any(n in lower for n in needles):
            return label
    return None


def _find_account_hint(text: str) -> str | None:
    match = re.search(r"(?:account|acct|a/c)[^\d]{0,12}([xX*]*\d{4,})", text, re.I)
    if not match:
        return None
    digits = re.sub(r"\D", "", match.group(1))
    if len(digits) < 4:
        return None
    return f"*******{digits[-4:]}"


def _find_labeled_amount(text: str, labels: tuple[str, ...]) -> tuple[float | None, bool]:
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines() if line.strip()]
    for line in lines:
        lower = line.lower()
        if any(label in lower for label in labels):
            amounts = _amounts_in_text(line)
            if amounts:
                print("DEBUG BALANCE:", line, "| LABELS:", labels, "| AMOUNTS:", amounts)
                if labels == OPENING_HINTS:
                    return amounts[0], False
                return amounts[-1], False
    return None, False


def _amounts_in_text(text: str) -> list[float]:
    found = []
    for raw in re.findall(r"\(?\$?-?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?\)?|\(?\$?-?\d+\.\d{2}\)?", text):
        parsed = _parse_amount(raw)
        if parsed is not None:
            found.append(parsed)
    return found


def _parse_amount(raw: Any) -> float | None:
    if raw is None:
        return None
    text = str(raw).strip()
    if not text or text in {"-", "—", "–", ".", "NA", "N/A"}:
        return None
    negative = False
    if text.startswith("(") and text.endswith(")"):
        negative = True
        text = text[1:-1]
    text = text.replace("₹", "").replace("$", "").replace(",", "").replace(" ", "")
    if text.endswith("-"):
        negative = True
        text = text[:-1]
    if text.startswith("+"):
        text = text[1:]
    try:
        value = float(text)
    except ValueError:
        return None
    if negative:
        value = -abs(value)
    return round(value, 2)


def _looks_like_date(value: Any) -> bool:
    if value is None:
        return False
    text = str(value).strip()
    if DATE_RE.match(text):
        return True
    return _normalize_date(text) is not None


def _normalize_date(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    for fmt in (
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%m/%d/%Y",
        "%d-%m-%Y",
        "%m-%d-%Y",
        "%d/%m/%y",
        "%m/%d/%y",
        "%d-%b-%Y",
        "%d-%b-%y",
        "%d %b %Y",
        "%d %B %Y",
        "%b %d, %Y",
        "%B %d, %Y",
        "%b %d %Y",
    ):
        try:
            return datetime.strptime(text.replace(".", ""), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _norm_header(cell: Any) -> str:
    return re.sub(r"\s+", " ", str(cell or "")).strip().lower()


def _map_headers(row: list[Any]) -> dict[str, int] | None:
    normalized = [_norm_header(cell) for cell in row]
    if not any("date" in cell or "desc" in cell or "narration" in cell for cell in normalized):
        return None
    mapping: dict[str, int] = {}
    for idx, cell in enumerate(normalized):
        for key, hints in HEADER_HINTS.items():
            if key in mapping:
                continue
            if any(hint in cell for hint in hints):
                mapping[key] = idx
    if "date" not in mapping:
        return None
    if "description" not in mapping and "reference" not in mapping:
        return None
    return mapping


def _extract_from_tables(tables: list[list[list[Any]]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    mapping = None
    for table in tables:
        start = 0
        local_map = _map_headers(table[0]) if table else None
        if local_map:
            mapping = local_map
            start = 1
        elif mapping is None:
            continue
        for raw in table[start:]:
            tx = _row_from_mapping(raw, mapping)
            if tx:
                rows.append(tx)
    return rows


def _row_from_mapping(raw: list[Any], mapping: dict[str, int]) -> dict[str, Any] | None:
    def cell(key: str) -> Any:
        idx = mapping.get(key)
        if idx is None or idx >= len(raw):
            return None
        value = raw[idx]
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    date_raw = cell("date")
    if not date_raw or not _looks_like_date(date_raw):
        joined = " ".join(str(c or "") for c in raw).lower()
        if any(h in joined for h in OPENING_HINTS + CLOSING_HINTS):
            return None
        return None

    flags: list[str] = []
    date = _normalize_date(date_raw)
    if date is None:
        flags.append("uncertain-date")
        date = str(date_raw).strip()

    value_date = _normalize_date(cell("value_date")) if "value_date" in mapping else date
    description = cell("description")
    reference = cell("reference")
    debit = _parse_amount(cell("debit")) if "debit" in mapping else None
    credit = _parse_amount(cell("credit")) if "credit" in mapping else None
    amount = _parse_amount(cell("amount")) if "amount" in mapping else None
    balance = _parse_amount(cell("balance")) if "balance" in mapping else None

    if debit is None and credit is None and amount is not None:
        if amount < 0:
            debit = abs(amount)
        else:
            credit = amount
            flags.append("amount-sign-inferred")

    if debit is not None and debit < 0 and credit is None:
        credit = abs(debit)
        debit = None

    if debit is None and credit is None:
        flags.append("missing-amount")

    if not description:
        description = reference or "Unparsed description"
        flags.append("uncertain-description")

    confidence = 1.0
    if flags:
        confidence = 0.6 if "missing-amount" in flags else 0.8

    return {
        "date": date,
        "valueDate": value_date,
        "description": description,
        "reference": reference,
        "debit": debit,
        "credit": credit,
        "extractedBalance": balance,
        "confidence": confidence,
        "flags": flags,
    }


def _extract_from_text_lines(
    lines: list[str],
    opening_balance: float | None = None,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    previous_balance = opening_balance
    date_line = re.compile(
        r"^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})\s+(.*)$"
    )
    for line in lines:
        text = re.sub(r"\s+", " ", line).strip()
        if not text:
            continue
        lower = text.lower()
        if any(h in lower for h in OPENING_HINTS + CLOSING_HINTS):
            continue
        match = date_line.match(text)
        if not match:
            continue
        date = _normalize_date(match.group(1))
        rest = match.group(2)
        amounts = _amounts_in_text(rest)
        print("DEBUG LINE:", text, "| AMOUNTS:", amounts)
        if not amounts:
            continue
        flags = ["line-parsed"]
        debit = credit = extracted_balance = None
        if len(amounts) == 1:
            flags.append("missing-amount-side")
            # Do not guess debit vs credit.
        elif len(amounts) == 2:
            extracted_balance = amounts[-1]
            movement = abs(amounts[0])

            if previous_balance is not None:
                change = extracted_balance - previous_balance

                if change > 0:
                    credit = movement
                elif change < 0:
                    debit = movement
                else:
                    flags.append("ambiguous-debit-credit")
            else:
                flags.append("ambiguous-debit-credit")

            previous_balance = extracted_balance
        else:
            extracted_balance = amounts[-1]
            debit_candidate, credit_candidate = amounts[0], amounts[1]
            if debit_candidate and not credit_candidate:
                debit, credit = debit_candidate, None
            elif credit_candidate and not debit_candidate:
                debit, credit = None, credit_candidate
            else:
                # Common  debit, credit, balance
                debit, credit = amounts[0], amounts[1]
                if debit == 0:
                    debit = None
                if credit == 0:
                    credit = None

        desc = match.group(2)
        for token in re.findall(r"\(?\$?-?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?\)?|\(?\$?-?\d+\.\d{2}\)?", desc):
            desc = desc.replace(token, " ")
        desc = re.sub(r"\s+", " ", desc).strip(" -")
        ref_match = re.search(r"\b([A-Z]{2,}[-/]?\d{4,}|\d{6,})\b", desc)
        reference = ref_match.group(1) if ref_match else None
        if date is None:
            flags.append("uncertain-date")
            date = match.group(1)
        rows.append(
            {
                "date": date,
                "valueDate": date,
                "description": desc or "Unparsed description",
                "reference": reference,
                "debit": debit,
                "credit": credit,
                "extractedBalance": extracted_balance,
                "confidence": 0.55 if "ambiguous-debit-credit" in flags or "missing-amount-side" in flags else 0.7,
                "flags": flags,
            }
        )
    return rows
