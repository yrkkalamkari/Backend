const prisma = require("../config/db");

// POST /api/orders  { addressId, couponCode }
// Builds the order from the user's current cart, validates stock, applies a coupon if given,
// then clears the cart — all inside one transaction so nothing is left half-done.
async function createOrder(req, res, next) {
  try {
    const { addressId, couponCode } = req.body;
    if (!addressId) return res.status(400).json({ error: "addressId is required." });

    const address = await prisma.address.findFirst({ where: { id: addressId, userId: req.user.id } });
    if (!address) return res.status(404).json({ error: "Address not found." });

    const cartItems = await prisma.cartItem.findMany({
      where: { userId: req.user.id },
      include: { product: true },
    });
    if (cartItems.length === 0) return res.status(400).json({ error: "Cart is empty." });

    for (const item of cartItems) {
      if (item.qty > item.product.stock) {
        return res.status(400).json({ error: `Not enough stock for ${item.product.name}.` });
      }
    }

    const subtotal = cartItems.reduce((sum, item) => {
      const price = item.product.discountPrice ?? item.product.price;
      return sum + Number(price) * item.qty;
    }, 0);

    let discountAmount = 0;
    let coupon = null;
    if (couponCode) {
      coupon = await prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase() } });
      if (coupon && coupon.isActive && (!coupon.expiryDate || coupon.expiryDate > new Date())) {
        discountAmount =
          coupon.discountType === "PERCENT"
            ? (subtotal * Number(coupon.value)) / 100
            : Math.min(Number(coupon.value), subtotal);
      } else {
        coupon = null;
      }
    }

    const total = subtotal - discountAmount;

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId: req.user.id,
          addressId,
          subtotal,
          discountAmount,
          total,
          couponId: coupon?.id,
          items: {
            create: cartItems.map((item) => ({
              productId: item.productId,
              qty: item.qty,
              priceAtPurchase: item.product.discountPrice ?? item.product.price,
            })),
          },
        },
        include: { items: { include: { product: true } }, address: true },
      });

      for (const item of cartItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.qty } },
        });
      }

      if (coupon) {
        await tx.coupon.update({ where: { id: coupon.id }, data: { timesUsed: { increment: 1 } } });
      }

      await tx.cartItem.deleteMany({ where: { userId: req.user.id } });

      return newOrder;
    });

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
}

// GET /api/orders — the logged-in user's own order history
async function listMyOrders(req, res, next) {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: { items: { include: { product: { include: { images: true } } } }, address: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (err) {
    next(err);
  }
}

// GET /api/orders/:id
async function getMyOrder(req, res, next) {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { items: { include: { product: { include: { images: true } } } }, address: true },
    });
    if (!order) return res.status(404).json({ error: "Order not found." });
    res.json(order);
  } catch (err) {
    next(err);
  }
}

module.exports = { createOrder, listMyOrders, getMyOrder };
