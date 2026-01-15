(function() {
  'use strict';

  // ================================
  // Platform Configurations
  // ================================
  
  const PLATFORMS = {
    twitter: {
      hosts: ['twitter.com', 'x.com'],
      selectors: {
        profileHeader: '[data-testid="UserName"]',
        name: '[data-testid="UserName"] span > span',
        avatar: 'a[href$="/photo"] img, [data-testid="UserAvatar"] img',
        injectTarget: '[data-testid="UserName"]'
      },
      isProfile: () => {
        const path = window.location.pathname;
        return /^\/[a-zA-Z0-9_]{1,15}\/?$/.test(path) && 
               !/^\/(home|explore|notifications|messages|search|settings|i|compose|login)/.test(path);
      },
      getHandle: () => {
        const match = window.location.pathname.match(/^\/([a-zA-Z0-9_]{1,15})/);
        return match ? match[1] : null;
      }
    },
    
    github: {
      hosts: ['github.com'],
      selectors: {
        profileHeader: '.vcard-names-container',
        name: '.vcard-fullname, .p-name',
        avatar: '.avatar-user',
        injectTarget: '.vcard-names-container'
      },
      isProfile: () => /^\/[a-zA-Z0-9_-]+\/?$/.test(window.location.pathname) && !/^\/(explore|settings|orgs|users|login)/.test(window.location.pathname),
      getHandle: () => {
        const match = window.location.pathname.match(/^\/([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
      }
    },
    
    linkedin: {
      hosts: ['linkedin.com', 'www.linkedin.com'],
      selectors: {
        profileHeader: '.pv-top-card',
        name: 'h1.text-heading-xlarge',
        avatar: 'img.pv-top-card-profile-picture__image--show',
        injectTarget: '.pv-top-card'
      },
      isProfile: () => /^\/in\/[a-zA-Z0-9_-]+/.test(window.location.pathname),
      getHandle: () => {
        const match = window.location.pathname.match(/\/in\/([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
      }
    },
    
    youtube: {
      hosts: ['youtube.com', 'www.youtube.com'],
      selectors: {
        profileHeader: '#channel-header',
        name: '#channel-name yt-formatted-string',
        avatar: '#avatar img',
        injectTarget: '#channel-header-container'
      },
      isProfile: () => /^\/@[a-zA-Z0-9_]+|\/channel\/|\/c\/|\/user\//.test(window.location.pathname),
      getHandle: () => {
        const match = window.location.pathname.match(/\/@([a-zA-Z0-9_]+)|\/(?:channel|c|user)\/([a-zA-Z0-9_-]+)/);
        return match ? (match[1] || match[2]) : null;
      }
    },
    
    reddit: {
      hosts: ['reddit.com', 'www.reddit.com', 'sh.reddit.com'],
      selectors: {
        profileHeader: '[data-testid="profile-header"]',
        name: 'h1',
        avatar: 'img[alt*="avatar"]',
        injectTarget: '[data-testid="profile-header"]'
      },
      isProfile: () => /^\/(user|u)\/[a-zA-Z0-9_-]+/.test(window.location.pathname),
      getHandle: () => {
        const match = window.location.pathname.match(/\/(?:user|u)\/([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
      }
    },
    
    discord: {
      hosts: ['discord.com', 'discordapp.com'],
      selectors: {
        profileHeader: '[class*="userPopout"], [class*="userProfile"]',
        name: '[class*="username"], [class*="headerTag"]',
        avatar: '[class*="avatar"] img',
        injectTarget: 'body'
      },
      isProfile: () => document.querySelector('[class*="userPopout"], [class*="userProfile"]'),
      getHandle: () => {
        const el = document.querySelector('[class*="userPopout"] [class*="username"], [class*="userProfile"] [class*="username"]');
        return el ? el.textContent.trim() : null;
      }
    }
  };

  // ================================
  // State
  // ================================
  
  let currentPlatform = null;
  let currentProfile = null;
  let widgetElement = null;
  let profileTags = [];
  let isInjected = false;
  let isInjecting = false;
  let realtimeInterval = null;

  // ================================
  // Initialization
  // ================================
  
  function init() {
    setupWalletListener();
    currentPlatform = detectPlatform();
    
    if (!currentPlatform) return;
    
    // Observer for SPA navigation
    observeNavigation();
    
    // Periodic check for dynamic content load
    setInterval(() => {
      if (currentPlatform.config.isProfile() && !isInjected) {
        checkAndInject();
      }
    }, 1000);
    
    chrome.runtime.onMessage.addListener(handleMessage);
    checkAndInject();
  }

  function detectPlatform() {
    const host = window.location.hostname.replace('www.', '');
    for (const [name, config] of Object.entries(PLATFORMS)) {
      if (config.hosts.some(h => host.includes(h))) {
        return { name, config };
      }
    }
    return null;
  }

  function observeNavigation() {
    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        removeWidget();
        setTimeout(checkAndInject, 1000);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ================================
  // Wallet Logic
  // ================================

  function setupWalletListener() {
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      
      // Wallet Connected
      if (event.data?.type === 'REPID_WALLET_CONNECTED_BRIDGE') {
        const detail = event.data.detail;
        chrome.storage.local.set({
            connected: true,
            address: detail.address,
            chainId: detail.chainId,
            walletType: detail.walletType
        });
        localStorage.setItem('REPID_WALLET', JSON.stringify(detail));
        checkWalletConnection();
        
        // Sync to background
        chrome.runtime.sendMessage({
          type: 'SAVE_WALLET_CONNECTION',
          data: detail
        });
      }

      // Sign Result
      if (event.data?.type === 'REPID_SIGN_RESULT') {
        chrome.runtime.sendMessage({
          type: 'REPID_SIGN_RESPONSE',
          requestId: event.data.requestId,
          signature: event.data.signature,
          error: event.data.error
        });
      }
    });
  }

  // ================================
  // Injection Logic
  // ================================
  
  function checkAndInject() {
    if (!currentPlatform || isInjecting) return;
    
    if (!currentPlatform.config.isProfile()) {
      removeWidget();
      return;
    }
    
    const handle = currentPlatform.config.getHandle();
    if (!handle) return;
    
    if (isInjected && currentProfile && currentProfile.handle === handle) return;

    // Get basic profile info
    const nameEl = document.querySelector(currentPlatform.config.selectors.name);
    const avatarEl = document.querySelector(currentPlatform.config.selectors.avatar);
    
    currentProfile = {
      platform: currentPlatform.name,
      handle: handle,
      name: nameEl ? nameEl.textContent.trim() : handle,
      avatar: avatarEl ? avatarEl.src : '',
      url: window.location.href
    };

    isInjecting = true;
    
    loadProfileTags(() => {
      const target = document.querySelector(currentPlatform.config.selectors.injectTarget) || document.body;
      injectWidget(target);
    });
  }

  function loadProfileTags(callback) {
    if (!currentProfile) return;
    
    chrome.runtime.sendMessage({
      type: 'GET_TAGS_FOR_PROFILE',
      handle: currentProfile.handle,
      platform: currentProfile.platform
    }, (response) => {
      profileTags = response?.tags || [];
      if (callback) callback();
    });
  }

  function injectWidget(target) {
    removeWidget();
    
    // Stats
    let score = 0, positive = 0, negative = 0, neutral = 0;
    profileTags.forEach(tag => {
      if (tag.type === 'positive') { score++; positive++; }
      else if (tag.type === 'negative') { score--; negative++; }
      else neutral++;
    });

    // Create Panel
    widgetElement = document.createElement('div');
    widgetElement.className = 'repid-widget-container';
    widgetElement.innerHTML = createPanelHTML(score, positive, negative, neutral);
    document.body.appendChild(widgetElement);

    // Inject Button next to username
    injectSignButton();
    // Retry for slow loading DOMs
    [500, 1500, 3000].forEach(t => setTimeout(injectSignButton, t));

    bindWidgetEvents();
    startRealtimeUpdates();
    
    isInjected = true;
    isInjecting = false;
  }

  // ================================
  // UI Generation
  // ================================

  function injectSignButton() {
    if (document.querySelector('.repid-inline-sign')) return;
    
    const selectors = [
      currentPlatform.config.selectors.name,
      'h1',
      '[data-testid="UserName"]',
      '.p-nickname',
      '#channel-name'
    ];
    
    let targetEl = null;
    for (const sel of selectors) {
      targetEl = document.querySelector(sel);
      if (targetEl) break;
    }

    if (!targetEl) return;

    const btn = document.createElement('button');
    btn.className = 'repid-inline-sign';
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><span>Rep</span>`;
    
    // Platform specific positioning hacks
    if (currentPlatform.name === 'twitter') {
       const wrapper = document.createElement('span');
       wrapper.className = 'repid-username-wrapper';
       wrapper.style.display = 'inline-flex';
       wrapper.style.alignItems = 'center';
       if(targetEl.parentNode) {
         targetEl.parentNode.insertBefore(wrapper, targetEl);
         wrapper.appendChild(targetEl);
         wrapper.appendChild(btn);
       }
    } else {
       targetEl.appendChild(btn);
    }

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePanel(btn);
    });
  }

  function createPanelHTML(score, positive, negative, neutral) {
    const scoreSign = score > 0 ? '+' : '';
    const logoUrl = chrome.runtime.getURL('icons/logo.png');

    return `
      <div class="repid-panel" id="repid-panel">
        <div class="repid-panel-header">
          <div class="repid-header-brand">
            <img src="${logoUrl}" alt="" class="repid-header-logo">
            <div class="repid-header-text">
              <span class="repid-header-title">+rep ID</span>
              <span class="repid-header-tagline">ZK-Verified Reputation</span>
            </div>
          </div>
          <button class="repid-panel-close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        
        <div class="repid-panel-profile-bar">
          <div class="repid-profile-avatar">${(currentProfile.name[0] || '?').toUpperCase()}</div>
          <div class="repid-profile-details">
            <span class="repid-profile-handle">@${currentProfile.handle}</span>
            <span class="repid-profile-platform">
              <span class="repid-platform-dot"></span>${currentProfile.platform}
            </span>
          </div>
        </div>
        
        <div class="repid-panel-body">
          <div class="repid-score-section">
            <div class="repid-stat">
              <div class="repid-stat-icon score"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z"/></svg></div>
              <span class="repid-stat-value" data-stat="score">${scoreSign}${score}</span>
              <span class="repid-stat-label-text">Score</span>
            </div>
            <div class="repid-stat">
              <div class="repid-stat-icon positive"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg></div>
              <span class="repid-stat-value" data-stat="positive">${positive}</span>
              <span class="repid-stat-label-text">Pos</span>
            </div>
            <div class="repid-stat">
              <div class="repid-stat-icon negative"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg></div>
              <span class="repid-stat-value" data-stat="negative">${negative}</span>
              <span class="repid-stat-label-text">Neg</span>
            </div>
          </div>
          
          <div class="repid-form" id="repid-tag-form">
            <div class="repid-type-btns">
              <button class="repid-type-btn active" data-type="positive">Positive</button>
              <button class="repid-type-btn" data-type="negative">Negative</button>
            </div>
            <textarea class="repid-input" placeholder="Write something..." maxlength="280" rows="2"></textarea>
            <button class="repid-submit" disabled>
              <span class="repid-submit-text">Submit Tag</span>
              <span class="repid-submit-loading" style="display:none;">Signing...</span>
            </button>
          </div>
          
          <div class="repid-connect" id="repid-connect-prompt" style="display:none;">
            <p>Connect wallet to tag</p>
          </div>
          
          ${createRecentTagsHTML()}
        </div>
      </div>
    `;
  }

  function createRecentTagsHTML() {
    if (profileTags.length === 0) return '';
    return `
      <div class="repid-tags">
        <div class="repid-tags-title">Recent</div>
        ${profileTags.slice(0, 3).map(tag => `
          <div class="repid-tag ${tag.type}">
            <div class="repid-tag-content">
              <span class="repid-tag-text">${escapeHtml(tag.text)}</span>
              <span class="repid-tag-meta">${formatAddress(tag.author)}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ================================
  // Interaction & Events
  // ================================

  function togglePanel(btn) {
    const panel = widgetElement.querySelector('#repid-panel');
    if (!panel) return;
    
    if (panel.classList.contains('open')) {
      panel.classList.remove('open');
      return;
    }

    const rect = btn.getBoundingClientRect();
    let top = rect.bottom + 10;
    let left = rect.left;

    // Viewport bounds
    if (left + 320 > window.innerWidth) left = window.innerWidth - 330;
    if (top + 400 > window.innerHeight) top = rect.top - 410;

    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
    panel.classList.add('open');
  }

  function bindWidgetEvents() {
    const closeBtn = widgetElement.querySelector('.repid-panel-close');
    const submitBtn = widgetElement.querySelector('.repid-submit');
    const input = widgetElement.querySelector('.repid-input');
    const typeBtns = widgetElement.querySelectorAll('.repid-type-btn');

    closeBtn?.addEventListener('click', () => widgetElement.querySelector('#repid-panel').classList.remove('open'));

    typeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        typeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    input?.addEventListener('input', () => {
      submitBtn.disabled = !input.value.trim();
    });

    submitBtn?.addEventListener('click', submitTag);
    checkWalletConnection();
  }

  function checkWalletConnection() {
    const walletData = JSON.parse(localStorage.getItem('REPID_WALLET') || '{}');
    const form = widgetElement?.querySelector('#repid-tag-form');
    const prompt = widgetElement?.querySelector('#repid-connect-prompt');
    
    const isConnected = walletData.connected && walletData.address;
    if (form) form.style.display = isConnected ? 'block' : 'none';
    if (prompt) prompt.style.display = isConnected ? 'none' : 'block';
    
    return isConnected;
  }

  async function submitTag() {
    const input = widgetElement.querySelector('.repid-input');
    const typeBtn = widgetElement.querySelector('.repid-type-btn.active');
    const submitBtn = widgetElement.querySelector('.repid-submit');
    
    const text = input.value.trim();
    const type = typeBtn.dataset.type;
    const walletData = JSON.parse(localStorage.getItem('REPID_WALLET') || '{}');

    if (!text || !walletData.address) return;

    // UI Loading
    submitBtn.disabled = true;
    submitBtn.querySelector('.repid-submit-text').style.display = 'none';
    submitBtn.querySelector('.repid-submit-loading').style.display = 'inline';

    try {
      // 1. Sign Message
      const message = `REPID Tag\nTarget: ${currentProfile.handle}\nType: ${type}\nText: ${text}\nTimestamp: ${Date.now()}`;
      const signature = await signMessage(message);
      
      if (!signature) throw new Error('Signing failed');

      // 2. Send to Background -> Supabase
      chrome.runtime.sendMessage({
        type: 'CREATE_TAG',
        tag: {
          author_address: walletData.address,
          target_handle: currentProfile.handle,
          target_platform: currentProfile.platform,
          tag_type: type,
          text: text,
          signature: signature,
          message: message
        }
      }, (response) => {
        if (response?.success) {
          showToast('Tag added!');
          input.value = '';
          loadProfileTags(updateWidgetTags);
        } else {
          showToast('Error: ' + response.error);
        }
        resetSubmitBtn(submitBtn);
      });

    } catch (e) {
      console.error(e);
      showToast('Error: ' + e.message);
      resetSubmitBtn(submitBtn);
    }
  }

  // ================================
  // Helpers
  // ================================

  async function signMessage(message) {
    if (!document.getElementById('repid-sign-helper')) {
       const script = document.createElement('script');
       script.id = 'repid-sign-helper';
       script.src = chrome.runtime.getURL('sign-helper.js');
       document.head.appendChild(script);
       await new Promise(r => setTimeout(r, 100));
    }

    return new Promise((resolve) => {
      const requestId = 'req_' + Date.now();
      const handler = (e) => {
        if (e.detail?.requestId === requestId) {
           window.removeEventListener('REPID_SIGN_RESPONSE', handler);
           resolve(e.detail.signature);
        }
      };
      window.addEventListener('REPID_SIGN_RESPONSE', handler);
      window.dispatchEvent(new CustomEvent('REPID_SIGN_REQUEST', { detail: { requestId, message } }));
    });
  }

  function updateWidgetTags() {
    const panel = widgetElement.querySelector('#repid-panel');
    if (panel) {
      // Simple refresh: recreate panel HTML but keep position
      const rect = panel.getBoundingClientRect();
      injectWidget();
      const newPanel = document.querySelector('#repid-panel');
      newPanel.style.top = rect.top + 'px';
      newPanel.style.left = rect.left + 'px';
      newPanel.classList.add('open');
    }
  }

  function removeWidget() {
    if (realtimeInterval) clearInterval(realtimeInterval);
    document.querySelectorAll('.repid-widget-container, .repid-inline-sign, .repid-username-wrapper').forEach(el => el.remove());
    isInjected = false;
  }

  function startRealtimeUpdates() {
    if (realtimeInterval) clearInterval(realtimeInterval);
    realtimeInterval = setInterval(() => loadProfileTags(updateWidgetTags), 10000);
  }

  function resetSubmitBtn(btn) {
    btn.disabled = false;
    btn.querySelector('.repid-submit-text').style.display = 'inline';
    btn.querySelector('.repid-submit-loading').style.display = 'none';
  }

  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'repid-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('repid-toast-show'), 10);
    setTimeout(() => toast.remove(), 3000);
  }

  function handleMessage(msg, sender, sendResponse) {
    if (msg.type === 'TAG_CREATED') loadProfileTags(updateWidgetTags);
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function formatAddress(addr) {
    return addr ? `${addr.slice(0,6)}...${addr.slice(-4)}` : '';
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();