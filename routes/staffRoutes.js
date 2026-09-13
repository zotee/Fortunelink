const express = require("express");

const {
  createStaff,
  getAllStaff,
  getOneStaff,
  getStaffClients,
  updateStaff,
  updateStaffStatus,
} = require("../controllers/staffController");

const { verifyToken, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// =================================================
// ALL STAFF MANAGEMENT ROUTES:
// SUPER ADMIN ONLY
// =================================================

router.use(verifyToken, authorize("superadmin"));

// =================================================
// CREATE STAFF
// POST /api/staff
// =================================================

router.post("/", createStaff);

// =================================================
// GET ALL STAFF
// GET /api/staff
// =================================================

router.get("/", getAllStaff);

// =================================================
// GET STAFF CLIENTS
// Keep above /:id
// GET /api/staff/:id/clients
// =================================================

router.get("/:id/clients", getStaffClients);

// =================================================
// UPDATE STAFF STATUS
// Keep above /:id if desired for clarity
// PATCH /api/staff/:id/status
// =================================================

router.patch("/:id/status", updateStaffStatus);

// =================================================
// GET ONE STAFF
// GET /api/staff/:id
// =================================================

router.get("/:id", getOneStaff);

// =================================================
// UPDATE STAFF
// PATCH /api/staff/:id
// =================================================

router.patch("/:id", updateStaff);

module.exports = router;
