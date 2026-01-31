import { apiCall } from './config';

// Get game progress
export async function getProgress() {
  return apiCall('/api/game/progress');
}

// Process a tap
export async function processTap() {
  return apiCall('/api/game/tap', {
    method: 'POST',
  });
}

// Claim PME tokens
export async function claimTokens() {
  return apiCall('/api/game/claim', {
    method: 'POST',
  });
}

// Get leaderboard
export async function getLeaderboard(limit = 10) {
  return apiCall(`/api/game/leaderboard?limit=${limit}`);
}
