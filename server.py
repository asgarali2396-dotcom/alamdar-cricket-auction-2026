"""
Alamdar Box Cricket Auction 2026 - Real-Time Multi-Device Sync Server
High-concurrency ThreadingHTTPServer serving static PWA files + synchronizing live auction state
across all 12 phones & laptops over local Wi-Fi with sub-millisecond response latency.
Zero external dependencies (uses Python standard library).
"""

import os
import sys
import json
import time
import socket
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

# Ensure correct MIME types on all OS environments (Render Linux / Windows)
SimpleHTTPRequestHandler.extensions_map.update({
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webmanifest': 'application/manifest+json'
})

PORT = int(os.environ.get('PORT', 3000))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, 'auction_data.json')
lock = threading.Lock()

# Stone Sets
SET_CONFIG = [
  { 'id': 'set_aqeeq', 'name': 'Aqeeq', 'meaning': 'Carnelian / Agate', 'color': '#dc2626' },
  { 'id': 'set_firoza', 'name': 'Firoza', 'meaning': 'Turquoise', 'color': '#06b6d4' },
  { 'id': 'set_yaqoot', 'name': 'Yaqoot', 'meaning': 'Ruby', 'color': '#e11d48' },
  { 'id': 'set_zumurrud', 'name': 'Zumurrud', 'meaning': 'Emerald', 'color': '#059669' },
  { 'id': 'set_marjan', 'name': 'Marjan', 'meaning': 'Coral', 'color': '#ea580c' },
  { 'id': 'set_pukhraj', 'name': 'Pukhraj', 'meaning': 'Yellow Sapphire', 'color': '#d97706' },
  { 'id': 'set_neelam', 'name': 'Neelam', 'meaning': 'Blue Sapphire', 'color': '#2563eb' },
  { 'id': 'set_durenajaf', 'name': 'Dur-e-Najaf', 'meaning': 'Pearl Quartz', 'color': '#7c3aed' }
]

INITIAL_TEAMS_RAW = [
  { 'id': 'team_01', 'name': 'Burhani Blasters', 'icon': '⚡', 'username': 'burhani', 'password': 'burhani@2026', 'ownerName': 'Murtaza Bhai', 'phone': '9820011111', 'playingOwner': 'Murtaza (C)', 'color': '#3b82f6' },
  { 'id': 'team_02', 'name': 'Saifee Strikers', 'icon': '🏏', 'username': 'saifee', 'password': 'saifee@2026', 'ownerName': 'Mustafa Bhai', 'phone': '9820022222', 'playingOwner': 'Mustafa (C)', 'color': '#10b981' },
  { 'id': 'team_03', 'name': 'Husaini Hawks', 'icon': '🦅', 'username': 'husaini', 'password': 'husaini@2026', 'ownerName': 'Shabbir Bhai', 'phone': '9820033333', 'playingOwner': 'Shabbir (C)', 'color': '#f59e0b' },
  { 'id': 'team_04', 'name': 'Najmi Knights', 'icon': '🛡️', 'username': 'najmi', 'password': 'najmi@2026', 'ownerName': 'Ali Asgar Bhai', 'phone': '9820044444', 'playingOwner': 'Ali Asgar (C)', 'color': '#ef4444' },
  { 'id': 'team_05', 'name': 'Tayyebi Titans', 'icon': '⚔️', 'username': 'tayyebi', 'password': 'tayyebi@2026', 'ownerName': 'Huzefa Bhai', 'phone': '9820055555', 'playingOwner': 'Huzefa (C)', 'color': '#8b5cf6' },
  { 'id': 'team_06', 'name': 'Qutbi Challengers', 'icon': '🦁', 'username': 'qutbi', 'password': 'qutbi@2026', 'ownerName': 'Taha Bhai', 'phone': '9820066666', 'playingOwner': 'Taha (C)', 'color': '#ec4899' },
  { 'id': 'team_07', 'name': 'Badri Royals', 'icon': '👑', 'username': 'badri', 'password': 'badri@2026', 'ownerName': 'Abbas Bhai', 'phone': '9820077777', 'playingOwner': 'Abbas (C)', 'color': '#14b8a6' },
  { 'id': 'team_08', 'name': 'Fakhri Fighters', 'icon': '🥊', 'username': 'fakhri', 'password': 'fakhri@2026', 'ownerName': 'Zainuddin Bhai', 'phone': '9820088888', 'playingOwner': 'Zainuddin (C)', 'color': '#6366f1' },
  { 'id': 'team_09', 'name': 'Hakimi Super Kings', 'icon': '🏆', 'username': 'hakimi', 'password': 'hakimi@2026', 'ownerName': 'Mohammed Bhai', 'phone': '9820099999', 'playingOwner': 'Mohammed (C)', 'color': '#eab308' },
  { 'id': 'team_10', 'name': 'Imadi Warriors', 'icon': '🏹', 'username': 'imadi', 'password': 'imadi@2026', 'ownerName': 'Adnan Bhai', 'phone': '9820010101', 'playingOwner': 'Adnan (C)', 'color': '#06b6d4' },
  { 'id': 'team_11', 'name': 'Mohammedi Mavericks', 'icon': '🐎', 'username': 'mohammedi', 'password': 'mohammedi@2026', 'ownerName': 'Ibrahim Bhai', 'phone': '9820020202', 'playingOwner': 'Ibrahim (C)', 'color': '#f97316' },
  { 'id': 'team_12', 'name': 'Zahra Superstars', 'icon': '⭐', 'username': 'zahra', 'password': 'zahra@2026', 'ownerName': 'Burhanuddin Bhai', 'phone': '9820030303', 'playingOwner': 'Burhanuddin (C)', 'color': '#84cc16' }
]

