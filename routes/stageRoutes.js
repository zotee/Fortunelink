const express = require("express");
const router = express.Router();
const {
  getStages,
  createStage,
  updateStage,
  updateStageStatus,
} = require("../controllers/stageController");
const { verifyToken, authorize } = require("../middleware/authMiddleware");
// =================================================
// AUTH
// =================================================
router.use(verifyToken);
// =================================================
// GET ACTIVE STAGES
// ADMIN + STAFF
// =================================================
router.get("/", authorize("superadmin", "staff"), getStages);
// =================================================
// CREATE STAGE
// SUPERADMIN
// =================================================
router.post("/", authorize("superadmin", "staff"), createStage);
// =================================================
// UPDATE STAGE
// SUPERADMIN
// =================================================
router.patch("/:stageId", authorize("superadmin"), updateStage);
// =================================================
// ENABLE / DISABLE STAGE
// SUPERADMIN
// =================================================
router.patch("/:stageId/status", authorize("superadmin"), updateStageStatus);
module.exports = router;
