import copy
import math
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
NS_XML = "http://www.w3.org/XML/1998/namespace"
NS_MC = "http://schemas.openxmlformats.org/markup-compatibility/2006"
NS_X14AC = "http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac"
NS_XR = "http://schemas.microsoft.com/office/spreadsheetml/2014/revision"
NS_XR2 = "http://schemas.microsoft.com/office/spreadsheetml/2015/revision2"
NS_XR3 = "http://schemas.microsoft.com/office/spreadsheetml/2016/revision3"

ET.register_namespace("", NS_MAIN)
ET.register_namespace("r", NS_REL)
ET.register_namespace("mc", NS_MC)
ET.register_namespace("x14ac", NS_X14AC)
ET.register_namespace("xr", NS_XR)
ET.register_namespace("xr2", NS_XR2)
ET.register_namespace("xr3", NS_XR3)

N = f"{{{NS_MAIN}}}"
R_ID = f"{{{NS_REL}}}id"
XML_SPACE = f"{{{NS_XML}}}space"


TEMPLATE = Path(r"C:\Users\UserVik\Downloads\Smeta_obschaya.xlsx")
DEFECT = Path(r"C:\Users\UserVik\Downloads\Defektovka.xlsx")
OUTPUT = Path.cwd() / "Smeta_po_defektovke.xlsx"
OUTPUT_GESN = Path.cwd() / "Smeta_po_defektovke_GESN.xlsx"
OUTPUT_GESN_PRICES = Path.cwd() / "Smeta_po_defektovke_GESN_prices.xlsx"


GESN_RATES = {
    "очистка стен от треснувшей шпаклевки краски": (
        "ГЭСНр62-01-007-03",
        "Улучшенная масляная окраска ранее окрашенных стен за один раз с расчисткой старой краски более 35%",
        "100 м2",
    ),
    "демонтаж напольного кафеля": (
        "ГЭСНр57-01-002-03",
        "Разборка покрытий полов: из керамических плиток",
        "100 м2",
    ),
    "демонтаж обоев": (
        "ГЭСНр63-02-001-01",
        "Очистка стен от обоев",
        "100 м2",
    ),
    "демонтаж стеновых панелей": (
        "ГЭСНр63-03-009-02",
        "Разборка элементов облицовки с разборкой каркаса: пластиковых панелей",
        "100 м2",
    ),
    "кладка перегородок гипсовыми блоками высота перегородки 2 6 м": (
        "ГЭСН08-04-001-14",
        "Установка перегородок из гипсовых пазогребневых плит при высоте этажа до 4 м в 1 слой толщиной 80 мм полнотелых",
        "100 м2",
    ),
    "штукатуривание стен": (
        "ГЭСН15-02-016-03",
        "Улучшенная штукатурка внутренних стен по камню и бетону",
        "100 м2",
    ),
    "шпаклевка стен везде частичная кроме перегородок склада и коридора": (
        "ГЭСНр62-02-009",
        "Сплошная шпаклевка ранее оштукатуренных поверхностей",
        "100 м2",
    ),
    "покраска стен краской на маслянной основе": (
        "ГЭСНр62-01-007-06",
        "Улучшенная масляная окраска ранее окрашенных стен за два раза с расчисткой старой краски более 35%",
        "100 м2",
    ),
    "установка натяжных потолков": (
        "ГЭСН15-01-051-02",
        "Устройство натяжных потолков из ПВХ гарпунным способом в помещениях площадью от 10 до 50 м2",
        "100 м2",
    ),
    "монтаж кафеля стены пол санузел кухня": (
        "ГЭСН15-01-019-05",
        "Гладкая облицовка стен, столбов, пилястр и откосов плитками на клее из сухих смесей по кирпичу и бетону",
        "100 м2",
    ),
    "монтаж на пол плит керамогранит": (
        "ГЭСН11-01-047-02",
        "Устройство покрытий из плит керамогранитных размером 60х60 см",
        "100 м2",
    ),
    "установка раковины": (
        "ГЭСН17-01-001-15",
        "Установка умывальников",
        "10 компл.",
    ),
    "установка ванной": (
        "ГЭСН17-01-001-02",
        "Установка ванн купальных: прямых стальных",
        "10 компл.",
    ),
    "установка сушилки для полотенец": (
        "ГЭСН17-01-002-07",
        "Установка полотенцесушителей: из нержавеющей стали типа «лесенка»",
        "10 шт",
    ),
    "врезка в дымовую систему вентеляции": (
        "ГЭСН34-02-016-03",
        "Пробивка отверстий в кирпичных стенах/коробках при толщине стенок 25 см, уточнить по месту",
        "м",
    ),
    "покраска батарей": (
        "ГЭСНр62-03-006-02",
        "Окраска масляными составами ранее окрашенных поверхностей радиаторов и ребристых труб отопления: за 2 раза",
        "100 м2",
    ),
    "покраска труб водоснабжения": (
        "ГЭСНр62-03-005-02",
        "Окраска масляными составами ранее окрашенных поверхностей труб: стальных за 2 раза",
        "100 м2",
    ),
    "монтаж белых стеновых панелей": (
        "ГЭСН15-01-050-01",
        "Облицовка стен листами из синтетических материалов по деревянной обрешетке",
        "100 м2",
    ),
    "монтаж выключателей": (
        "ГЭСНм08-03-591-02",
        "Выключатель: одноклавишный утопленного типа при скрытой проводке",
        "100 шт",
    ),
    "монтаж силового кабеля штромбовка": (
        "ГЭСНм08-02-403-03",
        "Провода групповых осветительных сетей под штукатурку по стенам или в бороздах",
        "100 м",
    ),
    "шпаклевка после штрамбовки": (
        "ГЭСНр61-01-009",
        "Ремонт штукатурки внутренних стен отдельными местами, уточнить объем заделки штроб",
        "100 м2",
    ),
}


