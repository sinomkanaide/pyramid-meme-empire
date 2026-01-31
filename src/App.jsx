import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Copy, Share2, Users, ShoppingBag, Gamepad2, Trophy, Zap, Info } from 'lucide-react';
import { useWalletAuth, useGame } from './hooks';

// ============================================================================
// PYRAMID MEME EMPIRE V5 - WITH BACKEND INTEGRATION
// ============================================================================

function App() {
  // ========== AUTH & GAME HOOKS ==========
  const { user, isAuthenticated, isLoading: authLoading, connectWallet, error: authError } = useWalletAuth();
  const { progress, leaderboard: backendLeaderboard, tap, claim, fetchLeaderboard } = useGame(isAuthenticated);

  // ========== LOCAL UI STATE ==========
  const [isConnecting, setIsConnecting] = useState(false);
  const [displayBricks, setDisplayBricks] = useState(0);
  const [currentTab, setCurrentTab] = useState('game');
  const [particles, setParticles] = useState([]);
  const [floatingCoins, setFloatingCoins] = useState([]);
  const [notification, setNotification] = useState(null);
  const [pyramidPulse, setPyramidPulse] = useState(false);
  const [showFireworks, setShowFireworks] = useState(false);
  const [referralLink, setReferralLink] = useState('');
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [localLeaderboard, setLocalLeaderboard] = useState([]);

  const [quests] = useState([
    { id: 1, title: 'Follow on X', description: 'Follow @PyramidMeme', reward: 'TBA', completed: false, icon: '🐦' },
    { id: 2, title: 'Like Post', description: 'Like pinned post', reward: 'TBA', completed: false, icon: '❤️' },
    { id: 3, title: 'Retweet', description: 'RT announcement', reward: 'TBA', completed: false, icon: '🔄' },
    { id: 4, title: 'Join Telegram', description: 'Join community', reward: 'TBA', completed: true, icon: '💬' },
    { id: 5, title: 'Stack 100', description: 'Tap 100 times', reward: 'TBA', completed: false, icon: '🧱' },
  ]);

  const coinSounds = useRef([]);
  const levelUpSound = useRef(null);
  const whooshSound = useRef(null);
  const memecoins = ['doge', 'shib', 'pepe', 'wojak', 'btc', 'eth'];

  // Sync leaderboard
  useEffect(() => {
    if (backendLeaderboard?.length > 0) {
      setLocalLeaderboard(backendLeaderboard.map((p, i) => ({
        rank: i + 1,
        name: p.username || `${p.address?.slice(0, 6)}...`,
        taps: p.bricks,
        level: `${p.level}L`,
      })));
    }
  }, [backendLeaderboard]);

  // Floating coins
  useEffect(() => {
    setFloatingCoins(Array.from({ length: 8 }, (_, i) => ({
      id: i, coin: memecoins[Math.floor(Math.random() * memecoins.length)],
      x: Math.random() * 100, y: Math.random() * 100,
      speed: 10 + Math.random() * 15, size: 30 + Math.random() * 30,
    })));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setFloatingCoins(coins => coins.map(c => ({ ...c, y: c.y >= 100 ? -10 : c.y + (c.speed * 0.05) })));
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Number animation
  useEffect(() => {
    if (displayBricks !== progress.bricks) {
      const diff = progress.bricks - displayBricks;
      const inc = Math.ceil(Math.abs(diff) / 10) * Math.sign(diff);
      const timer = setTimeout(() => {
        setDisplayBricks(prev => diff > 0 ? Math.min(prev + inc, progress.bricks) : Math.max(prev + inc, progress.bricks));
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [progress.bricks, displayBricks]);

  // Referral link
  useEffect(() => {
    if (user?.walletAddress) {
      const refCode = user.referralCode || user.walletAddress.slice(2, 12).toUpperCase();
      setReferralLink(`${window.location.origin}?ref=${refCode}`);
    }
  }, [user]);

  // Connect wallet
  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      await connectWallet(urlParams.get('ref'));
      playWhoosh();
      showMsg('🎉 WELCOME!');
    } catch (err) {
      showMsg('❌ ' + (err.message || 'FAILED'));
    } finally {
      setIsConnecting(false);
    }
  };

  // Tap
  const handleTap = async () => {
    if (!isAuthenticated) { showMsg('⚠️ CONNECT WALLET'); return; }
    if (!progress.isPremium && progress.energy <= 0) { showMsg('⚡ NO ENERGY!'); return; }
    try {
      const result = await tap();
      setPyramidPulse(true);
      setTimeout(() => setPyramidPulse(false), 300);
      playCoinSound();
      createParticles(5);
      if (result?.leveledUp) triggerLevelUp(result.newLevel);
    } catch (err) {
      if (err.message?.includes('cooldown')) showMsg('⏳ WAIT...');
      else if (err.message?.includes('energy')) showMsg('⚡ NO ENERGY!');
    }
  };

  // Claim
  const handleClaim = async () => {
    if (!isAuthenticated || progress.bricks < 100) { showMsg('⚠️ NEED 100+ BRICKS'); return; }
    try {
      const result = await claim();
      showMsg(`💰 CLAIMED ${result.tokensClaimed} $PME!`);
      playWhoosh();
    } catch { showMsg('❌ CLAIM FAILED'); }
  };

  // Particles
  const createParticles = (count) => {
    const newP = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i, x: 45 + Math.random() * 10, y: 50,
      vx: (Math.random() - 0.5) * 4, vy: -5 - Math.random() * 3,
      rotation: Math.random() * 360,
      emoji: ['💎', '🚀', '🔥', '⚡', '💰', '🗿'][Math.floor(Math.random() * 6)],
    }));
    setParticles(prev => [...prev, ...newP]);
    setTimeout(() => setParticles(prev => prev.filter(p => !newP.find(np => np.id === p.id))), 2000);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setParticles(ps => ps.map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.2, rotation: p.rotation + 10 })));
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Level up
  const triggerLevelUp = (lvl) => {
    playLevelUp();
    showMsg(`🎊 LEVEL ${lvl}!`);
    setShowFireworks(true);
    setTimeout(() => setShowFireworks(false), 3000);
    createParticles(30);
  };

  // Audio
  const playCoinSound = () => { try { const s = coinSounds.current[Math.floor(Math.random() * 3)]; if (s) { s.currentTime = 0; s.play().catch(() => {}); } } catch {} };
  const playLevelUp = () => { try { if (levelUpSound.current) { levelUpSound.current.currentTime = 0; levelUpSound.current.play().catch(() => {}); } } catch {} };
  const playWhoosh = () => { try { if (whooshSound.current) { whooshSound.current.currentTime = 0; whooshSound.current.play().catch(() => {}); } } catch {} };

  // Notification
  const showMsg = (msg) => { setNotification(msg); setTimeout(() => setNotification(null), 3000); };

  // Share
  const shareX = () => { window.open(`https://x.com/intent/tweet?text=${encodeURIComponent('Building my 🗿 PyramidMeme Empire! ' + referralLink)}`, '_blank'); playWhoosh(); };
  const shareTG = () => { window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('Join PyramidMeme!')}`, '_blank'); playWhoosh(); };
  const copyLink = () => { navigator.clipboard.writeText(referralLink); showMsg('📋 COPIED!'); playWhoosh(); };

  // Pyramid
  const renderPyramid = () => {
    const rows = Math.min(Math.floor(progress.bricks / 6) + 1, 6);
    let moais = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c <= r; c++) {
        moais.push(<div key={`${r}-${c}`} className="moai" style={{ gridRow: r + 1, gridColumn: `${6 - r + c * 2} / span 2` }}>🗿</div>);
      }
    }
    return moais;
  };

  const displayLB = localLeaderboard.length > 0 ? localLeaderboard : [
    { rank: 1, name: 'CryptoKing', taps: 8934, level: '23L' },
    { rank: 2, name: 'TapMaster', taps: 7821, level: '19L' },
    { rank: 3, name: 'MoaiLord', taps: 7456, level: '17L' },
    { rank: 4, name: 'SpeedTap', taps: 6892, level: '14L' },
    { rank: 5, name: 'PyramidPro', taps: 6234, level: '12L' },
  ];

  return (
    <div className="container">
      <audio ref={el => coinSounds.current[0] = el} src="/sounds/coin-1.wav" preload="auto" />
      <audio ref={el => coinSounds.current[1] = el} src="/sounds/coin-2.wav" preload="auto" />
      <audio ref={el => coinSounds.current[2] = el} src="/sounds/coin-3.wav" preload="auto" />
      <audio ref={levelUpSound} src="/sounds/levelup.wav" preload="auto" />
      <audio ref={whooshSound} src="/sounds/whoosh.wav" preload="auto" />

      <div className="bg">{floatingCoins.map(c => <img key={c.id} src={`/coins/${c.coin}.png`} alt="" className="coin" style={{ left: `${c.x}%`, top: `${c.y}%`, width: c.size, height: c.size }} />)}</div>
      {particles.map(p => <div key={p.id} className="particle" style={{ left: `${p.x}%`, top: `${p.y}%`, transform: `rotate(${p.rotation}deg)` }}>{p.emoji}</div>)}
      {showFireworks && <div className="fireworks">{[...Array(8)].map((_, i) => <div key={i} className="fw" style={{ '--i': i }} />)}</div>}
      {notification && <div className="notif">{notification}</div>}

      <header>
        <div className="hdr">
          <div><h1>PYRAMIDMEME</h1><p className="sub">STACK 🗿 BUILD EMPIRES</p></div>
          {isAuthenticated && user ? (
            <div className="wallet"><p className="wlbl">{progress.isPremium ? '👑 PREMIUM' : 'CONNECTED'}</p><p className="waddr">{user.walletAddress?.slice(0, 6)}...{user.walletAddress?.slice(-4)}</p></div>
          ) : (
            <button onClick={handleConnect} disabled={isConnecting || authLoading} className="btn">{isConnecting ? 'CONNECTING...' : 'CONNECT WALLET'}</button>
          )}
        </div>
      </header>

      <nav className="tabs">
        {[{ id: 'game', l: 'GAME', i: <Gamepad2 size={14} /> }, { id: 'arena', l: 'ARENA', i: <Trophy size={14} /> }, { id: 'quests', l: 'QUESTS', i: <Zap size={14} /> }, { id: 'shop', l: 'SHOP', i: <ShoppingBag size={14} /> }, { id: 'refs', l: 'REFS', i: <Users size={14} /> }].map(t => (
          <button key={t.id} onClick={() => { setCurrentTab(t.id); playWhoosh(); }} className={`tab ${currentTab === t.id ? 'active' : ''}`}>{t.i}<span>{t.l}</span></button>
        ))}
      </nav>

      <main>
        {currentTab === 'game' && (
          <div className="game">
            <div className="stats">
              <div className="stat"><span className="si">💎</span><span className="sl">BRICKS</span><span className="sv green">{displayBricks}</span></div>
              <div className="stat"><span className="si">🏆</span><span className="sl">LEVEL</span><span className="sv yellow">{progress.level}</span></div>
              <div className="stat"><span className="si">💰</span><span className="sl">$PME</span><span className="sv purple">TBA</span></div>
              <div className="stat"><span className="si">👥</span><span className="sl">RANK</span><span className="sv cyan">#{progress.rank || '?'}</span></div>
            </div>
            {!progress.isPremium && <div className="energy"><div className="ebar"><div className="efill" style={{ width: `${progress.energy}%` }} /></div><span>⚡ {progress.energy}/100</span></div>}
            <div className="pyramid"><div className={`pgrid ${pyramidPulse ? 'pulse' : ''}`}>{renderPyramid()}</div><div className="lvl">LEVEL {progress.level}</div></div>
            <button onClick={handleTap} disabled={!isAuthenticated || (!progress.isPremium && progress.energy <= 0)} className="tapbtn"><span className="te">👆</span><span>TAP TO STACK</span></button>
            <div className="prog"><div className="pbar"><div className="pfill" style={{ width: `${progress.bricks % 100}%` }} /></div><span>{progress.bricks % 100}/100</span></div>
            <button onClick={handleClaim} disabled={progress.bricks < 100} className="claim">💰 CLAIM $PME (TBA)</button>
            {!isAuthenticated && <p className="demo">CONNECT WALLET TO PLAY</p>}
          </div>
        )}

        {currentTab === 'arena' && (
          <div className="arena">
            <h2>🏆 LEADERBOARD</h2>
            <div className="lb">{displayLB.map((p, i) => <div key={i} className={`lbr ${i < 3 ? 'top' : ''}`}><span className="r">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${p.rank}`}</span><span className="n">{p.name}</span><span className="t">{p.taps.toLocaleString()}</span><span className="l">{p.level}</span></div>)}</div>
            {isAuthenticated && <div className="ur"><span>YOUR RANK</span><span>#{progress.rank || '?'}</span></div>}
          </div>
        )}

        {currentTab === 'quests' && (
          <div className="quests">
            <h2>⚡ DAILY QUESTS</h2>
            {quests.map(q => <div key={q.id} className={`qc ${q.completed ? 'done' : ''}`}><span className="qi">{q.icon}</span><div className="qinfo"><h3>{q.title}</h3><p>{q.description}</p></div><span className="qr">{q.reward}</span><button className="qb" disabled={q.completed}>{q.completed ? '✓' : 'GO'}</button></div>)}
          </div>
        )}

        {currentTab === 'shop' && (
          <div className="shop">
            <h2>🛒 POWER-UP SHOP</h2>
            <div className="sg">{[{ n: 'PREMIUM', p: '$2', i: '👑', d: 'UNLIMITED + NO COOLDOWN' }, { n: 'BOOST X2', p: '$0.50', i: '⚡', d: '2X BRICKS 24H' }, { n: 'BOOST X5', p: '$1.50', i: '🔥', d: '5X BRICKS 24H' }].map(it => (
              <div key={it.n} className="sc"><button className="ib" onClick={() => setActiveTooltip(activeTooltip === it.n ? null : it.n)}><Info size={12} /></button>{activeTooltip === it.n && <div className="tt">{it.d}</div>}<span className="sci">{it.i}</span><h3>{it.n}</h3><p>{it.p} USDC</p><button className="sbb">BUY</button></div>
            ))}</div>
          </div>
        )}

        {currentTab === 'refs' && (
          <div className="refs">
            <h2>👥 REFERRALS</h2>
            <p className="rd">Invite friends. Get <span className="hl">+10% boost</span> per activated referral!</p>
            <div className="rlb"><p className="rl">{referralLink || 'CONNECT WALLET'}</p><button onClick={copyLink} disabled={!referralLink} className="cb"><Copy size={14} /></button></div>
            <div className="shr"><button onClick={shareX} disabled={!referralLink} className="sb tw"><Share2 size={14} /> X</button><button onClick={shareTG} disabled={!referralLink} className="sb tg"><Share2 size={14} /> TG</button></div>
          </div>
        )}
      </main>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        .container{min-height:100vh;background:#0a0a0a;color:#fff;font-family:'Press Start 2P',monospace;position:relative;overflow-x:hidden}
        .bg{position:fixed;inset:0;pointer-events:none;z-index:0}
        .coin{position:absolute;opacity:.15;filter:drop-shadow(0 0 10px rgba(255,0,255,.5))}
        .particle{position:fixed;font-size:20px;pointer-events:none;z-index:100}
        .notif{position:fixed;top:20px;right:20px;padding:12px 20px;background:linear-gradient(135deg,#f0f,#0ff);border:2px solid #ff0;border-radius:8px;font-size:10px;z-index:1000;animation:slideIn .3s}
        @keyframes slideIn{from{transform:translateX(100%);opacity:0}}
        header{position:relative;z-index:10;border-bottom:2px solid #f0f;background:rgba(10,10,10,.95)}
        .hdr{max-width:800px;margin:0 auto;padding:12px 15px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px}
        h1{font-size:16px;background:linear-gradient(90deg,#f0f,#0ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .sub{font-size:7px;color:#666;margin-top:4px}
        .wallet{padding:8px 12px;background:rgba(255,0,255,.1);border:1px solid #f0f;border-radius:6px;text-align:right}
        .wlbl{font-size:7px;color:#f0f}
        .waddr{font-size:9px;margin-top:2px}
        .btn{padding:10px 16px;background:linear-gradient(135deg,#f0f,#0ff);border:2px solid #ff0;border-radius:6px;color:#000;font-family:inherit;font-size:9px;cursor:pointer}
        .btn:disabled{opacity:.5;cursor:not-allowed}
        .tabs{display:flex;justify-content:space-around;background:rgba(20,20,20,.95);border-bottom:1px solid #333;position:sticky;top:0;z-index:10}
        .tab{flex:1;padding:10px 4px;background:none;border:none;color:#666;font-family:inherit;font-size:7px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px}
        .tab:hover{color:#fff}
        .tab.active{color:#0ff;border-bottom:2px solid #0ff}
        main{max-width:800px;margin:0 auto;padding:15px;position:relative;z-index:5}
        h2{font-size:12px;text-align:center;margin-bottom:15px;background:linear-gradient(90deg,#f0f,#0ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:15px}
        .stat{padding:10px 6px;background:rgba(20,20,20,.8);border:1px solid #f0f;border-radius:6px;text-align:center;display:flex;flex-direction:column;gap:4px}
        .si{font-size:16px}
        .sl{font-size:6px;color:#888}
        .sv{font-size:14px}
        .green{color:#0f0;text-shadow:0 0 8px #0f0}
        .yellow{color:#ff0;text-shadow:0 0 8px #ff0}
        .purple{color:#f0f;text-shadow:0 0 8px #f0f}
        .cyan{color:#0ff;text-shadow:0 0 8px #0ff}
        .energy{margin-bottom:15px;display:flex;align-items:center;gap:10px}
        .ebar{flex:1;height:6px;background:#333;border-radius:3px;overflow:hidden}
        .efill{height:100%;background:linear-gradient(90deg,#ff0,#f80);transition:width .3s}
        .energy span{font-size:8px;color:#ff0}
        .pyramid{min-height:200px;display:flex;flex-direction:column;align-items:center;justify-content:center;margin-bottom:15px}
        .pgrid{display:grid;grid-template-columns:repeat(11,22px);grid-template-rows:repeat(6,35px);gap:2px;justify-content:center}
        .pgrid.pulse{animation:pulse .3s}
        @keyframes pulse{50%{transform:scale(1.1)}}
        .moai{font-size:28px;text-align:center;filter:drop-shadow(0 0 5px rgba(255,0,255,.5))}
        .lvl{margin-top:12px;padding:6px 16px;background:linear-gradient(135deg,#ff0,#f0f);border-radius:15px;font-size:9px;color:#000}
        .tapbtn{width:100%;padding:20px;background:linear-gradient(135deg,#f0f,#0ff);border:3px solid #0f0;border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px;font-family:inherit}
        .tapbtn:disabled{opacity:.5;cursor:not-allowed}
        .te{font-size:32px}
        .tapbtn span:last-child{font-size:12px;color:#000}
        .prog{margin:15px 0;display:flex;align-items:center;gap:10px}
        .pbar{flex:1;height:10px;background:#222;border:1px solid #f0f;border-radius:5px;overflow:hidden}
        .pfill{height:100%;background:linear-gradient(90deg,#0f0,#ff0,#f0f);transition:width .3s}
        .prog span{font-size:8px;color:#888}
        .claim{width:100%;padding:12px;background:linear-gradient(135deg,#0f0,#0ff);border:2px solid #ff0;border-radius:8px;font-family:inherit;font-size:10px;color:#000;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}
        .claim:disabled{opacity:.5;cursor:not-allowed}
        .demo{text-align:center;font-size:7px;color:#666;margin-top:10px}
        .lb{background:rgba(20,20,20,.8);border:1px solid #f0f;border-radius:8px;overflow:hidden}
        .lbr{display:flex;align-items:center;padding:10px 12px;border-bottom:1px solid #333;gap:8px}
        .lbr.top{background:rgba(255,215,0,.1)}
        .r{width:25px;font-size:10px}
        .n{flex:1;font-size:8px;color:#0ff}
        .t{font-size:8px;color:#0f0}
        .l{font-size:8px;color:#f0f;width:35px;text-align:right}
        .ur{margin-top:12px;padding:12px;background:rgba(255,0,255,.1);border:1px solid #f0f;border-radius:8px;display:flex;justify-content:space-between;font-size:10px}
        .ur span:last-child{color:#0ff;font-size:14px}
        .qc{display:flex;align-items:center;gap:10px;padding:12px;background:rgba(20,20,20,.8);border:1px solid #f0f;border-radius:8px;margin-bottom:8px}
        .qc.done{opacity:.6;border-color:#0f0}
        .qi{font-size:20px}
        .qinfo{flex:1}
        .qinfo h3{font-size:9px;margin-bottom:4px}
        .qinfo p{font-size:7px;color:#888}
        .qr{font-size:9px;color:#ff0}
        .qb{padding:6px 12px;background:linear-gradient(135deg,#f0f,#0ff);border:none;border-radius:4px;font-family:inherit;font-size:7px;color:#000;cursor:pointer}
        .qb:disabled{background:#333;color:#0f0}
        .sg{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}
        .sc{position:relative;padding:15px 12px;background:rgba(20,20,20,.8);border:1px solid #f0f;border-radius:8px;text-align:center}
        .ib{position:absolute;top:8px;right:8px;background:none;border:1px solid #888;border-radius:50%;width:18px;height:18px;color:#888;cursor:pointer;display:flex;align-items:center;justify-content:center}
        .tt{position:absolute;top:30px;right:4px;background:#222;border:1px solid #0ff;padding:6px;border-radius:4px;font-size:7px;z-index:10;white-space:nowrap}
        .sci{font-size:32px;display:block;margin-bottom:8px}
        .sc h3{font-size:9px;margin-bottom:8px;color:#0ff}
        .sc p{font-size:10px;color:#0f0;margin-bottom:12px}
        .sbb{width:100%;padding:8px;background:linear-gradient(135deg,#ff0,#f0f);border:none;border-radius:4px;font-family:inherit;font-size:8px;color:#000;cursor:pointer}
        .rd{text-align:center;font-size:9px;color:#888;margin-bottom:15px;line-height:1.5}
        .hl{color:#0f0}
        .rlb{display:flex;gap:8px;margin-bottom:15px}
        .rl{flex:1;padding:10px;background:#111;border:1px solid #0ff;border-radius:6px;font-size:7px;color:#0ff;word-break:break-all}
        .cb{padding:10px 12px;background:linear-gradient(135deg,#ff0,#f0f);border:none;border-radius:6px;cursor:pointer}
        .cb:disabled{opacity:.5}
        .shr{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .sb{padding:10px;border:none;border-radius:6px;font-family:inherit;font-size:8px;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}
        .sb:disabled{opacity:.5}
        .tw{background:linear-gradient(135deg,#1da1f2,#0077b5)}
        .tg{background:linear-gradient(135deg,#0088cc,#229ed9)}
        .fireworks{position:fixed;inset:0;pointer-events:none;z-index:99}
        .fw{position:absolute;width:4px;height:4px;background:#f0f;border-radius:50%;left:50%;top:50%;animation:explode 1s ease-out forwards}
        @keyframes explode{to{transform:translate(calc(cos(calc(var(--i)*45deg))*120px),calc(sin(calc(var(--i)*45deg))*120px));opacity:0}}
        @media(max-width:500px){.stats{grid-template-columns:repeat(2,1fr)}.sv{font-size:12px}.pgrid{grid-template-columns:repeat(11,18px);grid-template-rows:repeat(6,28px)}.moai{font-size:22px}}
      `}</style>
    </div>
  );
}

export default App;
