const express = require("express");
const router = express.Router();

const {
  createClient,
  getAllClients,
  getClientDetails,
  updateClient,
  deleteClient,
} = require("../controllers/clientController");

// Make sure these names match the exports above exactly
router.post("/", createClient);
router.get("/", getAllClients);
router.get("/:clientId", getClientDetails);
router.patch("/:clientId", updateClient);
router.delete("/:clientId", deleteClient);

module.exports = router;
