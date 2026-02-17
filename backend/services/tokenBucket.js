const redisClient = require("../config/redis");

const limits = {
  FREE: { capacity: 10, refillRate: 1 },
  PRO: { capacity: 50, refillRate: 5 },
  ENTERPRISE: { capacity: 200, refillRate: 20 }
};

async function tokenBucket(userId, tier, options = {}) {
  const cost = Math.max(Number(options.cost) || 1, 1);
  const key = `bucket:${userId}`;
  const now = Date.now();
  const tierLimits = limits[tier] || limits.FREE;

  let bucket = await redisClient.get(key);
  bucket = bucket ? JSON.parse(bucket) : null;

  if (!bucket) {
    bucket = {
      tokens: tierLimits.capacity,
      lastRefill: now
    };
  }

  const elapsedSeconds = Math.floor((now - bucket.lastRefill) / 1000);

  if (elapsedSeconds > 0) {
    const refill = elapsedSeconds * tierLimits.refillRate;
    bucket.tokens = Math.min(tierLimits.capacity, bucket.tokens + refill);
    bucket.lastRefill = bucket.lastRefill + elapsedSeconds * 1000;

    if (bucket.tokens >= tierLimits.capacity) {
      bucket.lastRefill = now;
    }
  }

  const allowed = bucket.tokens >= cost;
  if (allowed) {
    bucket.tokens -= cost;
  }

  await redisClient.set(key, JSON.stringify(bucket));

  const tokensDeficit = Math.max(cost - bucket.tokens, 0);
  const retryAfterSec = allowed
    ? 0
    : Math.ceil(tokensDeficit / Math.max(tierLimits.refillRate, 1));

  return {
    allowed,
    algorithm: "TOKEN_BUCKET",
    cost,
    remaining: Math.floor(bucket.tokens),
    capacity: tierLimits.capacity,
    refillRate: tierLimits.refillRate,
    retryAfterSec
  };
}

module.exports = tokenBucket;
