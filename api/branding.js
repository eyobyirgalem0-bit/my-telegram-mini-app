// GET /api/branding -> ማንኛውም ሰው ማየት ይችላል (app name, logo, ቀለም)
// PUT /api/branding -> አድሚን ብቻ ማስተካከል ይችላል
const { getDb } = require('../lib/db');
const { requireAdmin, handlePreflight, sendError } = require('../lib/auth');

const DEFAULT_BRANDING = {
  appName: 'ታዱ',
  logoUrl: null,
  primaryColor: '#511A81',
  accentColor: '#FFB800',
};

module.exports = async (req, res) => {
  if (handlePreflight(req, res)) return;
  try {
    const db = await getDb();
    const col = db.collection('config');

    if (req.method === 'GET') {
      const doc = await col.findOne({ _id: 'branding' });
      res.status(200).json(doc ? { ...DEFAULT_BRANDING, ...doc, _id: undefined } : DEFAULT_BRANDING);
      return;
    }

    if (req.method === 'PUT') {
      requireAdmin(req);
      const body = req.body || {};
      const patch = {
        appName: body.appName ? String(body.appName).trim() : DEFAULT_BRANDING.appName,
        logoUrl: body.logoUrl || null,
        primaryColor: body.primaryColor || DEFAULT_BRANDING.primaryColor,
        accentColor: body.accentColor || DEFAULT_BRANDING.accentColor,
      };
      await col.updateOne({ _id: 'branding' }, { $set: patch }, { upsert: true });
      res.status(200).json(patch);
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    sendError(res, err);
  }
};
