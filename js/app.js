/**
 * Main Application Orchestrator
 * Controls:
 * - Switching between Admin Dashboard, Live Audience Screen, and Team Owner Dashboard
 * - Rendering Realtime State on all views
 * - Single Active Session handling
 * - Set Selector, Player Queue Drawer, Hammer Controls, and Bidding Battle Ring
 */

// Global State
let currentTab = 'live'; // 'live' | 'owner' | 'admin'
let activeUser = null;
let currentAuctionState = null;
let currentTeams = [];
let currentPlayers = [];
let previousBid = 0;
let previousBidder = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.log('SW registration note:', err);
    });
  }

  // Load and seed storage
  const initial = StorageManager.initializeDefaults();
  currentAuctionState = initial.state;
  currentTeams = initial.teams;
  currentPlayers = initial.players;

  // Restore or set user session
  activeUser = StorageManager.get(STORAGE_KEYS.CURRENT_USER, {
    userId: 'guest_audience',
    role: 'audience',
    teamId: null,
    sessionId: 'sess_audience'
  });

  setupEventListeners();
  setupRealtimeListeners();
  renderApp();
  checkSingleSessionHealth();

  // Periodic heartbeat session validator (every 3 seconds)
  setInterval(checkSingleSessionHealth, 3000);
// Modal Helpers
function openLoginModal() {
  const modal = document.getElementById('login-modal');
  const err = document.getElementById('login-error-msg');
  if (err) err.style.display = 'none';
  if (modal) modal.style.display = 'flex';
}

function closeLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.style.display = 'none';
}

// Toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast-item';

  if (type === 'success') {
    toast.style.background = 'rgba(16, 185, 129, 0.9)';
    toast.style.color = '#fff';
    toast.innerHTML = `<span>✓</span><span>${message}</span>`;
  } else if (type === 'error') {
    toast.style.background = 'rgba(244, 63, 94, 0.9)';
    toast.style.color = '#fff';
    toast.innerHTML = `<span>✕</span><span>${message}</span>`;
  } else if (type === 'gold') {
    toast.style.background = 'rgba(245, 158, 11, 0.95)';
    toast.style.color = '#000';
    toast.innerHTML = `<span>⚡</span><span>${message}</span>`;
  } else {
    toast.style.background = 'rgba(30, 41, 59, 0.9)';
    toast.style.color = '#f8fafc';
    toast.innerHTML = `<span>ℹ</span><span>${message}</span>`;
  }

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Single-Active-Session Login Monitor
function checkSingleSessionHealth() {
  if (!activeUser || !activeUser.userId || activeUser.role === 'audience') return;

  const valid = AuctionEngine.validateSession(activeUser.userId, activeUser.sessionId);
  if (!valid) {
    const modal = document.getElementById('session-eviction-modal');
    if (modal) modal.style.display = 'flex';
  }
}

// Real-time Event Subscriptions
function setupRealtimeListeners() {
  window.auctionBus.subscribe((event) => {
    // Refresh local cache
    currentAuctionState = StorageManager.get(STORAGE_KEYS.STATE);
    currentTeams = StorageManager.get(STORAGE_KEYS.TEAMS);
    currentPlayers = StorageManager.get(STORAGE_KEYS.PLAYERS);

    // Audio cue and visual flash if bid updated
    if (currentAuctionState.currentBid > previousBid) {
      if (window.soundManager) window.soundManager.playBidChime();
      triggerBidFlash();
    }
    previousBid = currentAuctionState.currentBid;
    previousBidder = currentAuctionState.highestBidderTeamId;

    renderApp();
  });
}

