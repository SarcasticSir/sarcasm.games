function calculateLevelUpCost(level) {
  const normalizedLevel = Math.max(1, Number(level || 1));
  return Math.floor(50 * Math.pow(normalizedLevel, 1.35));
}

module.exports = {
  calculateLevelUpCost
};
