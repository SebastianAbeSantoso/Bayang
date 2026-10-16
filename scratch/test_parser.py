import re

def parse(raw_note):
    extra_claims = []
    clauses = []
    for chunk in re.split(r"(?<=[.!?\n])\s+", raw_note or ""):
        chunk = chunk.strip()
        if not chunk:
            continue
        if ("," in chunk or ";" in chunk) and len(chunk) > 30:
            subparts = re.split(r"[,;]\s*", chunk)
            for sp in subparts:
                sp_clean = sp.strip()
                if len(sp_clean) >= 6:
                    clauses.append(sp_clean)
        else:
            if len(chunk) >= 6:
                clauses.append(chunk)

    seq = 1
    for sent in clauses:
        low = sent.lower()

        # 1. Negated task completion
        if any(neg in low for neg in ("did not", "didn't", "not clean", "not done", "belum", "tidak", "gak sempet", "tak sempat", "skipped")):
            entity = "steam wand" if "wand" in low else ("dairy chiller" if "chiller" in low else ("grinder" if "grinder" in low else "bar area"))
            extra_claims.append({"type": "task_completion", "entity": entity, "action": "not_cleaned", "quote": sent})
            seq += 1
            continue

        # 2. Ice stock depletion (check before equipment to avoid Indonesian 'jam 18' collision)
        if any(w in low for w in ("es batu", "ice")) and any(w in low for w in ("abis", "habis", "depleted", "empty", "out")):
            extra_claims.append({"type": "stock_action", "entity": "es batu", "action": "abis", "qty": 0, "quote": sent})
            seq += 1
            continue

        # 3. Cash variance (ignore if explicitly zero variance / balanced)
        is_zero_variance = any(w in low for w in ("zero variance", "no variance", "0 variance", "tanpa selisih", "balanced"))
        if not is_zero_variance and any(w in low for w in ("kurang", "selisih", "short", "minus", "variance", "kasir")) and any(w in low for w in ("rp", "ribu", "k", "cash", "drawer", "uang", "register")):
            m_cash = re.search(r"(?:rp\.?\s*|short\s+by\s+rp\.?\s*|kurang\s+rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+|\d+k|\d+)", low)
            cash_val = 50000
            if m_cash:
                val_str = m_cash.group(1).lower().replace(".", "").replace(",", "")
                if val_str.endswith("k"):
                    cash_val = int(val_str[:-1]) * 1000
                elif val_str.isdigit():
                    cash_val = int(val_str)
            extra_claims.append({"type": "cash_mismatch", "entity": "cash drawer", "action": "variance", "qty": cash_val, "quote": sent})
            seq += 1
            continue

        # 4. Equipment issues (use 'jammed'/'macet', avoiding Indonesian time 'jam 17')
        has_issue_keyword = any(w in low for w in ("macet", "jammed", "stalled", "stuck", "bocor", "leak", "leaking", "broken", "rusak", "error", "fault", "drip"))
        if has_issue_keyword:
            if any(w in low for w in ("grinder", "burr")):
                m_min = re.search(r"(\d+)\s*(menit|mins?|minutes?)", low)
                downtime_qty = int(m_min.group(1)) if m_min else 20
                extra_claims.append({"type": "equipment_issue", "entity": "grinder", "action": f"macet {downtime_qty} menit", "qty": downtime_qty, "quote": sent})
                seq += 1
                continue
            else:
                entity = "portafilter gasket" if "gasket" in low else ("steam wand" if "wand" in low else "espresso machine")
                action = "leaking" if any(w in low for w in ("leak", "bocor", "drip")) else "malfunction"
                extra_claims.append({"type": "equipment_issue", "entity": entity, "action": action, "quote": sent})
                seq += 1
                continue

        # 5. Stock movements & waste
        m_stock_verb = re.search(r"(restocked|ambil|used|wasted|buang|dumped|expired)\s+([a-zA-Z\s]+?)\s*(\d+(?:\.\d+)?)\s*(cartons?|karton|packs?|pak|bottles?|botol|l|liters?|g|grams?|kg|bags?|kantong)?", sent, flags=re.IGNORECASE)
        m_stock_qty = re.search(r"(restocked|ambil|used|wasted|buang|dumped)\s+(\d+(?:\.\d+)?)\s*(cartons?|karton|packs?|pak|bottles?|botol|l|liters?|g|grams?|kg|bags?|kantong)?\s*(?:of\s+)?([a-zA-Z\s]+)", sent, flags=re.IGNORECASE)
        m_stock_item = re.search(r"([a-zA-Z\s]+?)\s+(\d+(?:\.\d+)?)\s*(cartons?|karton|packs?|pak|bottles?|botol|l|liters?|g|grams?|kg|bags?|kantong)?\s*(expired|basi|dumped|wasted|buang|dibuang|restocked)", sent, flags=re.IGNORECASE)

        matched_stock = None
        if m_stock_item:
            entity = m_stock_item.group(1).strip(" .,;")
            qty = float(m_stock_item.group(2))
            unit = (m_stock_item.group(3) or "cartons").strip()
            v_action = m_stock_item.group(4).lower()
            action = "wasted" if any(w in v_action for w in ("expired", "basi", "dumped", "wasted", "buang", "dibuang")) else "restocked"
            matched_stock = (entity, qty, unit, action)
        elif m_stock_verb:
            verb = m_stock_verb.group(1).lower()
            entity = m_stock_verb.group(2).strip(" .,;")
            qty = float(m_stock_verb.group(3))
            unit = (m_stock_verb.group(4) or "g").strip()
            action = "wasted" if any(w in verb for w in ("wasted", "buang", "dumped", "expired")) else "restocked"
            matched_stock = (entity, qty, unit, action)
        elif m_stock_qty:
            verb = m_stock_qty.group(1).lower()
            qty = float(m_stock_qty.group(2))
            unit = (m_stock_qty.group(3) or "cartons").strip()
            entity = m_stock_qty.group(4).strip(" .,;")
            action = "wasted" if any(w in verb for w in ("wasted", "buang", "dumped")) else "restocked"
            matched_stock = (entity, qty, unit, action)

        if matched_stock:
            entity, qty, unit, action = matched_stock
            extra_claims.append({"type": "stock_action", "entity": entity, "action": action, "qty": qty, "unit": unit, "quote": sent})
            seq += 1
            continue

        # 6. Positive completion
        if any(w in low for w in ("calibrated", "kalibrasi", "counted and matched", "balanced", "reconciled")):
            extra_claims.append({"type": "task_completion", "entity": "grinder" if "grinder" in low else "inventory", "action": "completed", "quote": sent})
            seq += 1
            continue

    return extra_claims

presets = [
    "Tadi grinder macet 20 menit pas jam 17, buang beans 200g house blend, es batu abis dari jam 18, gak sempet deep clean steam wand kanan karena antrian rame",
    "Oat milk 3 cartons expired dumped unlogged, cash drawer short by Rp 50.000 at close, espresso machine portafilter gasket leaking steam.",
    "Smooth afternoon shift. All inventory counted and matched POS, grinder calibrated at 14:00, ice restocked from backup freezer, closing cash reconciled with zero variance.",
    "Susu oat 3 karton basi dibuang, kasir kurang Rp 50.000"
]

for i, p in enumerate(presets, 1):
    c = parse(p)
    print(f"=== Preset {i} ===")
    print(f"Total claims: {len(c)}")
    for x in c:
        print(f"  {x['type']} | {x['entity']} | {x['action']} | qty: {x.get('qty')} | valid quote: {x['quote'] in p} | quote: '{x['quote']}'")