function triggerBidFlash() {
  const el = document.getElementById('live-bid-display');
  if (el) {
    el.classList.remove('flash-bid-anim');
    void el.offsetWidth; // reflow
    el.classList.add('flash-bid-anim');
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Navigation Tabs with RBAC Protection
  document.querySelectorAll('[data-view-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.getAttribute('data-view-tab');
      
      // Enforce Role Protections:
      if (target === 'admin') {
        if (!activeUser || activeUser.role !== 'admin') {
          showToast('Master Admin login required to access Admin Control.', 'error');
          openLoginModal();
          return;
        }
      }

      if (target === 'owner') {
        if (!activeUser || activeUser.role !== 'owner') {
          showToast('Team Owner login required to access Bidding Dashboard.', 'error');
          openLoginModal();
          return;
        }
      }

      switchView(target);
    });
  });

  // Login Modal triggers
  const openLoginBtn = document.getElementById('open-login-btn');
  if (openLoginBtn) {
    openLoginBtn.addEventListener('click', openLoginModal);
  }

  const closeLoginBtn = document.getElementById('close-login-btn');
  if (closeLoginBtn) {
    closeLoginBtn.addEventListener('click', closeLoginModal);
  }

  // Login Form Submission
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const userVal = document.getElementById('login-username').value;
      const passVal = document.getElementById('login-password').value;
      const errorEl = document.getElementById('login-error-msg');

      const authRes = AuctionEngine.authenticate(userVal, passVal);
      if (authRes.success) {
        activeUser = authRes;
        closeLoginModal();
        showToast(`Welcome, ${authRes.name}!`, 'success');
        
        // Auto-navigate to appropriate view
        if (authRes.role === 'admin') {
          switchView('admin');
        } else if (authRes.role === 'owner') {
          switchView('owner');
        }
        renderApp();
      } else {
        if (errorEl) {
          errorEl.innerText = authRes.error;
          errorEl.style.display = 'block';
        }
      }
    });
  }

  // Logout Trigger
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      AuctionEngine.logout();
      activeUser = {
        userId: 'guest_audience',
        role: 'audience',
        teamId: null,
        sessionId: 'sess_audience'
      };
      showToast('Signed out. Switched to Public Audience Viewer mode.', 'info');
      switchView('live');
      renderApp();
    });
  }

  // Audio Toggle
  const soundToggle = document.getElementById('sound-toggle-btn');
  if (soundToggle) {
    soundToggle.addEventListener('click', () => {
      window.soundManager.enabled = !window.soundManager.enabled;
      soundToggle.innerText = window.soundManager.enabled ? '🔊 Audio ON' : '🔇 Audio OFF';
      showToast(window.soundManager.enabled ? 'Sound enabled' : 'Sound muted');
    });
  }

  // Reset Tournament Button
  const resetBtn = document.getElementById('admin-reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('CRITICAL: Reset all 96 players, 12 team rosters, and budgets back to 1,00,000 coins?')) {
        StorageManager.resetTournament();
        showToast('Tournament has been fully reset to Initial State!', 'error');
        window.location.reload();
      }
    });
  }

  // Owner Actions: Join Battle
  const joinBattleBtn = document.getElementById('owner-join-battle-btn');
  if (joinBattleBtn) {
    joinBattleBtn.addEventListener('click', () => {
      if (!activeUser || !activeUser.teamId) {
        showToast('Please select your team identity first.', 'error');
        return;
      }
      const res = AuctionEngine.joinBattle(activeUser.teamId);
      if (res.success) {
        showToast('Entered the 2-Player Bidding Battle!', 'success');
      } else {
        showToast(res.error, 'error');
      }
    });
  }

  // Owner Actions: Raise Bid
  const raiseBidBtn = document.getElementById('owner-raise-bid-btn');
  if (raiseBidBtn) {
    raiseBidBtn.addEventListener('click', () => {
      if (!activeUser || !activeUser.teamId) return;
      const res = AuctionEngine.placeBid(activeUser.teamId);
      if (res.success) {
        showToast(`Bid raised to ₹${res.newBid.toLocaleString()}!`, 'gold');
      } else {
        showToast(res.error, 'error');
      }
    });
  }

  // Owner Actions: Withdraw
  const withdrawBtn = document.getElementById('owner-withdraw-btn');
  if (withdrawBtn) {
    withdrawBtn.addEventListener('click', () => {
      if (!activeUser || !activeUser.teamId) return;
      const res = AuctionEngine.withdrawFromBattle(activeUser.teamId);
      if (res.success) {
        showToast('Withdrew from bidding ring. Another team can now join.', 'info');
      } else {
        showToast(res.error, 'error');
      }
    });
  }

  // Admin Actions: Hammer SOLD
  const adminSoldBtn = document.getElementById('admin-sold-btn');
  if (adminSoldBtn) {
    adminSoldBtn.addEventListener('click', () => {
      const res = AuctionEngine.confirmSale();
      if (res.success) {
        showToast(`🔨 SOLD! ${res.soldPlayer.name} to ${res.winningTeam.name} for ₹${res.finalPrice.toLocaleString()}`, 'success');
        if (res.autoAssigned && res.autoAssigned.triggered) {
          setTimeout(() => {
            alert(`⚡ AUTO-ASSIGNMENT TRIGGERED!\n\n${res.autoAssigned.player.name} has been automatically assigned to ${res.autoAssigned.team.name} at Base Price (₹1,000) because only 1 player and 1 team remained in set "${res.autoAssigned.player.setName}".`);
          }, 400);
        }
      } else {
        showToast(res.error, 'error');
      }
    });
  }

  // Admin Actions: Mark UNSOLD
  const adminUnsoldBtn = document.getElementById('admin-unsold-btn');
  if (adminUnsoldBtn) {
    adminUnsoldBtn.addEventListener('click', () => {
      const res = AuctionEngine.markPlayerUnsold();
      if (res.success) {
        showToast(`⚠️ Player marked UNSOLD and moved to end of Set queue.`, 'info');
      } else {
        showToast(res.error, 'error');
      }
    });
  }

  // Admin Actions: Countdown 3-2-1
  const countdownBtn = document.getElementById('admin-countdown-btn');
  if (countdownBtn) {
    countdownBtn.addEventListener('click', () => {
      triggerCountdown();
    });
  }

  // Set Selector in Admin View
  const adminSetSelect = document.getElementById('admin-set-select');
  if (adminSetSelect) {
    adminSetSelect.addEventListener('change', (e) => {
      const setId = e.target.value;
      const setName = e.target.options[e.target.selectedIndex].text;
      const state = StorageManager.get(STORAGE_KEYS.STATE);
      state.currentSetId = setId;
      state.currentSetName = setName;
      StorageManager.set(STORAGE_KEYS.STATE, state);
      renderAdminPlayerQueue();
    });
  }

  // Dismiss session eviction modal
  const reauthBtn = document.getElementById('session-reauth-btn');
  if (reauthBtn) {
    reauthBtn.addEventListener('click', () => {
      if (activeUser && activeUser.userId) {
        const sessId = AuctionEngine.registerSession(activeUser.userId, activeUser.role, activeUser.teamId);
        activeUser.sessionId = sessId;
        document.getElementById('session-eviction-modal').style.display = 'none';
        showToast('Session reclaimed on this device.', 'success');
      }
    });
  }
}

