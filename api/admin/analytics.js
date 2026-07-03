const { verifyAdmin, setCorsHeaders } = require('../lib/auth');
const { connectDb } = require('../lib/db');

module.exports = async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ msg: 'Method not allowed' });
  }

  const admin = await verifyAdmin(req);
  if (!admin) {
    return res.status(403).json({ msg: 'Forbidden' });
  }

  try {
    const db = await connectDb();
    const logs = await db.collection('analytics')
      .find()
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();

    return res.status(200).json(logs);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Internal server error.' });
  }
};
