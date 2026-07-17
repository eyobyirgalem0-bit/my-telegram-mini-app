// lib/telegram.js
// አዲስ ተመዝጋቢ ሲኖር ለአስተዳዳሪው በቴሌግራም ማሳወቂያ ይልካል።
// Bot Token እዚህ server-side ላይ ብቻ ስለሚቀመጥ (Vercel Environment Variable)፣
// ከድሮው localStorage ስሪት በተለየ ማንም ሰው ፋይሉን ከፍቶ ማየት አይችልም።

async function sendTelegramNotification(worker) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('Telegram not configured — skipping notification (set TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID).');
    return;
  }

  const text =
    `🆕 አዲስ ተመዝጋቢ (ታዱ)\n\n` +
    `👤 ስም: ${worker.name}\n` +
    `📞 ስልክ: ${worker.phone}\n` +
    `📍 አድራሻ: ${worker.address}\n` +
    `🛠 የስራ ዘርፍ: ${worker.category}\n` +
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

module.exports = { sendTelegramNotification };
