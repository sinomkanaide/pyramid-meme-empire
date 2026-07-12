const { ethers } = require('ethers');

// USDG ERC-20 ABI (only what we need)
const USDG_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

// Prices in USDG (6 decimals, same as USDC) - matching shop item IDs
const PRICES = {
  premium: 2000000,       // $2.00
  boost_2x: 500000,       // $0.50
  boost_5x: 1500000,      // $1.50
  energy_refill: 250000,  // $0.25
  battle_pass: 5000000    // $5.00
};

class PaymentService {
  constructor() {
    // Robinhood Chain (chain 4663). New env names preferred; old BASE_*/USDC_* names kept for backward compat.
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL || process.env.BASE_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com');
    this.usdgAddress = (process.env.USDG_CONTRACT_ADDRESS || process.env.USDC_CONTRACT_ADDRESS || '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168').toLowerCase();
    this.shopWallet = (process.env.SHOP_WALLET_ADDRESS || '').toLowerCase();
    this.expectedChainId = BigInt(process.env.CHAIN_ID || 4663); // Robinhood Chain
    this._chainVerified = false;
  }

  /**
   * Assert the configured RPC is actually on the expected chain (4663).
   * Guards against a misconfigured RPC (e.g. a leftover Base URL) silently
   * validating transfers from the wrong network. Checked once, then cached.
   */
  async ensureCorrectChain() {
    if (this._chainVerified) return;
    const network = await this.provider.getNetwork();
    if (network.chainId !== this.expectedChainId) {
      throw new Error(`RPC chain mismatch: expected ${this.expectedChainId}, RPC reports ${network.chainId}. Check RPC_URL / CHAIN_ID env vars.`);
    }
    this._chainVerified = true;
  }

  /**
   * Verify a USDG payment transaction on-chain
   * @param {string} txHash - Transaction hash
   * @param {string} expectedSender - Buyer's wallet address
   * @param {string} itemType - Item type (premium, boost_2x, etc.)
   * @returns {object} { valid: boolean, error?: string, details?: object }
   */
  async verifyPayment(txHash, expectedSender, itemType) {
    try {
      // 0. Ensure the RPC is on the expected chain before trusting any receipt.
      await this.ensureCorrectChain();

      // 1. Get transaction receipt
      const receipt = await this.provider.getTransactionReceipt(txHash);

      if (!receipt) {
        return { valid: false, error: 'Transaction not found or not yet confirmed' };
      }

      // 2. Verify tx was successful
      if (receipt.status !== 1) {
        return { valid: false, error: 'Transaction failed on-chain' };
      }

      // 3. Verify confirmations (minimum 1, Base L2 has ~2s blocks)
      //    Frontend already waits for 2 confirmations before calling backend.
      //    Backend RPC may lag 1 block behind, so we accept 1 with retry.
      let confirmations = 0;
      for (let attempt = 0; attempt < 3; attempt++) {
        const currentBlock = await this.provider.getBlockNumber();
        confirmations = currentBlock - receipt.blockNumber;
        if (confirmations >= 1) break;
        // Wait 3 seconds and retry
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      if (confirmations < 1) {
        return { valid: false, error: `Only ${confirmations} confirmations, need at least 1` };
      }

      // 4. Verify tx is to the USDG contract
      if (receipt.to?.toLowerCase() !== this.usdgAddress) {
        return { valid: false, error: 'Transaction is not a USDG transfer' };
      }

      // 5. Parse logs to find Transfer event
      const usdgContract = new ethers.Contract(this.usdgAddress, USDG_ABI, this.provider);
      const transferEvent = receipt.logs
        .map(log => {
          try {
            return usdgContract.interface.parseLog({ topics: log.topics, data: log.data });
          } catch {
            return null;
          }
        })
        .find(parsed => parsed && parsed.name === 'Transfer');

      if (!transferEvent) {
        return { valid: false, error: 'No USDG Transfer event found in transaction' };
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
      console.log(`[PaymentService] Payment verified: ${txHash} | ${itemType} | ${from} -> ${to} | ${Number(value)} USDG units`);

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
