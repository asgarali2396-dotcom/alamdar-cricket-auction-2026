import os
import json
import base64
from build_auction_word_doc import load_data, SET_ORDER, BASE_DIR, ASSETS_DIR

def img_to_base64(path):
    if os.path.exists(path):
        with open(path, 'rb') as f:
            ext = os.path.splitext(path)[1].replace('.', '')
            if ext == 'jpg': ext = 'jpeg'
            return f"data:image/{ext};base64,{base64.b64encode(f.read()).decode('ascii')}"
    return ""

def build_printable_html():
    sets_data = load_data()

    alamdar_logo_path = os.path.join(BASE_DIR, 'icons', 'logo-crest-transparent.png')
    if not os.path.exists(alamdar_logo_path):
        alamdar_logo_path = os.path.join(BASE_DIR, 'icons', 'logo.png')
    tournament_logo_path = os.path.join(ASSETS_DIR, 'tournament_logo.png')
    watermark_path = os.path.join(ASSETS_DIR, 'alamdar_watermark.png')

    alamdar_b64 = img_to_base64(alamdar_logo_path)
    tournament_b64 = img_to_base64(tournament_logo_path)
    watermark_b64 = img_to_base64(watermark_path)

    pages_html = []
    total_sets = len(SET_ORDER)

    for idx, cfg in enumerate(SET_ORDER):
        set_key = cfg['key']
        meaning = cfg['meaning']
        s_data = sets_data.get(set_key, {'players': []})
        players = s_data['players']

        gem_path = os.path.join(ASSETS_DIR, cfg['gem_file'])
        gem_b64 = img_to_base64(gem_path)

        # Player rows
        player_rows_html = []
        for r_i, p in enumerate(players):
            is_cap = p.get('is_captain', False)
            if is_cap:
                bg = "rgba(254, 249, 238, 0.90)"
                name_style = "font-weight: 800; color: #b45309;"
                pno_style = "font-weight: 900; color: #b45309;"
            else:
                bg = "rgba(248, 250, 252, 0.50)" if r_i % 2 == 1 else "transparent"
                name_style = "font-weight: 700; color: #0f172a;"
                pno_style = "font-weight: 800; color: #0f3d34;"

            # Order: P. No | Player Name | Age | Bat Style | Bowl Style | Mob
            player_rows_html.append(f"""
                <tr style="background: {bg};">
                    <td class="col-pno" style="{pno_style}">{p['p_no']}</td>
                    <td class="col-name" style="{name_style}">{p['name']}</td>
                    <td class="col-age">{p['age']}</td>
                    <td class="col-style">{p['bat']}</td>
                    <td class="col-style">{p['bowl']}</td>
                    <td class="col-mob">{p['mob']}</td>
                </tr>
            """)

        pages_html.append(f"""
        <div class="sheet-page">
            <div class="page-inner-border">
                <!-- Header Block -->
                <div class="header-table">
                    <div class="header-logo-left">
                        <img src="{alamdar_b64}" alt="Alamdar Sports Club" />
                    </div>
                    <div class="header-center-text">
                        <h1 class="main-title">TURF CLASH CHAMPIONSHIP</h1>
                        <div class="season-badge">SEASON 1 &nbsp;•&nbsp; AMRAVATI 2026</div>
                        <div class="org-by">Organized by</div>
                        <div class="club-title">ALAMDAR SPORTS CLUB AMRAVATI</div>
                    </div>
                    <div class="header-logo-right">
                        <img src="{tournament_b64}" alt="Turf Clash Championship" />
                    </div>
                </div>

                <!-- Center Gemstone Sphere -->
                <div class="gem-sphere-container">
                    <img src="{gem_b64}" alt="{set_key}" class="gem-sphere-img" />
                </div>

                <!-- Set Banner Bar -->
                <div class="set-banner-bar" style="background: #{cfg['banner_hex']}; border-color: #{cfg['border_hex']};">
                    <span class="set-num-label">SET {idx + 1} :</span>
                    <span class="set-title-text">{set_key.upper()} ({meaning.upper()})</span>
                </div>

                <!-- Player Roster Table -->
                <!-- Order: P. No | Player Name | Age | Bat Style | Bowl Style | Mob -->
                <table class="roster-table">
                    <thead>
                        <tr>
                            <th class="col-pno">P. No</th>
                            <th class="col-name">Player Name</th>
                            <th class="col-age">Age</th>
                            <th class="col-style">Bat Style</th>
                            <th class="col-style">Bowl Style</th>
                            <th class="col-mob">Mob</th>
                        </tr>
                    </thead>
                    <tbody>
                        {''.join(player_rows_html)}
                    </tbody>
                </table>

                <!-- Footer -->
                <div class="sheet-footer">
                    <span>Turf Clash Championship Season 1 &nbsp;•&nbsp; Alamdar Sports Club Amravati</span>
                    <span>Page {idx + 1} of {total_sets}</span>
                </div>
            </div>
        </div>
        """)

    full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Turf Clash Championship 2026 - Auction Sets (Print Ready)</title>
