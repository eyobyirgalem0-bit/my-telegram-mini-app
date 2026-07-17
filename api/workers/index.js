// GET  /api/workers   -> ያለ ቶክን: የጸደቁ (approved) ሰራተኞችን ብቻ ይመልሳል
//                      -> ከ Authorization: Bearer <admin token> ጋር: ሁሉንም (pending/approved/rejected) ይመልሳል
// POST /api/workers   -> አዲስ ተመዝጋቢ ይፈጥራል (ሁልጊዜ status: 'pending' ሆኖ ይጀምራል)
const { getDb } = require('../../lib/db');
const { requireAdmin, handlePreflight, sendError } = require('../../lib/auth');
const { sendTelegramNotification } = require('../../lib/telegram');

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
      const docs = await col.find(query).sort({ createdAt: -1 }).toArray();
      res.status(200).json(docs.map(toClient));
      return;
    }

    if (req.method === 'POST') {
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
        experience: String(body.experience).trim(),
        bio: body.bio ? String(body.bio).trim() : '',
        photo: body.photo || null,     // Cloudinary secure_url
        idFront: body.idFront || null, // Cloudinary secure_url
        idBack: body.idBack || null,   // Cloudinary secure_url
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
