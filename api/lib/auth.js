const jwt = require('jsonwebtoken');
const { connectDb } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

async function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = await connectDb();
    const user = await db.collection('users').findOne({ email: decoded.email });
    return user;
  } catch (err) {
    return null;
  }
}

async function verifyAdmin(req) {
  const user = await verifyToken(req);
  if (!user || user.role !== 'ADMIN') {
    return null;
  }
  return user;
}

module.exports = {
  JWT_SECRET,
  setCorsHeaders,
  verifyToken,
  verifyAdmin
};