GESN_PRICES = {
    # Prices are reference totals per normative unit, mostly from cs.smetnoedelo.ru
    # for FSNB-2022. Several narrow items are calculated by the same resource method
    # where an exact public price page was not available.
    "ГЭСНр62-01-007-03": 61824.36,
    "ГЭСНр57-01-002-03": 57987.80,
    "ГЭСНр63-02-001-01": 8006.54,
    "ГЭСНр63-03-009-02": 0.0,
    "ГЭСН08-04-001-14": 86486.34,
    "ГЭСН15-02-016-03": 69326.66,
    "ГЭСНр62-02-009": 27999.94,
    "ГЭСНр62-01-007-06": 70755.00,
    "ГЭСН15-01-051-02": 30326.71,
    "ГЭСН15-01-019-05": 111308.80,
    "ГЭСН11-01-047-02": 239898.00,
    "ГЭСН17-01-001-15": 83400.08,
    "ГЭСН17-01-001-02": 24850.00,
    "ГЭСН17-01-002-07": 32380.00,
    "ГЭСН34-02-016-03": 1907.65,
    "ГЭСНр62-03-005-02": 0.0,
    "ГЭСН15-01-050-01": 83410.64,
    "ГЭСНм08-03-591-02": 31724.00,
    "ГЭСНм08-02-403-03": 0.0,
    "ГЭСНр61-01-009": 0.0,
}


