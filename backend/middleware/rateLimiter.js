const User = require("../models/User");
const slidingWindow = require("../services/slidingWindow");
const tokenBucket = require("../services/tokenBucket");
const circuitBreaker = require("../services/circuitBreaker");
const { resolveRequestRule } = require("../services/rulesEngine");
const Analytics = require("../models/Analytics");

module.exports = async (req, res, next) => {
  const start = Date.now();
  try {
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ msg: "User not found" });

    const ip = req.ip;

    if (user.blacklist.includes(ip)) {
      return res.status(403).json({ msg: "IP Blacklisted" });
    }

    if (user.whitelist.length > 0 && !user.whitelist.includes(ip)) {
      return res.status(403).json({ msg: "IP Not Whitelisted" });
    }

    const endpoint = req.baseUrl + req.path;
    const rule = resolveRequestRule({
      user,
      endpoint,
      method: req.method
    });

    const limiterAction = async () => {
      if (rule.algorithm === "SLIDING_WINDOW") {
        return slidingWindow(user._id, user.tier, {
          limit: rule.windowLimit,
          windowMs: rule.windowMs,
          cost: rule.cost
        });
      }
      return tokenBucket(user._id, user.tier, { cost: rule.cost });
    };

    const limiterResult = await circuitBreaker.execute(limiterAction, () => ({
      allowed: true,
      algorithm: rule.algorithm,
      cost: rule.cost,
      remaining: null,
      capacity: null,
      refillRate: null,
      retryAfterSec: 0,
      degraded: true
    }));

    res.setHeader("X-RateLimit-Algorithm", limiterResult.algorithm);
    if (Number.isFinite(limiterResult.capacity)) {
      res.setHeader("X-RateLimit-Limit", String(limiterResult.capacity));
    }
    if (Number.isFinite(limiterResult.remaining)) {
      res.setHeader("X-RateLimit-Remaining", String(limiterResult.remaining));
    }
    if (Number.isFinite(limiterResult.capacity)) {
      res.setHeader("X-RateLimit-Capacity", String(limiterResult.capacity));
    }

    if (!limiterResult.allowed) {
      if (Number.isFinite(limiterResult.retryAfterSec) && limiterResult.retryAfterSec > 0) {
        res.setHeader("Retry-After", String(limiterResult.retryAfterSec));
        const resetAt = Math.floor(Date.now() / 1000) + limiterResult.retryAfterSec;
        res.setHeader("X-RateLimit-Reset", String(resetAt));
      }

      await Analytics.create({
        userId: user._id,
        endpoint: req.originalUrl,
        method: req.method,
        algorithm: limiterResult.algorithm,
        cost: rule.cost,
        allowed: false,
        reason: "RATE_LIMIT_EXCEEDED",
        ip,
        userAgent: String(req.headers["user-agent"] || ""),
        latencyMs: Date.now() - start
      });

      return res.status(429).json({
        msg: "Rate limit exceeded",
        details: limiterResult
      });
    }

    await Analytics.create({
      userId: user._id,
      endpoint: req.originalUrl,
      method: req.method,
      algorithm: limiterResult.algorithm,
      cost: rule.cost,
      allowed: true,
      reason: limiterResult.degraded ? "CIRCUIT_BREAKER_FALLBACK" : "ALLOWED",
      ip,
      userAgent: String(req.headers["user-agent"] || ""),
      latencyMs: Date.now() - start
    });

    req.rateLimit = limiterResult;
    return next();
  } catch (err) {
    return res.status(500).json({ msg: "Rate limiter failure", error: err.message });
  }
};
