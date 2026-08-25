const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { getOverview } = require("../controllers/dashboardController");

// All dashboard routes require authentication; scoping is applied via req.franchiseFilter
router.use(protect);

router.get("/overview", getOverview);

module.exports = router;
