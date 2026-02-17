const mongoose = require("mongoose");

const analyticsSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  endpoint: String,
  method: String,
  algorithm: String,
  cost: Number,
  allowed: { type: Boolean, default: true },
  reason: String,
  ip: String,
  userAgent: String,
  latencyMs: Number,
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Analytics", analyticsSchema);
