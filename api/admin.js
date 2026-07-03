const { verifyAdmin, setCorsHeaders } = require('./lib/auth');
const { connectDb } = require('./lib/db');
const { ObjectId } = require('mongodb');

module.exports = async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;

  const admin = await verifyAdmin(req);
  if (!admin) {
    return res.status(403).json({ msg: 'Forbidden' });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  try {
    const db = await connectDb();

    // 1. GET /api/admin/users
    if (pathname === '/api/admin/users' && method === 'GET') {
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
    }

    // 2. GET /api/admin/analytics
    if (pathname === '/api/admin/analytics' && method === 'GET') {
      const logs = await db.collection('analytics')
        .find()
        .sort({ timestamp: -1 })
        .limit(50)
        .toArray();
      return res.status(200).json(logs);
    }

    // 3. GET /api/admin/analytics/summary
    if (pathname === '/api/admin/analytics/summary' && method === 'GET') {
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

      const blockedUsersStats = await db.collection('analytics').aggregate([
        { $match: { allowed: false } },
        { $group: { _id: '$userId' } },
        { $count: 'count' }
      ]).toArray();

      const summary = stats[0] || { totalRequests: 0, blockedRequests: 0, avgLatencyMs: 0 };
      const impactedUsers = blockedUsersStats[0]?.count || 0;

      return res.status(200).json({
        totalRequests: summary.totalRequests,
        blockedRequests: summary.blockedRequests,
        avgLatencyMs: Math.round(summary.avgLatencyMs || 0),
        impactedUsers
      });
    }

    // 4. PUT /api/admin/upgrade/:id
    const upgradeMatch = pathname.match(/^\/api\/admin\/upgrade\/([^/]+)$/);
    if (upgradeMatch && method === 'PUT') {
      const id = upgradeMatch[1];
      const { tier } = req.body;

      if (!tier || (tier !== 'FREE' && tier !== 'PRO' && tier !== 'ENTERPRISE')) {
        return res.status(400).json({ msg: 'Invalid tier specified.' });
      }

      const result = await db.collection('users').updateOne(
        { _id: new ObjectId(id) },
        { $set: { tier } }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ msg: 'User not found.' });
      }
      return res.status(200).json({ msg: `User tier upgraded to ${tier}.` });
    }

    // 5. PUT /api/admin/users/:id/algorithm
    const algoMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/algorithm$/);
    if (algoMatch && method === 'PUT') {
      const id = algoMatch[1];
      const { algorithm } = req.body;

      if (!algorithm || (algorithm !== 'TOKEN_BUCKET' && algorithm !== 'SLIDING_WINDOW')) {
        return res.status(400).json({ msg: 'Invalid algorithm specified.' });
      }

      const result = await db.collection('users').updateOne(
        { _id: new ObjectId(id) },
        { $set: { rateLimitAlgorithm: algorithm } }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ msg: 'User not found.' });
      }
      return res.status(200).json({ msg: 'Algorithm updated successfully.' });
    }

    // 6. PUT /api/admin/users/:id/:field (whitelist or blacklist)
    const policyMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/(whitelist|blacklist)$/);
    if (policyMatch && method === 'PUT') {
      const id = policyMatch[1];
      const field = policyMatch[2];
      const { ip, action } = req.body;

      if (!ip || !action || (action !== 'add' && action !== 'remove')) {
        return res.status(400).json({ msg: 'IP and valid action (add/remove) are required.' });
      }

      let updateQuery = action === 'add' ? { $addToSet: { [field]: ip } } : { $pull: { [field]: ip } };

      const result = await db.collection('users').updateOne(
        { _id: new ObjectId(id) },
        updateQuery
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ msg: 'User not found.' });
      }
      return res.status(200).json({ msg: `IP successfully ${action === 'add' ? 'added to' : 'removed from'} ${field}.` });
    }

    return res.status(404).json({ msg: 'Not found' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Internal server error.' });
  }
};
