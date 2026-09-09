const fs = require("fs");
const path = require("path");
const { UPLOAD_ROOT } = require("../middleware/multer");

/**
 * Delete an uploaded file from disk safely.
 * Accepts a server-relative URL like "/uploads/gallery/123-abc.webp" or an
 * absolute path. Never throws — best-effort cleanup.
 */
const deleteUploadedFile = (fileRef) => {
    if (!fileRef || typeof fileRef !== "string") return;
    try {
        let absolute = fileRef;
        if (fileRef.startsWith("/uploads/")) {
            absolute = path.join(UPLOAD_ROOT, fileRef.replace("/uploads/", ""));
        }
        // Only delete files that live inside the uploads root (path traversal guard).
        const resolved = path.resolve(absolute);
        if (!resolved.startsWith(path.resolve(UPLOAD_ROOT))) return;
        if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
            fs.unlinkSync(resolved);
        }
    } catch (err) {
        // Best effort — a missing file must never break a delete/replace request.
        console.warn("Failed to remove uploaded file:", err.message);
    }
};

/**
 * @desc Upload a media file (image or video) from the admin panel.
 * @route POST /api/upload/:folder   (protect + adminOnly)
 * Body: multipart/form-data with field "file" (and optional "kind" for videos).
 */
const uploadFile = async (req, res) => {
    try {
        const file = req.uploadedFile;
        return res.status(201).json({
            success: true,
            message: "File uploaded successfully",
            data: {
                url: file.url,
                path: file.url,
                filename: file.filename,
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                folder: file.folder,
                kind: file.kind,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc Delete an uploaded file by URL path (admin only).
 * @route DELETE /api/upload  body: { url: "/uploads/..." }
 */
const deleteFile = async (req, res) => {
    try {
        const { url } = req.body || {};
        if (!url || typeof url !== "string") {
            return res.status(400).json({ success: false, message: "File url is required" });
        }
        deleteUploadedFile(url);
        return res.json({ success: true, message: "File deleted successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { uploadFile, deleteFile, deleteUploadedFile };
