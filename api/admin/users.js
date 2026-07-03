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
    const users = await db.collection('users').find().toArray();
    
    const enrichedUsers = await Promise.all(users.map(async (u) => {
      const stats = await db.collection('analytics').aggregate([
        { $match: { userId: u._id } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            allowed: { $sum: { $cond: [{ $eq: ['$allowed', true] }, 1, 0] } },
            blocked: { $sum: { $cond: [{ $eq: ['$allowed', false] }, 1, 0] } }
          }
        }
      ]).toArray();

      const userStats = stats[0] || { total: 0, allowed: 0, blocked: 0 };

      return {
        _id: u._id.toString(),
        email: u.email,
        role: u.role,
        tier: u.tier,
        rateLimitAlgorithm: u.rateLimitAlgorithm || 'TOKEN_BUCKET',
        whitelist: u.whitelist || [],
        blacklist: u.blacklist || [],
        totalRequests: userStats.total,
        allowedRequests: userStats.allowed,
        blockedRequests: userStats.blocked
      };
    }));

    return res.status(200).json(enrichedUsers);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Internal server error.' });
  }
};
