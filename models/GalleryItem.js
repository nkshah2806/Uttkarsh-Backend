const mongoose = require("mongoose");

// One photo or video shown on the public Gallery page.
//
// Media is uploaded from the admin's local device and stored on the server
// under /uploads/gallery/... or /uploads/gallery-video/.... The database only
// stores the server-relative file reference (e.g. /uploads/gallery/123-abc.webp).
// For videos the stored file reference points to an uploaded MP4/WebM/MOV file;
// the frontend renders it with a native <video> tag.
// converts it to an embed URL before rendering.
const galleryItemSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            required: true,
            enum: ["photo", "video"],
        },
        title: { type: String, required: true, trim: true },
        description: { type: String, default: "" },
        // Photo: uploaded image file reference (/uploads/gallery/...).
        // Video: uploaded video file reference (/uploads/gallery-video/...).
        media_url: { type: String, default: "" },
        // Optional uploaded cover/thumbnail file reference (mainly for videos).
        thumbnail_url: { type: String, default: "" },
        // Optional free-text category (Camps, Events, Activities, ...).
        category: { type: String, default: "", trim: true },
        // Ascending sort order on the public page (lower = first).
        display_order: { type: Number, default: 0 },
        is_active: { type: Boolean, default: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model("GalleryItem", galleryItemSchema);
