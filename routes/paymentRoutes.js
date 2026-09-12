const express = require("express");
const {
  createPayment,
  getPayments,
  deletePayment,
} = require("../controllers/paymentController");
const { verifyToken, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(verifyToken);
router.post("/", createPayment);
router.get("/", getPayments);
router.delete("/:id", authorize("superadmin"), deletePayment);

module.exports = router;
