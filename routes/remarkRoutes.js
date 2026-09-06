const express = require("express");
const router = express.Router();

const remarkController = require("../controllers/remarkController");

// CREATE REMARK
router.post("/", remarkController.createRemark);

// GET CLIENT REMARKS
router.get("/client/:clientId", remarkController.getClientRemarks);

// DELETE REMARK
router.delete("/:id", remarkController.deleteRemark);

module.exports = router;