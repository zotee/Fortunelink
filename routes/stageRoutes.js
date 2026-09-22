const express = require("express");

const router = express.Router();

const {
  getStages,
  getStageById,
  createStage,
  updateStage,
  updateStageStatus,
  deleteStage,
} = require("../controllers/stageController");

const {
  verifyToken,
  authorize,
} = require("../middleware/authMiddleware");

// =================================================
// AUTHENTICATION
// =================================================

router.use(verifyToken);

// =================================================
// GET ALL STAGES
//
// Superadmin:
// - Can get active stages.
// - Can include inactive stages with ?includeInactive=true
//
// Staff:
// - Can get active stages only.
// =================================================

router.get(
  "/",
  authorize("superadmin", "staff"),
  getStages,
);

// =================================================
// GET ONE STAGE
// =================================================

router.get(
  "/:stageId",
  authorize("superadmin", "staff"),
  getStageById,
);

// =================================================
// CREATE STAGE
// =================================================

router.post(
  "/",
  authorize("superadmin"),
  createStage,
);

// =================================================
// UPDATE STAGE STATUS
//
// Keep this route before /:stageId.
// =================================================

router.patch(
  "/:stageId/status",
  authorize("superadmin"),
  updateStageStatus,
);

// =================================================
// UPDATE STAGE
// =================================================

router.patch(
  "/:stageId",
  authorize("superadmin"),
  updateStage,
);

// =================================================
// DELETE STAGE
// =================================================

router.delete(
  "/:stageId",
  authorize("superadmin"),
  deleteStage,
);

module.exports = router;