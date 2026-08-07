// PATCH  /api/workers/:id  (admin only) -> status ማጽደቅ/መከልከል፣ ደረጃ (rating) መጨመር፣ ወይም ሌላ መስክ ማስተካከል
// DELETE /api/workers/:id  (admin only) -> ሙሉ በሙሉ መሰረዝ
const { ObjectId } = require('mongodb');
const { getDb } = require('../../lib/db');
const { requireAdmin, handlePreflight, sendError } = require('../../lib/auth');
const { requireTelegramUser } = require('../../lib/telegram');

function toClient(doc) {
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...rest };
}

// አድሚን እንዲቀይራቸው የተፈቀዱ መስኮች ብቻ - ሌላ ማንኛውም መስክ (ለምሳሌ _id) ችላ ይባላል
const PATCHABLE_FIELDS = [
  'status', 'ratings', 'name', 'phone', 'address', 'category', 'categoryOther',
  'experience', 'education', 'bio', 'photo', 'idFront', 'idBack', 'cv', 'telegramId',
];

// ያለ admin ማረጋገጫ (login) ማንኛውም ተጠቃሚ ራሱ ማድረግ የሚችለው ብቸኛ ለውጥ "ደረጃ መስጠት" ብቻ ነው።
// ስለዚህ PATCH ጥያቄው ከ 'ratings' ውጭ ሌላ ማንኛውም field ካካተተ (ወይም ratings ካልያዘ)፣
// አሁንም እንደ በፊቱ admin token ይጠየቃል።
const PUBLIC_RATING_ONLY_FIELD = 'ratings';
const SELF_EDITABLE_FIELDS = ['photo', 'cv'];

// ተጠቃሚው የላከውን አንድ አዲስ ደረጃ (rating) ወደ ንጹህ/አስተማማኝ ቅርጽ ይመልሰዋል፣ ያልተጠበቁ
// ወይም አደገኛ ሊሆኑ የሚችሉ ተጨማሪ መስኮችን ችላ በማለት። ትክክል ካልሆነ throw ያደርጋል።
function sanitizeNewRating(raw) {
  if (!raw || typeof raw !== 'object') {
    throw Object.assign(new Error('Invalid rating payload'), { statusCode: 400 });
  }
  const v = Number(raw.v);
  if (!Number.isInteger(v) || v < 1 || v > 5) {
    throw Object.assign(new Error('Rating value (v) must be an integer between 1 and 5'), { statusCode: 400 });
  }
  const c = String(raw.c || '').trim().slice(0, 500);
  const by = String(raw.by || '').trim().slice(0, 100);
  return { v, c, by, at: new Date() };
}

