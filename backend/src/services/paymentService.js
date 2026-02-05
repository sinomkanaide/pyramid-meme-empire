const { ethers } = require('ethers');

// USDC ERC-20 ABI (only what we need)
const USDC_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

// Prices in USDC (6 decimals) - matching shop item IDs
const PRICES = {
  premium: 2000000,       // $2.00
  boost_2x: 500000,       // $0.50
  boost_5x: 1500000,      // $1.50
  energy_refill: 250000,  // $0.25
  battle_pass: 5000000    // $5.00
};

class PaymentService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
    this.usdcAddress = (process.env.USDC_CONTRACT_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913').toLowerCase();
    this.shopWallet = (process.env.SHOP_WALLET_ADDRESS || '').toLowerCase();
  }

  /**
   * Verify a USDC payment transaction on-chain
   * @param {string} txHash - Transaction hash
   * @param {string} expectedSender - Buyer's wallet address
   * @param {string} itemType - Item type (premium, boost_2x, etc.)
   * @returns {object} { valid: boolean, error?: string, details?: object }
   */
  async verifyPayment(txHash, expectedSender, itemType) {
    try {
      // 1. Get transaction receipt
      const receipt = await this.provider.getTransactionReceipt(txHash);

      if (!receipt) {
        return { valid: false, error: 'Transaction not found or not yet confirmed' };
      }

      // 2. Verify tx was successful
      if (receipt.status !== 1) {
        return { valid: false, error: 'Transaction failed on-chain' };
      }

      // 3. Verify confirmations (minimum 2)
      const currentBlock = await this.provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber;
      if (confirmations < 2) {
        return { valid: false, error: `Only ${confirmations} confirmations, need at least 2` };
      }

      // 4. Verify tx is to the USDC contract
      if (receipt.to?.toLowerCase() !== this.usdcAddress) {
        return { valid: false, error: 'Transaction is not a USDC transfer' };
      }

      // 5. Parse logs to find Transfer event
      const usdcContract = new ethers.Contract(this.usdcAddress, USDC_ABI, this.provider);
      const transferEvent = receipt.logs
        .map(log => {
          try {
            return usdcContract.interface.parseLog({ topics: log.topics, data: log.data });
          } catch {
            return null;
          }
        })
        .find(parsed => parsed && parsed.name === 'Transfer');

      if (!transferEvent) {
        return { valid: false, error: 'No USDC Transfer event found in transaction' };
      }

      const { from, to, value } = transferEvent.args;

      // 6. Verify sender matches authenticated user
      if (from.toLowerCase() !== expectedSender.toLowerCase()) {
        return { valid: false, error: 'Transaction sender does not match authenticated user' };
      }

      // 7. Verify recipient is our shop wallet
      if (to.toLowerCase() !== this.shopWallet) {
        return { valid: false, error: 'Transaction recipient is not the shop wallet' };
      }

      // 8. Verify amount
      const expectedAmount = PRICES[itemType];
      if (!expectedAmount) {
        return { valid: false, error: `Unknown item type: ${itemType}` };
      }

      if (Number(value) < expectedAmount) {
        return { valid: false, error: `Insufficient amount. Expected ${expectedAmount}, got ${Number(value)}` };
      }

      // 9. All verified
      console.log(`[PaymentService] Payment verified: ${txHash} | ${itemType} | ${from} -> ${to} | ${Number(value)} USDC units`);

      return {
        valid: true,
        details: {
          txHash,
          from: from,
          to: to,
          amount: Number(value),
          amountUSD: Number(value) / 1e6,
          blockNumber: receipt.blockNumber,
          confirmations
        }
      };

    } catch (error) {
      console.error('[PaymentService] Verification error:', error);
      return { valid: false, error: 'Verification failed: ' + error.message };
    }
  }
}

module.exports = { PaymentService, PRICES };
