const express = require("express");
const router = express.Router();
const { protect, approvedMemberOnly } = require("../middleware/authMiddleware");
const { getOverview } = require("../controllers/dashboardController");

// All dashboard routes require authentication; scoping is applied via req.franchiseFilter.
// Non-admin members must also have an approved profile before viewing dashboards.
router.use(protect);
router.use(approvedMemberOnly);

router.get("/overview", getOverview);

module.exports = router;
