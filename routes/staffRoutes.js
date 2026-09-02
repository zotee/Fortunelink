const express = require("express");

const Staff = require("../model/staffSchema");
const CounterModel = require("../model/CounterModel");

const router = express.Router();

// ============================
// CREATE STAFF
// POST /api/staff
// ============================
router.post("/staff", async (req, res) => {
  try {
    const { name, phone, location, email } = req.body;

    // Check required fields
    if (!name || !phone || !location || !email) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }
const staffCounter = await CounterModel.findOneAndUpdate(
  { _id: "StaffId" },
  { $inc: { sequence_value: 1 } },
  {
    returnDocument: "after",
    upsert: true,
  }
);


    // Create staff
    const staff = new Staff({
      staffId: staffCounter.sequence_value,
      name,
      phone,
      location,
      email,
    });

    // Save to MongoDB
    await staff.save();

    res.status(201).json({
      message: "Staff created successfully",
      staff,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message,
    });
  }
});

// ============================
// GET ALL STAFF
// GET /api/staff
// ============================
router.get("/staff", async (req, res) => {
  try {
    const staff = await Staff.find();

    res.status(200).json(staff);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message,
    });
  }
});

// ============================
// GET ONE STAFF
// GET /api/staff/:id
// ============================
router.get("/staff/:id", async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({
        message: "Staff not found",
      });
    }

    res.status(200).json(staff);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message,
    });
  }
});

// ============================
// UPDATE STAFF
// PUT /api/staff/:id
// ============================
router.put("/staff/:id", async (req, res) => {
  try {
    const { name, phone, location, email } = req.body;

    if (!name || !phone || !location || !email) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const updatedStaff = await Staff.findByIdAndUpdate(
      req.params.id,
      {
        name,
        phone,
        location,
        email,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedStaff) {
      return res.status(404).json({
        message: "Staff not found",
      });
    }

    res.status(200).json({
      message: "Staff updated successfully",
      staff: updatedStaff,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message,
    });
  }
});

// ============================
// DELETE STAFF
// DELETE /api/staff/:id
// ============================
router.delete("/staff/:id", async (req, res) => {
  try {
    const deletedStaff = await Staff.findByIdAndDelete(req.params.id);

    if (!deletedStaff) {
      return res.status(404).json({
        message: "Staff not found",
      });
    }

    res.status(200).json({
      message: "Staff deleted successfully",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message,
    });
  }
});

module.exports = router;
