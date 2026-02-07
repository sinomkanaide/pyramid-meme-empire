# 🎮 QUICK START FOR LOVABLE.DEV

## Copy This to Lovable in 2 Minutes

### Step 1: Open Lovable
Go to: https://lovable.dev

### Step 2: Create New Project
- Click "New Project"
- Name it: "TAPKAMUN.FUN"

### Step 3: Copy the Main Component

**File to copy**: `src/pyramid-meme-empire.jsx`

1. Open the file in this repository
2. Select ALL (Ctrl+A / Cmd+A)
3. Copy (Ctrl+C / Cmd+C)
4. Go to Lovable editor
5. Paste (Ctrl+V / Cmd+V)

### Step 4: Dependencies (Auto-installed by Lovable)

Lovable will automatically install:
- ✅ react
- ✅ lucide-react
- ✅ tailwindcss

### Step 5: Deploy

Click the "Deploy" button in Lovable → **You're live!**

---

## 🔧 Customization in Lovable

Once deployed, you can customize visually:

### Change Colors
Look for these lines in the code:
```jsx
// Main gradient
className="bg-gradient-to-br from-purple-900 via-black to-blue-900"

// Change to your colors:
className="bg-gradient-to-br from-blue-900 via-black to-green-900"
```

### Change Prices
Find the `shopItems` array:
```jsx
const shopItems = [
  {
    id: 'premium',
    price: 2, // Change this number
    ...
  }
]
```

### Change Level Formula
Find `calculateRequiredXP`:
```jsx
const calculateRequiredXP = (targetLevel) => {
  return Math.floor(100 * Math.pow(targetLevel, 1.5));
  // Adjust the 1.5 to make leveling easier/harder
};
```

### Change XP Per Tap
Find `getXpPerTap`:
```jsx
const getXpPerTap = () => {
  const base = 1; // Change this for more/less XP
  ...
};
```

### Change Energy Settings
Find these constants at the top:
```jsx
const [energy, setEnergy] = useState(100); // Max energy
```

And in the energy regen:
```jsx
setEnergy(prev => Math.min(100, prev + 1)); // Regen amount
}, 30000); // Time in milliseconds (30 seconds)
```

---

## 🎨 Visual Customization Tips

### 1. Change Emoji/Icons
Replace the pyramid emoji:
```jsx
<div className="text-8xl mb-2 animate-pulse">🔺</div>
// Try: 💎 🚀 🌟 🔥 ⚡ 👑 🎮
```

### 2. Adjust Tap Button Size
```jsx
className="w-64 h-64" // Change these numbers
// Try: w-80 h-80 for bigger
//      w-48 h-48 for smaller
```

### 3. Change Animation Speed
```jsx
duration-200 // Tap animation
// Try: duration-100 (faster) or duration-500 (slower)
```

---

## 🌐 Connect Your Smart Contract

After deploying your contract (see DEPLOYMENT.md):

1. Find this line:
```jsx
export const PAYMENT_CONTRACT_ADDRESS = '0x0000...';
```

2. Replace with your deployed contract address

3. Save and redeploy in Lovable

---

## 🧪 Testing in Lovable

### Test Locally:
1. Click "Preview" in Lovable
2. Connect MetaMask
3. Make sure you're on Base Network
4. Test all features

### Common Issues:

**Wallet won't connect?**
- Refresh the page
- Make sure MetaMask is unlocked
- Try a different browser

**Tap doesn't work?**
- Make sure wallet is connected
- Check if you're at level 3 (free limit)
- Verify you have energy

**Purchases fail?**
- Need USDC in wallet
- Must be on Base Network
- Contract must be deployed

---

## 🚀 Go Live

Once everything works in preview:

1. Click "Deploy" in Lovable
2. Get your live URL
3. Share with the world!

Your game URL will be:
`https://your-project-name.lovable.app`

---

## 📱 Share Your Game

Copy this template:

```
🗿 TAPKAMUN.FUN is LIVE! 

Stack Memes. Build Empires. Earn $PME.

🎮 Play Now: [YOUR_URL]
💰 Built on Base Network
⚡ Tap to Earn - Web3 Gaming

Join the pyramid! 🚀
```

---

## 🆘 Need Help?

- Check the main README.md
- Read DEPLOYMENT.md for advanced setup
- Open an issue on GitHub

**You're all set! Happy building! 🎮🔺**