MARKET_PRICES = {
    "очистка стен от треснувшей шпаклевки краски": (150, "Рынок Челябинск: очистка стен от краски/шпатлевки, от 150 руб/м2"),
    "демонтаж напольного кафеля": (100, "Рынок Челябинск: демонтаж кафельной/керамической плитки с пола, от 100 руб/м2"),
    "демонтаж обоев": (75, "Рынок Челябинск: очистка стен от обоев, от 75 руб/м2"),
    "демонтаж стеновых панелей": (300, "Рынок Челябинск: демонтаж/монтаж фальшстен ПВХ по каркасу, ориентир 300 руб/м2"),
    "кладка перегородок гипсовыми блоками высота перегородки 2 6 м": (650, "Рынок Челябинск: монтаж перегородок из ПГП/блоков, от 650 руб/м2"),
    "штукатуривание стен": (350, "Рынок Челябинск: штукатурка с выравниванием стен, от 350 руб/м2"),
    "шпаклевка стен везде частичная кроме перегородок склада и коридора": (230, "Рынок Челябинск: шпаклевка стен под покраску, от 230 руб/м2"),
    "покраска стен краской на маслянной основе": (120, "Рынок Челябинск: покраска стен масляной краской 2 раза, от 120 руб/м2"),
    "установка натяжных потолков": (670, "Рынок Челябинск: стандартный натяжной потолок под ключ, ориентир 670 руб/м2"),
    "монтаж кафеля стены пол санузел кухня": (600, "Рынок Челябинск: укладка плитки на стену, от 600 руб/м2"),
    "монтаж на пол плит керамогранит": (750, "Рынок Челябинск: укладка гранитной/керамогранитной плитки, от 750 руб/м2"),
    "установка раковины": (1500, "Рынок Челябинск: установка умывальника/раковины, от 1500 руб/шт"),
    "установка ванной": (2900, "Рынок Челябинск: установка ванны, от 2900 руб/шт"),
    "установка сушилки для полотенец": (2990, "Рынок Челябинск: установка полотенцесушителя, от 2990 руб/шт"),
    "врезка в дымовую систему вентеляции": (1000, "Рынок Челябинск: подключение/врезка к вентиляции, от 1000 руб/шт"),
    "покраска батарей": (450, "Рынок Челябинск: покраска радиаторов до 5 секций, от 450 руб/шт"),
    "покраска труб водоснабжения": (90, "Рынок Челябинск: покраска труб, от 90 руб/м.п"),
    "монтаж белых стеновых панелей": (600, "Рынок Челябинск: монтаж ПВХ-панелей на стену, 600 руб/м2"),
    "монтаж выключателей": (220, "Рынок Челябинск: установка выключателя, от 220 руб/шт"),
    "монтаж силового кабеля штромбовка": (450, "Рынок Челябинск: установка розетки/точки со штроблением, ориентир от 450 руб/шт"),
    "шпаклевка после штрамбовки": (160, "Рынок Челябинск: заделка штробы, от 160 руб/м.п"),
}


def col_to_num(col):
    num = 0
    for ch in col:
        num = num * 26 + ord(ch.upper()) - 64
    return num


def num_to_col(num):
    out = ""
    while num:
        num, rem = divmod(num - 1, 26)
        out = chr(65 + rem) + out
    return out


def split_ref(ref):
    m = re.match(r"([A-Z]+)(\d+)", ref)
    return m.group(1), int(m.group(2))


def cell_name(col, row):
    if isinstance(col, int):
        col = num_to_col(col)
    return f"{col}{row}"


def find_child(parent, tag):
    return parent.find(f"{N}{tag}")


def load_shared_strings(zf):
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    strings = []
    for si in root.findall(f"{N}si"):
        strings.append("".join(t.text or "" for t in si.findall(f".//{N}t")))
    return strings


def first_sheet_path(zf):
    wb = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
    sheet = wb.find(f"{N}sheets/{N}sheet")
    target = rel_map[sheet.attrib[R_ID]]
    return "xl/" + target.lstrip("/") if not target.startswith("xl/") else target


def get_cell(row_el, col):
    wanted = num_to_col(col) if isinstance(col, int) else col
    for cell in row_el.findall(f"{N}c"):
        ref = cell.attrib.get("r", "")
        if ref and split_ref(ref)[0] == wanted:
            return cell
    return None


def remove_value_nodes(cell):
    for child in list(cell):
        if child.tag in {f"{N}v", f"{N}f", f"{N}is"}:
            cell.remove(child)


