# ታዱ (Tadu) — ከ localStorage ወደ እውነተኛ Backend (MongoDB + Cloudinary + Vercel)

ይህ ጥቅል `index.html` እና `admin.html`ን ከ **MongoDB** database፣ **Cloudinary** (ለ ID/ፕሮፋይል ፎቶዎች)፣
እና **Vercel Serverless Functions** ጋር አገናኝቶ ያዘጋጃል። ውሂብ ከአሁን በኋላ በአንድ ቦታ (ደመና ላይ)
ስለሚቀመጥ ሁሉም ተጠቃሚ በየትኛውም መሳሪያ ላይ ተመሳሳይ ዝርዝር ያያል፣ አድሚንም ከየትኛውም ቦታ ገብቶ ማጽደቅ/መከልከል ይችላል።

## 📁 የፋይሎች አደረጃጀት

```
/
├── index.html              ← ለስራ ፈላጊዎች/ቀጣሪዎች የሚሆነው ይፋዊ ገጽ
├── admin.html              ← ለናንተ ብቻ የሚሆነው የአስተዳዳሪ ገጽ
├── package.json
├── vercel.json
├── .env.example
├── api/
│   ├── auth/login.js       ← POST: የይለፍ ቃል በማረጋገጥ የአድሚን ቶክን (JWT) ይሰጣል
│   ├── workers/
│   │   ├── index.js        ← GET (ዝርዝር) / POST (አዲስ ተመዝጋቢ)
│   │   └── [id].js         ← PATCH (ማጽደቅ/መከልከል/ደረጃ) / DELETE (መሰረዝ) — አድሚን ብቻ
│   ├── ads/
│   │   ├── index.js        ← GET (ዝርዝር) / POST (አዲስ ማስታወቂያ) — POST አድሚን ብቻ
│   │   └── [id].js         ← PUT / DELETE — አድሚን ብቻ
│   ├── branding.js         ← GET (ስም/ሎጎ/ቀለም) / PUT — አድሚን ብቻ
│   └── cloudinary-signature.js ← POST: ፎቶ/ቪዲዮ ወደ Cloudinary ለመስቀል ፈርማ ይሰጣል
└── lib/
    ├── db.js               ← MongoDB ግንኙነት (cached)
    ├── auth.js             ← JWT ማረጋገጫ + CORS
    └── telegram.js         ← የቴሌግራም ማሳወቂያ (server-side)
```

## 1️⃣ MongoDB Atlas (ነጻ Database)

1. https://www.mongodb.com/cloud/atlas/register ገብተው በነጻ አካውንት ይክፈቱ
2. **"Build a Database" → M0 Free** ይምረጡ (ክልል/ሪጅን ማንኛውም ይሆናል)
3. **Database Access** ውስጥ የተጠቃሚ ስም/የይለፍ ቃል ይፍጠሩ
4. **Network Access** ውስጥ **Allow Access from Anywhere** (0.0.0.0/0) ይጨምሩ (Vercel ተለዋዋጭ IP ስለሚጠቀም)
5. **Connect → Drivers** ውስጥ የሚሰጠውን **connection string** ይቅዱ፣ ይህም ይመስላል፦
   `mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
   ይህን እንደ `MONGODB_URI` በኋላ ይጠቀሙታል (ከታች #4 ይመልከቱ)

## 2️⃣ Cloudinary (ነጻ የፎቶ/ቪዲዮ ማከማቻ)

1. https://cloudinary.com/users/register/free ገብተው በነጻ አካውንት ይክፈቱ
2. Dashboard ላይ **Cloud Name**፣ **API Key**፣ **API Secret** ያገኛሉ — እነዚህን ይቅዱ
3. ተጨማሪ ምንም ማዋቀር አያስፈልግም — signed upload ስለሚጠቀም (ደህንነቱ የተጠበቀ)፣ upload preset መፍጠር አያስፈልግም

## 3️⃣ ኮዱን ወደ GitHub መስቀል

```bash
git init
git add .
git commit -m "ታዱ - backend + frontend"
git branch -M main
git remote add origin https://github.com/<your-username>/tadu.git
git push -u origin main
```

⚠️ **.env ፋይል በጭራሽ push አታድርጉ** (ምስጢሮች ስለያዘ)። `.env.example` ብቻ ወደ GitHub ይሂድ።

## 4️⃣ Vercel ላይ Deploy ማድረግ

1. https://vercel.com ገብተው በ GitHub አካውንትዎ ይግቡ
2. **Add New → Project** → repo-ውን ይምረጡ → **Import**
3. Framework Preset: **Other** (ራሱ በራሱ ያውቀዋል)፣ ምንም Build Command አያስፈልግም
4. **Environment Variables** ውስጥ ከዚህ በታች ያሉትን ሁሉ ይጨምሩ (ከ `.env.example` ጋር ተመሳሳይ)፦

   | ስም | ዋጋ |
   |---|---|
   | `MONGODB_URI` | ከ MongoDB Atlas የተቀዳው connection string |
   | `MONGODB_DB` | `tadu` (ወይም የፈለጉት ስም) |
   | `ADMIN_PASSWORD` | የሚፈልጉት ጠንካራ የይለፍ ቃል |
   | `JWT_SECRET` | ማንኛውም ረጅም የዘፈቀደ ጽሁፍ (ለምሳሌ 40+ ፊደላት) |
   | `CLOUDINARY_CLOUD_NAME` | ከ Cloudinary Dashboard |
   | `CLOUDINARY_API_KEY` | ከ Cloudinary Dashboard |
   | `CLOUDINARY_API_SECRET` | ከ Cloudinary Dashboard |
   | `TELEGRAM_BOT_TOKEN` | (አማራጭ) ከ @BotFather |
   | `TELEGRAM_CHAT_ID` | (አማራጭ) ከ @userinfobot |

5. **Deploy** ይጫኑ። ከጥቂት ሰኮንዶች በኋላ የ `https://your-project.vercel.app` ሊንክ ያገኛሉ
6. `https://your-project.vercel.app/index.html` ለስራ ፈላጊዎች፣ `https://your-project.vercel.app/admin.html` ለናንተ

