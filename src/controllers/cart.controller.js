const prisma = require("../config/db");

// GET /api/cart
async function getCart(req, res, next) {
  try {
    const items = await prisma.cartItem.findMany({
      where: { userId: req.user.id },
      include: { product: { include: { images: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
}

// POST /api/cart  { productId, qty }
// Upserts — if the product is already in the cart, increases qty instead of duplicating.
async function addToCart(req, res, next) {
  try {
    const { productId, qty = 1 } = req.body;
    if (!productId) return res.status(400).json({ error: "productId is required." });

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) return res.status(404).json({ error: "Product not found." });

    // Use an atomic upsert to avoid race conditions where two requests
    // try to create the same cart item simultaneously (P2002).
    const item = await prisma.cartItem.upsert({
      where: { userId_productId: { userId: req.user.id, productId } },
      update: { qty: { increment: qty } },
      create: { userId: req.user.id, productId, qty },
    });

    res.status(201).json(item);
  } catch (err) {
    // If upsert somehow still triggers a unique constraint, try a safe update as a fallback.
    if (err && err.code === "P2002") {
      try {
        const { productId, qty = 1 } = req.body;
        const updated = await prisma.cartItem.update({
          where: { userId_productId: { userId: req.user.id, productId } },
          data: { qty: { increment: qty } },
        });
        return res.status(201).json(updated);
      } catch (e) {
        return next(e);
      }
    }
    next(err);
  }
}

// PUT /api/cart/:productId  { qty }
async function updateCartItem(req, res, next) {
  try {
    const { productId } = req.params;
    const { qty } = req.body;
    if (!qty || qty < 1) return res.status(400).json({ error: "qty must be at least 1." });

    const item = await prisma.cartItem.update({
      where: { userId_productId: { userId: req.user.id, productId } },
      data: { qty },
    });
    res.json(item);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/cart/:productId
async function removeCartItem(req, res, next) {
  try {
    const { productId } = req.params;
    await prisma.cartItem.delete({
      where: { userId_productId: { userId: req.user.id, productId } },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// DELETE /api/cart — clear entire cart (e.g. after checkout)
async function clearCart(req, res, next) {
  try {
    await prisma.cartItem.deleteMany({ where: { userId: req.user.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { getCart, addToCart, updateCartItem, removeCartItem, clearCart };
