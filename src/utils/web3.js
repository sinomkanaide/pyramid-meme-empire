// Web3 Utilities for PyramidMeme Empire
// Handles wallet connections, contract interactions, and USDC payments

// Base Network Configuration
export const BASE_NETWORK = {
  chainId: '0x2105', // 8453 in hex
  chainName: 'Base',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18
  },
  rpcUrls: ['https://mainnet.base.org'],
  blockExplorerUrls: ['https://basescan.org']
};

// USDC on Base Network
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Contract addresses (update after deployment)
export const PAYMENT_CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000'; // TO BE DEPLOYED

// ABI for USDC (ERC20)
export const USDC_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

// ABI for Payment Contract
export const PAYMENT_CONTRACT_ABI = [
  'function purchasePremium() external',
  'function purchaseBoostX2() external',
  'function purchaseBoostX5() external',
  'function purchaseEnergyRefill() external',
  'function purchaseBattlePass() external',
  'function getPlayer(address _player) view returns (bool isPremium, uint256 boostX2Expiry, uint256 boostX5Expiry, bool hasBattlePass, uint256 battlePassExpiry, uint256 totalSpent)',
  'function getActiveBoosts(address _player) view returns (bool hasBoostX2, bool hasBoostX5, bool hasActiveBattlePass)',
];

/**
 * Connect wallet and switch to Base network
 */
export async function connectWallet() {
  if (typeof window.ethereum === 'undefined') {
    throw new Error('Please install MetaMask or a Web3 wallet');
  }

  try {
    // Request account access
    const accounts = await window.ethereum.request({ 
      method: 'eth_requestAccounts' 
    });

    // Switch to Base network
    await switchToBase();

    return accounts[0];
  } catch (error) {
    console.error('Wallet connection error:', error);
    throw error;
  }
}

/**
 * Switch to Base network
 */
export async function switchToBase() {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_NETWORK.chainId }],
    });
  } catch (switchError) {
    // If Base is not added, add it
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [BASE_NETWORK]
      });
    } else {
      throw switchError;
    }
  }
}

/**
 * Get USDC balance of an address
 */
export async function getUSDCBalance(address) {
  if (typeof window.ethereum === 'undefined') {
    return 0;
  }

  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
    const balance = await usdcContract.balanceOf(address);
    
    // USDC has 6 decimals
    return parseFloat(ethers.utils.formatUnits(balance, 6));
  } catch (error) {
    console.error('Error getting USDC balance:', error);
    return 0;
  }
}

/**
 * Approve USDC spending
 */
export async function approveUSDC(amount) {
  if (typeof window.ethereum === 'undefined') {
    throw new Error('Web3 provider not found');
  }

  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
    
    // Convert to USDC units (6 decimals)
    const amountInUnits = ethers.utils.parseUnits(amount.toString(), 6);
    
    const tx = await usdcContract.approve(PAYMENT_CONTRACT_ADDRESS, amountInUnits);
    await tx.wait();
    
    return tx.hash;
  } catch (error) {
    console.error('Error approving USDC:', error);
    throw error;
  }
}

/**
 * Purchase Premium
 */
export async function purchasePremium() {
  return await executePurchase('purchasePremium', 2);
}

/**
 * Purchase Boost x2
 */
export async function purchaseBoostX2() {
  return await executePurchase('purchaseBoostX2', 0.5);
}

/**
 * Purchase Boost x5
 */
export async function purchaseBoostX5() {
  return await executePurchase('purchaseBoostX5', 1.5);
}

/**
 * Purchase Energy Refill
 */
export async function purchaseEnergyRefill() {
  return await executePurchase('purchaseEnergyRefill', 0.25);
}

/**
 * Purchase Battle Pass
 */
export async function purchaseBattlePass() {
  return await executePurchase('purchaseBattlePass', 5);
}

/**
 * Execute a purchase (internal helper)
 */
async function executePurchase(functionName, priceUSD) {
  if (typeof window.ethereum === 'undefined') {
    throw new Error('Web3 provider not found');
  }

  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    
    // Check USDC balance
    const address = await signer.getAddress();
    const balance = await getUSDCBalance(address);
    
    if (balance < priceUSD) {
      throw new Error(`Insufficient USDC balance. Need $${priceUSD}, have $${balance.toFixed(2)}`);
    }
    
    // Approve USDC if needed
    const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
    const amountInUnits = ethers.utils.parseUnits(priceUSD.toString(), 6);
    const allowance = await usdcContract.allowance(address, PAYMENT_CONTRACT_ADDRESS);
    
    if (allowance.lt(amountInUnits)) {
      const approveTx = await usdcContract.approve(PAYMENT_CONTRACT_ADDRESS, amountInUnits);
      await approveTx.wait();
    }
    
    // Execute purchase
    const paymentContract = new ethers.Contract(
      PAYMENT_CONTRACT_ADDRESS, 
      PAYMENT_CONTRACT_ABI, 
      signer
    );
    
    const tx = await paymentContract[functionName]();
    const receipt = await tx.wait();
    
    return {
      success: true,
      transactionHash: receipt.transactionHash
    };
  } catch (error) {
    console.error(`Error purchasing ${functionName}:`, error);
    throw error;
  }
}

/**
 * Get player data from contract
 */
export async function getPlayerData(address) {
  if (typeof window.ethereum === 'undefined' || !address) {
    return null;
  }

  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const paymentContract = new ethers.Contract(
      PAYMENT_CONTRACT_ADDRESS,
      PAYMENT_CONTRACT_ABI,
      provider
    );
    
    const data = await paymentContract.getPlayer(address);
    
    return {
      isPremium: data.isPremium,
      boostX2Expiry: data.boostX2Expiry.toNumber() * 1000, // Convert to JS timestamp
      boostX5Expiry: data.boostX5Expiry.toNumber() * 1000,
      hasBattlePass: data.hasBattlePass,
      battlePassExpiry: data.battlePassExpiry.toNumber() * 1000,
      totalSpent: parseFloat(ethers.utils.formatUnits(data.totalSpent, 6))
    };
  } catch (error) {
    console.error('Error getting player data:', error);
    return null;
  }
}

/**
 * Listen for account changes
 */
export function onAccountsChanged(callback) {
  if (typeof window.ethereum !== 'undefined') {
    window.ethereum.on('accountsChanged', (accounts) => {
      callback(accounts[0] || null);
    });
  }
}

/**
 * Listen for network changes
 */
export function onChainChanged(callback) {
  if (typeof window.ethereum !== 'undefined') {
    window.ethereum.on('chainChanged', (chainId) => {
      callback(chainId);
    });
  }
}

/**
 * Format address for display
 */
export function formatAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Open block explorer for transaction
 */
export function openTransaction(txHash) {
  window.open(`${BASE_NETWORK.blockExplorerUrls[0]}/tx/${txHash}`, '_blank');
}

/**
 * Open block explorer for address
 */
export function openAddress(address) {
  window.open(`${BASE_NETWORK.blockExplorerUrls[0]}/address/${address}`, '_blank');
}