<style>
    @page {{
        size: A4 portrait;
        margin: 0;
    }}
    * {{
        box-sizing: border-box;
        margin: 0;
        padding: 0;
    }}
    body {{
        font-family: 'Segoe UI', Arial, Calibri, sans-serif;
        background: #e2e8f0;
        color: #1e293b;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }}
    .sheet-page {{
        width: 210mm;
        height: 297mm;
        margin: 10mm auto;
        background: #ffffff;
        padding: 8mm 10mm;
        box-shadow: 0 4px 15px rgba(0,0,0,0.15);
        page-break-after: always;
        position: relative;
        overflow: hidden;
    }}
    .sheet-page::before {{
        content: "";
        position: absolute;
        top: 54%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 140mm;
        height: 140mm;
        background-image: url('{watermark_b64}');
        background-repeat: no-repeat;
        background-position: center;
        background-size: contain;
        pointer-events: none;
        z-index: 1;
    }}
    @media print {{
        body {{
            background: #ffffff;
        }}
        .sheet-page {{
            margin: 0;
            box-shadow: none;
            width: 210mm;
            height: 297mm;
        }}
    }}
    .page-inner-border {{
        width: 100%;
        height: 100%;
        border: 3.5px double #0F3D34;
        padding: 5mm 6mm;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        position: relative;
        z-index: 2;
        background: transparent;
    }}
    .header-table {{
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 2mm;
    }}
    .header-logo-left img {{
        height: 24mm;
        width: auto;
        object-fit: contain;
    }}
    .header-logo-right img {{
        height: 25mm;
        width: auto;
        object-fit: contain;
    }}
    .header-center-text {{
        text-align: center;
        flex: 1;
        padding: 0 4mm;
    }}
    .main-title {{
        font-family: Arial, sans-serif;
        font-size: 15pt;
        font-weight: 900;
        color: #102a43;
        letter-spacing: 0.5px;
        line-height: 1.1;
    }}
    .season-badge {{
        font-size: 10pt;
        font-weight: 800;
        color: #c8a96a;
        margin-top: 1px;
    }}
    .org-by {{
        font-size: 8.5pt;
        font-style: italic;
        color: #64748b;
        margin-top: 2px;
    }}
    .club-title {{
        font-family: Arial, sans-serif;
        font-size: 11.5pt;
        font-weight: 800;
        color: #0f3d34;
        letter-spacing: 0.5px;
        line-height: 1.15;
    }}
    .gem-sphere-container {{
        text-align: center;
        margin: 1mm 0 2mm 0;
    }}
    .gem-sphere-img {{
        width: 25mm;
        height: 25mm;
        object-fit: contain;
        filter: drop-shadow(0 4px 6px rgba(0,0,0,0.25));
    }}
    .set-banner-bar {{
        color: #ffffff;
        text-align: center;
        padding: 2.2mm 4mm;
        border-radius: 4px;
        border-top: 2px solid #c8a96a;
        border-bottom: 2px solid #c8a96a;
        margin-bottom: 2.5mm;
        box-shadow: 0 2px 4px rgba(0,0,0,0.15);
    }}
    .set-num-label {{
        font-size: 11pt;
        font-weight: 800;
        color: #c8a96a;
        margin-right: 4px;
    }}
    .set-title-text {{
        font-size: 12.5pt;
        font-weight: 900;
        letter-spacing: 0.75px;
    }}
    .roster-table {{
        width: 100%;
        border-collapse: collapse;
        border: 1.5px solid #0f3d34;
        font-size: 9.5pt;
    }}
    .roster-table th {{
        background: #102a43;
        color: #ffffff;
        font-size: 9pt;
        font-weight: 800;
        padding: 2.2mm 2mm;
        border: 1px solid #334e68;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }}
    .roster-table td {{
        padding: 1.7mm 2mm;
        border: 1px solid #cbd5e1;
        line-height: 1.1;
    }}
    .col-pno {{
        width: 7%;
        text-align: center;
    }}
    .col-name {{
        width: 40%;
        text-align: left;
        padding-left: 3mm !important;
    }}
    .col-age {{
        width: 7%;
        text-align: center;
        font-weight: 600;
    }}
    .col-style {{
        width: 11%;
        text-align: center;
        font-weight: 600;
        color: #334155;
    }}
    .col-mob {{
        width: 24%;
        text-align: center;
        font-weight: 700;
        color: #1e293b;
        letter-spacing: 0.5px;
    }}
    .sheet-footer {{
        display: flex;
        justify-content: space-between;
        font-size: 8pt;
        color: #64748b;
        padding-top: 1.5mm;
        border-top: 1px solid #e2e8f0;
    }}
</style>
</head>
<body>
    {''.join(pages_html)}
</body>
</html>
"""
    output_html = os.path.join(BASE_DIR, 'print_auction_sets.html')
    with open(output_html, 'w', encoding='utf-8') as f:
        f.write(full_html)
    print(f"✅ Generated Printable HTML successfully: {output_html}")

if __name__ == '__main__':
    build_printable_html()
