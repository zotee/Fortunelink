const express = require("express");

const router = express.Router();

const authController = require("../controllers/authController");

const {
  verifyToken,
  authorize,
} = require("../middleware/authMiddleware");

// =================================================
// LOGIN
// =================================================

// Super Admin login
router.post(
  "/superadmin/login",
  authController.adminLogin
);

// Staff login
router.post(
  "/staff/login",
  authController.staffLogin
);

// =================================================
// SUPER ADMIN ONLY
// =================================================

router.get(
  "/superadmin/dashboard",
  verifyToken,
  authorize("superadmin"),
  authController.superAdminDashboard
);

// =================================================
// STAFF ONLY
// =================================================

router.get(
  "/staff/dashboard",
  verifyToken,
  authorize("staff"),
  authController.staffDashboard
);

module.exports = router;