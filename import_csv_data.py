#!/usr/bin/env python3
"""
Alamdar Box Cricket Auction 2026 - CSV Importer
Imports real tournament data from Google Sheets / CSV files:
1. teams.csv: Team Name, Owner Name, Playing Captain, Captain Stone Set
2. players.csv: Player Name, Stone Set, Age, Specialization, Batting Style, Bowling Style, Photo URL

Usage:
  python import_csv_data.py [teams.csv] [players.csv]
  Or place 'teams.csv' and 'players.csv' in the project folder and run:
  python import_csv_data.py
"""

import sys
import os
import csv
import json
import re
import time

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, 'auction_data.json')

SET_CONFIG = [
    {'id': 'set_aqeeq', 'name': 'Aqeeq', 'meaning': 'Carnelian / Agate', 'color': '#dc2626'},
    {'id': 'set_firoza', 'name': 'Firoza', 'meaning': 'Turquoise', 'color': '#06b6d4'},
    {'id': 'set_yaqoot', 'name': 'Yaqoot', 'meaning': 'Ruby', 'color': '#e11d48'},
    {'id': 'set_zumurrud', 'name': 'Zumurrud', 'meaning': 'Emerald', 'color': '#059669'},
    {'id': 'set_marjan', 'name': 'Marjan', 'meaning': 'Coral', 'color': '#ea580c'},
    {'id': 'set_pukhraj', 'name': 'Pukhraj', 'meaning': 'Yellow Sapphire', 'color': '#d97706'},
    {'id': 'set_neelam', 'name': 'Neelam', 'meaning': 'Blue Sapphire', 'color': '#2563eb'},
    {'id': 'set_durenajaf', 'name': 'Dur-e-Najaf', 'meaning': 'Pearl Quartz', 'color': '#7c3aed'}
]

DEFAULT_TEAM_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1',
    '#eab308', '#06b6d4', '#f97316', '#84cc16'
]

DEFAULT_TEAM_ICONS = ['⚡', '🏏', '🦅', '🛡️', '⚔️', '🦁', '👑', '🥊', '🏆', '🏹', '🐎', '⭐']

def match_stone_set(raw_text):
    if not raw_text:
        return SET_CONFIG[0]
    cleaned = raw_text.strip().lower().replace('-', '').replace(' ', '').replace('_', '')
    for s in SET_CONFIG:
        s_clean = s['name'].lower().replace('-', '').replace(' ', '').replace('_', '')
        if s_clean in cleaned or cleaned in s_clean or s['id'].replace('set_', '') in cleaned:
            return s
    return SET_CONFIG[0]

def clean_drive_url(url):
    if not url:
        return ''
    url = str(url).strip()
    # If Google Drive file URL: extract ID
    drive_match = re.search(r'(?:id=|\/d\/|file\/d\/)([a-zA-Z0-9_-]{20,})', url)
    if drive_match:
        file_id = drive_match.group(1)
        return f"https://lh3.googleusercontent.com/d/{file_id}"
    return url

def find_column(row, possible_names):
    for key in row.keys():
        cleaned_key = key.strip().lower().replace('_', ' ').replace('-', ' ')
        for name in possible_names:
            if cleaned_key == name.lower():
                return row[key]
    return ''

