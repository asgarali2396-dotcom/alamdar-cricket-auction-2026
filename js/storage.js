/**
 * Real-time Multi-Device Storage & Wi-Fi Sync Engine
 * Synchronizes live auction state, teams, players, bids, and gavel status across all phones & laptops.
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
      this.syncToServer(key, value);
    } catch (e) {
      console.error('Storage save error:', e);
    }
  },

  // Safe local-only default initialization (NEVER pushes blank data to the server!)
  initializeDefaults() {
    let teams = this.get(STORAGE_KEYS.TEAMS);
    if (!teams || teams.length === 0) {
      teams = window.ALAMDAR_DATA.INITIAL_TEAMS.map((t) => ({
        ...t,
        initialBudget: 100000,
        remainingBudget: 100000,
        maxAuctionSlots: 8,
        acquiredCount: t.captainSetId ? 1 : 0,
        ownedSetIds: t.captainSetId ? [t.captainSetId] : [],
        roster: t.captainSetId
          ? [
              {
                playerId: `owner_${t.id}`,
                name: t.playingOwner,
                role: 'Playing Owner (Captain)',
                setId: t.captainSetId,
                setName: t.captainSetName || 'Stone Set',
                price: 0,
                isOwner: true
              }
            ]
          : []
      }));
      localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(teams));
    } else {
      // Ensure existing teams in localStorage have valid credentials & updated TBD captain state
      let updated = false;
      teams = teams.map((team) => {
        const canonical = window.ALAMDAR_DATA.INITIAL_TEAMS.find((t) => t.id === team.id);
        if (canonical) {
          const needsSync =
            !team.username ||
            !team.password ||
            !team.color ||
            team.name !== canonical.name ||
            team.ownerName !== canonical.ownerName ||
            team.playingOwner !== canonical.playingOwner ||
            team.captainSetId !== canonical.captainSetId;

          if (needsSync) {
            updated = true;
            // If captain is pending / unassigned, remove any old dummy pre-assigned captain roster item
            let cleanRoster = team.roster || [];
            let cleanOwnedSets = team.ownedSetIds || [];
            let remBudget = team.remainingBudget;
            let acqCount = team.acquiredCount;

            if (!canonical.captainSetId) {
              const hadDummyCaptain = cleanRoster.some((r) => r.isOwner);
              if (hadDummyCaptain) {
                cleanRoster = cleanRoster.filter((r) => !r.isOwner);
                acqCount = cleanRoster.length;
                remBudget = 100000 - cleanRoster.reduce((sum, r) => sum + (r.isOwner ? 0 : (r.price || 0)), 0);
                cleanOwnedSets = cleanRoster.map((r) => r.setId).filter(Boolean);
              }
            } else {
              const ownerEntryIdx = cleanRoster.findIndex((r) => r.isOwner);
              if (ownerEntryIdx >= 0) {
                cleanRoster[ownerEntryIdx].setId = canonical.captainSetId;
                cleanRoster[ownerEntryIdx].setName = canonical.captainSetName || 'Stone Set';
                cleanRoster[ownerEntryIdx].name = canonical.playingOwner;
              } else {
                cleanRoster.unshift({
                  playerId: `owner_${team.id}`,
                  name: canonical.playingOwner,
                  role: 'Playing Owner (Captain)',
                  setId: canonical.captainSetId,
                  setName: canonical.captainSetName || 'Stone Set',
                  price: 0,
                  isOwner: true
                });
              }
              cleanOwnedSets = Array.from(new Set(cleanRoster.map((r) => r.setId).filter(Boolean)));
              acqCount = cleanRoster.length;
            }

            return {
              ...team,
              name: canonical.name,
              icon: canonical.icon || team.icon,
              username: canonical.username,
              password: canonical.password,
              color: canonical.color || team.color || '#3b82f6',
              ownerName: canonical.ownerName || team.ownerName,
              playingOwner: canonical.playingOwner,
              captainSetId: canonical.captainSetId,
              captainSetName: canonical.captainSetName,
              remainingBudget: remBudget,
              acquiredCount: acqCount,
              ownedSetIds: cleanOwnedSets,
              roster: cleanRoster
            };
          }
        }
        return team;
      });
      if (updated) {
        localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(teams));
      }
    }

    let players = this.get(STORAGE_KEYS.PLAYERS);
    if (!players || players.length === 0) {
      players = window.ALAMDAR_DATA.generate96Players();
      localStorage.setItem(STORAGE_KEYS.PLAYERS, JSON.stringify(players));
    }

    let state = this.get(STORAGE_KEYS.STATE);
    if (!state) {
      state = {
        status: 'IDLE',
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
        version: 1,
        biddingLocked: false
      };
      localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(state));
    }

    // Deduplication & Integrity Sentinel
    if (teams && teams.length > 0 && players && players.length > 0) {
      let teamsDirty = false;
      let playersDirty = false;
      const seenSoldPlayerIds = new Set();

      teams.forEach((team) => {
        if (!team.roster || team.roster.length === 0) return;
        const cleanRoster = [];
        let refundedAmount = 0;
        let removedCount = 0;

        team.roster.forEach((item) => {
          if (item.isOwner) {
            cleanRoster.push(item);
            return;
          }
          if (seenSoldPlayerIds.has(item.playerId)) {
            teamsDirty = true;
            refundedAmount += (item.price || 0);
            removedCount += 1;
            console.warn(`[Integrity] Removed duplicate player ${item.name} (${item.playerId}) from team ${team.name}`);
          } else {
            seenSoldPlayerIds.add(item.playerId);
            cleanRoster.push(item);
          }
        });

        if (removedCount > 0) {
          team.roster = cleanRoster;
          team.remainingBudget += refundedAmount;
          team.acquiredCount = cleanRoster.filter((r) => !r.isOwner).length;
          team.ownedSetIds = [...new Set(cleanRoster.filter((r) => !r.isOwner).map((r) => r.setId))];
        }
      });

      players.forEach((p) => {
        const ownerTeam = teams.find((t) => t.roster && t.roster.some((r) => r.playerId === p.id && !r.isOwner));
        if (ownerTeam) {
          const rItem = ownerTeam.roster.find((r) => r.playerId === p.id);
          if (p.status !== 'SOLD' || p.soldToTeamId !== ownerTeam.id) {
            p.status = 'SOLD';
            p.soldToTeamId = ownerTeam.id;
            p.soldToTeamName = ownerTeam.name;
            if (rItem) p.soldPrice = rItem.price;
            playersDirty = true;
          }
        } else if (p.status === 'SOLD' && !seenSoldPlayerIds.has(p.id)) {
          p.status = 'AVAILABLE';
          p.soldToTeamId = null;
          p.soldToTeamName = null;
          p.soldPrice = null;
          playersDirty = true;
        }
      });

      if (teamsDirty) {
        localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(teams));
      }
      if (playersDirty) {
        localStorage.setItem(STORAGE_KEYS.PLAYERS, JSON.stringify(players));
      }
    }

    return { teams, players, state };
  },

  getActiveUser() {
    try {
      const tabData = sessionStorage.getItem('alamdar_tab_user_v1');
      if (tabData) {
        return JSON.parse(tabData);
      }
      const deviceData = localStorage.getItem('alamdar_device_user_v1') || localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (deviceData) {
        const parsed = JSON.parse(deviceData);
        sessionStorage.setItem('alamdar_tab_user_v1', JSON.stringify(parsed));
        return parsed;
      }
    } catch (e) {
      console.error('Storage getActiveUser error:', e);
    }
    return {
      userId: 'guest_audience',
      role: 'audience',
      teamId: null,
      sessionId: 'sess_audience'
    };
  },

  setActiveUser(user) {
    try {
      if (!user || user.role === 'audience') {
        this.clearActiveUser();
        return;
      }
      sessionStorage.setItem('alamdar_tab_user_v1', JSON.stringify(user));
      localStorage.setItem('alamdar_device_user_v1', JSON.stringify(user));
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      bus.emit('DATA_CHANGED', { key: STORAGE_KEYS.CURRENT_USER, value: user });

      // Atomically notify server of session without wiping other members
      this.executeServerAction('session_login', { userId: user.userId, session: user });
    } catch (e) {
      console.error('Storage setActiveUser error:', e);
    }
  },

  clearActiveUser() {
    try {
      sessionStorage.removeItem('alamdar_tab_user_v1');
      localStorage.removeItem('alamdar_device_user_v1');
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      const guest = {
        userId: 'guest_audience',
        role: 'audience',
        teamId: null,
        sessionId: 'sess_audience'
      };
      bus.emit('DATA_CHANGED', { key: STORAGE_KEYS.CURRENT_USER, value: guest });
    } catch (e) {
      console.error('Storage clearActiveUser error:', e);
    }
  },

  resetTournament() {
    localStorage.removeItem(STORAGE_KEYS.TEAMS);
    localStorage.removeItem(STORAGE_KEYS.PLAYERS);
    localStorage.removeItem(STORAGE_KEYS.STATE);
    localStorage.removeItem(STORAGE_KEYS.SESSIONS);
    this.clearActiveUser();
    this.executeServerAction('reset_tournament');
    return this.initializeDefaults();
  },

  // Multi-Device Real-Time Wi-Fi & Cloud Sync (Render / Local)
  _serverVersion: 0,
  _syncDisabled: false,
  _pollIntervalId: null,
  _connected: false,
  _isPolling: false,

  _setConnectionStatus(connected) {
    if (this._connected === connected) return;
    this._connected = connected;
    const el = document.getElementById('sync-status-indicator');
    if (el) {
      if (connected) {
        el.className = 'sync-status-pill connected';
        el.title = 'Real-time multi-device sync active';
        const textEl = el.querySelector('.sync-text');
        if (textEl) textEl.innerText = 'Live Sync';
      } else {
        el.className = 'sync-status-pill disconnected';
        el.title = 'Connecting to auction sync server...';
        const textEl = el.querySelector('.sync-text');
        if (textEl) textEl.innerText = 'Connecting';
      }
    }
    bus.emit('SYNC_STATUS', { connected });
  },

  // Execute atomic action on server to prevent concurrent race conditions
  async executeServerAction(action, data = {}) {
    if (this._syncDisabled || typeof fetch === 'undefined') {
      return { success: false, offline: true };
    }
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, data })
      });
      if (!res.ok) {
        return { success: false, error: 'Server error: ' + res.status };
      }
      const result = await res.json();
      if (result && result.success) {
        if (result.version) {
          this._serverVersion = Math.max(this._serverVersion, result.version);
        }

        // Directly invoke application render hook so UI reflects changes instantly (0ms)
        if (typeof window.onServerDataReceived === 'function') {
          window.onServerDataReceived(result);
        }
        bus.emit('DATA_CHANGED', { key: STORAGE_KEYS.STATE, value: result.state });

        // Asynchronously persist to localStorage without blocking render
        setTimeout(() => {
          try {
            if (result.state) localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(result.state));
            if (result.teams) localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(result.teams));
            if (result.players) localStorage.setItem(STORAGE_KEYS.PLAYERS, JSON.stringify(result.players));
            if (result.sessions) localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(result.sessions));
          } catch (e) {}
        }, 0);
      }
      return result;
    } catch (err) {
      console.warn('executeServerAction error:', err);
      return { success: false, error: err.message };
    }
  },

  syncToServer(key, value) {
    if (this._syncDisabled || typeof fetch === 'undefined') return;
    const keyMap = {
      [STORAGE_KEYS.STATE]: 'state',
      [STORAGE_KEYS.TEAMS]: 'teams',
      [STORAGE_KEYS.PLAYERS]: 'players',
      [STORAGE_KEYS.SESSIONS]: 'sessions'
    };
    const field = keyMap[key];
    if (!field) return;

    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value })
    })
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404 && (window.location.protocol === 'file:' || !window.location.origin)) {
            this._syncDisabled = true;
            if (this._pollIntervalId) clearInterval(this._pollIntervalId);
          }
          this._setConnectionStatus(false);
          return null;
        }
        this._setConnectionStatus(true);
        return res.json();
      })
      .then((data) => {
        if (data && data.version) {
          this._serverVersion = Math.max(this._serverVersion, data.version);
        }
      })
      .catch((err) => {
        this._setConnectionStatus(false);
        console.warn('Sync POST error (will retry on next poll):', err);
      });
  },

  // High-performance event-driven long-polling loop with keep-alive
  async _runSyncLoop() {
    while (this._pollActive) {
      if (this._syncDisabled) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      try {
        const timeout = 4; // 4-second long-poll timeout (prevents proxy 504 drops & NAT disconnects)
        const url = `/api/sync?v=${encodeURIComponent(this._serverVersion)}&timeout=${timeout}&t=${Date.now()}`;
        const res = await fetch(url, { cache: 'no-store' });

        if (!res.ok) {
          if (res.status === 404 && (window.location.protocol === 'file:' || !window.location.origin)) {
            this._syncDisabled = true;
          }
          this._setConnectionStatus(false);
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }

        const data = await res.json();
        this._setConnectionStatus(true);

        // Heartbeat response: server state unchanged. Immediately loop for next event!
        if (data && data.upToDate) {
          continue;
        }

        if (data && data.version) {
          const isNewVersion = data.version !== this._serverVersion;
          const isInitialSync = this._serverVersion === 0 || !localStorage.getItem(STORAGE_KEYS.STATE);

          if (isNewVersion || isInitialSync) {
            this._serverVersion = data.version;

            // 1. Immediately invoke application render hook (0ms instant response)
            if (typeof window.onServerDataReceived === 'function') {
              window.onServerDataReceived(data);
            }

            // 2. Persist to localStorage asynchronously without blocking main thread
            setTimeout(() => {
              try {
                if (data.state) localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(data.state));
                if (data.teams) localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(data.teams));
                if (data.players) localStorage.setItem(STORAGE_KEYS.PLAYERS, JSON.stringify(data.players));
                if (data.sessions) localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(data.sessions));
              } catch (err) {
                console.warn('Async localStorage persist note:', err);
              }
            }, 0);
          }
        }
      } catch (err) {
        this._setConnectionStatus(false);
        // Quick 400ms reconnect retry prevents long stalls during transient carrier hiccups
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  },

  startServerSync() {
    if (typeof fetch === 'undefined') return;
    if (this._pollActive) return;
    this._pollActive = true;

    // Wakeup sync when user returns to tab / unlocks phone
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          // Trigger quick check
          fetch(`/api/sync?v=${encodeURIComponent(this._serverVersion)}&timeout=0&t=${Date.now()}`, { cache: 'no-store' })
            .then((r) => r.json())
            .then((d) => {
              if (d && d.version && d.version !== this._serverVersion) {
                this._serverVersion = d.version;
                if (typeof window.onServerDataReceived === 'function') {
                  window.onServerDataReceived(d);
                }
              }
            })
            .catch(() => {});
        }
      });
    }

    this._runSyncLoop();
  }
};

window.STORAGE_KEYS = STORAGE_KEYS;
window.StorageManager = StorageManager;
window.auctionBus = bus;

// Automatically initiate sync loop
StorageManager.startServerSync();
