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
  // Team must reserve at least 1,000 coins for every future slot to guarantee 8 players
  canTeamAffordBid(team, proposedBid) {
    if (!team) return { canBid: false, reason: 'Team record not found.' };

    const remainingSlotsAfterThis = team.maxAuctionSlots - (team.acquiredCount + 1);
    const minReserveNeeded = Math.max(0, remainingSlotsAfterThis * 1000);

    if (proposedBid > team.remainingBudget) {
      return {
        canBid: false,
        reason: `Bid (₹${proposedBid.toLocaleString()}) exceeds your purse (₹${team.remainingBudget.toLocaleString()}).`
      };
    }

    if (team.remainingBudget - proposedBid < minReserveNeeded) {
      return {
        canBid: false,
        reason: `Reserve Violation: You must retain at least ₹${minReserveNeeded.toLocaleString()} to purchase remaining ${remainingSlotsAfterThis} player slot(s).`
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
  joinBattle(teamId) {
    const state = StorageManager.get(STORAGE_KEYS.STATE);
    const teams = StorageManager.get(STORAGE_KEYS.TEAMS);
    const team = teams.find((t) => t.id === teamId);

    if (!state || state.status !== 'BIDDING') {
      return { success: false, error: 'Auction is not actively accepting bids right now.' };
    }

    const eligibility = this.isTeamEligibleForSet(team, state.currentSetId);
    if (!eligibility.eligible) {
      return { success: false, error: eligibility.reason };
    }

    const { slot1, slot2 } = state.activeBidders || {};

    // Already in battle
    if (slot1?.teamId === teamId || slot2?.teamId === teamId) {
      return { success: true, message: 'Already in the active bidding ring.' };
    }

    // Try slot 1
    if (!slot1) {
      state.activeBidders.slot1 = { teamId, teamName: team.name, joinedAt: Date.now() };
    } else if (!slot2) {
      state.activeBidders.slot2 = { teamId, teamName: team.name, joinedAt: Date.now() };
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
  placeBid(teamId) {
    const state = StorageManager.get(STORAGE_KEYS.STATE);
    const teams = StorageManager.get(STORAGE_KEYS.TEAMS);
    const team = teams.find((t) => t.id === teamId);

    if (!state || state.status !== 'BIDDING') {
      return { success: false, error: 'Auction is not in active bidding phase.' };
    }

    // Must be in active 2-player battle
    const isSlot1 = state.activeBidders?.slot1?.teamId === teamId;
    const isSlot2 = state.activeBidders?.slot2?.teamId === teamId;

    if (!isSlot1 && !isSlot2) {
      return { success: false, error: 'You must click "Join Bid" to enter the 2-player battle first.' };
    }

    // Disallow self-raise
    if (state.highestBidderTeamId === teamId) {
      return { success: false, error: 'You already hold the leading bid!' };
    }

    const nextBid = this.getNextValidBid(state.currentBid, state.basePrice);

    // Validate budget & reserve constraint
    const affordability = this.canTeamAffordBid(team, nextBid);
    if (!affordability.canBid) {
      return { success: false, error: affordability.reason };
    }

    // Update auction state
    state.currentBid = nextBid;
    state.nextMinBid = this.getNextValidBid(nextBid, state.basePrice);
    state.highestBidderTeamId = teamId;
    state.highestBidderTeamName = team.name;
    state.hammerCountdown = null; // Reset any countdown
    state.lastActionTimestamp = Date.now();
    state.version = (state.version || 0) + 1;

    StorageManager.set(STORAGE_KEYS.STATE, state);

    if (window.soundManager) window.soundManager.playBidChime();
    return { success: true, newBid: nextBid };
  },

  // 5. Withdraw from Battle Ring
  withdrawFromBattle(teamId) {
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
  confirmSale() {
    const state = StorageManager.get(STORAGE_KEYS.STATE);
    const teams = StorageManager.get(STORAGE_KEYS.TEAMS);
    const players = StorageManager.get(STORAGE_KEYS.PLAYERS);

    if (!state.currentPlayerId) {
      return { success: false, error: 'No player currently on the block.' };
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
    const finalPrice = state.currentBid;

    // Deduct purse and add player to roster
    winningTeam.remainingBudget -= finalPrice;
    winningTeam.acquiredCount += 1;
    if (!winningTeam.ownedSetIds) winningTeam.ownedSetIds = [];
    winningTeam.ownedSetIds.push(state.currentSetId);

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

    // Update state
    state.status = 'SOLD';
    state.hammerCountdown = null;
    state.activeBidders = { slot1: null, slot2: null };

    StorageManager.set(STORAGE_KEYS.TEAMS, teams);
    StorageManager.set(STORAGE_KEYS.PLAYERS, players);
    StorageManager.set(STORAGE_KEYS.STATE, state);

    if (window.soundManager) window.soundManager.playSoldFanfare();

    // Check Auto-Assignment condition
    const autoAssignResult = this.evaluateAutoAssignment(state.currentSetId);

    return {
      success: true,
      soldPlayer,
      winningTeam,
      finalPrice,
      autoAssigned: autoAssignResult
    };
  },

  // 7. Mark Player UNSOLD and push to end of Set queue
  markPlayerUnsold() {
    const state = StorageManager.get(STORAGE_KEYS.STATE);
    const players = StorageManager.get(STORAGE_KEYS.PLAYERS);

    if (!state.currentPlayerId) {
      return { success: false, error: 'No player on the block.' };
    }

    const player = players.find((p) => p.id === state.currentPlayerId);
    if (player) {
      player.status = 'UNSOLD';
      player.roundNumber = 2; // Pushed to next representation round
    }

    state.status = 'UNSOLD';
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

    // Save active session token for this user
    sessions[userId] = {
      sessionId,
      role,
      teamId,
      loginTime: Date.now(),
      userAgent: navigator.userAgent
    };

    StorageManager.set(STORAGE_KEYS.SESSIONS, sessions);
    StorageManager.set(STORAGE_KEYS.CURRENT_USER, { userId, role, teamId, sessionId });

    return sessionId;
  },

  validateSession(userId, currentSessionId) {
    const sessions = StorageManager.get(STORAGE_KEYS.SESSIONS, {});
    const active = sessions[userId];
    if (!active) return false;
    return active.sessionId === currentSessionId;
  }
};

window.AuctionEngine = AuctionEngine;
