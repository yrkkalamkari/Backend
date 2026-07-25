const { OAuth2Client } = require("google-auth-library");
const prisma = require("../config/db");
const { signToken } = require("../utils/jwt");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// POST /api/auth/google
// Body: { idToken } — the ID token the frontend got from Google Identity Services / Google Sign-In button.
// This is the ONLY login method in the app — no passwords are ever stored.
async function googleLogin(req, res, next) {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: "idToken is required." });
    }

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    // payload contains: sub (google id), email, name, picture, email_verified

    if (!payload.email_verified) {
      return res.status(401).json({ error: "Google email is not verified." });
    }

// Find existing user by googleId, or create/update in a single call.
  // This avoids an extra round trip to the database for login.
  const user = await prisma.user.upsert({
    where: { googleId: payload.sub },
    update: {
      name: payload.name || undefined,
      avatarUrl: payload.picture || undefined,
    },
    create: {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name || payload.email.split("@")[0],
      avatarUrl: payload.picture || null,
    },
  });

    const token = signToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me
// Returns the full profile in one call: user + addresses + cart + wishlist,
// so the frontend can hydrate everything right after login.
async function getMe(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        phone: true,
        role: true,
        addresses: {
          orderBy: { isDefault: "desc" },
          select: {
            id: true,
            label: true,
            line1: true,
            line2: true,
            city: true,
            state: true,
            pincode: true,
            country: true,
            phone: true,
            isDefault: true,
          },
        },
        cartItems: {
          select: {
            id: true,
            productId: true,
            qty: true,
            product: {
              select: {
                id: true,
                slug: true,
                name: true,
                price: true,
                discountPrice: true,
                stock: true,
                images: {
                  orderBy: { isPrimary: "desc" },
                  take: 1,
                  select: { url: true, isPrimary: true },
                },
              },
            },
          },
        },
        wishlist: {
          select: {
            id: true,
            productId: true,
            product: {
              select: {
                id: true,
                slug: true,
                name: true,
                price: true,
                discountPrice: true,
                stock: true,
                images: {
                  orderBy: { isPrimary: "desc" },
                  take: 1,
                  select: { url: true, isPrimary: true },
                },
              },
            },
          },
        },
      },
    });

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      role: user.role,
      addresses: user.addresses,
      cart: user.cartItems,
      wishlist: user.wishlist,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { googleLogin, getMe };
