import { useState, useEffect, useCallback } from 'react';
import { game } from '../api';

export function useGame(isAuthenticated) {
  const [progress, setProgress] = useState({
    bricks: 0,
    level: 1,
    energy: 100,
    pmeTokens: 0,
    totalTaps: 0,
    boostMultiplier: 1,
    rank: 0,
    isPremium: false,
  });
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastTapResult, setLastTapResult] = useState(null);

  // Fetch progress when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchProgress();
      fetchLeaderboard();
    }
  }, [isAuthenticated]);

  // Fetch game progress
  const fetchProgress = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const data = await game.getProgress();
      setProgress(data);
    } catch (err) {
      console.error('Failed to fetch progress:', err);
    }
  }, [isAuthenticated]);

  // Process tap
  const tap = useCallback(async () => {
    if (!isAuthenticated) return null;

    setIsLoading(true);
    try {
      const result = await game.processTap();
      setLastTapResult(result);

      // Update local state
      setProgress(prev => ({
        ...prev,
        bricks: result.bricks,
        level: result.level,
        energy: result.energy,
      }));

      return result;
    } catch (err) {
      console.error('Tap failed:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Claim tokens
  const claim = useCallback(async () => {
    if (!isAuthenticated) return null;

    setIsLoading(true);
    try {
      const result = await game.claimTokens();

      // Update local state
      setProgress(prev => ({
        ...prev,
        bricks: result.newBricks,
        pmeTokens: result.totalTokens,
        level: 1,
      }));

      return result;
    } catch (err) {
      console.error('Claim failed:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async () => {
    try {
      const data = await game.getLeaderboard(10);
      setLeaderboard(data.leaderboard || []);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    }
  }, []);

  return {
    progress,
    leaderboard,
    isLoading,
    lastTapResult,
    tap,
    claim,
    fetchProgress,
    fetchLeaderboard,
  };
}
