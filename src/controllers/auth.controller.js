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

    // Find existing user by googleId, or create a new one.
    // On repeat logins this simply returns the SAME user row, so their
    // addresses, cart, and wishlist (all linked by userId) come right back.
    let user = await prisma.user.findUnique({ where: { googleId: payload.sub } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId: payload.sub,
          email: payload.email,
          name: payload.name || payload.email.split("@")[0],
          avatarUrl: payload.picture || null,
        },
      });
    } else {
      // Keep name/avatar fresh in case they changed it on Google's side
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name: payload.name || user.name, avatarUrl: payload.picture || user.avatarUrl },
      });
    }

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
      include: {
        addresses: { orderBy: { isDefault: "desc" } },
        cartItems: { include: { product: { include: { images: true } } } },
        wishlist: { include: { product: { include: { images: true } } } },
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
