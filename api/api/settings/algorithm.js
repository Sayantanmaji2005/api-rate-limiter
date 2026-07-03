const { verifyToken, setCorsHeaders } = require('../../lib/auth');
const { connectDb } = require('../../lib/db');

module.exports = async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;

  if (req.method !== 'PUT') {
    return res.status(405).json({ msg: 'Method not allowed' });
  }

  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ msg: 'Unauthorized' });
  }

  const { algorithm } = req.body;
  if (!algorithm || (algorithm !== 'TOKEN_BUCKET' && algorithm !== 'SLIDING_WINDOW')) {
    return res.status(400).json({ msg: 'Invalid algorithm specified. Must be TOKEN_BUCKET or SLIDING_WINDOW.' });
  }

  try {
    const db = await connectDb();
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { rateLimitAlgorithm: algorithm } }
    );

    return res.status(200).json({ msg: 'Rate limiting algorithm updated.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Internal server error.' });
  }
};
