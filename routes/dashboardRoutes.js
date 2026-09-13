const express = require("express");

const router = express.Router();

const {
  getAdminDashboard,
  getStaffDashboard,
} = require("../controllers/dashboardController");

const { verifyToken, authorize } = require("../middleware/authMiddleware");

router.use(verifyToken);

// =================================================
// SUPER ADMIN DASHBOARD
// =================================================

router.get("/admin", authorize("superadmin"), getAdminDashboard);

// =================================================
// STAFF DASHBOARD
// =================================================

router.get("/staff", authorize("staff"), getStaffDashboard);

module.exports = router;
