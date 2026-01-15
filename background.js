importScripts('config.js', 'api.js');

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['settings'], (result) => {
    if (!result.settings) {
      chrome.storage.local.set({
        settings: {
          showOverlay: true,
          autoDetect: true,
          defaultNetwork: 'polygon'
        }
      });
    }
  });
  
  chrome.contextMenus.create({
    id: 'repid-tag-profile',
    title: 'Tag with +rep ID',
    contexts: ['page', 'link']
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'INJECT_WALLET_MODAL') {
    const tabId = sender.tab?.id;
    if (tabId) {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['wallet-injector.js'],
        world: 'MAIN'
      }).then(() => {
        sendResponse({ success: true });
      }).catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    } else {
      sendResponse({ success: false, error: 'No tab id' });
    }
    return true;
  }

  if (message.type === 'SAVE_WALLET_CONNECTION') {
    chrome.storage.local.set(message.data, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'CREATE_TAG') {
    repidAPI.createTag(message.tag)
      .then(tag => sendResponse({ success: true, tag }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'SIGN_MESSAGE') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ signature: null, error: 'No tab' });
      return false;
    }
    
    const requestId = 'repid_sign_' + Date.now();
    
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (msg, reqId) => {
        const handleSign = async () => {
          try {
            if (!window.ethereum) {
              window.postMessage({ type: 'REPID_SIGN_RESULT', requestId: reqId, error: 'No wallet found' }, '*');
              return;
            }
            
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (!accounts || !accounts.length) {
              window.postMessage({ type: 'REPID_SIGN_RESULT', requestId: reqId, error: 'Wallet not connected' }, '*');
              return;
            }
            
            const signer = accounts[0];
            const signature = await window.ethereum.request({
              method: 'personal_sign',
              params: [msg, signer]
            });
            
            window.postMessage({ type: 'REPID_SIGN_RESULT', requestId: reqId, signature }, '*');
          } catch (err) {
            const errMsg = err.code === 4001 ? 'Cancelled' : (err.message || 'Sign failed');
            window.postMessage({ type: 'REPID_SIGN_RESULT', requestId: reqId, error: errMsg }, '*');
          }
        };
        handleSign();
      },
      args: [message.message, requestId]
    }).catch(err => {
      sendResponse({ signature: null, error: 'Inject failed' });
    });
    
    const handleResponse = (msg) => {
      if (msg.type === 'REPID_SIGN_RESPONSE' && msg.requestId === requestId) {
        chrome.runtime.onMessage.removeListener(handleResponse);
        if (msg.signature) {
          sendResponse({ signature: msg.signature });
        } else {
          sendResponse({ signature: null, error: msg.error || 'No signature' });
        }
      }
    };
    
    chrome.runtime.onMessage.addListener(handleResponse);
    
    setTimeout(() => {
      chrome.runtime.onMessage.removeListener(handleResponse);
    }, 35000);
    
    return true;
  }

  if (message.type === 'GET_TAGS_FOR_PROFILE') {
    repidAPI.getTagsForProfile(message.platform, message.handle)
      .then(tags => {
        const formattedTags = tags.map(t => ({
          id: t.id,
          type: t.tag_type,
          text: t.text,
          author: t.author_address,
          target: t.target_handle,
          targetPlatform: t.target_platform,
          network: t.network,
          timestamp: new Date(t.created_at).getTime(),
          signature: t.signature,
          verified: !!t.signature
        }));
        sendResponse({ tags: formattedTags });
      })
      .catch(() => sendResponse({ tags: [] }));
    return true;
  }

  if (message.type === 'GET_PROFILE_REPUTATION') {
    repidAPI.getProfile(message.platform, message.handle)
      .then(profile => sendResponse({ profile }))
      .catch(() => sendResponse({ profile: null }));
    return true;
  }

  if (message.type === 'GET_SETTINGS') {
    chrome.storage.local.get(['settings'], (result) => {
      sendResponse({ settings: result.settings || {} });
    });
    return true;
  }

  if (message.type === 'SAVE_SETTINGS') {
    chrome.storage.local.set({ settings: message.settings }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'repid-tag-profile') {
    chrome.tabs.sendMessage(tab.id, { type: 'SHOW_TAG_DIALOG' });
  }
});

function updateBadge(tabId) {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab || !tab.url) return;
    
    const supportedHosts = ['twitter.com', 'x.com', 'github.com', 'linkedin.com', 'youtube.com', 'reddit.com', 'facebook.com'];
    const isSupported = supportedHosts.some(host => tab.url.includes(host));
    
    if (isSupported) {
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#22d3ee' });
      chrome.action.setBadgeText({ tabId, text: '✓' });
    } else {
      chrome.action.setBadgeText({ tabId, text: '' });
    }
  });
}

chrome.tabs.onActivated.addListener((activeInfo) => updateBadge(activeInfo.tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') updateBadge(tabId);
});