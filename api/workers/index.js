// GET  /api/workers   -> ያለ ቶክን: የጸደቁ (approved) ሰራተኞችን ብቻ ይመልሳል
//                      -> ከ Authorization: Bearer <admin token> ጋር: ሁሉንም (pending/approved/rejected) ይመልሳል
// POST /api/workers   -> አዲስ ተመዝጋቢ ይፈጥራል (ሁልጊዜ status: 'pending' ሆኖ ይጀምራል)
//                      -> X-Telegram-Init-Data header ተረጋግጦ ካልታመነ ውድቅ ይደረጋል
//                         (TELEGRAM_BOT_TOKEN ካልተዘጋጀ ግን ማረጋገጫው ይታለፋል፣ lib/telegram.js ይመልከቱ)
const { getDb } = require('../../lib/db');
const { requireAdmin, handlePreflight, sendError } = require('../../lib/auth');
const { sendTelegramNotification, requireTelegramUser } = require('../../lib/telegram');

function toClient(doc) {
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...rest };
}

module.exports = async (req, res) => {
  if (handlePreflight(req, res)) return;
  try {
    const db = await getDb();
    const col = db.collection('workers');

    if (req.method === 'GET') {
      let isAdmin = false;
      try {
        requireAdmin(req);
        isAdmin = true;
      } catch (e) {
        isAdmin = false; // no/invalid token → treat as public request
      }
      const query = isAdmin ? {} : { status: 'approved' };
      let docs = await col.find(query).sort({ createdAt: -1 }).toArray();
      // A verified Telegram worker can also see their own pending/rejected profile
      // so they can update their photo or CV without exposing it to the public.
      if (!isAdmin) {
        let ownTelegramId = null;
        try {
          const telegramUser = requireTelegramUser(req);
          if (telegramUser && telegramUser.id) ownTelegramId = String(telegramUser.id);
        } catch (e) {
          // Public browsing remains available when no Telegram session is present.
        }
        // TELEGRAM_BOT_TOKEN ገና ካልተዘጋጀ (setup/testing ደረጃ ላይ)፣ requireTelegramUser
        // ማረጋገጫውን ይዘላል (null ይመልሳል) እንጂ አይወድቅም - በዚያ ሁኔታ ደንበኛው (client) ራሱ
        // በ ?telegramId= query param የላከውን (ካልተረጋገጠ ግን Mini App initData ላይ
        // ካለው) telegramId እንደ fallback እንጠቀማለን፣ አለበለዚያ "መገለጫዬን አስተካክል" ገጹ
        // ቦት ቶክኑ እስኪዘጋጅ ድረስ የራሱን ተመዝጋቢ በጭራሽ ማግኘት አይችልም ነበር።
        if (!ownTelegramId && req.query && req.query.telegramId) {
          ownTelegramId = String(req.query.telegramId).trim().slice(0, 64);
        }
        if (ownTelegramId) {
          const own = await col.findOne({ telegramId: ownTelegramId });
          if (own && !docs.some((doc) => doc._id.equals(own._id))) docs.unshift(own);
        }
      }
      res.status(200).json(docs.map(toClient));
      return;
    }

    if (req.method === 'POST') {
      // ተመዝጋቢው በእውነት ከ Telegram Mini App ውስጥ እየተጠቀመ መሆኑን እናረጋግጣለን
      // (ይህ ማንም ሰው በቀጥታ API ጠርቶ የሀሰት ተመዝጋቢ እንዳይፈጥር ይከላከላል)
      // ማስታወሻ፦ requireTelegramUser በትክክል function ሆኖ ካልመጣ (ለምሳሌ የቆየ/ያልተስተካከለ
      // deploy በተሳሳተ ሁኔታ ቢሰቀል) ምዝገባው ሙሉ በሙሉ እንዳይወድቅ (500 error) በዚህ እንጠብቀዋለን።
      let telegramUser = null;
      if (typeof requireTelegramUser === 'function') {
        telegramUser = requireTelegramUser(req);
      } else {
        console.warn('requireTelegramUser is not available — skipping Telegram initData verification.');
      }

      const body = req.body || {};
      const required = ['name', 'phone', 'address', 'category', 'experience'];
      for (const field of required) {
        if (!body[field] || !String(body[field]).trim()) {
          throw Object.assign(new Error(`Missing required field: ${field}`), { statusCode: 400 });
        }
      }
      const now = new Date();
      const worker = {
        name: String(body.name).trim(),
        phone: String(body.phone).trim(),
        address: String(body.address).trim(),
        category: String(body.category).trim(),
        // categoryOther: ተመዝጋቢው "ሌላ" መርጦ ተጨማሪ ዝርዝር ገልጿል ካለ (ቀደም ሲል ይህ መስክ
        // ችላ ተብሎ አልተቀመጠም ነበር፣ ስለዚህ dashboard ላይ ሁልጊዜ "ሌላ" ብቻ ይታይ ነበር)
        categoryOther: body.categoryOther ? String(body.categoryOther).trim() : '',
        experience: String(body.experience).trim(),
        // education: frontend ላይ (f-education) ተጨምሮ ነበር፣ ግን እዚህ ችላ ተብሎ
        // ስላልተቀመጠ ስለ ተመዝጋቢው የትምህርት ደረጃ መረጃ ጠፍቶ ነበር (ፈጽሞ ወደ database አይገባም ነበር)
        education: body.education ? String(body.education).trim() : 'none',
        bio: body.bio ? String(body.bio).trim() : '',
        photo: body.photo || null,     // Cloudinary secure_url
        idFront: body.idFront || null, // Cloudinary secure_url
        idBack: body.idBack || null,   // Cloudinary secure_url
        cv: body.cv || null,           // Cloudinary secure_url (CV/ፖርትፎሊዮ)
        // TELEGRAM_BOT_TOKEN ተዘጋጅቶ ከሆነ (secure): ሁልጊዜ server-side የተረጋገጠውን
        // ID ብቻ እንጠቀማለን። ገና ካልተዘጋጀ ግን (verification ስለሚዘለል telegramUser
        // null ይሆናል)፣ ደንበኛው (client) ከ Telegram Mini App initData ራሱ የላከውን
        // body.telegramId እንደ fallback እንቀበላለን፣ አለበለዚያ ተመዝጋቢዎች telegramId
        // ፈጽሞ ስለማይቀመጥላቸው "መገለጫዬን አስተካክል" ገጹ ላይ ሁልጊዜ "አልተገኘም" ይል ነበር።
        telegramId: telegramUser && telegramUser.id
          ? String(telegramUser.id)
          : (body.telegramId ? String(body.telegramId).trim().slice(0, 64) : null),
        status: 'pending',
        ratings: [],
        createdAt: now,
        updatedAt: now,
      };
      const result = await col.insertOne(worker);
      const created = { ...worker, _id: result.insertedId };

      // Telegram ማሳወቂያ በጀርባ (server) ይላካል — ውጤቱን ምዝገባው እንዲጠብቅ አናደርገውም
      sendTelegramNotification(created).catch(() => {});

      res.status(201).json(toClient(created));
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    sendError(res, err);
  }
};
