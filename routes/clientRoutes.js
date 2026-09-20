const express = require("express");

const router = express.Router();

const {
  createClient,
  getAllClients,
  getClientDetails,
  updateClient,
  deleteClient,
  assignClient,
  exportClients,
} = require("../controllers/clientController");

const { generateJapaneseCv } = require("../controllers/clientCvController");

const upload = require("../middleware/upload");

const { verifyToken, authorize } = require("../middleware/authMiddleware");

// =================================================
// UPLOAD
// =================================================

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

// =================================================
// AUTH
// =================================================

router.use(verifyToken);

// =================================================
// CREATE
// =================================================

router.post("/", authorize("superadmin", "staff"), clientUploads, createClient);

// =================================================
// EXPORT LIST
// =================================================

router.get("/export/:format", authorize("superadmin", "staff"), exportClients);

// =================================================
// LIST
// =================================================

router.get("/", authorize("superadmin", "staff"), getAllClients);

// =================================================
// GENERATE JAPANESE CV
// =================================================

router.get(
  "/:clientId/japanese-cv",
  authorize("superadmin", "staff"),
  generateJapaneseCv,
);

// =================================================
// ASSIGN
// =================================================

router.patch("/:clientId/assign", authorize("superadmin"), assignClient);

// =================================================
// DETAIL
// =================================================

router.get("/:clientId", authorize("superadmin", "staff"), getClientDetails);

// =================================================
// UPDATE
// =================================================

router.patch(
  "/:clientId",
  authorize("superadmin", "staff"),
  clientUploads,
  updateClient,
);

// =================================================
// DELETE
// =================================================

router.delete("/:clientId", authorize("superadmin"), deleteClient);

module.exports = router;
