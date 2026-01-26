# 🚀 DEPLOYMENT GUIDE - PyramidMeme Empire

## Complete Step-by-Step Deployment Instructions

---

## 📋 Prerequisites

Before starting, make sure you have:

- ✅ Node.js 18+ installed
- ✅ A code editor (VS Code recommended)
- ✅ Git installed
- ✅ A Web3 wallet with ETH on Base Network
- ✅ USDC on Base (for testing purchases)
- ✅ Accounts on:
  - Vercel or Netlify (free tier is fine)
  - GitHub (for version control)

---

## 🎯 OPTION 1: Deploy to Lovable.dev (EASIEST - 5 minutes)

### Step 1: Copy the Code

1. Go to your Lovable project: `https://lovable.dev`
2. Create a new project or open existing one
3. Copy the entire contents of `src/pyramid-meme-empire.jsx`
4. Paste into Lovable's main component editor

### Step 2: Configure Dependencies

Lovable auto-installs, but verify these are present:
```json
{
  "react": "^18.2.0",
  "lucide-react": "^0.263.1"
}
```

### Step 3: Deploy

1. Click "Deploy" in Lovable
2. Your game is LIVE immediately!
3. Share the URL

**Done! Your game is deployed.**

---

## 🌐 OPTION 2: Deploy to Vercel (RECOMMENDED - 10 minutes)

### Step 1: Prepare Your Code

```bash
# Navigate to your project folder
cd pyramid-meme-empire

# Install dependencies
npm install

# Test locally
npm run dev
```

Open `http://localhost:3000` - verify everything works.

### Step 2: Create GitHub Repository

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - PyramidMeme Empire"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/pyramid-meme-empire.git
git branch -M main
git push -u origin main
```

### Step 3: Deploy to Vercel

**Option A: Using Vercel Website**

1. Go to [vercel.com](https://vercel.com)
2. Click "Import Project"
3. Connect your GitHub account
4. Select `pyramid-meme-empire` repository
5. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Click "Deploy"

**Option B: Using Vercel CLI**

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# For production
vercel --prod
```

### Step 4: Configure Environment Variables

In Vercel Dashboard:
1. Go to Settings → Environment Variables
2. Add:
   - `VITE_PAYMENT_CONTRACT_ADDRESS` = (after deploying contract)
   - `VITE_TREASURY_ADDRESS` = (your wallet address)

### Step 5: Redeploy

```bash
vercel --prod
```

**Your game is now live on Vercel!**

---

## 📱 OPTION 3: Deploy to Netlify (Alternative - 10 minutes)

### Step 1: Build Your Project

```bash
npm run build
```

### Step 2: Deploy via Netlify CLI

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy

# For production
netlify deploy --prod
```

### Step 3: Or Use Netlify Drop

1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag and drop your `dist` folder
3. Done!

---

## 🔗 SMART CONTRACT DEPLOYMENT

### Prerequisites

- ETH on Base Network (for gas fees)
- Private key from your wallet
- RPC URL: `https://mainnet.base.org`

### Step 1: Install Hardhat

```bash
npm install --save-dev hardhat @nomiclabs/hardhat-ethers ethers @openzeppelin/contracts
```

### Step 2: Initialize Hardhat

```bash
npx hardhat init
```

Select "Create a JavaScript project"

### Step 3: Configure for Base

Edit `hardhat.config.js`:

```javascript
require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: "0.8.19",
  networks: {
    base: {
      url: "https://mainnet.base.org",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 8453
    },
    baseGoerli: {
      url: "https://goerli.base.org",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 84531
    }
  },
  etherscan: {
    apiKey: {
      base: process.env.BASESCAN_API_KEY
    }
  }
};
```

### Step 4: Create Deployment Script

Create `scripts/deploy.js`:

```javascript
const hre = require("hardhat");

async function main() {
  // USDC on Base
  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  
  // Your treasury wallet
  const TREASURY_ADDRESS = "YOUR_WALLET_ADDRESS_HERE";

  console.log("Deploying PyramidMemePayments...");

  const PyramidMemePayments = await hre.ethers.getContractFactory("PyramidMemePayments");
  const contract = await PyramidMemePayments.deploy(USDC_ADDRESS, TREASURY_ADDRESS);

  await contract.deployed();

  console.log("✅ Contract deployed to:", contract.address);
  console.log("🔗 View on BaseScan:", `https://basescan.org/address/${contract.address}`);
  
  // Wait for block confirmations
  console.log("Waiting for block confirmations...");
  await contract.deployTransaction.wait(5);
  
  console.log("✅ Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### Step 5: Create .env File

```bash
# .env
PRIVATE_KEY=your_private_key_here_without_0x
BASESCAN_API_KEY=your_basescan_api_key
```

**⚠️ NEVER commit .env to GitHub!**

### Step 6: Deploy Contract

```bash
# Test on Base Goerli first
npx hardhat run scripts/deploy.js --network baseGoerli

# When ready, deploy to mainnet
npx hardhat run scripts/deploy.js --network base
```

### Step 7: Verify Contract (Optional but Recommended)

```bash
npx hardhat verify --network base DEPLOYED_CONTRACT_ADDRESS "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" "YOUR_TREASURY_ADDRESS"
```

### Step 8: Update Frontend

Copy the deployed contract address and update:

1. In `src/utils/web3.js`:
```javascript
export const PAYMENT_CONTRACT_ADDRESS = 'YOUR_DEPLOYED_CONTRACT_ADDRESS';
```

2. Redeploy your frontend:
```bash
vercel --prod
```

---

## 🧪 Testing Your Deployment

### 1. Test Wallet Connection

- Visit your deployed URL
- Click "Connect Wallet"
- Verify it switches to Base Network
- Check that your address shows correctly

### 2. Test Gameplay

- Make sure you're on Base Network
- Click the tap button
- Verify XP increases
- Check energy decreases (for free users)

### 3. Test Purchases (Use Testnet First!)

**On Base Goerli Testnet:**
1. Get testnet ETH from [Base Goerli Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)
2. Get testnet USDC (or use a mock token)
3. Try purchasing items
4. Verify transactions on BaseScan

**On Mainnet:**
1. Use small amounts for testing
2. Verify all purchases work correctly
3. Check that treasury receives funds

---

## 🔒 Security Checklist

Before going live:

- [ ] Audit smart contract (use OpenZeppelin Defender or professional auditor)
- [ ] Test all payment functions on testnet
- [ ] Set up multisig for treasury (recommended)
- [ ] Never commit private keys or sensitive data
- [ ] Use environment variables for all secrets
- [ ] Enable rate limiting on backend (if applicable)
- [ ] Test with small amounts first
- [ ] Have emergency pause mechanism in contracts

---

## 📊 Post-Deployment

### Monitor Your Game

1. **Analytics**: Add Google Analytics or Mixpanel
2. **Wallet Tracking**: Monitor treasury wallet on BaseScan
3. **User Feedback**: Set up Discord/Telegram for community
4. **Bug Reports**: Enable GitHub Issues

### Marketing

1. Share on Crypto Twitter
2. Post in Base Network Discord
3. Submit to dApp directories
4. Create tutorial videos
5. Run airdrop campaigns

---

## 🆘 Troubleshooting

### "Transaction Failed"
- Check USDC balance
- Verify you're on Base Network (Chain ID: 8453)
- Ensure contract has USDC approval

### "Cannot Connect Wallet"
- Make sure MetaMask is installed
- Try refreshing the page
- Clear browser cache

### "Contract Not Found"
- Verify contract is deployed to correct network
- Check contract address in code
- Verify Base Network in MetaMask

### "Out of Gas"
- Increase gas limit in MetaMask
- Check Base Network gas prices

---

## 🎉 You're Live!

Congratulations! Your PyramidMeme Empire is now deployed and running.

**Next Steps:**
1. Share your game URL
2. Build your community
3. Monitor analytics
4. Gather feedback
5. Iterate and improve

**Need Help?**
- Check the [README.md](README.md)
- Open a GitHub Issue
- Join our Discord (link in README)

---

**Good luck building your empire! 🔺**
