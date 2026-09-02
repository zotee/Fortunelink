const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/superadmin/login", authController.login);
router.get("/superadmin/dashboard", authMiddleware, authController.dashboard);

module.exports = router;