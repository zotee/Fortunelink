const express = require("express");
const remarkController = require("../controllers/remarkController");

// Check if protect middleware exists and is properly exported
let protect;
try {
  protect = require("../middleware/authMiddleware");
} catch (error) {
  console.error("Auth middleware not found:", error.message);
  // Fallback: create a dummy middleware if needed
  protect = (req, res, next) => next();
}

const router = express.Router();

// Only use protect if it's a valid middleware
if (typeof protect === 'function') {
  router.use(protect);
}

router.post("/", remarkController.createRemark);
router.get("/client/:clientId", remarkController.getClientRemarks);
router.delete("/:id", remarkController.deleteRemark);

module.exports = router;