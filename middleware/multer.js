const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// ---------------------------------------------------------------------------
// Upload directory structure
//   <project>/uploads/<folder>/<timestamp>-<random>.<ext>
// ---------------------------------------------------------------------------

const UPLOAD_ROOT = path.join(__dirname, "..", "uploads");

// Map of media kind -> allowed mime types, extensions and max size.
const MEDIA_TYPES = {
    image: {
        mimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
        extensions: [".jpg", ".jpeg", ".png", ".webp"],
        maxSizeMB: 5,
    },
    video: {
        mimeTypes: ["video/mp4", "video/webm", "video/quicktime"],
        extensions: [".mp4", ".webm", ".mov"],
        maxSizeMB: 100,
    },
};

/**
 * Normalize an upload folder name into a safe directory name.
 * Only [a-z0-9-_] are allowed; everything else is stripped.
 */
const safeFolder = (folder) => {
    const name = String(folder || "misc")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-_]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    return name || "misc";
};

/**
 * Resolve the media kind ("image" | "video") from a folder name. Used so a
 * single upload endpoint can enforce the correct validation rules per folder.
 */
const kindFromFolder = (folder) => {
    const name = safeFolder(folder);
    if (name.startsWith("video")) return "video";
    if (name.startsWith("image")) return "image";
    return null;
};

/**
 * Express handler that applies multer to a single file field ("file") while
 * validating the file type/size based on the folder the client is targeting.
 *
 * Usage: router.post("/upload/:folder", protect, adminOnly, uploadSingle("file"), controller)
 */
const uploadSingle = (fieldName = "file", options = {}) => {
    return (req, res, next) => {
        const folderName = safeFolder(options.folder || req.params.folder || req.body.folder || "misc");
        const kind = kindFromFolder(folderName) || (req.body.kind === "video" ? "video" : "image");
        const rules = MEDIA_TYPES[kind] || MEDIA_TYPES.image;

        const targetDir = path.join(UPLOAD_ROOT, folderName);
        fs.mkdirSync(targetDir, { recursive: true });

        const storage = multer.diskStorage({
            destination: (req2, file, cb) => cb(null, targetDir),
            filename: (req2, file, cb) => {
                const ext = path.extname(file.originalname || "").toLowerCase();
                const random = crypto.randomBytes(8).toString("hex");
                const ts = Date.now();
                cb(null, `${ts}-${random}${ext}`);
            },
        });

        const fileFilter = (req2, file, cb) => {
            const ext = path.extname(file.originalname || "").toLowerCase();
            if (!rules.mimeTypes.includes(file.mimetype)) {
                return cb(
                    new Error(`Unsupported file type "${file.mimetype}". Allowed: ${rules.mimeTypes.join(", ")}`)
                );
            }
            if (!rules.extensions.includes(ext)) {
                return cb(
                    new Error(`Unsupported file extension "${ext}". Allowed: ${rules.extensions.join(", ")}`)
                );
            }
            cb(null, true);
        };

        const upload = multer({
            storage,
            fileFilter,
            limits: { fileSize: rules.maxSizeMB * 1024 * 1024 },
        }).single(fieldName);

        upload(req, res, (err) => {
            if (err) {
                const message =
                    err.code === "LIMIT_FILE_SIZE"
                        ? `File too large. Maximum allowed size is ${rules.maxSizeMB}MB for ${kind} files.`
                        : err.message || "Upload failed.";
                return res.status(400).json({ success: false, message });
            }
            if (!req.file) {
                return res.status(400).json({ success: false, message: "No file was uploaded. Field name must be 'file'." });
            }
            req.uploadedFile = {
                fieldname: req.file.fieldname,
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                filename: req.file.filename,
                path: req.file.path,
                folder: folderName,
                kind,
                // Server-relative URL path persisted in the database, e.g. /uploads/gallery/123-abc.webp
                url: `/uploads/${folderName}/${req.file.filename}`,
            };
            next();
        });
    };
};

module.exports = { uploadSingle, UPLOAD_ROOT, MEDIA_TYPES };
