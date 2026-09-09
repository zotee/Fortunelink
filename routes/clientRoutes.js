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

// Admin can request all clients
router.get("/", getAllClients);

// Must be before /:clientId
router.get("/staff/:staffId", getClientsByStaff);
router.put("/assign/:clientId", assignClient);

router.get("/:clientId", getClientDetails);
router.patch("/:clientId", clientUploads, updateClient);
router.delete("/:clientId", deleteClient);

module.exports = router;