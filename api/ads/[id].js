const { ObjectId } = require('mongodb');
const { getDb } = require('../../lib/db');
const { requireAdmin, handlePreflight, sendError } = require('../../lib/auth');

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

    if (req.method === 'PUT' || req.method === 'POST') {
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

    if (req.method === 'DELETE' || req.method === 'POST') {
      const result = await col.deleteOne({ _id });
      if (result.deletedCount === 0) throw Object.assign(new Error('Ad not found'), { statusCode: 404 });
      res.status(200).json({ deleted: true });
      return;
    }

    res.setHeader('Allow', ['PUT', 'POST', 'DELETE']);
    throw Object.assign(new Error(`Method ${req.method} Not Allowed`), { statusCode: 405 });
  } catch (err) {
    sendError(res, err);
  }
};
