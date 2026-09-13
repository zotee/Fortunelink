const express = require("express");

const router = express.Router();

const {
  createClientFee,
  getClientFees,
  updateClientFee,
  cancelClientFee,
} = require("../controllers/clientFeeController");

const { verifyToken, authorize } = require("../middleware/authMiddleware");

router.use(verifyToken);

// =================================================
// GET CLIENT FEES
//
// ADMIN + STAFF
// =================================================

router.get(
  "/client/:clientId",
  authorize("superadmin", "staff"),
  getClientFees,
);

// =================================================
// CREATE FEE
//
// ADMIN ONLY
// =================================================

router.post("/", authorize("superadmin"), createClientFee);

// =================================================
// CANCEL FEE
//
// ADMIN ONLY
// =================================================

router.patch("/:feeId/cancel", authorize("superadmin"), cancelClientFee);

// =================================================
// UPDATE FEE
//
// ADMIN ONLY
// =================================================

router.patch("/:feeId", authorize("superadmin"), updateClientFee);

module.exports = router;