FIRST_NAMES = [
  'Husain', 'Ali Asger', 'Taha', 'Burhanuddin', 'Mustafa', 'Abbas', 'Taher', 'Murtaza',
  'Shabbir', 'Huzefa', 'Zainuddin', 'Ibrahim', 'Yusuf', 'Hatira', 'Mansoor', 'Khozema',
  'Kumail', 'Ammar', 'Idris', 'Rashid', 'Farooq', 'Sadiq', 'Qasim', 'Zohair'
]

LAST_NAMES = [
  'Merchant', 'Kapadia', 'Lokhandwala', 'Bagasrawala', 'Chunawala', 'Gondalwala',
  'Rampuri', 'Badri', 'Godhrawala', 'Attarwala', 'Dahodwala', 'Palanpurwala',
  'Karachiwala', 'Poonawala', 'Surti', 'Bhavnagari', 'Ratlamwala', 'Sidhhpurwala'
]

BATSMAN_TYPES = [
  'Right-Hand Aggressive',
  'Left-Hand Power Hitter',
  'Right-Hand Anchor',
  'Left-Hand Classical',
  'Right-Hand Finisher',
  'Pinch Hitter'
]

BOWLER_TYPES = [
  'Right-Arm Medium Fast',
  'Right-Arm Off Spin',
  'Left-Arm Orthodox Spin',
  'Right-Arm Fast Yorker Specialist',
  'Slow Left-Arm Chinaman',
  'Right-Arm Leg Break'
]

SPECIALIZATIONS = [
  'All-Rounder',
  'Top-Order Batsman',
  'Wicket-Keeper Batsman',
  'Death-Overs Bowler',
  'Bowling All-Rounder',
  'Finisher'
]

def generate_default_teams():
    teams = []
    for t in INITIAL_TEAMS_RAW:
        team = dict(t)
        team.update({
            'initialBudget': 100000,
            'remainingBudget': 100000,
            'maxAuctionSlots': 8,
            'acquiredCount': 0,
            'ownedSetIds': [],
            'roster': [{
                'playerId': f"owner_{t['id']}",
                'name': t['playingOwner'],
                'role': 'Playing Owner (Captain)',
                'setId': 'OWNER_PERM',
                'price': 0,
                'isOwner': True
            }]
        })
        teams.append(team)
    return teams

def generate_default_players():
    players = []
    count = 1
    for stone_set in SET_CONFIG:
        for i in range(1, 13):
            f_name = FIRST_NAMES[(count * 3 + i * 5) % len(FIRST_NAMES)]
            l_name = LAST_NAMES[(count * 7 + i * 2) % len(LAST_NAMES)]
            age = 19 + ((count * 4 + i) % 18)
            bat_type = BATSMAN_TYPES[(count + i) % len(BATSMAN_TYPES)]
            bowl_type = BOWLER_TYPES[(count * 2 + i) % len(BOWLER_TYPES)]
            spec = SPECIALIZATIONS[(count * 3 + i) % len(SPECIALIZATIONS)]

            players.append({
                'id': f"ply_{count:03d}",
                'name': f"{f_name} {l_name}",
                'age': age,
                'setId': stone_set['id'],
                'setName': stone_set['name'],
                'batsmanType': bat_type,
                'bowlerType': bowl_type,
                'specialization': spec,
                'basePrice': 1000,
                'status': 'AVAILABLE',
                'soldPrice': None,
                'soldToTeamId': None,
                'soldToTeamName': None,
                'roundNumber': 1,
                'autoAssigned': False
            })
            count += 1
    return players

