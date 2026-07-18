const prisma = require("../config/db");

// POST /api/coupons/validate  { code, cartTotal }
// Returns the discount amount without creating an order — used to show the discount at checkout.
async function validateCoupon(req, res, next) {
  try {
    const { code, cartTotal } = req.body;
    if (!code || cartTotal == null) {
      return res.status(400).json({ error: "code and cartTotal are required." });
    }

    const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });

    if (!coupon || !coupon.isActive) {
      return res.status(404).json({ error: "Invalid coupon code." });
    }
    if (coupon.expiryDate && coupon.expiryDate < new Date()) {
      return res.status(400).json({ error: "This coupon has expired." });
    }
    if (coupon.usageLimit && coupon.timesUsed >= coupon.usageLimit) {
      return res.status(400).json({ error: "This coupon has reached its usage limit." });
    }
    if (coupon.minOrderValue && cartTotal < coupon.minOrderValue) {
      return res.status(400).json({ error: `Minimum order value is ₹${coupon.minOrderValue}.` });
    }

    const discount =
      coupon.discountType === "PERCENT"
        ? (cartTotal * coupon.value) / 100
        : Math.min(coupon.value, cartTotal);

    res.json({ valid: true, couponId: coupon.id, code: coupon.code, discount });
  } catch (err) {
    next(err);
  }
}

module.exports = { validateCoupon };