// Switch View Tabs
function switchView(tabName) {
  currentTab = tabName;
  document.querySelectorAll('[data-view-tab]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-view-tab') === tabName);
  });

  document.getElementById('view-live').style.display = tabName === 'live' ? 'block' : 'none';
  document.getElementById('view-owner').style.display = tabName === 'owner' ? 'block' : 'none';
  document.getElementById('view-admin').style.display = tabName === 'admin' ? 'block' : 'none';

  renderApp();
}

// Countdown sequence (3, 2, 1)
function triggerCountdown() {
  let count = 3;
  const state = StorageManager.get(STORAGE_KEYS.STATE);
  state.hammerCountdown = count;
  StorageManager.set(STORAGE_KEYS.STATE, state);

  if (window.soundManager) window.soundManager.playHammerStrike();

  const interval = setInterval(() => {
    count--;
    const s = StorageManager.get(STORAGE_KEYS.STATE);
    if (count > 0) {
      s.hammerCountdown = count;
      StorageManager.set(STORAGE_KEYS.STATE, s);
      if (window.soundManager) window.soundManager.playHammerStrike();
    } else {
      clearInterval(interval);
      s.hammerCountdown = 'GOING, GOING...';
      StorageManager.set(STORAGE_KEYS.STATE, s);
      if (window.soundManager) window.soundManager.playHammerStrike();
    }
  }, 1200);
}

// Master Render Function
function renderApp() {
  renderAuthBar();
  renderLiveDisplay();
  renderOwnerDashboard();
  renderAdminDashboard();
}

