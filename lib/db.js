// lib/db.js
// MongoDB ግንኙነትን በሁሉም serverless functions መካከል ደግሞ ደጋግሞ (cache) የሚጠቀም ረዳት ፋይል።
// Vercel serverless functions በየጥሪው "ቀዝቃዛ" (cold start) ሊሆኑ ስለሚችሉ፣ ግንኙነቱን
// global cache ላይ በማስቀመጥ ላልተፈለገ ዳግም-ግንኙነት (reconnect) ጊዜ እንዳናጠፋ እናደርጋለን።

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'tadu';

if (!MONGODB_URI) {
  console.warn('⚠️  MONGODB_URI environment variable is not set. Set it in Vercel Project Settings → Environment Variables.');
}

let cached = global._taduMongoCache;
if (!cached) {
  cached = global._taduMongoCache = { client: null, promise: null };
}

async function getDb() {
  if (cached.client) {
    return cached.client.db(DB_NAME);
  }
  if (!cached.promise) {
    const client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 5,
    });
    cached.promise = client.connect().then((c) => {
      cached.client = c;
      return c;
    });
  }
  const client = await cached.promise;
  return client.db(DB_NAME);
}

module.exports = { getDb };