def main():
    teams_csv_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE_DIR, 'teams.csv')
    players_csv_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(BASE_DIR, 'players.csv')

    if not os.path.exists(teams_csv_path):
        print(f"Error: Teams CSV file not found at '{teams_csv_path}'")
        print("Please provide teams.csv or pass the file path as the first argument.")
        return

    if not os.path.exists(players_csv_path):
        print(f"Error: Players CSV file not found at '{players_csv_path}'")
        print("Please provide players.csv or pass the file path as the second argument.")
        return

    print("==================================================")
    print("🏏 ALAMDAR BOX CRICKET AUCTION 2026 - CSV IMPORTER")
    print("==================================================")
    print(f"1. Reading Teams from:   {teams_csv_path}")
    print(f"2. Reading Players from: {players_csv_path}")

    # --- Step 1: Read Teams ---
    imported_teams = []
    with open(teams_csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader):
            team_num = idx + 1
            team_id = f"team_{team_num:02d}"

            team_name = find_column(row, ['team name', 'team_name', 'team', 'franchise']).strip() or f"Team {team_num}"
            owner_name = find_column(row, ['owner name', 'owner_name', 'owner', 'franchise owner']).strip() or "Franchise Owner"
            captain_name = find_column(row, ['playing captain', 'captain', 'captain name', 'playing owner']).strip() or owner_name
            raw_set = find_column(row, ['captain stone set', 'stone set', 'captain set', 'set']).strip()

            c_set = match_stone_set(raw_set) if raw_set else SET_CONFIG[idx % len(SET_CONFIG)]
            c_set_id = c_set['id']
            c_set_name = c_set['name']

            phone = find_column(row, ['phone', 'mobile', 'contact', 'whatsapp']).strip() or "9820000000"
            icon = find_column(row, ['icon', 'emoji']).strip() or DEFAULT_TEAM_ICONS[idx % len(DEFAULT_TEAM_ICONS)]
            color = find_column(row, ['color', 'theme']).strip() or DEFAULT_TEAM_COLORS[idx % len(DEFAULT_TEAM_COLORS)]

            clean_user = re.sub(r'[^a-zA-Z0-9]', '', team_name.lower().split()[0]) or f"team{team_num}"
            username = find_column(row, ['username', 'user']).strip() or clean_user
            password = find_column(row, ['password', 'pass']).strip() or f"{username}@2026"

            now_ts = int(time.time() * 1000)

            team_obj = {
                'id': team_id,
                'name': team_name,
                'icon': icon,
                'username': username,
                'password': password,
                'ownerName': owner_name,
                'phone': phone,
                'playingOwner': captain_name,
                'captainSetId': c_set_id,
                'captainSetName': c_set_name,
                'color': color,
                'initialBudget': 100000,
                'remainingBudget': 100000,      # Captain sold at ₹0 cost (full ₹100,000 for auction)
                'maxAuctionSlots': 8,           # Exactly 8 players total per team
                'acquiredCount': 1,             # Captain counts as slot #1
                'ownedSetIds': [c_set_id],      # Blocks purchasing another player from captain's stone set
                'roster': [{
                    'playerId': f"owner_{team_id}",
                    'name': captain_name,
                    'role': 'Playing Owner (Captain)',
                    'setId': c_set_id,
                    'setName': c_set_name,
                    'price': 0,
                    'isOwner': True,
                    'timestamp': now_ts
                }]
            }
            imported_teams.append(team_obj)

    print(f"-> Successfully loaded {len(imported_teams)} teams!")
    for t in imported_teams:
        print(f"   [{t['id']}] {t['name']} | Captain: {t['playingOwner']} | Set: {t['captainSetName']} (Locked)")

    # --- Step 2: Read Players ---
    imported_players = []
    with open(players_csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader):
            p_num = idx + 1
            p_id = f"ply_{p_num:03d}"

            name = find_column(row, ['player name', 'name', 'full name', 'player']).strip()
            if not name:
                continue

            raw_set = find_column(row, ['stone set', 'set', 'set name', 'category']).strip()
            p_set = match_stone_set(raw_set) if raw_set else SET_CONFIG[idx % len(SET_CONFIG)]

            age_str = find_column(row, ['age', 'player age']).strip()
            try:
                age = int(age_str)
            except Exception:
                age = 24

            spec = find_column(row, ['specialization', 'role', 'playing role', 'spec']).strip() or 'All-Rounder'
            bat = find_column(row, ['batting style', 'batsman type', 'batting', 'bat']).strip() or 'Right-Hand Aggressive'
            bowl = find_column(row, ['bowling style', 'bowler type', 'bowling', 'bowl']).strip() or 'Right-Arm Medium Fast'
            photo_raw = find_column(row, ['photo', 'photo url', 'image', 'picture', 'upload your photo', 'drive link']).strip()
            photo = clean_drive_url(photo_raw)

            base_price_str = find_column(row, ['base price', 'base_price', 'price']).strip()
            try:
                base_price = int(base_price_str)
            except Exception:
                base_price = 1000

            player_obj = {
                'id': p_id,
                'name': name,
                'age': age,
                'setId': p_set['id'],
                'setName': p_set['name'],
                'batsmanType': bat,
                'bowlerType': bowl,
                'specialization': spec,
                'photo': photo,
                'basePrice': base_price,
                'status': 'AVAILABLE',
                'soldPrice': None,
                'soldToTeamId': None,
                'soldToTeamName': None,
                'roundNumber': 1,
                'autoAssigned': False
            }
            imported_players.append(player_obj)

    print(f"-> Successfully loaded {len(imported_players)} auction players!")

    # Summary of players per set
    from collections import Counter
    set_counts = Counter(p['setName'] for p in imported_players)
    for s in SET_CONFIG:
        print(f"   Set {s['name']}: {set_counts.get(s['name'], 0)} auction players")

    # --- Step 3: Write to auction_data.json ---
    now_ts = int(time.time() * 1000)
    first_set = SET_CONFIG[0]
    payload = {
        'version': 500,
        'state': {
            'status': 'IDLE',
            'currentSetId': first_set['id'],
            'currentSetName': first_set['name'],
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
            'lastActionTimestamp': now_ts,
            'version': 1,
            'biddingLocked': False
        },
        'teams': imported_teams,
        'players': imported_players,
        'sessions': {}
    }

    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2)

    print("==================================================")
    print("✅ SUCCESS: Tournament data updated in auction_data.json!")
    print(f"   • Total Teams:   {len(imported_teams)} (Each initialized with Playing Captain @ ₹0 cost)")
    print(f"   • Total Players: {len(imported_players)} ready for live auction")
    print(f"   • Starting Purse: ₹100,000 per team (Full purse available for 7 auction slots)")
    print("==================================================")

if __name__ == '__main__':
    main()

