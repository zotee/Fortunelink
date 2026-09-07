const express = require("express");
const router = express.Router();
const Client = require("../model/clientSchema");

// ✅ CREATE CLIENT
router.post("/clients", async (req, res) => {
  try {
    const client = new Client(req.body);
    await client.save();

    res.status(201).json({
      message: "Client created",
      data: client,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ GET ALL CLIENTS + STAFF INFO
router.get("/", async (req, res) => {
  try {
    const clients = await Client.find()
      .populate("assignedStaff", "name email");

    res.json({
      count: clients.length,
      data: clients,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ ASSIGN CLIENT TO STAFF
router.put("/assign/:id", async (req, res) => {
  try {
    const { staffId } = req.body;

    const updated = await Client.findByIdAndUpdate(
      req.params.id,
      { assignedStaff: staffId },
      { new: true }
    );

    res.json({
      message: "Client assigned",
      data: updated,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ GET CLIENTS BY STAFF
router.get("/staff/:staffId", async (req, res) => {
  try {
    const clients = await Client.find({
      assignedStaff: req.params.staffId,
    });

    res.json({
      count: clients.length,
      data: clients,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ DELETE
router.delete("/:id", async (req, res) => {
  await Client.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

module.exports = router;