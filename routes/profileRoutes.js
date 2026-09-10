const express = require("express");

const {
  createProfile,
  getAllProfiles,
  getProfileDetails,
  updateProfile,
  deleteProfile,
} = require("../controllers/profileController");

const upload = require("../middleware/upload");

const router = express.Router();

const profileUploads = upload.fields([
  {
    name: "clientImage",
    maxCount: 1,
  },
  {
    name: "cv",
    maxCount: 1,
  },
]);

router.post("/", profileUploads, createProfile);

router.get("/", getAllProfiles);
router.get("/profiles/:clientId", getProfileDetails);
router.patch("/profiles/:clientId", profileUploads, updateProfile);
router.delete("/profiles/:clientId", deleteProfile);

module.exports = router;