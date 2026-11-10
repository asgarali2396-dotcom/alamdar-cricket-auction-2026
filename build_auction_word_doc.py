import os
import csv
import re
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL, WD_ROW_HEIGHT_RULE
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(BASE_DIR, 'assets', 'gems')

# 1. Colors & Branding Constants
COLOR_EMERALD_DARK = RGBColor(15, 61, 52)      # #0F3D34
COLOR_EMERALD_MED = RGBColor(19, 78, 67)       # #134E43
COLOR_GOLD = RGBColor(200, 169, 106)           # #C8A96A
COLOR_NAVY = RGBColor(16, 42, 67)              # #102A43
COLOR_TEXT_DARK = RGBColor(30, 41, 59)         # #1E293B
COLOR_TEXT_MUTED = RGBColor(100, 116, 139)     # #64748B
COLOR_WHITE = RGBColor(255, 255, 255)

HEX_EMERALD_DARK = "0F3D34"
HEX_EMERALD_MED = "134E43"
HEX_GOLD = "C8A96A"
HEX_NAVY = "102A43"
HEX_ZEBRA = "F8FAFC"
HEX_WHITE = "FFFFFF"
HEX_BORDER = "CBD5E1"
HEX_CARD_BG = "F7FBF9"
HEX_GOLD_LIGHT = "FEF9EF"

# Stone Metadata & Display configuration
SET_ORDER = [
    {
        'key': 'Aqeeq',
        'meaning': 'Agate',
        'desc': 'Deep Carnelian Red Agate',
        'gem_file': 'aqeeq.png',
        'banner_hex': '8B0000',    # Deep Ruby/Crimson
        'border_hex': 'B91C1C'
    },
    {
        'key': 'Firoza',
        'meaning': 'Turquoise',
        'desc': 'Vibrant Turquoise Sky Blue',
        'gem_file': 'firoza.png',
        'banner_hex': '0D7482',    # Deep Turquoise
        'border_hex': '0E7490'
    },
    {
        'key': 'Yaqoot',
        'meaning': 'Ruby',
        'desc': 'Royal Crimson Red Ruby',
        'gem_file': 'yaqoot.png',
        'banner_hex': '9F1239',    # Rich Crimson
        'border_hex': 'BE123C'
    },
    {
        'key': 'Zumurrud',
        'meaning': 'Emerald',
        'desc': 'Colombian Emerald Green',
        'gem_file': 'zumurrud.png',
        'banner_hex': '065F46',    # Deep Emerald
        'border_hex': '047857'
    },
    {
        'key': 'Neelam',
        'meaning': 'Sapphire',
        'desc': 'Royal Blue Sapphire',
        'gem_file': 'neelam.png',
        'banner_hex': '1E3A8A',    # Royal Navy Blue
        'border_hex': '1D4ED8'
    },
    {
        'key': 'Pukhraj',
        'meaning': 'Yellow Sapphire',
        'desc': 'Imperial Golden Topaz & Yellow Sapphire',
        'gem_file': 'pukhraj.png',
        'banner_hex': 'B45309',    # Warm Amber Gold
        'border_hex': 'D97706'
    },
    {
        'key': 'Dur-e-Najaf',
        'meaning': 'Quartz',
        'desc': 'Pure Crystalline Diamond Quartz',
        'gem_file': 'dur_e_najaf.png',
        'banner_hex': '334155',    # Slate Quartz
        'border_hex': '475569'
    },
    {
        'key': 'Marjan',
        'meaning': 'Coral',
        'desc': 'Radiant Red Coral',
        'gem_file': 'marjan.png',
        'banner_hex': '9A3412',    # Warm Coral Terracotta
        'border_hex': 'C2410C'
    }
]

def norm(s):
    return re.sub(r'[^a-z0-9]', '', str(s).lower())

def clean_phone(phone_str):
    if not phone_str:
        return '-'
    p = str(phone_str).strip()
    # Remove all spaces, dashes, parentheses, plus
    p = re.sub(r'[\s\(\)\-\+]', '', p)
    # If 12 digits and starts with 91, strip country code
    if len(p) == 12 and p.startswith('91'):
        p = p[2:]
    return p if p else '-'

