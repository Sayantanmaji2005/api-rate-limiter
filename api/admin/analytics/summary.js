const { verifyAdmin, setCorsHeaders } = require('../../lib/auth');
const { connectDb } = require('../../lib/db');

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
    
    // Aggregation pipeline to calculate overall metrics
    const stats = await db.collection('analytics').aggregate([
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          blockedRequests: { $sum: { $cond: [{ $eq: ['$allowed', false] }, 1, 0] } },
          avgLatencyMs: { $avg: '$latencyMs' }
        }
      }
    ]).toArray();

    // Aggregation to find how many unique users have faced rate limits (blocked requests)
    const blockedUsersStats = await db.collection('analytics').aggregate([
      { $match: { allowed: false } },
      { $group: { _id: '$userId' } },
      { $count: 'count' }
    ]).toArray();

    const summary = stats[0] || {
      totalRequests: 0,
      blockedRequests: 0,
      avgLatencyMs: 0
    };

    const impactedUsers = blockedUsersStats[0]?.count || 0;

    return res.status(200).json({
      totalRequests: summary.totalRequests,
      blockedRequests: summary.blockedRequests,
      avgLatencyMs: Math.round(summary.avgLatencyMs || 0),
      impactedUsers
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Internal server error.' });
  }
};