// Render Top Navbar Auth Controls & Tabs based on active role
function renderAuthBar() {
  const guestControls = document.getElementById('auth-guest-controls');
  const userControls = document.getElementById('auth-user-controls');
  const userBadge = document.getElementById('auth-user-badge');
  const ownerTab = document.getElementById('nav-owner-tab');
  const adminTab = document.getElementById('nav-admin-tab');

  if (!activeUser || activeUser.role === 'audience') {
    if (guestControls) guestControls.style.display = 'flex';
    if (userControls) userControls.style.display = 'none';

    // Public Viewer: Show lock indicators
    if (ownerTab) {
      ownerTab.innerHTML = '🔒 Owner Dashboard';
      ownerTab.title = 'Login required';
    }
    if (adminTab) {
      adminTab.innerHTML = '🔒 Admin Control';
      adminTab.title = 'Admin login required';
    }
  } else {
    if (guestControls) guestControls.style.display = 'none';
    if (userControls) userControls.style.display = 'flex';

    if (activeUser.role === 'admin') {
      if (userBadge) {
        userBadge.innerText = 'Master Admin';
        userBadge.className = 'stone-badge text-amber-300 border-amber-500/40 bg-amber-950/40 text-[11px] py-1 px-2.5';
      }
      if (adminTab) adminTab.innerHTML = '⚡ Admin Control';
      if (ownerTab) ownerTab.innerHTML = '🔒 Owner Dashboard';
    } else if (activeUser.role === 'owner') {
      const team = currentTeams.find((t) => t.id === activeUser.teamId);
      if (userBadge) {
        userBadge.innerText = team ? `${team.name}` : 'Owner';
        userBadge.className = 'stone-badge text-emerald-300 border-emerald-500/40 bg-emerald-950/40 text-[11px] py-1 px-2.5';
      }
      if (ownerTab) ownerTab.innerHTML = '🏏 My Bidding Dashboard';
      if (adminTab) adminTab.innerHTML = '🔒 Admin Control';
    }
  }
}

