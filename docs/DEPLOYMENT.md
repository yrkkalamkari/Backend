# Deployment guide

## 1. Set up Google OAuth (required first — everything depends on this)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create a new project (e.g. "Kalamkari Store").
2. **APIs & Services → OAuth consent screen** — choose "External", fill in app name, your email, add your domain later once you have one.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:3000` (add your real frontend domain later, e.g. `https://yourstore.vercel.app`)
   - Authorized redirect URIs: same origins (Google Identity Services' popular "One Tap"/button flow doesn't need a redirect URI, but add them anyway for safety)
4. Copy the **Client ID** → this goes in `GOOGLE_CLIENT_ID` in your backend `.env`, and the frontend will need the same value.
5. You do **not** need the Client Secret for this flow — the backend only verifies ID tokens, it never exchanges an auth code.

## 2. Set up the database (Supabase — recommended free option)

1. Create a project at [supabase.com](https://supabase.com) (free tier, doesn't expire).
2. Project Settings → Database → copy the **Connection string** (URI format, "Session pooler" or "Transaction pooler" for serverless-friendly connections).
3. Paste it into `DATABASE_URL` in `.env`.
4. Note: Supabase's free tier **pauses the database after 7 days of inactivity** — it auto-wakes on the next request but that first request will be slow. Fine for a store getting daily traffic.

Alternative: MongoDB Atlas free tier doesn't pause, but this schema is written for Postgres/Prisma — switching would mean rewriting the schema in Mongoose instead. Stick with Postgres unless you have a reason not to.

## 3. Set up Cloudinary (image storage)

1. Sign up free at [cloudinary.com](https://cloudinary.com) (25GB free).
2. Dashboard shows your **Cloud name**, **API key**, **API secret** — copy all three into `.env`.

## 4. Run locally first

```bash
cd kalamkari-backend
npm install
cp .env.example .env   # then fill in the real values
npx prisma migrate dev --name init
node prisma/seed.js
npm run dev
```

Test it: `curl http://localhost:5000/api/health` should return `{"status":"ok",...}`.

To make yourself admin: log in once via the frontend (or Postman with a real Google ID token), then:
```bash
node prisma/makeAdmin.js your-email@gmail.com
```

## 5. Deploy the backend — Option A: Render (free tier, easiest)

1. Push this folder to a GitHub repo.
2. [render.com](https://render.com) → New → Web Service → connect the repo.
3. Build command: `npm install && npx prisma generate`
4. Start command: `npm start`
   Add a pre-deploy/release command if Render supports it in your plan: `npx prisma migrate deploy`
   (otherwise run `npx prisma migrate deploy` manually once from your local machine pointed at the production `DATABASE_URL`)
5. Add all `.env` variables in Render's dashboard under Environment.
6. Free tier sleeps after 15 minutes idle — first request after a nap takes ~30-50s to wake up. Fine at 500 orders/day; just don't expect instant response on the very first hit of the day.

## 6. Deploy the backend — Option B: your old phone (free, always-on if you keep it powered)

1. Install **Termux** from F-Droid (not the Play Store version — it's outdated).
2. Inside Termux:
   ```bash
   pkg update && pkg install nodejs git
   git clone <your-repo-url>
   cd kalamkari-backend
   npm install
   npx prisma generate
   ```
3. Set env vars (create `.env` the same way as local dev, `DATABASE_URL` still points to Supabase — only the API server runs on the phone, not the database).
4. Keep the process alive: `termux-wake-lock` before starting, then `npm start`, or use `pm2` (`npm i -g pm2 && pm2 start src/server.js`) so it restarts if it crashes.
5. Expose it to the internet with a **Cloudflare Tunnel** (free, no port forwarding needed):
   ```bash
   pkg install cloudflared
   cloudflared tunnel --url http://localhost:5000
   ```
   This gives you a public HTTPS URL. For a permanent URL tied to your own domain, set up a named tunnel via the Cloudflare Zero Trust dashboard instead of the quick one-off command.
6. Caveats to accept going in: your home internet's uptime is now your API's uptime, the phone needs to stay charged and shouldn't overheat running 24/7, and there's no automatic failover. Good for getting started free; migrate to Render or a small VPS once the store is making real money.

## 7. Point the frontend at the backend

Whichever option you pick, you'll end up with one public HTTPS URL for the API (e.g. `https://kalamkari-api.onrender.com` or your Cloudflare Tunnel URL). Set that as `NEXT_PUBLIC_API_URL` / `VITE_API_URL` in the frontend once we build it, and set `FRONTEND_URL` in the backend's `.env` to your deployed frontend's URL (needed for CORS).
