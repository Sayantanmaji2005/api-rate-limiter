const { verifyToken, setCorsHeaders } = require('../lib/auth');
const { connectDb } = require('../lib/db');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ msg: 'Method not allowed' });
  }

  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ msg: 'Unauthorized' });
  }

  try {
    const newApiKey = 'rl_' + crypto.randomBytes(16).toString('hex');
    const db = await connectDb();
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { apiKey: newApiKey } }
    );

    return res.status(200).json({
      msg: 'API Key rotated successfully.',
      apiKey: newApiKey
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Internal server error.' });
  }
};
