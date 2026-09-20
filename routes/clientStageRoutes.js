const express = require("express");
const router = express.Router();
const {
  getClientStageHistory,
  updateClientStage,
} = require("../controllers/clientStageController");
const { verifyToken, authorize } = require("../middleware/authMiddleware");
router.use(verifyToken);
// =================================================
// GET HISTORY
// =================================================
router.get(
  "/:clientId",
  authorize("superadmin", "staff"),
  getClientStageHistory,
);
// =================================================
// CHANGE STAGE
// =================================================
router.post("/:clientId", authorize("superadmin", "staff"), updateClientStage);
module.exports = router;
