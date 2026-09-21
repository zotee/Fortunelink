const express = require("express");

const router = express.Router();

const { getStages, createStage } = require("../controllers/stageController");

const { verifyToken, authorize } = require("../middleware/authMiddleware");

router.use(verifyToken);

// =================================================
// GET STAGES
//
// Super Admin + Staff can read Stage Master.
// =================================================

router.get("/", authorize("superadmin", "staff"), getStages);

// =================================================
// CREATE STAGE
//
// Only Super Admin can modify Stage Master.
// =================================================

router.post("/", authorize("superadmin"), createStage);

module.exports = router;
