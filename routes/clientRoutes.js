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

const upload = require("../middleware/upload");

const { verifyToken, authorize } = require("../middleware/authMiddleware");

// =================================================
// CLIENT FILE UPLOADS
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
// ALL CLIENT ROUTES REQUIRE LOGIN
// =================================================

router.use(verifyToken);

// =================================================
// CREATE CLIENT
//
// SUPERADMIN:
// must choose Staff
//
// STAFF:
// automatically assigned to themselves
//
// POST /api/clients
// =================================================

router.post("/", authorize("superadmin", "staff"), clientUploads, createClient);

// =================================================
// EXPORT FILTERED CLIENTS
//
// GET /api/clients/export/csv
// GET /api/clients/export/pdf
// GET /api/clients/export/xlsx
// =================================================

router.get("/export/:format", authorize("superadmin", "staff"), exportClients);

// =================================================
// GET CLIENT LIST
//
// SUPERADMIN:
// all clients
//
// STAFF:
// only their assigned clients
//
// GET /api/clients
// =================================================

router.get("/", authorize("superadmin", "staff"), getAllClients);

// =================================================
// ASSIGN / REASSIGN CLIENT
//
// SUPERADMIN ONLY
//
// PATCH /api/clients/J-176587346/assign
// =================================================

router.patch("/:clientId/assign", authorize("superadmin"), assignClient);

// =================================================
// GET CLIENT DETAILS
//
// SUPERADMIN:
// any client
//
// STAFF:
// own assigned client
//
// GET /api/clients/J-176587346
// =================================================

router.get("/:clientId", authorize("superadmin", "staff"), getClientDetails);

// =================================================
// UPDATE CLIENT
//
// SUPERADMIN:
// any client
//
// STAFF:
// own client only
//
// PATCH /api/clients/J-176587346
// =================================================

router.patch(
  "/:clientId",
  authorize("superadmin", "staff"),
  clientUploads,
  updateClient,
);

// =================================================
// DELETE CLIENT
//
// SUPERADMIN ONLY
//
// DELETE /api/clients/J-176587346
// =================================================

router.delete("/:clientId", authorize("superadmin"), deleteClient);

module.exports = router;
