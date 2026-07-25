const express = require("express");
const router = express.Router();
const memberProfileController = require("../controllers/memberProfileController");
const { protect } = require("../middleware/authMiddleware");

// All profile endpoints require authentication
router.use(protect);

router.get("/", memberProfileController.getMemberProfile);
router.post("/", memberProfileController.createOrUpdateProfile);
router.put("/", memberProfileController.createOrUpdateProfile);

module.exports = router;
