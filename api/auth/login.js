// POST /api/auth/login
// Body: { password: string }
// Response: { token: string }
const { signAdminToken, handlePreflight, sendError } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (handlePreflight(req, res)) return;
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const { password } = req.body || {};
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    if (!ADMIN_PASSWORD) {
      throw Object.assign(new Error('Server misconfigured: ADMIN_PASSWORD is not set'), { statusCode: 500 });
    }
    if (!password || password !== ADMIN_PASSWORD) {
      throw Object.assign(new Error('የተሳሳተ የይለፍ ቃል / Wrong password'), { statusCode: 401 });
    }
    const token = signAdminToken();
    res.status(200).json({ token });
  } catch (err) {
    sendError(res, err);
  }
};
