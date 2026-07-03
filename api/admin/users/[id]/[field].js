const { verifyAdmin, setCorsHeaders } = require('../../../lib/auth');
const { connectDb } = require('../../../lib/db');
const { ObjectId } = require('mongodb');

module.exports = async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;

  if (req.method !== 'PUT') {
    return res.status(405).json({ msg: 'Method not allowed' });
  }

  const admin = await verifyAdmin(req);
  if (!admin) {
    return res.status(403).json({ msg: 'Forbidden' });
  }

  const { id, field } = req.query;
  const { ip, action } = req.body;

  if (!id || !field || !ip || !action) {
    return res.status(400).json({ msg: 'ID, field, ip, and action are required.' });
  }

  if (field !== 'whitelist' && field !== 'blacklist') {
    return res.status(400).json({ msg: 'Invalid field specified. Must be whitelist or blacklist.' });
  }

  if (action !== 'add' && action !== 'remove') {
    return res.status(400).json({ msg: 'Invalid action. Must be add or remove.' });
  }

  try {
    const db = await connectDb();
    
    let updateQuery;
    if (action === 'add') {
      updateQuery = { $addToSet: { [field]: ip } };
    } else {
      updateQuery = { $pull: { [field]: ip } };
    }

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(id) },
      updateQuery
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ msg: 'User not found.' });
    }

    return res.status(200).json({ msg: `IP successfully ${action === 'add' ? 'added to' : 'removed from'} ${field}.` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Internal server error.' });
  }
};
