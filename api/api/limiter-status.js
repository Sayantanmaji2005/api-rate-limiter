const { verifyToken, setCorsHeaders } = require('../lib/auth');
const { getCircuitBreaker } = require('../lib/limiter');

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
    const cb = await getCircuitBreaker();
    return res.status(200).json({
      circuitBreaker: {
        state: cb.state,
        failureCount: cb.failureCount
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Internal server error.' });
  }
};
