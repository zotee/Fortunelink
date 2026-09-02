const express = require("express");
const router = express.Router();
const Staff = require("../model/staffSchema");
const Client = require("../model/clientSchema");

// ✅ CREATE STAFF
router.post("/staff", async (req, res) => {
  try {
    const staff = new Staff(req.body);
    await staff.save();

    res.json({
      message: "Staff created",
      data: staff,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ GET STAFF + CLIENT COUNT
router.get("/staff", async (req, res) => {
  try {
    const staffList = await Staff.find();

    const result = await Promise.all(
      staffList.map(async (staff) => {
        const count = await Client.countDocuments({
          assignedStaff: staff._id,
        });

        return {
          ...staff.toObject(),
          totalClients: count,
        };
      })
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ GET ONE STAFF
router.get("/staff/:id", async (req, res) => {
  const staff = await Staff.findById(req.params.id);
  res.json(staff);
});

module.exports = router;