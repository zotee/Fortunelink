const express = require("express");

const {
  createStaff,
  getAllStaff,
  getOneStaff,
  getStaffClients,
  updateStaff,
  deleteStaff,
} = require("../controllers/staffController");
const { verifyToken, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", verifyToken, authorize("superadmin"), createStaff);
router.get("/", verifyToken, getAllStaff);
router.get("/:id/clients", verifyToken, getStaffClients);
router.get("/:id", verifyToken, getOneStaff);
router.patch("/:id", verifyToken, authorize("superadmin"), updateStaff);
router.delete("/:id", verifyToken, authorize("superadmin"), deleteStaff);

module.exports = router;
