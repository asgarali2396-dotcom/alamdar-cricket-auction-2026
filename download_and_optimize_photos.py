import os
import csv
import re
import io
import urllib.request
import concurrent.futures
from PIL import Image, ImageOps

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PLAYERS_IMG_DIR = os.path.join(BASE_DIR, 'images', 'players')
OWNERS_IMG_DIR = os.path.join(BASE_DIR, 'images', 'owners')

os.makedirs(PLAYERS_IMG_DIR, exist_ok=True)
os.makedirs(OWNERS_IMG_DIR, exist_ok=True)

def extract_drive_id(url):
    if not url:
        return None
    m = re.search(r'(?:id=|\/d\/|file\/d\/)([a-zA-Z0-9_-]{20,})', str(url))
    return m.group(1) if m else None

def fetch_image_bytes(drive_id):
    # Try direct LH3 CDN first
    lh3_url = f"https://lh3.googleusercontent.com/d/{drive_id}"
    try:
        req = urllib.request.Request(lh3_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=12) as res:
            return res.read()
    except Exception:
        pass
    
    # Try uc?export=download fallback
    uc_url = f"https://drive.google.com/uc?id={drive_id}&export=download"
    try:
        req = urllib.request.Request(uc_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=12) as res:
            return res.read()
    except Exception as e:
        raise Exception(f"Failed all download methods for {drive_id}: {e}")

def process_and_save_image(raw_bytes, dest_path, max_dim=600):
    # Check if raw_bytes is a PDF with embedded JPEG
    if raw_bytes.startswith(b'%PDF'):
        start = raw_bytes.find(b'\xff\xd8\xff')
        end = raw_bytes.find(b'endstream')
        if start != -1 and end != -1:
            raw_bytes = raw_bytes[start:end].strip()

    img = Image.open(io.BytesIO(raw_bytes))
    # Correct orientation based on EXIF
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass

    if img.mode in ('RGBA', 'LA', 'P'):
        # Convert transparent background to white for JPEG
        bg = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        bg.paste(img, mask=img.split()[-1] if 'A' in img.mode else None)
        img = bg
    elif img.mode != 'RGB':
        img = img.convert('RGB')

    # Resize proportionally if larger than max_dim
    w, h = img.size
    if max(w, h) > max_dim:
        if w > h:
            new_w = max_dim
            new_h = int(h * (max_dim / w))
        else:
            new_h = max_dim
            new_w = int(w * (max_dim / h))
        img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # Save optimized JPEG
    img.save(dest_path, 'JPEG', quality=85, optimize=True, progressive=True)
    return os.path.getsize(dest_path)

def download_player(item):
    p_num, name, raw_url = item
    dest_file = f"ply_{p_num:03d}.jpg"
    dest_path = os.path.join(PLAYERS_IMG_DIR, dest_file)
    rel_path = f"images/players/{dest_file}"
    
    drive_id = extract_drive_id(raw_url)
    if not drive_id:
        return p_num, name, False, "No Drive ID", rel_path, ""
    
    drive_lh3 = f"https://lh3.googleusercontent.com/d/{drive_id}"
    try:
        data = fetch_image_bytes(drive_id)
        size = process_and_save_image(data, dest_path)
        return p_num, name, True, f"Saved {size//1024} KB", rel_path, drive_lh3
    except Exception as e:
        return p_num, name, False, str(e), rel_path, drive_lh3

def download_owner(item):
    t_num, team_name, owner_name, raw_url = item
    dest_file = f"owner_team_{t_num:02d}.jpg"
    dest_path = os.path.join(OWNERS_IMG_DIR, dest_file)
    rel_path = f"images/owners/{dest_file}"
    
    drive_id = extract_drive_id(raw_url)
    if not drive_id:
        return t_num, owner_name, False, "No Drive ID", rel_path, ""
    
    drive_lh3 = f"https://lh3.googleusercontent.com/d/{drive_id}"
    try:
        data = fetch_image_bytes(drive_id)
        size = process_and_save_image(data, dest_path)
        return t_num, owner_name, True, f"Saved {size//1024} KB", rel_path, drive_lh3
    except Exception as e:
        return t_num, owner_name, False, str(e), rel_path, drive_lh3

def main():
    print("==================================================")
    print("🚀 DOWNLOADING & OPTIMIZING AUCTION PHOTOS")
    print("==================================================")

    # 1. Download Players
    players_csv = os.path.join(BASE_DIR, 'Player_registration_final.csv')
    with open(players_csv, 'r', encoding='utf-8-sig') as f:
        p_rows = list(csv.DictReader(f))

    p_items = []
    for idx, r in enumerate(p_rows):
        p_num = idx + 1
        name = r.get('PLAYER NAME', '').strip()
        url = r.get('PLAYER PHOTO WITH TOPI/CAP', '').strip()
        p_items.append((p_num, name, url))

    print(f"\n[1/2] Processing {len(p_items)} Player Photos (Concurrent Threads)...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        p_results = list(executor.map(download_player, p_items))

    p_success = sum(1 for r in p_results if r[2])
    print(f"-> Players finished: {p_success} / {len(p_items)} successfully downloaded & optimized!")
    for r in p_results:
        if not r[2]:
            print(f"   ⚠️ Player #{r[0]} {r[1]} FAILED: {r[3]}")

    # 2. Download Owners
    owners_csv = os.path.join(BASE_DIR, 'owner_detail.csv')
    with open(owners_csv, 'r', encoding='utf-8-sig') as f:
        o_rows = list(csv.DictReader(f))

    o_items = []
    for idx, r in enumerate(o_rows):
        t_num = idx + 1
        t_name = r.get('TEAM NAME', '').strip()
        o_name = r.get('OWNER NAME', '').strip()
        url = r.get('OWNER PHOTO WITH TOPI/CAP', '').strip()
        o_items.append((t_num, t_name, o_name, url))

    print(f"\n[2/2] Processing {len(o_items)} Owner Photos...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        o_results = list(executor.map(download_owner, o_items))

    o_success = sum(1 for r in o_results if r[2])
    print(f"-> Owners finished: {o_success} / {len(o_items)} successfully downloaded & optimized!")
    for r in o_results:
        if not r[2]:
            print(f"   ⚠️ Owner #{r[0]} {r[1]} FAILED: {r[3]}")

    print("\n✅ All photo assets generated in images/players/ and images/owners/!")

if __name__ == '__main__':
    main()

