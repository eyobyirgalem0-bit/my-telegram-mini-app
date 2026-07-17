// POST /api/cloudinary-signature
// Body: { folder?: string }
// Response: { timestamp, signature, apiKey, cloudName, folder }
//
// ይህ endpoint የ Cloudinary API Secret ፈጽሞ ወደ ፊት-ለፊት (browser) ኮድ አይልክም።
// ፊት-ለፊት ኮዱ ይህን ፈርማ (signature) ተጠቅሞ ፎቶ/ቪዲዮ በቀጥታ ወደ Cloudinary
// ይሰቅላል (uploads directly to Cloudinary) - ፋይሉ በጭራሽ በኛ server በኩል አያልፍም።
const crypto = require('crypto');
const { handlePreflight, sendError } = require('../lib/auth');

module.exports = async (req, res) => {
  if (handlePreflight(req, res)) return;
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      throw Object.assign(
        new Error('Server misconfigured: CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET not set'),
        { statusCode: 500 }
      );
    }

    const body = req.body || {};
    // ፎልደር ስም ደህንነቱ ለተጠበቀ (whitelist) ብቻ እንዲወሰን - የዘፈቀደ path ማንም እንዳይልክ
    const allowedFolders = ['tadu/ids', 'tadu/profiles', 'tadu/ads', 'tadu/branding'];
    const folder = allowedFolders.includes(body.folder) ? body.folder : 'tadu/misc';

    const timestamp = Math.round(new Date().now() / 1000);

// በኦብጀክት መልክ ማስቀመጥ (ቅደም ተከተሉን በራሱ ይይዛል፣ ምልክት አያስፈልገውም)
const paramsToSign = {
  folder: folder,
  timestamp: timestamp
};

// ፊርማውን በcrypto ሳይሆን በcloudinary የራሱ መሣሪያ ማመንጨት
const cloudinary = require('cloudinary').v2;
const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);
