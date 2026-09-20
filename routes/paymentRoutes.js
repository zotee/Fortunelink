const express = require("express");

const router = express.Router();

const { getClientPayments } = require("../controllers/paymentController");

const { verifyToken, authorize } = require("../middleware/authMiddleware");

router.use(verifyToken);

// =================================================
// CLIENT PAYMENT HISTORY
// ADMIN + STAFF
// =================================================

router.get(
  "/client/:clientId",
  authorize("superadmin", "staff"),
  getClientPayments,
);

module.exports = router;
