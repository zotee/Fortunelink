const express = require("express");

const router = express.Router();

const {
  createStaff,
  getAllStaff,
  getOneStaff,
  updateStaff,
  deleteStaff,
} = require("../controllers/staffController");

// CREATE STAFF
router.post("/", createStaff);

// GET ALL STAFF
router.get("/staff", getAllStaff);

// GET ONE STAFF
router.get("/:id", getOneStaff);

// UPDATE STAFF
router.put("/:id", updateStaff);

// DELETE STAFF
router.delete("/:id", deleteStaff);

module.exports = router;
