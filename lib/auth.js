// lib/auth.js
// የአድሚን ማረጋገጫ (authentication) እና CORS ረዳት ተግባራት

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// ማስጠንቀቂያ፦ JWT_SECRET ላይ default/hardcoded ዋጋ በጭራሽ አናስቀምጥም።
// ቀደም ብሎ የነበረው 'CHANGE_ME_DEV_ONLY_SECRET' የሚል default፣ ማንም ሰው (ይህን ኮድ ካየ)
// የ admin JWT token በቀላሉ ራሱ መፍጠር (forge) እንዲችል ያደርገዋል፣ በተለይ Environment
// Variable ማዘጋጀት ቢረሱ። ስለዚህ አልተዘጋጀም ከሆነ ወዲያውኑ ስህተት (error) እንጥላለን።
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = '30d'; // የአድሚን session ለ 30 ቀናት ይቆያል

function getJwtSecret() {
  if (!JWT_SECRET) {
    throw Object.assign(
      new Error('Server misconfigured: JWT_SECRET environment variable is not set'),
      { statusCode: 500 }
    );
  }
  return JWT_SECRET;
}

function signAdminToken() {
  return jwt.sign({ role: 'admin' }, getJwtSecret(), { expiresIn: TOKEN_TTL });
}

// Password ማወዳደሪያ በ timing-safe መንገድ (constant-time comparison)፣ ርዝመቱ የተለያዬ
// ቢሆንም እንኳ ጥቃት ፈጻሚው ከምላሽ ጊዜ (response timing) ምንም መረጃ እንዳያገኝ ለመከላከል።
function safeCompare(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) {
    // ርዝመታቸው ካልተመሳሰለ crypto.timingSafeEqual ይወድቃል (throw ያደርጋል)፣
    // ስለዚህ ተመሳሳይ ርዝመት ካለው dummy buffer ጋር በማወዳደር ጊዜውን እናስተካክላለን።
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
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
    const payload = jwt.verify(token, getJwtSecret());
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
  // X-Telegram-Init-Data: ፊት-ለፊት ኮዱ የ Telegram Mini App initData የሚልክበት custom
  // header ስለሆነ፣ browser cross-origin preflight ላይ እንዳይታገድ እዚህ መፈቀድ አለበት።
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
