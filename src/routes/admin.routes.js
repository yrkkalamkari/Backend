const express = require("express");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const upload = require("../middleware/upload");
const admin = require("../controllers/admin.controller");

const router = express.Router();
router.use(requireAuth, requireAdmin);

// Products
router.get("/products", admin.listAllProducts);
router.post("/products", admin.createProduct);
router.put("/products/:id", admin.updateProduct);
router.delete("/products/:id", admin.deleteProduct);
router.post("/products/:id/images", upload.single("image"), admin.uploadProductImage);
router.delete("/products/:productId/images/:imageId", admin.deleteProductImage);

// Categories
router.post("/categories", admin.createCategory);
router.delete("/categories/:id", admin.deleteCategory);

// Coupons
router.get("/coupons", admin.listCoupons);
router.post("/coupons", admin.createCoupon);
router.put("/coupons/:id", admin.updateCoupon);

// Orders
router.get("/orders", admin.listAllOrders);
router.put("/orders/:id/status", admin.updateOrderStatus);

module.exports = router;
