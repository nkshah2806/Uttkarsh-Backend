const GalleryItem = require("../models/GalleryItem");
const { deleteUploadedFile } = require("./uploadController");

// File reference helpers -----------------------------------------------------

// Media is now stored as a server-relative file reference produced by our
// upload endpoint, e.g. /uploads/gallery/123-abc.webp. External http(s) URLs
// are no longer accepted for new/updated gallery items.
const isFileReference = (value) => {
    if (!value || typeof value !== "string" || !value.trim()) return true; // optional field
    return /^\/uploads\/[a-z0-9-_]+\/[^/]+$/.test(value.trim());
};

// @desc Get active gallery items for the public page (only is_active, sorted)
// @route GET /api/gallery
const getActiveGallery = async (req, res) => {
    try {
        const items = await GalleryItem.find({ is_active: true }).sort({
            display_order: 1,
            createdAt: -1,
        });
        return res.json({ success: true, count: items.length, data: items });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get ALL gallery items including inactive (admin listing)
// @route GET /api/gallery/all
const getAllGalleryItems = async (req, res) => {
    try {
        const items = await GalleryItem.find({}).sort({
            display_order: 1,
            createdAt: -1,
        });
        return res.json({ success: true, count: items.length, data: items });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get a single gallery item by ID
// @route GET /api/gallery/:id
const getGalleryItemById = async (req, res) => {
    try {
        const item = await GalleryItem.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, message: "Gallery item not found" });
        }
        return res.json({ success: true, data: item });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const ALLOWED_FIELDS = [
    "type",
    "title",
    "description",
    "media_url",
    "thumbnail_url",
    "category",
    "display_order",
    "is_active",
];

// Shared validation used by create + update. Returns a message string or null.
const validatePayload = (body, { partial } = {}) => {
    if (!partial || body.title !== undefined) {
        if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
            return "Title is required";
        }
    }

    if (!partial || body.type !== undefined) {
        if (!["photo", "video"].includes(body.type)) {
            return "Type must be either 'photo' or 'video'";
        }
    }

    if (body.media_url !== undefined) {
        if (!isFileReference(body.media_url)) {
            return "Media must be an uploaded file reference (e.g. /uploads/gallery/...). External URLs are not allowed.";
        }
        const isVideo = body.type === "video" || (!partial && body.type === "video");
        if (isVideo && !/^\/uploads\/gallery-video\//.test(body.media_url)) {
            return "Video media must reference an uploaded file under /uploads/gallery-video/";
        }
        if (!isVideo && body.media_url && !/^\/uploads\/gallery\//.test(body.media_url)) {
            return "Photo media must reference an uploaded file under /uploads/gallery/";
        }
    }

    if (body.thumbnail_url !== undefined && !isFileReference(body.thumbnail_url)) {
        return "Thumbnail must be an uploaded file reference. External URLs are not allowed.";
    }

    if (body.display_order !== undefined && !Number.isFinite(Number(body.display_order))) {
        return "Display order must be a number";
    }

    return null;
};

const buildPayload = (body) => {
    const payload = {};
    ALLOWED_FIELDS.forEach((field) => {
        if (body[field] !== undefined) payload[field] = body[field];
    });
    // Normalize numeric/boolean inputs
    if (payload.display_order !== undefined) {
        payload.display_order = Number(payload.display_order);
    }
    if (payload.is_active !== undefined) {
        payload.is_active = Boolean(payload.is_active);
    }
    return payload;
};

// @desc Create a gallery item (admin only)
// @route POST /api/gallery
const createGalleryItem = async (req, res) => {
    try {
        const validationMessage = validatePayload(req.body);
        if (validationMessage) {
            return res.status(400).json({ success: false, message: validationMessage });
        }

        const payload = buildPayload(req.body);
        if (payload.is_active === undefined) payload.is_active = true;
        if (payload.display_order === undefined) payload.display_order = 0;

        const item = await GalleryItem.create(payload);
        return res.status(201).json({ success: true, data: item });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// @desc Update a gallery item (admin only). Media files are uploaded through
//       the dedicated /api/upload endpoint before this update runs, so the old
//       stored files are only removed after the database write succeeds.
// @route PUT /api/gallery/:id
const updateGalleryItem = async (req, res) => {
    try {
        const existing = await GalleryItem.findById(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, message: "Gallery item not found" });
        }

        const effectiveType = req.body.type !== undefined ? req.body.type : existing.type;

        const validationMessage = validatePayload(
            { ...req.body, type: effectiveType },
            { partial: true }
        );
        if (validationMessage) {
            return res.status(400).json({ success: false, message: validationMessage });
        }

        const payload = buildPayload(req.body);

        const updated = await GalleryItem.findByIdAndUpdate(
            req.params.id,
            payload,
            { new: true, runValidators: true }
        );

        // Cleanup: remove replaced files that are no longer referenced.
        const oldMedia = existing.media_url;
        const oldThumb = existing.thumbnail_url;
        if (oldMedia && payload.media_url !== undefined && payload.media_url !== oldMedia) {
            deleteUploadedFile(oldMedia);
        }
        if (oldThumb && payload.thumbnail_url !== undefined && payload.thumbnail_url !== oldThumb) {
            deleteUploadedFile(oldThumb);
        }

        return res.json({ success: true, data: updated });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// @desc Delete a gallery item (admin only). Also removes the stored media and
//       thumbnail files from disk.
// @route DELETE /api/gallery/:id
const deleteGalleryItem = async (req, res) => {
    try {
        const item = await GalleryItem.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, message: "Gallery item not found" });
        }

        await GalleryItem.findByIdAndDelete(req.params.id);

        if (item.media_url) deleteUploadedFile(item.media_url);
        if (item.thumbnail_url) deleteUploadedFile(item.thumbnail_url);

        return res.json({ success: true, message: "Gallery item deleted successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getActiveGallery,
    getAllGalleryItems,
    getGalleryItemById,
    createGalleryItem,
    updateGalleryItem,
    deleteGalleryItem,
};
