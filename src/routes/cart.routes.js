const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getCart, addToCart, updateCartItem, removeCartItem, clearCart } = require("../controllers/cart.controller");

const router = express.Router();
router.use(requireAuth);

router.get("/", getCart);
router.post("/", addToCart);
router.put("/:productId", updateCartItem);
router.delete("/:productId", removeCartItem);
router.delete("/", clearCart);

module.exports = router;
