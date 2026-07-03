const { verifyAdmin, setCorsHeaders } = require('../../lib/auth');
const { connectDb } = require('../../lib/db');
const { ObjectId } = require('mongodb');

module.exports = async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;

  if (req.method !== 'PUT') {
    return res.status(405).json({ msg: 'Method not allowed' });
  }

  const admin = await verifyAdmin(req);
  if (!admin) {
    return res.status(403).json({ msg: 'Forbidden' });
  }

  const { id } = req.query;
  const { tier } = req.body;

  if (!id || !tier) {
    return res.status(400).json({ msg: 'User ID and tier are required.' });
  }

  if (tier !== 'FREE' && tier !== 'PRO' && tier !== 'ENTERPRISE') {
    return res.status(400).json({ msg: 'Invalid tier specified.' });
  }

  try {
    const db = await connectDb();
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(id) },
      { $set: { tier } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ msg: 'User not found.' });
    }

    return res.status(200).json({ msg: `User tier upgraded to ${tier}.` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Internal server error.' });
  }
};
