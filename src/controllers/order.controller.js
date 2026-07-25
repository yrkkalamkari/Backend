const prisma = require("../config/db");
const { notifyAdminOfNewOrder } = require("../services/telegram.service");

// POST /api/orders  { addressId, couponCode }
// Builds the order from the user's current cart, validates stock, applies a coupon if given,
// then clears the cart — all inside one transaction so nothing is left half-done.
async function createOrder(req, res, next) {
  try {
    const { addressId, couponCode } = req.body;
    if (!addressId) return res.status(400).json({ error: "addressId is required." });

    const address = await prisma.address.findUnique({ where: { id: addressId } });
    if (!address || address.userId !== req.user.id) return res.status(404).json({ error: "Address not found." });

    let order;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const t0 = Date.now();
        const freshCartItems = await prisma.cartItem.findMany({
          where: { userId: req.user.id },
          include: { product: { select: { id: true, name: true, price: true, discountPrice: true, stock: true } } },
        });
        const fetchMs = Date.now() - t0;
        console.log(`createOrder: fetched cart items in ${fetchMs}ms, count=${freshCartItems.length}`);

        if (freshCartItems.length === 0) return res.status(400).json({ error: "Cart is empty." });

        for (const item of freshCartItems) {
          if (item.qty > item.product.stock) {
            return res.status(400).json({ error: `Not enough stock for ${item.product.name}.` });
          }
        }

        const txSubtotal = freshCartItems.reduce((sum, item) => {
          const price = item.product.discountPrice ?? item.product.price;
          return sum + Number(price) * item.qty;
        }, 0);

        let txDiscountAmount = 0;
        let txCoupon = null;
        if (couponCode) {
          txCoupon = await prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase() } });
          if (txCoupon && txCoupon.isActive && (!txCoupon.expiryDate || txCoupon.expiryDate > new Date())) {
            txDiscountAmount =
              txCoupon.discountType === "PERCENT"
                ? (txSubtotal * Number(txCoupon.value)) / 100
                : Math.min(Number(txCoupon.value), txSubtotal);
          } else {
            txCoupon = null;
          }
        }

        const txTotal = txSubtotal - txDiscountAmount;

        // Build the queries to run inside a single transaction. Use a single raw
        // UPDATE that decrements multiple product rows in one statement to avoid
        // many round-trips.
        const queries = [];

        queries.push(
          prisma.order.create({
            data: {
              userId: req.user.id,
              addressId,
              subtotal: txSubtotal,
              discountAmount: txDiscountAmount,
              total: txTotal,
              couponId: txCoupon?.id,
              items: {
                create: freshCartItems.map((item) => ({
                  productId: item.productId,
                  qty: item.qty,
                  priceAtPurchase: item.product.discountPrice ?? item.product.price,
                })),
              },
            },
            select: {
              id: true,
              total: true,
            },
          })
        );

        // Prepare VALUES list for (id, qty) pairs and parameters for the raw query
        const valuesParams = [];
        const valuePlaceholders = freshCartItems.map((it, i) => {
          // for parameterized placeholders we will pass id then qty sequentially
          valuesParams.push(it.productId, it.qty);
          const baseIndex = i * 2 + 1;
          return `($${baseIndex}, $${baseIndex + 1})`;
        });

        if (freshCartItems.length > 0) {
          const sql = `UPDATE "Product" AS p SET "stock" = p."stock" - v.qty FROM (VALUES ${valuePlaceholders.join(
            ","
          )}) AS v(id, qty) WHERE p.id = v.id`;
          queries.push(prisma.$executeRawUnsafe(sql, ...valuesParams));
        }

        if (txCoupon) {
          queries.push(prisma.coupon.update({ where: { id: txCoupon.id }, data: { timesUsed: { increment: 1 } } }));
        }

        queries.push(prisma.cartItem.deleteMany({ where: { userId: req.user.id } }));

        const t1 = Date.now();
        const results = await prisma.$transaction(queries);
        const txMs = Date.now() - t1;
        console.log(`createOrder: transaction completed in ${txMs}ms`);
        // The first result is the created order
        order = results[0];
        break;
      } catch (err) {
        if (err && err.code === "P2028" && attempt < 2) continue;
        throw err;
      }
    }

    res.status(201).json(order);

    // Fire-and-forget: runs after the response is already sent, so a slow or
    // failing Telegram API call never delays or breaks checkout for the customer.
    setImmediate(() => {
      void notifyAdminOfNewOrder(order);
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/orders — the logged-in user's own order history
async function listMyOrders(req, res, next) {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      select: {
        id: true,
        total: true,
        status: true,
        createdAt: true,
      },
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
      select: {
        id: true,
        status: true,
        subtotal: true,
        discountAmount: true,
        total: true,
        createdAt: true,
        address: {
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
          },
        },
        items: {
          select: {
            id: true,
            qty: true,
            priceAtPurchase: true,
            product: {
              select: {
                id: true,
                name: true,
                images: { select: { url: true, isPrimary: true } },
              },
            },
          },
        },
      },
    });
    if (!order) return res.status(404).json({ error: "Order not found." });
    res.json(order);
  } catch (err) {
    next(err);
  }
}

module.exports = { createOrder, listMyOrders, getMyOrder };