def set_string(cell, value):
    remove_value_nodes(cell)
    cell.attrib["t"] = "inlineStr"
    is_el = ET.SubElement(cell, f"{N}is")
    t_el = ET.SubElement(is_el, f"{N}t")
    text = "" if value is None else str(value)
    if text != text.strip():
        t_el.attrib[XML_SPACE] = "preserve"
    t_el.text = text


def set_number(cell, value):
    remove_value_nodes(cell)
    cell.attrib.pop("t", None)
    v_el = ET.SubElement(cell, f"{N}v")
    if value is None or (isinstance(value, float) and not math.isfinite(value)):
        v_el.text = ""
    else:
        v_el.text = f"{float(value):.10f}".rstrip("0").rstrip(".")


def clear_cell(cell):
    remove_value_nodes(cell)
    cell.attrib.pop("t", None)


def cell_text(cell, strings):
    if cell is None:
        return ""
    formula = find_child(cell, "f")
    if formula is not None:
        return "=" + (formula.text or "")
    typ = cell.attrib.get("t")
    v = find_child(cell, "v")
    if typ == "s" and v is not None and v.text is not None:
        return strings[int(v.text)]
    if typ == "inlineStr":
        is_el = find_child(cell, "is")
        if is_el is None:
            return ""
        return "".join(t.text or "" for t in is_el.findall(f".//{N}t"))
    return "" if v is None or v.text is None else v.text


def cell_float(cell, strings):
    text = cell_text(cell, strings).strip()
    if not text:
        return None
    try:
        return float(text.replace(",", "."))
    except ValueError:
        return None


def eval_quantity(raw):
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None
    if text.startswith("="):
        text = text[1:]
    text = text.replace(",", ".")
    if not re.fullmatch(r"[0-9+\-*/().\s]+", text):
        return None
    try:
        return float(eval(text, {"__builtins__": {}}, {}))
    except Exception:
        return None


def clean_work_name(name):
    return re.sub(r"^\s*\d+\.\s*", "", name or "").strip()


