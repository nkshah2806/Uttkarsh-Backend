const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { uploadSingle } = require("../middleware/multer");
const { uploadFile, deleteFile } = require("../controllers/uploadController");

// POST /api/upload/:folder — upload one image or video (admin only)
// Example folders: gallery, gallery-video, health-camps, categories, products,
// hero, mission, testimonials, trust-badges, users.
router.post("/:folder", protect, adminOnly, uploadSingle("file"), uploadFile);

// DELETE /api/upload — remove an uploaded file by its /uploads/... URL
router.delete("/", protect, adminOnly, deleteFile);

module.exports = router;
