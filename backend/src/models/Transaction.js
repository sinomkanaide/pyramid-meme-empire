const db = require('../config/database');
const { ethers } = require('ethers');

class Transaction {
  // Create new transaction record
  static async create(userId, txHash, type, amount, itemName = null) {
    const result = await db.query(
      `INSERT INTO transactions (user_id, tx_hash, type, amount, item_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, txHash.toLowerCase(), type, amount, itemName]
    );
    return result.rows[0];
  }

  // Find by transaction hash
  static async findByTxHash(txHash) {
    const result = await db.query(
      'SELECT * FROM transactions WHERE tx_hash = $1',
      [txHash.toLowerCase()]
    );
    return result.rows[0];
  }

  // Get user transactions
  static async findByUserId(userId, limit = 20) {
    const result = await db.query(
      `SELECT * FROM transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }

  // Update transaction status
  static async updateStatus(txHash, status) {
    const confirmedAt = status === 'confirmed' ? new Date() : null;

    const result = await db.query(
      `UPDATE transactions
       SET status = $1, confirmed_at = $2
       WHERE tx_hash = $3
       RETURNING *`,
      [status, confirmedAt, txHash.toLowerCase()]
    );
    return result.rows[0];
  }

  // Update on-chain details (chain_id, block_number)
  static async updateOnChainDetails(txHash, details) {
    const result = await db.query(
      `UPDATE transactions
       SET chain_id = $1, block_number = $2
       WHERE tx_hash = $3
       RETURNING *`,
      [details.chain_id, details.block_number, txHash.toLowerCase()]
    );
    return result.rows[0];
  }

  // Verify transaction on-chain
  static async verifyOnChain(txHash) {
    try {
      const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!receipt) {
        return { verified: false, reason: 'Transaction not found' };
      }

      if (receipt.status === 0) {
        return { verified: false, reason: 'Transaction failed' };
      }

      // Get transaction details
      const tx = await provider.getTransaction(txHash);

      return {
        verified: true,
        receipt,
        transaction: tx,
        blockNumber: receipt.blockNumber,
        from: tx.from,
        to: tx.to,
        value: tx.value.toString()
      };
    } catch (error) {
      return { verified: false, reason: error.message };
    }
  }

  // Verify USDC transfer
  static async verifyUSDCTransfer(txHash, expectedAmount, expectedTo) {
    try {
      const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!receipt || receipt.status === 0) {
        return { verified: false, reason: 'Transaction failed or not found' };
      }

      // USDC Transfer event signature
      const transferTopic = ethers.id('Transfer(address,address,uint256)');

      // Find Transfer event in logs
      const transferLog = receipt.logs.find(log =>
        log.topics[0] === transferTopic &&
        log.address.toLowerCase() === process.env.USDC_CONTRACT_ADDRESS.toLowerCase()
      );

      if (!transferLog) {
        return { verified: false, reason: 'USDC transfer not found in transaction' };
      }

      // Decode transfer event
      const from = ethers.getAddress('0x' + transferLog.topics[1].slice(26));
      const to = ethers.getAddress('0x' + transferLog.topics[2].slice(26));
      const amount = ethers.toBigInt(transferLog.data);

      // USDC has 6 decimals
      const amountInUSDC = Number(amount) / 1e6;

      // Verify recipient and amount
      if (to.toLowerCase() !== expectedTo.toLowerCase()) {
        return { verified: false, reason: 'Wrong recipient address' };
      }

      if (amountInUSDC < expectedAmount) {
        return { verified: false, reason: `Amount mismatch: expected ${expectedAmount}, got ${amountInUSDC}` };
      }

      return {
        verified: true,
        from,
        to,
        amount: amountInUSDC,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      return { verified: false, reason: error.message };
    }
  }
}

module.exports = Transaction;
