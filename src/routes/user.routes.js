const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  updateMe, listAddresses, createAddress, updateAddress, deleteAddress,
} = require("../controllers/user.controller");

const router = express.Router();
router.use(requireAuth);

router.put("/me", updateMe);
router.get("/me/addresses", listAddresses);
router.post("/me/addresses", createAddress);
router.put("/me/addresses/:id", updateAddress);
router.delete("/me/addresses/:id", deleteAddress);

module.exports = router;
