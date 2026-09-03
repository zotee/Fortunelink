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
router.post("/staff", createStaff);


// GET ALL STAFF
router.get("/staff", getAllStaff);


// GET ONE STAFF
router.get("/staff/:id", getOneStaff);


// UPDATE STAFF
router.put("/staff/:id", updateStaff);


// DELETE STAFF
router.delete("/staff/:id", deleteStaff);


module.exports = router;