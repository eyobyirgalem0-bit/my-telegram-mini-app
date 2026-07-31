// POST /api/auth/login
// Body: { password: string }
// Response: { token: string }
//
// ⚠️ ዋናው ችግር (root cause) ይህ ነበር፦
// ከዚህ በፊት ይህ ፋይል `safeCompare` ን ከ ../../lib/auth ይጠራ ነበር። በ Vercel ላይ
// የተለቀቀው (deployed) lib/auth.js ግን አሮጌ ስሪት ስለሆነ `safeCompare` አልነበረውም፣
// ስለዚህ ሰርቨሩ "safeCompare is not a function" የሚል HTTP 500 ይመልስ ነበር።
// admin.html ደግሞ ማንኛውንም ስህተት "የተሳሳተ የይለፍ ቃል" ብሎ ያሳይ ስለነበር ትክክለኛው
// የይለፍ ቃል እንኳ ሲገባ "የተሳሳተ የይለፍ ቃል" ይመስል ነበር።
//
// መፍትሄው፦ የ password ማወዳደሪያው ከ lib/auth.js ጥገኝነት ወጥቶ በዚህ ፋይል ውስጥ
// ራሱን ችሎ (self-contained) ተቀምጧል፣ እንዲሁም jwt.sign እዚሁ ይሰራል። በዚህም
// አሮጌም አዲስም lib/auth.js ቢኖር ይህ endpoint ይሰራል።

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const TOKEN_TTL = '30d'; // የአድሚን session ለ 30 ቀናት ይቆያል

function setCors(res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Init-Data');
  res.setHeader('Cache-Control', 'no-store');
}

// timing-safe የ password ማወዳደሪያ (ርዝመት ቢለያይም ስህተት አይጥልም)
function safeCompareLocal(a, b) {
  const bufA = Buffer.from(String(a == null ? '' : a), 'utf8');
  const bufB = Buffer.from(String(b == null ? '' : b), 'utf8');
  if (bufA.length !== bufB.length) {
    // ርዝመቱ ካልተመሳሰለ timingSafeEqual ይወድቃል፣ ስለዚህ dummy compare አድርገን false
    try { crypto.timingSafeEqual(bufA, bufA); } catch (e) { /* ignore */ }
    return false;
  }
  if (bufA.length === 0) return false; // ባዶ የይለፍ ቃል በጭራሽ አይፈቀድም
  return crypto.timingSafeEqual(bufA, bufB);
}

// req.body በ Vercel ላይ ሁልጊዜ parsed object አይሆንም (string ወይም ባዶ ሊሆን ይችላል)።
// ስለዚህ በሁሉም ሁኔታ የሚሰራ አስተማማኝ parser።
async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.length) {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { return {}; }
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    const JWT_SECRET = process.env.JWT_SECRET;

    // የ Environment Variable ስህተቶች በግልጽ ይነገሩ (ከዚህ በፊት "wrong password" ይመስሉ ነበር)
    if (!ADMIN_PASSWORD) {
      res.status(500).json({ error: 'Server misconfigured: ADMIN_PASSWORD is not set in Vercel Environment Variables' });
      return;
    }
    if (!JWT_SECRET) {
      res.status(500).json({ error: 'Server misconfigured: JWT_SECRET is not set in Vercel Environment Variables' });
      return;
    }

    const body = await readJsonBody(req);
    // የ password መጀመሪያና መጨረሻ ላይ ያለ ባዶ ቦታ (space) በስህተት እንዳይገባ ይቆረጣል
    const password = typeof body.password === 'string' ? body.password.trim() : '';

    if (!safeCompareLocal(password, String(ADMIN_PASSWORD).trim())) {
      res.status(401).json({ error: 'የተሳሳተ የይለፍ ቃል / Wrong password' });
      return;
    }

    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: TOKEN_TTL });
    res.status(200).json({ token });
  } catch (err) {
    console.error('[api/auth/login]', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
