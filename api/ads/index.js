// GET  /api/ads  -> ማንኛውም ሰው ማየት ይችላል (ገጹ ላይ የሚታዩ ማስታወቂያዎች)
// POST /api/ads  -> አድሚን ብቻ: አዲስ ማስታወቂያ መፍጠር
const { getDb } = require('../../lib/db');
const { requireAdmin, handlePreflight, sendError } = require('../../lib/auth');

function toClient(doc) {
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...rest };
}

module.exports = async (req, res) => {
  if (handlePreflight(req, res)) return;
  try {
    const db = await getDb();
    const col = db.collection('ads');

    if (req.method === 'GET') {
      const docs = await col.find({}).sort({ createdAt: 1 }).toArray();
      res.status(200).json(docs.map(toClient));
      return;
    }

    if (req.method === 'POST') {
      requireAdmin(req);
      const body = req.body || {};
      if (!body.type || !['image', 'video'].includes(body.type)) {
        throw Object.assign(new Error('type must be "image" or "video"'), { statusCode: 400 });
      }
      const ad = {
        type: body.type,
        title: body.title ? String(body.title).trim() : '',
        desc: body.desc ? String(body.desc).trim() : '',
        link: body.link ? String(body.link).trim() : '',
        duration: body.type === 'image' ? (parseInt(body.duration) || 5) : null,
        image: body.type === 'image' ? (body.image || null) : null, // Cloudinary secure_url
        video: body.type === 'video' ? (body.video || null) : null, // Cloudinary secure_url
        createdAt: new Date(),
      };
      const result = await col.insertOne(ad);
      res.status(201).json(toClient({ ...ad, _id: result.insertedId }));
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    sendError(res, err);
  }
};
