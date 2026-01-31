import { useState, useEffect, useCallback } from 'react';
import { auth } from '../api';

export function useWalletAuth() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check for existing session on mount
  useEffect(() => {
    const storedUser = auth.getStoredUser();
    if (storedUser && auth.isLoggedIn()) {
      setUser(storedUser);
      // Verify token is still valid
      auth.getCurrentUser()
        .then(data => {
          setUser(data.user);
        })
        .catch(() => {
          // Token expired, clear storage
          auth.logout();
          setUser(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  // Connect wallet and authenticate
  const connectWallet = useCallback(async (referralCode = null) => {
    setError(null);
    setIsLoading(true);

    try {
      if (typeof window.ethereum === 'undefined') {
        throw new Error('Please install MetaMask');
      }

      // Request accounts
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });
      const walletAddress = accounts[0];

      // Switch to Base network
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x2105' }], // Base mainnet
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x2105',
              chainName: 'Base',
              nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://mainnet.base.org'],
              blockExplorerUrls: ['https://basescan.org']
            }]
          });
        }
      }

      // Get nonce from backend
      const { message } = await auth.getNonce(walletAddress);

      // Sign message with wallet
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, walletAddress],
      });

      // Verify signature with backend
      const data = await auth.verifySignature(walletAddress, signature, referralCode);

      setUser(data.user);
      return data;

    } catch (err) {
      const errorMessage = err.message || 'Failed to connect wallet';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    auth.logout();
    setUser(null);
  }, []);

  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user && auth.isLoggedIn(),
    connectWallet,
    disconnect,
  };
}
