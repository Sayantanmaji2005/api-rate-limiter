const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const rateLimiter = require("../middleware/rateLimiter");
const User = require("../models/User");
const Analytics = require("../models/Analytics");
const circuitBreaker = require("../services/circuitBreaker");

const router = express.Router();
const ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const parsePositiveInt = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const parsed = Math.floor(n);
  return parsed > 0 ? parsed : null;
};

router.get("/data", auth, rateLimiter, (req, res) => {
  res.json({
    message: "Protected API Access Granted",
    rateLimit: req.rateLimit || null
  });
});

router.get("/heavy-data", auth, rateLimiter, (_req, res) => {
  res.json({
    message: "Heavy endpoint served",
    payload: {
      records: 5000,
      generatedAt: new Date().toISOString()
    }
  });
});

router.get("/analytics", auth, async (req, res) => {
  try {
    const logs = await Analytics.find({ userId: req.user.id }).sort({ timestamp: -1 }).limit(20);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ msg: "Server Error" });
  }
});

router.get("/analytics/summary", auth, async (req, res) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.user.id);
    const [summary] = await Analytics.aggregate([
      { $match: { userId: userObjectId } },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          allowedRequests: { $sum: { $cond: ["$allowed", 1, 0] } },
          blockedRequests: { $sum: { $cond: ["$allowed", 0, 1] } },
          avgLatencyMs: { $avg: "$latencyMs" },
          totalCost: { $sum: { $ifNull: ["$cost", 0] } }
        }
      }
    ]);

    const [topEndpoint] = await Analytics.aggregate([
      { $match: { userId: userObjectId } },
      { $group: { _id: "$endpoint", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);

    return res.json({
      totalRequests: summary?.totalRequests || 0,
      allowedRequests: summary?.allowedRequests || 0,
      blockedRequests: summary?.blockedRequests || 0,
      avgLatencyMs: Number((summary?.avgLatencyMs || 0).toFixed(2)),
      totalCost: summary?.totalCost || 0,
      topEndpoint: topEndpoint?._id || null
    });
  } catch (err) {
    return res.status(500).json({ msg: "Failed to load analytics summary", error: err.message });
  }
});

router.put("/settings/algorithm", auth, async (req, res) => {
  try {
    const allowedAlgorithms = ["TOKEN_BUCKET", "SLIDING_WINDOW"];
    const { algorithm } = req.body;

    if (!allowedAlgorithms.includes(algorithm)) {
      return res.status(400).json({ msg: "Invalid algorithm" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { rateLimitAlgorithm: algorithm },
      { new: true }
    ).select("-password");

    return res.json({ msg: "Algorithm updated", user });
  } catch (err) {
    return res.status(500).json({ msg: "Failed to update algorithm", error: err.message });
  }
});

router.put("/settings/rules", auth, async (req, res) => {
  try {
    const { endpoint, method = "GET", cost = 1, windowLimit, windowMs } = req.body;
    const safeEndpoint = String(endpoint || "").trim();
    if (!safeEndpoint.startsWith("/")) {
      return res.status(400).json({ msg: "Endpoint must start with '/'" });
    }

    const safeMethod = String(method).toUpperCase();
    if (!ALLOWED_METHODS.includes(safeMethod)) {
      return res.status(400).json({ msg: "Invalid HTTP method" });
    }

    const safeCost = parsePositiveInt(cost);
    if (!safeCost || safeCost > 20) {
      return res.status(400).json({ msg: "Cost must be between 1 and 20" });
    }

    const safeWindowLimit = windowLimit == null ? null : parsePositiveInt(windowLimit);
    if (windowLimit != null && !safeWindowLimit) {
      return res.status(400).json({ msg: "windowLimit must be a positive integer" });
    }

    const safeWindowMs = windowMs == null ? null : parsePositiveInt(windowMs);
    if (windowMs != null && (!safeWindowMs || safeWindowMs < 1000)) {
      return res.status(400).json({ msg: "windowMs must be at least 1000" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const existingIndex = user.customRules.findIndex(
      (rule) => rule.endpoint === safeEndpoint && String(rule.method).toUpperCase() === safeMethod
    );

    const nextRule = {
      endpoint: safeEndpoint,
      method: safeMethod,
      cost: safeCost
    };

    if (safeWindowLimit) nextRule.windowLimit = safeWindowLimit;
    if (safeWindowMs) nextRule.windowMs = safeWindowMs;

    if (existingIndex >= 0) {
      user.customRules[existingIndex] = nextRule;
    } else {
      user.customRules.push(nextRule);
    }

    await user.save();
    return res.json({ msg: "Rule upserted", customRules: user.customRules });
  } catch (err) {
    return res.status(500).json({ msg: "Failed to update rules", error: err.message });
  }
});

router.delete("/settings/rules", auth, async (req, res) => {
  try {
    const { endpoint, method = "GET" } = req.body;
    const safeEndpoint = String(endpoint || "").trim();
    if (!safeEndpoint.startsWith("/")) {
      return res.status(400).json({ msg: "Endpoint must start with '/'" });
    }

    const safeMethod = String(method).toUpperCase();
    if (!ALLOWED_METHODS.includes(safeMethod)) {
      return res.status(400).json({ msg: "Invalid HTTP method" });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    user.customRules = user.customRules.filter(
      (rule) => !(rule.endpoint === safeEndpoint && String(rule.method).toUpperCase() === safeMethod)
    );

    await user.save();
    return res.json({ msg: "Rule removed", customRules: user.customRules });
  } catch (err) {
    return res.status(500).json({ msg: "Failed to remove rule", error: err.message });
  }
});

router.get("/limiter-status", auth, (_req, res) => {
  res.json({
    circuitBreaker: circuitBreaker.status()
  });
});

module.exports = router;
