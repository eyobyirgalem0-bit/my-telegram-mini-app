// lib/auth.js
// የአድሚን ማረጋገጫ (authentication) እና CORS ረዳት ተግባራት

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_DEV_ONLY_SECRET';
const TOKEN_TTL = '30d'; // የአድሚን session ለ 30 ቀናት ይቆያል

function signAdminToken() {
  return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

// req ውስጥ ካለው Authorization: Bearer <token> ላይ ትክክለኛ የአድሚን ቶክን መኖሩን ያረጋግጣል።
// ትክክል ካልሆነ throw ያደርጋል (ጠሪው catch አድርጎ 401 እንዲመልስ)።
function requireAdmin(req) {
  const header = req.headers['authorization'] || req.headers['Authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    const err = new Error('Unauthorized: no token provided');
    err.statusCode = 401;
    throw err;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') throw new Error('not admin');
    return payload;
  } catch (e) {
    const err = new Error('Unauthorized: invalid or expired token');
    err.statusCode = 401;
    throw err;
  }
}

// ኮርስ (CORS) ራስጌዎችን ያዘጋጃል፣ ስለዚህ ፊት-ለፊት ኮዱ (index.html/admin.html) ከየትኛውም
// domain (ለምሳሌ GitHub Pages ወይም ራሱ Telegram) ቢስተናገድ ወደ API መድረስ ይችላል።
function setCors(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// OPTIONS preflight ጥያቄዎችን በራስ-ሰር ይመልሳል። true ከመለሰ ጠሪው ወዲያውኑ return ማድረግ አለበት።
function handlePreflight(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

function sendError(res, err) {
  const status = err.statusCode || 500;
  console.error(err);
  res.status(status).json({ error: err.message || 'Internal server error' });
}

module.exports = { signAdminToken, requireAdmin, setCors, handlePreflight, sendError };