module.exports = async (req, res) => {
  if (handlePreflight(req, res)) return;
  try {
    const { id } = req.query;
    if (!ObjectId.isValid(id)) {
      throw Object.assign(new Error('Invalid worker id'), { statusCode: 400 });
    }
    const _id = new ObjectId(id);
    const db = await getDb();
    const col = db.collection('workers');

    if (req.method === 'PATCH') {
      const body = req.body || {};
      const bodyFields = PATCHABLE_FIELDS.filter((f) =>
        Object.prototype.hasOwnProperty.call(body, f)
      );
      const isPublicRatingSubmission =
        bodyFields.length === 1 && bodyFields[0] === PUBLIC_RATING_ONLY_FIELD;

      if (isPublicRatingSubmission) {
        // 🌍 ማንኛውም ተጠቃሚ (login/token ሳያስፈልገው) ደረጃ መስጠት ይችላል፣ ግን ያለፉ ደረጃዎችን
        // መቀየር/ማጥፋት እንዳይችል በ server በኩል በጥብቅ እናረጋግጣለን - ተጠቃሚው ከላከው array
        // ውስጥ የመጨረሻውን (አዲሱን) ግቤት ብቻ ወስደን፣ ካለው ዝርዝር ጋር በ server እራሱ እንጨምረዋለን።
        const existing = await col.findOne({ _id }, { projection: { ratings: 1 } });
        if (!existing) {
          throw Object.assign(new Error('Worker not found'), { statusCode: 404 });
        }
        const currentRatings = Array.isArray(existing.ratings) ? existing.ratings : [];
        const incoming = Array.isArray(body.ratings) ? body.ratings : [];
        if (incoming.length !== currentRatings.length + 1) {
          throw Object.assign(
            new Error('Ratings can only be submitted one at a time'),
            { statusCode: 400 }
          );
        }
        const newRating = sanitizeNewRating(incoming[incoming.length - 1]);
        const result = await col.findOneAndUpdate(
          { _id },
          { $push: { ratings: newRating }, $set: { updatedAt: new Date() } },
          { returnDocument: 'after', includeResultMetadata: false }
        );
        if (!result) {
          throw Object.assign(new Error('Worker not found'), { statusCode: 404 });
        }
        res.status(200).json(toClient(result));
        return;
      }

      // Admins may edit every approved field. Workers may edit only their own
      // profile photo and CV, and only from a verified Telegram Mini App session.
      let isAdmin = true;
      try {
        requireAdmin(req);
      } catch (adminError) {
        isAdmin = false;
      }

      const patch = {};
      const requestedFields = PATCHABLE_FIELDS.filter((field) =>
        Object.prototype.hasOwnProperty.call(body, field)
      );
      if (!isAdmin) {
        const telegramUser = requireTelegramUser(req);
        if (!telegramUser || !telegramUser.id) {
          throw Object.assign(new Error('Telegram account could not be verified'), { statusCode: 401 });
        }
        const existing = await col.findOne({ _id }, { projection: { telegramId: 1 } });
        if (!existing || String(existing.telegramId || '') !== String(telegramUser.id)) {
          throw Object.assign(new Error('You may edit only your own profile'), { statusCode: 403 });
        }
        if (!requestedFields.length || requestedFields.some((field) => !SELF_EDITABLE_FIELDS.includes(field))) {
          throw Object.assign(new Error('Workers may edit only their photo and CV'), { statusCode: 403 });
        }
      }

      for (const field of requestedFields) {
        patch[field] = body[field];
      }
      for (const field of ['photo', 'cv']) {
        if (Object.prototype.hasOwnProperty.call(patch, field) && patch[field] !== null) {
          patch[field] = String(patch[field]).trim().slice(0, 2000);
        }
      }
      if (patch.status && !['pending', 'approved', 'rejected'].includes(patch.status)) {
        throw Object.assign(new Error('Invalid status value'), { statusCode: 400 });
      }
      if (isAdmin && Object.prototype.hasOwnProperty.call(patch, 'telegramId')) {
        patch.telegramId = patch.telegramId === null || patch.telegramId === ''
          ? null
          : String(patch.telegramId).trim().slice(0, 64);
      }
      patch.updatedAt = new Date();

      // ማስታወሻ፦ MongoDB Node.js driver v6 ላይ findOneAndUpdate() ነባሪ ባህሪው
      // ተቀይሯል — ቀደም ሲል { value: doc } ተብሎ ተጠቅልሎ ይመለስ ነበር፣ አሁን ግን
      // ሰነዱ (document) በቀጥታ ይመለሳል (ወይም ካልተገኘ null)። ይህን በግልጽ
      // (includeResultMetadata: false) ስላላደረግነው ቀደም ሲል result.value ሁልጊዜ
      // undefined ስለነበር፣ ማሻሻያው ትክክል ቢሆንም እንኳ ኮዱ የውሸት "Worker not found"
      // ስህተት ይጥል ነበር (ማሻሻያው ራሱ ግን በ database ላይ ይፈጸም ነበር)።
      const result = await col.findOneAndUpdate(
        { _id },
        { $set: patch },
        { returnDocument: 'after', includeResultMetadata: false }
      );
      if (!result) {
        throw Object.assign(new Error('Worker not found'), { statusCode: 404 });
      }
      res.status(200).json(toClient(result));
      return;
    }

    if (req.method === 'DELETE') {
      requireAdmin(req);
      const result = await col.deleteOne({ _id });
      if (result.deletedCount === 0) {
        throw Object.assign(new Error('Worker not found'), { statusCode: 404 });
      }
      res.status(200).json({ id, deleted: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    sendError(res, err);
  }
};
