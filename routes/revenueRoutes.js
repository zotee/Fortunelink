const express = require("express");
const { getRevenueSummary } = require("../controllers/revenueController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", verifyToken, getRevenueSummary);

module.exports = router;