def clean_style(hand_style):
    s = str(hand_style).strip().upper()
    if 'LEFT' in s:
        return 'LHB'
    return 'RHB'

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    for child in list(tcPr):
        if child.tag.endswith('shd'):
            tcPr.remove(child)
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=70, bottom=70, left=100, right=100):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)

def set_table_borders(table, color="CBD5E1", sz="4", val="single"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:left w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:right w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:insideV w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def remove_table_borders(table):
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'<w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'<w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'<w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'<w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'<w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def add_page_border(section, color="0F3D34", sz="12", val="double"):
    sectPr = section._sectPr
    pgBorders = parse_xml(
        f'<w:pgBorders {nsdecls("w")} w:offsetFrom="page">'
        f'<w:top w:val="{val}" w:sz="{sz}" w:space="20" w:color="{color}"/>'
        f'<w:left w:val="{val}" w:sz="{sz}" w:space="20" w:color="{color}"/>'
        f'<w:bottom w:val="{val}" w:sz="{sz}" w:space="20" w:color="{color}"/>'
        f'<w:right w:val="{val}" w:sz="{sz}" w:space="20" w:color="{color}"/>'
        f'</w:pgBorders>'
    )
    sectPr.append(pgBorders)

def prevent_row_split(table):
    for row in table.rows:
        trPr = row._tr.get_or_add_trPr()
        trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))

def load_data():
    tcc_path = r'C:\Users\USER\Desktop\TCC Season 1\Player_registration_final.csv'
    auction_path = os.path.join(BASE_DIR, 'Player_registration_final.csv')
    owner_path = os.path.join(BASE_DIR, 'owner_detail.csv')

    by_photo = {}
    by_name = {}
    if os.path.exists(tcc_path):
        with open(tcc_path, mode='r', encoding='utf-8', errors='ignore') as f:
            for r in csv.DictReader(f):
                p_url = r.get('PLAYER PHOTO WITH TOPI/CAP', '').strip()
                match = re.search(r'id=([a-zA-Z0-9_-]+)', p_url)
                if match:
                    by_photo[match.group(1)] = r
                by_name[norm(r.get('PLAYER NAME', ''))] = r

    sets_data = {cfg['key']: {'players': [], 'captains': []} for cfg in SET_ORDER}

    with open(auction_path, mode='r', encoding='utf-8', errors='ignore') as f:
        for r in csv.DictReader(f):
            s_name = r.get('Stone Set', '').strip()
            p_no = r.get('player no ', '').strip()
            p_name = r.get('PLAYER NAME', '').strip()
            age = r.get('PLAYER AGE', '').strip()
            bat = clean_style(r.get('BATTING HAND STYLE', ''))
            bowl = clean_style(r.get('BOWLING HAND STYLE ', ''))
            p_url = r.get('PLAYER PHOTO WITH TOPI/CAP', '').strip()
            match = re.search(r'id=([a-zA-Z0-9_-]+)', p_url)

            mob = ''
            if match and match.group(1) in by_photo:
                mob = by_photo[match.group(1)].get('MOBILE NUMBER ', '').strip()
            elif norm(p_name) in by_name:
                mob = by_name[norm(p_name)].get('MOBILE NUMBER ', '').strip()

            # Accurate number for Aziz Nagpurwala
            if 'nagpurwala' in p_name.lower():
                mob = '7276319080'

            matched_key = None
            for cfg in SET_ORDER:
                if cfg['key'].lower() == s_name.lower():
                    matched_key = cfg['key']
                    break
            if not matched_key:
                matched_key = s_name
                if matched_key not in sets_data:
                    sets_data[matched_key] = {'players': [], 'captains': []}

            sets_data[matched_key]['players'].append({
                'p_no': p_no,
                'name': p_name.upper().strip(),
                'age': age,
                'mob': clean_phone(mob),
                'bat': bat,
                'bowl': bowl
            })

    if os.path.exists(owner_path):
        with open(owner_path, mode='r', encoding='utf-8', errors='ignore') as f:
            for o in csv.DictReader(f):
                c_set = o.get('Captain Stone Set', '').strip()
                matched_key = None
                for cfg in SET_ORDER:
                    if cfg['key'].lower() in c_set.lower() or c_set.lower() in cfg['key'].lower():
                        matched_key = cfg['key']
                        break
                if matched_key and matched_key in sets_data:
                    c_name = o.get('Playing caption', '').strip()
                    t_name = o.get('TEAM NAME', '').strip()
                    mob = o.get('MOBILE NUMBER ', '').strip()
                    if not mob and 'saifee' in c_name.lower():
                        mob = '9422159115'
                    sets_data[matched_key]['captains'].append({
                        'captain': c_name,
                        'owner': o.get('OWNER NAME', '').strip(),
                        'team': t_name,
                        'mob': clean_phone(mob),
                        'age': o.get('OWNER AGE', '').strip(),
                        'bat': clean_style(o.get('BATTING STYLE', '')),
                        'bowl': clean_style(o.get('Bowling style', ''))
                    })

    return sets_data

