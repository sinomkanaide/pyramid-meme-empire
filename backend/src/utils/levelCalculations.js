// Centralized level calculation utility
// Formula: XP required for level N → N+1 = floor(100 * N^1.5)

const FREE_USER_MAX_LEVEL = 3;

// XP required to go from level N to level N+1
function xpForLevel(level) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

// Total cumulative XP needed to reach a specific level
function totalXpForLevel(level) {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += xpForLevel(i);
  }
  return total;
}

// Calculate correct level from total XP (bricks)
function calculateLevelFromXp(totalXp) {
  let level = 1;
  let xpNeeded = 0;
  while (true) {
    const nextLevelXp = xpForLevel(level);
    if (xpNeeded + nextLevelXp > totalXp) {
      break;
    }
    xpNeeded += nextLevelXp;
    level++;
  }
  return level;
}

// Get XP progress within current level
function getXpProgress(totalXp, level) {
  const xpAtLevelStart = totalXpForLevel(level);
  const xpInCurrentLevel = totalXp - xpAtLevelStart;
  const xpNeededForNext = xpForLevel(level);
  return {
    current: xpInCurrentLevel,
    needed: xpNeededForNext,
    percent: Math.min(100, Math.floor((xpInCurrentLevel / xpNeededForNext) * 100))
  };
}

// Apply free user level cap — unlocked by Premium OR Battle Pass
function applyLevelCap(calculatedLevel, isPremium, hasBattlePass) {
  if (!isPremium && !hasBattlePass && calculatedLevel > FREE_USER_MAX_LEVEL) {
    return FREE_USER_MAX_LEVEL;
  }
  return calculatedLevel;
}

module.exports = {
  FREE_USER_MAX_LEVEL,
  xpForLevel,
  totalXpForLevel,
  calculateLevelFromXp,
  getXpProgress,
  applyLevelCap
};
