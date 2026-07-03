const { verifyToken, setCorsHeaders } = require('../lib/auth');
const { checkRateLimit, logAnalytics } = require('../lib/limiter');

module.exports = async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ msg: 'Method not allowed' });
  }

  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ msg: 'Unauthorized' });
  }

  const startTime = Date.now();
  const endpoint = '/api/data';
  const method = 'GET';
  const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '127.0.0.1';

  try {
    const rateCheck = await checkRateLimit(user, clientIp, endpoint, method, 1);
    const latency = Date.now() - startTime;

    await logAnalytics(user, endpoint, method, rateCheck.allowed, rateCheck.algorithm, rateCheck.cost || 1, latency);

    if (!rateCheck.allowed) {
      res.setHeader('Retry-After', String(rateCheck.retryAfter || 1));
      return res.status(429).json({
        msg: 'Rate limit exceeded.',
        rateLimit: {
          remaining: rateCheck.remaining,
          allowed: false
        }
      });
    }

    return res.status(200).json({
      message: 'Protected API Access Granted: Hello from Vercel Serverless!',
      rateLimit: {
        remaining: rateCheck.remaining,
        allowed: true
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Internal server error.' });
  }
};