💡 ኮድ በኋላ ካስተካከሉ (ለምሳሌ env variable ከቀየሩ)፣ Vercel dashboard → **Deployments → Redeploy** ማድረግ ያስፈልጋል።

## 5️⃣ Telegram Mini App ማገናኘት (ካለፈው README.md ተመሳሳይ)

1. @BotFather → `/newbot` → Bot Token ያገኛሉ
2. @BotFather → `/mybots` → ቦትዎን ይምረጡ → **Bot Settings → Menu Button** →
   `https://your-project.vercel.app/index.html` የሚለውን ሊንክ ይለጥፉ

## 6️⃣ የአድሚን ፓነል እንዴት እንደሚሰራ (ተለውጧል)

ከድሮው በተለየ፣ የይለፍ ቃሉ (`ADMIN_PASSWORD`) ከአሁን በኋላ በ **Vercel Environment Variable** ብቻ ይቀመጣል —
በ `admin.html` ኮድ ውስጥ በግልጽ (plain text) አይታይም። admin.html ላይ ሲገቡ የይለፍ ቃሉን ሲያስገቡ፣
ገጹ ወደ `/api/auth/login` ልኮ ትክክለኛ ከሆነ ለ30 ቀናት የሚያገለግል ቶክን (JWT) ይቀበላል፤ ይህ ቶክን
ማጽደቅ/መከልከል/መሰረዝ/ማስታወቂያ መጨመር በሚደረግበት ጊዜ ሁሉ ወደ backend ይላካል፣ backend ደግሞ
ትክክለኛ ቶክን ካልቀረበ ጥያቄውን ውድቅ ያደርገዋል።

## 🔒 ደህንነት በተመለከተ ማስታወሻዎች

- የመታወቂያ ፎቶዎች (`idFront`/`idBack`) አሁንም በ `workers` collection ውስጥ እንደ ተራ URL ተቀምጠዋል፤
  ማንኛውም ሰው URL-ውን ካገኘ ፎቶውን ማየት ይችላል (Cloudinary ደረጃ ጥበቃ)። ለበለጠ ጥበቃ፣
  Cloudinary's "authenticated" delivery type ወይም signed URLs መጠቀም ያስቡበት።
- `ALLOWED_ORIGIN` ተብሎ የተሰየመ env variable በ CORS ውስጥ አለ፤ index.html/admin.html ከ Vercel ውጭ
  ሌላ domain (ለምሳሌ GitHub Pages) ላይ ካስቀመጡ ብቻ ይህን ወደ ትክክለኛው domain ማዋቀር ያስፈልግዎታል፤
  ካልሆነ ግን (ሁሉም በ Vercel ላይ ከሆነ) ችላ ማለት ይችላሉ (default: `*`)።
- `rate limiting` በዚህ ስሪት ውስጥ አልተካተተም (spam registration መከላከያ) — ለወደፊት ተጨማሪ ስራ ነው።
