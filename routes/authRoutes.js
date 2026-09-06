const express = require("express");

const router = express.Router();

const authController = require("../controllers/authController");

const { verifyToken, authorize } = require("../middleware/authMiddleware");

// =================================================
// LOGIN
// =================================================

// Login for both Super Admin and Staff
router.post("/login", authController.login);

// =================================================
// SUPER ADMIN ONLY
// =================================================

router.get(
  "/superadmin/dashboard",
  verifyToken,
  authorize("superadmin"),
  authController.superAdminDashboard,
);

// =================================================
// STAFF ONLY
// =================================================

router.get(
  "/staff/dashboard",
  verifyToken,
  authorize("staff"),
  authController.staffDashboard,
);

module.exports = router;
