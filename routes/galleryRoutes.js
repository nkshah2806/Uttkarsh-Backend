const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");
const {
    getActiveGallery,
    getAllGalleryItems,
    getGalleryItemById,
    createGalleryItem,
    updateGalleryItem,
    deleteGalleryItem,
} = require("../controllers/galleryController");

// Public website reads must stay OPEN (no token available on the public site),
// so protect/adminOnly is applied per-route instead of globally.
router.route("/").get(getActiveGallery).post(protect, adminOnly, createGalleryItem);

// Admin-only full listing (includes inactive items). Must be registered BEFORE
// "/:id" so "all" is never captured as an id.
router.get("/all", protect, adminOnly, getAllGalleryItems);

router.route("/:id").get(getGalleryItemById);

router.put("/:id", protect, adminOnly, updateGalleryItem);
router.delete("/:id", protect, adminOnly, deleteGalleryItem);

module.exports = router;
