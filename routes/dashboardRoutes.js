const express = require("express");

const router = express.Router();

const { getAdminDashboard } = require("../controllers/dashboardController");

const { verifyToken, authorize } = require("../middleware/authMiddleware");

// =================================================
// ADMIN DASHBOARD ONLY
// =================================================

router.get("/admin", verifyToken, authorize("superadmin"), getAdminDashboard);

module.exports = router;
