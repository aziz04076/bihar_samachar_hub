# 🚀 Bihar Samachar Hub - Backend Deployment Guide (Render.com)

Yeh backend server ek high-speed multi-threaded Python server hai jo 10+ major Hindi news sources (Dainik Bhaskar, Jagran, Hindustan, Prabhat Khabar, NDTV, Aaj Tak, Amar Ujala, Navbharat Times, ETV Bharat) se har 10 minute mein automatically news sync karta hai aur Vercel frontend ko REST API aur SSE live updates provide karta hai.

---

## 📌 Render.com par Free Deploy karne ke Steps:

### Step 1: Render par Account banayein
1. [dashboard.render.com](https://dashboard.render.com/) par jayein aur GitHub se login karein.

### Step 2: New Web Service create karein
1. **"New +"** button par click karein aur **"Web Service"** select karein.
2. **"Build and deploy from a Git repository"** choose karein.
3. Apna repository select karein: `aziz04076/bihar_samachar_hub`.

### Step 3: Settings Configure karein
In settings ko fill karein:

| Field | Value |
|---|---|
| **Name** | `bihar-samachar-hub-backend` (ya apni pasand ka koi bhi naam) |
| **Region** | `Singapore` ya `Oregon` (koi bhi) |
| **Branch** | `main` |
| **Root Directory** | `backend` (agar alag backend folder run karna ho) ya blank chhod dein (dono kaam karenge) |
| **Runtime** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `python server.py` |
| **Instance Type** | `Free` |

> 💡 **Note on PORT**: Render automatically `$PORT` environment variable assign karta hai (jaise 10000). Server code is variable ko automatically detect karke bind kar lega. Aapko koi manually port daalne ki zaroorat nahi hai.

### Step 4: Health Check (Optional but Recommended)
- Advanced settings mein **Health Check Path** ko `/api/health` set karein.

### Step 5: Deploy Web Service par click karein
- 1-2 minute mein build complete ho jayega aur status **"Live"** dikhayega.
- Upar aapko aapka unique backend URL mil jayega, jaise:
  `https://bihar-samachar-hub-backend.onrender.com`

---

## 🔗 Step 6: Frontend mein Backend URL connect karein
Backend deploy hone ke baad:
1. `assets/js/config.js` file kholein.
2. `BACKEND_URL` mein apna Render URL paste karein:
   ```javascript
   const BACKEND_URL = 'https://bihar-samachar-hub-backend.onrender.com';
   ```
3. Git commit & push karein (`git add . && git commit -m "Connect Render backend" && git push`).
4. Vercel automatically re-deploy karega aur aapki website par taaza live news aane lagegi!
