/**
 * Real-time Multi-Tab Storage & Broadcast Channel
 * Supports local peer-to-peer tab sync + optional Firebase Realtime Database
 */

const STORAGE_KEYS = {
  STATE: 'alamdar_auction_state_v1',
  TEAMS: 'alamdar_teams_v1',
  PLAYERS: 'alamdar_players_v1',
  SESSIONS: 'alamdar_sessions_v1',
  CURRENT_USER: 'alamdar_active_user_v1',
  FIREBASE_CONFIG: 'alamdar_firebase_cfg_v1'
};

class RealtimeBus {
  constructor() {
    this.channel = new BroadcastChannel('alamdar_auction_bus');
    this.listeners = [];

    this.channel.onmessage = (event) => {
      this.listeners.forEach((callback) => callback(event.data));
    };

    window.addEventListener('storage', (event) => {
      if (Object.values(STORAGE_KEYS).includes(event.key)) {
        this.listeners.forEach((callback) =>
          callback({ type: 'STORAGE_UPDATE', key: event.key, value: event.newValue })
        );
      }
    });
  }

  emit(type, payload = {}) {
    const message = { type, payload, timestamp: Date.now() };
    this.channel.postMessage(message);
    // Also trigger local callbacks
    this.listeners.forEach((callback) => callback(message));
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }
}

const bus = new RealtimeBus();

const StorageManager = {
  get(key, defaultValue = null) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.error('Storage parse error:', e);
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      bus.emit('DATA_CHANGED', { key, value });
    } catch (e) {
      console.error('Storage save error:', e);
    }
  },

  initializeDefaults() {
    let teams = this.get(STORAGE_KEYS.TEAMS);
    if (!teams || teams.length === 0) {
      teams = window.ALAMDAR_DATA.INITIAL_TEAMS.map((t) => ({
        ...t,
        initialBudget: 100000,
        remainingBudget: 100000,
        maxAuctionSlots: 8,
        acquiredCount: 0,
        ownedSetIds: [],
        roster: [
          {
            playerId: `owner_${t.id}`,
            name: t.playingOwner,
            role: 'Playing Owner (Captain)',
            setId: 'OWNER_PERM',
            price: 0,
            isOwner: true
          }
        ]
      }));
      this.set(STORAGE_KEYS.TEAMS, teams);
    }

    let players = this.get(STORAGE_KEYS.PLAYERS);
    if (!players || players.length === 0) {
      players = window.ALAMDAR_DATA.generate96Players();
      this.set(STORAGE_KEYS.PLAYERS, players);
    }

    let state = this.get(STORAGE_KEYS.STATE);
    if (!state) {
      state = {
        status: 'IDLE', // 'IDLE' | 'BIDDING' | 'COUNTDOWN' | 'SOLD' | 'UNSOLD'
        currentSetId: 'set_aqeeq',
        currentSetName: 'Aqeeq',
        currentPlayerId: null,
        currentPlayer: null,
        basePrice: 1000,
        currentBid: 0,
        nextMinBid: 1000,
        highestBidderTeamId: null,
        highestBidderTeamName: null,
        activeBidders: {
          slot1: null,
          slot2: null
        },
        hammerCountdown: null,
        roundNumber: 1,
        lastActionTimestamp: Date.now(),
        version: 1
      };
      this.set(STORAGE_KEYS.STATE, state);
    }

    return { teams, players, state };
  },

  resetTournament() {
    localStorage.removeItem(STORAGE_KEYS.TEAMS);
    localStorage.removeItem(STORAGE_KEYS.PLAYERS);
    localStorage.removeItem(STORAGE_KEYS.STATE);
    localStorage.removeItem(STORAGE_KEYS.SESSIONS);
    return this.initializeDefaults();
  }
};

window.STORAGE_KEYS = STORAGE_KEYS;
window.StorageManager = StorageManager;
window.auctionBus = bus;
