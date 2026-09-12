const express = require("express");
const remarkController = require("../controllers/remarkController");
const { verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(verifyToken);

router.post("/", remarkController.createRemark);
router.get("/client/:clientId", remarkController.getClientRemarks);
router.delete("/:id", remarkController.deleteRemark);

module.exports = router;
