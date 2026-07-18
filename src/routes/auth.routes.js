const express = require("express");
const { googleLogin, getMe } = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/google", googleLogin);
router.get("/me", requireAuth, getMe);

module.exports = router;
