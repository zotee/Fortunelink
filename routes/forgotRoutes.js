const express = require("express");

const router = express.Router();

const {
  forgotPassword,
  verifyResetCode,
  resetPassword,
} = require("../controllers/forgotController");

// Public routes.
// Authentication is not required because users cannot log in.
router.post(
  "/forgot-password",
  forgotPassword,
);

router.post(
  "/verify-reset-code",
  verifyResetCode,
);

router.post(
  "/reset-password",
  resetPassword,
);

module.exports = router;