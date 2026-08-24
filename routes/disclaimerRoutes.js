const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");
const {
  getDisclaimers,
  getActiveDisclaimer,
  getDisclaimerById,
  createDisclaimer,
  updateDisclaimer,
  toggleDisclaimerStatus,
  deleteDisclaimer,
} = require("../controllers/disclaimerController");

// Public / Authenticated read routes
router.get("/active", getActiveDisclaimer);
router.get("/", protect, getDisclaimers);
router.get("/:id", protect, getDisclaimerById);

// Admin-only mutation routes
router.post("/", protect, adminOnly, createDisclaimer);
router.put("/:id", protect, adminOnly, updateDisclaimer);
router.patch("/:id/toggle-status", protect, adminOnly, toggleDisclaimerStatus);
router.delete("/:id", protect, adminOnly, deleteDisclaimer);

module.exports = router;
