// ================================
// REPID - Popup Script
// Direct Wallet Connection (no WalletConnect modal)
// ================================

(function() {
  'use strict';

  // ================================
  // Configuration
  // ================================
  
  const CONFIG = {
    networks: {
      ethereum: { chainId: 1, name: 'Ethereum', explorer: 'https://etherscan.io', hex: '0x1' },
      polygon: { chainId: 137, name: 'Polygon', explorer: 'https://polygonscan.com', hex: '0x89' },
      arbitrum: { chainId: 42161, name: 'Arbitrum', explorer: 'https://arbiscan.io', hex: '0xa4b1' },
      optimism: { chainId: 10, name: 'Optimism', explorer: 'https://optimistic.etherscan.io', hex: '0xa' },
      base: { chainId: 8453, name: 'Base', explorer: 'https://basescan.org', hex: '0x2105' },
      bsc: { chainId: 56, name: 'BNB Chain', explorer: 'https://bscscan.com', hex: '0x38' },
      avalanche: { chainId: 43114, name: 'Avalanche', explorer: 'https://snowtrace.io', hex: '0xa86a' },
      zksync: { chainId: 324, name: 'zkSync', explorer: 'https://explorer.zksync.io', hex: '0x144' }
    }
  };

  // ================================
  // State
  // ================================
  
  let state = {
    connected: false,
    address: null,
    chainId: null,
    walletType: null,
    tagType: 'positive',
    currentProfile: null,
    tags: [],
    stats: { given: 0, received: 0, score: 0 }
  };

  // ================================
  // DOM Elements
  // ================================
  
  let el = {};

  // ================================
  // Initialize
  // ================================
  
  // Initialize immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    cacheElements();
    bindEvents();
    loadState();
    
    // Auto-refresh stats every 10 seconds
    setInterval(() => {
      if (state.connected && state.address) {
        loadStats();
      }
    }, 10000);
  }

  function cacheElements() {
    el.connectSection = document.getElementById('connectSection');
    el.walletSection = document.getElementById('walletSection');
    el.statsSection = document.getElementById('statsSection');
    el.connectBtn = document.getElementById('connectBtn');
    el.walletAddress = document.getElementById('walletAddress');
    el.disconnectBtn = document.getElementById('disconnectBtn');
    el.tagsGiven = document.getElementById('tagsGiven');
    el.tagsReceived = document.getElementById('tagsReceived');
    el.repScore = document.getElementById('repScore');
    el.profileCard = document.getElementById('profileCard');
    el.profileEmpty = document.getElementById('profileEmpty');
    el.profileInfo = document.getElementById('profileInfo');
    el.profileAvatar = document.getElementById('profileAvatar');
    el.profileName = document.getElementById('profileName');
    el.profilePlatform = document.getElementById('profilePlatform');
    el.tagCount = document.getElementById('tagCount');
    el.tagsList = document.getElementById('tagsList');
    el.tagsSection = document.getElementById('tagsSection');
    el.profileSection = document.getElementById('profileSection');
    el.settingsModal = document.getElementById('settingsModal');
    el.settingsBtn = document.getElementById('settingsBtn');
    el.closeSettings = document.getElementById('closeSettings');
    el.faqModal = document.getElementById('faqModal');
    el.faqBtn = document.getElementById('faqBtn');
    el.closeFaq = document.getElementById('closeFaq');
    el.txModal = document.getElementById('txModal');
    el.txIcon = document.getElementById('txIcon');
    el.txTitle = document.getElementById('txTitle');
    el.txMessage = document.getElementById('txMessage');
    el.txClose = document.getElementById('txClose');
    el.txRetry = document.getElementById('txRetry');
  }

  function bindEvents() {
    // Connect button - opens Reown connect page
    if (el.connectBtn) {
      el.connectBtn.addEventListener('click', openConnectPage);
    }
    if (el.disconnectBtn) {
      el.disconnectBtn.addEventListener('click', handleDisconnect);
    }
    
    // Tag Types (only if present - popup might not have tag creation)
    document.querySelectorAll('.tag-type-btn').forEach(btn => {
      btn.addEventListener('click', () => selectTagType(btn.dataset.type));
    });
    
    // Quick Tags
    document.querySelectorAll('.quick-tag').forEach(btn => {
      btn.addEventListener('click', () => {
        if (el.tagInput) {
          el.tagInput.value = btn.dataset.tag;
          updateCharCount();
          validateForm();
        }
      });
    });
    
    // Tag Input
    if (el.tagInput) {
      el.tagInput.addEventListener('input', () => {
        updateCharCount();
        validateForm();
      });
    }
    
    // Submit
    if (el.submitBtn) {
      el.submitBtn.addEventListener('click', submitTag);
    }
    
    // Settings
    if (el.settingsBtn && el.settingsModal) {
      el.settingsBtn.addEventListener('click', () => el.settingsModal.classList.remove('hidden'));
    }
    if (el.closeSettings && el.settingsModal) {
      el.closeSettings.addEventListener('click', () => el.settingsModal.classList.add('hidden'));
    }
    
    // FAQ
    if (el.faqBtn && el.faqModal) {
      el.faqBtn.addEventListener('click', () => el.faqModal.classList.remove('hidden'));
    }
    if (el.closeFaq && el.faqModal) {
      el.closeFaq.addEventListener('click', () => el.faqModal.classList.add('hidden'));
    }
    
    // TX Modal
    if (el.txClose) {
      el.txClose.addEventListener('click', closeTxModal);
    }
    if (el.txRetry) {
      el.txRetry.addEventListener('click', () => {
        closeTxModal();
        submitTag();
      });
    }
  }

  // ================================
  // Wallet Connection via Reown (injected on page)
  // ================================
  
  async function openConnectPage() {
    if (!el.connectBtn) return;
    
    el.connectBtn.disabled = true;
    el.connectBtn.innerHTML = `
      <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      Opening...
    `;
    
    try {
      // First try current tab
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (currentTab && currentTab.id && currentTab.url && 
          !currentTab.url.startsWith('chrome://') && 
          !currentTab.url.startsWith('chrome-extension://') &&
          !currentTab.url.startsWith('about:')) {
        // Current tab is valid, inject there
        await injectWalletConnector(currentTab.id);
        // Don't close - minimize popup so user can interact with page
        window.close();
        return;
      }
      
      // Try to find any existing tab with a website
      const allTabs = await chrome.tabs.query({ url: ['https://*/*', 'http://*/*'] });
      const validTab = allTabs.find(t => 
        t.url && 
        !t.url.includes('chrome-extension://') && 
        !t.url.includes('chrome://')
      );
      
      if (validTab) {
        // Switch to that tab and inject
        await chrome.tabs.update(validTab.id, { active: true });
        await new Promise(r => setTimeout(r, 300));
        await injectWalletConnector(validTab.id);
        window.close();
        return;
      }
      
      // No valid tabs found
      alert('Please open any website first, then try again.');
      resetConnectButton();
      
    } catch (error) {
      console.error('Connection error:', error);
      alert('Failed to open wallet connector. Please try again.');
      resetConnectButton();
    }
  }
  
  async function injectWalletConnector(tabId) {
    // Inject the wallet connector
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['wallet-injector.js'],
      world: 'MAIN'
    });
  }

  // Listen for storage changes (when wallet connects)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.connected && changes.connected.newValue === true) {
        // Reload state and update UI
        chrome.storage.local.get(['connected', 'address', 'chainId', 'walletType'], (result) => {
          if (result.connected) {
            state.connected = true;
            state.address = result.address;
            state.chainId = result.chainId;
            state.walletType = result.walletType;
            updateUI();
            onConnected();
          }
        });
      }
    }
  });

  function handleDisconnect() {
    state.connected = false;
    state.address = null;
    state.chainId = null;
    state.walletType = null;
    
    // Clear chrome storage
    chrome.storage.local.remove(['connected', 'address', 'chainId', 'walletType']);
    
    // Clear localStorage on current tab
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]?.id && !tabs[0].url?.startsWith('chrome')) {
        try {
          // Clear localStorage
          await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => {
              localStorage.removeItem('REPID_WALLET');
              localStorage.removeItem('REPID_FAB_POS');
              localStorage.removeItem('REPID_PANEL_POS');
            },
            world: 'MAIN'
          });
          
          // Send message to content script to remove widget
          chrome.tabs.sendMessage(tabs[0].id, { type: 'WALLET_DISCONNECTED' }).catch(() => {});
        } catch (e) {
          console.log('Could not clear localStorage:', e);
        }
      }
    });
    
    updateUI();
  }

  async function onConnected() {
    saveState();
    updateUI();
    
    // Register/update user in Supabase
    try {
      await window.repidAPI.upsertUser(state.address);
      console.log('User registered in Supabase');
    } catch (error) {
      console.error('Failed to register user:', error);
    }
    
    // Load stats and tags for current profile
    await loadStats();
    if (state.currentProfile) {
      await loadTags();
    }
  }

  function resetConnectButton() {
    if (!el.connectBtn) return;
    
    el.connectBtn.disabled = false;
    el.connectBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
      Connect Wallet
    `;
  }

  // ================================
  // Tag Functions
  // ================================
  
  function selectTagType(type) {
    state.tagType = type;
    document.querySelectorAll('.tag-type-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });
  }

  function updateCharCount() {
    if (!el.tagInput || !el.charCount) return;
    
    const len = el.tagInput.value.length;
    el.charCount.textContent = len + '/280';
    
    if (len > 260) el.charCount.style.color = 'var(--negative)';
    else if (len > 200) el.charCount.style.color = 'var(--neutral)';
    else el.charCount.style.color = 'var(--text-muted)';
  }

  function validateForm() {
    if (!el.tagInput || !el.submitBtn) return;
    
    const text = el.tagInput.value.trim();
    const valid = state.connected && text.length > 0 && text.length <= 280;
    el.submitBtn.disabled = !valid;
  }

  async function submitTag() {
    if (!state.connected || !el.tagInput) return;
    
    const text = el.tagInput.value.trim();
    if (!text) return;
    
    if (!state.currentProfile) {
      alert('Please navigate to a profile page first');
      return;
    }
    
    const network = 'polygon'; // Fixed network
    const netConfig = CONFIG.networks[network];
    
    showTxModal('pending');
    if (el.txTitle) el.txTitle.textContent = 'Creating Attestation...';
    if (el.txMessage) el.txMessage.textContent = 'Please sign in your wallet';
    
    try {
      // Create message to sign
      const timestamp = new Date().toISOString();
      const message = `REPID Attestation\n\nTarget: @${state.currentProfile.handle}\nPlatform: ${state.currentProfile.platform}\nType: ${state.tagType}\nContent: ${text}\nTimestamp: ${timestamp}\nNetwork: ${netConfig.name}`;
      
      // Sign message via content script (popup doesn't have window.ethereum)
      if (el.txMessage) el.txMessage.textContent = 'Sign the message in your wallet';
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      let signature = null;
      
      if (tab && tab.id) {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: signMessageInPage,
            args: [message, state.address],
            world: 'MAIN'
          });
          signature = results[0]?.result;
        } catch (e) {
          console.log('Signing in current tab failed, trying background tab');
        }
      }
      
      // If no signature from current tab, try opening a background tab
      if (!signature) {
        const tabs = await chrome.tabs.query({ url: ['https://*/*', 'http://*/*'] });
        const bgTab = tabs.find(t => t.url && !t.url.includes('chrome'));
        
        if (bgTab) {
          try {
            const results = await chrome.scripting.executeScript({
              target: { tabId: bgTab.id },
              func: signMessageInPage,
              args: [message, state.address],
              world: 'MAIN'
            });
            signature = results[0]?.result;
          } catch (e) {
            console.log('Background signing failed:', e);
          }
        }
      }
      
      if (!signature) {
        throw new Error('Failed to sign message. Please make sure your wallet is unlocked.');
      }
      
      if (el.txTitle) el.txTitle.textContent = 'Saving to database...';
      if (el.txMessage) el.txMessage.textContent = 'Recording your attestation';
      
      // Save to Supabase
      const tag = await window.repidAPI.createTag({
        author_address: state.address,
        target_handle: state.currentProfile.handle,
        target_platform: state.currentProfile.platform,
        tag_type: state.tagType,
        text: text,
        network: network,
        signature: signature,
        message: message
      });
      
      console.log('Tag created:', tag);
      
      // Update local state
      state.stats.given++;
      saveState();
      
      // Reload tags
      await loadTags();
      await loadProfileTags();
      await loadStats();
      
      if (el.tagInput) {
        el.tagInput.value = '';
        updateCharCount();
        validateForm();
      }
      
      showTxModal('success');
      
      notifyContentScript({ type: 'TAG_CREATED', tag: tag });
      
    } catch (error) {
      console.error('Submit error:', error);
      showTxModal('error');
      if (el.txMessage) {
        el.txMessage.textContent = error.message || 'Failed to create tag';
      }
    }
  }
  
  // Function to sign message in page context
  function signMessageInPage(message, address) {
    return new Promise(async (resolve) => {
      try {
        if (typeof window.ethereum === 'undefined') {
          resolve(null);
          return;
        }
        
        const signature = await window.ethereum.request({
          method: 'personal_sign',
          params: [message, address]
        });
        
        resolve(signature);
      } catch (error) {
        console.error('Sign error:', error);
        resolve(null);
      }
    });
  }

  // ================================
  // Profile Detection
  // ================================
  
  function detectProfile() {
    console.log('REPID detectProfile: starting');
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (!tabs[0]) {
        console.log('REPID detectProfile: no active tab');
        return;
      }
      
      console.log('REPID detectProfile: sending GET_PROFILE to tab', tabs[0].id);
      chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_PROFILE' }, response => {
        if (chrome.runtime.lastError) {
          console.log('REPID detectProfile: error', chrome.runtime.lastError);
          return;
        }
        
        console.log('REPID detectProfile: response', response);
        if (response?.profile) {
          state.currentProfile = response.profile;
          updateProfileUI();
          loadProfileTags();
          loadTags(); // Load tags for this profile
        }
      });
    });
  }

  function updateProfileUI() {
    const profile = state.currentProfile;
    
    if (!profile) {
      if (el.profileEmpty) el.profileEmpty.classList.remove('hidden');
      if (el.profileInfo) el.profileInfo.classList.add('hidden');
      return;
    }
    
    if (el.profileEmpty) el.profileEmpty.classList.add('hidden');
    if (el.profileInfo) el.profileInfo.classList.remove('hidden');
    
    if (el.profileAvatar) {
      el.profileAvatar.textContent = (profile.name || profile.handle || '?')[0].toUpperCase();
    }
    if (el.profileName) el.profileName.textContent = '@' + (profile.handle || 'unknown');
    if (el.profilePlatform) el.profilePlatform.textContent = profile.platform || 'Unknown';
    
    validateForm();
  }

  async function loadProfileTags() {
    if (!state.currentProfile) return;
    
    try {
      // Get profile stats from Supabase
      const profile = await window.repidAPI.getProfile(
        state.currentProfile.platform, 
        state.currentProfile.handle
      );
      
      // Profile data loaded, tags will be shown in loadTags()
      console.log('Profile loaded:', profile);
    } catch (error) {
      console.error('Error loading profile tags:', error);
    }
  }

  // ================================
  // Tags Management
  // ================================
  
  async function loadTags() {
    // Load tags FOR the current profile (what others wrote about them)
    console.log('REPID loadTags: currentProfile=', state.currentProfile);
    
    if (!state.currentProfile) {
      state.tags = [];
      updateTagsList();
      return;
    }
    
    try {
      console.log('REPID loadTags: fetching for', state.currentProfile.platform, state.currentProfile.handle);
      const tags = await window.repidAPI.getTagsForProfile(
        state.currentProfile.platform,
        state.currentProfile.handle
      );
      console.log('REPID loadTags: got tags', tags);
      state.tags = tags || [];
      updateTagsList();
    } catch (error) {
      console.error('Error loading tags:', error);
      state.tags = [];
      updateTagsList();
    }
  }

  function saveTags() {
    // Tags are now saved to Supabase, not local storage
    // This function is kept for compatibility but does nothing
  }

  function updateTagsList() {
    console.log('REPID updateTagsList: state.tags=', state.tags);
    const tags = state.tags.slice(0, 10);
    if (el.tagCount) el.tagCount.textContent = state.tags.length;
    
    if (!el.tagsList) {
      console.log('REPID updateTagsList: el.tagsList is null!');
      return;
    }
    
    console.log('REPID updateTagsList: showing', tags.length, 'tags');
    
    if (tags.length === 0) {
      el.tagsList.innerHTML = '<div class="tags-empty"><p>No tags yet</p><span>Be the first to leave a tag</span></div>';
      return;
    }
    
    el.tagsList.innerHTML = tags.map(tag => {
      const tagType = tag.tag_type || tag.type;
      const author = tag.author_address || tag.author;
      const timestamp = tag.created_at ? new Date(tag.created_at).getTime() : tag.timestamp;
      const hasSignature = !!tag.signature;
      
      const icon = tagType === 'positive' 
        ? '<svg class="tag-item-icon positive" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>'
        : tagType === 'negative'
        ? '<svg class="tag-item-icon negative" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>'
        : '<div class="tag-item-icon neutral"></div>';
      
      return `
        <div class="tag-item ${tagType}">
          ${icon}
          <div class="tag-item-content">
            <div class="tag-item-header">
              <span class="tag-item-author">${formatAddress(author)}</span>
              <span class="tag-item-date">${formatTime(timestamp)}</span>
            </div>
            <div class="tag-item-text">${escapeHtml(tag.text)}</div>
            <div class="tag-item-meta">
              ${hasSignature ? '<span class="tag-item-verified"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Signed</span>' : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ================================
  // Stats
  // ================================
  
  async function loadStats() {
    if (!state.address) {
      updateStats();
      return;
    }
    
    try {
      // Get user stats from Supabase
      const user = await window.repidAPI.getUser(state.address);
      
      if (user) {
        state.stats = {
          given: user.tags_given || 0,
          received: user.tags_received || 0,
          score: user.reputation_score || 0
        };
      }
      
      updateStats();
    } catch (error) {
      console.error('Error loading stats:', error);
      updateStats();
    }
  }

  function updateStats() {
    if (el.tagsGiven) el.tagsGiven.textContent = state.stats.given;
    if (el.tagsReceived) el.tagsReceived.textContent = state.stats.received;
    if (el.repScore) el.repScore.textContent = state.stats.score;
  }

  // ================================
  // UI Updates
  // ================================
  
  function updateUI() {
    if (state.connected) {
      if (el.connectSection) el.connectSection.classList.add('hidden');
      if (el.walletSection) el.walletSection.classList.remove('hidden');
      if (el.statsSection) el.statsSection.classList.remove('hidden');
      if (el.profileSection) el.profileSection.classList.remove('hidden');
      if (el.tagsSection) el.tagsSection.classList.remove('hidden');
      
      if (el.walletAddress) el.walletAddress.textContent = formatAddress(state.address);
    } else {
      if (el.connectSection) el.connectSection.classList.remove('hidden');
      if (el.walletSection) el.walletSection.classList.add('hidden');
      if (el.statsSection) el.statsSection.classList.add('hidden');
      if (el.profileSection) el.profileSection.classList.add('hidden');
      if (el.tagsSection) el.tagsSection.classList.add('hidden');
      resetConnectButton();
    }
    
    validateForm();
  }

  // ================================
  // Modals
  // ================================
  
  function showTxModal(type) {
    if (!el.txModal) return;
    el.txModal.classList.remove('hidden');
    
    if (el.txIcon) {
      el.txIcon.className = 'tx-icon ' + type;
      
      if (type === 'pending') {
        el.txIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`;
      } else if (type === 'success') {
        el.txIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
      } else if (type === 'error') {
        el.txIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
      }
    }
  }

  function closeTxModal() {
    if (el.txModal) el.txModal.classList.add('hidden');
  }

  // ================================
  // Storage
  // ================================
  
  function saveState() {
    chrome.storage.local.set({
      connected: state.connected,
      address: state.address,
      chainId: state.chainId,
      walletType: state.walletType
    });
  }

  function loadState() {
    chrome.storage.local.get(['connected', 'address', 'chainId', 'walletType'], (result) => {
      console.log('REPID popup: Loading state from storage', result);
      
      // If already connected in storage, use that
      if (result.connected && result.address) {
        state.connected = true;
        state.address = result.address;
        state.chainId = result.chainId || 137;
        state.walletType = result.walletType;
        
        updateUI();
        loadStats();
        detectProfile();
        return;
      }
      
      // Not connected - show UI immediately
      updateUI();
      detectProfile();
      
      // Check localStorage in background (non-blocking)
      checkLocalStorageBackup();
    });
  }
  
  async function checkLocalStorageBackup() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id && !tab.url?.startsWith('chrome')) {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const data = localStorage.getItem('REPID_WALLET');
            return data ? JSON.parse(data) : null;
          },
          world: 'MAIN'
        });
        
        const walletData = results[0]?.result;
        
        if (walletData && walletData.connected && walletData.address) {
          // Save to chrome.storage for future
          await chrome.storage.local.set(walletData);
          
          state.connected = true;
          state.address = walletData.address;
          state.chainId = walletData.chainId || 137;
          state.walletType = walletData.walletType;
          
          updateUI();
          loadStats();
          detectProfile();
        }
      }
    } catch (e) {
      console.log('REPID popup: Could not read localStorage', e);
    }
  }

  // ================================
  // Communication
  // ================================
  
  function notifyContentScript(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, message);
    });
  }

  // ================================
  // Utilities
  // ================================
  
  function formatAddress(addr) {
    if (!addr) return '';
    return addr.substr(0, 6) + '...' + addr.substr(-4);
  }

  function formatTime(timestamp) {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm';
    if (hours < 24) return hours + 'h';
    if (days < 7) return days + 'd';
    return new Date(timestamp).toLocaleDateString();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

})();
