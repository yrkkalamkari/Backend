const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { createOrder, listMyOrders, getMyOrder } = require("../controllers/order.controller");

const router = express.Router();
router.use(requireAuth);

router.post("/", createOrder);
router.get("/", listMyOrders);
router.get("/:id", getMyOrder);

module.exports = router;
