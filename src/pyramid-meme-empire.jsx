import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Zap, Trophy, ShoppingCart, Users, Crown, Gift } from 'lucide-react';

// ============================================================================
// PYRAMID MEME EMPIRE - TAP TO EARN GAME
// Web3 Degen Edition - Base Network
// ============================================================================

const PyramidMemeEmpire = () => {
  // ========== WALLET & WEB3 STATE ==========
  const [walletAddress, setWalletAddress] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // ========== GAME STATE ==========
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [energy, setEnergy] = useState(100);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [canTap, setCanTap] = useState(true);
  
  // ========== PREMIUM & BOOSTS ==========
  const [isPremium, setIsPremium] = useState(false);
  const [activeBoosts, setActiveBoosts] = useState({
    x2: null, // timestamp when expires
    x5: null,
  });
  const [hasBattlePass, setHasBattlePass] = useState(false);
  
  // ========== UI STATE ==========
  const [currentTab, setCurrentTab] = useState('game');
  const [tapAnimation, setTapAnimation] = useState(false);
  const [showXpGain, setShowXpGain] = useState(null);
  const [notification, setNotification] = useState(null);
  
  // ========== LEADERBOARD (MOCK DATA) ==========
  const [leaderboard, setLeaderboard] = useState([
    { address: '0x742d...4f2a', xp: 1250000, level: 45 },
    { address: '0x8c3a...9b1e', xp: 850000, level: 38 },
    { address: '0x1f9d...3c7b', xp: 620000, level: 32 },
    { address: '0x5e2a...8d4f', xp: 450000, level: 28 },
    { address: '0x9a7c...2e1d', xp: 320000, level: 24 },
  ]);

  // ========== LEVEL CALCULATION ==========
  const calculateLevelFromXP = (currentXp) => {
    let calculatedLevel = 1;
    while (calculateRequiredXP(calculatedLevel + 1) <= currentXp) {
      calculatedLevel++;
    }
    return calculatedLevel;
  };

  const calculateRequiredXP = (targetLevel) => {
    return Math.floor(100 * Math.pow(targetLevel, 1.5));
  };

  const getXPForNextLevel = () => {
    return calculateRequiredXP(level + 1);
  };

  const getXPProgress = () => {
    const currentLevelXP = calculateRequiredXP(level);
    const nextLevelXP = getXPForNextLevel();
    const progress = ((xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;
    return Math.max(0, Math.min(100, progress));
  };

  // ========== BOOST CALCULATIONS ==========
  const getActiveBoostMultiplier = () => {
    const now = Date.now();
    if (activeBoosts.x5 && activeBoosts.x5 > now) return 5;
    if (activeBoosts.x2 && activeBoosts.x2 > now) return 2;
    return 1;
  };

  const getBattlePassBonus = () => {
    return hasBattlePass ? 1.1 : 1;
  };

  const getXpPerTap = () => {
    const base = 1;
    const boostMultiplier = getActiveBoostMultiplier();
    const battlePassBonus = getBattlePassBonus();
    return Math.floor(base * boostMultiplier * battlePassBonus * 10) / 10;
  };

  // ========== WALLET CONNECTION ==========
  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        
        // Switch to Base network (Chain ID: 8453)
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }], // 8453 in hex
          });
        } catch (switchError) {
          // If Base is not added, add it
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x2105',
                chainName: 'Base',
                nativeCurrency: {
                  name: 'Ethereum',
                  symbol: 'ETH',
                  decimals: 18
                },
                rpcUrls: ['https://mainnet.base.org'],
                blockExplorerUrls: ['https://basescan.org']
              }]
            });
          }
        }
        
        setWalletAddress(accounts[0]);
        showNotification('🎉 Wallet Connected! Welcome Degen!', 'success');
      } else {
        showNotification('⚠️ Please install MetaMask or a Web3 wallet', 'error');
      }
    } catch (error) {
      console.error('Wallet connection error:', error);
      showNotification('❌ Connection failed. Try again.', 'error');
    }
    setIsConnecting(false);
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    showNotification('👋 Wallet disconnected', 'info');
  };

  // ========== TAP MECHANICS ==========
  const handleTap = () => {
    const now = Date.now();
    
    // Check if user is free and at level 3 limit
    if (!isPremium && level >= 3) {
      showNotification('🔒 Level 3 is max for free users. Upgrade to Premium!', 'warning');
      return;
    }
    
    // Check cooldown for free users
    if (!isPremium && (now - lastTapTime) < 2000) {
      setCanTap(false);
      return;
    }
    
    // Check energy for free users
    if (!isPremium && energy <= 0) {
      showNotification('⚡ No energy! Wait for refill or buy Energy Refill', 'warning');
      return;
    }
    
    // Execute tap
    const xpGained = getXpPerTap();
    setXp(prev => prev + xpGained);
    
    if (!isPremium) {
      setEnergy(prev => Math.max(0, prev - 1));
      setLastTapTime(now);
      setCanTap(false);
      setTimeout(() => setCanTap(true), 2000);
    }
    
    // Visual feedback
    setTapAnimation(true);
    setShowXpGain({ value: xpGained, id: Date.now() });
    setTimeout(() => setTapAnimation(false), 200);
    setTimeout(() => setShowXpGain(null), 1000);
  };

  // ========== ENERGY REGENERATION ==========
  useEffect(() => {
    if (isPremium) return;
    
    const interval = setInterval(() => {
      setEnergy(prev => Math.min(100, prev + 1));
    }, 30000); // 1 energy per 30 seconds
    
    return () => clearInterval(interval);
  }, [isPremium]);

  // ========== LEVEL UP CHECK ==========
  useEffect(() => {
    const newLevel = calculateLevelFromXP(xp);
    if (newLevel > level) {
      setLevel(newLevel);
      showNotification(`🎊 LEVEL UP! You're now Level ${newLevel}!`, 'success');
    }
  }, [xp, level]);

  // ========== BOOST EXPIRATION CHECK ==========
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setActiveBoosts(prev => ({
        x2: prev.x2 && prev.x2 > now ? prev.x2 : null,
        x5: prev.x5 && prev.x5 > now ? prev.x5 : null,
      }));
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // ========== SHOP FUNCTIONS ==========
  const purchaseItem = async (itemName, price) => {
    if (!walletAddress) {
      showNotification('⚠️ Connect wallet first!', 'warning');
      return;
    }
    
    // In production, this would interact with smart contract
    // For now, simulate purchase
    showNotification(`💳 Processing payment of $${price} USDC...`, 'info');
    
    setTimeout(() => {
      switch(itemName) {
        case 'premium':
          setIsPremium(true);
          setEnergy(100);
          showNotification('✨ Premium Activated! No limits, no cooldowns!', 'success');
          break;
        case 'boost-x2':
          setActiveBoosts(prev => ({
            ...prev,
            x2: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
          }));
          showNotification('🚀 2x Boost activated for 24 hours!', 'success');
          break;
        case 'boost-x5':
          setActiveBoosts(prev => ({
            ...prev,
            x5: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
          }));
          showNotification('🔥 5x Boost activated for 24 hours!', 'success');
          break;
        case 'energy-refill':
          setEnergy(100);
          showNotification('⚡ Energy refilled to 100!', 'success');
          break;
        case 'battle-pass':
          setHasBattlePass(true);
          showNotification('👑 Battle Pass activated! +10% XP + Exclusive NFT!', 'success');
          break;
      }
    }, 2000);
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // ========== SHOP ITEMS ==========
  const shopItems = [
    {
      id: 'premium',
      name: 'Premium Activation',
      price: 2,
      description: 'Unlock all levels + Remove cooldown',
      icon: '👑',
      disabled: isPremium,
    },
    {
      id: 'boost-x2',
      name: 'Boost x2',
      price: 0.50,
      description: '2x XP for 24 hours',
      icon: '⚡',
      disabled: activeBoosts.x2 && activeBoosts.x2 > Date.now(),
    },
    {
      id: 'boost-x5',
      name: 'Boost x5',
      price: 1.50,
      description: '5x XP for 24 hours',
      icon: '🔥',
      disabled: activeBoosts.x5 && activeBoosts.x5 > Date.now(),
    },
    {
      id: 'energy-refill',
      name: 'Energy Refill',
      price: 0.25,
      description: '+100 Energy instantly',
      icon: '🔋',
      disabled: isPremium || energy === 100,
    },
    {
      id: 'battle-pass',
      name: 'Battle Pass',
      price: 5,
      description: 'All boosts + NFT + 10% XP',
      icon: '🎁',
      disabled: hasBattlePass,
    },
  ];

  // ========== RENDER ==========
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-blue-900 text-white font-mono relative overflow-hidden">
      {/* Animated Background Grid */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(139, 92, 246, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          animation: 'grid-move 20s linear infinite'
        }}/>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-2xl border-2 animate-slide-in ${
          notification.type === 'success' ? 'bg-green-500 border-green-300' :
          notification.type === 'error' ? 'bg-red-500 border-red-300' :
          notification.type === 'warning' ? 'bg-yellow-500 border-yellow-300' :
          'bg-blue-500 border-blue-300'
        }`}>
          <p className="font-bold text-sm">{notification.message}</p>
        </div>
      )}

      {/* Header */}
      <header className="relative z-10 border-b-2 border-purple-500 bg-black/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-blue-500">
              PYRAMID MEME EMPIRE
            </h1>
            <p className="text-xs text-purple-300 mt-1">Stack Memes. Build Empires. Earn $PME.</p>
          </div>
          
          {walletAddress ? (
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-purple-600 rounded-lg border-2 border-purple-400">
                <p className="text-xs text-purple-200">Connected</p>
                <p className="font-bold text-sm">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</p>
              </div>
              <button 
                onClick={disconnectWallet}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg border-2 border-red-400 transition-all"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button 
              onClick={connectWallet}
              disabled={isConnecting}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg border-2 border-purple-400 font-bold transition-all transform hover:scale-105 disabled:opacity-50"
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="relative z-10 bg-black/30 border-b border-purple-500/30">
        <div className="container mx-auto px-4">
          <div className="flex gap-1">
            {[
              { id: 'game', label: 'GAME', icon: Zap },
              { id: 'shop', label: 'SHOP', icon: ShoppingCart },
              { id: 'leaderboard', label: 'LEADERBOARD', icon: Trophy },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 font-bold transition-all ${
                  currentTab === tab.id 
                    ? 'bg-purple-600 border-t-4 border-purple-400' 
                    : 'bg-transparent hover:bg-purple-900/50'
                }`}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-4 py-8">
        
        {/* GAME TAB */}
        {currentTab === 'game' && (
          <div className="max-w-4xl mx-auto">
            
            {/* Player Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-gradient-to-br from-purple-800/50 to-purple-900/50 border-2 border-purple-500 rounded-xl p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-purple-300 text-sm">LEVEL</p>
                  {isPremium && <Crown className="text-yellow-400" size={20} />}
                </div>
                <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                  {level}
                </p>
                {!isPremium && level >= 3 && (
                  <p className="text-xs text-red-400 mt-2">⚠️ Free Max Reached</p>
                )}
              </div>

              <div className="bg-gradient-to-br from-blue-800/50 to-blue-900/50 border-2 border-blue-500 rounded-xl p-6 backdrop-blur-sm">
                <p className="text-blue-300 text-sm mb-2">XP</p>
                <p className="text-3xl font-black">{xp.toLocaleString()}</p>
                <div className="mt-3 bg-black/50 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-400 to-purple-500 transition-all duration-300"
                    style={{ width: `${getXPProgress()}%` }}
                  />
                </div>
                <p className="text-xs text-blue-300 mt-1">
                  {getXPForNextLevel() - xp} XP to Level {level + 1}
                </p>
              </div>

              {!isPremium && (
                <div className="bg-gradient-to-br from-green-800/50 to-green-900/50 border-2 border-green-500 rounded-xl p-6 backdrop-blur-sm">
                  <p className="text-green-300 text-sm mb-2">ENERGY</p>
                  <p className="text-3xl font-black">{energy}/100</p>
                  <div className="mt-3 bg-black/50 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-300"
                      style={{ width: `${energy}%` }}
                    />
                  </div>
                  <p className="text-xs text-green-300 mt-1">
                    +1 every 30 seconds
                  </p>
                </div>
              )}
              
              {isPremium && (
                <div className="bg-gradient-to-br from-yellow-800/50 to-yellow-900/50 border-2 border-yellow-500 rounded-xl p-6 backdrop-blur-sm">
                  <p className="text-yellow-300 text-sm mb-2 flex items-center gap-2">
                    <Crown size={16} />
                    PREMIUM ACTIVE
                  </p>
                  <p className="text-xl font-black">∞ ENERGY</p>
                  <p className="text-xs text-yellow-300 mt-2">No limits. No cooldowns.</p>
                </div>
              )}
            </div>

            {/* Active Boosts */}
            {(activeBoosts.x2 || activeBoosts.x5 || hasBattlePass) && (
              <div className="mb-8 p-4 bg-gradient-to-r from-orange-900/50 to-red-900/50 border-2 border-orange-500 rounded-xl backdrop-blur-sm">
                <p className="text-sm font-bold mb-2 text-orange-300">🔥 ACTIVE BOOSTS:</p>
                <div className="flex flex-wrap gap-3">
                  {activeBoosts.x5 && activeBoosts.x5 > Date.now() && (
                    <div className="px-3 py-1 bg-red-600 rounded-full text-sm font-bold">
                      5x BOOST
                    </div>
                  )}
                  {activeBoosts.x2 && activeBoosts.x2 > Date.now() && (
                    <div className="px-3 py-1 bg-orange-600 rounded-full text-sm font-bold">
                      2x BOOST
                    </div>
                  )}
                  {hasBattlePass && (
                    <div className="px-3 py-1 bg-purple-600 rounded-full text-sm font-bold flex items-center gap-1">
                      <Crown size={14} />
                      BATTLE PASS +10%
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tap Area */}
            <div className="relative">
              <div className="text-center mb-6">
                <p className="text-2xl font-black text-purple-300 mb-2">
                  {getXpPerTap()} XP PER TAP
                </p>
                {!isPremium && !canTap && (
                  <p className="text-sm text-yellow-400 animate-pulse">⏳ Cooldown: 2s</p>
                )}
              </div>

              {/* Tap Button */}
              <div className="relative flex justify-center items-center" style={{ height: '400px' }}>
                {showXpGain && (
                  <div 
                    key={showXpGain.id}
                    className="absolute top-0 text-4xl font-black text-green-400 animate-float-up pointer-events-none"
                    style={{ left: '50%', transform: 'translateX(-50%)' }}
                  >
                    +{showXpGain.value}
                  </div>
                )}

                <button
                  onClick={handleTap}
                  disabled={!walletAddress || (!isPremium && (!canTap || energy <= 0))}
                  className={`relative w-64 h-64 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                    tapAnimation ? 'scale-90' : 'scale-100'
                  }`}
                  style={{
                    background: 'radial-gradient(circle, rgba(168,85,247,1) 0%, rgba(124,58,237,1) 50%, rgba(88,28,135,1) 100%)',
                    boxShadow: tapAnimation 
                      ? '0 0 60px rgba(168,85,247,0.8), inset 0 0 40px rgba(0,0,0,0.5)'
                      : '0 0 40px rgba(168,85,247,0.6), inset 0 0 20px rgba(0,0,0,0.3)',
                    border: '6px solid rgba(168,85,247,0.5)'
                  }}
                >
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-8xl mb-2 animate-pulse">🔺</div>
                    <p className="text-2xl font-black tracking-wider">TAP</p>
                  </div>
                </button>
              </div>

              {!walletAddress && (
                <div className="text-center mt-8">
                  <p className="text-yellow-400 text-sm">⚠️ Connect your wallet to start playing</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SHOP TAB */}
        {currentTab === 'shop' && (
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-black mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
              💎 POWER-UP SHOP
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {shopItems.map(item => (
                <div 
                  key={item.id}
                  className={`bg-gradient-to-br from-purple-900/50 to-black border-2 rounded-xl p-6 backdrop-blur-sm transition-all hover:scale-105 ${
                    item.disabled 
                      ? 'border-gray-600 opacity-50' 
                      : 'border-purple-500 hover:border-pink-500'
                  }`}
                >
                  <div className="text-6xl mb-4">{item.icon}</div>
                  <h3 className="text-xl font-bold mb-2">{item.name}</h3>
                  <p className="text-sm text-gray-300 mb-4">{item.description}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-black text-green-400">
                      ${item.price} USDC
                    </p>
                    <button
                      onClick={() => purchaseItem(item.id, item.price)}
                      disabled={item.disabled || !walletAddress}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {item.disabled ? 'OWNED' : 'BUY'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {!walletAddress && (
              <div className="mt-8 p-6 bg-yellow-900/30 border-2 border-yellow-500 rounded-xl text-center">
                <AlertCircle className="mx-auto mb-2 text-yellow-400" size={32} />
                <p className="text-yellow-400 font-bold">Connect your wallet to purchase items</p>
              </div>
            )}
          </div>
        )}

        {/* LEADERBOARD TAB */}
        {currentTab === 'leaderboard' && (
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-black mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
              🏆 TOP PYRAMID BUILDERS
            </h2>
            
            <div className="space-y-3">
              {leaderboard.map((player, index) => (
                <div 
                  key={player.address}
                  className={`flex items-center justify-between p-5 rounded-xl border-2 backdrop-blur-sm transition-all hover:scale-102 ${
                    index === 0 ? 'bg-gradient-to-r from-yellow-900/50 to-orange-900/50 border-yellow-500' :
                    index === 1 ? 'bg-gradient-to-r from-gray-700/50 to-gray-800/50 border-gray-400' :
                    index === 2 ? 'bg-gradient-to-r from-orange-900/50 to-orange-800/50 border-orange-600' :
                    'bg-purple-900/30 border-purple-700'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`text-3xl font-black ${
                      index === 0 ? 'text-yellow-400' :
                      index === 1 ? 'text-gray-300' :
                      index === 2 ? 'text-orange-500' :
                      'text-purple-400'
                    }`}>
                      #{index + 1}
                    </div>
                    <div>
                      <p className="font-bold text-lg">{player.address}</p>
                      <p className="text-sm text-gray-400">Level {player.level}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                      {player.xp.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400">XP</p>
                  </div>
                </div>
              ))}
            </div>

            {walletAddress && (
              <div className="mt-8 p-6 bg-gradient-to-r from-blue-900/50 to-purple-900/50 border-2 border-blue-500 rounded-xl">
                <p className="text-sm text-blue-300 mb-2">YOUR RANK</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-black">#{leaderboard.length + 1}</p>
                    <p className="text-sm text-gray-400">Level {level}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                      {xp.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400">XP</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 mt-16 border-t-2 border-purple-500 bg-black/50 backdrop-blur-sm py-6">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-purple-300 mb-2">
            Powered by Base Network | Built for Degens
          </p>
          <p className="text-xs text-gray-500">
            Contract: 0x... (Coming Soon) | Not Financial Advice
          </p>
        </div>
      </footer>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes grid-move {
          0% { transform: translateY(0); }
          100% { transform: translateY(50px); }
        }

        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes float-up {
          0% {
            transform: translate(-50%, 0);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -100px);
            opacity: 0;
          }
        }

        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }

        .animate-float-up {
          animation: float-up 1s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default PyramidMemeEmpire;
