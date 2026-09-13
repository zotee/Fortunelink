const express = require("express");

const router = express.Router();

const {
  getClientStages,
  changeClientStage,
} = require("../controllers/clientStageController");

const { verifyToken, authorize } = require("../middleware/authMiddleware");

router.use(verifyToken);

// =================================================
// VIEW PROGRESS
// =================================================

router.get("/:clientId", authorize("superadmin", "staff"), getClientStages);

// =================================================
// CHANGE STAGE
// =================================================

router.post("/:clientId", authorize("superadmin", "staff"), changeClientStage);

module.exports = router;