// -------------------------------------------------------------
// 1. RENDER LIVE PROJECTOR DISPLAY
// -------------------------------------------------------------
function renderLiveDisplay() {
  const p = currentAuctionState.currentPlayer;
  const hasPlayer = Boolean(p && currentAuctionState.status === 'BIDDING');

  // Active Set Badge
  const setBadge = document.getElementById('live-set-badge');
  if (setBadge) {
    setBadge.innerText = `SET: ${currentAuctionState.currentSetName || 'AQEEQ'}`.toUpperCase();
  }

  // Player Name & Details
  const nameEl = document.getElementById('live-player-name');
  const specEl = document.getElementById('live-player-spec');
  const detailsEl = document.getElementById('live-player-details');
  const basePriceEl = document.getElementById('live-player-base-price');

  if (nameEl) nameEl.innerText = hasPlayer ? p.name : 'Waiting for Auctioneer to put player on block...';
  if (specEl) {
    specEl.innerText = hasPlayer ? p.specialization : 'BOX CRICKET 2026';
    specEl.style.display = hasPlayer ? 'inline-block' : 'none';
  }
  if (detailsEl) {
    detailsEl.innerHTML = hasPlayer
      ? `<span>Age: <strong>${p.age}</strong></span> • <span>Bat: <strong>${p.batsmanType}</strong></span> • <span>Bowl: <strong>${p.bowlerType}</strong></span>`
      : '<span>12 Teams • 96 Players • 8 Sets</span>';
  }
  if (basePriceEl) {
    basePriceEl.innerText = hasPlayer ? `₹${p.basePrice.toLocaleString()}` : '₹1,000';
  }

  // Bid Display
  const bidEl = document.getElementById('live-bid-display');
  const bidderEl = document.getElementById('live-highest-bidder-name');
  if (bidEl) bidEl.innerText = `₹${currentAuctionState.currentBid.toLocaleString()}`;
  if (bidderEl) {
    bidderEl.innerText = currentAuctionState.highestBidderTeamName
      ? `Leading: ${currentAuctionState.highestBidderTeamName}`
      : 'Awaiting opening bid at ₹1,000';
  }

  // Two-Player Battle Arena Ring
  const slot1El = document.getElementById('live-battle-slot1');
  const slot2El = document.getElementById('live-battle-slot2');
  const { slot1, slot2 } = currentAuctionState.activeBidders || {};

  if (slot1El) {
    slot1El.innerHTML = slot1
      ? `<div class="p-2 rounded-lg bg-indigo-950/70 border border-indigo-500/50 text-indigo-300 font-bold">🥊 ${slot1.teamName}</div>`
      : `<div class="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-500">Vacant Slot 1</div>`;
  }
  if (slot2El) {
    slot2El.innerHTML = slot2
      ? `<div class="p-2 rounded-lg bg-indigo-950/70 border border-indigo-500/50 text-indigo-300 font-bold">🥊 ${slot2.teamName}</div>`
      : `<div class="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-500">Vacant Slot 2</div>`;
  }

  // Hammer countdown
  const countdownContainer = document.getElementById('live-hammer-countdown-box');
  if (countdownContainer) {
    if (currentAuctionState.hammerCountdown) {
      countdownContainer.style.display = 'flex';
      document.getElementById('live-countdown-text').innerText = `COUNT ${currentAuctionState.hammerCountdown}`;
    } else {
      countdownContainer.style.display = 'none';
    }
  }

  // 12-Team Matrix Table
  const teamGrid = document.getElementById('live-team-matrix-grid');
  if (teamGrid) {
    teamGrid.innerHTML = currentTeams
      .map((t) => {
        const isLeading = t.id === currentAuctionState.highestBidderTeamId;
        const slotsLeft = t.maxAuctionSlots - t.acquiredCount;
        return `
        <div class="p-3 rounded-xl border transition-all ${
          isLeading
            ? 'bg-amber-950/40 border-amber-500 shadow-lg shadow-amber-950/50 ring-1 ring-amber-400'
            : 'bg-slate-900/60 border-slate-800/80'
        }">
          <div class="flex justify-between items-center text-xs">
            <span class="font-bold text-slate-200 truncate max-w-[130px]">${t.name}</span>
            <span class="px-2 py-0.5 rounded-full ${
              t.acquiredCount === 8 ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-800 text-slate-300'
            } font-mono-num font-bold">
              ${t.acquiredCount}/8 Slots
            </span>
          </div>
          <div class="flex justify-between items-end mt-2">
            <div>
              <p class="text-[10px] uppercase text-slate-500 tracking-wider">Purse Remaining</p>
              <p class="text-lg font-black text-amber-400 font-mono-num">₹${t.remainingBudget.toLocaleString()}</p>
            </div>
            <span class="text-[11px] text-slate-400">${t.ownerName}</span>
          </div>
        </div>
      `;
      })
      .join('');
  }
}

