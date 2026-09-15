const fs = require("fs");
const UploadedAsset = require("../models/UploadedAsset");

// ---------------------------------------------------------------------------
// Production-safe asset storage helpers.
//
// See models/UploadedAsset.js for the rationale. Summary: uploaded images are
// written to the local disk (existing architecture) AND mirrored into MongoDB,
// because Render's production filesystem is ephemeral. When a disk file is
// missing, `restoreAsset` serves the MongoDB copy so the image (and therefore
// the member's profile picture) survives redeploys and restarts.
//
// Every helper is best-effort and never throws, so it can never turn a
// successful upload into a failed request.
// ---------------------------------------------------------------------------

// MongoDB documents are limited to 16MB; keep a safety margin below that.
const MAX_BACKUP_BYTES = 15 * 1024 * 1024;

/**
 * Mirror an uploaded image into MongoDB so it survives an ephemeral filesystem.
 * Non-fatal: any failure is logged and swallowed (the disk copy still works).
 *
 * @param {{url:string, path:string, folder:string, filename:string, mimetype:string, size:number, kind:string}} uploadedFile
 */
const backupAsset = async (uploadedFile) => {
    try {
        if (!uploadedFile || uploadedFile.kind !== "image") return;
        if (!uploadedFile.path || !uploadedFile.url) return;
        if ((uploadedFile.size || 0) > MAX_BACKUP_BYTES) return;
        if (!fs.existsSync(uploadedFile.path)) return;

        const data = fs.readFileSync(uploadedFile.path);

        await UploadedAsset.updateOne(
            { url: uploadedFile.url },
            {
                $set: {
                    url: uploadedFile.url,
                    folder: uploadedFile.folder || "",
                    filename: uploadedFile.filename || "",
                    mimetype: uploadedFile.mimetype || "application/octet-stream",
                    size: uploadedFile.size || data.length,
                    data,
                },
            },
            { upsert: true }
        );

        console.log(`[Asset Backup] mirrored ${uploadedFile.url} to MongoDB (${data.length} bytes)`);
    } catch (err) {
        console.error(`[Asset Backup] failed for ${uploadedFile && uploadedFile.url} - ${err.message}`);
    }
};

/**
 * Remove the MongoDB mirror for a deleted/replaced file.
 * Non-fatal: any failure is logged and swallowed.
 *
 * @param {string} fileRef server-relative URL, e.g. "/uploads/users/x.png"
 */
const removeAssetBackup = async (fileRef) => {
    try {
        if (!fileRef || typeof fileRef !== "string" || !fileRef.startsWith("/uploads/")) return;
        await UploadedAsset.deleteOne({ url: fileRef });
        console.log(`[Asset Backup] removed MongoDB mirror for ${fileRef}`);
    } catch (err) {
        console.error(`[Asset Backup] failed to remove mirror for ${fileRef} - ${err.message}`);
    }
};

/**
 * Express middleware mounted under "/uploads" AFTER express.static.
 *
 * express.static serves the file when it exists on disk; when it does not
 * (e.g. after a Render redeploy wiped the filesystem) it calls next() and this
 * handler serves the MongoDB copy instead of returning 404.
 */
const restoreAsset = async (req, res, next) => {
    try {
        const relative = decodeURIComponent(req.path || "").replace(/^\/+/, "");
        if (!relative) return next();

        const url = `/uploads/${relative}`;
        const asset = await UploadedAsset.findOne({ url }).lean();
        if (!asset || !asset.data) return next();

        res.set("Content-Type", asset.mimetype || "application/octet-stream");
        res.set("Cache-Control", "public, max-age=604800");
        console.log(`[Asset Restore] served ${url} from MongoDB (disk copy missing)`);
        return res.send(asset.data);
    } catch (err) {
        // Never break static file serving because of a restore failure.
        console.error(`[Asset Restore] failed - ${err.message}`);
        return next();
    }
};

module.exports = { backupAsset, removeAssetBackup, restoreAsset, MAX_BACKUP_BYTES };
