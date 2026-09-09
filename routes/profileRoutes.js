const express = require("express");
const router = express.Router();

const Profile = require("../model/profileSchema");
const Remark = require("../model/remarkSchema");
const upload = require("../middleware/upload");

// 📌 CREATE PROFILE (with file upload)
router.post(
  "/",
  upload.fields([
    { name: "clientImage", maxCount: 1 },
    { name: "cv", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const profile = new Profile({
        ...req.body,
        clientImage: req.files?.clientImage?.[0]?.path || "",
        cv: req.files?.cv?.[0]?.path || "",
      });

      await profile.save();

      res.status(201).json({
        message: "Profile created successfully",
        data: profile,
      });
    } catch (err) {
      res.status(500).json({
        error: err.message,
      });
    }
  }
);

// 📌 GET ALL PROFILES
router.get("/profiles", async (req, res) => {
  try {
    const profiles = await Profile.find().populate("assignedStaff");

    res.json(profiles);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// 📌 GET SINGLE PROFILE WITH REMARKS
router.get("/profiles/:id", async (req, res) => {
  try {
    const profile = await Profile.findById(req.params.id).populate(
      "assignedStaff"
    );

    if (!profile) {
      return res.status(404).json({
        message: "Profile not found",
      });
    }

    // Get all remarks belonging to this profile
    const remarks = await Remark.find({
      clientId: profile._id,
    }).sort({ createdAt: -1 });

    res.json({
      ...profile.toObject(),
      remarks,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// 📌 UPDATE PROFILE
router.put("/profiles/:id", async (req, res) => {
  try {
    const updated = await Profile.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updated) {
      return res.status(404).json({
        message: "Profile not found",
      });
    }

    res.json({
      message: "Profile updated successfully",
      data: updated,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

// 📌 DELETE PROFILE
router.delete("/profiles/:id", async (req, res) => {
  try {
    const deleted = await Profile.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        message: "Profile not found",
      });
    }

    res.json({
      message: "Profile deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

module.exports = router;
