import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Copy, Share2, Users, ShoppingBag, Gamepad2, Trophy, Zap, Info, X } from 'lucide-react';

// ========== TOOLTIP DATA ==========
const TOOLTIP_DATA = {
  premium: {
    title: 'PREMIUM',
    description: 'Unlock unlimited potential with no restrictions.',
    benefits: ['Unlimited energy - tap forever', 'No cooldown between taps', 'Unlock all levels (no level 3 cap)', 'Permanent unlock']
  },
  battlepass: {
    title: 'BATTLE PASS',
    description: 'The ultimate PyramidMeme experience for 30 days.',
    benefits: ['Permanent X5 boost', '+10% XP bonus', 'Leaderboard access', '+10% XP per verified referral', 'Golden pyramid skin', 'Unlimited energy & no cooldown']
  },
  boostx2: {
    title: 'BOOST X2',
    description: 'Double your brick gains for 24 hours.',
    benefits: ['2X bricks per tap', 'Lasts 24 hours', 'Stackable with other boosts']
  },
  boostx5: {
    title: 'BOOST X5',
    description: 'Massive 5X multiplier for 24 hours.',
    benefits: ['5X bricks per tap', 'Lasts 24 hours', 'Best value for grinding']
  },
  energy: {
    title: 'ENERGY REFILL',
    description: 'Instantly restore your energy.',
    benefits: ['Instant +100 energy', 'Only needed for free users', 'Premium users have unlimited']
  }
};

// ============================================================================
// PYRAMID MEME EMPIRE V5 - COMPLETE SYSTEM
// Arena, Quests, Energy, Tooltips, TBA Rewards
// ============================================================================

const API_URL = 'https://pyramid-meme-empire-production.up.railway.app';

// ========== API HELPERS ==========
const getToken = () => localStorage.getItem('pme_token');
const setToken = (token) => localStorage.setItem('pme_token', token);
const clearToken = () => localStorage.removeItem('pme_token');

const apiCall = async (endpoint, options = {}) => {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'API error');
  return data;
};

