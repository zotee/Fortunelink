const express = require("express");

const {
  createProfile,
  getAllProfiles,
  getProfileDetails,
  updateProfile,
  deleteProfile,
} = require("../controllers/profileController");

const upload = require("../middleware/upload");
const { verifyToken } = require("../middleware/authMiddleware");

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

router.post("/", verifyToken, profileUploads, createProfile);

router.get("/", verifyToken, getAllProfiles);
router.get("/profiles/:clientId", verifyToken, getProfileDetails);
router.patch("/profiles/:clientId", verifyToken, profileUploads, updateProfile);
router.delete("/profiles/:clientId", verifyToken, deleteProfile);

module.exports = router;
