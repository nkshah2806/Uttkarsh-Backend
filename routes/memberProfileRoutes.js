const express = require("express");
const router = express.Router();
const memberProfileController = require("../controllers/memberProfileController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

// All profile endpoints require authentication
router.use(protect);

router.get("/", memberProfileController.getMemberProfile);
router.post("/", memberProfileController.createOrUpdateProfile);
router.put("/", memberProfileController.createOrUpdateProfile);

// ---------------------------------------------------------------------------
// Admin-only endpoints for the member profile approval workflow.
// Mounted under /api/member/profile so the URLs become:
//   GET    /api/member/profile/admin/members
//   GET    /api/member/profile/admin/members/:id
//   PATCH  /api/member/profile/admin/members/:id/review
// ---------------------------------------------------------------------------
router.get("/admin/members", adminOnly, memberProfileController.getMemberProfilesForAdmin);
router.get("/admin/members/:id", adminOnly, memberProfileController.getMemberProfileForAdmin);
router.get("/admin/user/:userId", adminOnly, memberProfileController.getMemberProfileByUserForAdmin);
router.patch("/admin/members/:id/review", adminOnly, memberProfileController.reviewMemberProfile);

module.exports = router;
