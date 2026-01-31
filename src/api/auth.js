import { apiCall } from './config';

// Get nonce for wallet signature
export async function getNonce(walletAddress) {
  return apiCall(`/api/auth/nonce/${walletAddress}`);
}

// Verify signature and login
export async function verifySignature(walletAddress, signature, referralCode = null) {
  const body = { walletAddress, signature };
  if (referralCode) {
    body.referralCode = referralCode;
  }

  const data = await apiCall('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  // Store token
  if (data.token) {
    localStorage.setItem('pme_token', data.token);
    localStorage.setItem('pme_user', JSON.stringify(data.user));
  }

  return data;
}

// Get current user info
export async function getCurrentUser() {
  return apiCall('/api/auth/me');
}

// Logout
export function logout() {
  localStorage.removeItem('pme_token');
  localStorage.removeItem('pme_user');
}

// Check if logged in
export function isLoggedIn() {
  return !!localStorage.getItem('pme_token');
}

// Get stored user
export function getStoredUser() {
  const user = localStorage.getItem('pme_user');
  return user ? JSON.parse(user) : null;
}
