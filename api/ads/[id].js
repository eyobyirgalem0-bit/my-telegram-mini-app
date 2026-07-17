// PUT    /api/ads/:id (admin only) -> ማስታወቂያ ማስተካከል
// DELETE /api/ads/:id (admin only) -> ማስታወቂያ መሰረዝ
const { ObjectId } = require('mongodb');
const { getDb } = require('../../lib/db');
const { requireAdmin, handlePreflight, sendError } = require('../../lib/auth');

function toClient(doc) {
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...rest };
}

const EDITABLE_FIELDS = ['type', 'title', 'desc', 'link', 'duration', 'image', 'video'];

module.exports = async (req, res) => {
  if (handlePreflight(req, res)) return;
  try {
    requireAdmin(req);
    const { id } = req.query;
    if (!ObjectId.isValid(id)) {
      throw Object.assign(new Error('Invalid ad id'), { statusCode: 400 });
    }
    const _id = new ObjectId(id);
    const db = await getDb();
    const col = db.collection('ads');

    if (req.method === 'PUT') {
      const body = req.body || {};
      const patch = {};
      for (const field of EDITABLE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(body, field)) patch[field] = body[field];
      }
      const result = await col.findOneAndUpdate({ _id }, { $set: patch }, { returnDocument: 'after' });
      if (!result.value) throw Object.assign(new Error('Ad not found'), { statusCode: 404 });
      res.status(200).json(toClient(result.value));
      return;
    }

    if (req.method === 'DELETE') {
      const result = await col.deleteOne({ _id });
      if (result.deletedCount === 0) throw Object.assign(new Error('Ad not found'), { statusCode: 404 });
      res.status(200).json({ id, deleted: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    sendError(res, err);
  }
};
