const prisma = require("../config/db");

// GET /api/wishlist
async function getWishlist(req, res, next) {
  try {
    const items = await prisma.wishlistItem.findMany({
      where: { userId: req.user.id },
      include: {
        product: {
          select: {
            id: true,
            slug: true,
            name: true,
            price: true,
            discountPrice: true,
            stock: true,
            images: { select: { url: true, isPrimary: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
}

// POST /api/wishlist  { productId }
async function addToWishlist(req, res, next) {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ error: "productId is required." });

    const item = await prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: req.user.id, productId } },
      update: {},
      create: { userId: req.user.id, productId },
    });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/wishlist/:productId
async function removeFromWishlist(req, res, next) {
  try {
    const { productId } = req.params;
    await prisma.wishlistItem.delete({
      where: { userId_productId: { userId: req.user.id, productId } },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { getWishlist, addToWishlist, removeFromWishlist };