// -------------------------------------------------------------
// 2. RENDER TEAM OWNER INTERACTIVE DASHBOARD
// -------------------------------------------------------------
function renderOwnerDashboard() {
  const teamId = activeUser ? activeUser.teamId : null;
  const team = currentTeams.find((t) => t.id === teamId);

  const teamSelect = document.getElementById('header-owner-select');
  if (teamSelect && teamId && teamSelect.value !== teamId) {
    teamSelect.value = teamId;
  }

  const budgetEl = document.getElementById('owner-remaining-budget');
  const slotsEl = document.getElementById('owner-slots-count');
  const bannerEl = document.getElementById('owner-team-title');

  if (!team) {
    if (bannerEl) bannerEl.innerText = 'Select your team in the top dropdown to start bidding!';
    if (budgetEl) budgetEl.innerText = '₹0';
    if (slotsEl) slotsEl.innerText = '0 / 8';
    return;
  }

  if (bannerEl) bannerEl.innerText = `${team.name} • ${team.ownerName}`;
  if (budgetEl) budgetEl.innerText = `₹${team.remainingBudget.toLocaleString()}`;
  if (slotsEl) slotsEl.innerText = `${team.acquiredCount} / 8`;

  // On-the-block details
  const p = currentAuctionState.currentPlayer;
  const pName = document.getElementById('owner-current-player-name');
  const pStats = document.getElementById('owner-current-player-stats');
  const curBid = document.getElementById('owner-current-bid-display');
  const nextBid = document.getElementById('owner-next-bid-step');

  if (pName) pName.innerText = p ? p.name : 'Waiting for next player...';
  if (pStats) {
    pStats.innerText = p ? `${p.specialization} • ${p.batsmanType} • ${p.bowlerType}` : 'No active player';
  }
  if (curBid) curBid.innerText = `₹${currentAuctionState.currentBid.toLocaleString()}`;
  if (nextBid) nextBid.innerText = `₹${currentAuctionState.nextMinBid.toLocaleString()}`;

  // Evaluate Rule Constraints
  const hasBoughtFromSet = team.ownedSetIds && team.ownedSetIds.includes(currentAuctionState.currentSetId);
  const isRosterFull = team.acquiredCount >= team.maxAuctionSlots;

  const { slot1, slot2 } = currentAuctionState.activeBidders || {};
  const isSlot1 = slot1?.teamId === team.id;
  const isSlot2 = slot2?.teamId === team.id;
  const isInBattle = isSlot1 || isSlot2;
  const isBattleFull = Boolean(slot1 && slot2);
  const isLeading = currentAuctionState.highestBidderTeamId === team.id;

  const joinBtn = document.getElementById('owner-join-battle-btn');
  const raiseBtn = document.getElementById('owner-raise-bid-btn');
  const withdrawBtn = document.getElementById('owner-withdraw-btn');
  const statusMsg = document.getElementById('owner-status-alert-box');

  // Battle Ring indicators
  const bSlot1 = document.getElementById('owner-ring-slot1');
  const bSlot2 = document.getElementById('owner-ring-slot2');
  if (bSlot1) bSlot1.innerText = `Slot 1: ${slot1 ? slot1.teamName : 'Vacant'}`;
  if (bSlot2) bSlot2.innerText = `Slot 2: ${slot2 ? slot2.teamName : 'Vacant'}`;

  // Reset displays
  if (statusMsg) statusMsg.style.display = 'none';

  if (hasBoughtFromSet) {
    if (joinBtn) joinBtn.style.display = 'none';
    if (raiseBtn) raiseBtn.style.display = 'none';
    if (withdrawBtn) withdrawBtn.style.display = 'none';
    if (statusMsg) {
      statusMsg.style.display = 'block';
      statusMsg.className = 'p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs font-bold text-center';
      statusMsg.innerText = `⛔ Set Limit Reached: You already purchased a player from Set "${currentAuctionState.currentSetName}". Max 1 player per set.`;
    }
  } else if (isRosterFull) {
    if (joinBtn) joinBtn.style.display = 'none';
    if (raiseBtn) raiseBtn.style.display = 'none';
    if (withdrawBtn) withdrawBtn.style.display = 'none';
    if (statusMsg) {
      statusMsg.style.display = 'block';
      statusMsg.className = 'p-3 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs font-bold text-center';
      statusMsg.innerText = `🏆 Roster Complete! You have successfully acquired all 8 players for your squad.`;
    }
  } else if (!isInBattle) {
    // Team has NOT joined the battle
    if (joinBtn) {
      joinBtn.style.display = 'inline-flex';
      joinBtn.disabled = isBattleFull || currentAuctionState.status !== 'BIDDING';
      joinBtn.innerText = isBattleFull ? '🔒 Battle Ring Locked (2 Bidders Active)' : '⚔️ Join Bidding Battle';
    }
    if (raiseBtn) raiseBtn.style.display = 'none';
    if (withdrawBtn) withdrawBtn.style.display = 'none';
  } else {
    // Team IS IN BATTLE
    if (joinBtn) joinBtn.style.display = 'none';
    if (raiseBtn) {
      raiseBtn.style.display = 'inline-flex';
      raiseBtn.disabled = isLeading || currentAuctionState.status !== 'BIDDING';
      raiseBtn.innerText = isLeading
        ? `👑 You Hold the Highest Bid (₹${currentAuctionState.currentBid.toLocaleString()})`
        : `🔥 Raise to ₹${currentAuctionState.nextMinBid.toLocaleString()}`;
    }
    if (withdrawBtn) {
      withdrawBtn.style.display = 'inline-flex';
      withdrawBtn.disabled = isLeading; // Leading bidder cannot withdraw
    }
  }

  // Render Roster preview in owner view
  const rosterList = document.getElementById('owner-roster-list');
  if (rosterList) {
    rosterList.innerHTML = team.roster
      .map(
        (m) => `
      <div class="flex justify-between items-center p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-xs">
        <div>
          <span class="font-bold text-slate-200">${m.name}</span>
          <span class="text-slate-500 ml-1">(${m.role})</span>
        </div>
        <div class="font-mono-num font-bold ${m.isOwner ? 'text-emerald-400' : 'text-amber-400'}">
          ${m.isOwner ? 'Captain' : `₹${m.price.toLocaleString()}`}
        </div>
      </div>
    `
      )
      .join('');
  }
}

