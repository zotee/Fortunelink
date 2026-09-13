const express = require("express");

const router = express.Router();

const {
  createPayment,
  getClientPayments,
} = require("../controllers/paymentController");

const { verifyToken, authorize } = require("../middleware/authMiddleware");

router.use(verifyToken);

// =================================================
// CREATE PAYMENT
// ADMIN + STAFF
// =================================================

router.post("/", authorize("superadmin", "staff"), createPayment);

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
