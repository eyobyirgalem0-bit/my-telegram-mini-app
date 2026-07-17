// PATCH  /api/workers/:id  (admin only) -> status ማጽደቅ/መከልከል፣ ደረጃ (rating) መጨመር፣ ወይም ሌላ መስክ ማስተካከል
// DELETE /api/workers/:id  (admin only) -> ሙሉ በሙሉ መሰረዝ
const { ObjectId } = require('mongodb');
const { getDb } = require('../../lib/db');
const { requireAdmin, handlePreflight, sendError } = require('../../lib/auth');

function toClient(doc) {
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...rest };
}

// አድሚን እንዲቀይራቸው የተፈቀዱ መስኮች ብቻ - ሌላ ማንኛውም መስክ (ለምሳሌ _id) ችላ ይባላል
const PATCHABLE_FIELDS = [
  'status', 'ratings', 'name', 'phone', 'address', 'category',
  'experience', 'bio', 'photo', 'idFront', 'idBack',
];

module.exports = async (req, res) => {
  if (handlePreflight(req, res)) return;
  try {
    requireAdmin(req);

    const { id } = req.query;
    if (!ObjectId.isValid(id)) {
      throw Object.assign(new Error('Invalid worker id'), { statusCode: 400 });
    }
    const _id = new ObjectId(id);
    const db = await getDb();
    const col = db.collection('workers');

    if (req.method === 'PATCH') {
      const body = req.body || {};
      const patch = {};
      for (const field of PATCHABLE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
          patch[field] = body[field];
        }
      }
      if (patch.status && !['pending', 'approved', 'rejected'].includes(patch.status)) {
        throw Object.assign(new Error('Invalid status value'), { statusCode: 400 });
      }
      patch.updatedAt = new Date();

      const result = await col.findOneAndUpdate(
        { _id },
        { $set: patch },
        { returnDocument: 'after' }
      );
      if (!result.value) {
        throw Object.assign(new Error('Worker not found'), { statusCode: 404 });
      }
      res.status(200).json(toClient(result.value));
      return;
    }

    if (req.method === 'DELETE') {
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
