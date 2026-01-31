import { apiCall } from './config';

// Get shop items
export async function getShopItems() {
  return apiCall('/api/shop/items');
}

// Process purchase (after USDC transfer)
export async function processPurchase(itemId, txHash) {
  return apiCall('/api/shop/purchase', {
    method: 'POST',
    body: JSON.stringify({ itemId, txHash }),
  });
}

// Get transaction history
export async function getTransactions() {
  return apiCall('/api/shop/transactions');
}

// Verify a transaction
export async function verifyTransaction(txHash) {
  return apiCall('/api/shop/verify', {
    method: 'POST',
    body: JSON.stringify({ txHash }),
  });
}
