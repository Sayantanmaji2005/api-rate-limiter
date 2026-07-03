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

  const { endpoint, cost } = req.body;
  if (!endpoint || cost === undefined || cost === null) {
    return res.status(400).json({ msg: 'Endpoint and cost are required.' });
  }

  try {
    const db = await connectDb();
    
    // Update the customRules object dynamically
    const updateField = {};
    updateField[`customRules.${endpoint}`] = Number(cost);

    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: updateField }
    );

    return res.status(200).json({ msg: `Custom rule saved: ${endpoint} now costs ${cost} tokens.` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Internal server error.' });
  }
};
