// REPID Sign Helper - injected into page context
(function() {
  // Listen for sign requests
  window.addEventListener('REPID_SIGN_REQUEST', async (event) => {
    const { requestId, message, walletType } = event.detail;
    
    console.log('REPID SIGN: Request received', requestId, walletType);
    
    try {
      // Find the correct provider
      let provider = null;
      const providers = window.ethereum?.providers || [];
      
      console.log('REPID SIGN: Available providers:', providers.length);
      
      if (walletType === 'phantom') {
        if (window.phantom?.ethereum) {
          provider = window.phantom.ethereum;
        } else if (providers.length) {
          provider = providers.find(p => p.isPhantom);
        } else if (window.ethereum?.isPhantom) {
          provider = window.ethereum;
        }
      } else if (walletType === 'metamask') {
        if (providers.length) {
          provider = providers.find(p => p.isMetaMask && !p.isPhantom);
        } else if (window.ethereum?.isMetaMask && !window.ethereum?.isPhantom) {
          provider = window.ethereum;
        }
      }
      
      // Fallback to default
      if (!provider) {
        provider = window.ethereum;
      }
      
      if (!provider) {
        console.log('REPID SIGN: No provider found');
        window.dispatchEvent(new CustomEvent('REPID_SIGN_RESPONSE', {
          detail: { requestId, error: 'No wallet found' }
        }));
        return;
      }
      
      console.log('REPID SIGN: Found provider, getting accounts...');
      
      let accounts = await provider.request({ method: 'eth_accounts' });
      console.log('REPID SIGN: accounts:', accounts);
      
      if (!accounts || !accounts.length) {
        console.log('REPID SIGN: No accounts, requesting...');
        try {
          accounts = await provider.request({ method: 'eth_requestAccounts' });
        } catch (e) {
          console.log('REPID SIGN: Request accounts failed:', e);
          window.dispatchEvent(new CustomEvent('REPID_SIGN_RESPONSE', {
            detail: { requestId, error: 'Wallet not connected' }
          }));
          return;
        }
      }
      
      if (!accounts || !accounts.length) {
        window.dispatchEvent(new CustomEvent('REPID_SIGN_RESPONSE', {
          detail: { requestId, error: 'No accounts available' }
        }));
        return;
      }
      
      console.log('REPID SIGN: Requesting signature from', accounts[0]);
      
      const signature = await provider.request({
        method: 'personal_sign',
        params: [message, accounts[0]]
      });
      
      console.log('REPID SIGN: Got signature!');
      window.dispatchEvent(new CustomEvent('REPID_SIGN_RESPONSE', {
        detail: { requestId, signature }
      }));
      
    } catch (err) {
      console.error('REPID SIGN: Error', err);
      const errMsg = err.code === 4001 ? 'Cancelled by user' : (err.message || 'Sign failed');
      window.dispatchEvent(new CustomEvent('REPID_SIGN_RESPONSE', {
        detail: { requestId, error: errMsg }
      }));
    }
  });
  
  console.log('REPID SIGN: Helper ready');
})();
