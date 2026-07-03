const { connectDb } = require('./db');

const TIERS = {
  FREE: {
    capacity: 10,
    refillRate: 0.1666, // 1 token every 6 seconds (10 tokens/min)
    limit: 10,
    windowMs: 60000
  },
  PREMIUM: {
    capacity: 100,
    refillRate: 1.6666, // 100 tokens/min
    limit: 100,
    windowMs: 60000
  },
  ADMIN: {
    capacity: 1000,
    refillRate: 16.666,
    limit: 1000,
    windowMs: 60000
  }
};

async function logAnalytics(user, endpoint, method, allowed, algorithm, cost, latencyMs) {
  try {
    const db = await connectDb();
    await db.collection('analytics').insertOne({
      userId: user._id,
      email: user.email,
      endpoint,
      method,
      allowed,
      algorithm,
      cost,
      latencyMs,
      timestamp: new Date()
    });
  } catch (err) {
    console.error('Failed to log analytics:', err);
  }
}

async function checkRateLimit(user, clientIp, endpoint, method, cost = 1) {
  const db = await connectDb();
  const algorithm = user.rateLimitAlgorithm || 'TOKEN_BUCKET';
  const tierConfig = TIERS[user.tier] || TIERS.FREE;
  const now = Date.now();

  // If IP is whitelisted
  if (user.whitelist && user.whitelist.includes(clientIp)) {
    return { allowed: true, remaining: 999999, algorithm };
  }
  // If IP is blacklisted
  if (user.blacklist && user.blacklist.includes(clientIp)) {
    return { allowed: false, remaining: 0, algorithm };
  }

  // Retrieve custom rule cost if defined
  let endpointCost = cost;
  if (user.customRules && user.customRules[endpoint]) {
    endpointCost = Number(user.customRules[endpoint]) || cost;
  }

  if (algorithm === 'TOKEN_BUCKET') {
    const limiter = await db.collection('rate_limits').findOne({ userId: user._id, algorithm: 'TOKEN_BUCKET' });
    const capacity = tierConfig.capacity;
    const refillRate = tierConfig.refillRate; // tokens per second

    let tokens = capacity;
    let lastRefillTime = now;

    if (limiter) {
      const elapsedSeconds = (now - limiter.lastRefillTime) / 1000;
      const refilled = elapsedSeconds * refillRate;
      tokens = Math.min(capacity, limiter.tokens + refilled);
      lastRefillTime = limiter.lastRefillTime;
    }

    if (tokens >= endpointCost) {
      tokens -= endpointCost;
      await db.collection('rate_limits').updateOne(
        { userId: user._id, algorithm: 'TOKEN_BUCKET' },
        { $set: { tokens, lastRefillTime: now } },
        { upsert: true }
      );
      return { allowed: true, remaining: Math.floor(tokens), algorithm, cost: endpointCost };
    } else {
      // Calculate retry-after
      const needed = endpointCost - tokens;
      const retryAfter = Math.ceil(needed / refillRate);
      return { allowed: false, remaining: Math.floor(tokens), retryAfter, algorithm, cost: endpointCost };
    }
  } else {
    // SLIDING_WINDOW
    const limiter = await db.collection('rate_limits').findOne({ userId: user._id, algorithm: 'SLIDING_WINDOW' });
    let timestamps = [];
    if (limiter && Array.isArray(limiter.timestamps)) {
      timestamps = limiter.timestamps.filter(t => now - t < tierConfig.windowMs);
    }

    const currentCount = timestamps.length;
    const limit = tierConfig.limit;

    if (currentCount + endpointCost <= limit) {
      for (let i = 0; i < endpointCost; i++) {
        timestamps.push(now);
      }
      await db.collection('rate_limits').updateOne(
        { userId: user._id, algorithm: 'SLIDING_WINDOW' },
        { $set: { timestamps } },
        { upsert: true }
      );
      return { allowed: true, remaining: limit - timestamps.length, algorithm, cost: endpointCost };
    } else {
      const oldestActive = timestamps[0] || now;
      const retryAfter = Math.ceil((tierConfig.windowMs - (now - oldestActive)) / 1000);
      return { allowed: false, remaining: limit - currentCount, retryAfter: Math.max(1, retryAfter), algorithm, cost: endpointCost };
    }
  }
}

// Circuit Breaker State Management
async function getCircuitBreaker() {
  const db = await connectDb();
  let cb = await db.collection('settings').findOne({ key: 'circuit_breaker' });
  if (!cb) {
    cb = {
      key: 'circuit_breaker',
      state: 'CLOSED',
      failureCount: 0,
      lastStateChanged: Date.now()
    };
    await db.collection('settings').insertOne(cb);
  }
  
  // Transition HALF-OPEN check
  if (cb.state === 'OPEN' && Date.now() - cb.lastStateChanged > 15000) {
    cb.state = 'HALF_OPEN';
    cb.failureCount = 0;
    cb.lastStateChanged = Date.now();
    await db.collection('settings').updateOne({ key: 'circuit_breaker' }, { $set: cb });
  }

  return cb;
}

async function recordSuccess() {
  const db = await connectDb();
  const cb = await getCircuitBreaker();
  if (cb.state === 'HALF_OPEN') {
    await db.collection('settings').updateOne(
      { key: 'circuit_breaker' },
      { $set: { state: 'CLOSED', failureCount: 0, lastStateChanged: Date.now() } }
    );
  }
}

async function recordFailure() {
  const db = await connectDb();
  const cb = await getCircuitBreaker();
  if (cb.state === 'CLOSED' || cb.state === 'HALF_OPEN') {
    const newFailureCount = cb.failureCount + 1;
    let newState = cb.state;
    if (newFailureCount >= 3) {
      newState = 'OPEN';
    }
    await db.collection('settings').updateOne(
      { key: 'circuit_breaker' },
      { $set: { state: newState, failureCount: newFailureCount, lastStateChanged: Date.now() } }
    );
  }
}

module.exports = {
  checkRateLimit,
  logAnalytics,
  getCircuitBreaker,
  recordSuccess,
  recordFailure
};
