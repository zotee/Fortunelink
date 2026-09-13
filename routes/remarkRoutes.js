const express = require("express");

const router = express.Router();

const {
  createRemark,
  getClientRemarks,
} = require("../controllers/remarkController");

const { verifyToken, authorize } = require("../middleware/authMiddleware");

// =================================================
// ALL REMARK ROUTES REQUIRE LOGIN
// =================================================

router.use(verifyToken);

// =================================================
// CREATE REMARK
//
// Admin:
// any client
//
// Staff:
// own assigned clients
//
// POST /api/remarks
// =================================================

router.post("/", authorize("superadmin", "staff"), createRemark);

// =================================================
// GET REMARK HISTORY
//
// Admin:
// any client
//
// Staff:
// own assigned clients
//
// GET /api/remarks/client/J-176587355
// =================================================

router.get(
  "/client/:clientId",
  authorize("superadmin", "staff"),
  getClientRemarks,
);

module.exports = router;
