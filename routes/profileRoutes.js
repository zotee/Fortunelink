const express = require("express");
const router = express.Router();

const Profile = require("../model/profileSchema");
const upload = require("../middleware/upload");

// 📌 CREATE PROFILE (with file upload)
router.post(
  "/profiles",
  upload.fields([
    { name: "clientImage", maxCount: 1 },
    { name: "cv", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const profile = new Profile({
        ...req.body,
        clientImage: req.files?.clientImage?.[0]?.path,
        cv: req.files?.cv?.[0]?.path,
      });

      await profile.save();

      res.status(201).json({
        message: "Profile created successfully",
        data: profile,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// 📌 GET ALL PROFILES
router.get("/profiles", async (req, res) => {
  const profiles = await Profile.find().populate("assignedStaff");
  res.json(profiles);
});

// 📌 GET SINGLE PROFILE
router.get("/profiles/:id", async (req, res) => {
  try {
    const profile = await Profile.findById(req.params.id).populate(
      "assignedStaff"
    );

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📌 UPDATE PROFILE
router.put("/profiles/:id", async (req, res) => {
  try {
    const updated = await Profile.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json({
      message: "Profile updated successfully",
      data: updated,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📌 DELETE PROFILE
router.delete("/profiles/:id", async (req, res) => {
  try {
    await Profile.findByIdAndDelete(req.params.id);

    res.json({ message: "Profile deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;