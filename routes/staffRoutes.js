const express = require("express");

const {
  createStaff,
  getAllStaff,
  getOneStaff,
  getStaffClients,
  updateStaff,
  deleteStaff,
} = require("../controllers/staffController");

const router = express.Router();

// POST /api/staff
router.post("/", createStaff);

// GET /api/staff
router.get("/", getAllStaff);

/*
 * IMPORTANT:
 * This must be above router.get("/:id")
 */
router.get("/:id/clients", getStaffClients);

// GET /api/staff/W-122265
router.get("/:id", getOneStaff);

// PATCH /api/staff/W-122265
router.patch("/:id", updateStaff);

// DELETE /api/staff/W-122265
router.delete("/:id", deleteStaff);

module.exports = router;