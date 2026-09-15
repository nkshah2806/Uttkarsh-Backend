const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { backupAsset } = require("../services/assetStorageService");

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

/** Tag an error so the handler can map it to HTTP 415 (Unsupported Media Type). */
const unsupportedTypeError = (message) => {
    const err = new Error(message);
    err.code = "UNSUPPORTED_FILE_TYPE";
    return err;
};

/**
 * Express handler that applies multer to a single file field while validating
 * the file type/size based on the folder the client is targeting.
 *
 * Usage:
 *   router.post("/upload/:folder", protect, adminOnly, uploadSingle("file"), controller)
 *   router.post("/uploadProfileImage", protect, uploadSingle("profileImage", { folder: "users" }), controller)
 *
 * Status codes returned:
 *   400 — no file in the request, or an unexpected/invalid field name
 *   413 — file exceeds the allowed size for the detected media kind
 *   415 — file mime type / extension is not allowed
 */
const uploadSingle = (fieldName = "file", options = {}) => {
    return (req, res, next) => {
        // ------------------------------------------------------------------
        // CRITICAL: this setup code runs BEFORE multer parses the multipart
        // body, so `req.body` is NOT populated yet. Express 5 / body-parser
        // sets `req.body = undefined` for multipart/form-data requests, and
        // multer only assigns `req.body = Object.create(null)` inside its own
        // request handler (which runs later, from `upload(...)` below).
        //
        // Reading `req.body.kind` directly here therefore threw
        //   TypeError: Cannot read properties of undefined (reading 'kind')
        // which Express turned into "500 Internal Server Error" for
        // POST /api/user/uploadProfileImage (and every other upload route).
        // Always go through a local `body` fallback object.
        // ------------------------------------------------------------------
        const body = req.body || {};
        const folderName = safeFolder(options.folder || req.params.folder || body.folder || "misc");
        const kind = kindFromFolder(folderName) || (body.kind === "video" ? "video" : "image");
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
                    unsupportedTypeError(
                        `Unsupported file type "${file.mimetype}". Allowed: ${rules.mimeTypes.join(", ")}`
                    )
                );
            }
            if (!rules.extensions.includes(ext)) {
                return cb(
                    unsupportedTypeError(
                        `Unsupported file extension "${ext}". Allowed: ${rules.extensions.join(", ")}`
                    )
                );
            }
            cb(null, true);
        };

        const upload = multer({
            storage,
            fileFilter,
            limits: { fileSize: rules.maxSizeMB * 1024 * 1024 },
        }).single(fieldName);

        upload(req, res, async (err) => {
            if (err) {
                let status = 400;
                let code = err.code || "UPLOAD_VALIDATION_FAILED";
                let message = err.message || "Upload failed.";

                if (err.code === "LIMIT_FILE_SIZE") {
                    status = 413;
                    code = "FILE_TOO_LARGE";
                    message = `File too large. Maximum allowed size is ${rules.maxSizeMB}MB for ${kind} files.`;
                } else if (err.code === "UNSUPPORTED_FILE_TYPE") {
                    status = 415;
                    code = "UNSUPPORTED_FILE_TYPE";
                } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
                    status = 400;
                    code = "UNEXPECTED_FILE";
                    message = `Unexpected file field "${err.field}". The field name must be "${fieldName}".`;
                } else if (err instanceof multer.MulterError) {
                    status = 400;
                }

                console.error(
                    `[Upload] ${status} ${req.method} ${req.originalUrl} :: ${message} (code=${code})`
                );
                return res.status(status).json({ success: false, message, error: code });
            }

            if (!req.file) {
                const message = `No file was uploaded. The field name must be "${fieldName}".`;
                console.error(`[Upload] 400 ${req.method} ${req.originalUrl} :: ${message}`);
                return res.status(400).json({ success: false, message, error: "NO_FILE" });
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

            console.log(
                `[Upload] stored ${req.uploadedFile.url} (${req.file.size} bytes, ${req.file.mimetype}, folder=${folderName})`
            );

            // Production durability: Render's filesystem is ephemeral, so also
            // mirror images into MongoDB. Intentionally NOT awaited so the
            // upload response is never delayed (or blocked) by the backup —
            // backupAsset catches all of its own errors internally, so this
            // cannot produce an unhandled rejection.
            backupAsset(req.uploadedFile);

            next();
        });
    };
};

module.exports = { uploadSingle, UPLOAD_ROOT, MEDIA_TYPES };
