const express = require("express");

const router = express.Router();

const {
  createStaffTarget,
  getStaffTarget,
  getStaffPerformanceHistory,
  updateStaffTarget,
} = require("../controllers/staffTargetController");

const { verifyToken, authorize } = require("../middleware/authMiddleware");

router.use(verifyToken);

// =================================================
// GET TARGET / PERFORMANCE
//
// ADMIN + STAFF
// =================================================

router.get("/staff/:staffId", authorize("superadmin", "staff"), getStaffTarget);

router.get(
  "/staff/:staffId/history",
  authorize("superadmin", "staff"),
  getStaffPerformanceHistory,
);

// =================================================
// CREATE TARGET
//
// ADMIN ONLY
// =================================================

router.post("/", authorize("superadmin"), createStaffTarget);

// =================================================
// UPDATE TARGET
//
// ADMIN ONLY
// =================================================

router.patch("/:targetId", authorize("superadmin"), updateStaffTarget);

module.exports = router;
