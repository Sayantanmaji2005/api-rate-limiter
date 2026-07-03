const bcrypt = require('bcryptjs');
const { connectDb } = require('../lib/db');
const { setCorsHeaders } = require('../lib/auth');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ msg: 'Method not allowed' });
  }

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ msg: 'Email and password are required.' });
  }

  try {
    const db = await connectDb();
    const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ msg: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const apiKey = 'rl_' + crypto.randomBytes(16).toString('hex');
    const role = email.toLowerCase() === 'admin@ratelimiter.com' ? 'ADMIN' : 'USER';
    const tier = role === 'ADMIN' ? 'ADMIN' : 'FREE';

    const newUser = {
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      tier,
      apiKey,
      rateLimitAlgorithm: 'TOKEN_BUCKET',
      isWhitelisted: false,
      isBlacklisted: false,
      customRules: {},
      createdAt: new Date()
    };

    await db.collection('users').insertOne(newUser);

    return res.status(201).json({
      msg: 'Registration successful.',
      apiKey
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Internal server error.' });
  }
};
