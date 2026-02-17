const redisClient = require("../config/redis");

const TIER_LIMITS = {
  FREE: { limit: 20, windowMs: 60000 },
  PRO: { limit: 80, windowMs: 60000 },
  ENTERPRISE: { limit: 200, windowMs: 60000 }
};

async function slidingWindow(userId, tier, options = {}) {
  const defaults = TIER_LIMITS[tier] || TIER_LIMITS.FREE;
  const limit = Number(options.limit) || defaults.limit;
  const windowMs = Number(options.windowMs) || defaults.windowMs;
  const cost = Math.max(Number(options.cost) || 1, 1);
  const key = `window:${userId}`;
  const now = Date.now();

  await redisClient.zRemRangeByScore(key, 0, now - windowMs);
  const countBefore = await redisClient.zCard(key);
  const allowed = countBefore + cost <= limit;

  let countAfter = countBefore;
  if (allowed) {
    const entries = [];
    for (let i = 0; i < cost; i += 1) {
      entries.push({
        score: now,
        value: `${now}-${i}-${Math.random().toString(36).slice(2, 8)}`
      });
    }
    await redisClient.zAdd(key, entries);
    countAfter = countBefore + cost;
  }

  let retryAfterSec = 0;
  if (!allowed) {
    const oldest = await redisClient.zRangeWithScores(key, 0, 0);
    if (oldest.length > 0) {
      const elapsed = now - oldest[0].score;
      retryAfterSec = Math.max(Math.ceil((windowMs - elapsed) / 1000), 1);
    }
  }

  return {
    allowed,
    algorithm: "SLIDING_WINDOW",
    cost,
    remaining: Math.max(limit - countAfter, 0),
    capacity: limit,
    refillRate: null,
    retryAfterSec
  };
}

module.exports = slidingWindow;
