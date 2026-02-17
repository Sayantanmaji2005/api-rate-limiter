const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: "USER" },
  tier: {
    type: String,
    enum: ["FREE", "PRO", "ENTERPRISE"],
    default: "FREE"
  },
  rateLimitAlgorithm: {
    type: String,
    enum: ["TOKEN_BUCKET", "SLIDING_WINDOW"],
    default: "TOKEN_BUCKET"
  },
  customRules: [
    {
      endpoint: { type: String, required: true },
      method: { type: String, default: "GET" },
      cost: { type: Number, default: 1, min: 1, max: 20 },
      windowLimit: { type: Number, min: 1 },
      windowMs: { type: Number, min: 1000 }
    }
  ],
  whitelist: [String],
  blacklist: [String]
});

module.exports = mongoose.model("User", userSchema);
