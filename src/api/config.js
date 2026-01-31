// API Configuration
export const API_URL = import.meta.env.VITE_API_URL || 'https://pyramid-meme-empire-production.up.railway.app';

// Helper function for API calls
export async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem('pme_token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }

  return data;
}
