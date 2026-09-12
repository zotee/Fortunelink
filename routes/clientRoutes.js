const express = require("express");
const router = express.Router();

const {
  createClient,
  getAllClients,
  getClientsByStaff,
  getClientDetails,
  updateClient,
  deleteClient,
  assignClient,
} = require("../controllers/clientController");

const { verifyToken, authorize } = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");

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

router.post("/", verifyToken, createClient);
router.get("/", verifyToken, getAllClients);
router.get("/staff/:staffId", verifyToken, getClientsByStaff);
router.put(
  "/assign/:clientId",
  verifyToken,
  authorize("superadmin"),
  assignClient,
);
router.get("/:clientId", verifyToken, getClientDetails);
router.patch("/:clientId", verifyToken, clientUploads, updateClient);
router.delete("/:clientId", verifyToken, authorize("superadmin"), deleteClient);

module.exports = router;
