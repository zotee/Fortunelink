const express = require("express");

const router = express.Router();

const authController = require("../controllers/authController");

const { verifyToken, authorize } = require("../middleware/authMiddleware");

// =================================================
// PUBLIC LOGIN
// =================================================

router.post("/login", authController.login);

// =================================================
// CURRENT LOGGED-IN USER
// Works for both Super Admin and Staff
// =================================================

router.get(
  "/me",
  verifyToken,
  authorize("superadmin", "staff"),
  authController.getCurrentUser,
);

module.exports = router;