def normalize(text):
    text = clean_work_name(text).lower().replace("ё", "е")
    text = re.sub(r"[^а-яa-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def read_defect_items(path):
    with zipfile.ZipFile(path) as zf:
        strings = load_shared_strings(zf)
        root = ET.fromstring(zf.read(first_sheet_path(zf)))

    items = []
    section = ""
    for row in root.findall(f"{N}sheetData/{N}row"):
        room = cell_text(get_cell(row, 3), strings).strip()
        name = cell_text(get_cell(row, 4), strings).strip()
        unit = cell_text(get_cell(row, 5), strings).strip()
        qty_raw = cell_text(get_cell(row, 6), strings).strip()
        note = cell_text(get_cell(row, 7), strings).strip()
        if "раздел" in room.lower():
            section = re.sub(r"^\s*\d+\s*раздел\.?\s*", "", room, flags=re.IGNORECASE).strip()
            continue
        if not name or name.lower() == "наименование":
            continue
        items.append(
            {
                "section": section or "Работы",
                "room": room,
                "name": clean_work_name(name),
                "unit": unit,
                "qty_raw": qty_raw,
                "qty": eval_quantity(qty_raw),
                "note": note,
                "key": normalize(name),
            }
        )
    return items


def parse_template_positions(root, strings):
    rows = root.findall(f"{N}sheetData/{N}row")
    by_r = {int(row.attrib["r"]): row for row in rows}
    numeric_rows = []
    for row in rows:
        a_text = cell_text(get_cell(row, 1), strings).strip()
        if re.fullmatch(r"\d+", a_text):
            numeric_rows.append(int(row.attrib["r"]))

    positions = {}
    for idx, start in enumerate(numeric_rows):
        end = numeric_rows[idx + 1] - 1 if idx + 1 < len(numeric_rows) else start
        for r in range(start, min(start + 12, end) + 1):
            c_text = cell_text(get_cell(by_r[r], 3), strings)
            if "Всего по позиции" in c_text:
                end = r
                break
        positions[start] = {"start": start, "end": end, "name": cell_text(get_cell(by_r[start], 3), strings)}
    return by_r, positions


def parse_merges(root):
    merge_el = root.find(f"{N}mergeCells")
    merges = []
    if merge_el is None:
        return merges
    for mc in merge_el.findall(f"{N}mergeCell"):
        start, end = mc.attrib["ref"].split(":")
        c1, r1 = split_ref(start)
        c2, r2 = split_ref(end)
        merges.append((col_to_num(c1), r1, col_to_num(c2), r2))
    return merges


def offset_merge_ref(merge, src_start, dest_start):
    c1, r1, c2, r2 = merge
    offset = dest_start - src_start
    return f"{cell_name(c1, r1 + offset)}:{cell_name(c2, r2 + offset)}"


def clone_row(row_el, dest_row):
    cloned = copy.deepcopy(row_el)
    src_row = int(cloned.attrib["r"])
    cloned.attrib["r"] = str(dest_row)
    for cell in cloned.findall(f"{N}c"):
        ref = cell.attrib.get("r")
        if ref:
            col, _ = split_ref(ref)
            cell.attrib["r"] = cell_name(col, dest_row)
    return cloned, src_row


def conversion_factor(rate_unit):
    unit = (rate_unit or "").strip().lower().replace("²", "2")
    if unit.startswith("100 "):
        return 100.0
    if unit.startswith("10 "):
        return 10.0
    return 1.0


def update_position_block(block_rows, strings, item, pos_number):
    first = block_rows[0]
    old_qty = cell_float(get_cell(first, 9), strings)
    rate_unit = cell_text(get_cell(first, 8), strings).strip()
    factor = conversion_factor(rate_unit)
    qty = item["qty"]
    new_qty = None if qty is None else qty / factor
    ratio = None
    if old_qty not in (None, 0) and new_qty is not None:
        ratio = new_qty / old_qty

    set_string(get_cell(first, 1), str(pos_number))
    set_string(get_cell(first, 3), item["name"])
    if new_qty is not None:
        set_number(get_cell(first, 9), new_qty)
    else:
        clear_cell(get_cell(first, 9))

    total = 0.0
    direct = fot = overhead = profit = 0.0
    for row in block_rows:
        label = cell_text(get_cell(row, 3), strings).strip()
        p_cell = get_cell(row, 16)
        old_total = cell_float(p_cell, strings)
        if p_cell is not None and old_total is not None and ratio is not None:
            new_total = old_total * ratio
            set_number(p_cell, new_total)
            if label == "Итого прямые затраты":
                direct += new_total
            elif label == "ФОТ":
                fot += new_total
            elif label.startswith("НР "):
                overhead += new_total
            elif label.startswith("СП "):
                profit += new_total
            elif label == "Всего по позиции":
                total += new_total
        if label.startswith("Цена="):
            # Keep explanatory price notes untouched.
            continue
    return {"total": total, "direct": direct, "fot": fot, "overhead": overhead, "profit": profit}


def update_unpriced_row(row, item, pos_number, use_gesn=False, use_gesn_prices=False):
    gesn_info = GESN_RATES.get(item["key"]) if use_gesn else None
    price_info = MARKET_PRICES.get(item["key"]) if not use_gesn else None

    unit_price = price_info[0] if price_info else None
    if gesn_info:
        basis = gesn_info[0]
        name = gesn_info[1]
        unit = gesn_info[2]
        if use_gesn_prices:
            price = GESN_PRICES.get(basis)
            if price:
                unit_price = price
    else:
        basis = price_info[1] if price_info else "нет расценки в шаблоне"
        name = item["name"]
        unit = item["unit"]

    qty = item["qty"]
    if gesn_info and qty is not None:
        qty = qty / conversion_factor(unit)
    total = unit_price * qty if unit_price is not None and qty is not None else 0.0

    set_string(get_cell(row, 1), str(pos_number))
    b = get_cell(row, 2)
    if b is not None:
        set_string(b, basis)
    set_string(get_cell(row, 3), name)
    h = get_cell(row, 8)
    i = get_cell(row, 9)
    n = get_cell(row, 14)
    if h is not None:
        set_string(h, unit)
    if i is not None:
        if qty is None:
            clear_cell(i)
        else:
            set_number(i, qty)
    if n is not None:
        if unit_price is None:
            clear_cell(n)
        else:
            set_number(n, unit_price)
    p = get_cell(row, 16)
    if p is not None:
        if total:
            set_number(p, total)
        else:
            clear_cell(p)
    return {"total": total, "direct": total, "fot": 0.0, "overhead": 0.0, "profit": 0.0}


def build(output=OUTPUT, use_gesn=False, use_gesn_prices=False):
    items = read_defect_items(DEFECT)

    manual_map = {
        "демонтаж устаревшего линолеума": [172],
        "демонтаж потолка армстронг со светильниками": [257],
        "грунтовка стен и перегородок": [284],
        "поклейка обоев высокой плотности": [290],
        "укладка линолеума с поклейкой стыков": [234],
        "монтаж плинтуса": [240],
        "покраска стен краской на водоэмульсионной основе": [296],
        "покраска батарей": [308],
        "монтаж розеток": [333, 339, 345],
    }

    with zipfile.ZipFile(TEMPLATE) as zf:
        strings = load_shared_strings(zf)
        sheet_path = first_sheet_path(zf)
        root = ET.fromstring(zf.read(sheet_path))
        rows_by_r, positions = parse_template_positions(root, strings)
        merges = parse_merges(root)

        new_sheet_data = ET.Element(f"{N}sheetData")
        new_merges = []
        merge_seen = set()

        def add_merges_for(src_start, src_end, dest_start):
            for merge in merges:
                _, r1, _, r2 = merge
                if src_start <= r1 and r2 <= src_end:
                    ref = offset_merge_ref(merge, src_start, dest_start)
                    if ref not in merge_seen:
                        merge_seen.add(ref)
                        new_merges.append(ref)

        def append_row_from(src_r, dest_r=None):
            nonlocal next_row
            if dest_r is None:
                dest_r = next_row
            row, src_row = clone_row(rows_by_r[src_r], dest_r)
            new_sheet_data.append(row)
            add_merges_for(src_row, src_row, dest_r)
            next_row = max(next_row, dest_r + 1)
            return row

        next_row = 1
        for src_r in range(1, 39):
            row = append_row_from(src_r, src_r)
            if src_r == 20:
                c = get_cell(row, 1)
                if c is not None:
                    set_string(c, 'Смета по дефектовке ул. 60 лет октября д.18. Магазин "Отделка"')
        next_row = 39

        summary = {"total": 0.0, "direct": 0.0, "fot": 0.0, "overhead": 0.0, "profit": 0.0}
        pos_number = 1

        section_order = []
        for item in items:
            if item["section"] not in section_order:
                section_order.append(item["section"])

        for section_idx, section in enumerate(section_order, 1):
            section_start = next_row
            section_row = append_row_from(39)
            set_string(get_cell(section_row, 1), f"Раздел {section_idx}. {section}")

            section_total = 0.0
            for item in [x for x in items if x["section"] == section]:
                src_blocks = manual_map.get(item["key"])
                if src_blocks:
                    for src_start in src_blocks:
                        pos = positions[src_start]
                        block = []
                        dest_start = next_row
                        for src_r in range(pos["start"], pos["end"] + 1):
                            row = append_row_from(src_r)
                            block.append(row)
                        add_merges_for(pos["start"], pos["end"], dest_start)
                        stats = update_position_block(block, strings, item, pos_number)
                        for key in summary:
                            summary[key] += stats[key]
                        section_total += stats["total"]
                        pos_number += 1
                else:
                    row = append_row_from(41)
                    stats = update_unpriced_row(
                        row,
                        item,
                        pos_number,
                        use_gesn=use_gesn,
                        use_gesn_prices=use_gesn_prices,
                    )
                    for key in summary:
                        summary[key] += stats[key]
                    section_total += stats["total"]
                    pos_number += 1

            total_row = append_row_from(163)
            set_string(get_cell(total_row, 3), f"Всего по разделу {section_idx} {section}")
            set_number(get_cell(total_row, 16), section_total)
            next_row += 1

        footer_start = next_row
        for src_r in range(444, 466):
            row = append_row_from(src_r)
            label = cell_text(get_cell(row, 3), strings).strip()
            p = get_cell(row, 16)
            if p is None:
                continue
            if "Всего прямые затраты" in label:
                set_number(p, summary["direct"])
            elif "Строительные работы" in label:
                set_number(p, summary["total"])
            elif "Монтажные работы" in label:
                set_number(p, 0)
            elif "Всего ФОТ" in label:
                set_number(p, summary["fot"])
            elif "Всего накладные" in label:
                set_number(p, summary["overhead"])
            elif "Всего сметная прибыль" in label:
                set_number(p, summary["profit"])
            elif label == "Всего":
                set_number(p, summary["total"])
            elif "Всего с учетом доп" in label:
                set_number(p, summary["total"])
            elif "Договорной коэффициент" in label:
                set_number(p, summary["total"] * 0.8)
            elif "ВСЕГО по смете" in label:
                set_number(p, summary["total"] * 0.8)
            elif "Компенсация входящего НДС" in label:
                clear_cell(p)
            elif "Материальные ресурсы" in label:
                clear_cell(p)
        add_merges_for(444, 465, footer_start)

        # Top summary values in thousands of rubles.
        total_thousand = summary["total"] * 0.8 / 1000
        for row in new_sheet_data.findall(f"{N}row"):
            r = int(row.attrib["r"])
            if r == 28:
                set_number(get_cell(row, 4), total_thousand)
            elif r == 30:
                set_number(get_cell(row, 4), summary["total"] / 1000)
            elif r in (31, 32, 33):
                set_number(get_cell(row, 4), 0)

        dimension = root.find(f"{N}dimension")
        if dimension is not None:
            dimension.attrib["ref"] = f"A1:IB{next_row - 1}"
        root.attrib[f"{{{NS_MC}}}Ignorable"] = "x14ac xr"

        sheet_view = root.find(f"{N}sheetViews/{N}sheetView")
        if sheet_view is not None:
            sheet_view.attrib["topLeftCell"] = "A1"
            selection = sheet_view.find(f"{N}selection")
            if selection is not None:
                selection.attrib["activeCell"] = "A1"
                selection.attrib["sqref"] = "A1"

        row_breaks = root.find(f"{N}rowBreaks")
        if row_breaks is not None:
            for brk in row_breaks.findall(f"{N}brk"):
                brk.attrib["max"] = str(next_row - 1)

        old_sheet_data = root.find(f"{N}sheetData")
        sheet_index = list(root).index(old_sheet_data)
        root.remove(old_sheet_data)
        root.insert(sheet_index, new_sheet_data)

        old_merge = root.find(f"{N}mergeCells")
        if old_merge is not None:
            root.remove(old_merge)
        merge_el = ET.Element(f"{N}mergeCells", {"count": str(len(new_merges))})
        for ref in new_merges:
            ET.SubElement(merge_el, f"{N}mergeCell", {"ref": ref})
        root.insert(sheet_index + 1, merge_el)

        xml_bytes = ET.tostring(root, encoding="utf-8", xml_declaration=True)

        with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as out:
            for info in zf.infolist():
                data = xml_bytes if info.filename == sheet_path else zf.read(info.filename)
                out.writestr(info, data)

    print(output)
    print(f"Items: {len(items)}")
    print(f"Priced total before contract coef: {summary['total']:.2f}")
    print(f"Total with 0.8 coef: {summary['total'] * 0.8:.2f}")


if __name__ == "__main__":
    build()
