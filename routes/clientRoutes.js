const express = require("express");

const {
  createClient,
  getAllClients,
  getClientsByStaff,
  getClientDetails,
  updateClient,
  deleteClient,
  assignClient,
} = require("../controllers/clientController");

const upload = require("../middleware/upload");

const router = express.Router();
// ✅ GET ALL CLIENTS + STAFF INFO
router.get("/", async (req, res) => {
  try {
    const clients = await Client.find().populate("assignedStaff", "name email");

const clientUploads = upload.fields([
  {
    name: "clientImage",
    maxCount: 1,
  },
  {
    name: "cv",
    maxCount: 1,
  },
]);

router.post("/", clientUploads, createClient);

router.get("/", getAllClients);

// Specific routes must come before /:clientId
router.get("/staff/:staffId", getClientsByStaff);
router.put("/assign/:clientId", assignClient);

router.get("/:clientId", getClientDetails);
router.patch("/:clientId", clientUploads, updateClient);
router.delete("/:clientId", deleteClient);

module.exports = router;