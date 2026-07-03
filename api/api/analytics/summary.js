const { verifyToken, setCorsHeaders } = require('../../lib/auth');
const { connectDb } = require('../../lib/db');

module.exports = async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ msg: 'Method not allowed' });
  }

  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ msg: 'Unauthorized' });
  }

  try {
    const db = await connectDb();
    
    // Aggregation pipeline to get summary stats
    const stats = await db.collection('analytics').aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          blockedRequests: { $sum: { $cond: [{ $eq: ['$allowed', false] }, 1, 0] } },
          avgLatencyMs: { $avg: '$latencyMs' }
        }
      }
    ]).toArray();

    const summary = stats[0] || {
      totalRequests: 0,
      blockedRequests: 0,
      avgLatencyMs: 0
    };

    return res.status(200).json({
      totalRequests: summary.totalRequests,
      blockedRequests: summary.blockedRequests,
      avgLatencyMs: Math.round(summary.avgLatencyMs || 0)
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Internal server error.' });
  }
};
