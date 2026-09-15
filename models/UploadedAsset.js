const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// UploadedAsset
//
// Durability layer for uploaded media (currently images).
//
// Why this exists:
//   Uploads are written to <project>/uploads on the server's local disk. That
//   is fine in local development, but production runs on Render, whose
//   filesystem is EPHEMERAL: every deploy and every restart (including
//   scale-to-zero spin-downs) wipes it. A profile picture stored only on disk
//   would therefore 404 after the next deploy even though the database still
//   references it.
//
//   To stay production-safe WITHOUT adding a paid service or third-party
//   credentials, the bytes of each image are also stored here in MongoDB
//   (which the app already uses). Existing URLs are unchanged
//   ("/uploads/users/<file>"), so nothing else in the system needs to change:
//   server.js simply falls back to this collection when the disk file is
//   missing.
//
//   Only images are backed up (they are capped at 5MB), which keeps every
//   document far below MongoDB's 16MB BSON limit. Large videos are deliberately
//   excluded.
// ---------------------------------------------------------------------------
const uploadedAssetSchema = new mongoose.Schema(
    {
        // Server-relative URL, e.g. "/uploads/users/1726...-ab12.webp"
        url: { type: String, required: true, unique: true, index: true },
        folder: { type: String, default: "" },
        filename: { type: String, default: "" },
        mimetype: { type: String, default: "" },
        size: { type: Number, default: 0 },
        // The raw file bytes.
        data: { type: Buffer, required: true },
    },
    { timestamps: true }
);

module.exports = mongoose.models.UploadedAsset || mongoose.model("UploadedAsset", uploadedAssetSchema);