const PyramidMemeEmpireV5 = () => {
  // ========== STATE ==========
  const [walletAddress, setWalletAddress] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [bricks, setBricks] = useState(28);
  const [displayBricks, setDisplayBricks] = useState(28);
  const [level, setLevel] = useState(1);
  const [spme, setSpme] = useState(0);
  const [displaySpme, setDisplaySpme] = useState(0);
  const [energy, setEnergy] = useState(72); // Start at 72 for demo
  const [maxEnergy, setMaxEnergy] = useState(100);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [hasBattlePass, setHasBattlePass] = useState(false);
  const [referrals, setReferrals] = useState(3);
  const [currentTab, setCurrentTab] = useState('game');
  const [particles, setParticles] = useState([]);
  const [floatingCoins, setFloatingCoins] = useState([]);
  const [notification, setNotification] = useState(null);
  const [pyramidPulse, setPyramidPulse] = useState(false);
  const [showFireworks, setShowFireworks] = useState(false);
  const [referralLink, setReferralLink] = useState('');
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [showLevelCapModal, setShowLevelCapModal] = useState(false);
  const [isLevelCapped, setIsLevelCapped] = useState(false);
  const MAX_FREE_LEVEL = 3;

  // Boost system
  const [boostMultiplier, setBoostMultiplier] = useState(1);
  const [boostExpiresAt, setBoostExpiresAt] = useState(null);
  const [boostType, setBoostType] = useState(null);
  const [isBoostActive, setIsBoostActive] = useState(false);
  const [boostTimeRemaining, setBoostTimeRemaining] = useState(0);
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [selectedBoost, setSelectedBoost] = useState(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [showEnergyModal, setShowEnergyModal] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showBattlePassModal, setShowBattlePassModal] = useState(false);
  const [isTapping, setIsTapping] = useState(false);
  const tapInFlight = useRef(false);
  const [xpProgress, setXpProgress] = useState({ current: 0, needed: 100, percent: 0 });
  const [referralStats, setReferralStats] = useState({ total: 0, verified: 0, bonusPercent: 0 });
  const [battlePassInfo, setBattlePassInfo] = useState(null);
  const [referralCode, setReferralCode] = useState('');

  // Arena/Leaderboard data
  const [leaderboard, setLeaderboard] = useState([
    { rank: 1, name: 'CryptoKing', taps: 8934, winnings: '23W' },
    { rank: 2, name: 'TapMaster', taps: 7821, winnings: '19W' },
    { rank: 3, name: 'MoaiLord', taps: 7456, winnings: '17W' },
    { rank: 4, name: 'SpeedTapper', taps: 6892, winnings: '14W' },
    { rank: 5, name: 'PyramidPro', taps: 6234, winnings: '12W' },
    { rank: 6, name: 'BrickMaster', taps: 5891, winnings: '11W' },
    { rank: 7, name: 'ClickLord', taps: 5432, winnings: '10W' },
    { rank: 8, name: 'TapGod', taps: 5123, winnings: '9W' },
    { rank: 9, name: 'MoaiKing', taps: 4876, winnings: '8W' },
    { rank: 10, name: 'StackPro', taps: 4567, winnings: '7W' },
  ]);
  const [userRank, setUserRank] = useState(47); // User's current rank
  
  // Quests system
  const [quests, setQuests] = useState([]);
  const [questsLoading, setQuestsLoading] = useState(false);
  const [totalQuestXP, setTotalQuestXP] = useState(0);
  const [completingQuest, setCompletingQuest] = useState(null);
  
  const coinSounds = useRef([]);
  const levelUpSound = useRef(null);
  const whooshSound = useRef(null);
  
  const memecoins = ['doge', 'shib', 'pepe', 'wojak', 'btc', 'eth'];
  
  // ========== FLOATING COINS ==========
  useEffect(() => {
    const initialCoins = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      coin: memecoins[Math.floor(Math.random() * memecoins.length)],
      x: Math.random() * 100,
      y: Math.random() * 100,
      speed: 10 + Math.random() * 15,
      size: 30 + Math.random() * 30,
    }));
    setFloatingCoins(initialCoins);
  }, []);

  useEffect(() => {
    if (activeTooltip) return; // Pause when tooltip is open
    const interval = setInterval(() => {
      setFloatingCoins(coins =>
        coins.map(coin => ({
          ...coin,
          y: coin.y >= 100 ? -10 : coin.y + (coin.speed * 0.05),
        }))
      );
    }, 50);
    return () => clearInterval(interval);
  }, [activeTooltip]);

  // ========== NUMBER COUNTING ==========
  useEffect(() => {
    if (displayBricks !== bricks) {
      const increment = Math.ceil((bricks - displayBricks) / 10);
      const timer = setTimeout(() => {
        setDisplayBricks(prev => Math.min(prev + increment, bricks));
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [bricks, displayBricks]);

  useEffect(() => {
    if (displaySpme !== spme) {
      const increment = Math.ceil((spme - displaySpme) / 10);
      const timer = setTimeout(() => {
        setDisplaySpme(prev => Math.min(prev + increment, spme));
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [spme, displaySpme]);

  useEffect(() => {
    if (walletAddress) {
      const baseUrl = window.location.origin;
      const refCode = walletAddress.slice(2, 12).toUpperCase();
      setReferralLink(`${baseUrl}?ref=${refCode}`);
    }
  }, [walletAddress]);

  // ========== WALLET ==========
  // Get the best available wallet provider
  const getWalletProvider = () => {
    // Check for Phantom FIRST (it also sets isMetaMask = true for compatibility)
    if (window.phantom?.ethereum) {
      return { provider: window.phantom.ethereum, name: 'Phantom' };
    }

    // Check for multiple providers (when user has multiple wallets)
    if (window.ethereum?.providers?.length) {
      // Try to find MetaMask specifically
      const metaMaskProvider = window.ethereum.providers.find(p => p.isMetaMask && !p.isPhantom);
      if (metaMaskProvider) {
        return { provider: metaMaskProvider, name: 'MetaMask' };
      }
      // Or just use the first provider
      return { provider: window.ethereum.providers[0], name: 'Wallet' };
    }

    // Check for MetaMask
    if (window.ethereum?.isMetaMask) {
      return { provider: window.ethereum, name: 'MetaMask' };
    }

    // Fallback to any available ethereum provider
    if (window.ethereum) {
      return { provider: window.ethereum, name: 'Wallet' };
    }

    return null;
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      // Get wallet provider
      const walletInfo = getWalletProvider();

      if (!walletInfo) {
        showNotification('⚠️ INSTALL METAMASK OR PHANTOM');
        return;
      }

      const { provider, name } = walletInfo;
      console.log(`Connecting with ${name}...`);

      // Request accounts with timeout
      let accounts;
      try {
        accounts = await Promise.race([
          provider.request({ method: 'eth_requestAccounts' }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), 30000)
          )
        ]);
      } catch (err) {
        if (err.message === 'TIMEOUT') {
          showNotification(`⏱️ ${name.toUpperCase()} TIMEOUT - TRY AGAIN`);
        } else if (err.code === 4001) {
          showNotification('❌ CONNECTION REJECTED');
        } else if (err.message?.includes('service worker')) {
          showNotification(`🔧 ${name.toUpperCase()} ERROR - RESTART BROWSER`);
        } else {
          showNotification(`❌ ${name.toUpperCase()} ERROR - TRY AGAIN`);
        }
        console.error('Wallet connect error:', err);
        return;
      }

      if (!accounts || accounts.length === 0) {
        showNotification('❌ NO ACCOUNTS FOUND');
        return;
      }

      // Switch to Base network
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x2105' }],
        });
      } catch (switchError) {
        if (switchError.code === 4902 || switchError.message?.includes('Unrecognized chain')) {
          try {
            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x2105',
                chainName: 'Base',
                nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://mainnet.base.org'],
                blockExplorerUrls: ['https://basescan.org']
              }]
            });
          } catch (addError) {
            showNotification('❌ ADD BASE NETWORK IN WALLET');
            console.error('Add chain error:', addError);
            return;
          }
        } else if (switchError.code === 4001) {
          showNotification('❌ NETWORK SWITCH REJECTED');
          return;
        } else {
          // Some wallets don't support network switching - continue anyway
          console.warn('Network switch warning:', switchError);
        }
      }

      const wallet = accounts[0];
      setWalletAddress(wallet);

      // Authenticate with backend
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');

        // Get nonce
        const { message } = await apiCall(`/api/auth/nonce/${wallet}`);

        // Sign message with timeout
        let signature;
        try {
          signature = await Promise.race([
            provider.request({
              method: 'personal_sign',
              params: [message, wallet],
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('SIGN_TIMEOUT')), 60000)
            )
          ]);
        } catch (signError) {
          if (signError.message === 'SIGN_TIMEOUT') {
            showNotification('⏱️ SIGN TIMEOUT - TRY AGAIN');
          } else if (signError.code === 4001) {
            showNotification('❌ SIGNATURE REJECTED');
          } else if (signError.message?.includes('service worker')) {
            showNotification(`🔧 ${name.toUpperCase()} ERROR - RESTART BROWSER`);
          } else {
            showNotification('❌ SIGN FAILED - TRY AGAIN');
          }
          console.error('Sign error:', signError);
          setWalletAddress(null);
          return;
        }

        // Verify and get token
        const authData = await apiCall('/api/auth/verify', {
          method: 'POST',
          body: JSON.stringify({ walletAddress: wallet, signature, referralCode: refCode }),
        });

        setToken(authData.token);
        setIsAuthenticated(true);

        // Load all data from backend
        await loadProgress();
        await loadLeaderboard();

        // Load quests (token is now set)
        try {
          setQuestsLoading(true);
          const questsData = await apiCall('/api/quests');
          setQuests(questsData.quests || []);
          setTotalQuestXP(questsData.totalQuestXP || 0);
          setQuestsLoading(false);
        } catch (questErr) {
          console.error('Load quests error:', questErr);
          setQuestsLoading(false);
        }

        playWhoosh();
        showNotification(`🎉 CONNECTED WITH ${name.toUpperCase()}!`);
      } catch (authError) {
        console.error('Auth error:', authError);
        if (authError.message?.includes('fetch')) {
          showNotification('🌐 NETWORK ERROR - CHECK CONNECTION');
        } else {
          showNotification('⚠️ AUTH FAILED - DEMO MODE');
        }
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      showNotification('❌ CONNECTION FAILED - TRY AGAIN');
    } finally {
      setIsConnecting(false);
    }
  };

  // Load progress from backend
  const loadProgress = async () => {
    try {
      const data = await apiCall('/api/game/progress');
      setBricks(data.bricks || 0);
      setDisplayBricks(data.bricks || 0);
      setLevel(data.level || 1);
      setEnergy(data.energy || 100);
      setMaxEnergy(data.maxEnergy || 100);
      setIsPremium(data.isPremium || false);
      setHasBattlePass(data.hasBattlePass || false);
      setUserRank(data.rank || 0);
      setIsLevelCapped(data.isLevelCapped || false);

      // Load boost info
      setBoostMultiplier(data.boostMultiplier || 1);
      setBoostExpiresAt(data.boostExpiresAt || null);
      setBoostType(data.boostType || null);
      setIsBoostActive(data.isBoostActive || false);

      // Load XP progress
      if (data.xpProgress) {
        setXpProgress(data.xpProgress);
      }

      // Load Battle Pass info
      if (data.battlePassInfo) {
        setBattlePassInfo(data.battlePassInfo);
      }
      if (data.referralStats) {
        setReferralStats(data.referralStats);
      }
    } catch (err) {
      console.error('Load progress error:', err);
    }
  };

  // Load leaderboard from backend
  const loadLeaderboard = async () => {
    try {
      const data = await apiCall('/api/game/leaderboard?limit=10');
      if (data.leaderboard && data.leaderboard.length > 0) {
        setLeaderboard(data.leaderboard.map((p, i) => ({
          rank: i + 1,
          name: p.username || `${p.address.slice(0, 6)}...${p.address.slice(-4)}`,
          taps: p.bricks,
          winnings: `${p.level}L`,
        })));
      }
    } catch (err) {
      console.error('Load leaderboard error:', err);
    }
  };

  // ========== TAP MECHANICS ==========
  const handleTap = async (e) => {
    const now = Date.now();

    // CRITICAL: Prevent concurrent requests - only one tap at a time
    if (tapInFlight.current) {
      return; // Silently ignore spam clicks while processing
    }

    // Check cooldown for free users (client-side pre-check)
    if (!isPremium && !hasBattlePass && (now - lastTapTime) < 2000) {
      showNotification('⏱️ COOLDOWN!');
      return;
    }

    // Check energy for free users (client-side pre-check)
    if (!isPremium && !hasBattlePass && energy <= 0) {
      showNotification('⚡ NO ENERGY! WAIT OR GO PREMIUM');
      return;
    }

    // Send tap to backend if authenticated
    if (isAuthenticated) {
      // Lock to prevent concurrent requests
      tapInFlight.current = true;
      setIsTapping(true);

      try {
        const result = await apiCall('/api/game/tap', { method: 'POST' });
        setBricks(result.bricks);
        setLevel(result.level);
        setEnergy(result.energy);
        setIsPremium(result.isPremium);
        setHasBattlePass(result.hasBattlePass || false);

        // Update boost state
        setBoostMultiplier(result.boostMultiplier || 1);
        setIsBoostActive(result.isBoostActive || false);
        setBoostExpiresAt(result.boostExpiresAt || null);
        setBoostType(result.boostType || null);

        // Update XP progress
        if (result.xpProgress) {
          setXpProgress(result.xpProgress);
        }

        if (result.leveledUp) {
          triggerLevelUp();
        }

        // Update level cap based on backend response AND premium/Battle Pass status
        // If premium or Battle Pass, ALWAYS clear level cap
        if (result.isPremium || result.hasBattlePass) {
          setIsLevelCapped(false);
        } else if (result.isLevelCapped && !isLevelCapped) {
          setIsLevelCapped(true);
          setShowLevelCapModal(true);
        }

        // Update last tap time for client-side cooldown
        setLastTapTime(now);

        // VISUAL EFFECTS for authenticated tap
        setPyramidPulse(true);
        setTimeout(() => setPyramidPulse(false), 300);
        playCoinSound();
        createParticles(e.clientX, e.clientY);
      } catch (err) {
        if (err.message?.includes('cooldown') || err.message?.includes('Wait') || err.message?.includes('Too many')) {
          showNotification('⏱️ COOLDOWN!');
        } else if (err.message?.includes('energy')) {
          showNotification('⚡ NO ENERGY!');
        } else {
          // Log but don't show notification for other errors
          console.error('Tap API error:', err);
        }
      } finally {
        // ALWAYS unlock after request completes
        tapInFlight.current = false;
        setIsTapping(false);
      }
      return; // Don't run local mode
    } else {
      // Local mode (not authenticated)
      setBricks(prev => prev + 1);
      if (!isPremium && !hasBattlePass) {
        setEnergy(prev => Math.max(0, prev - 1));
      }
      const newLevel = Math.min(Math.floor(bricks / 100) + 1, isPremium ? 999 : MAX_FREE_LEVEL);
      if (newLevel > level) {
        if (!isPremium && newLevel >= MAX_FREE_LEVEL) {
          setLevel(MAX_FREE_LEVEL);
          setIsLevelCapped(true);
          setShowLevelCapModal(true);
        } else {
          setLevel(newLevel);
          triggerLevelUp();
        }
      }
    }

    // Add $PME (TBA - hidden amount)
    const pmeGain = Math.floor(Math.random() * 3) + 1;
    setSpme(prev => prev + pmeGain);

    // Energy management for local mode
    if (!isAuthenticated && !isPremium && !hasBattlePass) {
      setLastTapTime(now);
    }

    // Visual effects
    setPyramidPulse(true);
    setTimeout(() => setPyramidPulse(false), 300);

    playCoinSound();
    createParticles(e.clientX, e.clientY);

    // Update quest progress
    if (bricks + 1 >= 100) {
      updateQuest(5, true); // Stack 100 Bricks quest
    }
  };

  // ========== PARTICLES ==========
  const createParticles = (x, y, forLevelUp = false) => {
    const rect = document.getElementById('tap-area')?.getBoundingClientRect();
    if (!rect) return;

    const relX = ((x - rect.left) / rect.width) * 100;
    const relY = ((y - rect.top) / rect.height) * 100;

    const confettiShapes = ['▪', '▫', '●', '◆', '★'];
    const cryptoEmojis = ['💎', '🚀', '⚡', '💰', '🔥'];

    // Premium users get more particles, free users get 1 emoji
    // Level up always gets full celebration
    const showFullParticles = isPremium || hasBattlePass || forLevelUp;

    let newParticles = [];

    if (showFullParticles) {
      // Premium: 3 confetti + 3 emojis
      newParticles = [
        ...Array.from({ length: 3 }, (_, i) => ({
          id: `c-${Date.now()}-${i}`,
          type: 'confetti',
          x: relX,
          y: relY,
          vx: (Math.random() - 0.5) * 3,
          vy: -4 - Math.random() * 2,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 15,
          content: confettiShapes[Math.floor(Math.random() * confettiShapes.length)],
          color: ['#FF00FF', '#00FFFF', '#00FF00', '#FFFF00', '#FFD700'][Math.floor(Math.random() * 5)],
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
          id: `e-${Date.now()}-${i}`,
          type: 'emoji',
          x: relX + (Math.random() - 0.5) * 10,
          y: relY,
          vx: (Math.random() - 0.5) * 2,
          vy: -3 - Math.random() * 2,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 8,
          content: cryptoEmojis[Math.floor(Math.random() * cryptoEmojis.length)],
          color: '#FFFFFF',
        })),
      ];
    } else {
      // Free users: 1 simple emoji only
      newParticles = [{
        id: `e-${Date.now()}-0`,
        type: 'emoji',
        x: relX,
        y: relY,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -2.5 - Math.random(),
        rotation: 0,
        rotationSpeed: 0,
        content: cryptoEmojis[Math.floor(Math.random() * cryptoEmojis.length)],
        color: '#FFFFFF',
      }];
    }

    setParticles(prev => [...prev, ...newParticles]);
    setTimeout(() => {
      setParticles(prev =>
        prev.filter(p => !newParticles.find(np => np.id === p.id))
      );
    }, 3500);
  };

  useEffect(() => {
    if (activeTooltip) return; // Pause when tooltip is open
    const interval = setInterval(() => {
      setParticles(particles =>
        particles.map(p => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.15,
          rotation: p.rotation + p.rotationSpeed,
        }))
      );
    }, 50);
    return () => clearInterval(interval);
  }, [activeTooltip]);

  // ========== LEVEL UP ==========
  const triggerLevelUp = () => {
    playLevelUp();
    showNotification(`🎊 LEVEL ${level + 1}!`);
    setShowFireworks(true);
    setTimeout(() => setShowFireworks(false), 3000);

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    for (let i = 0; i < 5; i++) {
      // Always show full particles for level up (true = forLevelUp)
      setTimeout(() => createParticles(centerX, centerY, true), i * 100);
    }
  };

  // ========== AUDIO ==========
  const playCoinSound = () => {
    try {
      const randomSound = coinSounds.current[Math.floor(Math.random() * coinSounds.current.length)];
      if (randomSound) {
        randomSound.currentTime = 0;
        randomSound.play().catch(() => {});
      }
    } catch (e) {}
  };

  const playLevelUp = () => {
    try {
      if (levelUpSound.current) {
        levelUpSound.current.currentTime = 0;
        levelUpSound.current.play().catch(() => {});
      }
    } catch (e) {}
  };

  const playWhoosh = () => {
    try {
      if (whooshSound.current) {
        whooshSound.current.currentTime = 0;
        whooshSound.current.play().catch(() => {});
      }
    } catch (e) {}
  };

  // ========== ENERGY REGEN ==========
  useEffect(() => {
    if (isPremium || hasBattlePass || activeTooltip) return; // Pause when tooltip is open
    const interval = setInterval(() => {
      setEnergy(prev => Math.min(maxEnergy, prev + 1));
    }, 30000); // 1 energy per 30 seconds
    return () => clearInterval(interval);
  }, [isPremium, hasBattlePass, maxEnergy, activeTooltip]);

  // ========== BOOST COUNTDOWN ==========
  useEffect(() => {
    if (!boostExpiresAt || !isBoostActive) {
      setBoostTimeRemaining(0);
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const expires = new Date(boostExpiresAt);
      const remaining = Math.max(0, Math.floor((expires - now) / 1000));

      if (remaining <= 0) {
        setIsBoostActive(false);
        setBoostMultiplier(1);
        setBoostType(null);
        setBoostExpiresAt(null);
        setBoostTimeRemaining(0);
        showNotification('⚡ Boost expired!');
      } else {
        setBoostTimeRemaining(remaining);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [boostExpiresAt, isBoostActive]);

  // Format boost time remaining
  const formatBoostTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ========== NOTIFICATION ==========
  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 2500);
  };

  // ========== QUESTS ==========
  // Load quests from API
  const loadQuests = async () => {
    const token = getToken();
    if (!token) {
      console.log('No token, skipping quest load');
      return;
    }

    setQuestsLoading(true);
    try {
      console.log('Loading quests...');
      const data = await apiCall('/api/quests');
      console.log('Quests loaded:', data);
      setQuests(data.quests || []);
      setTotalQuestXP(data.totalQuestXP || 0);
    } catch (err) {
      console.error('Load quests error:', err);
      // Keep empty quests on error
    } finally {
      setQuestsLoading(false);
    }
  };

  // Load quests when authenticated changes
  useEffect(() => {
    if (isAuthenticated) {
      console.log('isAuthenticated changed to true, loading quests');
      loadQuests();
    }
  }, [isAuthenticated]);

  // Complete a quest
  const completeQuest = async (questId) => {
    if (!isAuthenticated) {
      showNotification('⚠️ Connect wallet first!');
      return;
    }

    setCompletingQuest(questId);
    try {
      const result = await apiCall('/api/quests/complete', {
        method: 'POST',
        body: JSON.stringify({ questId })
      });

      if (result.success) {
        // Update local state
        setQuests(prev => prev.map(q =>
          q.quest_id === questId ? { ...q, isCompleted: true } : q
        ));
        setTotalQuestXP(result.totalQuestXP);
        showNotification(`🎉 +${result.xpEarned} XP!`);
        playWhoosh();

        // Reload quests to get fresh data
        await loadQuests();
      }
    } catch (err) {
      console.error('Complete quest error:', err);
      if (err.message?.includes('already')) {
        showNotification('✅ Already completed!');
      } else if (err.message?.includes('Requirements')) {
        showNotification('❌ Requirements not met!');
      } else {
        showNotification('❌ Failed to complete quest');
      }
    } finally {
      setCompletingQuest(null);
    }
  };

  // Handle quest click - open external URL or complete
  const handleQuestClick = async (quest) => {
    if (quest.isCompleted) return;

    // For social/partner quests, open URL first
    if (quest.external_url && (quest.type === 'social' || quest.type === 'partner_api')) {
      window.open(quest.external_url, '_blank');
    }

    // For milestone/referral quests, check if completable
    if (quest.verification_method === 'internal') {
      if (!quest.canComplete) {
        showNotification(`📊 ${quest.progressText}`);
        return;
      }
    }
  };

  // Verify and complete a quest (called by VERIFY button)
  const verifyQuest = async (quest) => {
    if (quest.isCompleted) return;

    // For internal verification, check requirements first
    if (quest.verification_method === 'internal' && !quest.canComplete) {
      showNotification(`📊 Progress: ${quest.progressText}`);
      return;
    }

    await completeQuest(quest.quest_id);
  };

  // ========== BOOST PURCHASE ==========
  const handleBoostPurchase = async (boostId) => {
    if (!isAuthenticated) {
      showNotification('⚠️ Connect wallet first!');
      return;
    }

    // Check if trying to downgrade (X2 when X5 is active)
    const requestedMultiplier = boostId === 'boost_5x' ? 5 : 2;
    if (isBoostActive && requestedMultiplier < boostMultiplier) {
      showNotification(`⚠️ Cannot downgrade: You have X${boostMultiplier} active!`);
      return;
    }

    setIsPurchasing(true);
    try {
      const result = await apiCall('/api/shop/activate', {
        method: 'POST',
        body: JSON.stringify({ itemId: boostId })
      });

      if (result.success && result.boost) {
        setBoostMultiplier(result.boost.multiplier);
        setBoostExpiresAt(result.boost.expiresAt);
        setBoostType(result.boost.type);
        setIsBoostActive(true);
        setShowBoostModal(false);

        // Show appropriate message for upgrade vs new activation
        if (result.upgraded) {
          showNotification(`🎉 Boost upgraded! X${result.from} → X${result.to}`);
        } else {
          showNotification(`🔥 ${result.boost.multiplier}X BOOST ACTIVATED!`);
        }
        playWhoosh();
      } else {
        showNotification(result.message || '✅ Activated!');
        setShowBoostModal(false);
      }
    } catch (err) {
      console.error('Purchase error:', err);
      // Show backend error message if available
      const errorMsg = err.message || 'Purchase failed';
      showNotification(`❌ ${errorMsg}`);
    } finally {
      setIsPurchasing(false);
    }
  };

  const openBoostModal = (boostId) => {
    setSelectedBoost(boostId);
    setShowBoostModal(true);
  };

  // ========== ENERGY REFILL PURCHASE ==========
  const handleEnergyPurchase = async () => {
    if (!isAuthenticated) {
      showNotification('⚠️ Connect wallet first!');
      return;
    }

    if (isPremium || hasBattlePass) {
      showNotification(hasBattlePass ? '🏆 Battle Pass users have unlimited energy!' : '👑 Premium users have unlimited energy!');
      setShowEnergyModal(false);
      return;
    }

    setIsPurchasing(true);
    try {
      const result = await apiCall('/api/shop/activate', {
        method: 'POST',
        body: JSON.stringify({ itemId: 'energy_refill' })
      });

      if (result.success) {
        setEnergy(result.energy || 100);
        setShowEnergyModal(false);
        showNotification('⚡ +100 Energy!');
        playWhoosh();
      }
    } catch (err) {
      console.error('Energy purchase error:', err);
      const errorMsg = err.message || 'Purchase failed';
      showNotification(`❌ ${errorMsg}`);
    } finally {
      setIsPurchasing(false);
    }
  };

  // ========== PREMIUM PURCHASE ==========
  const handlePremiumPurchase = async () => {
    if (!isAuthenticated) {
      showNotification('⚠️ Connect wallet first!');
      return;
    }

    if (isPremium) {
      showNotification('👑 You already have Premium!');
      setShowPremiumModal(false);
      return;
    }

    setIsPurchasing(true);
    try {
      const result = await apiCall('/api/shop/activate', {
        method: 'POST',
        body: JSON.stringify({ itemId: 'premium' })
      });

      if (result.success && result.isPremium) {
        setIsPremium(true);
        setIsLevelCapped(false); // CRITICAL: Remove level cap when premium
        setShowPremiumModal(false);
        showNotification('👑 Premium Activated! Unlimited Power!');
        playWhoosh();
      }
    } catch (err) {
      console.error('Premium purchase error:', err);
      const errorMsg = err.message || 'Purchase failed';
      showNotification(`❌ ${errorMsg}`);
    } finally {
      setIsPurchasing(false);
    }
  };

  // ========== BATTLE PASS PURCHASE ==========
  const handleBattlePassPurchase = async () => {
    if (!isAuthenticated) {
      showNotification('⚠️ Connect wallet first!');
      return;
    }

    if (hasBattlePass) {
      showNotification('🏆 You already have Battle Pass!');
      setShowBattlePassModal(false);
      return;
    }

    setIsPurchasing(true);
    try {
      const result = await apiCall('/api/shop/activate', {
        method: 'POST',
        body: JSON.stringify({ itemId: 'battle_pass' })
      });

      if (result.success && result.hasBattlePass) {
        setHasBattlePass(true);
        setIsLevelCapped(false);
        setBoostMultiplier(5); // Battle Pass gives X5 boost
        setIsBoostActive(true);
        setBoostType('battle_pass');
        setBattlePassInfo({ expiresAt: result.expiresAt });
        if (result.referralCode) {
          setReferralCode(result.referralCode);
        }
        setShowBattlePassModal(false);
        showNotification('🏆 BATTLE PASS ACTIVATED!');
        playWhoosh();

        // Trigger celebration
        setShowFireworks(true);
        setTimeout(() => setShowFireworks(false), 3000);
      }
    } catch (err) {
      console.error('Battle Pass purchase error:', err);
      const errorMsg = err.message || 'Purchase failed';
      showNotification(`❌ ${errorMsg}`);
    } finally {
      setIsPurchasing(false);
    }
  };

  // Load referral stats
  const loadReferralStats = async () => {
    if (!isAuthenticated) return;
    try {
      const data = await apiCall('/api/referrals/stats');
      setReferralStats({
        total: data.total || 0,
        verified: data.verified || 0,
        bonusPercent: data.bonusPercent || 0
      });
      if (data.referralCode) {
        setReferralCode(data.referralCode);
        const baseUrl = process.env.REACT_APP_FRONTEND_URL || window.location.origin;
        setReferralLink(`${baseUrl}?ref=${data.referralCode}`);
      }
    } catch (err) {
      console.error('Load referral stats error:', err);
    }
  };

  // Load referral stats when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadReferralStats();
    }
  }, [isAuthenticated]);

  // ========== SHARE ==========
  const shareOnTwitter = () => {
    const text = encodeURIComponent(`Building my 🗿 PyramidMeme Empire! Join me for eternal boosts 🚀`);
    const url = encodeURIComponent(referralLink);
    window.open(`https://x.com/intent/tweet?text=${text}%20${url}`, '_blank');
    playWhoosh();
  };

  const shareOnTelegram = () => {
    const text = encodeURIComponent(`Building my 🗿 PyramidMeme Empire! Join me for eternal boosts 🚀`);
    const url = encodeURIComponent(referralLink);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
    playWhoosh();
  };

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    showNotification('📋 COPIED!');
    playWhoosh();
  };

  // ========== TOOLTIP HANDLERS ==========
  const openTooltip = useCallback((tooltipId, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setActiveTooltip(tooltipId);
  }, []);

  const closeTooltip = useCallback((e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setActiveTooltip(null);
  }, []);

  // ========== PYRAMID ==========
  const renderPyramid = () => {
    const rows = Math.min(Math.floor(bricks / 6) + 1, 5);
    let moais = [];
    
    for (let row = 0; row < rows; row++) {
      const moaisInRow = row + 1;
      for (let col = 0; col < moaisInRow; col++) {
        moais.push(
          <div 
            key={`${row}-${col}`}
            className="pyramid-moai"
            style={{
              gridRow: row + 1,
              gridColumn: `${5 - row + col * 2} / span 2`,
              animation: `pop-in 0.4s ease-out ${row * 0.1 + col * 0.05}s backwards`,
            }}
          >
            🗿
          </div>
        );
      }
    }
    
    return moais;
  };

  // ========== RENDER ==========
  return (
    <div className="app-wrapper">
      
      {/* Audio */}
      <audio ref={el => coinSounds.current[0] = el} src="/sounds/coin-1.wav" preload="auto" />
      <audio ref={el => coinSounds.current[1] = el} src="/sounds/coin-2.wav" preload="auto" />
      <audio ref={el => coinSounds.current[2] = el} src="/sounds/coin-3.wav" preload="auto" />
      <audio ref={levelUpSound} src="/sounds/levelup.wav" preload="auto" />
      <audio ref={whooshSound} src="/sounds/whoosh.wav" preload="auto" />

      {/* Background */}
      <div className="floating-coins-bg">
        {floatingCoins.map(coin => (
          <img
            key={coin.id}
            src={`/coins/${coin.coin}.png`}
            alt={coin.coin}
            className="floating-coin"
            style={{
              left: `${coin.x}%`,
              top: `${coin.y}%`,
              width: `${coin.size}px`,
              height: `${coin.size}px`,
            }}
          />
        ))}
      </div>

      {/* Mobile Container */}
      <div className="mobile-container">
        
        {/* Particles */}
        {particles.map(particle => (
          <div
            key={particle.id}
            className={`particle particle-${particle.type}`}
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              transform: `rotate(${particle.rotation}deg)`,
              color: particle.color,
            }}
          >
            {particle.content}
          </div>
        ))}

        {/* Fireworks */}
        {showFireworks && (
          <div className="fireworks">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="firework" style={{ '--i': i }} />
            ))}
          </div>
        )}

        {/* Notification */}
        {notification && (
          <div className="notification">{notification}</div>
        )}

        {/* Simple Modal Tooltip */}
        {activeTooltip && TOOLTIP_DATA[activeTooltip] && (
          <div
            className="tooltip-backdrop-fixed"
            onMouseDown={closeTooltip}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.9)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#1a1a2e',
                border: '2px solid #FF00FF',
                borderRadius: 16,
                padding: 24,
                maxWidth: 320,
                width: '100%',
                position: 'relative',
                boxShadow: '0 0 30px rgba(255,0,255,0.5)',
              }}>
              <button
                onMouseDown={closeTooltip}
                onClick={closeTooltip}
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  background: '#FF00FF',
                  border: 'none',
                  borderRadius: '50%',
                  width: 36,
                  height: 36,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#000',
                  fontWeight: 'bold',
                  fontSize: 18,
                }}
              >
                ✕
              </button>
              <h3 style={{
                color: '#FF00FF',
                fontSize: 14,
                marginBottom: 12,
                fontFamily: 'inherit',
              }}>{TOOLTIP_DATA[activeTooltip].title}</h3>
              <p style={{
                color: '#aaa',
                fontSize: 10,
                marginBottom: 16,
                lineHeight: 1.5,
                fontFamily: 'inherit',
              }}>{TOOLTIP_DATA[activeTooltip].description}</p>
              <div style={{
                background: 'rgba(0,255,0,0.1)',
                border: '1px solid rgba(0,255,0,0.3)',
                borderRadius: 8,
                padding: 12,
              }}>
                <div style={{ color: '#0f0', fontSize: 10, marginBottom: 8, fontFamily: 'inherit' }}>Benefits:</div>
                {TOOLTIP_DATA[activeTooltip].benefits.map((b, i) => (
                  <div key={i} style={{ color: '#0f0', fontSize: 9, marginBottom: 4, fontFamily: 'inherit' }}>• {b}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Level Cap Modal - Premium Upsell */}
        {showLevelCapModal && (
          <div
            className="level-cap-backdrop"
            onMouseDown={() => setShowLevelCapModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.95)',
              zIndex: 10001,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'linear-gradient(135deg, #1a1a2e, #2d1f3d)',
                border: '3px solid #FFD700',
                borderRadius: 20,
                padding: 28,
                maxWidth: 340,
                width: '100%',
                position: 'relative',
                boxShadow: '0 0 50px rgba(255,215,0,0.4)',
                textAlign: 'center',
              }}>
              <button
                onMouseDown={() => setShowLevelCapModal(false)}
                onClick={() => setShowLevelCapModal(false)}
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 16,
                }}
              >
                ✕
              </button>

              <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>

              <h3 style={{
                color: '#FFD700',
                fontSize: 16,
                marginBottom: 12,
                fontFamily: 'inherit',
                textShadow: '0 0 10px rgba(255,215,0,0.5)',
              }}>LEVEL 3 REACHED!</h3>

              <p style={{
                color: '#aaa',
                fontSize: 10,
                marginBottom: 20,
                lineHeight: 1.6,
                fontFamily: 'inherit',
              }}>
                Free users are limited to Level 3.<br/>
                Upgrade to Premium to unlock unlimited levels!
              </p>

              <div style={{
                background: 'rgba(255,215,0,0.1)',
                border: '2px solid rgba(255,215,0,0.3)',
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
              }}>
                <div style={{ color: '#FFD700', fontSize: 11, marginBottom: 10, fontFamily: 'inherit' }}>Premium Benefits:</div>
                <div style={{ color: '#0f0', fontSize: 9, marginBottom: 6, fontFamily: 'inherit' }}>✓ Unlimited Levels</div>
                <div style={{ color: '#0f0', fontSize: 9, marginBottom: 6, fontFamily: 'inherit' }}>✓ Infinite Energy</div>
                <div style={{ color: '#0f0', fontSize: 9, marginBottom: 6, fontFamily: 'inherit' }}>✓ No Tap Cooldown</div>
                <div style={{ color: '#0f0', fontSize: 9, fontFamily: 'inherit' }}>✓ Permanent Access</div>
              </div>

              <button
                onClick={() => {
                  setShowLevelCapModal(false);
                  setCurrentTab('shop');
                }}
                style={{
                  width: '100%',
                  padding: 16,
                  background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                  border: 'none',
                  borderRadius: 12,
                  fontFamily: 'inherit',
                  fontSize: 14,
                  color: '#000',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 0 30px rgba(255,215,0,0.5)',
                }}
              >
                GET PREMIUM - $2
              </button>

              <div style={{
                marginTop: 12,
                fontSize: 8,
                color: '#666',
                fontFamily: 'inherit',
              }}>
                One-time payment • Forever access
              </div>
            </div>
          </div>
        )}

        {/* Boost Purchase Confirmation Modal */}
        {showBoostModal && selectedBoost && (
          <div
            className="boost-modal-backdrop"
            onMouseDown={() => !isPurchasing && setShowBoostModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.95)',
              zIndex: 10001,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: selectedBoost === 'boost_5x'
                  ? 'linear-gradient(135deg, #1a1a2e, #3d1f1f)'
                  : 'linear-gradient(135deg, #1a1a2e, #3d2f1f)',
                border: `3px solid ${selectedBoost === 'boost_5x' ? '#FF3333' : '#FFA500'}`,
                borderRadius: 20,
                padding: 28,
                maxWidth: 340,
                width: '100%',
                position: 'relative',
                boxShadow: `0 0 50px ${selectedBoost === 'boost_5x' ? 'rgba(255,50,50,0.4)' : 'rgba(255,165,0,0.4)'}`,
                textAlign: 'center',
              }}>
              {!isPurchasing && (
                <button
                  onMouseDown={() => setShowBoostModal(false)}
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 16,
                  }}
                >
                  ✕
                </button>
              )}

              <div style={{ fontSize: 48, marginBottom: 16 }}>
                {selectedBoost === 'boost_5x' ? '🔥' : '⚡'}
              </div>

              <h3 style={{
                color: selectedBoost === 'boost_5x' ? '#FF3333' : '#FFA500',
                fontSize: 18,
                marginBottom: 8,
                fontFamily: 'inherit',
                textShadow: `0 0 10px ${selectedBoost === 'boost_5x' ? 'rgba(255,50,50,0.5)' : 'rgba(255,165,0,0.5)'}`,
              }}>
                BOOST {selectedBoost === 'boost_5x' ? 'X5' : 'X2'}
              </h3>

              <p style={{
                color: '#aaa',
                fontSize: 11,
                marginBottom: 20,
                lineHeight: 1.6,
                fontFamily: 'inherit',
              }}>
                {selectedBoost === 'boost_5x'
                  ? 'Multiply your bricks by 5X for 24 hours!'
                  : 'Double your bricks for 24 hours!'}
              </p>

              <div style={{
                background: 'rgba(0,255,0,0.1)',
                border: '2px solid rgba(0,255,0,0.3)',
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
              }}>
                <div style={{ color: '#0f0', fontSize: 9, marginBottom: 8, fontFamily: 'inherit' }}>
                  {selectedBoost === 'boost_5x' ? '+5 bricks per tap' : '+2 bricks per tap'}
                </div>
                <div style={{ color: '#888', fontSize: 8, fontFamily: 'inherit' }}>
                  Duration: 24 hours
                </div>
              </div>

              <div style={{
                fontSize: 28,
                color: '#0f0',
                marginBottom: 16,
                textShadow: '0 0 15px rgba(0,255,0,0.5)',
              }}>
                ${selectedBoost === 'boost_5x' ? '1.50' : '0.50'}
              </div>

              <button
                onClick={() => handleBoostPurchase(selectedBoost)}
                disabled={isPurchasing}
                style={{
                  width: '100%',
                  padding: 16,
                  background: isPurchasing
                    ? '#666'
                    : selectedBoost === 'boost_5x'
                      ? 'linear-gradient(135deg, #FF3333, #FF6600)'
                      : 'linear-gradient(135deg, #FFA500, #FFD700)',
                  border: 'none',
                  borderRadius: 12,
                  fontFamily: 'inherit',
                  fontSize: 14,
                  color: isPurchasing ? '#999' : '#000',
                  fontWeight: 'bold',
                  cursor: isPurchasing ? 'not-allowed' : 'pointer',
                  boxShadow: isPurchasing ? 'none' : `0 0 30px ${selectedBoost === 'boost_5x' ? 'rgba(255,50,50,0.5)' : 'rgba(255,165,0,0.5)'}`,
                }}
              >
                {isPurchasing ? 'ACTIVATING...' : 'ACTIVATE BOOST (DEMO)'}
              </button>

              <div style={{
                marginTop: 12,
                fontSize: 8,
                color: '#666',
                fontFamily: 'inherit',
              }}>
                Demo mode • No real payment required
              </div>
            </div>
          </div>
        )}

        {/* Energy Refill Modal */}
        {showEnergyModal && (
          <div
            className="boost-modal-backdrop"
            onMouseDown={() => !isPurchasing && setShowEnergyModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
              padding: 20,
            }}>
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'linear-gradient(135deg, #1a1a2e, #1f3d1f)',
                border: '3px solid #00FF00',
                borderRadius: 20,
                padding: 28,
                maxWidth: 340,
                width: '100%',
                position: 'relative',
                boxShadow: '0 0 50px rgba(0,255,0,0.4)',
                textAlign: 'center',
              }}>
              {!isPurchasing && (
                <button
                  onMouseDown={() => setShowEnergyModal(false)}
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: '#888',
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  ✕
                </button>
              )}

              <div style={{ fontSize: 48, marginBottom: 16 }}>🔋</div>

              <h3 style={{
                color: '#00FF00',
                fontSize: 18,
                marginBottom: 8,
                fontFamily: 'inherit',
                textShadow: '0 0 10px rgba(0,255,0,0.5)',
              }}>
                ENERGY REFILL
              </h3>

              <p style={{
                color: '#aaa',
                fontSize: 11,
                marginBottom: 20,
                lineHeight: 1.6,
                fontFamily: 'inherit',
              }}>
                Instantly refill your energy to 100!
              </p>

              <div style={{
                background: 'rgba(0,255,0,0.1)',
                border: '2px solid rgba(0,255,0,0.3)',
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
              }}>
                <div style={{ color: '#0f0', fontSize: 9, marginBottom: 8, fontFamily: 'inherit' }}>
                  +100 energy instantly
                </div>
                <div style={{ color: '#888', fontSize: 8, fontFamily: 'inherit' }}>
                  Current: {energy}/100
                </div>
              </div>

              <div style={{
                fontSize: 28,
                color: '#0f0',
                marginBottom: 16,
                textShadow: '0 0 15px rgba(0,255,0,0.5)',
              }}>
                $0.25
              </div>

              <button
                onClick={handleEnergyPurchase}
                disabled={isPurchasing}
                style={{
                  width: '100%',
                  padding: 16,
                  background: isPurchasing
                    ? '#666'
                    : 'linear-gradient(135deg, #00FF00, #00CC00)',
                  border: 'none',
                  borderRadius: 12,
                  fontFamily: 'inherit',
                  fontSize: 14,
                  color: isPurchasing ? '#999' : '#000',
                  fontWeight: 'bold',
                  cursor: isPurchasing ? 'not-allowed' : 'pointer',
                  boxShadow: isPurchasing ? 'none' : '0 0 30px rgba(0,255,0,0.5)',
                }}
              >
                {isPurchasing ? 'REFILLING...' : 'REFILL ENERGY (DEMO)'}
              </button>

              <div style={{
                marginTop: 12,
                fontSize: 8,
                color: '#666',
                fontFamily: 'inherit',
              }}>
                Demo mode • No real payment required
              </div>
            </div>
          </div>
        )}

        {/* Premium Modal */}
        {showPremiumModal && (
          <div
            className="boost-modal-backdrop"
            onMouseDown={() => !isPurchasing && setShowPremiumModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
              padding: 20,
            }}>
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'linear-gradient(135deg, #1a1a2e, #3d3d1f)',
                border: '3px solid #FFD700',
                borderRadius: 20,
                padding: 28,
                maxWidth: 340,
                width: '100%',
                position: 'relative',
                boxShadow: '0 0 50px rgba(255,215,0,0.4)',
                textAlign: 'center',
              }}>
              {!isPurchasing && (
                <button
                  onMouseDown={() => setShowPremiumModal(false)}
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: '#888',
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  ✕
                </button>
              )}

              <div style={{ fontSize: 48, marginBottom: 16 }}>👑</div>

              <h3 style={{
                color: '#FFD700',
                fontSize: 18,
                marginBottom: 8,
                fontFamily: 'inherit',
                textShadow: '0 0 10px rgba(255,215,0,0.5)',
              }}>
                PREMIUM FOREVER
              </h3>

              <p style={{
                color: '#aaa',
                fontSize: 11,
                marginBottom: 20,
                lineHeight: 1.6,
                fontFamily: 'inherit',
              }}>
                Unlock unlimited power permanently!
              </p>

              <div style={{
                background: 'rgba(255,215,0,0.1)',
                border: '2px solid rgba(255,215,0,0.3)',
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
              }}>
                <div style={{ color: '#FFD700', fontSize: 9, marginBottom: 4, fontFamily: 'inherit' }}>
                  ✓ Unlimited energy
                </div>
                <div style={{ color: '#FFD700', fontSize: 9, marginBottom: 4, fontFamily: 'inherit' }}>
                  ✓ No tap cooldown
                </div>
                <div style={{ color: '#FFD700', fontSize: 9, marginBottom: 4, fontFamily: 'inherit' }}>
                  ✓ Unlock Level 4+
                </div>
                <div style={{ color: '#FFD700', fontSize: 9, fontFamily: 'inherit' }}>
                  ✓ Forever (one-time purchase)
                </div>
              </div>

              <div style={{
                fontSize: 28,
                color: '#FFD700',
                marginBottom: 16,
                textShadow: '0 0 15px rgba(255,215,0,0.5)',
              }}>
                $2.00
              </div>

              <button
                onClick={handlePremiumPurchase}
                disabled={isPurchasing}
                style={{
                  width: '100%',
                  padding: 16,
                  background: isPurchasing
                    ? '#666'
                    : 'linear-gradient(135deg, #FFD700, #FFA500)',
                  border: 'none',
                  borderRadius: 12,
                  fontFamily: 'inherit',
                  fontSize: 14,
                  color: isPurchasing ? '#999' : '#000',
                  fontWeight: 'bold',
                  cursor: isPurchasing ? 'not-allowed' : 'pointer',
                  boxShadow: isPurchasing ? 'none' : '0 0 30px rgba(255,215,0,0.5)',
                }}
              >
                {isPurchasing ? 'ACTIVATING...' : 'ACTIVATE PREMIUM (DEMO)'}
              </button>

              <div style={{
                marginTop: 12,
                fontSize: 8,
                color: '#666',
                fontFamily: 'inherit',
              }}>
                Demo mode • No real payment required
              </div>
            </div>
          </div>
        )}

        {/* Battle Pass Purchase Modal */}
        {showBattlePassModal && (
          <div
            className="boost-modal-backdrop"
            onMouseDown={() => !isPurchasing && setShowBattlePassModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.95)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
              padding: 20,
            }}>
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'linear-gradient(135deg, #1a1a2e, #2d1f3d)',
                border: '3px solid #FF00FF',
                borderRadius: 20,
                padding: 28,
                maxWidth: 360,
                width: '100%',
                position: 'relative',
                boxShadow: '0 0 60px rgba(255,0,255,0.5)',
                textAlign: 'center',
              }}>
              {!isPurchasing && (
                <button
                  onMouseDown={() => setShowBattlePassModal(false)}
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: '#888',
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  ✕
                </button>
              )}

              <div style={{ fontSize: 56, marginBottom: 12 }}>🏆</div>

              <h3 style={{
                color: '#FF00FF',
                fontSize: 20,
                marginBottom: 8,
                fontFamily: 'inherit',
                textShadow: '0 0 15px rgba(255,0,255,0.7)',
              }}>
                BATTLE PASS
              </h3>

              <p style={{
                color: '#00FFFF',
                fontSize: 10,
                marginBottom: 16,
                fontFamily: 'inherit',
              }}>
                SEASON 1 • 30 DAYS OF POWER
              </p>

              <div style={{
                background: 'rgba(255,0,255,0.1)',
                border: '2px solid rgba(255,0,255,0.4)',
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
                textAlign: 'left',
              }}>
                <div style={{ color: '#0f0', fontSize: 10, marginBottom: 8, fontFamily: 'inherit' }}>
                  ⚡ Permanent X5 Boost
                </div>
                <div style={{ color: '#0f0', fontSize: 10, marginBottom: 8, fontFamily: 'inherit' }}>
                  📈 +10% XP Bonus
                </div>
                <div style={{ color: '#0f0', fontSize: 10, marginBottom: 8, fontFamily: 'inherit' }}>
                  🏆 Leaderboard Access
                </div>
                <div style={{ color: '#0f0', fontSize: 10, marginBottom: 8, fontFamily: 'inherit' }}>
                  👥 +10% XP per Verified Referral
                </div>
                <div style={{ color: '#FFD700', fontSize: 10, marginBottom: 8, fontFamily: 'inherit' }}>
                  🗿 Golden Pyramid Skin
                </div>
                <div style={{ color: '#0f0', fontSize: 10, marginBottom: 8, fontFamily: 'inherit' }}>
                  ♾️ Unlimited Energy
                </div>
                <div style={{ color: '#0f0', fontSize: 10, fontFamily: 'inherit' }}>
                  ⏱️ No Tap Cooldown
                </div>
              </div>

              <div style={{
                fontSize: 32,
                color: '#FF00FF',
                marginBottom: 16,
                textShadow: '0 0 20px rgba(255,0,255,0.6)',
              }}>
                $5.00
              </div>

              <button
                onClick={handleBattlePassPurchase}
                disabled={isPurchasing}
                style={{
                  width: '100%',
                  padding: 18,
                  background: isPurchasing
                    ? '#666'
                    : 'linear-gradient(135deg, #FF00FF, #8B00FF)',
                  border: 'none',
                  borderRadius: 12,
                  fontFamily: 'inherit',
                  fontSize: 14,
                  color: '#fff',
                  fontWeight: 'bold',
                  cursor: isPurchasing ? 'not-allowed' : 'pointer',
                  boxShadow: isPurchasing ? 'none' : '0 0 40px rgba(255,0,255,0.6)',
                }}
              >
                {isPurchasing ? 'ACTIVATING...' : 'GET BATTLE PASS (DEMO)'}
              </button>

              <div style={{
                marginTop: 14,
                fontSize: 8,
                color: '#666',
                fontFamily: 'inherit',
              }}>
                Demo mode • No real payment required
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <header className="header">
          <div className="logo">PYRAMIDMEME</div>
          {walletAddress ? (
            <div className="wallet-badge">
              {walletAddress.slice(0, 4)}...{walletAddress.slice(-3)}
            </div>
          ) : (
            <button onClick={connectWallet} disabled={isConnecting} className="connect-btn-small">
              {isConnecting ? 'CONNECTING...' : 'CONNECT'}
            </button>
          )}
        </header>

        {/* Main Content */}
        <main className="main-content">
          
          {/* GAME TAB */}
          {currentTab === 'game' && (
            <div className="game-view">
              
              {/* Stats */}
              <div className="stats-simple">
                <div className="stat-box">
                  <div className="stat-emoji">💎</div>
                  <div className="stat-label">BRICKS</div>
                  <div className="stat-value neon-green">{displayBricks}</div>
                </div>
                
                <div className="stat-box">
                  <div className="stat-emoji">🏆</div>
                  <div className="stat-label">LEVEL</div>
                  <div className="stat-value neon-yellow">{level}</div>
                </div>
                
                <div className="stat-box">
                  <div className="stat-emoji">💰</div>
                  <div className="stat-label">$PME</div>
                  <div className="stat-value neon-purple">TBA</div>
                </div>
                
                <div className="stat-box">
                  <div className="stat-emoji">👥</div>
                  <div className="stat-label">REFERRALS</div>
                  <div className="stat-value neon-cyan">{referrals}</div>
                </div>
              </div>

              {/* Battle Pass Banner - Always show if has BP */}
              {hasBattlePass && (
                <div className="boost-indicator boost-battlepass">
                  <div className="boost-info">
                    <span className="boost-icon">🏆</span>
                    <span className="boost-label">BATTLE PASS ACTIVE</span>
                  </div>
                  <div className="boost-timer bp-timer">
                    {battlePassInfo?.daysRemaining ? `${battlePassInfo.daysRemaining}d remaining` : '30 days'}
                  </div>
                </div>
              )}

              {/* Temporary Boost Indicator - Only show if NOT from Battle Pass */}
              {isBoostActive && boostType !== 'battle_pass' && !hasBattlePass && (
                <div className={`boost-indicator ${boostType === 'x5' ? 'boost-x5' : 'boost-x2'}`}>
                  <div className="boost-info">
                    <span className="boost-icon">{boostType === 'x5' ? '🔥' : '⚡'}</span>
                    <span className="boost-label">BOOST {boostType?.toUpperCase()} ACTIVE</span>
                  </div>
                  <div className="boost-timer">{formatBoostTime(boostTimeRemaining)}</div>
                </div>
              )}

              {/* Energy Bar (only show for free users) */}
              {!isPremium && !hasBattlePass && (
                <div className="energy-bar-container">
                  <div className="energy-info">
                    <div className="energy-label">
                      <Zap size={14} className="energy-icon" />
                      ENERGY
                    </div>
                    <div className="energy-value">{energy}/{maxEnergy}</div>
                  </div>
                  <div className="energy-bar">
                    <div
                      className="energy-fill"
                      style={{ width: `${(energy / maxEnergy) * 100}%` }}
                    />
                  </div>
                  <div className="energy-hint">+1 every 30s or go Premium!</div>
                </div>
              )}

              {/* TAP AREA */}
              <div
                id="tap-area"
                className="tap-area-full"
                onClick={handleTap}
              >
                <div className={`pyramid-container ${pyramidPulse ? 'pyramid-pulse' : ''} ${hasBattlePass ? 'pyramid-golden' : ''}`}>
                  <div className="pyramid-grid">
                    {renderPyramid()}
                  </div>
                  {hasBattlePass && <div className="golden-glow" />}
                </div>

                <div className={`level-badge ${isLevelCapped && !isPremium && !hasBattlePass ? 'level-capped' : ''} ${isPremium ? 'level-premium' : ''} ${hasBattlePass ? 'level-battlepass' : ''}`}>
                  {hasBattlePass && <span className="bp-badge-small">🏆</span>}
                  Level {level} {isPremium && !hasBattlePass && '👑'} {isLevelCapped && !isPremium && !hasBattlePass && '🔒'}
                </div>

                {isLevelCapped && !isPremium && !hasBattlePass && (
                  <div
                    className="premium-hint"
                    onClick={() => setShowLevelCapModal(true)}
                  >
                    ⭐ Unlock Level 4+ with Premium
                  </div>
                )}

                {hasBattlePass && (
                  <div className="bp-boost-indicator">
                    <span className="bp-boost-icon">🔥</span>
                    <span className="bp-boost-text">X5 ACTIVE</span>
                    {referralStats.bonusPercent > 0 && (
                      <span className="bp-referral-bonus">+{referralStats.bonusPercent}% XP</span>
                    )}
                  </div>
                )}

                <div className="tap-hint">
                  {hasBattlePass ? 'BATTLE PASS POWER!' : isPremium ? 'unlimited tapping!' : isLevelCapped ? 'tap to earn bricks' : 'tap to stack'}
                </div>
              </div>

              {/* Progress */}
              <div className="progress-section">
                <div className="progress-info">
                  <span className="progress-text">Level {level}</span>
                  <span className="progress-text">{xpProgress.current}/{xpProgress.needed} to next</span>
                </div>
                <div className="progress-bar-wrap">
                  <div className="progress-bar-fill" style={{ width: `${xpProgress.percent}%` }} />
                </div>
              </div>
            </div>
          )}

          {/* ARENA TAB */}
          {currentTab === 'arena' && (
            <div className="arena-view">
              {/* Battle Pass Required Overlay - Fixed position over everything */}
              {!hasBattlePass && (
                <div className="arena-locked-overlay">
                  <div className="locked-content">
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
                    <h3 style={{ color: '#FF00FF', marginBottom: 8, fontSize: 14 }}>
                      BATTLE PASS REQUIRED
                    </h3>
                    <p style={{ color: '#888', fontSize: 10, marginBottom: 16 }}>
                      Get Battle Pass to compete in the Arena and win USDC rewards!
                    </p>
                    <button
                      onClick={() => setShowBattlePassModal(true)}
                      className="arena-get-bp-btn"
                    >
                      GET BATTLE PASS - $5
                    </button>
                  </div>
                </div>
              )}

              <div className="arena-scroll">
                <h2 className="arena-title">🏆 TAP ARENA</h2>
                <p className="arena-subtitle">
                  {hasBattlePass ? 'Compete for USDC prizes!' : 'Battle Pass Required'}
                </p>

                {/* Battle Pass Badge for BP users */}
                {hasBattlePass && (
                  <div className="arena-bp-badge">
                    <span className="bp-badge-icon">🏆</span>
                    <span className="bp-badge-text">BATTLE PASS ACTIVE</span>
                  </div>
                )}

                {/* Leaderboard - show blurred for non-BP users */}
                <div className={`leaderboard ${!hasBattlePass ? 'leaderboard-locked' : ''}`}>
                  <div className="leaderboard-header">
                    <span>RANK</span>
                    <span>PLAYER</span>
                    <span>BRICKS</span>
                    <span>LVL</span>
                  </div>

                  {leaderboard.map((player) => (
                    <div key={player.rank} className={`leaderboard-row ${player.rank <= 3 ? 'top-three' : ''}`}>
                      <div className="rank-cell">
                        {player.rank === 1 && '🥇'}
                        {player.rank === 2 && '🥈'}
                        {player.rank === 3 && '🥉'}
                        {player.rank > 3 && `#${player.rank}`}
                      </div>
                      <div className="name-cell">{player.name}</div>
                      <div className="taps-cell">{player.taps.toLocaleString()}</div>
                      <div className="win-cell neon-green">{player.winnings}</div>
                    </div>
                  ))}

                  {/* User's position (if not in top 10) */}
                  {hasBattlePass && (
                    <>
                      <div className="leaderboard-divider">...</div>
                      <div className="leaderboard-row user-row">
                        <div className="rank-cell">#{userRank}</div>
                        <div className="name-cell">
                          <span className="player-bp-badge">🏆</span>
                          You
                        </div>
                        <div className="taps-cell">{bricks}</div>
                        <div className="win-cell">{level}L</div>
                      </div>
                    </>
                  )}
                </div>

                <div className="arena-info">
                  <p>💰 Top 10 compete for $1,000 USDC prizes</p>
                  <p>🏆 Top 100 compete for $1,000 USDC</p>
                </div>
              </div>
            </div>
          )}

          {/* QUESTS TAB */}
          {currentTab === 'quests' && (
            <div className="quests-view">
              <div className="quests-scroll">
                <h2 className="quests-title">🎯 QUESTS</h2>
                <p className="quests-subtitle">Complete tasks to earn XP!</p>

                {/* Total XP Banner */}
                <div className="quest-xp-banner">
                  <span className="xp-icon">⭐</span>
                  <span className="xp-label">Total Quest XP:</span>
                  <span className="xp-value">{totalQuestXP.toLocaleString()}</span>
                </div>

                {/* Loading state */}
                {questsLoading && (
                  <div className="quests-loading">Loading quests...</div>
                )}

                {/* Quests List */}
                <div className="quests-list">
                  {quests.map((quest) => (
                    <div
                      key={quest.quest_id}
                      className={`quest-card ${quest.isCompleted ? 'quest-completed' : ''} ${!quest.canComplete && quest.verification_method === 'internal' ? 'quest-locked' : ''}`}
                    >
                      <div className="quest-icon">{quest.icon}</div>
                      <div className="quest-info">
                        <h3 className="quest-title-text">{quest.title}</h3>
                        <p className="quest-desc">{quest.description}</p>
                        {/* Progress bar for milestone quests */}
                        {quest.verification_method === 'internal' && !quest.isCompleted && quest.progressText && (
                          <div className="quest-progress">
                            <div className="quest-progress-bar">
                              <div
                                className="quest-progress-fill"
                                style={{ width: `${Math.min(100, (quest.current / quest.required) * 100)}%` }}
                              />
                            </div>
                            <span className="quest-progress-text">{quest.progressText}</span>
                          </div>
                        )}
                      </div>
                      <div className="quest-reward-section">
                        {quest.isCompleted ? (
                          <div className="quest-check">✓</div>
                        ) : (
                          <>
                            <div className="quest-reward-text">
                              <div className="reward-amount">+{quest.xp_reward?.toLocaleString()}</div>
                              <div className="reward-label">XP</div>
                            </div>
                            {/* Action button */}
                            {quest.external_url && (quest.type === 'social' || quest.type === 'partner_api') ? (
                              <div className="quest-actions">
                                <button
                                  className="quest-btn quest-btn-go"
                                  onClick={() => window.open(quest.external_url, '_blank')}
                                >
                                  GO
                                </button>
                                <button
                                  className={`quest-btn quest-btn-verify ${completingQuest === quest.quest_id ? 'btn-loading' : ''}`}
                                  onClick={() => verifyQuest(quest)}
                                  disabled={completingQuest === quest.quest_id}
                                >
                                  {completingQuest === quest.quest_id ? '...' : 'VERIFY'}
                                </button>
                              </div>
                            ) : (
                              <button
                                className={`quest-btn quest-btn-claim ${!quest.canComplete ? 'btn-disabled' : ''} ${completingQuest === quest.quest_id ? 'btn-loading' : ''}`}
                                onClick={() => verifyQuest(quest)}
                                disabled={!quest.canComplete || completingQuest === quest.quest_id}
                              >
                                {completingQuest === quest.quest_id ? '...' : quest.canComplete ? 'CLAIM' : 'LOCKED'}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Empty state */}
                {!questsLoading && quests.length === 0 && (
                  <div className="quests-empty">
                    <p>Connect wallet to see quests</p>
                  </div>
                )}

                <div className="quests-info">
                  <p>🎁 Complete quests to earn XP and climb the leaderboard!</p>
                  <p>✅ Social quests: Click GO, then VERIFY to claim</p>
                </div>
              </div>
            </div>
          )}

          {/* SHOP TAB */}
          {currentTab === 'shop' && (
            <div className="shop-view">
              <div className="shop-scroll">
                
                {/* Battle Pass - Featured */}
                <div className={`featured-item ${hasBattlePass ? 'featured-item-active' : ''}`}>
                  <div className="item-header">
                    <div className="item-icon-large">{hasBattlePass ? '🏆' : '👑'}</div>
                    <div>
                      <div className="item-title">BATTLE PASS</div>
                      <div className="item-subtitle">
                        {hasBattlePass
                          ? `ACTIVE - ${battlePassInfo?.daysRemaining || 30} days left`
                          : 'SEASON 1 - UNLIMITED POWER'}
                      </div>
                    </div>
                    <button
                      className="info-btn"
                      onMouseDown={(e) => openTooltip('battlepass', e)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info size={18} />
                    </button>
                  </div>
                  <div className="item-price-big">
                    <span className="price-value">{hasBattlePass ? 'ACTIVE' : '$5'}</span>
                    {!hasBattlePass && <span className="price-period">/30 DAYS</span>}
                  </div>
                  <button
                    className={`buy-btn-featured ${hasBattlePass ? 'btn-featured-active' : ''}`}
                    onClick={() => !hasBattlePass && setShowBattlePassModal(true)}
                    disabled={hasBattlePass}
                  >
                    {hasBattlePass ? '✓ ACTIVATED' : 'GET BATTLE PASS'}
                  </button>
                </div>

                {/* Premium */}
                <div className={`shop-item-row ${isPremium ? 'item-premium-active' : ''}`}>
                  <div className="item-left">
                    <div className="item-icon-small">👑</div>
                    <div className="item-details">
                      <div className="item-name">PREMIUM</div>
                      <div className="item-brief">{isPremium ? 'Activated forever!' : 'Unlimited tapping forever'}</div>
                    </div>
                  </div>
                  <div className="item-right">
                    <button
                      className="info-btn-small"
                      onMouseDown={(e) => openTooltip('premium', e)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info size={16} />
                    </button>
                    <div className="item-price-small">$2</div>
                    <button
                      className={`buy-btn-small ${isPremium ? 'btn-premium-active' : 'btn-premium'}`}
                      onClick={() => !isPremium && setShowPremiumModal(true)}
                      disabled={isPremium}
                    >
                      {isPremium ? 'ACTIVE' : 'BUY'}
                    </button>
                  </div>
                </div>

                {/* Boost X2 */}
                <div className={`shop-item-row ${(boostMultiplier >= 2 || hasBattlePass) ? 'item-disabled' : ''}`}>
                  <div className="item-left">
                    <div className="item-icon-small">⚡</div>
                    <div className="item-details">
                      <div className="item-name">BOOST X2</div>
                      <div className="item-brief">
                        {hasBattlePass ? 'Not needed (BP has X5)' : boostType === 'x2' ? `Active: ${formatBoostTime(boostTimeRemaining)}` : '2X bricks for 24h'}
                      </div>
                    </div>
                  </div>
                  <div className="item-right">
                    <button
                      className="info-btn-small"
                      onMouseDown={(e) => openTooltip('boostx2', e)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info size={16} />
                    </button>
                    <div className="item-price-small">$0.50</div>
                    <button
                      className={`buy-btn-small ${(boostMultiplier >= 2 || hasBattlePass) ? 'btn-disabled' : ''}`}
                      onClick={() => !hasBattlePass && boostMultiplier < 2 && openBoostModal('boost_2x')}
                      disabled={boostMultiplier >= 2 || hasBattlePass}
                    >
                      {hasBattlePass ? 'N/A' : boostType === 'x2' ? 'ACTIVE' : boostMultiplier >= 2 ? 'BLOCKED' : 'BUY'}
                    </button>
                  </div>
                </div>

                {/* Boost X5 */}
                <div className={`shop-item-row ${(boostMultiplier === 5 || hasBattlePass) ? 'item-disabled' : ''}`}>
                  <div className="item-left">
                    <div className="item-icon-small">🔥</div>
                    <div className="item-details">
                      <div className="item-name">BOOST X5</div>
                      <div className="item-brief">
                        {hasBattlePass ? 'Included in Battle Pass!' : boostType === 'x5' ? `Active: ${formatBoostTime(boostTimeRemaining)}` : boostType === 'x2' ? 'UPGRADE available!' : '5X bricks for 24h'}
                      </div>
                    </div>
                  </div>
                  <div className="item-right">
                    <button
                      className="info-btn-small"
                      onMouseDown={(e) => openTooltip('boostx5', e)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info size={16} />
                    </button>
                    <div className="item-price-small">$1.50</div>
                    <button
                      className={`buy-btn-small ${(boostMultiplier === 5 || hasBattlePass) ? 'btn-disabled' : boostType === 'x2' ? 'btn-upgrade' : ''}`}
                      onClick={() => !hasBattlePass && boostMultiplier !== 5 && openBoostModal('boost_5x')}
                      disabled={boostMultiplier === 5 || hasBattlePass}
                    >
                      {hasBattlePass ? 'ACTIVE' : boostType === 'x5' ? 'ACTIVE' : boostType === 'x2' ? 'UPGRADE' : 'BUY'}
                    </button>
                  </div>
                </div>

                {/* Energy Refill */}
                <div className={`shop-item-row ${(isPremium || hasBattlePass) ? 'item-disabled' : ''}`}>
                  <div className="item-left">
                    <div className="item-icon-small">🔋</div>
                    <div className="item-details">
                      <div className="item-name">ENERGY REFILL</div>
                      <div className="item-brief">
                        {hasBattlePass ? 'Not needed (Battle Pass)' : isPremium ? 'Not needed (Premium)' : 'Instant +100 energy'}
                      </div>
                    </div>
                  </div>
                  <div className="item-right">
                    <button
                      className="info-btn-small"
                      onMouseDown={(e) => openTooltip('energy', e)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info size={16} />
                    </button>
                    <div className="item-price-small">$0.25</div>
                    <button
                      className={`buy-btn-small ${(isPremium || hasBattlePass) ? 'btn-disabled' : 'btn-energy'}`}
                      onClick={() => !(isPremium || hasBattlePass) && setShowEnergyModal(true)}
                      disabled={isPremium || hasBattlePass}
                    >
                      {(isPremium || hasBattlePass) ? 'N/A' : 'BUY'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* REFERRALS TAB */}
          {currentTab === 'referrals' && (
            <div className="referrals-view">
              <div className="referrals-scroll">
                <h3 className="section-title">
                  {hasBattlePass ? '🏆 REFERRAL BONUSES' : 'UNLIMITED BOOSTS 🗿'}
                </h3>

                {/* Battle Pass Required Notice (if no battle pass) */}
                {!hasBattlePass && (
                  <div className="bp-required-notice">
                    <div style={{ fontSize: 24, marginBottom: 8 }}>🔒</div>
                    <p style={{ color: '#FF00FF', fontSize: 10, marginBottom: 8 }}>
                      Battle Pass Required for Referral Bonuses
                    </p>
                    <p style={{ color: '#888', fontSize: 9, marginBottom: 12 }}>
                      Get +10% XP bonus per verified referral!
                    </p>
                    <button
                      onClick={() => setShowBattlePassModal(true)}
                      className="get-bp-btn"
                    >
                      GET BATTLE PASS - $5
                    </button>
                  </div>
                )}

                <div className="referral-card">
                  <div className="referral-label">YOUR LINK</div>
                  <div className="referral-link-box">
                    {referralLink || 'CONNECT WALLET'}
                  </div>
                  <div className="action-btns">
                    <button onClick={copyLink} disabled={!referralLink} className="action-btn">
                      <Copy size={16} />
                      COPY
                    </button>
                    <button onClick={shareOnTwitter} disabled={!referralLink} className="action-btn action-btn-x">
                      <Share2 size={14} />
                      SHARE X
                    </button>
                    <button onClick={shareOnTelegram} disabled={!referralLink} className="action-btn action-btn-tg">
                      SHARE TG
                    </button>
                  </div>
                </div>

                <div className="referral-stats">
                  <div className="ref-stat">
                    <div className="ref-stat-value">{referralStats.total}</div>
                    <div className="ref-stat-label">INVITED</div>
                  </div>
                  <div className="ref-stat">
                    <div className="ref-stat-value neon-green">{referralStats.verified}</div>
                    <div className="ref-stat-label">VERIFIED</div>
                  </div>
                  <div className="ref-stat">
                    <div className={`ref-stat-value ${hasBattlePass ? 'neon-purple' : ''}`}>
                      {hasBattlePass ? `+${referralStats.bonusPercent}%` : '🔒'}
                    </div>
                    <div className="ref-stat-label">XP BOOST</div>
                  </div>
                </div>

                <div className="referral-info-box">
                  <p className="info-text">
                    {hasBattlePass
                      ? `🔥 You get +${referralStats.bonusPercent}% XP from ${referralStats.verified} verified referrals!`
                      : 'Get Battle Pass to earn +10% XP per referral who purchases Battle Pass or Premium!'}
                  </p>
                </div>

                {/* Referral Code Display */}
                {referralCode && (
                  <div className="referral-code-box">
                    <div className="code-label">YOUR CODE</div>
                    <div className="code-value">{referralCode}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Bottom Nav - 4 tabs now */}
        <nav className="bottom-nav">
          <button 
            className={`nav-btn ${currentTab === 'game' ? 'nav-btn-active' : ''}`}
            onClick={() => { setCurrentTab('game'); playWhoosh(); }}
          >
            <Gamepad2 size={22} />
            <span>GAME</span>
          </button>
          <button 
            className={`nav-btn ${currentTab === 'arena' ? 'nav-btn-active' : ''}`}
            onClick={() => { setCurrentTab('arena'); playWhoosh(); }}
          >
            <Trophy size={22} />
            <span>ARENA</span>
          </button>
          <button 
            className={`nav-btn ${currentTab === 'quests' ? 'nav-btn-active' : ''}`}
            onClick={() => { setCurrentTab('quests'); playWhoosh(); }}
          >
            <Zap size={22} />
            <span>QUESTS</span>
          </button>
          <button 
            className={`nav-btn ${currentTab === 'shop' ? 'nav-btn-active' : ''}`}
            onClick={() => { setCurrentTab('shop'); playWhoosh(); }}
          >
            <ShoppingBag size={22} />
            <span>SHOP</span>
          </button>
          <button 
            className={`nav-btn ${currentTab === 'referrals' ? 'nav-btn-active' : ''}`}
            onClick={() => { setCurrentTab('referrals'); playWhoosh(); }}
          >
            <Users size={22} />
            <span>REFS</span>
          </button>
        </nav>
      </div>

      {/* CSS - Continuing in next message due to length */}
      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          -webkit-tap-highlight-color: transparent;
        }

        .app-wrapper {
          width: 100vw;
          height: 100vh;
          height: 100dvh;
          background: #000000;
          color: white;
          font-family: 'Press Start 2P', monospace;
          position: fixed;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .floating-coins-bg {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }

        .floating-coin {
          position: absolute;
          opacity: 0.08;
          filter: drop-shadow(0 0 10px rgba(255, 0, 255, 0.2));
          animation: float-rotate-slow 20s linear infinite;
        }

        @keyframes float-rotate-slow {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(180deg); }
        }

        .mobile-container {
          width: 100%;
          max-width: 480px;
          height: 100%;
          max-height: 100vh;
          max-height: 100dvh;
          background: #0A0A0A;
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 0 60px rgba(255, 0, 255, 0.3);
        }

        .particle {
          position: absolute;
          pointer-events: none;
          z-index: 100;
          font-size: 28px;
          font-weight: bold;
          opacity: 1;
          animation: particle-fade 3.5s ease-out forwards;
        }

        .particle-confetti {
          font-size: 24px;
          filter: drop-shadow(0 0 8px currentColor);
        }

        .particle-emoji {
          font-size: 32px;
          filter: drop-shadow(0 0 10px rgba(255, 255, 0, 0.9));
        }

        @keyframes particle-fade {
          0% { opacity: 1; }
          70% { opacity: 1; }
          100% { opacity: 0; }
        }

        .fireworks {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 99;
        }

        .firework {
          position: absolute;
          width: 4px;
          height: 4px;
          background: #FF00FF;
          border-radius: 50%;
          box-shadow: 0 0 20px #FF00FF;
          left: 50%;
          top: 50%;
          animation: firework-explode 2s ease-out infinite;
          animation-delay: calc(var(--i) * 0.1s);
        }

        @keyframes firework-explode {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(
              calc(cos(calc(var(--i) * 45deg)) * 200px),
              calc(sin(calc(var(--i) * 45deg)) * 200px)
            ) scale(0);
            opacity: 0;
          }
        }

        .notification {
          position: absolute;
          top: 70px;
          left: 50%;
          transform: translateX(-50%);
          padding: 12px 20px;
          background: linear-gradient(135deg, #FF00FF, #00FFFF);
          border: 2px solid #FFFF00;
          border-radius: 8px;
          font-size: 10px;
          z-index: 1000;
          animation: notification-pop 0.3s ease-out;
          box-shadow: 0 0 30px rgba(255, 0, 255, 0.8);
          white-space: nowrap;
          max-width: 90%;
        }

        @keyframes notification-pop {
          0% { transform: translateX(-50%) scale(0.8); opacity: 0; }
          100% { transform: translateX(-50%) scale(1); opacity: 1; }
        }

        /* TOOLTIP SYSTEM */
        .tooltip-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(4px);
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .tooltip-modal {
          background: linear-gradient(135deg, rgba(20, 20, 20, 0.95), rgba(40, 0, 40, 0.95));
          border: 2px solid #FF00FF;
          border-radius: 16px;
          padding: 24px;
          max-width: 90%;
          max-height: 80%;
          overflow-y: auto;
          box-shadow: 0 0 40px rgba(255, 0, 255, 0.6);
          position: relative;
          transform: scale(1);
        }

        .tooltip-close {
          position: absolute;
          top: 12px;
          right: 12px;
          background: rgba(255, 0, 255, 0.2);
          border: 1.5px solid #FF00FF;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: white;
          transition: all 0.3s;
        }

        .tooltip-close:hover {
          background: rgba(255, 0, 255, 0.4);
          transform: scale(1.1);
        }

        .tooltip-title {
          font-size: 16px;
          margin-bottom: 12px;
          background: linear-gradient(90deg, #FF00FF, #00FFFF);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .tooltip-desc {
          font-size: 10px;
          color: #aaa;
          line-height: 1.6;
          margin-bottom: 16px;
        }

        .tooltip-benefits {
          background: rgba(0, 255, 0, 0.05);
          border: 1.5px solid rgba(0, 255, 0, 0.3);
          border-radius: 12px;
          padding: 14px;
        }

        .tooltip-benefits-title {
          font-size: 11px;
          color: #00FF00;
          margin-bottom: 10px;
        }

        .tooltip-benefit-item {
          font-size: 9px;
          color: #00FF00;
          margin: 6px 0;
          padding-left: 4px;
        }

        .header {
          height: 56px;
          background: rgba(10, 10, 10, 0.95);
          backdrop-filter: blur(10px);
          border-bottom: 2px solid #FF00FF;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          flex-shrink: 0;
          box-shadow: 0 2px 15px rgba(255, 0, 255, 0.3);
        }

        .logo {
          font-size: 12px;
          background: linear-gradient(90deg, #FF00FF, #00FFFF);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .wallet-badge {
          padding: 6px 12px;
          background: rgba(255, 0, 255, 0.15);
          border: 1.5px solid #FF00FF;
          border-radius: 6px;
          font-size: 9px;
        }

        .connect-btn-small {
          padding: 6px 12px;
          background: linear-gradient(135deg, #FF00FF, #00FFFF);
          border: 2px solid #FFFF00;
          border-radius: 6px;
          color: black;
          font-family: inherit;
          font-size: 9px;
          cursor: pointer;
          font-weight: bold;
        }

        .main-content {
          flex: 1;
          overflow: hidden;
          position: relative;
        }

        /* GAME VIEW */
        .game-view {
          height: 100%;
          display: flex;
          flex-direction: column;
          padding: 16px;
        }

        .stats-simple {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 12px;
          flex-shrink: 0;
        }

        .stat-box {
          background: rgba(20, 20, 20, 0.6);
          border: 1.5px solid rgba(255, 0, 255, 0.3);
          border-radius: 12px;
          padding: 10px 6px;
          text-align: center;
          transition: all 0.3s;
        }

        .stat-box:hover {
          border-color: rgba(255, 0, 255, 0.6);
          box-shadow: 0 0 15px rgba(255, 0, 255, 0.3);
        }

        .stat-emoji {
          font-size: 24px;
          margin-bottom: 6px;
          animation: pulse-subtle 3s ease-in-out infinite;
        }

        @keyframes pulse-subtle {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }

        .stat-label {
          font-size: 6px;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 16px;
          font-weight: bold;
        }

        .neon-green {
          color: #00FF00;
          text-shadow: 0 0 10px #00FF00;
        }

        .neon-yellow {
          color: #FFFF00;
          text-shadow: 0 0 10px #FFFF00;
        }

        .neon-purple {
          color: #FF00FF;
          text-shadow: 0 0 10px #FF00FF;
        }

        .neon-cyan {
          color: #00FFFF;
          text-shadow: 0 0 10px #00FFFF;
        }

        /* BOOST INDICATOR */
        .boost-indicator {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-radius: 12px;
          margin-bottom: 12px;
          flex-shrink: 0;
          animation: boost-pulse 2s ease-in-out infinite;
        }

        .boost-x2 {
          background: linear-gradient(135deg, rgba(255, 165, 0, 0.3), rgba(255, 100, 0, 0.3));
          border: 2px solid #FFA500;
          box-shadow: 0 0 20px rgba(255, 165, 0, 0.4);
        }

        .boost-x5 {
          background: linear-gradient(135deg, rgba(255, 50, 50, 0.3), rgba(255, 0, 100, 0.3));
          border: 2px solid #FF3333;
          box-shadow: 0 0 20px rgba(255, 50, 50, 0.4);
        }

        .boost-battlepass {
          background: linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 165, 0, 0.3));
          border: 2px solid #FFD700;
          box-shadow: 0 0 25px rgba(255, 215, 0, 0.5);
        }

        .boost-battlepass .boost-label {
          color: #FFD700;
        }

        .boost-battlepass .bp-timer {
          color: #FFD700;
          font-size: 12px;
        }

        @keyframes boost-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }

        .boost-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .boost-icon {
          font-size: 20px;
        }

        .boost-label {
          font-size: 10px;
          font-weight: bold;
          color: #fff;
          text-shadow: 0 0 10px currentColor;
        }

        .boost-x2 .boost-label { color: #FFA500; }
        .boost-x5 .boost-label { color: #FF3333; }

        .boost-timer {
          font-size: 14px;
          font-weight: bold;
          color: #fff;
          font-family: monospace;
          background: rgba(0, 0, 0, 0.4);
          padding: 4px 10px;
          border-radius: 8px;
        }

        /* ENERGY BAR */
        .energy-bar-container {
          background: rgba(20, 20, 20, 0.8);
          border: 1.5px solid rgba(255, 255, 0, 0.4);
          border-radius: 12px;
          padding: 10px;
          margin-bottom: 12px;
          flex-shrink: 0;
        }

        .energy-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .energy-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 9px;
          color: #FFFF00;
        }

        .energy-icon {
          color: #FFFF00;
        }

        .energy-value {
          font-size: 11px;
          color: #FFFF00;
          font-weight: bold;
        }

        .energy-bar {
          height: 10px;
          background: rgba(0, 0, 0, 0.6);
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 0, 0.3);
        }

        .energy-fill {
          height: 100%;
          background: linear-gradient(90deg, #FFFF00, #FF8800);
          border-radius: 10px;
          transition: width 0.5s ease;
          box-shadow: 0 0 10px rgba(255, 255, 0, 0.6);
        }

        .energy-hint {
          margin-top: 6px;
          font-size: 7px;
          color: #666;
          text-align: center;
        }

        .tap-area-full {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          touch-action: manipulation;
          -webkit-user-select: none;
          user-select: none;
          min-height: 0;
        }

        .pyramid-container {
          transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        .pyramid-pulse {
          animation: pyramid-pulse-anim 0.3s ease-in-out;
        }

        @keyframes pyramid-pulse-anim {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }

        .pyramid-grid {
          display: grid;
          grid-template-columns: repeat(9, 32px);
          grid-template-rows: repeat(5, 48px);
          gap: 4px;
          justify-content: center;
          align-items: end;
        }

        .pyramid-moai {
          font-size: 38px;
          text-align: center;
          filter: drop-shadow(0 0 10px rgba(255, 0, 255, 0.8));
        }

        @keyframes pop-in {
          0% {
            transform: scale(0) rotate(0deg);
            opacity: 0;
          }
          50% {
            transform: scale(1.3) rotate(180deg);
          }
          100% {
            transform: scale(1) rotate(360deg);
            opacity: 1;
          }
        }

        .level-badge {
          margin-top: 16px;
          padding: 8px 20px;
          background: linear-gradient(135deg, #FFFF00, #FF8800);
          border: 2px solid #FFFF00;
          border-radius: 20px;
          font-size: 12px;
          color: black;
          font-weight: bold;
          box-shadow: 0 0 20px rgba(255, 255, 0, 0.6);
        }

        .level-badge.level-capped {
          background: linear-gradient(135deg, #FFD700, #FF6B00);
          border-color: #FFD700;
          animation: pulse-gold 2s ease-in-out infinite;
        }

        .level-badge.level-premium {
          background: linear-gradient(135deg, #FFD700, #FFA500);
          border-color: #FFD700;
          animation: pulse-premium 2s ease-in-out infinite;
        }

        .level-badge.level-battlepass {
          background: linear-gradient(135deg, #FF00FF, #8B00FF);
          border-color: #FF00FF;
          animation: pulse-battlepass 2s ease-in-out infinite;
        }

        .bp-badge-small {
          margin-right: 4px;
          font-size: 10px;
        }

        @keyframes pulse-premium {
          0%, 100% { box-shadow: 0 0 15px rgba(255, 215, 0, 0.4); }
          50% { box-shadow: 0 0 25px rgba(255, 215, 0, 0.7); }
        }

        @keyframes pulse-battlepass {
          0%, 100% { box-shadow: 0 0 20px rgba(255, 0, 255, 0.5); }
          50% { box-shadow: 0 0 35px rgba(255, 0, 255, 0.8); }
        }

        /* GOLDEN PYRAMID - BATTLE PASS */
        .pyramid-container.pyramid-golden {
          filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.6));
        }

        .pyramid-container.pyramid-golden .pyramid-moai {
          filter: brightness(1.3) drop-shadow(0 0 8px rgba(255, 215, 0, 0.8));
        }

        .golden-glow {
          position: absolute;
          inset: -20px;
          background: radial-gradient(circle, rgba(255, 215, 0, 0.15) 0%, transparent 70%);
          pointer-events: none;
          animation: golden-pulse 3s ease-in-out infinite;
        }

        @keyframes golden-pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }

        /* Battle Pass Boost Indicator */
        .bp-boost-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 10px;
          padding: 8px 16px;
          background: linear-gradient(135deg, rgba(255, 0, 255, 0.2), rgba(139, 0, 255, 0.2));
          border: 1.5px solid #FF00FF;
          border-radius: 12px;
          animation: bp-glow 2s ease-in-out infinite;
        }

        @keyframes bp-glow {
          0%, 100% { box-shadow: 0 0 15px rgba(255, 0, 255, 0.4); }
          50% { box-shadow: 0 0 25px rgba(255, 0, 255, 0.7); }
        }

        .bp-boost-icon {
          font-size: 14px;
        }

        .bp-boost-text {
          color: #FF00FF;
          font-size: 10px;
          font-weight: bold;
        }

        .bp-referral-bonus {
          color: #00FF00;
          font-size: 9px;
          padding-left: 8px;
          border-left: 1px solid rgba(255, 255, 255, 0.2);
        }

        @keyframes pulse-gold {
          0%, 100% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.6); }
          50% { box-shadow: 0 0 35px rgba(255, 215, 0, 0.9); }
        }

        .premium-hint {
          margin-top: 10px;
          padding: 8px 16px;
          background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 165, 0, 0.2));
          border: 1.5px solid #FFD700;
          border-radius: 12px;
          font-size: 9px;
          color: #FFD700;
          cursor: pointer;
          transition: all 0.3s;
          animation: glow-hint 3s ease-in-out infinite;
        }

        .premium-hint:hover {
          background: linear-gradient(135deg, rgba(255, 215, 0, 0.4), rgba(255, 165, 0, 0.4));
          transform: scale(1.05);
        }

        @keyframes glow-hint {
          0%, 100% { box-shadow: 0 0 10px rgba(255, 215, 0, 0.3); }
          50% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.6); }
        }

        .tap-hint {
          margin-top: 12px;
          font-size: 10px;
          color: #666;
          animation: blink 2s ease-in-out infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }

        .progress-section {
          flex-shrink: 0;
          padding: 12px 0 0;
        }

        .progress-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          padding: 0 4px;
        }

        .progress-text {
          font-size: 8px;
          color: #888;
        }

        .progress-bar-wrap {
          height: 14px;
          background: rgba(20, 20, 20, 0.6);
          border: 1.5px solid rgba(255, 0, 255, 0.4);
          border-radius: 20px;
          overflow: hidden;
          padding: 2px;
        }

        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #00FF00, #FFFF00, #FF00FF);
          border-radius: 20px;
          transition: width 0.3s ease;
          box-shadow: 0 0 12px rgba(0, 255, 0, 0.6);
        }

        /* ARENA VIEW */
        .arena-view,
        .quests-view,
        .shop-view,
        .referrals-view {
          height: 100%;
          overflow: hidden;
        }

        .arena-scroll,
        .quests-scroll,
        .shop-scroll,
        .referrals-scroll {
          height: 100%;
          overflow-y: auto;
          padding: 16px;
          -webkit-overflow-scrolling: touch;
        }

        .arena-title,
        .quests-title {
          text-align: center;
          font-size: 16px;
          margin-bottom: 8px;
          background: linear-gradient(90deg, #FFFF00, #FF00FF);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .arena-subtitle,
        .quests-subtitle {
          text-align: center;
          font-size: 9px;
          color: #888;
          margin-bottom: 20px;
        }

        .leaderboard {
          background: rgba(20, 20, 20, 0.8);
          border: 2px solid rgba(255, 0, 255, 0.3);
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 20px;
        }

        .leaderboard-header {
          display: grid;
          grid-template-columns: 60px 1fr 80px 60px;
          gap: 8px;
          padding: 12px;
          background: rgba(255, 0, 255, 0.1);
          border-bottom: 1.5px solid rgba(255, 0, 255, 0.3);
          font-size: 8px;
          color: #888;
          text-transform: uppercase;
        }

        .leaderboard-row {
          display: grid;
          grid-template-columns: 60px 1fr 80px 60px;
          gap: 8px;
          padding: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          font-size: 10px;
          transition: all 0.3s;
        }

        .leaderboard-row:last-child {
          border-bottom: none;
        }

        .leaderboard-row:hover {
          background: rgba(255, 0, 255, 0.05);
        }

        .top-three {
          background: linear-gradient(90deg, rgba(255, 215, 0, 0.1), transparent);
        }

        .user-row {
          background: rgba(0, 255, 255, 0.1);
          border-top: 2px solid rgba(0, 255, 255, 0.4);
        }

        .rank-cell {
          font-size: 14px;
          text-align: center;
        }

        .name-cell {
          color: #fff;
        }

        .taps-cell {
          color: #888;
          text-align: right;
        }

        .win-cell {
          text-align: right;
        }

        .leaderboard-divider {
          padding: 8px;
          text-align: center;
          color: #666;
          font-size: 16px;
        }

        .arena-info {
          background: rgba(0, 255, 0, 0.05);
          border: 1.5px solid rgba(0, 255, 0, 0.3);
          border-radius: 10px;
          padding: 14px;
          font-size: 9px;
          color: #00FF00;
          line-height: 1.6;
        }

        .arena-info p {
          margin: 6px 0;
        }

        /* ARENA BATTLE PASS FEATURES */
        .arena-bp-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 16px;
          padding: 10px 16px;
          background: linear-gradient(135deg, rgba(255, 0, 255, 0.2), rgba(139, 0, 255, 0.2));
          border: 2px solid #FF00FF;
          border-radius: 12px;
          animation: arena-bp-pulse 2s ease-in-out infinite;
        }

        @keyframes arena-bp-pulse {
          0%, 100% { box-shadow: 0 0 15px rgba(255, 0, 255, 0.4); }
          50% { box-shadow: 0 0 30px rgba(255, 0, 255, 0.7); }
        }

        .bp-badge-icon {
          font-size: 18px;
        }

        .bp-badge-text {
          color: #FF00FF;
          font-size: 10px;
          font-weight: bold;
        }

        .leaderboard.leaderboard-locked {
          filter: blur(6px);
          opacity: 0.4;
          pointer-events: none;
        }

        .arena-view {
          position: relative;
        }

        .arena-locked-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 20;
          background: rgba(0, 0, 0, 0.7);
        }

        .locked-content {
          background: rgba(26, 26, 46, 0.98);
          border: 2px solid #FF00FF;
          border-radius: 16px;
          padding: 28px;
          box-shadow: 0 0 50px rgba(255, 0, 255, 0.6);
          text-align: center;
          max-width: 300px;
        }

        .arena-get-bp-btn {
          padding: 14px 24px;
          background: linear-gradient(135deg, #FF00FF, #8B00FF);
          border: none;
          border-radius: 10px;
          color: #fff;
          font-family: inherit;
          font-size: 11px;
          font-weight: bold;
          cursor: pointer;
          box-shadow: 0 0 20px rgba(255, 0, 255, 0.5);
          transition: all 0.3s;
        }

        .arena-get-bp-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 0 30px rgba(255, 0, 255, 0.7);
        }

        .player-bp-badge {
          margin-right: 4px;
          font-size: 10px;
        }

        .bp-player {
          background: linear-gradient(90deg, rgba(255, 0, 255, 0.1), transparent);
        }

        .arena-scroll {
          position: relative;
        }

        /* QUESTS VIEW */
        .quests-list {
          margin-bottom: 20px;
        }

        /* Quest XP Banner */
        .quest-xp-banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 165, 0, 0.1));
          border: 2px solid #FFD700;
          border-radius: 12px;
          margin-bottom: 16px;
        }

        .xp-icon {
          font-size: 20px;
        }

        .xp-label {
          font-size: 10px;
          color: #888;
        }

        .xp-value {
          font-size: 18px;
          color: #FFD700;
          font-weight: bold;
        }

        .quests-loading {
          text-align: center;
          padding: 20px;
          color: #888;
          font-size: 10px;
        }

        .quests-empty {
          text-align: center;
          padding: 30px;
          color: #666;
          font-size: 10px;
        }

        .quest-card {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px;
          background: rgba(20, 20, 20, 0.8);
          border: 1.5px solid rgba(255, 0, 255, 0.3);
          border-radius: 12px;
          margin-bottom: 10px;
          transition: all 0.3s;
        }

        .quest-card:hover {
          border-color: rgba(255, 0, 255, 0.6);
          box-shadow: 0 0 20px rgba(255, 0, 255, 0.2);
        }

        .quest-completed {
          background: rgba(0, 255, 0, 0.08);
          border-color: rgba(0, 255, 0, 0.4);
        }

        .quest-locked {
          opacity: 0.7;
        }

        .quest-icon {
          font-size: 28px;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .quest-info {
          flex: 1;
          min-width: 0;
        }

        .quest-title-text {
          font-size: 10px;
          margin-bottom: 4px;
          color: #fff;
        }

        .quest-desc {
          font-size: 8px;
          color: #888;
          margin-bottom: 6px;
        }

        /* Quest Progress Bar */
        .quest-progress {
          margin-top: 8px;
        }

        .quest-progress-bar {
          height: 6px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 4px;
        }

        .quest-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #FF00FF, #00FFFF);
          border-radius: 3px;
          transition: width 0.3s ease;
        }

        .quest-progress-text {
          font-size: 7px;
          color: #00FFFF;
        }

        .quest-reward-section {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
        }

        .quest-check {
          font-size: 24px;
          color: #00FF00;
        }

        .quest-reward-text {
          text-align: right;
        }

        .reward-amount {
          font-size: 12px;
          color: #FFFF00;
          font-weight: bold;
        }

        .reward-label {
          font-size: 7px;
          color: #888;
        }

        /* Quest Action Buttons */
        .quest-actions {
          display: flex;
          gap: 6px;
        }

        .quest-btn {
          padding: 6px 12px;
          border: none;
          border-radius: 6px;
          font-family: inherit;
          font-size: 8px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
        }

        .quest-btn-go {
          background: linear-gradient(135deg, #00FFFF, #0088FF);
          color: #000;
        }

        .quest-btn-verify {
          background: linear-gradient(135deg, #00FF00, #00CC00);
          color: #000;
        }

        .quest-btn-claim {
          background: linear-gradient(135deg, #FFFF00, #FF00FF);
          color: #000;
          padding: 8px 16px;
        }

        .quest-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 0 15px rgba(255, 255, 255, 0.3);
        }

        .quest-btn.btn-disabled {
          background: #444;
          color: #888;
          cursor: not-allowed;
        }

        .quest-btn.btn-disabled:hover {
          transform: none;
          box-shadow: none;
        }

        .quest-btn.btn-loading {
          opacity: 0.7;
          cursor: wait;
        }

        .quests-info {
          background: rgba(0, 255, 255, 0.05);
          border: 1.5px solid rgba(0, 255, 255, 0.3);
          border-radius: 10px;
          padding: 14px;
          font-size: 9px;
          color: #00FFFF;
          line-height: 1.6;
          margin-top: 16px;
        }

        .quests-info p {
          margin: 6px 0;
        }

        /* SHOP VIEW - NEW DESIGN */
        .featured-item {
          background: linear-gradient(135deg, rgba(255, 0, 255, 0.2), rgba(0, 255, 255, 0.2));
          border: 2.5px solid;
          border-image: linear-gradient(135deg, #FFFF00, #FF00FF) 1;
          border-radius: 16px;
          padding: 18px;
          margin-bottom: 20px;
          box-shadow: 0 0 30px rgba(255, 0, 255, 0.4);
        }

        .item-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .item-icon-large {
          font-size: 48px;
          flex-shrink: 0;
        }

        .item-title {
          font-size: 15px;
          color: #FFFF00;
          text-shadow: 0 0 10px #FFFF00;
        }

        .item-subtitle {
          font-size: 8px;
          color: #888;
          margin-top: 4px;
        }

        .info-btn {
          margin-left: auto;
          background: rgba(0, 255, 255, 0.2);
          border: 1.5px solid #00FFFF;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #00FFFF;
          transition: all 0.3s;
          flex-shrink: 0;
        }

        .info-btn:hover {
          background: rgba(0, 255, 255, 0.4);
          transform: scale(1.1);
        }

        .item-price-big {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 6px;
          margin: 16px 0;
        }

        .price-value {
          font-size: 32px;
          color: #00FF00;
          text-shadow: 0 0 20px #00FF00;
        }

        .price-period {
          font-size: 10px;
          color: #888;
        }

        .buy-btn-featured {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #FFFF00, #FF00FF);
          border: none;
          border-radius: 12px;
          font-family: inherit;
          font-size: 14px;
          color: black;
          font-weight: bold;
          cursor: pointer;
          box-shadow: 0 0 30px rgba(255, 255, 0, 0.6);
          transition: all 0.3s;
        }

        .buy-btn-featured:active {
          transform: scale(0.97);
        }

        .buy-btn-featured.btn-featured-active {
          background: linear-gradient(135deg, #4CAF50, #45a049);
          box-shadow: 0 0 20px rgba(76, 175, 80, 0.5);
          cursor: default;
        }

        .featured-item.featured-item-active {
          background: linear-gradient(135deg, rgba(76, 175, 80, 0.2), rgba(0, 255, 0, 0.1));
          border-image: linear-gradient(135deg, #4CAF50, #00FF00) 1;
          box-shadow: 0 0 30px rgba(76, 175, 80, 0.4);
        }

        .featured-item.featured-item-active .price-value {
          color: #4CAF50;
          text-shadow: 0 0 15px rgba(76, 175, 80, 0.6);
        }

        .shop-item-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          background: rgba(20, 20, 20, 0.8);
          border: 1.5px solid rgba(255, 0, 255, 0.3);
          border-radius: 12px;
          margin-bottom: 12px;
          transition: all 0.3s;
        }

        .shop-item-row:hover {
          border-color: rgba(255, 0, 255, 0.6);
          box-shadow: 0 0 20px rgba(255, 0, 255, 0.2);
        }

        .item-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          min-width: 0;
        }

        .item-icon-small {
          font-size: 32px;
          flex-shrink: 0;
        }

        .item-details {
          flex: 1;
          min-width: 0;
        }

        .item-name {
          font-size: 11px;
          color: #00FFFF;
          margin-bottom: 4px;
        }

        .item-brief {
          font-size: 8px;
          color: #888;
        }

        .item-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .info-btn-small {
          background: rgba(0, 255, 255, 0.2);
          border: 1.5px solid #00FFFF;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #00FFFF;
          transition: all 0.3s;
          flex-shrink: 0;
        }

        .info-btn-small:hover {
          background: rgba(0, 255, 255, 0.4);
          transform: scale(1.1);
        }

        .item-price-small {
          font-size: 13px;
          color: #00FF00;
          text-shadow: 0 0 10px #00FF00;
          min-width: 50px;
          text-align: right;
        }

        .buy-btn-small {
          padding: 8px 14px;
          background: linear-gradient(135deg, #FFFF00, #FF00FF);
          border: none;
          border-radius: 8px;
          font-family: inherit;
          font-size: 9px;
          color: black;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s;
        }

        .buy-btn-small:active {
          transform: scale(0.95);
        }

        .buy-btn-small.btn-disabled,
        .buy-btn-small:disabled {
          background: #444;
          color: #888;
          cursor: not-allowed;
          box-shadow: none;
        }

        .shop-item-row.item-disabled {
          opacity: 0.7;
        }

        .buy-btn-small.btn-upgrade {
          background: linear-gradient(135deg, #FFA500, #FF6600);
          color: black;
          animation: pulse-upgrade 1.5s infinite;
          box-shadow: 0 0 15px rgba(255, 165, 0, 0.5);
        }

        @keyframes pulse-upgrade {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        .buy-btn-small.btn-premium {
          background: linear-gradient(135deg, #FFD700, #FFA500);
          color: black;
          box-shadow: 0 0 15px rgba(255, 215, 0, 0.5);
        }

        .buy-btn-small.btn-premium-active {
          background: linear-gradient(135deg, #00AA00, #008800);
          color: white;
          cursor: default;
          box-shadow: 0 0 15px rgba(0, 255, 0, 0.3);
        }

        .buy-btn-small.btn-energy {
          background: linear-gradient(135deg, #00FF00, #00CC00);
          color: black;
          box-shadow: 0 0 15px rgba(0, 255, 0, 0.5);
        }

        .shop-item-row.item-premium-active {
          background: rgba(0, 255, 0, 0.1);
          border-color: rgba(0, 255, 0, 0.3);
        }

        /* REFERRALS VIEW */
        .section-title {
          text-align: center;
          font-size: 15px;
          margin-bottom: 18px;
          background: linear-gradient(90deg, #FFFF00, #FF00FF);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .referral-card {
          background: rgba(20, 20, 20, 0.8);
          border: 2px solid #FF00FF;
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 18px;
        }

        .referral-label {
          font-size: 9px;
          color: #888;
          margin-bottom: 10px;
        }

        .referral-link-box {
          padding: 12px;
          background: black;
          border: 2px solid #00FFFF;
          border-radius: 8px;
          font-size: 8px;
          word-break: break-all;
          margin-bottom: 14px;
          color: #00FFFF;
          min-height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .action-btns {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
        }

        .action-btn {
          padding: 11px 8px;
          background: linear-gradient(135deg, #FFFF00, #FF00FF);
          border: none;
          border-radius: 8px;
          font-family: inherit;
          font-size: 8px;
          color: black;
          font-weight: bold;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
        }

        .action-btn:disabled {
          opacity: 0.5;
        }

        .action-btn-x {
          background: linear-gradient(135deg, #1DA1F2, #0077B5);
          color: white;
        }

        .action-btn-tg {
          background: linear-gradient(135deg, #0088cc, #229ED9);
          color: white;
        }

        .referral-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 18px;
        }

        .ref-stat {
          background: rgba(20, 20, 20, 0.8);
          border: 2px solid #FF00FF;
          border-radius: 10px;
          padding: 14px 10px;
          text-align: center;
        }

        .ref-stat-value {
          font-size: 22px;
          font-weight: bold;
          color: #888;
          margin-bottom: 7px;
        }

        .ref-stat-label {
          font-size: 7px;
          color: #666;
        }

        .referral-info-box {
          background: rgba(0, 255, 0, 0.1);
          border: 2px solid #00FF00;
          border-radius: 10px;
          padding: 14px;
        }

        .info-text {
          font-size: 9px;
          color: #00FF00;
          line-height: 1.6;
          text-align: center;
        }

        /* REFERRALS - BATTLE PASS FEATURES */
        .bp-required-notice {
          background: linear-gradient(135deg, rgba(255, 0, 255, 0.1), rgba(139, 0, 255, 0.1));
          border: 2px solid rgba(255, 0, 255, 0.5);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 18px;
          text-align: center;
        }

        .get-bp-btn {
          padding: 12px 20px;
          background: linear-gradient(135deg, #FF00FF, #8B00FF);
          border: none;
          border-radius: 10px;
          color: #fff;
          font-family: inherit;
          font-size: 10px;
          font-weight: bold;
          cursor: pointer;
          box-shadow: 0 0 20px rgba(255, 0, 255, 0.5);
          transition: all 0.3s;
        }

        .get-bp-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 0 30px rgba(255, 0, 255, 0.7);
        }

        .referral-code-box {
          background: rgba(20, 20, 20, 0.8);
          border: 2px solid #FFD700;
          border-radius: 10px;
          padding: 14px;
          margin-top: 18px;
          text-align: center;
        }

        .code-label {
          font-size: 8px;
          color: #888;
          margin-bottom: 8px;
        }

        .code-value {
          font-size: 18px;
          color: #FFD700;
          font-weight: bold;
          letter-spacing: 2px;
        }

        /* BOTTOM NAV - 5 tabs */
        .bottom-nav {
          height: 64px;
          background: rgba(10, 10, 10, 0.95);
          backdrop-filter: blur(10px);
          border-top: 2px solid #FF00FF;
          display: flex;
          justify-content: space-around;
          align-items: center;
          flex-shrink: 0;
          box-shadow: 0 -3px 15px rgba(255, 0, 255, 0.3);
        }

        .nav-btn {
          flex: 1;
          height: 100%;
          background: transparent;
          border: none;
          color: #666;
          font-family: inherit;
          font-size: 8px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          transition: all 0.3s;
          position: relative;
        }

        .nav-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: transparent;
          transition: background 0.3s;
        }

        .nav-btn-active {
          color: white;
        }

        .nav-btn-active::before {
          background: linear-gradient(90deg, #FF00FF, #00FFFF, #00FF00);
          box-shadow: 0 0 15px rgba(255, 0, 255, 0.8);
        }

        @media (max-width: 480px) {
          .mobile-container {
            max-width: 100%;
          }
        }

        @media (orientation: landscape) and (max-height: 600px) {
          .stats-simple {
            gap: 6px;
            margin-bottom: 8px;
          }

          .stat-box {
            padding: 6px 4px;
          }

          .stat-emoji {
            font-size: 18px;
            margin-bottom: 4px;
          }

          .stat-label {
            font-size: 5px;
          }

          .stat-value {
            font-size: 13px;
          }

          .pyramid-grid {
            grid-template-columns: repeat(9, 26px);
            grid-template-rows: repeat(5, 38px);
          }

          .pyramid-moai {
            font-size: 30px;
          }

          .level-badge {
            margin-top: 8px;
            padding: 6px 16px;
            font-size: 10px;
          }

          .tap-hint {
            margin-top: 6px;
            font-size: 9px;
          }

          .energy-bar-container {
            padding: 8px;
            margin-bottom: 8px;
          }
        }
      `}</style>
    </div>
  );
};

export default PyramidMemeEmpireV5;
