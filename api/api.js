const { verifyToken, setCorsHeaders } = require('./lib/auth');
const { connectDb } = require('./lib/db');
const { checkRateLimit, logAnalytics, getCircuitBreaker, recordSuccess, recordFailure } = require('./lib/limiter');

module.exports = async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;

  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ msg: 'Unauthorized' });
  }

  const route = req.query.route;
  const method = req.method;

  try {
    const db = await connectDb();

    // 1. GET /api/data
    if (route === 'data' && method === 'GET') {
      const startTime = Date.now();
      const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '127.0.0.1';
      
      const rateCheck = await checkRateLimit(user, clientIp, '/api/data', 'GET', 1);
      const latency = Date.now() - startTime;

      await logAnalytics(user, '/api/data', 'GET', rateCheck.allowed, rateCheck.algorithm, rateCheck.cost || 1, latency);

      if (!rateCheck.allowed) {
        res.setHeader('Retry-After', String(rateCheck.retryAfter || 1));
        return res.status(429).json({
          msg: 'Rate limit exceeded.',
          rateLimit: { remaining: rateCheck.remaining, allowed: false }
        });
      }

      return res.status(200).json({
        message: 'Protected API Access Granted: Hello from Vercel Serverless!',
        rateLimit: { remaining: rateCheck.remaining, allowed: true }
      });
    }

    // 2. GET /api/heavy-data
    if (route === 'heavy-data' && method === 'GET') {
      const cb = await getCircuitBreaker();
      if (cb.state === 'OPEN') {
        return res.status(503).json({
          message: `Circuit Breaker is OPEN. Consecutive failures: ${cb.failureCount}. Try again in 15 seconds.`,
          circuitBreaker: { state: 'OPEN', failureCount: cb.failureCount }
        });
      }

      const startTime = Date.now();
      const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '127.0.0.1';

      const rateCheck = await checkRateLimit(user, clientIp, '/api/heavy-data', 'GET', 5);
      const latency = Date.now() - startTime;

      await logAnalytics(user, '/api/heavy-data', 'GET', rateCheck.allowed, rateCheck.algorithm, rateCheck.cost || 5, latency);

      if (!rateCheck.allowed) {
        res.setHeader('Retry-After', String(rateCheck.retryAfter || 1));
        return res.status(429).json({
          msg: 'Heavy endpoint blocked by rate limit.',
          rateLimit: { remaining: rateCheck.remaining, allowed: false }
        });
      }

      const shouldFail = req.query.fail === 'true' || Math.random() < 0.25;

      if (shouldFail) {
        await recordFailure();
        return res.status(500).json({
          message: 'Mock backend service error (Dependency failure). Recorded by Circuit Breaker.',
          circuitBreaker: { state: (await getCircuitBreaker()).state }
        });
      } else {
        await recordSuccess();
        return res.status(200).json({
          message: 'Heavy data served successfully. Circuit Breaker is healthy.',
          rateLimit: { remaining: rateCheck.remaining, allowed: true }
        });
      }
    }

    // 3. GET /api/analytics
    if (route === 'analytics' && method === 'GET') {
      const logs = await db.collection('analytics')
        .find({ userId: user._id })
        .sort({ timestamp: -1 })
        .limit(50)
        .toArray();
      return res.status(200).json(logs);
    }

    // 4. GET /api/analytics/summary
    if (route === 'analytics/summary' && method === 'GET') {
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

      const summary = stats[0] || { totalRequests: 0, blockedRequests: 0, avgLatencyMs: 0 };
      return res.status(200).json({
        totalRequests: summary.totalRequests,
        blockedRequests: summary.blockedRequests,
        avgLatencyMs: Math.round(summary.avgLatencyMs || 0)
      });
    }

    // 5. PUT /api/settings/algorithm
    if (route === 'settings/algorithm' && method === 'PUT') {
      const { algorithm } = req.body;
      if (!algorithm || (algorithm !== 'TOKEN_BUCKET' && algorithm !== 'SLIDING_WINDOW')) {
        return res.status(400).json({ msg: 'Invalid algorithm specified.' });
      }

      await db.collection('users').updateOne(
        { _id: user._id },
        { $set: { rateLimitAlgorithm: algorithm } }
      );
      return res.status(200).json({ msg: 'Rate limiting algorithm updated.' });
    }

    // 6. PUT /api/settings/rules
    if (route === 'settings/rules' && method === 'PUT') {
      const { endpoint, cost } = req.body;
      if (!endpoint || cost === undefined || cost === null) {
        return res.status(400).json({ msg: 'Endpoint and cost are required.' });
      }

      const updateField = {};
      updateField[`customRules.${endpoint}`] = Number(cost);

      await db.collection('users').updateOne(
        { _id: user._id },
        { $set: updateField }
      );
      return res.status(200).json({ msg: `Custom rule saved.` });
    }

    // 7. GET /api/limiter-status
    if (route === 'limiter-status' && method === 'GET') {
      const cb = await getCircuitBreaker();
      return res.status(200).json({
        circuitBreaker: { state: cb.state, failureCount: cb.failureCount }
      });
    }

    return res.status(404).json({ msg: 'Not found' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Internal server error.' });
  }
};
