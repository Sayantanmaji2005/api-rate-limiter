const { verifyAdmin, setCorsHeaders } = require('../../../lib/auth');
const { connectDb } = require('../../../lib/db');
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
  const { algorithm } = req.body;

  if (!id || !algorithm) {
    return res.status(400).json({ msg: 'User ID and algorithm are required.' });
  }

  if (algorithm !== 'TOKEN_BUCKET' && algorithm !== 'SLIDING_WINDOW') {
    return res.status(400).json({ msg: 'Invalid algorithm specified.' });
  }

  try {
    const db = await connectDb();
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(id) },
      { $set: { rateLimitAlgorithm: algorithm } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ msg: 'User not found.' });
    }

    return res.status(200).json({ msg: 'Algorithm updated successfully.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Internal server error.' });
  }
};
