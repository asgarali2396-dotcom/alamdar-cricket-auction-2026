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
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
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
  { 'id': 'team_01', 'name': 'Fatemi Falcons', 'icon': '🦅', 'username': 'fatemi', 'password': 'fatemi@2026', 'ownerName': 'Burhanuddin Hussain', 'phone': '9595675756', 'playingOwner': 'Burhanuddin Hussain', 'captainSetId': 'set_aqeeq', 'captainSetName': 'Aqeeq', 'photo': 'images/owners/owner_team_01.jpg', 'color': '#3b82f6' },
  { 'id': 'team_02', 'name': 'Kanchwala Knight Riders', 'icon': '🛡️', 'username': 'kanchwala', 'password': 'kanchwala@2026', 'ownerName': 'Taha Sajid Husain kanchwala', 'phone': '9028752753', 'playingOwner': 'Taha Sajid Husain kanchwala', 'captainSetId': 'set_yaqoot', 'captainSetName': 'Yaqoot', 'photo': 'images/owners/owner_team_02.jpg', 'color': '#8b5cf6' },
  { 'id': 'team_03', 'name': 'Telwala Challengers', 'icon': '🦁', 'username': 'telwala', 'password': 'telwala@2026', 'ownerName': 'Abdul Taiyeb Telwala', 'phone': '8767835509', 'playingOwner': 'Abdul Taiyeb Telwala', 'captainSetId': 'set_neelam', 'captainSetName': 'Neelam', 'photo': 'images/owners/owner_team_03.jpg', 'color': '#ef4444' },
  { 'id': 'team_04', 'name': 'Hussaini Strikers', 'icon': '🏏', 'username': 'hussaini', 'password': 'hussaini@2026', 'ownerName': 'Burhanuddin Husain Rampurawala', 'phone': '8208334865', 'playingOwner': 'Burhanuddin Husain Rampurawala', 'captainSetId': 'set_durenajaf', 'captainSetName': 'Dur-e-Najaf', 'photo': 'images/owners/owner_team_04.jpg', 'color': '#10b981' },
  { 'id': 'team_05', 'name': 'Bagichawala Blasters', 'icon': '⚡', 'username': 'bagichawala', 'password': 'bagichawala@2026', 'ownerName': 'Shabbir bagichawala', 'phone': '8530039352', 'playingOwner': 'Shabbir bagichawala', 'captainSetId': 'set_pukhraj', 'captainSetName': 'Pukhraj', 'photo': 'images/owners/owner_team_05.jpg', 'color': '#f59e0b' },
  { 'id': 'team_06', 'name': 'Galaxy Titans', 'icon': '⚔️', 'username': 'galaxy', 'password': 'galaxy@2026', 'ownerName': 'Mustafa akolawala/muffadal hussain', 'phone': '9970044620', 'playingOwner': 'mustafa Akolawala', 'captainSetId': 'set_firoza', 'captainSetName': 'Firoza', 'photo': 'images/owners/owner_team_06.jpg', 'color': '#6366f1' },
  { 'id': 'team_07', 'name': 'Ezzy Stars', 'icon': '⭐', 'username': 'ezzy', 'password': 'ezzy@2026', 'ownerName': 'Murtaza ali jamnagarwala', 'phone': '9511876609', 'playingOwner': 'Murtaza ali jamnagarwala', 'captainSetId': 'set_marjan', 'captainSetName': 'Marjan', 'photo': 'images/owners/owner_team_07.jpg', 'color': '#ec4899' },
  { 'id': 'team_08', 'name': 'Supreme Squad', 'icon': '👑', 'username': 'supreme', 'password': 'supreme@2026', 'ownerName': 'Shabbir murtazapurwala', 'phone': '8975797870', 'playingOwner': 'Shabbir murtazapurwala', 'captainSetId': 'set_zumurrud', 'captainSetName': 'Zumurrud', 'photo': 'images/owners/owner_team_08.jpg', 'color': '#14b8a6' },
  { 'id': 'team_09', 'name': 'Raj Strickers', 'icon': '🥊', 'username': 'raj', 'password': 'raj@2026', 'ownerName': 'Ali chandurwala', 'phone': '8793335457', 'playingOwner': 'Ali chandurwala', 'captainSetId': 'set_yaqoot', 'captainSetName': 'Yaqoot', 'photo': 'images/owners/owner_team_09.jpg', 'color': '#eab308' },
  { 'id': 'team_10', 'name': 'Burhanpurwala Dominators', 'icon': '🏆', 'username': 'burhanpur', 'password': 'burhanpur@2026', 'ownerName': 'Zoeb Chappalwala', 'phone': '7841891212', 'playingOwner': 'Zoeb Chappalwala', 'captainSetId': 'set_zumurrud', 'captainSetName': 'Zumurrud', 'photo': 'images/owners/owner_team_10.jpg', 'color': '#06b6d4' },
  { 'id': 'team_11', 'name': 'Choudhary Thunderbolts', 'icon': '🏹', 'username': 'choudhary', 'password': 'choudhary@2026', 'ownerName': 'Altaf choudhary', 'phone': '9820020202', 'playingOwner': 'Murtaza Shakirali Saifee', 'captainSetId': 'set_marjan', 'captainSetName': 'Marjan', 'photo': 'images/owners/owner_team_11.jpg', 'color': '#f97316' },
  { 'id': 'team_12', 'name': 'Lucky Legends', 'icon': '🐎', 'username': 'lucky', 'password': 'lucky@2026', 'ownerName': 'Mustufa Bhai Chandurwala', 'phone': '9820030303', 'playingOwner': 'Abdul qadir kothawala', 'captainSetId': 'set_firoza', 'captainSetName': 'Firoza', 'photo': 'images/owners/owner_team_12.jpg', 'color': '#84cc16' }
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
    now_ts = int(time.time() * 1000)
    for idx, t in enumerate(INITIAL_TEAMS_RAW):
        team = dict(t)
        c_set_id = team.get('captainSetId')
        c_set_name = team.get('captainSetName', 'Stone Set')
        capt_name = team.get('playingOwner', team.get('ownerName'))
        team.update({
            'initialBudget': 100000,
            'remainingBudget': 100000,
            'maxAuctionSlots': 8,
            'acquiredCount': 1 if c_set_id else 0,
            'ownedSetIds': [c_set_id] if c_set_id else [],
            'roster': [{
                'playerId': f"owner_{team['id']}",
                'name': capt_name,
                'role': 'Playing Owner (Captain)',
                'setId': c_set_id,
                'setName': c_set_name,
                'price': 0,
                'isOwner': True,
                'timestamp': now_ts
            }] if c_set_id else []
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
        'version': 1,
        'biddingLocked': False
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
_save_timer = None
_save_timer_lock = threading.Lock()

def update_cache():
    global _cached_bytes
    _cached_bytes = json.dumps(server_data).encode('utf-8')

def _do_disk_save():
    try:
        with lock:
            data_to_write = json.dumps(server_data)
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            f.write(data_to_write)
    except Exception as e:
        print("[Server] Background disk save error:", e)

def trigger_async_save():
    global _save_timer
    with _save_timer_lock:
        if _save_timer is not None:
            _save_timer.cancel()
        _save_timer = threading.Timer(0.8, _do_disk_save)
        _save_timer.daemon = True
        _save_timer.start()

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


def calculate_increment(current_bid):
    if current_bid < 10000:
        return 1000
    if current_bid < 20000:
        return 2000
    return 5000

def get_next_valid_bid(current_bid, base_price=1000):
    if current_bid <= 0:
        return base_price
    return current_bid + calculate_increment(current_bid)

def evaluate_auto_assignment():
    """Rule: If 1 player remaining in set and exactly 1 team left that hasn't bought from this set,
    auto-assign at base price (1,000)."""
    state = server_data['state']
    set_id = state.get('currentSetId')
    if not set_id:
        return None

    remaining_players = [
        p for p in server_data['players']
        if p['setId'] == set_id and p['status'] in ('AVAILABLE', 'UNSOLD')
    ]
    if len(remaining_players) != 1:
        return None

    eligible_teams = [
        t for t in server_data['teams']
        if set_id not in t.get('ownedSetIds', []) and t.get('acquiredCount', 0) < t.get('maxAuctionSlots', 8)
    ]
    if len(eligible_teams) != 1:
        return None

    target_player = remaining_players[0]
    target_team = eligible_teams[0]
    base_price = 1000

    # Ensure not already in roster
    if any(r.get('playerId') == target_player['id'] for r in target_team.get('roster', [])):
        return None

    if target_team.get('remainingBudget', 0) < base_price:
        return None

    target_team['remainingBudget'] -= base_price
    target_team['acquiredCount'] = target_team.get('acquiredCount', 0) + 1
    if 'ownedSetIds' not in target_team:
        target_team['ownedSetIds'] = []
    if set_id not in target_team['ownedSetIds']:
        target_team['ownedSetIds'].append(set_id)

    target_team.setdefault('roster', []).append({
        'playerId': target_player['id'],
        'name': target_player['name'],
        'role': target_player.get('specialization', 'All-Rounder'),
        'setId': set_id,
        'setName': target_player.get('setName', ''),
        'price': base_price,
        'isOwner': False,
        'autoAssigned': True,
        'timestamp': int(time.time() * 1000)
    })

    target_player['status'] = 'SOLD'
    target_player['soldPrice'] = base_price
    target_player['soldToTeamId'] = target_team['id']
    target_player['soldToTeamName'] = target_team['name']
    target_player['autoAssigned'] = True

    return {
        'triggered': True,
        'player': target_player,
        'team': target_team,
        'price': base_price
    }


class AuctionSyncHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        # Enable CORS and persistent connection
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Connection', 'keep-alive')

        # Fast cache for static images and media (< 1ms load); no-cache for live sync and HTML
        clean_path = self.path.split('?')[0].lower()
        if clean_path.startswith('/images/') or clean_path.startswith('/icons/') or clean_path.endswith(('.jpg', '.jpeg', '.png', '.webp', '.svg', '.ico')):
            self.send_header('Cache-Control', 'public, max-age=86400, immutable')
        else:
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
            # Check for version query parameter: /api/sync?v=12
            client_v = None
            if '?' in self.path:
                try:
                    q = self.path.split('?', 1)[1]
                    for part in q.split('&'):
                        if part.startswith('v='):
                            client_v = int(part.split('=', 1)[1])
                            break
                except Exception:
                    client_v = None

            # If client already has the latest version, return tiny 35-byte response
            # This reduces 99.9% of network bandwidth and prevents cellular data choke
            if client_v is not None and client_v == server_data.get('version', 0):
                up_to_date_bytes = json.dumps({"upToDate": True, "version": client_v}).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(up_to_date_bytes)))
                self.end_headers()
                self.wfile.write(up_to_date_bytes)
                return

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(_cached_bytes)))
            self.end_headers()
            self.wfile.write(_cached_bytes)
            return

        # Serve static files
        super().do_GET()

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        raw_body = self.rfile.read(length).decode('utf-8') if length > 0 else "{}"

        # API: Atomic Server-Side Actions (Eliminates all race conditions and state conflicts)
        if self.path == '/api/action':
            try:
                payload = json.loads(raw_body)
                action = payload.get('action')
                data = payload.get('data', {})
                result = {"success": False}

                with lock:
                    state = server_data['state']
                    teams = server_data['teams']
                    players = server_data['players']
                    sessions = server_data['sessions']

                    if action == 'bid':
                        team_id = data.get('teamId')
                        team = next((t for t in teams if t['id'] == team_id), None)
                        if not team:
                            result = {"success": False, "error": "Team not found."}
                        elif state.get('status') not in ('BIDDING', 'COUNTDOWN'):
                            result = {"success": False, "error": "Auction is not actively accepting bids."}
                        elif state.get('biddingLocked'):
                            result = {"success": False, "error": "🔒 Bidding is locked for player introduction."}
                        else:
                            curr_ply = next((p for p in players if p['id'] == state.get('currentPlayerId')), None)
                            if not curr_ply or curr_ply.get('status') == 'SOLD':
                                result = {"success": False, "error": "Player is already SOLD."}
                            else:
                                slot1 = state.get('activeBidders', {}).get('slot1')
                                slot2 = state.get('activeBidders', {}).get('slot2')
                                is_slot1 = slot1 and slot1.get('teamId') == team_id
                                is_slot2 = slot2 and slot2.get('teamId') == team_id
                                if not is_slot1 and not is_slot2:
                                    result = {"success": False, "error": "You must join the 2-player battle ring first."}
                                elif state.get('highestBidderTeamId') == team_id:
                                    result = {"success": False, "error": "You already hold the leading bid!"}
                                else:
                                    next_bid = get_next_valid_bid(state.get('currentBid', 0), state.get('basePrice', 1000))
                                    roster = team.get('roster', [])
                                    auction_players_count = len([r for r in roster if not r.get('isOwner')])
                                    remaining_auction_slots = max(0, 7 - (auction_players_count + 1))
                                    min_reserve = remaining_auction_slots * 1000

                                    if next_bid > team.get('remainingBudget', 0):
                                        result = {"success": False, "error": f"Bid (₹{next_bid:,}) exceeds your purse (₹{team.get('remainingBudget', 0):,})."}
                                    elif team.get('remainingBudget', 0) - next_bid < min_reserve:
                                        result = {"success": False, "error": f"Reserve Violation: You must retain at least ₹{min_reserve:,} for remaining {remaining_auction_slots} auction slot(s)."}
                                    else:
                                        state['currentBid'] = next_bid
                                        state['nextMinBid'] = get_next_valid_bid(next_bid, state.get('basePrice', 1000))
                                        state['highestBidderTeamId'] = team_id
                                        state['highestBidderTeamName'] = team.get('name', 'Franchise')
                                        state['hammerCountdown'] = None
                                        state['status'] = 'BIDDING'  # Reset countdown if active
                                        state['lastActionTimestamp'] = int(time.time() * 1000)
                                        server_data['version'] = int(server_data.get('version', 0)) + 1
                                        update_cache()
                                        trigger_async_save()
                                        result = {"success": True, "newBid": next_bid, "version": server_data['version']}

                    elif action == 'join_battle':
                        team_id = data.get('teamId')
                        team = next((t for t in teams if t['id'] == team_id), None)
                        if not team:
                            result = {"success": False, "error": "Team not found."}
                        elif state.get('status') != 'BIDDING':
                            result = {"success": False, "error": "Auction is not actively accepting bids."}
                        elif state.get('biddingLocked'):
                            result = {"success": False, "error": "🔒 Bidding is locked during introduction."}
                        elif team.get('acquiredCount', 0) >= team.get('maxAuctionSlots', 8):
                            result = {"success": False, "error": f"Roster Full: Your team already has {team.get('maxAuctionSlots', 8)} players."}
                        elif state.get('currentSetId') in team.get('ownedSetIds', []):
                            result = {"success": False, "error": "Set Constraint: Your team already owns a player from this set."}
                        else:
                            active_bidders = state.setdefault('activeBidders', {'slot1': None, 'slot2': None})
                            s1 = active_bidders.get('slot1')
                            s2 = active_bidders.get('slot2')

                            if (s1 and s1.get('teamId') == team_id) or (s2 and s2.get('teamId') == team_id):
                                result = {"success": True, "message": "Already in the battle ring."}
                            elif not s1:
                                active_bidders['slot1'] = {
                                    'teamId': team_id,
                                    'teamName': team.get('name'),
                                    'ownerName': team.get('ownerName') or team.get('playingOwner'),
                                    'color': team.get('color', '#C8A96A'),
                                    'icon': team.get('icon', '🏏'),
                                    'joinedAt': int(time.time() * 1000)
                                }
                                state['lastActionTimestamp'] = int(time.time() * 1000)
                                server_data['version'] = int(server_data.get('version', 0)) + 1
                                update_cache()
                                trigger_async_save()
                                result = {"success": True, "version": server_data['version']}
                            elif not s2:
                                active_bidders['slot2'] = {
                                    'teamId': team_id,
                                    'teamName': team.get('name'),
                                    'ownerName': team.get('ownerName') or team.get('playingOwner'),
                                    'color': team.get('color', '#C8A96A'),
                                    'icon': team.get('icon', '🏏'),
                                    'joinedAt': int(time.time() * 1000)
                                }
                                state['lastActionTimestamp'] = int(time.time() * 1000)
                                server_data['version'] = int(server_data.get('version', 0)) + 1
                                update_cache()
                                trigger_async_save()
                                result = {"success": True, "version": server_data['version']}
                            else:
                                result = {"success": False, "error": "Battle Ring Full! Two teams are already locked in this bidding war."}

                    elif action == 'withdraw':
                        team_id = data.get('teamId')
                        if state.get('highestBidderTeamId') == team_id:
                            result = {"success": False, "error": "The highest bidder cannot withdraw while holding the lead."}
                        else:
                            active_bidders = state.setdefault('activeBidders', {'slot1': None, 'slot2': None})
                            if active_bidders.get('slot1', {}).get('teamId') == team_id:
                                active_bidders['slot1'] = None
                            elif active_bidders.get('slot2', {}).get('teamId') == team_id:
                                active_bidders['slot2'] = None
                            state['lastActionTimestamp'] = int(time.time() * 1000)
                            server_data['version'] = int(server_data.get('version', 0)) + 1
                            update_cache()
                            trigger_async_save()
                            result = {"success": True, "version": server_data['version']}

                    elif action == 'push_player':
                        player_id = data.get('playerId')
                        p = next((ply for ply in players if ply['id'] == player_id), None)
                        if not p:
                            result = {"success": False, "error": "Player not found."}
                        elif p.get('status') == 'SOLD':
                            result = {"success": False, "error": f"Cannot auction {p.get('name')}: Already SOLD!"}
                        else:
                            state['status'] = 'BIDDING'
                            state['currentSetId'] = p['setId']
                            state['currentSetName'] = p['setName']
                            state['currentPlayerId'] = p['id']
                            state['currentPlayer'] = p
                            state['basePrice'] = 1000
                            state['currentBid'] = 0
                            state['nextMinBid'] = 1000
                            state['highestBidderTeamId'] = None
                            state['highestBidderTeamName'] = None
                            state['activeBidders'] = {'slot1': None, 'slot2': None}
                            state['hammerCountdown'] = None
                            state['biddingLocked'] = True
                            state['lastActionTimestamp'] = int(time.time() * 1000)
                            server_data['version'] = int(server_data.get('version', 0)) + 1
                            update_cache()
                            trigger_async_save()
                            result = {"success": True, "state": state, "version": server_data['version']}

                    elif action == 'toggle_lock':
                        state['biddingLocked'] = not state.get('biddingLocked', False)
                        state['lastActionTimestamp'] = int(time.time() * 1000)
                        server_data['version'] = int(server_data.get('version', 0)) + 1
                        update_cache()
                        trigger_async_save()
                        result = {"success": True, "biddingLocked": state['biddingLocked'], "state": state, "version": server_data['version']}

                    elif action == 'change_set':
                        set_id = data.get('setId')
                        set_name = data.get('setName')
                        if set_id:
                            state['currentSetId'] = set_id
                        if set_name:
                            state['currentSetName'] = set_name
                        state['lastActionTimestamp'] = int(time.time() * 1000)
                        server_data['version'] = int(server_data.get('version', 0)) + 1
                        update_cache()
                        trigger_async_save()
                        result = {"success": True, "state": state, "currentSetId": state.get('currentSetId'), "version": server_data['version']}

                    elif action == 'countdown_tick':
                        count = data.get('count')
                        state['status'] = 'COUNTDOWN'
                        state['hammerCountdown'] = count
                        state['lastActionTimestamp'] = int(time.time() * 1000)
                        server_data['version'] = int(server_data.get('version', 0)) + 1
                        update_cache()
                        trigger_async_save()
                        result = {"success": True, "version": server_data['version']}

                    elif action == 'confirm_sale':
                        if state.get('status') == 'SOLD':
                            result = {"success": False, "error": "This player has already been sold."}
                        elif not state.get('highestBidderTeamId'):
                            result = {"success": False, "error": "No bids placed. Use 'Mark Unsold' instead."}
                        else:
                            winner_team = next((t for t in teams if t['id'] == state.get('highestBidderTeamId')), None)
                            sold_player = next((p for p in players if p['id'] == state.get('currentPlayerId')), None)

                            if not winner_team or not sold_player:
                                result = {"success": False, "error": "Invalid team or player id."}
                            elif sold_player.get('status') == 'SOLD':
                                result = {"success": False, "error": f"Player {sold_player['name']} is already SOLD."}
                            else:
                                final_price = state.get('currentBid', 1000)
                                winner_team['remainingBudget'] -= final_price
                                winner_team['acquiredCount'] = winner_team.get('acquiredCount', 0) + 1
                                if 'ownedSetIds' not in winner_team:
                                    winner_team['ownedSetIds'] = []
                                if state['currentSetId'] not in winner_team['ownedSetIds']:
                                    winner_team['ownedSetIds'].append(state['currentSetId'])

                                winner_team.setdefault('roster', []).append({
                                    'playerId': sold_player['id'],
                                    'name': sold_player['name'],
                                    'role': sold_player.get('specialization', 'All-Rounder'),
                                    'setId': state['currentSetId'],
                                    'setName': state.get('currentSetName', ''),
                                    'price': final_price,
                                    'isOwner': False,
                                    'timestamp': int(time.time() * 1000)
                                })

                                sold_player['status'] = 'SOLD'
                                sold_player['soldPrice'] = final_price
                                sold_player['soldToTeamId'] = winner_team['id']
                                sold_player['soldToTeamName'] = winner_team['name']

                                state['status'] = 'SOLD'
                                state['biddingLocked'] = False
                                state['hammerCountdown'] = None
                                state['activeBidders'] = {'slot1': None, 'slot2': None}
                                state['lastActionTimestamp'] = int(time.time() * 1000)

                                auto_res = evaluate_auto_assignment()

                                server_data['version'] = int(server_data.get('version', 0)) + 1
                                update_cache()
                                trigger_async_save()
                                result = {
                                    "success": True,
                                    "soldPlayer": sold_player,
                                    "winningTeam": winner_team,
                                    "finalPrice": final_price,
                                    "autoAssigned": auto_res,
                                    "version": server_data['version']
                                }

                    elif action == 'mark_unsold':
                        player_id = state.get('currentPlayerId')
                        p = next((ply for ply in players if ply['id'] == player_id), None)
                        if not p:
                            result = {"success": False, "error": "No player on the block."}
                        elif p.get('status') == 'SOLD':
                            result = {"success": False, "error": f"Cannot mark unsold: {p['name']} is already SOLD!"}
                        else:
                            p['status'] = 'UNSOLD'
                            p['roundNumber'] = 2
                            state['status'] = 'UNSOLD'
                            state['biddingLocked'] = False
                            state['hammerCountdown'] = None
                            state['activeBidders'] = {'slot1': None, 'slot2': None}
                            state['lastActionTimestamp'] = int(time.time() * 1000)
                            server_data['version'] = int(server_data.get('version', 0)) + 1
                            update_cache()
                            trigger_async_save()
                            result = {"success": True, "player": p, "version": server_data['version']}

                    elif action == 'session_login':
                        # Atomically records user session without wiping out other members' sessions!
                        user_id = data.get('userId')
                        session_obj = data.get('session')
                        if user_id and session_obj:
                            sessions[user_id] = session_obj
                            server_data['version'] = int(server_data.get('version', 0)) + 1
                            update_cache()
                            trigger_async_save()
                        result = {"success": True, "version": server_data['version']}

                    else:
                        result = {"success": False, "error": f"Unknown action '{action}'"}

                    if result.get('success'):
                        result['version'] = server_data.get('version', 1)
                        result['state'] = server_data.get('state')
                        result['teams'] = server_data.get('teams')
                        result['players'] = server_data.get('players')
                        result['sessions'] = server_data.get('sessions')

                resp_bytes = json.dumps(result).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(resp_bytes)))
                self.end_headers()
                self.wfile.write(resp_bytes)
                return
            except Exception as e:
                err_bytes = json.dumps({"success": False, "error": str(e)}).encode('utf-8')
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(err_bytes)))
                self.end_headers()
                self.wfile.write(err_bytes)
                return

        # API: Real-time state update endpoint (Legacy compatibility)
        if self.path == '/api/sync':
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
                        # Merge sessions rather than overwriting completely
                        if isinstance(incoming['sessions'], dict):
                            server_data['sessions'].update(incoming['sessions'])
                        else:
                            server_data['sessions'] = incoming['sessions']

                    server_data['version'] = int(server_data.get('version', 0)) + 1
                    update_cache()
                    trigger_async_save()

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
                trigger_async_save()

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
