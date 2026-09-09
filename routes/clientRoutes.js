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

// Make sure these names match the exports above exactly
router.post("/", createClient);
router.get("/", getAllClients);
router.get("/:clientId", getClientDetails);
router.patch("/:clientId", updateClient);
router.delete("/:clientId", deleteClient);

// Specific routes must come before /:clientId
router.get("/staff/:staffId", getClientsByStaff);
router.put("/assign/:clientId", assignClient);

router.get("/:clientId", getClientDetails);
router.patch("/:clientId", clientUploads, updateClient);
router.delete("/:clientId", deleteClient);

module.exports = router;
