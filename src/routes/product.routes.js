const express = require("express");
const { listProducts, getProduct, listCategories } = require("../controllers/product.controller");

const router = express.Router();

router.get("/products", listProducts);
router.get("/products/:slug", getProduct);
router.get("/categories", listCategories);

module.exports = router;
