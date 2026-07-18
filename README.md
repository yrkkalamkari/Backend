# Kalamkari store — backend

Node.js + Express + Prisma (PostgreSQL) backend. Login is Google-only — no passwords are stored anywhere.
Because every user is matched by their permanent Google ID, a user's addresses, cart, and wishlist are always there the next time they log in, on any device.

## Quick start

```bash
npm install
cp .env.example .env      # fill in real values — see docs/DEPLOYMENT.md
npx prisma migrate dev --name init
node prisma/seed.js       # optional sample data
npm run dev
```

## Docs

- [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) — every table, field, and why it's shaped this way
- [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md) — every endpoint, request/response shape
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Google OAuth setup, Supabase, Cloudinary, Render, and the "run it on an old phone" option

## Project structure

```
src/
  config/       Prisma client, Cloudinary config
  middleware/   auth (JWT + Google), admin guard, upload (multer), error handler
  controllers/  business logic, one file per resource
  routes/       Express routers, one file per resource
  app.js        wires everything together
  server.js     starts the HTTP server
prisma/
  schema.prisma database schema (source of truth)
  seed.js       sample categories/products
  makeAdmin.js  promote a logged-in user to ADMIN role
docs/           the documentation above
```

## What's next

Once this is deployed and you can hit `/api/health` and log in via `/api/auth/google` successfully, we build the frontend (React + PWA so it installs like an app on mobile/desktop) against these same endpoints.
