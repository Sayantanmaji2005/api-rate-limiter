const express = require("express");
const mongoose = require("mongoose");
const Analytics = require("../models/Analytics");
const User = require("../models/User");
const auth = require("../middleware/auth");

const router = express.Router();

const tiers = ["FREE", "PRO", "ENTERPRISE"];
const algorithms = ["TOKEN_BUCKET", "SLIDING_WINDOW"];

const requireAdmin = async (req, res, next) => {
  try {
    const requester = await User.findById(req.user.id);
    if (!requester || requester.role !== "ADMIN") {
      return res.status(403).json({ msg: "Access denied: Admins only" });
    }
    return next();
  } catch (err) {
    return res.status(500).json({ msg: "Admin check failed", error: err.message });
  }
};

router.get("/users", auth, requireAdmin, async (_req, res) => {
  try {
    const users = await User.find(
      {},
      "email role tier rateLimitAlgorithm customRules whitelist blacklist"
    ).sort({ email: 1 });
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ msg: "Failed to load users", error: err.message });
  }
});

router.get("/analytics", auth, requireAdmin, async (req, res) => {
  try {
    const filter = req.query.userId ? { userId: req.query.userId } : {};
    const logs = await Analytics.find(filter).sort({ timestamp: -1 }).limit(100);
    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ msg: "Failed to load analytics", error: err.message });
  }
});

router.get("/analytics/summary", auth, requireAdmin, async (req, res) => {
  try {
    let match = {};
    if (req.query.userId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.userId)) {
        return res.status(400).json({ msg: "Invalid userId" });
      }
      match = { userId: new mongoose.Types.ObjectId(req.query.userId) };
    }
    const [summary] = await Analytics.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          allowedRequests: { $sum: { $cond: ["$allowed", 1, 0] } },
          blockedRequests: { $sum: { $cond: ["$allowed", 0, 1] } },
          avgLatencyMs: { $avg: "$latencyMs" }
        }
      }
    ]);
    const uniqueUsers = await Analytics.distinct("userId", match);

    return res.json({
      totalRequests: summary?.totalRequests || 0,
      allowedRequests: summary?.allowedRequests || 0,
      blockedRequests: summary?.blockedRequests || 0,
      avgLatencyMs: Number((summary?.avgLatencyMs || 0).toFixed(2)),
      impactedUsers: uniqueUsers.length
    });
  } catch (err) {
    return res.status(500).json({ msg: "Failed to load analytics summary", error: err.message });
  }
});

router.put("/upgrade/:id", auth, async (req, res) => {
  try {
    const requester = await User.findById(req.user.id).select("role");
    if (requester?.role !== "ADMIN") {
      return res.status(403).json({ msg: "Access denied: admins only" });
    }

    const { tier } = req.body;
    if (!tiers.includes(tier)) {
      return res.status(400).json({ msg: "Invalid tier value" });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { tier }, { new: true }).select(
      "email role tier whitelist blacklist"
    );

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    return res.json(user);
  } catch (err) {
    return res.status(500).json({ msg: "Failed to update tier", error: err.message });
  }
});

router.put("/users/:id/algorithm", auth, requireAdmin, async (req, res) => {
  try {
    const { algorithm } = req.body;
    if (!algorithms.includes(algorithm)) {
      return res.status(400).json({ msg: "Invalid algorithm" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { rateLimitAlgorithm: algorithm },
      { new: true }
    ).select("email role tier rateLimitAlgorithm whitelist blacklist");

    if (!user) return res.status(404).json({ msg: "User not found" });
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ msg: "Failed to update algorithm", error: err.message });
  }
});

const updateIpPolicy = async (req, res, field) => {
  const { ip, action } = req.body;
  if (!ip || !["add", "remove"].includes(action)) {
    return res.status(400).json({ msg: "Provide valid ip and action(add/remove)" });
  }

  const update = action === "add" ? { $addToSet: { [field]: ip } } : { $pull: { [field]: ip } };
  const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select(
    "email role tier rateLimitAlgorithm whitelist blacklist"
  );

  if (!user) return res.status(404).json({ msg: "User not found" });
  return res.json(user);
};

router.put("/users/:id/whitelist", auth, requireAdmin, async (req, res) => {
  try {
    return await updateIpPolicy(req, res, "whitelist");
  } catch (err) {
    return res.status(500).json({ msg: "Failed to update whitelist", error: err.message });
  }
});

router.put("/users/:id/blacklist", auth, requireAdmin, async (req, res) => {
  try {
    return await updateIpPolicy(req, res, "blacklist");
  } catch (err) {
    return res.status(500).json({ msg: "Failed to update blacklist", error: err.message });
  }
});

module.exports = router;
