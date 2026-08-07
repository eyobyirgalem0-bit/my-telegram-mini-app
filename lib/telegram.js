// lib/telegram.js
// አዲስ ተመዝጋቢ ሲኖር ለአስተዳዳሪው በቴሌግራም ማሳወቂያ ይልካል።
// Bot Token እዚህ server-side ላይ ብቻ ስለሚቀመጥ (Vercel Environment Variable)፣
// ከድሮው localStorage ስሪት በተለየ ማንም ሰው ፋይሉን ከፍቶ ማየት አይችልም።

const crypto = require('crypto');

async function sendTelegramNotification(worker) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('Telegram not configured — skipping notification (set TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID).');
    return;
  }

  const categoryText = (worker.categoryOther && worker.categoryOther.trim())
    ? `${worker.category} (${worker.categoryOther.trim()})`
    : worker.category;

  const text =
    `🆕 አዲስ ተመዝጋቢ (ታዱ)\n\n` +
    `👤 ስም: ${worker.name}\n` +
    `📞 ስልክ: ${worker.phone}\n` +
    `📍 አድራሻ: ${worker.address}\n` +
    `🛠 የስራ ዘርፍ: ${categoryText}\n` +
    `⏳ ልምድ: ${worker.experience}\n\n` +
    `admin.html ላይ ገብተው ማጽደቅ/መከልከል ይችላሉ።`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (e) {
    console.warn('Telegram notification failed:', e.message);
  }
}

// ================= Telegram Mini App initData Verification =================
// ይህ Telegram's official validation algorithm ነው፦
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
//
// 1) initData ላይ ካሉት key=value ጥንዶች ውስጥ "hash" የሚለውን ለይተን እናወጣለን
// 2) የቀሩትን ጥንዶች በ key (alphabetically) እየደረደርን "key=value\n" እያልን እናገናኛቸዋለን
// 3) secret_key = HMAC-SHA256(bot_token, key="WebAppData")
// 4) computed_hash = HMAC-SHA256(data_check_string, key=secret_key) በ hex
// 5) computed_hash ከ hash ጋር ካልተመሳሰለ initData ሀሰተኛ ነው (ውድቅ ይደረጋል)
//
// ተጨማሪ፦ auth_date በጣም ያለፈ (ለምሳሌ ከ24 ሰዓት በላይ) ከሆነ replay-attack ሊሆን ስለሚችል
// እንቀበልም።
const MAX_INIT_DATA_AGE_SECONDS = 24 * 60 * 60; // 24 ሰዓት

function verifyTelegramInitData(initData, botToken) {
  if (!initData || typeof initData !== 'string') return { valid: false, reason: 'missing initData' };
  if (!botToken) return { valid: false, reason: 'bot token not configured' };

  let parsed;
  try {
    parsed = new URLSearchParams(initData);
  } catch (e) {
    return { valid: false, reason: 'malformed initData' };
  }

  const hash = parsed.get('hash');
  if (!hash) return { valid: false, reason: 'no hash present' };

  const pairs = [];
  for (const [key, value] of parsed.entries()) {
    if (key === 'hash') continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const hashBuf = Buffer.from(hash, 'hex');
  const computedBuf = Buffer.from(computedHash, 'hex');
  const hashesMatch =
    hashBuf.length === computedBuf.length && crypto.timingSafeEqual(hashBuf, computedBuf);

  if (!hashesMatch) return { valid: false, reason: 'hash mismatch' };

  const authDate = parseInt(parsed.get('auth_date') || '0', 10);
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (!authDate || ageSeconds > MAX_INIT_DATA_AGE_SECONDS || ageSeconds < 0) {
    return { valid: false, reason: 'initData expired' };
  }

  let user = null;
  try {
    user = parsed.get('user') ? JSON.parse(parsed.get('user')) : null;
  } catch (e) {
    // user ፓርስ ማድረግ ካልቻልን እንኳ hash ትክክል ስለሆነ ጥያቄውን ገና እናምናለን
  }

  return { valid: true, user, authDate };
}

// req ውስጥ ካለው X-Telegram-Init-Data header ላይ initData ን ያነባል፣ ያረጋግጣል፣
// ትክክል ካልሆነ throw ያደርጋል (ጠሪው catch አድርጎ 401 እንዲመልስ)።
//
// TELEGRAM_BOT_TOKEN environment variable ካልተዘጋጀ (ገና setup ላይ ላሉ ገንቢዎች)፣
// ማረጋገጫውን በለሆሳስ እናልፈዋለን (skip) እንጂ ጥያቄውን አንዘጋም — ልክ እንደ
// sendTelegramNotification ተመሳሳይ graceful-degradation ስልት። ቦት ቶክኑ አንዴ
// ከተዘጋጀ ግን ማረጋገጫው ግዴታ ይሆናል፣ የማይመሳሰል/የጎደለ initData ውድቅ ይደረጋል።
function requireTelegramUser(req) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.warn('TELEGRAM_BOT_TOKEN not configured — skipping initData verification.');
    return null;
  }
  const initData = req.headers['x-telegram-init-data'] || req.headers['X-Telegram-Init-Data'];
  const result = verifyTelegramInitData(initData, botToken);
  if (!result.valid) {
    const err = new Error('Unauthorized: invalid Telegram initData (' + result.reason + ')');
    err.statusCode = 401;
    throw err;
  }
  return result.user;
}

module.exports = { sendTelegramNotification, verifyTelegramInitData, requireTelegramUser };
