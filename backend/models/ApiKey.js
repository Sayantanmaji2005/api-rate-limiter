const mongoose = require("mongoose");

const apiKeySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  key: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("ApiKey", apiKeySchema);
