const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const ApiKey = require("../models/ApiKey");
const auth = require("../middleware/auth");

const router = express.Router();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

router.post("/register", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ msg: "Email and password are required" });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ msg: "Invalid email format" });
    }
    if (password.length < 8) {
      return res.status(400).json({ msg: "Password must be at least 8 characters" });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ msg: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      password: hashed
    });

    const apiKey = crypto.randomBytes(32).toString("hex");
    await ApiKey.create({
      userId: user._id,
      key: apiKey
    });

    return res.json({ message: "Registered", apiKey });
  } catch (err) {
    return res.status(400).json({ msg: "Registration failed", error: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ msg: "Email and password are required" });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ msg: "Invalid email format" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d"
    });

    return res.json({ token });
  } catch (err) {
    return res.status(500).json({ msg: "Login failed", error: err.message });
  }
});

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    const apiKey = await ApiKey.findOne({ userId: req.user.id });
    res.json({ user, apiKey: apiKey ? apiKey.key : null });
  } catch (err) {
    res.status(500).json({ msg: "Server Error" });
  }
});

router.post("/rotate-api-key", auth, async (req, res) => {
  try {
    const nextKey = crypto.randomBytes(32).toString("hex");
    const record = await ApiKey.findOneAndUpdate(
      { userId: req.user.id },
      { key: nextKey },
      { upsert: true, new: true }
    );

    return res.json({
      msg: "API key rotated",
      apiKey: record.key
    });
  } catch (err) {
    return res.status(500).json({ msg: "Failed to rotate API key", error: err.message });
  }
});

module.exports = router;
