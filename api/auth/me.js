const { verifyToken, setCorsHeaders } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ msg: 'Method not allowed' });
  }

  const user = await verifyToken(req);
  if (!user) {
    return res.status(401).json({ msg: 'Unauthorized' });
  }

  return res.status(200).json({
    user: {
      email: user.email,
      role: user.role,
      tier: user.tier,
      rateLimitAlgorithm: user.rateLimitAlgorithm || 'TOKEN_BUCKET',
      isWhitelisted: user.isWhitelisted || false,
      isBlacklisted: user.isBlacklisted || false,
      customRules: user.customRules || {}
    },
    apiKey: user.apiKey
  });
};