def generate_default_state():
    return {
        'status': 'IDLE',
        'currentSetId': 'set_aqeeq',
        'currentSetName': 'Aqeeq',
        'currentPlayerId': None,
        'currentPlayer': None,
        'basePrice': 1000,
        'currentBid': 0,
        'nextMinBid': 1000,
        'highestBidderTeamId': None,
        'highestBidderTeamName': None,
        'activeBidders': {'slot1': None, 'slot2': None},
        'hammerCountdown': None,
        'roundNumber': 1,
        'lastActionTimestamp': int(time.time() * 1000),
        'version': 1
    }

# Persistent in-memory data store
server_data = {
    "version": 1,
    "state": generate_default_state(),
    "teams": generate_default_teams(),
    "players": generate_default_players(),
    "sessions": {}
}

_cached_bytes = b""

def update_cache():
    global _cached_bytes
    _cached_bytes = json.dumps(server_data).encode('utf-8')

def save_to_disk():
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(server_data, f)
    except Exception as e:
        print("[Server] Save to disk error:", e)

# Restore previously saved data if valid
if os.path.exists(DATA_FILE):
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            saved = json.load(f)
            if isinstance(saved, dict):
                if saved.get('teams'):
                    server_data['teams'] = saved['teams']
                if saved.get('players'):
                    server_data['players'] = saved['players']
                if saved.get('state'):
                    server_data['state'] = saved['state']
                if saved.get('sessions'):
                    server_data['sessions'] = saved['sessions']
                if saved.get('version'):
                    server_data['version'] = saved['version']
                print(f"[Server] Restored tournament data from {DATA_FILE} (Version {server_data['version']})")
    except Exception as err:
        print("[Server] Could not restore saved data, using defaults:", err)

update_cache()


class AuctionSyncHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        # Enable CORS and disable caching so every device gets real-time data
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        # API: Real-time sync poll endpoint (< 1ms response)
        if self.path == '/api/sync' or self.path.startswith('/api/sync?'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(_cached_bytes)))
            self.end_headers()
            self.wfile.write(_cached_bytes)
            return

        # Serve static files
        super().do_GET()

    def do_POST(self):
        # API: Real-time state update endpoint
        if self.path == '/api/sync':
            length = int(self.headers.get('Content-Length', 0))
            raw_body = self.rfile.read(length).decode('utf-8')
            try:
                incoming = json.loads(raw_body)
                with lock:
                    if 'state' in incoming and incoming['state'] is not None:
                        server_data['state'] = incoming['state']
                    if 'teams' in incoming and incoming['teams'] is not None:
                        server_data['teams'] = incoming['teams']
                    if 'players' in incoming and incoming['players'] is not None:
                        server_data['players'] = incoming['players']
                    if 'sessions' in incoming and incoming['sessions'] is not None:
                        server_data['sessions'] = incoming['sessions']

                    server_data['version'] = int(server_data.get('version', 0)) + 1
                    update_cache()
                    save_to_disk()

                resp_bytes = json.dumps({"success": True, "version": server_data['version']}).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(resp_bytes)))
                self.end_headers()
                self.wfile.write(resp_bytes)
            except Exception as e:
                err_bytes = json.dumps({"error": str(e)}).encode('utf-8')
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(err_bytes)))
                self.end_headers()
                self.wfile.write(err_bytes)
            return

        # API: Reset endpoint
        if self.path == '/api/reset':
            with lock:
                server_data['state'] = generate_default_state()
                server_data['teams'] = generate_default_teams()
                server_data['players'] = generate_default_players()
                server_data['sessions'] = {}
                server_data['version'] = int(server_data.get('version', 0)) + 1
                update_cache()
                save_to_disk()

            resp_bytes = json.dumps({"success": True, "version": server_data['version']}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(resp_bytes)))
            self.end_headers()
            self.wfile.write(resp_bytes)
            return

        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        # Mute high-frequency sync polling logs so terminal output stays clean
        if len(args) > 0 and '/api/sync' in str(args[0]):
            return
        super().log_message(format, *args)


def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'

def run():
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    local_ip = get_local_ip()
    server_address = ('0.0.0.0', PORT)
    httpd = ThreadingHTTPServer(server_address, AuctionSyncHandler)
    print("==================================================")
    print("Alamdar Box Cricket Real-Time Auction Server")
    print("==================================================")
    print(f"* Local URL (This Laptop)  : http://localhost:{PORT}")
    print(f"* Network URL (All Phones) : http://{local_ip}:{PORT}")
    print("* High-Concurrency Sync    : ENABLED (Multi-threaded)")
    print(f"* Initial Version          : {server_data['version']}")
    print("==================================================")
    httpd.serve_forever()


if __name__ == '__main__':
    run()
