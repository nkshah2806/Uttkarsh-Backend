const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");
const {
    getLegalContentList,
    getActiveLegalContent,
    getLegalContentById,
    createLegalContent,
    updateLegalContent,
    toggleLegalContentStatus,
    deleteLegalContent,
} = require("../controllers/legalContentController");

// Public read route (active content by type)
// GET /api/v1/legal-content/active?type=privacy_policy
router.get("/active", getActiveLegalContent);

// Authenticated read routes
router.get("/", protect, getLegalContentList);
router.get("/:id", protect, getLegalContentById);

// Admin-only mutation routes
router.post("/", protect, adminOnly, createLegalContent);
router.put("/:id", protect, adminOnly, updateLegalContent);
router.patch("/:id/toggle-status", protect, adminOnly, toggleLegalContentStatus);
router.delete("/:id", protect, adminOnly, deleteLegalContent);

module.exports = router;
