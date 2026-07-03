const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { connectDb } = require('./lib/db');
const { JWT_SECRET, setCorsHeaders, verifyToken } = require('./lib/auth');

module.exports = async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  try {
    // 1. REGISTER
    if (pathname === '/auth/register' && req.method === 'POST') {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ msg: 'Email and password are required.' });
      }

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
        whitelist: [],
        blacklist: [],
        customRules: {},
        createdAt: new Date()
      };

      await db.collection('users').insertOne(newUser);
      return res.status(201).json({ msg: 'Registration successful.', apiKey });
    }

    // 2. LOGIN
    if (pathname === '/auth/login' && req.method === 'POST') {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ msg: 'Email and password are required.' });
      }

      const db = await connectDb();
      const user = await db.collection('users').findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(400).json({ msg: 'Invalid email or password.' });
      }

      const matches = await bcrypt.compare(password, user.password);
      if (!matches) {
        return res.status(400).json({ msg: 'Invalid email or password.' });
      }

      const token = jwt.sign({ email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      return res.status(200).json({ msg: 'Login successful.', token });
    }

    // 3. ME (Profile info)
    if (pathname === '/auth/me' && req.method === 'GET') {
      const user = await verifyToken(req);
      if (!user) {
        return res.status(401).json({ msg: 'Unauthorized' });
      }
      return res.status(200).json({
        user: {
          email: user.email,
          role: user.role,
          tier: user.tier,
          rateLimitAlgorithm: user.rateLimitAlgorithm || 'TOKEN_BUCKET',
          whitelist: user.whitelist || [],
          blacklist: user.blacklist || [],
          customRules: user.customRules || {}
        },
        apiKey: user.apiKey
      });
    }

    // 4. ROTATE API KEY
    if (pathname === '/auth/rotate-api-key' && req.method === 'POST') {
      const user = await verifyToken(req);
      if (!user) {
        return res.status(401).json({ msg: 'Unauthorized' });
      }

      const newApiKey = 'rl_' + crypto.randomBytes(16).toString('hex');
      const db = await connectDb();
      await db.collection('users').updateOne(
        { _id: user._id },
        { $set: { apiKey: newApiKey } }
      );
      return res.status(200).json({ msg: 'API Key rotated successfully.', apiKey: newApiKey });
    }

    // Fallback
    return res.status(404).json({ msg: 'Not found' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Internal server error.' });
  }
};
