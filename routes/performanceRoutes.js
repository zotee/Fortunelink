const express = require("express");
const {
  getPerformanceSummary,
} = require("../controllers/performanceController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", verifyToken, getPerformanceSummary);

module.exports = router;
