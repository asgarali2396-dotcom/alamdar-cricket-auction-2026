/**
 * Auction Engine
 * Implements:
 * 1. Dynamic Bidding Increments (+1000, +2000, +5000)
 * 2. Two-Player Bidding Battle Rule
 * 3. Exact 8-Player Roster Constraint & Minimum Budget Reservation Rule
 * 4. Max 1 Player per Set Constraint
 * 5. Single-Active-Session Login Guard
 * 6. Edge-Case Auto-Assignment Engine ("1 player / 1 team remaining in set")
 * 7. Unsold queue re-presentation logic
 */

const AuctionEngine = {
  // 1. Dynamic Increment Calculation
  getIncrement(currentBid) {
    if (currentBid < 10000) {
      return 1000;
    }
    if (currentBid < 20000) {
      return 2000;
    }
    return 5000;
  },

  getNextValidBid(currentBid, basePrice = 1000) {
    if (currentBid <= 0) {
      return basePrice;
    }
    return currentBid + this.getIncrement(currentBid);
  },

  // 2. Budget Reservation Check
  // Team must reserve at least 1,000 coins for every future auction slot to guarantee full squad
  // Exact 8-Player Rule: 1 Captain (sold @ ₹0 cost) + 7 Auction players (base min ₹1,000 each)
  canTeamAffordBid(team, proposedBid) {
    if (!team) return { canBid: false, reason: 'Team record not found.' };

    const totalSlots = team.maxAuctionSlots || 8;
    const currCount = team.acquiredCount !== undefined ? team.acquiredCount : (team.roster ? team.roster.length : 0);
    const remainingAuctionSlotsAfterThis = Math.max(0, totalSlots - (currCount + 1));
    const minReserveNeeded = remainingAuctionSlotsAfterThis * 1000;

    if (proposedBid > team.remainingBudget) {
      return {
        canBid: false,
        reason: `Insufficient Purse: Bid (₹${proposedBid.toLocaleString()}) exceeds your remaining purse (₹${team.remainingBudget.toLocaleString()}).`
      };
    }

    if (team.remainingBudget - proposedBid < minReserveNeeded) {
      const maxAllowed = Math.max(0, team.remainingBudget - minReserveNeeded);
      return {
        canBid: false,
        reason: `Reserve Violation: Next bid (₹${proposedBid.toLocaleString()}) leaves ₹${(team.remainingBudget - proposedBid).toLocaleString()}, but you must retain at least ₹${minReserveNeeded.toLocaleString()} to purchase remaining ${remainingAuctionSlotsAfterThis} player(s). Max allowable bid: ₹${maxAllowed.toLocaleString()}.`
      };
    }

    return { canBid: true };
  },

  // Check if team is eligible for the current player
  isTeamEligibleForSet(team, setId) {
    if (!team) return { eligible: false, reason: 'No team specified.' };
    if (team.acquiredCount >= team.maxAuctionSlots) {
      return { eligible: false, reason: `Roster Full: You already have ${team.maxAuctionSlots} players.` };
    }
    if (team.ownedSetIds && team.ownedSetIds.includes(setId)) {
      return { eligible: false, reason: 'Set Constraint: Your team already owns a player from this Set.' };
    }
    return { eligible: true };
  },

  // 3. Two-Player Rule: Join Bidding Battle
  async joinBattle(teamId) {
    const state = StorageManager.get(STORAGE_KEYS.STATE);
    const teams = StorageManager.get(STORAGE_KEYS.TEAMS) || [];
    const team = teams.find((t) => t.id === teamId);

    // Pre-flight check: Can team afford the next required bid?
    if (state && team) {
      const nextBid = state.nextMinBid || this.getNextValidBid(state.currentBid || 0, state.basePrice || 1000);
      const affordCheck = this.canTeamAffordBid(team, nextBid);
      if (!affordCheck.canBid) {
        return { success: false, error: affordCheck.reason };
      }
    }

    if (!StorageManager._syncDisabled && typeof fetch !== 'undefined') {
      const res = await StorageManager.executeServerAction('join_battle', { teamId });
      if (res && res.success) {
        if (window.soundManager) window.soundManager.playBattleJoin();
        return res;
      }
      if (res && res.error) return res;
    }

    // Local Fallback (file:// or standalone offline mode)
    const players = StorageManager.get(STORAGE_KEYS.PLAYERS);

    if (!state || (state.status !== 'BIDDING' && state.status !== 'COUNTDOWN')) {
      return { success: false, error: 'Auction is not actively accepting bids right now.' };
    }

    if (state.biddingLocked) {
      return { success: false, error: '🔒 Bidding is currently locked. The auctioneer is introducing the player.' };
    }

    const currentPlayer = players.find((p) => p.id === state.currentPlayerId);
    if (!currentPlayer || currentPlayer.status === 'SOLD') {
      return { success: false, error: 'This player is already SOLD. Bidding is closed.' };
    }

    const eligibility = this.isTeamEligibleForSet(team, state.currentSetId);
    if (!eligibility.eligible) {
      return { success: false, error: eligibility.reason };
    }

    // Reserve check for local offline fallback
    const nextBid = state.nextMinBid || this.getNextValidBid(state.currentBid || 0, state.basePrice || 1000);
    const affordCheck = this.canTeamAffordBid(team, nextBid);
    if (!affordCheck.canBid) {
      return { success: false, error: affordCheck.reason };
    }

    state.activeBidders = state.activeBidders || { slot1: null, slot2: null };
    const { slot1, slot2 } = state.activeBidders;

    const isSlot1Occupied = Boolean(slot1?.teamId);
    const isSlot2Occupied = Boolean(slot2?.teamId);

    if ((isSlot1Occupied && slot1.teamId === teamId) || (isSlot2Occupied && slot2.teamId === teamId)) {
      return { success: true, message: 'Already in the active bidding ring.' };
    }

    if (!isSlot1Occupied) {
      state.activeBidders.slot1 = {
        teamId,
        teamName: team.name,
        ownerName: team.ownerName || team.playingOwner,
        color: team.color || '#C8A96A',
        icon: team.icon || '🏏',
        joinedAt: Date.now()
      };
    } else if (!isSlot2Occupied) {
      state.activeBidders.slot2 = {
        teamId,
        teamName: team.name,
        ownerName: team.ownerName || team.playingOwner,
        color: team.color || '#C8A96A',
        icon: team.icon || '🏏',
        joinedAt: Date.now()
      };
    } else {
      return {
        success: false,
        error: 'Battle Ring Full! Two teams are already locked in this bidding war. Wait for one to withdraw.'
      };
    }

    state.lastActionTimestamp = Date.now();
    StorageManager.set(STORAGE_KEYS.STATE, state);

    if (window.soundManager) window.soundManager.playBattleJoin();
    return { success: true };
  },

  // 4. Place Bid / Raise Bid
  async placeBid(teamId) {
    if (!StorageManager._syncDisabled && typeof fetch !== 'undefined') {
      const res = await StorageManager.executeServerAction('bid', { teamId });
      if (res && res.success) {
        if (window.soundManager) window.soundManager.playBidChime();
        return res;
      }
      if (res && res.error) return res;
    }

    // Local Fallback (file:// or standalone offline mode)
    const state = StorageManager.get(STORAGE_KEYS.STATE);
    const teams = StorageManager.get(STORAGE_KEYS.TEAMS);
    const players = StorageManager.get(STORAGE_KEYS.PLAYERS);
    const team = teams.find((t) => t.id === teamId);

    if (!state || (state.status !== 'BIDDING' && state.status !== 'COUNTDOWN')) {
      return { success: false, error: 'Auction is not in active bidding phase.' };
    }

    if (state.biddingLocked) {
      return { success: false, error: '🔒 Bidding is currently locked. The auctioneer is introducing the player.' };
    }

    const currentPlayer = players.find((p) => p.id === state.currentPlayerId);
    if (!currentPlayer || currentPlayer.status === 'SOLD') {
      return { success: false, error: 'This player is already SOLD. Bidding is closed.' };
    }

    const isSlot1 = state.activeBidders?.slot1?.teamId === teamId;
    const isSlot2 = state.activeBidders?.slot2?.teamId === teamId;

    if (!isSlot1 && !isSlot2) {
      return { success: false, error: 'You must click "Join Bid" to enter the 2-player battle first.' };
    }

    if (state.highestBidderTeamId === teamId) {
      return { success: false, error: 'You already hold the leading bid!' };
    }

    const nextBid = this.getNextValidBid(state.currentBid, state.basePrice);

    const affordability = this.canTeamAffordBid(team, nextBid);
    if (!affordability.canBid) {
      return { success: false, error: affordability.reason };
    }

    state.currentBid = nextBid;
    state.nextMinBid = this.getNextValidBid(nextBid, state.basePrice);
    state.highestBidderTeamId = teamId;
    state.highestBidderTeamName = team.name;
    state.hammerCountdown = null;
    state.lastActionTimestamp = Date.now();
    state.version = (state.version || 0) + 1;

    StorageManager.set(STORAGE_KEYS.STATE, state);

    if (window.soundManager) window.soundManager.playBidChime();
    return { success: true, newBid: nextBid };
  },

  // 5. Withdraw from Battle Ring
  async withdrawFromBattle(teamId) {
    if (!StorageManager._syncDisabled && typeof fetch !== 'undefined') {
      const res = await StorageManager.executeServerAction('withdraw', { teamId });
      if (res && res.success) return res;
      if (res && res.error) return res;
    }

    // Local Fallback
    const state = StorageManager.get(STORAGE_KEYS.STATE);
    if (!state || !state.activeBidders) return { success: false, error: 'No active battle.' };

    if (state.highestBidderTeamId === teamId) {
      return { success: false, error: 'The highest bidder cannot withdraw while holding the lead.' };
    }

    if (state.activeBidders.slot1?.teamId === teamId) {
      state.activeBidders.slot1 = null;
    } else if (state.activeBidders.slot2?.teamId === teamId) {
      state.activeBidders.slot2 = null;
    }

    state.lastActionTimestamp = Date.now();
    StorageManager.set(STORAGE_KEYS.STATE, state);
    return { success: true };
  },

  // 6. Finalize Sale (HAMMER SOLD)
  async confirmSale() {
    if (!StorageManager._syncDisabled && typeof fetch !== 'undefined') {
      const res = await StorageManager.executeServerAction('confirm_sale');
      if (res && res.success) {
        if (window.soundManager) window.soundManager.playSoldFanfare();
        return res;
      }
      if (res && res.error) return res;
    }

    // Local Fallback
    const state = StorageManager.get(STORAGE_KEYS.STATE);
    const teams = StorageManager.get(STORAGE_KEYS.TEAMS);
    const players = StorageManager.get(STORAGE_KEYS.PLAYERS);

    if (!state || !state.currentPlayerId) {
      return { success: false, error: 'No player currently on the block.' };
    }

    if (state.status === 'SOLD') {
      return { success: false, error: 'This player has already been sold! Select next player in Admin queue.' };
    }

    if (!state.highestBidderTeamId) {
      return { success: false, error: 'No bids placed. Use "Mark Unsold" instead.' };
    }

    const teamIndex = teams.findIndex((t) => t.id === state.highestBidderTeamId);
    const playerIndex = players.findIndex((p) => p.id === state.currentPlayerId);

    if (teamIndex === -1 || playerIndex === -1) {
      return { success: false, error: 'Invalid team or player id in database.' };
    }

    const winningTeam = teams[teamIndex];
    const soldPlayer = players[playerIndex];

    if (soldPlayer.status === 'SOLD') {
      return { success: false, error: `Player ${soldPlayer.name} is already SOLD to ${soldPlayer.soldToTeamName || 'another franchise'}!` };
    }

    const alreadySoldTo = teams.find((t) => t.roster && t.roster.some((r) => r.playerId === soldPlayer.id));
    if (alreadySoldTo) {
      soldPlayer.status = 'SOLD';
      soldPlayer.soldToTeamId = alreadySoldTo.id;
      soldPlayer.soldToTeamName = alreadySoldTo.name;
      StorageManager.set(STORAGE_KEYS.PLAYERS, players);
      return { success: false, error: `Player ${soldPlayer.name} is already part of ${alreadySoldTo.name}'s squad!` };
    }

    const finalPrice = state.currentBid;

    winningTeam.remainingBudget -= finalPrice;
    winningTeam.acquiredCount += 1;
    if (!winningTeam.ownedSetIds) winningTeam.ownedSetIds = [];
    if (!winningTeam.ownedSetIds.includes(state.currentSetId)) {
      winningTeam.ownedSetIds.push(state.currentSetId);
    }

    winningTeam.roster.push({
      playerId: soldPlayer.id,
      name: soldPlayer.name,
      role: soldPlayer.specialization,
      setId: state.currentSetId,
      setName: state.currentSetName,
      price: finalPrice,
      isOwner: false,
      timestamp: Date.now()
    });

    soldPlayer.status = 'SOLD';
    soldPlayer.soldPrice = finalPrice;
    soldPlayer.soldToTeamId = winningTeam.id;
    soldPlayer.soldToTeamName = winningTeam.name;

    state.status = 'SOLD';
    state.biddingLocked = false;
    state.hammerCountdown = null;
    state.activeBidders = { slot1: null, slot2: null };
    state.lastActionTimestamp = Date.now();

    StorageManager.set(STORAGE_KEYS.TEAMS, teams);
    StorageManager.set(STORAGE_KEYS.PLAYERS, players);
    StorageManager.set(STORAGE_KEYS.STATE, state);

    if (window.soundManager) window.soundManager.playSoldFanfare();

    const autoAssignResult = this.evaluateAutoAssignment(state.currentSetId);

    state.lastSoldTransaction = {
      playerId: soldPlayer.id,
      teamId: winningTeam.id,
      price: finalPrice,
      setId: state.currentSetId,
      autoAssignedPlayerId: autoAssignResult?.player?.id,
      autoAssignedTeamId: autoAssignResult?.team?.id,
      autoAssignedPrice: autoAssignResult?.price || 1000
    };
    StorageManager.set(STORAGE_KEYS.STATE, state);

    return {
      success: true,
      soldPlayer,
      winningTeam,
      finalPrice,
      autoAssigned: autoAssignResult
    };
  },

  // 6b. Undo Last Sale & Re-open Bidding at Last Bid (Admin Gavel Control)
  async undoSale() {
    if (!StorageManager._syncDisabled && typeof fetch !== 'undefined') {
      const res = await StorageManager.executeServerAction('undo_sale');
      if (res && res.success) {
        if (window.soundManager) window.soundManager.playBidChime();
        return res;
      }
      if (res && res.error) return res;
    }

    // Local Fallback (standalone/offline)
    const state = StorageManager.get(STORAGE_KEYS.STATE);
    const teams = StorageManager.get(STORAGE_KEYS.TEAMS) || [];
    const players = StorageManager.get(STORAGE_KEYS.PLAYERS) || [];

    const lastTx = state?.lastSoldTransaction;
    const targetPlayerId = lastTx?.playerId || (state?.status === 'SOLD' && state?.currentPlayerId);
    if (!targetPlayerId) {
      return { success: false, error: 'No recent player sale found to undo.' };
    }

    const soldPly = players.find((p) => p.id === targetPlayerId);
    if (!soldPly) {
      return { success: false, error: 'Sold player not found.' };
    }

    const winTeamId = lastTx?.teamId || soldPly.soldToTeamId;
    const winTeam = teams.find((t) => t.id === winTeamId);
    const finalPrice = lastTx?.price || soldPly.soldPrice || state.currentBid || 1000;

    // Undo auto-assignment if triggered
    if (lastTx?.autoAssignedPlayerId && lastTx?.autoAssignedTeamId) {
      const autoP = players.find((p) => p.id === lastTx.autoAssignedPlayerId);
      const autoT = teams.find((t) => t.id === lastTx.autoAssignedTeamId);
      const autoPr = lastTx.autoAssignedPrice || 1000;
      if (autoP && autoT) {
        autoP.status = 'AVAILABLE';
        autoP.soldPrice = null;
        autoP.soldToTeamId = null;
        autoP.soldToTeamName = null;
        delete autoP.autoAssigned;

        autoT.remainingBudget = (autoT.remainingBudget || 0) + autoPr;
        autoT.acquiredCount = Math.max(1, (autoT.acquiredCount || 1) - 1);
        autoT.roster = (autoT.roster || []).filter((r) => r.playerId !== autoP.id);
        autoT.ownedSetIds = Array.from(new Set((autoT.roster || []).map((r) => r.setId).filter(Boolean)));
      }
    }

    // Revert sold player
    soldPly.status = 'AVAILABLE';
    soldPly.soldPrice = null;
    soldPly.soldToTeamId = null;
    soldPly.soldToTeamName = null;
    delete soldPly.autoAssigned;

    // Refund winning team
    if (winTeam) {
      winTeam.remainingBudget = (winTeam.remainingBudget || 0) + finalPrice;
      winTeam.acquiredCount = Math.max(1, (winTeam.acquiredCount || 1) - 1);
      winTeam.roster = (winTeam.roster || []).filter((r) => r.playerId !== soldPly.id);
      winTeam.ownedSetIds = Array.from(new Set((winTeam.roster || []).map((r) => r.setId).filter(Boolean)));
    }

    // Restore state to last bid
    state.status = 'BIDDING';
    state.currentPlayerId = soldPly.id;
    state.currentPlayer = soldPly;
    state.currentSetId = soldPly.setId;
    state.currentSetName = soldPly.setName || '';
    state.currentBid = finalPrice;
    state.nextMinBid = this.getNextValidBid(finalPrice, state.basePrice || 1000);
    state.highestBidderTeamId = winTeam ? winTeam.id : null;
    state.highestBidderTeamName = winTeam ? winTeam.name : 'Franchise';
    state.hammerCountdown = null;
    state.biddingLocked = false;
    state.activeBidders = {
      slot1: winTeam ? {
        teamId: winTeam.id,
        teamName: winTeam.name,
        ownerName: winTeam.ownerName || winTeam.playingOwner,
        color: winTeam.color || '#C8A96A',
        icon: winTeam.icon || '🏏',
        joinedAt: Date.now()
      } : null,
      slot2: null
    };
    state.lastSoldTransaction = null;
    state.lastActionTimestamp = Date.now();

    StorageManager.set(STORAGE_KEYS.TEAMS, teams);
    StorageManager.set(STORAGE_KEYS.PLAYERS, players);
    StorageManager.set(STORAGE_KEYS.STATE, state);

    if (window.soundManager) window.soundManager.playBidChime();

    return {
      success: true,
      undonePlayer: soldPly,
      winningTeam: winTeam,
      lastBid: finalPrice
    };
  },

  // 7. Mark Player UNSOLD and push to end of Set queue
  async markPlayerUnsold() {
    if (!StorageManager._syncDisabled && typeof fetch !== 'undefined') {
      const res = await StorageManager.executeServerAction('mark_unsold');
      if (res && res.success) {
        if (window.soundManager) window.soundManager.playUnsoldTone();
        return res;
      }
      if (res && res.error) return res;
    }

    // Local Fallback
    const state = StorageManager.get(STORAGE_KEYS.STATE);
    const players = StorageManager.get(STORAGE_KEYS.PLAYERS);

    if (!state.currentPlayerId) {
      return { success: false, error: 'No player on the block.' };
    }

    const player = players.find((p) => p.id === state.currentPlayerId);
    if (!player) {
      return { success: false, error: 'Player record not found.' };
    }

    if (player.status === 'SOLD') {
      return { success: false, error: `Cannot mark unsold: Player ${player.name} is already SOLD!` };
    }

    player.status = 'UNSOLD';
    player.roundNumber = 2;

    state.status = 'UNSOLD';
    state.biddingLocked = false;
    state.hammerCountdown = null;
    state.activeBidders = { slot1: null, slot2: null };

    StorageManager.set(STORAGE_KEYS.PLAYERS, players);
    StorageManager.set(STORAGE_KEYS.STATE, state);

    if (window.soundManager) window.soundManager.playUnsoldTone();
    return { success: true, player };
  },

  // 8. AUTO-ASSIGNMENT ENGINE
  // Rule: If 1 player remaining in set and exactly 1 team left that hasn't bought from this set,
  // that player is automatically assigned at base price (1,000 coins).
  evaluateAutoAssignment(setId) {
    const players = StorageManager.get(STORAGE_KEYS.PLAYERS);
    const teams = StorageManager.get(STORAGE_KEYS.TEAMS);

    // Remaining unsold or available players in this set
    const remainingPlayersInSet = players.filter(
      (p) => p.setId === setId && (p.status === 'AVAILABLE' || p.status === 'UNSOLD')
    );

    if (remainingPlayersInSet.length !== 1) {
      return { triggered: false, reason: `Remaining players: ${remainingPlayersInSet.length}` };
    }

    // Teams that DO NOT own a player from this set AND have open slots (< 8)
    const eligibleTeams = teams.filter((t) => {
      const hasBoughtFromSet = t.ownedSetIds && t.ownedSetIds.includes(setId);
      const hasSlotOpen = t.acquiredCount < t.maxAuctionSlots;
      return !hasBoughtFromSet && hasSlotOpen;
    });

    if (eligibleTeams.length === 1) {
      const targetPlayer = remainingPlayersInSet[0];
      const targetTeam = eligibleTeams[0];
      const basePrice = 1000;

      // Prevent duplicate assignment if targetPlayer is already in any team roster
      if (teams.some((t) => t.roster && t.roster.some((r) => r.playerId === targetPlayer.id))) {
        return { triggered: false, reason: 'Target player already acquired.' };
      }

      if (targetTeam.remainingBudget < basePrice) {
        console.error(`Team ${targetTeam.name} cannot afford auto-assignment base price.`);
        return { triggered: false, error: 'Team purse insufficient for mandatory auto-assignment' };
      }

      // Execute auto assignment
      targetTeam.remainingBudget -= basePrice;
      targetTeam.acquiredCount += 1;
      if (!targetTeam.ownedSetIds) targetTeam.ownedSetIds = [];
      targetTeam.ownedSetIds.push(setId);

      targetTeam.roster.push({
        playerId: targetPlayer.id,
        name: targetPlayer.name,
        role: targetPlayer.specialization,
        setId: setId,
        setName: targetPlayer.setName,
        price: basePrice,
        isOwner: false,
        autoAssigned: true,
        timestamp: Date.now()
      });

      targetPlayer.status = 'SOLD';
      targetPlayer.soldPrice = basePrice;
      targetPlayer.soldToTeamId = targetTeam.id;
      targetPlayer.soldToTeamName = targetTeam.name;
      targetPlayer.autoAssigned = true;

      StorageManager.set(STORAGE_KEYS.TEAMS, teams);
      StorageManager.set(STORAGE_KEYS.PLAYERS, players);

      return {
        triggered: true,
        player: targetPlayer,
        team: targetTeam,
        price: basePrice
      };
    }

    return { triggered: false, eligibleTeamsCount: eligibleTeams.length };
  },

  // 9. Single-Active-Session Sentinel
  registerSession(userId, role, teamId = null) {
    const sessionId = 'sess_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    const sessions = StorageManager.get(STORAGE_KEYS.SESSIONS, {});

    // Save active session token for this user in shared session registry
    const sessionObj = {
      sessionId,
      role,
      teamId,
      loginTime: Date.now(),
      userAgent: navigator.userAgent
    };
    sessions[userId] = sessionObj;

    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    // Atomically register on server without wiping other franchise sessions
    StorageManager.executeServerAction('session_login', { userId, session: sessionObj });
    return sessionId;
  },

  validateSession(userId, currentSessionId) {
    if (!userId || userId === 'guest_audience') return true;
    const sessions = StorageManager.get(STORAGE_KEYS.SESSIONS, {});
    const active = sessions[userId];
    if (!active) {
      // If no active session tracked yet, permit current
      return true;
    }
    return active.sessionId === currentSessionId;
  },

  // Dedicated Team Owner Authentication (Checks password)
  authenticateTeam(teamIdOrUser, password) {
    if (!teamIdOrUser) {
      return { success: false, error: 'Please select your franchise or enter your User ID.' };
    }
    if (!password || !password.trim()) {
      return { success: false, error: 'Please enter your team password.' };
    }

    const cleanUser = teamIdOrUser.trim().toLowerCase();
    const cleanPass = password.trim().toLowerCase();

    // Check if user is actually admin typing into team form
    if (cleanUser === 'admin' || cleanUser === 'root' || cleanUser === 'committee') {
      return this.authenticateAdmin(password);
    }

    const teams = window.ALAMDAR_DATA.INITIAL_TEAMS;
    const team = teams.find((t) => {
      const u = (t.username || '').toLowerCase();
      const id = (t.id || '').toLowerCase();
      const n = (t.name || '').toLowerCase();
      const nClean = n.replace(/[^a-z0-9]/g, '');
      const o = (t.ownerName || '').toLowerCase();
      if (t.id === 'team_11' && (cleanUser === 'choudhari' || cleanUser === 'choudhary')) return true;
      return (
        u === cleanUser ||
        id === cleanUser ||
        n === cleanUser ||
        nClean === cleanUser.replace(/[^a-z0-9]/g, '') ||
        n.includes(cleanUser) ||
        o.includes(cleanUser)
      );
    });

    if (!team) {
      return { success: false, error: `Franchise "${teamIdOrUser}" not recognized. Please choose from the list.` };
    }

    const expectedPass = (team.password || '').toLowerCase();

    // Strictly validate against the franchise password (no username-as-password bypass)
    let isPassValid = (cleanPass === expectedPass);

    // Support alternate spelling for choudhari / choudhary with full updated password
    if (team.id === 'team_11' && (cleanPass === 'choudhari@alamdar2026' || cleanPass === 'choudhary@alamdar2026')) {
      isPassValid = true;
    }

    if (!isPassValid) {
      return {
        success: false,
        error: `Incorrect password for ${team.name}.`
      };
    }

    const userId = `owner_${team.id}`;
    const sessId = this.registerSession(userId, 'owner', team.id);
    const sessionObj = {
      userId,
      role: 'owner',
      teamId: team.id,
      name: `${team.ownerName} (${team.name})`,
      teamName: team.name,
      icon: team.icon || '🏏',
      color: team.color || '#3b82f6',
      sessionId: sessId
    };

    StorageManager.setActiveUser(sessionObj);
    return { success: true, ...sessionObj };
  },

  // Dedicated Master Admin Authentication
  authenticateAdmin(password) {
    if (!password || !password.trim()) {
      return { success: false, error: 'Please enter the Master Admin password.' };
    }

    const cleanPass = password.trim();
    const adminCfg = window.ALAMDAR_DATA.ADMIN_CREDENTIALS;
    const expectedPass = adminCfg.password;

    // Strictly validate against master admin password (no default/simple bypass)
    const isPassValid = (cleanPass === expectedPass || cleanPass.toLowerCase() === expectedPass.toLowerCase());

    if (!isPassValid) {
      return {
        success: false,
        error: 'Incorrect Master Admin password.'
      };
    }

    const sessId = this.registerSession('admin_root', 'admin');
    const sessionObj = {
      userId: 'admin_root',
      role: 'admin',
      teamId: null,
      name: adminCfg.name,
      sessionId: sessId
    };

    StorageManager.setActiveUser(sessionObj);
    return { success: true, ...sessionObj };
  },

  // General fallback authentication
  authenticate(username, password) {
    if (!username) {
      return { success: false, error: 'Please enter a username or select your team.' };
    }

    const cleanUser = username.trim().toLowerCase();
    if (cleanUser === 'admin' || cleanUser === 'alamdar' || cleanUser === 'root' || cleanUser === 'committee') {
      return this.authenticateAdmin(password);
    }

    return this.authenticateTeam(username, password);
  },

  logout() {
    StorageManager.clearActiveUser();
  }
};

window.AuctionEngine = AuctionEngine;