// -------------------------------------------------------------
// 3. RENDER ADMIN MASTER DASHBOARD
// -------------------------------------------------------------
function renderAdminDashboard() {
  const adminSetSelect = document.getElementById('admin-set-select');
  if (adminSetSelect && adminSetSelect.children.length === 0) {
    adminSetSelect.innerHTML = window.ALAMDAR_DATA.SET_CONFIG.map(
      (s) => `<option value="${s.id}">${s.name} (${s.meaning})</option>`
    ).join('');
    adminSetSelect.value = currentAuctionState.currentSetId;
  }

  renderAdminPlayerQueue();
}

function renderAdminPlayerQueue() {
  const queueEl = document.getElementById('admin-player-queue-list');
  if (!queueEl) return;

  const currentSetId = currentAuctionState.currentSetId;
  const setPlayers = currentPlayers.filter((p) => p.setId === currentSetId);

  queueEl.innerHTML = setPlayers
    .map((p) => {
      const isLive = p.id === currentAuctionState.currentPlayerId;
      return `
      <div class="p-3 rounded-xl border flex items-center justify-between text-xs ${
        isLive
          ? 'bg-amber-950/40 border-amber-500 ring-1 ring-amber-500'
          : p.status === 'SOLD'
          ? 'bg-emerald-950/20 border-emerald-900/50 opacity-60'
          : p.status === 'UNSOLD'
          ? 'bg-rose-950/20 border-rose-900/50'
          : 'bg-slate-900/80 border-slate-800'
      }">
        <div>
          <div class="flex items-center gap-2">
            <span class="font-bold text-slate-200">${p.name}</span>
            <span class="px-1.5 py-0.2 rounded text-[10px] font-bold ${
              p.status === 'SOLD'
                ? 'bg-emerald-900 text-emerald-300'
                : p.status === 'UNSOLD'
                ? 'bg-rose-900 text-rose-300'
                : 'bg-slate-800 text-slate-400'
            }">
              ${p.status} ${p.roundNumber === 2 ? '(Round 2)' : ''}
            </span>
          </div>
          <p class="text-[11px] text-slate-500 mt-0.5">${p.specialization} • ${p.batsmanType}</p>
        </div>
        <div>
          ${
            p.status === 'SOLD'
              ? `<span class="font-mono-num text-emerald-400 font-bold">₹${p.soldPrice.toLocaleString()} (${p.soldToTeamName})</span>`
              : `<button onclick="pushPlayerLiveAdmin('${p.id}')" class="btn-primary text-xs py-1.5 px-3">
                  ${isLive ? 'Currently Live' : 'Push Live'}
                </button>`
          }
        </div>
      </div>
    `;
    })
    .join('');
}

// Global hook for push to live button
window.pushPlayerLiveAdmin = function (playerId) {
  const p = currentPlayers.find((ply) => ply.id === playerId);
  if (!p) return;

  const state = StorageManager.get(STORAGE_KEYS.STATE);
  state.status = 'BIDDING';
  state.currentPlayerId = p.id;
  state.currentPlayer = p;
  state.basePrice = 1000;
  state.currentBid = 0;
  state.nextMinBid = 1000;
  state.highestBidderTeamId = null;
  state.highestBidderTeamName = null;
  state.activeBidders = { slot1: null, slot2: null };
  state.hammerCountdown = null;
  state.lastActionTimestamp = Date.now();

  StorageManager.set(STORAGE_KEYS.STATE, state);
  showToast(`Player ${p.name} is now LIVE on the block!`, 'gold');
};
