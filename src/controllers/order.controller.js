const prisma = require("../config/db");
const { notifyAdminOfNewOrder } = require("../services/telegram.service");

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

    // Run the order creation inside a retriable interactive transaction.
    // Re-fetch cart items inside the transaction to ensure we operate on latest data
    // and avoid "Transaction not found" or stale-data issues. Retry on P2028.
    let order;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        order = await prisma.$transaction(async (tx) => {
          const txCartItems = await tx.cartItem.findMany({
            where: { userId: req.user.id },
            include: { product: true },
          });

          if (txCartItems.length === 0) throw { status: 400, message: "Cart is empty." };

          for (const item of txCartItems) {
            if (item.qty > item.product.stock) {
              throw { status: 400, message: `Not enough stock for ${item.product.name}.` };
            }
          }

          const txSubtotal = txCartItems.reduce((sum, item) => {
            const price = item.product.discountPrice ?? item.product.price;
            return sum + Number(price) * item.qty;
          }, 0);

          let txDiscountAmount = 0;
          let txCoupon = null;
          if (couponCode) {
            txCoupon = await tx.coupon.findUnique({ where: { code: couponCode.toUpperCase() } });
            if (
              txCoupon &&
              txCoupon.isActive &&
              (!txCoupon.expiryDate || txCoupon.expiryDate > new Date())
            ) {
              txDiscountAmount =
                txCoupon.discountType === "PERCENT"
                  ? (txSubtotal * Number(txCoupon.value)) / 100
                  : Math.min(Number(txCoupon.value), txSubtotal);
            } else {
              txCoupon = null;
            }
          }

          const txTotal = txSubtotal - txDiscountAmount;

          const newOrder = await tx.order.create({
            data: {
              userId: req.user.id,
              addressId,
              subtotal: txSubtotal,
              discountAmount: txDiscountAmount,
              total: txTotal,
              couponId: txCoupon?.id,
              items: {
                create: txCartItems.map((item) => ({
                  productId: item.productId,
                  qty: item.qty,
                  priceAtPurchase: item.product.discountPrice ?? item.product.price,
                })),
              },
            },
            include: { items: { include: { product: true } }, address: true, user: true },
          });

          for (const item of txCartItems) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { decrement: item.qty } },
            });
          }

          if (txCoupon) {
            await tx.coupon.update({ where: { id: txCoupon.id }, data: { timesUsed: { increment: 1 } } });
          }

          await tx.cartItem.deleteMany({ where: { userId: req.user.id } });

          return newOrder;
        });
        break;
      } catch (err) {
        // Propagate validation errors thrown from inside the transaction as HTTP responses
        if (err && err.status && err.message) return res.status(err.status).json({ error: err.message });
        // Retry on transient transaction missing error
        if (err && err.code === "P2028" && attempt < 2) continue;
        throw err;
      }
    }

    res.status(201).json(order);

    // Fire-and-forget: runs after the response is already sent, so a slow or
    // failing Telegram API call never delays or breaks checkout for the customer.
    notifyAdminOfNewOrder(order);
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
