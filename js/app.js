/**
 * Main Application Orchestrator
 * Fully enforces user requirements:
 * - Password required for Team Owners and Master Admin
 * - Asks password ONCE and stays logged in on the device
 * - Locked to the logged-in team (can only switch by clicking Logout)
 * - Single active session per team to resolve concurrent conflicts
 * - Exact 3-screen layouts matched to screenshots
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

  // Restore saved active user session (stays saved permanently on device across reloads)
  activeUser = StorageManager.getActiveUser();

  // The website should load on the audience screen by default
  currentTab = 'live';

  setupEventListeners();
  setupRealtimeListeners();
  switchView(currentTab);
  checkSingleSessionHealth();

  // Periodic heartbeat single-session monitor (every 2.5 seconds)
  setInterval(checkSingleSessionHealth, 2500);

  // Modal Helpers (Dual-Slider Campus Fix Model - Default Admin)
  function openLoginModal(mode = 'admin') {
    const modal = document.getElementById('auth-page-modal') || document.getElementById('login-modal');
    const errOwner = document.getElementById('login-owner-error-msg');
    const errAdmin = document.getElementById('login-admin-error-msg');
    if (errOwner) errOwner.style.display = 'none';
    if (errAdmin) errAdmin.style.display = 'none';

    setAuthSliderMode(mode);
    if (modal) {
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      modal.style.display = 'flex';
    }
    document.body.style.overflow = 'hidden';
  }

  function closeLoginModal() {
    const modal = document.getElementById('auth-page-modal') || document.getElementById('login-modal');
    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      modal.style.display = 'none';
    }
    document.body.style.overflow = '';
  }

  function setAuthSliderMode(mode = 'admin') {
    const container = document.getElementById('auth-slider-container');
    const mobileAdminTab = document.getElementById('mobile-tab-admin');
    const mobileOwnerTab = document.getElementById('mobile-tab-owner');

    if (mode === 'owner') {
      if (container) container.classList.add('right-panel-active');
      if (mobileOwnerTab) mobileOwnerTab.classList.add('active');
      if (mobileAdminTab) mobileAdminTab.classList.remove('active');
    } else {
      // By default at Admin
      if (container) container.classList.remove('right-panel-active');
      if (mobileAdminTab) mobileAdminTab.classList.add('active');
      if (mobileOwnerTab) mobileOwnerTab.classList.remove('active');
    }
  }

  // Cinematic JAFAR Creation Animation Burst (5 Seconds Duration)
  let burstFinishTimeout = null;

  function triggerCinematicLoginBurst(roleName = 'Tournament Portal', callback = null) {
    const burstLayer = document.getElementById('auth-burst-effect');
    const targetRoleEl = document.getElementById('burst-target-role');
    const progressFill = document.getElementById('burst-progress-fill');
    const skipBtn = document.getElementById('burst-skip-btn');

    if (targetRoleEl) {
      targetRoleEl.innerText = `⚡ Authenticating & Entering ${roleName}...`;
    }

    // Play opening fanfare / chime
    if (window.soundEffects && typeof window.soundEffects.playBattleJoin === 'function') {
      window.soundEffects.playBattleJoin();
    }

    if (!burstLayer) {
      if (callback) callback();
      return;
    }

    // Clear any previous active burst timeout
    if (burstFinishTimeout) {
      clearTimeout(burstFinishTimeout);
      burstFinishTimeout = null;
    }

    if (progressFill) {
      progressFill.style.transition = 'none';
      progressFill.style.width = '0%';
      setTimeout(() => {
        progressFill.style.transition = 'width 5s linear';
        progressFill.style.width = '100%';
      }, 50);
    }

    burstLayer.classList.add('active');

    let finished = false;
    function finishBurst() {
      if (finished) return;
      finished = true;

      if (burstFinishTimeout) {
        clearTimeout(burstFinishTimeout);
        burstFinishTimeout = null;
      }

      if (callback) callback();
      setTimeout(() => {
        burstLayer.classList.remove('active');
        closeLoginModal();
      }, 350);
    }

    // Connect skip button
    if (skipBtn) {
      skipBtn.onclick = (e) => {
        e.stopPropagation();
        finishBurst();
      };
    }

    // Conclude after exactly 5 seconds (5,000ms)
    burstFinishTimeout = setTimeout(() => {
      finishBurst();
    }, 5000);
  }


  // Toast notification helper
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-item';

    if (type === 'success') {
      toast.style.background = 'rgba(16, 185, 129, 0.95)';
      toast.style.color = '#fff';
      toast.innerHTML = `<span class="text-base">✓</span><span class="font-bold text-sm">${message}</span>`;
    } else if (type === 'error') {
      toast.style.background = 'rgba(244, 63, 94, 0.95)';
      toast.style.color = '#fff';
      toast.innerHTML = `<span class="text-base">✕</span><span class="font-bold text-sm">${message}</span>`;
    } else if (type === 'gold') {
      toast.style.background = 'rgba(245, 158, 11, 0.98)';
      toast.style.color = '#000';
      toast.innerHTML = `<span class="text-base">⚡</span><span class="font-black text-sm">${message}</span>`;
    } else {
      toast.style.background = 'rgba(30, 41, 59, 0.95)';
      toast.style.color = '#f8fafc';
      toast.innerHTML = `<span class="text-base">ℹ</span><span class="font-semibold text-sm">${message}</span>`;
    }

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Single-Active-Session Validator (Detects conflicting logins on other devices)
  function checkSingleSessionHealth() {
    if (!activeUser || !activeUser.userId || activeUser.role === 'audience') return;

    const valid = AuctionEngine.validateSession(activeUser.userId, activeUser.sessionId);
    if (!valid) {
      const modal = document.getElementById('session-eviction-modal');
      if (modal) modal.style.display = 'flex';

      // Log out on this device to prevent conflict
      StorageManager.clearActiveUser();
      activeUser = StorageManager.getActiveUser();
      switchView('live');
      renderApp();
    }
  }

  // Real-time Event Subscriptions
  function setupRealtimeListeners() {
    window.auctionBus.subscribe((event) => {
      currentAuctionState = StorageManager.get(STORAGE_KEYS.STATE) || currentAuctionState;
      currentTeams = StorageManager.get(STORAGE_KEYS.TEAMS) || currentTeams;
      currentPlayers = StorageManager.get(STORAGE_KEYS.PLAYERS) || currentPlayers;

      if (event && event.type === 'DATA_CHANGED' && event.payload?.key === STORAGE_KEYS.SESSIONS) {
        checkSingleSessionHealth();
      }

      if (currentAuctionState && currentAuctionState.currentBid > previousBid) {
        if (window.soundManager) window.soundManager.playBidChime();
        triggerBidFlash();
      }
      if (currentAuctionState) {
        previousBid = currentAuctionState.currentBid || 0;
        previousBidder = currentAuctionState.highestBidderTeamId || null;
      }

      renderApp();
    });
  }

  // Direct server push hook: immediately updates state when server data is received
  window.onServerDataReceived = function (data) {
    if (!data) return;
    if (data.state) {
      currentAuctionState = data.state;
    } else {
      currentAuctionState = StorageManager.get(STORAGE_KEYS.STATE) || currentAuctionState;
    }
    if (data.teams) {
      currentTeams = data.teams;
    } else {
      currentTeams = StorageManager.get(STORAGE_KEYS.TEAMS) || currentTeams;
    }
    if (data.players) {
      currentPlayers = data.players;
    } else {
      currentPlayers = StorageManager.get(STORAGE_KEYS.PLAYERS) || currentPlayers;
    }

    if (currentAuctionState && currentAuctionState.currentBid > previousBid) {
      if (window.soundManager) window.soundManager.playBidChime();
      triggerBidFlash();
    }
    if (currentAuctionState) {
      previousBid = currentAuctionState.currentBid || 0;
      previousBidder = currentAuctionState.highestBidderTeamId || null;
    }

    checkSingleSessionHealth();
    renderApp();
  };

  function triggerBidFlash() {
    const el = document.getElementById('live-bid-display');
    if (el) {
      el.classList.remove('flash-bid-anim');
      void el.offsetWidth;
      el.classList.add('flash-bid-anim');
    }
  }

  // Setup Event Listeners
  function setupEventListeners() {
    // Navigation Tabs (Role Gated)
    document.querySelectorAll('[data-view-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        const target = button.getAttribute('data-view-tab');

        if (target === 'owner') {
          if (!activeUser || activeUser.role !== 'owner') {
            showToast('Please sign in with your Franchise Password to bid.', 'info');
            openLoginModal('owner');
            return;
          }
        }

        if (target === 'admin') {
          if (!activeUser || activeUser.role !== 'admin') {
            showToast('Please sign in with Master Admin password.', 'info');
            openLoginModal('admin');
            return;
          }
        }

        switchView(target);
      });
    });

    // Login Modal Open / Close triggers
    const openLoginBtn = document.getElementById('open-login-btn');
    if (openLoginBtn) {
      // By default open in Admin mode as required
      openLoginBtn.addEventListener('click', () => openLoginModal('admin'));
    }

    const authUserBadge = document.getElementById('auth-user-badge');
    if (authUserBadge) {
      authUserBadge.addEventListener('click', () => {
        openLoginModal(activeUser && activeUser.role === 'owner' ? 'owner' : 'admin');
      });
    }

    const closeLoginBtn = document.getElementById('close-login-btn');
    if (closeLoginBtn) {
      closeLoginBtn.addEventListener('click', closeLoginModal);
    }

    // Dual-Panel Sliding Overlay Switchers
    const btnSwitchToOwner = document.getElementById('btn-switch-to-owner');
    if (btnSwitchToOwner) {
      btnSwitchToOwner.addEventListener('click', () => setAuthSliderMode('owner'));
    }

    const btnSwitchToAdmin = document.getElementById('btn-switch-to-admin');
    if (btnSwitchToAdmin) {
      btnSwitchToAdmin.addEventListener('click', () => setAuthSliderMode('admin'));
    }

    // Mobile Switcher Tabs
    const mobileTabAdmin = document.getElementById('mobile-tab-admin');
    if (mobileTabAdmin) {
      mobileTabAdmin.addEventListener('click', () => setAuthSliderMode('admin'));
    }

    const mobileTabOwner = document.getElementById('mobile-tab-owner');
    if (mobileTabOwner) {
      mobileTabOwner.addEventListener('click', () => setAuthSliderMode('owner'));
    }

    // JAFAR Creation animation preview triggers
    document.querySelectorAll('.jafar-anim-trigger').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerCinematicLoginBurst('JAFAR Creation Showcase', null);
      });
    });

    // Bidirectional sync between Franchise Select dropdown and User ID text input
    const teamSelect = document.getElementById('login-team-select');
    const teamUserInput = document.getElementById('login-team-user-input');

    if (teamSelect && teamUserInput) {
      teamSelect.addEventListener('change', () => {
        const selOpt = teamSelect.options[teamSelect.selectedIndex];
        if (selOpt && selOpt.getAttribute('data-user')) {
          teamUserInput.value = selOpt.getAttribute('data-user');
        }
      });

      teamUserInput.addEventListener('input', () => {
        const val = teamUserInput.value.trim().toLowerCase();
        if (!val) return;
        for (let i = 0; i < teamSelect.options.length; i++) {
          const opt = teamSelect.options[i];
          const optUser = (opt.getAttribute('data-user') || '').toLowerCase();
          const optVal = (opt.value || '').toLowerCase();
          const optText = (opt.text || '').toLowerCase();
          if (optUser === val || optVal === val || optText.includes(val)) {
            teamSelect.selectedIndex = i;
            break;
          }
        }
      });
    }

    // Collapsible Password Cheat-sheet for Senior Owners
    const cheatsheetBtn = document.getElementById('toggle-cheatsheet-btn');
    const cheatsheetBox = document.getElementById('team-credentials-cheatsheet');
    const cheatsheetLabel = document.getElementById('cheatsheet-btn-label');
    const quickFillGrid = document.getElementById('quick-fill-teams-grid');

    if (quickFillGrid && window.ALAMDAR_DATA?.INITIAL_TEAMS) {
      quickFillGrid.innerHTML = window.ALAMDAR_DATA.INITIAL_TEAMS.map((t) => `
        <button type="button" class="quick-fill-team-chip p-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-amber-400 text-left flex justify-between items-center transition-all cursor-pointer" data-team-id="${t.id}" data-user="${t.username}" data-pass="${t.password}">
          <span class="truncate">${t.icon || '🏏'} <strong class="text-white">${t.name.split(' ')[0]}</strong></span>
          <span class="font-mono text-amber-300 text-[10px] shrink-0 ml-1 font-bold">${t.username}</span>
        </button>
      `).join('');

      quickFillGrid.querySelectorAll('.quick-fill-team-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          const tId = chip.getAttribute('data-team-id');
          const tUser = chip.getAttribute('data-user');
          const tPass = chip.getAttribute('data-pass');

          if (teamSelect) teamSelect.value = tId;
          if (teamUserInput) teamUserInput.value = tUser;
          const passInp = document.getElementById('login-team-password');
          if (passInp) passInp.value = tPass;

          showToast(`Credentials filled for ${tUser}! Click Sign In.`, 'gold');
        });
      });
    }

    if (cheatsheetBtn && cheatsheetBox) {
      cheatsheetBtn.addEventListener('click', () => {
        const isHidden = cheatsheetBox.style.display === 'none' || !cheatsheetBox.style.display;
        cheatsheetBox.style.display = isHidden ? 'block' : 'none';
        if (cheatsheetLabel) {
          cheatsheetLabel.innerText = isHidden ? 'Hide Team Passwords List' : 'Show All 12 Team Passwords List';
        }
      });
    }

    // Quick Fill Admin Button
    const quickFillAdminBtn = document.getElementById('quick-fill-admin-btn');
    if (quickFillAdminBtn) {
      quickFillAdminBtn.addEventListener('click', () => {
        const adminUserInp = document.getElementById('login-admin-user');
        const adminPassInp = document.getElementById('login-admin-password');
        if (adminUserInp) adminUserInp.value = 'admin';
        if (adminPassInp) adminPassInp.value = 'alamdar@admin2026';
        showToast('Admin credentials filled!', 'gold');
      });
    }

    // Show/Hide Password Toggle Buttons
    const toggleTeamPassBtn = document.getElementById('toggle-team-pass-btn');
    if (toggleTeamPassBtn) {
      toggleTeamPassBtn.addEventListener('click', () => {
        const inp = document.getElementById('login-team-password');
        if (inp) {
          inp.type = inp.type === 'password' ? 'text' : 'password';
          toggleTeamPassBtn.innerText = inp.type === 'password' ? '👁️' : '🙈';
        }
      });
    }

    const toggleAdminPassBtn = document.getElementById('toggle-admin-pass-btn');
    if (toggleAdminPassBtn) {
      toggleAdminPassBtn.addEventListener('click', () => {
        const inp = document.getElementById('login-admin-password');
        if (inp) {
          inp.type = inp.type === 'password' ? 'text' : 'password';
          toggleAdminPassBtn.innerText = inp.type === 'password' ? '👁️' : '🙈';
        }
      });
    }

    // Form 1: Team Owner Login Form Submission
    const ownerForm = document.getElementById('owner-login-form');
    if (ownerForm) {
      ownerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const userInput = (document.getElementById('login-team-user-input')?.value || '').trim();
        const selectVal = (document.getElementById('login-team-select')?.value || '').trim();
        const teamVal = userInput || selectVal;
        const passVal = document.getElementById('login-team-password').value;
        const errorEl = document.getElementById('login-owner-error-msg');

        const authRes = AuctionEngine.authenticateTeam(teamVal, passVal);
        if (authRes.success) {
          activeUser = authRes;
          triggerCinematicLoginBurst(authRes.name || 'Franchise Terminal', () => {
            showToast(`Welcome, ${authRes.name}! Your franchise terminal is ready.`, 'success');
            switchView('owner');
            renderApp();
          });
        } else {
          if (errorEl) {
            errorEl.innerText = authRes.error;
            errorEl.style.display = 'block';
          }
        }
      });
    }

    // Form 2: Master Admin Login Form Submission
    const adminForm = document.getElementById('admin-login-form');
    if (adminForm) {
      adminForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const passVal = document.getElementById('login-admin-password').value;
        const errorEl = document.getElementById('login-admin-error-msg');

        const authRes = AuctionEngine.authenticateAdmin(passVal);
        if (authRes.success) {
          activeUser = authRes;
          triggerCinematicLoginBurst('Tournament Committee Admin', () => {
            showToast('Authenticated as Tournament Committee Admin!', 'success');
            switchView('admin');
            renderApp();
          });
        } else {
          if (errorEl) {
            errorEl.innerText = authRes.error;
            errorEl.style.display = 'block';
          }
        }
      });
    }

    // Logout Trigger (Clears session so user can change account)
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        AuctionEngine.logout();
        activeUser = StorageManager.getActiveUser();
        showToast('Signed out. You can now sign in with a different Franchise or Admin ID.', 'info');
        switchView('live');
        renderApp();
        openLoginModal('admin');
      });
    }

    // Re-claim Session Eviction
    const reauthBtn = document.getElementById('session-reauth-btn');
    if (reauthBtn) {
      reauthBtn.addEventListener('click', () => {
        document.getElementById('session-eviction-modal').style.display = 'none';
        openLoginModal('owner');
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

    // Fullscreen Mode Controller (Button + Keyboard Shortcut 'F' / 'F11')
    const fullscreenBtn = document.getElementById('fullscreen-toggle-btn');
    const fullscreenIcon = document.getElementById('fullscreen-icon');
    const fullscreenText = document.getElementById('fullscreen-text');

    function isFullscreenActive() {
      return Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
    }

    function updateFullscreenUI() {
      const isFS = isFullscreenActive();
      if (fullscreenIcon) fullscreenIcon.innerText = isFS ? '🗗' : '⛶';
      if (fullscreenText) fullscreenText.innerText = isFS ? 'Exit Fullscreen' : 'Fullscreen';
      if (fullscreenBtn) {
        if (isFS) {
          fullscreenBtn.classList.add('bg-[#C8A96A]/25', 'text-white', 'border-[#DFC897]');
          fullscreenBtn.title = 'Exit Fullscreen (Shortcut: Press Esc or F)';
        } else {
          fullscreenBtn.classList.remove('bg-[#C8A96A]/25', 'text-white', 'border-[#DFC897]');
          fullscreenBtn.title = 'Toggle Fullscreen Mode (Keyboard shortcut: "F" or "F11")';
        }
      }
    }

    async function toggleFullscreen() {
      try {
        if (!isFullscreenActive()) {
          const docEl = document.documentElement;
          if (docEl.requestFullscreen) {
            await docEl.requestFullscreen();
          } else if (docEl.webkitRequestFullscreen) {
            await docEl.webkitRequestFullscreen();
          } else if (docEl.msRequestFullscreen) {
            await docEl.msRequestFullscreen();
          }
          showToast('🖥️ Fullscreen Mode Active (Press F or Esc to exit)', 'gold');
        } else {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if (document.webkitExitFullscreen) {
            await document.webkitExitFullscreen();
          } else if (document.msExitFullscreen) {
            await document.msExitFullscreen();
          }
          showToast('Exited Fullscreen Mode', 'info');
        }
      } catch (err) {
        console.warn('Fullscreen toggle error:', err);
      }
      updateFullscreenUI();
    }

    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', toggleFullscreen);
    }

    // Keyboard shortcut listener: Press 'F' or 'F11'
    window.addEventListener('keydown', (e) => {
      // Don't trigger if user is typing in an input, textarea, or select field
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
    });

    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach((evt) => {
      document.addEventListener(evt, updateFullscreenUI);
    });

    // 12-Franchise Demo Simulator Toggle Button
    const demoBotBtn = document.getElementById('admin-demo-bot-btn');
    if (demoBotBtn) {
      demoBotBtn.addEventListener('click', () => {
        const isActive = AuctionEngine.toggleDemoSimulator();
        if (isActive) {
          demoBotBtn.innerHTML = '🤖 12-Team Demo: <span class="text-emerald-300 font-extrabold">SIMULATING</span>';
          demoBotBtn.className = 'btn-primary btn-emerald text-xs py-2 px-3.5 rounded-xl font-black flex items-center gap-1.5 shadow-lg transition-all';
          showToast('🤖 12-Franchise Demo Simulator ACTIVATED! Eligible franchise owners will simulate realistic bids automatically.', 'gold');
        } else {
          demoBotBtn.innerHTML = '🤖 12-Team Demo Simulator: OFF';
          demoBotBtn.className = 'btn-outline text-amber-300 border-2 border-amber-500/50 hover:bg-amber-500/20 text-xs py-2 px-3.5 rounded-xl font-black flex items-center gap-1.5 transition-all';
          showToast('🤖 Demo Simulator paused.', 'info');
        }
      });
    }

    // Reset Tournament Button
    const resetBtn = document.getElementById('admin-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('CRITICAL ACTION: Reset all 96 players, 12 team squads, and budgets back to initial 1,00,000 coins?')) {
          StorageManager.resetTournament();
          showToast('Tournament has been fully reset to initial state!', 'error');
          window.location.reload();
        }
      });
    }

    // Owner Bidding Button (Giant Button in Owner Dashboard)
    const raiseBidBtn = document.getElementById('owner-raise-bid-btn');
    if (raiseBidBtn) {
      raiseBidBtn.addEventListener('click', () => {
        if (!activeUser || !activeUser.teamId) {
          showToast('Please sign in as a franchise owner first.', 'error');
          openLoginModal('owner');
          return;
        }

        const teamId = activeUser.teamId;
        const { slot1, slot2 } = currentAuctionState.activeBidders || {};
        const isSlot1 = slot1?.teamId === teamId;
        const isSlot2 = slot2?.teamId === teamId;
        const isInBattle = isSlot1 || isSlot2;

        if (!isInBattle) {
          // Join Battle Ring
          const joinRes = AuctionEngine.joinBattle(teamId);
          if (joinRes.success) {
            showToast('Entered the Bidding Ring!', 'success');
          } else {
            showToast(joinRes.error, 'error');
          }
        } else {
          // Raise Bid
          const res = AuctionEngine.placeBid(teamId);
          if (res.success) {
            showToast(`Bid raised to ₹${res.newBid.toLocaleString()}!`, 'gold');
          } else {
            showToast(res.error, 'error');
          }
        }
      });
    }

    // Owner Withdraw Button
    const withdrawBtn = document.getElementById('owner-withdraw-btn');
    if (withdrawBtn) {
      withdrawBtn.addEventListener('click', () => {
        if (!activeUser || !activeUser.teamId) return;
        const res = AuctionEngine.withdrawFromBattle(activeUser.teamId);
        if (res.success) {
          showToast('Withdrew from battle ring.', 'info');
        } else {
          showToast(res.error, 'error');
        }
      });
    }

    // Master Admin Official Gavel Controls (Admin ONLY)
    const adminSoldBtn = document.getElementById('admin-sold-btn');
    if (adminSoldBtn) {
      adminSoldBtn.addEventListener('click', () => {
        if (!activeUser || activeUser.role !== 'admin') {
          showToast('Security Violation: Only Master Admin / Auctioneer can hammer the gavel.', 'error');
          return;
        }

        // Immediately abort any active countdown interval to prevent duplicate confirmSale
        if (window._activeCountdownTimer) {
          clearInterval(window._activeCountdownTimer);
          window._activeCountdownTimer = null;
        }

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

    const adminUnsoldBtn = document.getElementById('admin-unsold-btn');
    if (adminUnsoldBtn) {
      adminUnsoldBtn.addEventListener('click', () => {
        if (!activeUser || activeUser.role !== 'admin') {
          showToast('Security Violation: Only Master Admin can mark players unsold.', 'error');
          return;
        }

        // Abort countdown interval if running
        if (window._activeCountdownTimer) {
          clearInterval(window._activeCountdownTimer);
          window._activeCountdownTimer = null;
        }

        const res = AuctionEngine.markPlayerUnsold();
        if (res.success) {
          showToast('Player marked UNSOLD and moved to end of Set queue.', 'info');
        } else {
          showToast(res.error, 'error');
        }
      });
    }

    const adminCountdownBtn = document.getElementById('admin-countdown-btn');
    if (adminCountdownBtn) {
      adminCountdownBtn.addEventListener('click', () => {
        if (!activeUser || activeUser.role !== 'admin') {
          showToast('Security Violation: Only Master Admin can trigger countdown.', 'error');
          return;
        }
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
  }

  // 3-2-1 Countdown Trigger
  function triggerCountdown() {
    const state = StorageManager.get(STORAGE_KEYS.STATE);
    if (!state.currentPlayerId || state.status !== 'BIDDING') {
      showToast('No active player currently under bidding.', 'error');
      return;
    }

    if (state.status === 'SOLD') {
      showToast('This player has already been sold.', 'error');
      return;
    }

    // Clear any existing countdown timer
    if (window._activeCountdownTimer) {
      clearInterval(window._activeCountdownTimer);
      window._activeCountdownTimer = null;
    }

    let count = 3;
    state.status = 'COUNTDOWN';
    state.hammerCountdown = count;
    StorageManager.set(STORAGE_KEYS.STATE, state);

    if (window.soundManager) window.soundManager.playGavelStrike();

    window._activeCountdownTimer = setInterval(() => {
      count--;
      const curState = StorageManager.get(STORAGE_KEYS.STATE);
      // If sale concluded or player changed or countdown aborted, stop interval
      if (curState.status !== 'COUNTDOWN' || !curState.currentPlayerId) {
        clearInterval(window._activeCountdownTimer);
        window._activeCountdownTimer = null;
        return;
      }

      if (count > 0) {
        curState.hammerCountdown = count;
        StorageManager.set(STORAGE_KEYS.STATE, curState);
        if (window.soundManager) window.soundManager.playGavelStrike();
      } else {
        clearInterval(window._activeCountdownTimer);
        window._activeCountdownTimer = null;
        curState.hammerCountdown = null;
        StorageManager.set(STORAGE_KEYS.STATE, curState);
        const res = AuctionEngine.confirmSale();
        if (res.success) {
          showToast(`🔨 Hammer fell! ${res.soldPlayer.name} SOLD to ${res.winningTeam.name}!`, 'success');
        } else {
          showToast(res.error, 'error');
        }
      }
    }, 1200);
  }

  // Switch View Tab
  function switchView(tab) {
    currentTab = tab;

    document.querySelectorAll('[data-view-tab]').forEach((btn) => {
      if (btn.getAttribute('data-view-tab') === tab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const liveView = document.getElementById('view-live');
    const ownerView = document.getElementById('view-owner');
    const adminView = document.getElementById('view-admin');

    if (liveView) liveView.style.display = tab === 'live' ? 'block' : 'none';
    if (ownerView) ownerView.style.display = tab === 'owner' ? 'block' : 'none';
    if (adminView) adminView.style.display = tab === 'admin' ? 'block' : 'none';

    renderApp();
  }

  // Master Render Coordinator
  function renderApp() {
    renderAuthBar();

    // Default to the logged in team if owner; otherwise default to Husaini Hawks for viewer
    let team = null;
    if (activeUser && activeUser.role === 'owner' && activeUser.teamId) {
      team = currentTeams.find((t) => t.id === activeUser.teamId);
    }
    if (!team) {
      team = currentTeams.find((t) => t.id === 'team_03') || currentTeams[0];
    }

    renderSidebar(team);

    // Active 2-Franchise Battle Ring (Displayed across Live, Owner, and Admin views)
    renderActiveBiddersRing('live-active-bidders-ring');
    renderActiveBiddersRing('owner-active-bidders-ring');
    renderActiveBiddersRing('admin-active-bidders-ring');

    if (currentTab === 'live') {
      renderLiveDisplay();
    } else if (currentTab === 'owner') {
      renderOwnerDashboard(team);
      renderOwnerSquadRoster(team);
    } else if (currentTab === 'admin') {
      renderAdminDashboard();
    }
  }

  // Top Auth Bar
  function renderAuthBar() {
    const guestControls = document.getElementById('auth-guest-controls');
    const userControls = document.getElementById('auth-user-controls');
    const userBadge = document.getElementById('auth-user-badge');
    const navOwnerTab = document.getElementById('nav-owner-tab');
    const navAdminTab = document.getElementById('nav-admin-tab');

    if (!activeUser || activeUser.role === 'audience') {
      if (guestControls) guestControls.style.display = 'flex';
      if (userControls) userControls.style.display = 'none';
      if (navOwnerTab) navOwnerTab.innerText = 'Owner Dashboard';
      if (navAdminTab) navAdminTab.innerText = 'Admin Control';
    } else {
      if (guestControls) guestControls.style.display = 'none';
      if (userControls) userControls.style.display = 'flex';

      if (activeUser.role === 'admin') {
        if (userBadge) {
          userBadge.innerText = '👑 Master Admin';
          userBadge.className = 'stone-badge text-[#C8A96A] border-[#C8A96A]/60 bg-[#134E43]/80 text-xs py-1 px-3 font-bold';
        }
        if (navAdminTab) navAdminTab.innerText = '⚡ Admin Control';
        if (navOwnerTab) navOwnerTab.innerText = 'Owner Dashboard';
      } else if (activeUser.role === 'owner') {
        const team = currentTeams.find((t) => t.id === activeUser.teamId);
        if (userBadge) {
          userBadge.innerText = team ? `${team.icon || '🏏'} ${team.name}` : '🏏 Team Owner';
          userBadge.className = 'stone-badge text-[#C8A96A] border-[#C8A96A]/60 bg-[#134E43]/80 text-xs py-1 px-3 font-bold';
        }
        if (navOwnerTab) navOwnerTab.innerText = team ? `🏏 ${team.name}` : 'My Dashboard';
        if (navAdminTab) navAdminTab.innerText = 'Admin Control';
      }
    }
  }

  // Render Left Sidebar (Used in Audience & Owner views)
  function renderSidebar(team) {
    const remBudget = team ? team.remainingBudget : 100000;
    const slots = team ? team.acquiredCount : 0;
    const pct = Math.min(100, Math.round((remBudget / 100000) * 100));

    // Update Audience View Sidebar
    const liveBudget = document.getElementById('live-sidebar-budget');
    const liveBar = document.getElementById('live-sidebar-budget-bar');
    const liveSlots = document.getElementById('live-sidebar-slots');
    if (liveBudget) liveBudget.innerText = `₹${remBudget.toLocaleString()}`;
    if (liveBar) liveBar.style.width = `${pct}%`;
    if (liveSlots) liveSlots.innerText = `${slots} / 8`;

    // Update Owner View Sidebar
    const ownerBudget = document.getElementById('owner-remaining-budget');
    const ownerBar = document.getElementById('owner-budget-bar');
    const ownerSlots = document.getElementById('owner-slots-count');
    if (ownerBudget) ownerBudget.innerText = `₹${remBudget.toLocaleString()}`;
    if (ownerBar) ownerBar.style.width = `${pct}%`;
    if (ownerSlots) ownerSlots.innerText = `${slots} / 8`;

    // Render Sidebar Teams List
    ['live-sidebar-teams-list', 'owner-sidebar-teams-list'].forEach((containerId) => {
      const container = document.getElementById(containerId);
      if (!container) return;

      container.innerHTML = currentTeams
        .map((t) => {
          const isSelected = activeUser && activeUser.teamId === t.id;
          return `
          <div class="flex justify-between items-center p-2 rounded-xl text-xs transition-all ${
            isSelected
              ? 'bg-[#134E43] border-2 border-[#C8A96A] shadow-md ring-1 ring-[#C8A96A]/50 text-[#F7F6F1]'
              : 'bg-[#0F3D34]/70 border border-[#C8A96A]/15 text-[#E6F0E9] hover:border-[#C8A96A]/30'
          }">
            <div class="flex items-center gap-2 truncate">
              <span class="text-base">${t.icon || '🏏'}</span>
              <span class="font-extrabold text-[#F7F6F1] truncate">${t.name}</span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-[11px] text-[#E6F0E9] font-mono-num font-semibold">${t.acquiredCount}/8 Slots</span>
              <span class="text-[11px] text-[#C8A96A] font-mono-num font-black">₹${t.remainingBudget.toLocaleString()}</span>
            </div>
          </div>
        `;
        })
        .join('');
    });

    // Render Bottom 12-Teams Grid in Audience View & Owner Dashboard (4 Columns as in Screenshot 3)
    ['live-bottom-teams-grid', 'owner-bottom-teams-grid'].forEach((gridId) => {
      const bottomGrid = document.getElementById(gridId);
      if (!bottomGrid) return;
      bottomGrid.innerHTML = currentTeams
        .map((t) => `
        <div class="glass-panel p-3.5 space-y-1.5 border border-[#C8A96A]/20 bg-[#134E43]/85 text-[#F7F6F1]">
          <div class="flex justify-between items-center text-xs">
            <div class="flex items-center gap-2 truncate">
              <span class="text-base">${t.icon || '🏏'}</span>
              <span class="font-black text-[#F7F6F1] truncate">${t.name}</span>
            </div>
            <span class="text-[11px] font-bold text-[#E6F0E9] font-mono-num">${t.acquiredCount}/8 Slots</span>
          </div>
          <div class="text-[11px] text-[#E6F0E9] font-medium">
            Purse Remaining: <strong class="text-[#C8A96A] font-mono-num font-black">₹${t.remainingBudget.toLocaleString()}</strong>
          </div>
        </div>
      `)
        .join('');
    });
  }

  // -------------------------------------------------------------
  // 1. RENDER AUDIENCE SCREEN
  // -------------------------------------------------------------
  function renderLiveDisplay() {
    const p = currentAuctionState.currentPlayer;
    const hasPlayer = Boolean(p && (currentAuctionState.status === 'BIDDING' || currentAuctionState.status === 'COUNTDOWN'));

    const nameEl = document.getElementById('live-player-name');
    const specEl = document.getElementById('live-player-spec');
    const detailsEl = document.getElementById('live-player-details');
    const basePriceEl = document.getElementById('live-player-base-price');

    if (nameEl) nameEl.innerText = hasPlayer ? p.name.toUpperCase() : 'WAITING FOR PLAYER ON STAGE...';
    if (specEl) {
      specEl.innerText = hasPlayer ? p.specialization.toUpperCase() : 'BOX CRICKET 2026';
    }
    if (detailsEl) {
      detailsEl.innerText = hasPlayer
        ? `Age: ${p.age} • Bat: ${p.batsmanType} • Bowl: ${p.bowlerType}`
        : 'Select stone set and push player to stage in Admin Control';
    }
    if (basePriceEl) {
      basePriceEl.innerText = hasPlayer ? `₹${p.basePrice.toLocaleString()}` : '₹1,000';
    }

    const bidEl = document.getElementById('live-bid-display');
    const bidderEl = document.getElementById('live-highest-bidder-name');

    if (bidEl) bidEl.innerText = `₹${currentAuctionState.currentBid.toLocaleString()}`;
    if (bidderEl) {
      bidderEl.innerText = currentAuctionState.highestBidderTeamName
        ? `Leading: ${currentAuctionState.highestBidderTeamName}`
        : 'Awaiting Opening Bid';
    }

    // Update Right Column Player Spotlight Photo & Attributes Card (Audience Screen)
    const cardAge = document.getElementById('live-card-player-age');
    const cardBat = document.getElementById('live-card-player-bat');
    const cardBowl = document.getElementById('live-card-player-bowl');
    const cardImg = document.getElementById('live-card-player-img');
    const cardSvg = document.getElementById('live-card-player-svg');

    if (cardAge) cardAge.innerText = hasPlayer ? ` ${p.age}` : '';
    if (cardBat) cardBat.innerText = hasPlayer ? ` ${p.batsmanType}` : '';
    if (cardBowl) cardBowl.innerText = hasPlayer ? ` ${p.bowlerType}` : '';

    if (cardImg && cardSvg) {
      if (hasPlayer && p.photo) {
        cardImg.src = p.photo;
        cardImg.style.display = 'block';
        cardSvg.style.display = 'none';
      } else {
        cardImg.style.display = 'none';
        cardSvg.style.display = 'block';
      }
    }
  }

  // -------------------------------------------------------------
  // 2. RENDER OWNER DASHBOARD (EXACTLY AS SCREENSHOT 1)
  // -------------------------------------------------------------
  function renderOwnerDashboard(team) {
    const p = currentAuctionState.currentPlayer;
    const hasPlayer = Boolean(p && (currentAuctionState.status === 'BIDDING' || currentAuctionState.status === 'COUNTDOWN'));

    const pName = document.getElementById('owner-current-player-name');
    const pStats = document.getElementById('owner-current-player-stats');
    const curBid = document.getElementById('owner-current-bid-display');
    const nextBid = document.getElementById('owner-next-bid-step');
    const leadBadge = document.getElementById('owner-leading-badge');

    if (pName) pName.innerText = hasPlayer ? p.name.toUpperCase() : 'WAITING FOR PLAYER ON STAGE...';
    if (pStats) {
      pStats.innerText = hasPlayer
        ? `Age: ${p.age} • Bat: ${p.batsmanType} • Bowl: ${p.bowlerType}`
        : 'Auctioneer has not placed a player on the block yet';
    }

    if (curBid) curBid.innerText = `₹${currentAuctionState.currentBid.toLocaleString()}`;
    if (nextBid) {
      nextBid.innerText = `₹${currentAuctionState.basePrice.toLocaleString()} / ₹${currentAuctionState.nextMinBid.toLocaleString()}`;
    }
    if (leadBadge) {
      leadBadge.innerText = currentAuctionState.highestBidderTeamName
        ? `Leading: ${currentAuctionState.highestBidderTeamName}`
        : 'Awaiting Opening Bid';
    }

    // Update Right Column Player Spotlight Photo & Attributes Card (As in Reference Photo)
    const cardAge = document.getElementById('owner-card-player-age');
    const cardBat = document.getElementById('owner-card-player-bat');
    const cardBowl = document.getElementById('owner-card-player-bowl');
    const cardImg = document.getElementById('owner-card-player-img');
    const cardSvg = document.getElementById('owner-card-player-svg');

    if (cardAge) cardAge.innerText = hasPlayer ? ` ${p.age}` : '';
    if (cardBat) cardBat.innerText = hasPlayer ? ` ${p.batsmanType}` : '';
    if (cardBowl) cardBowl.innerText = hasPlayer ? ` ${p.bowlerType}` : '';

    if (cardImg && cardSvg) {
      if (hasPlayer && p.photo) {
        cardImg.src = p.photo;
        cardImg.style.display = 'block';
        cardSvg.style.display = 'none';
      } else {
        cardImg.style.display = 'none';
        cardSvg.style.display = 'block';
      }
    }

    // Evaluate Bidding Actions & Rules
    const hasBoughtFromSet = team.ownedSetIds && team.ownedSetIds.includes(currentAuctionState.currentSetId);
    const isRosterFull = team.acquiredCount >= team.maxAuctionSlots;

    const { slot1, slot2 } = currentAuctionState.activeBidders || {};
    const isSlot1 = slot1?.teamId === team.id;
    const isSlot2 = slot2?.teamId === team.id;
    const isInBattle = isSlot1 || isSlot2;
    const isBattleFull = Boolean(slot1 && slot2);
    const isLeading = currentAuctionState.highestBidderTeamId === team.id;

    const raiseBtn = document.getElementById('owner-raise-bid-btn');
    const withdrawBtn = document.getElementById('owner-withdraw-btn');

    if (raiseBtn) {
      if (hasBoughtFromSet) {
        raiseBtn.disabled = true;
        raiseBtn.className = 'w-full py-4 px-6 rounded-2xl font-bold text-sm uppercase bg-[#9e2a2b]/60 border border-[#9e2a2b] text-[#F7F6F1]';
        raiseBtn.innerText = `⛔ MAX 1 PLAYER PER SET REACHED ("${currentAuctionState.currentSetName}")`;
      } else if (isRosterFull) {
        raiseBtn.disabled = true;
        raiseBtn.className = 'w-full py-4 px-6 rounded-2xl font-bold text-sm uppercase bg-[#134E43] border border-[#C8A96A] text-[#C8A96A]';
        raiseBtn.innerText = '🏆 SQUAD COMPLETE (8 PLAYERS ACQUIRED)';
      } else if (!isInBattle) {
        raiseBtn.disabled = isBattleFull || !hasPlayer;
        if (isBattleFull) {
          raiseBtn.className = 'w-full py-4 px-6 rounded-2xl font-bold text-sm uppercase bg-[#0a2c25] border border-[#C8A96A]/20 text-[#E6F0E9]';
          raiseBtn.innerText = '🔒 BATTLE RING FULL (2 FRANCHISES ACTIVE)';
        } else {
          raiseBtn.className = 'w-full py-4 px-6 rounded-2xl font-black text-base uppercase bg-[#C8A96A] hover:bg-[#DFC897] text-[#0F3D34] shadow-xl cursor-pointer';
          raiseBtn.innerText = '⚔️ JOIN BIDDING BATTLE';
        }
      } else {
        // Team is in battle
        if (isLeading) {
          raiseBtn.disabled = true;
          raiseBtn.className = 'w-full py-4 px-6 rounded-2xl font-black text-sm sm:text-base uppercase tracking-wider bg-[#134E43] text-[#F7F6F1] border-2 border-[#C8A96A] shadow-xl';
          raiseBtn.innerText = `YOU HOLD THE HIGHEST BID (₹${currentAuctionState.currentBid.toLocaleString()})`;
        } else {
          raiseBtn.disabled = !hasPlayer;
          raiseBtn.className = 'w-full py-4 px-6 rounded-2xl font-black text-base uppercase bg-[#C8A96A] hover:bg-[#DFC897] text-[#0F3D34] shadow-xl cursor-pointer';
          raiseBtn.innerText = `🔥 RAISE BID TO ₹${currentAuctionState.nextMinBid.toLocaleString()}`;
        }
      }
    }

    if (withdrawBtn) {
      withdrawBtn.disabled = isLeading || !isInBattle;
      if (isLeading) {
        withdrawBtn.className = 'w-full py-4 px-6 rounded-2xl font-bold text-sm text-[#E6F0E9]/40 bg-[#0a2c25] border border-[#C8A96A]/10 opacity-50 cursor-not-allowed';
      } else {
        withdrawBtn.className = 'w-full py-4 px-6 rounded-2xl font-bold text-sm text-[#E6F0E9] bg-[#0a2c25] hover:bg-[#134E43] border border-[#C8A96A]/20 shadow-xl cursor-pointer';
      }
    }
  }

  // -------------------------------------------------------------
  // 3. RENDER ADMIN CONTROL (EXACTLY AS SCREENSHOT 2)
  // -------------------------------------------------------------
  function renderAdminDashboard() {
    const adminSetSelect = document.getElementById('admin-set-select');
    if (adminSetSelect && adminSetSelect.children.length === 0) {
      adminSetSelect.innerHTML = window.ALAMDAR_DATA.SET_CONFIG.map(
        (s) => `<option value="${s.id}">${s.name} (${s.meaning})</option>`
      ).join('');
      adminSetSelect.value = currentAuctionState.currentSetId;
    }

    // Update Live Stage info in Gavel Controls
    const gavelLabel = document.getElementById('admin-gavel-player-label');
    if (gavelLabel) {
      if (currentAuctionState.currentPlayer && (currentAuctionState.status === 'BIDDING' || currentAuctionState.status === 'COUNTDOWN')) {
        const lead = currentAuctionState.highestBidderTeamName ? ` • Leading: ${currentAuctionState.highestBidderTeamName}` : ' • Opening ₹1,000';
        gavelLabel.innerText = `${currentAuctionState.currentPlayer.name} (₹${currentAuctionState.currentBid.toLocaleString()}${lead})`;
        gavelLabel.className = 'font-black text-[#C8A96A]';
      } else {
        gavelLabel.innerText = 'No player currently on stage';
        gavelLabel.className = 'font-bold text-[#E6F0E9]/60';
      }
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
      <div class="p-4 rounded-2xl border flex items-center justify-between text-xs transition-all ${
        isLive
          ? 'bg-[#134E43] border-2 border-[#C8A96A] ring-2 ring-[#C8A96A]/50'
          : p.status === 'SOLD'
            ? 'bg-[#0F3D34]/70 border border-[#C8A96A]/15 opacity-60'
            : p.status === 'UNSOLD'
              ? 'bg-[#9e2a2b]/20 border border-[#9e2a2b]/50'
              : 'bg-[#134E43]/60 border border-[#C8A96A]/15'
      }">
        <div>
          <div class="flex items-center gap-2">
            <span class="font-bold text-[#F7F6F1] text-sm">${p.name}</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
              isLive
                ? 'bg-[#C8A96A] text-[#0F3D34]'
                : p.status === 'AVAILABLE'
                  ? 'bg-[#0F3D34] border border-[#C8A96A]/50 text-[#C8A96A]'
                  : p.status === 'SOLD'
                    ? 'bg-[#134E43] text-[#E6F0E9]'
                    : 'bg-[#9e2a2b] text-[#F7F6F1]'
            }">
              ${isLive ? 'CURRENTLY LIVE' : p.status}
            </span>
          </div>
          <p class="text-xs text-[#E6F0E9] mt-1">${p.specialization} • ${p.batsmanType}</p>
        </div>
        <div>
          ${
            p.status === 'SOLD'
              ? `<span class="font-mono-num text-[#C8A96A] font-black text-sm">₹${p.soldPrice.toLocaleString()} (${p.soldToTeamName})</span>`
              : `<button onclick="pushPlayerLiveAdmin('${p.id}')" class="px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider ${
                  isLive
                    ? 'bg-[#C8A96A] text-[#0F3D34] shadow-lg'
                    : 'bg-[#C8A96A] hover:bg-[#DFC897] text-[#0F3D34] shadow-md cursor-pointer'
                }">
                    ${isLive ? 'CURRENTLY LIVE' : 'PUSH LIVE'}
                  </button>`
          }
        </div>
      </div>
    `;
      })
      .join('');
  }

  // -------------------------------------------------------------
  // ACTIVE 2-FRANCHISE BIDDING BATTLE RING (LIVE, OWNER & ADMIN)
  // -------------------------------------------------------------
  function renderActiveBiddersRing(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const state = currentAuctionState || {};
    const { slot1, slot2 } = state.activeBidders || {};
    const hasPlayer = Boolean(state.currentPlayer && (state.status === 'BIDDING' || state.status === 'COUNTDOWN'));
    const highestBidder = state.highestBidderTeamId;
    const currentBid = state.currentBid || 0;

    if (!hasPlayer) {
      container.innerHTML = `
        <div class="p-3.5 rounded-2xl bg-[#092520]/80 border border-[#C8A96A]/20 text-center text-xs text-[#E6F0E9]/60 font-semibold flex items-center justify-center gap-2">
          <span class="text-base">⚔️</span>
          <span>Bidding Battle Ring on Standby — Awaiting Live Player on Stage</span>
        </div>
      `;
      return;
    }

    const team1 = slot1?.teamId ? currentTeams.find((t) => t.id === slot1.teamId) : null;
    const team2 = slot2?.teamId ? currentTeams.find((t) => t.id === slot2.teamId) : null;

    const renderSlotCard = (slotNum, slotData, teamObj) => {
      if (teamObj) {
        const isLeading = highestBidder === teamObj.id;
        const ownerName = teamObj.ownerName || teamObj.playingOwner || 'Franchise Owner';
        return `
          <div class="p-3.5 rounded-xl transition-all ${
            isLeading
              ? 'bg-[#134E43] border-2 border-[#C8A96A] shadow-xl ring-2 ring-[#C8A96A]/50'
              : 'bg-[#0F3D34]/90 border border-[#C8A96A]/30 shadow-md'
          }">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[10px] font-black uppercase tracking-wider text-[#C8A96A]">FRANCHISE #${slotNum}</span>
              ${
                isLeading
                  ? `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#C8A96A] text-[#0F3D34] shadow animate-pulse">👑 HIGHEST BIDDER (₹${currentBid.toLocaleString()})</span>`
                  : `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#092520] text-[#E6F0E9] border border-[#C8A96A]/30">⚔️ IN BATTLE RING</span>`
              }
            </div>
            <div class="flex items-center gap-2.5 mt-2">
              <span class="text-2xl shrink-0">${teamObj.icon || '🏏'}</span>
              <div class="truncate">
                <p class="font-black text-[#F7F6F1] text-sm sm:text-base truncate">${teamObj.name}</p>
                <p class="text-[11px] text-[#E6F0E9] font-medium truncate">Owner: ${ownerName}</p>
              </div>
            </div>
            <div class="flex items-center justify-between text-[11px] text-[#E6F0E9]/80 pt-2 mt-2.5 border-t border-[#C8A96A]/15 font-mono-num">
              <span>Purse: ₹${teamObj.remainingBudget.toLocaleString()}</span>
              <span>Slots: ${teamObj.acquiredCount}/8</span>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="p-3.5 rounded-xl border-2 border-dashed border-[#C8A96A]/30 bg-[#092520]/50 text-center flex flex-col items-center justify-center min-h-[96px]">
            <span class="text-base text-[#C8A96A]">➕</span>
            <p class="text-xs font-black text-[#F7F6F1] mt-0.5">Franchise Slot #${slotNum} Open</p>
            <p class="text-[10px] text-[#E6F0E9]/70 mt-0.5">Click "Join Bidding Battle" to lock in</p>
          </div>
        `;
      }
    };

    const isRingFull = Boolean(team1 && team2);
    const ringStatusText = isRingFull
      ? '🔒 BATTLE RING LOCKED: 2 Franchises are in head-to-head war! (Only they can raise bids until one withdraws)'
      : team1 || team2
      ? '⚡ 1 SLOT REMAINING: Another franchise can click "Join Bidding Battle" to challenge!'
      : '⚡ BATTLE RING OPEN: Any franchise can click "Join Bidding Battle" to place the opening bid!';

    container.innerHTML = `
      <div class="p-4 rounded-2xl bg-[#092520] border-2 border-[#C8A96A]/35 shadow-2xl">
        <div class="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-[#C8A96A]/20">
          <span class="text-xs font-black uppercase tracking-wider text-[#C8A96A] flex items-center gap-1.5">
            <span class="animate-pulse">⚔️</span>
            ACTIVE BIDDING BATTLE (2 FRANCHISES IN RING)
          </span>
          <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
            isRingFull ? 'bg-[#9e2a2b]/60 text-[#F7F6F1] border border-[#9e2a2b]' : 'bg-[#134E43] text-[#C8A96A] border border-[#C8A96A]/30'
          }">
            ${isRingFull ? 'RING LOCKED (2/2 TEAMS)' : 'OPEN FOR CHALLENGER (1/2)'}
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-stretch">
          ${renderSlotCard(1, slot1, team1)}
          ${renderSlotCard(2, slot2, team2)}
        </div>

        <p class="text-[11px] font-bold text-center mt-3 ${isRingFull ? 'text-[#C8A96A]' : 'text-[#E6F0E9]'}">
          ${ringStatusText}
        </p>
      </div>
    `;
  }

  // -------------------------------------------------------------
  // OWNER SQUAD ROSTER & TEAM POSTER DOWNLOAD
  // -------------------------------------------------------------
  function renderOwnerSquadRoster(team) {
    if (!team) return;

    const teamTitleEl = document.getElementById('owner-squad-team-name');
    const ownerCaptionEl = document.getElementById('owner-squad-owner-caption');
    const slotsBadgeEl = document.getElementById('owner-squad-slots-badge');
    const spentTotalEl = document.getElementById('owner-squad-spent-total');
    const remainingTotalEl = document.getElementById('owner-squad-remaining-total');
    const bannerEl = document.getElementById('owner-squad-celebration-banner');
    const downloadBtn = document.getElementById('owner-download-squad-btn');
    const downloadTextEl = document.getElementById('owner-download-btn-text');
    const gridEl = document.getElementById('owner-squad-grid');

    const spent = team.initialBudget - team.remainingBudget;
    const slotsCount = team.acquiredCount || 0;
    const isCompleted = slotsCount >= (team.maxAuctionSlots || 8);

    if (teamTitleEl) teamTitleEl.innerHTML = `<span>${team.icon || '🏏'}</span> ${team.name}`;
    if (ownerCaptionEl) {
      ownerCaptionEl.innerText = `Franchise Owner: ${team.ownerName || 'Bhai'} • Playing Captain: ${team.playingOwner}`;
    }
    if (slotsBadgeEl) {
      slotsBadgeEl.innerText = `${slotsCount} / ${team.maxAuctionSlots || 8} Slots Acquired`;
    }
    if (spentTotalEl) spentTotalEl.innerText = `₹${spent.toLocaleString()}`;
    if (remainingTotalEl) remainingTotalEl.innerText = `₹${team.remainingBudget.toLocaleString()}`;

    // Completion Banner & Download Button states
    if (bannerEl) {
      bannerEl.style.display = isCompleted ? 'flex' : 'none';
    }
    if (downloadTextEl) {
      downloadTextEl.innerText = isCompleted
        ? '🏆 Download Official 2026 Team Poster (PNG)'
        : `📥 Download Squad Card (${slotsCount}/8 Acquired)`;
    }
    if (downloadBtn) {
      if (isCompleted) {
        downloadBtn.className = 'w-full sm:w-auto px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider bg-[#C8A96A] hover:bg-[#DFC897] text-[#0F3D34] shadow-2xl ring-2 ring-[#C8A96A] animate-pulse transition-all flex items-center justify-center gap-2 cursor-pointer';
      } else {
        downloadBtn.className = 'w-full sm:w-auto px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider bg-[#C8A96A] hover:bg-[#DFC897] text-[#0F3D34] shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer';
      }
    }

    if (!gridEl) return;

    // Card 0: Playing Owner (Captain)
    const captainCard = `
      <div class="p-4 rounded-2xl bg-[#092520] border-2 border-[#C8A96A] shadow-xl flex flex-col justify-between space-y-3 relative overflow-hidden">
        <div class="flex items-center justify-between gap-2">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#C8A96A] text-[#0F3D34] shadow">
            👑 CAPTAIN & OWNER
          </span>
          <span class="text-xs text-[#C8A96A] font-black">₹0 (Captain)</span>
        </div>
        <div>
          <h4 class="text-lg font-black text-[#F7F6F1] uppercase tracking-tight">${team.playingOwner}</h4>
          <p class="text-xs text-[#E6F0E9] mt-0.5 font-bold">Playing Owner (Team Captain)</p>
          <p class="text-[11px] text-[#E6F0E9]/70 mt-1">Franchise Leader: ${team.ownerName || team.name}</p>
        </div>
        <div class="pt-2 border-t border-[#C8A96A]/20 flex items-center justify-between text-[11px]">
          <span class="text-[#C8A96A] font-bold">Permanent Squad Member</span>
          <span class="text-emerald-400 font-bold font-mono-num">Slot C</span>
        </div>
      </div>
    `;

    // Cards 1 to 8: Auction Slots
    const acquiredList = (team.roster || []).filter((r) => !r.isOwner);
    const auctionCards = [];

    for (let i = 0; i < (team.maxAuctionSlots || 8); i++) {
      const pItem = acquiredList[i];
      if (pItem) {
        const fullPly = currentPlayers.find((p) => p.id === pItem.playerId);
        const stoneSet = window.ALAMDAR_DATA.SET_CONFIG.find((s) => s.id === (pItem.setId || fullPly?.setId));
        const stoneColor = stoneSet?.color || '#C8A96A';
        const stoneName = stoneSet?.name || pItem.setName || 'Stone Set';

        auctionCards.push(`
          <div class="p-4 rounded-2xl bg-[#134E43]/90 border border-[#C8A96A]/30 shadow-lg flex flex-col justify-between space-y-3">
            <div class="flex items-center justify-between gap-2">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider" style="background:${stoneColor}25; color:${stoneColor}; border:1px solid ${stoneColor}60">
                💎 ${stoneName}
              </span>
              <span class="text-xs font-black font-mono-num text-[#C8A96A]">₹${(pItem.price || 0).toLocaleString()}</span>
            </div>
            <div>
              <h4 class="text-base font-black text-[#F7F6F1] uppercase tracking-tight truncate">${pItem.name}</h4>
              <p class="text-xs text-[#E6F0E9] mt-0.5 font-bold">${fullPly?.specialization || pItem.role || 'All-Rounder'}</p>
              <p class="text-[11px] text-[#E6F0E9]/70 mt-1">
                Age: ${fullPly?.age || '25'} • Bat: ${fullPly?.batsmanType?.split(' ')[0] || 'Right'} • Bowl: ${fullPly?.bowlerType?.split(' ')[0] || 'Fast'}
              </p>
            </div>
            <div class="pt-2 border-t border-[#C8A96A]/15 flex items-center justify-between text-[11px]">
              <span class="text-[#E6F0E9] font-medium font-mono-num">Slot #${i + 1}</span>
              <span class="text-emerald-400 font-bold">Acquired</span>
            </div>
          </div>
        `);
      } else {
        auctionCards.push(`
          <div class="p-4 rounded-2xl border-2 border-dashed border-[#C8A96A]/25 bg-[#092520]/40 flex flex-col justify-between space-y-3 min-h-[140px]">
            <div class="flex items-center justify-between gap-2">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0F3D34] text-[#E6F0E9]/60 border border-[#C8A96A]/15">
                OPEN SLOT #${i + 1}
              </span>
              <span class="text-xs text-[#E6F0E9]/40 font-mono-num">Empty</span>
            </div>
            <div class="text-center py-2">
              <p class="text-xs font-bold text-[#E6F0E9]/70">Awaiting Auction Player</p>
              <p class="text-[10px] text-[#C8A96A]/70 mt-0.5">Will be purchased from stone sets</p>
            </div>
            <div class="pt-2 border-t border-[#C8A96A]/10 flex items-center justify-between text-[11px] text-[#E6F0E9]/50">
              <span>Purse Available</span>
              <span class="font-mono-num">₹${team.remainingBudget.toLocaleString()}</span>
            </div>
          </div>
        `);
      }
    }

    gridEl.innerHTML = [captainCard, ...auctionCards].join('');
  }

  // -------------------------------------------------------------
  // HTML5 CANVAS HIGH-RES TEAM POSTER GENERATOR & DOWNLOADER
  // -------------------------------------------------------------
  window.downloadTeamSquadPoster = async function () {
    let team = null;
    if (activeUser && activeUser.role === 'owner' && activeUser.teamId) {
      team = currentTeams.find((t) => t.id === activeUser.teamId);
    }
    if (!team) {
      team = currentTeams.find((t) => t.id === 'team_03') || currentTeams[0];
    }
    if (!team) {
      showToast('Please select a team to download squad poster.', 'error');
      return;
    }

    // Create high-resolution 1200 x 1500 canvas
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1500;
    const ctx = canvas.getContext('2d');

    // Load Official Club Crest for Poster
    const logoImg = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = './icons/logo.png';
    });

    // 1. Background Gradient (Pine & Emerald tones)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 1500);
    bgGrad.addColorStop(0, '#0F3D34');
    bgGrad.addColorStop(0.5, '#092520');
    bgGrad.addColorStop(1, '#051814');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1200, 1500);

    // 2. Ornate Double Gold Borders
    ctx.strokeStyle = '#C8A96A';
    ctx.lineWidth = 5;
    ctx.strokeRect(30, 30, 1140, 1440);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(200, 169, 106, 0.45)';
    ctx.strokeRect(40, 40, 1120, 1420);

    // 3. Header Tournament Branding with Club Crests
    if (logoImg) {
      [180, 1020].forEach((cx) => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, 106, 36, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(logoImg, cx - 36, 106 - 36, 72, 72);
        ctx.restore();
        ctx.strokeStyle = '#C8A96A';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, 106, 36, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    ctx.fillStyle = '#C8A96A';
    ctx.font = '900 24px "Segoe UI", "Apple Color Emoji", Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ALAMDAR SPORTS CLUB • AMRAVATI', 600, 90);

    ctx.fillStyle = '#E6F0E9';
    ctx.font = '700 16px "Segoe UI", Inter, sans-serif';
    ctx.fillText('BOX CRICKET TOURNAMENT 2026 • OFFICIAL TEAM SQUAD', 600, 122);

    // Divider line
    ctx.strokeStyle = 'rgba(200, 169, 106, 0.35)';
    ctx.beginPath();
    ctx.moveTo(120, 145);
    ctx.lineTo(1080, 145);
    ctx.stroke();

    // 4. Team Hero Card Banner
    ctx.fillStyle = 'rgba(19, 78, 67, 0.9)';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(60, 170, 1080, 165, 20);
      ctx.fill();
    } else {
      ctx.fillRect(60, 170, 1080, 165);
    }
    ctx.strokeStyle = '#C8A96A';
    ctx.lineWidth = 2.5;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(60, 170, 1080, 165, 20);
      ctx.stroke();
    } else {
      ctx.strokeRect(60, 170, 1080, 165);
    }

    // Team Title & Icon
    ctx.fillStyle = '#C8A96A';
    ctx.font = '900 46px "Segoe UI", "Apple Color Emoji", Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${team.icon || '🏏'} ${team.name.toUpperCase()}`, 90, 235);

    // Owner & Captain subtext
    ctx.fillStyle = '#F7F6F1';
    ctx.font = '600 20px "Segoe UI", Inter, sans-serif';
    ctx.fillText(`Owner: ${team.ownerName || 'Bhai'}   •   Playing Captain: ${team.playingOwner}`, 90, 275);

    // Purse Summary on Right of Hero Card
    ctx.textAlign = 'right';
    const spent = team.initialBudget - team.remainingBudget;
    ctx.fillStyle = '#C8A96A';
    ctx.font = '800 22px "Segoe UI", Inter, sans-serif';
    ctx.fillText(`Purse Spent: ₹${spent.toLocaleString()}`, 1100, 235);
    ctx.fillStyle = '#10B981';
    ctx.font = '700 18px "Segoe UI", Inter, sans-serif';
    ctx.fillText(`Purse Left: ₹${team.remainingBudget.toLocaleString()}  (${team.acquiredCount}/8 Slots)`, 1100, 275);

    // 5. Squad Roster Table Header
    ctx.fillStyle = '#0F3D34';
    ctx.fillRect(60, 360, 1080, 45);
    ctx.strokeStyle = 'rgba(200, 169, 106, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(60, 360, 1080, 45);

    ctx.fillStyle = '#C8A96A';
    ctx.font = '900 15px "Segoe UI", Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('#', 85, 388);
    ctx.fillText('PLAYER NAME', 135, 388);
    ctx.fillText('SPECIALIZATION / ROLE', 480, 388);
    ctx.fillText('STONE SET', 800, 388);
    ctx.textAlign = 'right';
    ctx.fillText('PRICE (INR)', 1110, 388);

    // 6. Draw 9 Player Rows (Captain + 8 Slots)
    const startY = 415;
    const rowHeight = 90;

    const rosterItems = [
      {
        num: '👑',
        name: team.playingOwner,
        role: 'Playing Owner (Captain)',
        spec: 'Captain & Franchise Leader',
        setName: 'Permanent Captain',
        price: 'CAPTAIN (₹0)',
        isCaptain: true,
        filled: true
      }
    ];

    const acquired = (team.roster || []).filter((r) => !r.isOwner);
    for (let i = 0; i < 8; i++) {
      const pItem = acquired[i];
      if (pItem) {
        const pFull = currentPlayers.find((ply) => ply.id === pItem.playerId);
        rosterItems.push({
          num: `${i + 1}`,
          name: pItem.name,
          role: pFull ? `${pFull.specialization} • ${pFull.batsmanType?.split(' ')[0]}` : pItem.role,
          spec: pFull?.specialization || pItem.role || 'Player',
          setName: pItem.setName || 'Stone Set',
          price: `₹${(pItem.price || 0).toLocaleString()}`,
          isCaptain: false,
          filled: true
        });
      } else {
        rosterItems.push({
          num: `${i + 1}`,
          name: `[ Slot #${i + 1} - Awaiting Auction ]`,
          role: 'Pending Selection from Stone Sets',
          spec: 'Open Slot',
          setName: 'Available',
          price: '-',
          isCaptain: false,
          filled: false
        });
      }
    }

    rosterItems.forEach((item, index) => {
      const rowY = startY + index * rowHeight;
      const isEven = index % 2 === 0;

      // Row Background
      if (item.isCaptain) {
        ctx.fillStyle = 'rgba(200, 169, 106, 0.18)';
      } else if (item.filled) {
        ctx.fillStyle = isEven ? 'rgba(19, 78, 67, 0.65)' : 'rgba(15, 61, 52, 0.65)';
      } else {
        ctx.fillStyle = 'rgba(10, 41, 35, 0.35)';
      }

      ctx.fillRect(60, rowY, 1080, rowHeight - 6);
      ctx.strokeStyle = item.isCaptain ? 'rgba(200, 169, 106, 0.6)' : 'rgba(200, 169, 106, 0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(60, rowY, 1080, rowHeight - 6);

      // Number / Badge
      ctx.textAlign = 'left';
      ctx.fillStyle = item.isCaptain ? '#C8A96A' : '#E6F0E9';
      ctx.font = '800 20px "Segoe UI", "Apple Color Emoji", Inter, sans-serif';
      ctx.fillText(item.num, 85, rowY + 48);

      // Player Name
      ctx.fillStyle = item.isCaptain ? '#C8A96A' : item.filled ? '#F7F6F1' : 'rgba(230, 240, 233, 0.4)';
      ctx.font = item.filled || item.isCaptain ? '800 22px "Segoe UI", Inter, sans-serif' : '600 18px "Segoe UI", Inter, sans-serif';
      ctx.fillText(item.name.toUpperCase(), 135, rowY + 42);

      // Subtext Role
      ctx.fillStyle = item.isCaptain ? '#E6F0E9' : item.filled ? '#A8C5B8' : 'rgba(230, 240, 233, 0.3)';
      ctx.font = '500 14px "Segoe UI", Inter, sans-serif';
      ctx.fillText(item.role, 135, rowY + 68);

      // Role column
      ctx.fillStyle = '#E6F0E9';
      ctx.font = '600 17px "Segoe UI", Inter, sans-serif';
      ctx.fillText(item.spec, 480, rowY + 50);

      // Stone Set Badge Box
      ctx.fillStyle = item.isCaptain ? 'rgba(200, 169, 106, 0.25)' : 'rgba(19, 78, 67, 0.95)';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(790, rowY + 26, 160, 36, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200, 169, 106, 0.35)';
        ctx.stroke();
      } else {
        ctx.fillRect(790, rowY + 26, 160, 36);
        ctx.strokeRect(790, rowY + 26, 160, 36);
      }

      ctx.fillStyle = item.isCaptain ? '#C8A96A' : '#E6F0E9';
      ctx.font = '700 15px "Segoe UI", Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.setName, 870, rowY + 50);

      // Price Column
      ctx.textAlign = 'right';
      ctx.fillStyle = item.isCaptain ? '#C8A96A' : item.filled ? '#C8A96A' : 'rgba(230, 240, 233, 0.3)';
      ctx.font = '800 20px "Segoe UI", Inter, sans-serif';
      ctx.fillText(item.price, 1110, rowY + 50);
    });

    // 7. Footer Seal & Official Date
    ctx.strokeStyle = 'rgba(200, 169, 106, 0.35)';
    ctx.beginPath();
    ctx.moveTo(80, 1380);
    ctx.lineTo(1120, 1380);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#C8A96A';
    ctx.font = '800 16px "Segoe UI", Inter, sans-serif';
    ctx.fillText('★ OFFICIAL ROSTER VERIFICATION • ALAMDAR SPORTS COMMITTEE 2026 ★', 600, 1410);

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    ctx.fillStyle = 'rgba(230, 240, 233, 0.7)';
    ctx.font = '500 13px "Segoe UI", Inter, sans-serif';
    ctx.fillText(`Official Squad Poster • Generated on ${dateStr} • Box Cricket Season 2026`, 600, 1435);

    // 8. Download PNG Trigger
    const safeName = team.name.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${safeName}_Official_Squad_2026.png`;
    const link = document.createElement('a');
    link.download = fileName;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`🏆 Downloaded ${team.name} Official Squad Poster!`, 'success');
  };

  window.pushPlayerLiveAdmin = function (playerId) {
    const players = StorageManager.get(STORAGE_KEYS.PLAYERS) || currentPlayers;
    const p = players.find((ply) => ply.id === playerId);
    if (!p) return;

    // Hard check: prevent pushing already SOLD player
    if (p.status === 'SOLD') {
      showToast(`Cannot auction ${p.name}: Already SOLD to ${p.soldToTeamName || 'a franchise'}!`, 'error');
      return;
    }

    const teams = StorageManager.get(STORAGE_KEYS.TEAMS) || currentTeams;
    const alreadyOwner = teams.find((t) => t.roster && t.roster.some((r) => r.playerId === p.id));
    if (alreadyOwner) {
      showToast(`Cannot auction ${p.name}: Already acquired by ${alreadyOwner.name}!`, 'error');
      return;
    }

    // Clear any active countdown
    if (window._activeCountdownTimer) {
      clearInterval(window._activeCountdownTimer);
      window._activeCountdownTimer = null;
    }

    const state = StorageManager.get(STORAGE_KEYS.STATE) || {};
    state.status = 'BIDDING';
    state.currentSetId = p.setId;
    state.currentSetName = p.setName;
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
    state.version = (state.version || 0) + 1;

    currentAuctionState = state;
    StorageManager.set(STORAGE_KEYS.STATE, state);
    showToast(`Player ${p.name} is now LIVE on stage!`, 'gold');

    if (window.AuctionEngine && window.AuctionEngine.demoActive) {
      setTimeout(() => {
        if (window.AuctionEngine && window.AuctionEngine.demoActive) {
          window.AuctionEngine.executeDemoBiddingCycle();
          window.AuctionEngine.scheduleDemoTick();
        }
      }, 350);
    }

    renderApp();
  };

  window.renderApp = renderApp;
});