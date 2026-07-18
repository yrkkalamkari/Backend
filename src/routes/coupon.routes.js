const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { validateCoupon } = require("../controllers/coupon.controller");

const router = express.Router();

router.post("/validate", requireAuth, validateCoupon);

module.exports = router;
