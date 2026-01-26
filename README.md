# 🔺 PyramidMeme Empire - Tap to Earn on Base

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Base Network](https://img.shields.io/badge/network-Base-blue)
![Built with React](https://img.shields.io/badge/built%20with-React-61DAFB)

**Stack Memes. Build Empires. Earn $PME.**

A Web3 tap-to-earn game built on Base Network with degen aesthetics and real USDC payments.

---

## 🎮 Features

### Core Gameplay
- **Tap-to-Earn Mechanics**: Gain XP with every tap
- **Level System**: Exponential progression from Level 1 to ∞
- **Energy System**: Free users have energy limits (Premium = unlimited)
- **Boost Multipliers**: 2x and 5x XP boosts available

### Premium Features
- ✅ **Premium Activation ($2)**: Unlimited levels + No cooldowns
- ⚡ **Boost x2 ($0.50)**: Double XP for 24 hours
- 🔥 **Boost x5 ($1.50)**: 5x XP for 24 hours
- 🔋 **Energy Refill ($0.25)**: Instant +100 energy
- 👑 **Battle Pass ($5/month)**: All boosts + Exclusive NFT + 10% permanent XP bonus

### Web3 Integration
- **EVM Wallet Login**: MetaMask, Coinbase Wallet, WalletConnect
- **Base Network**: Low fees, fast transactions
- **USDC Payments**: Secure on-chain purchases
- **Leaderboard**: Global ranking system

---

## 🚀 Quick Start

### For Lovable.dev Users

1. **Create a new project** in Lovable
2. **Copy the contents** of `src/pyramid-meme-empire.jsx`
3. **Paste into Lovable's** editor
4. **Install dependencies** (Lovable handles this automatically):
   - `react`
   - `lucide-react`
   - `tailwindcss`

5. **Run the project** - Lovable will deploy it instantly

---

## 💻 Local Development

### Prerequisites
- Node.js 18+ 
- npm or yarn
- MetaMask or compatible Web3 wallet

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/pyramid-meme-empire.git

# Navigate to project
cd pyramid-meme-empire

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

---

## 🌐 Deployment

### Option 1: Vercel (Recommended)

1. **Install Vercel CLI**:
```bash
npm i -g vercel
```

2. **Build & Deploy**:
```bash
npm run build
vercel --prod
```

3. **Done!** Your game is live.

### Option 2: Netlify

1. **Install Netlify CLI**:
```bash
npm i -g netlify-cli
```

2. **Build & Deploy**:
```bash
npm run build
netlify deploy --prod --dir=dist
```

### Option 3: GitHub Pages

1. Add to `package.json`:
```json
"homepage": "https://yourusername.github.io/pyramid-meme-empire"
```

2. Install gh-pages:
```bash
npm install --save-dev gh-pages
```

3. Add deploy script:
```json
"scripts": {
  "predeploy": "npm run build",
  "deploy": "gh-pages -d dist"
}
```

4. Deploy:
```bash
npm run deploy
```

---

## 🔗 Smart Contract Deployment

### Prerequisites
- Hardhat or Foundry
- Base Network RPC URL
- Private key with ETH on Base for gas

### USDC on Base
- **Contract Address**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **Decimals**: 6

### Deploying Payment Contract

1. **Install dependencies**:
```bash
npm install --save-dev hardhat @openzeppelin/contracts
```

2. **Configure Hardhat** for Base:
```javascript
// hardhat.config.js
module.exports = {
  networks: {
    base: {
      url: 'https://mainnet.base.org',
      accounts: [process.env.PRIVATE_KEY],
      chainId: 8453
    }
  }
};
```

3. **Deploy**:
```bash
npx hardhat run scripts/deploy.js --network base
```

4. **Verify Contract**:
```bash
npx hardhat verify --network base DEPLOYED_ADDRESS "USDC_ADDRESS" "TREASURY_ADDRESS"
```

---

## 📊 Game Economics

### Level Progression
| Level | Required XP | Cumulative XP |
|-------|-------------|---------------|
| 1     | 0           | 0             |
| 2     | 100         | 100           |
| 3     | 250         | 350           |
| 5     | 1,000       | ~2,000        |
| 10    | 10,000      | ~50,000       |
| 20    | 100,000     | ~500,000      |
| 50    | 1,000,000   | ~5,000,000    |

**Formula**: `XP_required = 100 * (level^1.5)`

### Free vs Premium

| Feature | Free | Premium |
|---------|------|---------|
| Max Level | 3 | ∞ |
| Tap Cooldown | 2 seconds | None |
| Energy | 100 max | Unlimited |
| Energy Regen | 1 per 30s | N/A |

### Item Pricing
- **Premium**: $2 USDC (one-time)
- **Boost x2**: $0.50 USDC (24h)
- **Boost x5**: $1.50 USDC (24h)
- **Energy Refill**: $0.25 USDC (instant)
- **Battle Pass**: $5 USDC (30 days)

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS
- **Icons**: Lucide React
- **Web3**: ethers.js / Web3.js (via window.ethereum)
- **Network**: Base (Chain ID: 8453)
- **Payments**: USDC (Native on Base)
- **Smart Contracts**: Solidity 0.8.19, OpenZeppelin

---

## 🎨 Design Philosophy

- **Degen Aesthetics**: Dark mode, gradients, neon borders
- **Web3 Native**: Wallet-first experience
- **High Performance**: Optimized tap mechanics
- **Mobile Ready**: Responsive design

---

## 📱 Connecting to Lovable

To integrate this into your existing Lovable project:

1. Open your Lovable project
2. Copy `src/pyramid-meme-empire.jsx` 
3. Paste into a new component in Lovable
4. Lovable will auto-install dependencies
5. Reference the component in your main App

**Alternative**: Share your Lovable project URL and I can directly push updates.

---

## 🔐 Security Considerations

- ✅ Smart contract uses OpenZeppelin standards
- ✅ ReentrancyGuard on all payment functions
- ✅ No direct ETH handling (USDC only)
- ✅ Owner-only treasury updates
- ⚠️ Always audit contracts before mainnet deployment

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 🙏 Acknowledgments

- Built on [Base](https://base.org) Network
- Powered by [USDC](https://www.circle.com/usdc)
- Icons by [Lucide](https://lucide.dev)

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/pyramid-meme-empire/issues)
- **Twitter**: [@PyramidMemeEmpire](https://twitter.com/pyramidmeme)
- **Discord**: [Join our server](https://discord.gg/pyramidmeme)

---

## 🚀 Roadmap

- [x] Core tap mechanics
- [x] Web3 wallet integration
- [x] USDC payment system
- [x] Leaderboard
- [ ] Battle Pass NFT minting
- [ ] Referral system
- [ ] Daily missions
- [ ] $PME token launch
- [ ] Staking mechanics
- [ ] Mobile app (React Native)

---

**Built with 💜 for the Base degen community**

*Not financial advice. DYOR. Probably nothing.*
