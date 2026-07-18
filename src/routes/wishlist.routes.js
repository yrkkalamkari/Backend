const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getWishlist, addToWishlist, removeFromWishlist } = require("../controllers/wishlist.controller");

const router = express.Router();
router.use(requireAuth);

router.get("/", getWishlist);
router.post("/", addToWishlist);
router.delete("/:productId", removeFromWishlist);

module.exports = router;
