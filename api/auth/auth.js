// lib/auth.js
// የአድሚን ማረጋገጫ (authentication) እና CORS ረዳት ተግባራት
//
// በ Vercel ላይ የተለቀቀው አሮጌው ስሪት `safeCompare` ን export አላደረገም ነበር፣
// ስለዚህ /api/auth/login "safeCompare is not a function" የሚል 500 ይመልስ ነበር።
// ይህ ስሪት safeCompare ን ጨምሮ ሁሉንም ተግባራት በትክክል export ያደርጋል።

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// ማስጠንቀቂያ፦ JWT_SECRET ላይ default/hardcoded ዋጋ በጭራሽ አናስቀምጥም።
const TOKEN_TTL = '30d'; // የአድሚን session ለ 30 ቀናት ይቆያል

function getJwtSecret() {
  // process.env ን በጥሪ ጊዜ እናነባለን (module load ጊዜ ላይ ብቻ አይደለም)፣
  // ስለዚህ Environment Variable ከተጨመረ በኋላ ወዲያውኑ ይሰራል።
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw Object.assign(
      new Error('Server misconfigured: JWT_SECRET environment variable is not set'),
      { statusCode: 500 }
    );
  }
  return secret;
}

function signAdminToken() {
  return jwt.sign({ role: 'admin' }, getJwtSecret(), { expiresIn: TOKEN_TTL });
}

// Password ማወዳደሪያ በ timing-safe መንገድ (constant-time comparison)
function safeCompare(a, b) {
  const bufA = Buffer.from(String(a == null ? '' : a), 'utf8');
  const bufB = Buffer.from(String(b == null ? '' : b), 'utf8');
  if (bufA.length !== bufB.length) {
    try { crypto.timingSafeEqual(bufA, bufA); } catch (e) { /* ignore */ }
    return false;
  }
  if (bufA.length === 0) return false; // ባዶ የይለፍ ቃል በጭራሽ አይፈቀድም
  return crypto.timingSafeEqual(bufA, bufB);
}

// req ውስጥ ካለው Authorization: Bearer <token> ላይ ትክክለኛ የአድሚን ቶክን መኖሩን ያረጋግጣል።
function requireAdmin(req) {
  const header = req.headers['authorization'] || req.headers['Authorization'];
  if (!header || !String(header).startsWith('Bearer ')) {
    const err = new Error('Unauthorized: no token provided');
    err.statusCode = 401;
    throw err;
  }
  const token = String(header).slice(7).trim();
  try {
    const payload = jwt.verify(token, getJwtSecret());
    if (payload.role !== 'admin') throw new Error('not admin');
    return payload;
  } catch (e) {
    // JWT_SECRET ካልተዘጋጀ 500 ን እንደዛው እናሳልፋለን (401 ብለን አናሳስት)
    if (e.statusCode === 500) throw e;
    const err = new Error('Unauthorized: invalid or expired token');
    err.statusCode = 401;
    throw err;
  }
}

// CORS ራስጌዎች — index.html/admin.html ከየትኛውም domain ቢስተናገድ ወደ API መድረስ ይችላል።
function setCors(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Init-Data');
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

module.exports = { signAdminToken, requireAdmin, setCors, handlePreflight, sendError, safeCompare };
