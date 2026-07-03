const { verifyToken, setCorsHeaders } = require('../lib/auth');
const { checkRateLimit, logAnalytics, getCircuitBreaker, recordSuccess, recordFailure } = require('../lib/limiter');

module.exports = async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ msg: 'Method not allowed' });
  }

  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ msg: 'Unauthorized' });
  }

  // Check Circuit Breaker Status first
  const cb = await getCircuitBreaker();
  if (cb.state === 'OPEN') {
    return res.status(503).json({
      message: `Circuit Breaker is OPEN. Con consecutive failures: ${cb.failureCount}. Try again in 15 seconds.`,
      circuitBreaker: {
        state: 'OPEN',
        failureCount: cb.failureCount
      }
    });
  }

  const startTime = Date.now();
  const endpoint = '/api/heavy-data';
  const method = 'GET';
  const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '127.0.0.1';

  try {
    // Check Rate Limit (cost 5 by default, or read user's custom cost rule)
    const rateCheck = await checkRateLimit(user, clientIp, endpoint, method, 5);
    const latency = Date.now() - startTime;

    await logAnalytics(user, endpoint, method, rateCheck.allowed, rateCheck.algorithm, rateCheck.cost || 5, latency);

    if (!rateCheck.allowed) {
      res.setHeader('Retry-After', String(rateCheck.retryAfter || 1));
      return res.status(429).json({
        msg: 'Heavy endpoint blocked by rate limit.',
        rateLimit: {
          remaining: rateCheck.remaining,
          allowed: false
        }
      });
    }

    // Simulate dependency execution
    // To allow testing, if URL contains query parameter ?fail=true, trigger failure
    const shouldFail = req.query.fail === 'true' || Math.random() < 0.25; // 25% random fail chance to show circuit breaker in action
    
    if (shouldFail) {
      await recordFailure();
      return res.status(500).json({
        message: 'Mock backend service error (Dependency failure). Recorded by Circuit Breaker.',
        circuitBreaker: {
          state: (await getCircuitBreaker()).state
        }
      });
    } else {
      await recordSuccess();
      return res.status(200).json({
        message: 'Heavy data served successfully. Circuit Breaker is healthy.',
        rateLimit: {
          remaining: rateCheck.remaining,
          allowed: true
        }
      });
    }
  } catch (err) {
    console.error(err);
    await recordFailure();
    return res.status(500).json({ msg: 'Internal server error.' });
  }
};
