const express = require("express");

const router = express.Router();

const {
  getStages,
  createStage,
  updateStage,
  updateStageStatus,
  deleteStage,
} = require("../controllers/stageController");

const {
  verifyToken,
  authorize,
} = require("../middleware/authMiddleware");

router.use(verifyToken);

// Admin and staff can fetch active stages.
// Only superadmin can request inactive stages.
router.get(
  "/",
  authorize("superadmin", "staff"),
  getStages,
);

// Only superadmin can manage stages.
router.post(
  "/",
  authorize("superadmin"),
  createStage,
);

router.patch(
  "/:stageId/status",
  authorize("superadmin"),
  updateStageStatus,
);

router.patch(
  "/:stageId",
  authorize("superadmin"),
  updateStage,
);

router.delete(
  "/:stageId",
  authorize("superadmin"),
  deleteStage,
);

module.exports = router;