def build_word_document():
    sets_data = load_data()
    doc = docx.Document()

    style_normal = doc.styles['Normal']
    font = style_normal.font
    font.name = 'Calibri'
    font.size = Pt(10)
    font.color.rgb = COLOR_TEXT_DARK

    section = doc.sections[0]
    section.page_width = Inches(8.27)      # A4 Width
    section.page_height = Inches(11.69)    # A4 Height
    section.top_margin = Inches(0.40)
    section.bottom_margin = Inches(0.40)
    section.left_margin = Inches(0.50)
    section.right_margin = Inches(0.50)
    add_page_border(section, color=HEX_EMERALD_DARK, sz="12", val="double")

    alamdar_logo_path = os.path.join(BASE_DIR, 'icons', 'logo-crest-transparent.png')
    if not os.path.exists(alamdar_logo_path):
        alamdar_logo_path = os.path.join(BASE_DIR, 'icons', 'logo.png')
    tournament_logo_path = os.path.join(ASSETS_DIR, 'tournament_logo.png')

    total_sets = len(SET_ORDER)

    for idx, cfg in enumerate(SET_ORDER):
        set_key = cfg['key']
        meaning = cfg['meaning']
        s_data = sets_data.get(set_key, {'players': [], 'captains': []})
        players = s_data['players']
        captains = s_data['captains']

        if idx > 0:
            doc.add_page_break()

        # =====================================================
        # 1. HEADER SECTION (Table: Left Logo | Center Text | Right Logo)
        # =====================================================
        header_tbl = doc.add_table(rows=1, cols=3)
        header_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        remove_table_borders(header_tbl)

        col_widths = [Inches(1.4), Inches(4.47), Inches(1.4)]
        row = header_tbl.rows[0]
        row.height = Pt(70)
        row.height_rule = WD_ROW_HEIGHT_RULE.EXACTLY

        for i, w in enumerate(col_widths):
            row.cells[i].width = w
            row.cells[i].vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            set_cell_margins(row.cells[i], top=0, bottom=0, left=30, right=30)

        # Left Cell: Alamdar Logo
        cell_left = row.cells[0]
        p_left = cell_left.paragraphs[0]
        p_left.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_left.paragraph_format.space_before = Pt(0)
        p_left.paragraph_format.space_after = Pt(0)
        if os.path.exists(alamdar_logo_path):
            run_logo1 = p_left.add_run()
            run_logo1.add_picture(alamdar_logo_path, width=Inches(1.15))

        # Center Cell: Tournament Text
        cell_mid = row.cells[1]
        p_mid = cell_mid.paragraphs[0]
        p_mid.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_mid.paragraph_format.space_before = Pt(0)
        p_mid.paragraph_format.space_after = Pt(1)
        p_mid.paragraph_format.line_spacing = 1.05

        run_t1 = p_mid.add_run("TURF CLASH CHAMPIONSHIP\n")
        run_t1.font.name = 'Arial'
        run_t1.font.size = Pt(14)
        run_t1.font.bold = True
        run_t1.font.color.rgb = COLOR_NAVY

        run_sub1 = p_mid.add_run("SEASON 1  •  AMRAVATI 2026\n")
        run_sub1.font.name = 'Arial'
        run_sub1.font.size = Pt(10)
        run_sub1.font.bold = True
        run_sub1.font.color.rgb = COLOR_GOLD

        run_org = p_mid.add_run("Organized by\n")
        run_org.font.name = 'Calibri'
        run_org.font.size = Pt(9)
        run_org.font.italic = True
        run_org.font.color.rgb = COLOR_TEXT_MUTED

        run_host = p_mid.add_run("ALAMDAR SPORTS CLUB AMRAVATI")
        run_host.font.name = 'Arial'
        run_host.font.size = Pt(11.5)
        run_host.font.bold = True
        run_host.font.color.rgb = COLOR_EMERALD_DARK

        # Right Cell: Tournament Logo
        cell_right = row.cells[2]
        p_right = cell_right.paragraphs[0]
        p_right.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_right.paragraph_format.space_before = Pt(0)
        p_right.paragraph_format.space_after = Pt(0)
        if os.path.exists(tournament_logo_path):
            run_logo2 = p_right.add_run()
            run_logo2.add_picture(tournament_logo_path, width=Inches(1.30))

        # =====================================================
        # 2. GEMSTONE SPHERE (Center Graphic)
        # =====================================================
        gem_path = os.path.join(ASSETS_DIR, cfg['gem_file'])
        p_gem = doc.add_paragraph()
        p_gem.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_gem.paragraph_format.space_before = Pt(2)
        p_gem.paragraph_format.space_after = Pt(3)
        p_gem.paragraph_format.line_spacing = 1.0

        if os.path.exists(gem_path):
            run_gem = p_gem.add_run()
            run_gem.add_picture(gem_path, width=Inches(1.22))

        # =====================================================
        # 3. SET BANNER BAR
        # =====================================================
        banner_tbl = doc.add_table(rows=1, cols=1)
        banner_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        banner_cell = banner_tbl.cell(0, 0)
        banner_cell.width = Inches(7.27)
        banner_cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        set_cell_background(banner_cell, cfg['banner_hex'])
        set_cell_margins(banner_cell, top=60, bottom=60, left=100, right=100)

        tcPr = banner_cell._tc.get_or_add_tcPr()
        b_borders = parse_xml(
            f'<w:tcBorders {nsdecls("w")}>'
            f'<w:top w:val="single" w:sz="8" w:space="0" w:color="{HEX_GOLD}"/>'
            f'<w:bottom w:val="single" w:sz="8" w:space="0" w:color="{HEX_GOLD}"/>'
            f'<w:left w:val="none"/>'
            f'<w:right w:val="none"/>'
            f'</w:tcBorders>'
        )
        tcPr.append(b_borders)

        p_banner = banner_cell.paragraphs[0]
        p_banner.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_banner.paragraph_format.space_before = Pt(0)
        p_banner.paragraph_format.space_after = Pt(0)
        p_banner.paragraph_format.line_spacing = 1.0

        run_b_num = p_banner.add_run(f"SET {idx + 1} : ")
        run_b_num.font.name = 'Arial'
        run_b_num.font.size = Pt(12)
        run_b_num.font.bold = True
        run_b_num.font.color.rgb = COLOR_GOLD

        run_b_name = p_banner.add_run(f"{set_key.upper()} ({meaning.upper()})")
        run_b_name.font.name = 'Arial'
        run_b_name.font.size = Pt(13)
        run_b_name.font.bold = True
        run_b_name.font.color.rgb = COLOR_WHITE

        # Spacer between banner and table
        p_space = doc.add_paragraph()
        p_space.paragraph_format.space_before = Pt(0)
        p_space.paragraph_format.space_after = Pt(3)
        p_space.paragraph_format.line_spacing = 1.0

        # =====================================================
        # 4. PLAYER ROSTER TABLE
        # =====================================================
        # Columns: P. No | Player Name | Age | Mob | Bat Style | Bowl Style
        tbl_cols = [Inches(0.60), Inches(2.72), Inches(0.55), Inches(1.50), Inches(0.95), Inches(0.95)]
        num_rows = len(players) + 1

        roster_tbl = doc.add_table(rows=num_rows, cols=6)
        roster_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        set_table_borders(roster_tbl, color="CBD5E1", sz="4", val="single")

        header_row = roster_tbl.rows[0]
        header_row.height = Pt(22)
        header_row.height_rule = WD_ROW_HEIGHT_RULE.EXACTLY
        h_titles = ["P. No", "Player Name", "Age", "Mob", "Bat Style", "Bowl Style"]
        h_aligns = [WD_ALIGN_PARAGRAPH.CENTER, WD_ALIGN_PARAGRAPH.LEFT, WD_ALIGN_PARAGRAPH.CENTER,
                    WD_ALIGN_PARAGRAPH.CENTER, WD_ALIGN_PARAGRAPH.CENTER, WD_ALIGN_PARAGRAPH.CENTER]

        for col_i, title in enumerate(h_titles):
            cell = header_row.cells[col_i]
            cell.width = tbl_cols[col_i]
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            set_cell_background(cell, HEX_NAVY)
            set_cell_margins(cell, top=60, bottom=60, left=80, right=80)

            p = cell.paragraphs[0]
            p.alignment = h_aligns[col_i]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.0

            run = p.add_run(title)
            run.font.name = 'Arial'
            run.font.size = Pt(9.5)
            run.font.bold = True
            run.font.color.rgb = COLOR_WHITE

        header_trPr = header_row._tr.get_or_add_trPr()
        header_trPr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))

        # Data Rows
        for r_i, p_data in enumerate(players):
            row = roster_tbl.rows[r_i + 1]
            row.height = Pt(21)
            row.height_rule = WD_ROW_HEIGHT_RULE.EXACTLY

            bg_color = HEX_ZEBRA if r_i % 2 == 1 else HEX_WHITE
            row_vals = [
                p_data['p_no'],
                p_data['name'],
                p_data['age'],
                p_data['mob'],
                p_data['bat'],
                p_data['bowl']
            ]

            for col_i, val in enumerate(row_vals):
                cell = row.cells[col_i]
                cell.width = tbl_cols[col_i]
                cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
                set_cell_background(cell, bg_color)
                set_cell_margins(cell, top=50, bottom=50, left=80, right=80)

                p = cell.paragraphs[0]
                p.alignment = h_aligns[col_i]
                p.paragraph_format.space_before = Pt(0)
                p.paragraph_format.space_after = Pt(0)
                p.paragraph_format.line_spacing = 1.0

                run = p.add_run(val)
                run.font.name = 'Calibri'
                run.font.size = Pt(9.5)

                if col_i == 0:  # P. No
                    run.font.bold = True
                    run.font.color.rgb = COLOR_EMERALD_DARK
                elif col_i == 1:  # Player Name
                    run.font.name = 'Arial'
                    run.font.bold = True
                    run.font.size = Pt(9)
                    run.font.color.rgb = COLOR_TEXT_DARK
                elif col_i == 3:  # Mob
                    run.font.name = 'Calibri'
                    run.font.bold = True
                    run.font.color.rgb = COLOR_TEXT_DARK
                else:
                    run.font.color.rgb = COLOR_TEXT_DARK

        prevent_row_split(roster_tbl)

        # =====================================================
        # 5. PRE-ASSIGNED PLAYING CAPTAINS CALLOUT BOX
        # =====================================================
        p_cap_space = doc.add_paragraph()
        p_cap_space.paragraph_format.space_before = Pt(3)
        p_cap_space.paragraph_format.space_after = Pt(1)
        p_cap_space.paragraph_format.line_spacing = 1.0

        cap_tbl = doc.add_table(rows=1, cols=1)
        cap_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        cap_cell = cap_tbl.cell(0, 0)
        cap_cell.width = Inches(7.27)
        cap_cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        set_cell_background(cap_cell, HEX_GOLD_LIGHT)
        set_cell_margins(cap_cell, top=60, bottom=60, left=100, right=100)

        c_tcPr = cap_cell._tc.get_or_add_tcPr()
        c_borders = parse_xml(
            f'<w:tcBorders {nsdecls("w")}>'
            f'<w:top w:val="single" w:sz="6" w:space="0" w:color="{HEX_GOLD}"/>'
            f'<w:bottom w:val="single" w:sz="6" w:space="0" w:color="{HEX_GOLD}"/>'
            f'<w:left w:val="single" w:sz="6" w:space="0" w:color="{HEX_GOLD}"/>'
            f'<w:right w:val="single" w:sz="6" w:space="0" w:color="{HEX_GOLD}"/>'
            f'</w:tcBorders>'
        )
        c_tcPr.append(c_borders)

        p_cap = cap_cell.paragraphs[0]
        p_cap.paragraph_format.space_before = Pt(0)
        p_cap.paragraph_format.space_after = Pt(0)
        p_cap.paragraph_format.line_spacing = 1.05

        run_cap_badge = p_cap.add_run("👑 PRE-ASSIGNED PLAYING CAPTAIN (BASE PRICE: ₹0 / 0 PTS)\n")
        run_cap_badge.font.name = 'Arial'
        run_cap_badge.font.size = Pt(9.5)
        run_cap_badge.font.bold = True
        run_cap_badge.font.color.rgb = RGBColor(180, 83, 9)

        if captains:
            for c_i, c in enumerate(captains):
                sep = "   |   " if c_i > 0 else ""
                run_c_info = p_cap.add_run(
                    f"{sep}• {c['captain'].upper()} ({c['team'].upper()})  [Mob: {c['mob']}  •  Bat: {c['bat']}  •  Bowl: {c['bowl']}]\n"
                )
                run_c_info.font.name = 'Calibri'
                run_c_info.font.size = Pt(9)
                run_c_info.font.bold = True
                run_c_info.font.color.rgb = COLOR_TEXT_DARK
        else:
            run_none = p_cap.add_run("• No playing captain pre-assigned in this set.\n")
            run_none.font.size = Pt(8.5)
            run_none.font.italic = True

        run_note = p_cap.add_run(
            "* Tournament Rule: Playing Captain is pre-acquired by their franchise at ₹0 (Base Price). That franchise cannot bid on any other player from this stone set."
        )
        run_note.font.name = 'Calibri'
        run_note.font.size = Pt(8)
        run_note.font.italic = True
        run_note.font.color.rgb = COLOR_TEXT_MUTED

        # Footer space
        p_foot = doc.add_paragraph()
        p_foot.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        p_foot.paragraph_format.space_before = Pt(3)
        p_foot.paragraph_format.space_after = Pt(0)
        run_foot = p_foot.add_run(f"Turf Clash Championship Season 1  •  Alamdar Sports Club  •  Page {idx + 1} of {total_sets}")
        run_foot.font.name = 'Calibri'
        run_foot.font.size = Pt(8)
        run_foot.font.color.rgb = COLOR_TEXT_MUTED

    output_docx_primary = os.path.join(BASE_DIR, 'Turf_Clash_Championship_Auction_Sets_2026.docx')
    output_docx_alias = os.path.join(BASE_DIR, 'Alamdar_Box_Cricket_Auction_Sets.docx')

    doc.save(output_docx_primary)
    doc.save(output_docx_alias)
    print(f"✅ Generated Word Documents successfully:")
    print(f"   - {output_docx_primary}")
    print(f"   - {output_docx_alias}")

if __name__ == '__main__':
    build_word_document()
