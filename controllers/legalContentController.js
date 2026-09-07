const LegalContent = require("../models/LegalContent");
const { LEGAL_CONTENT_TYPES } = require("../models/LegalContent");

const VALID_TYPES = Object.values(LEGAL_CONTENT_TYPES);

// @desc Get all legal content
// @route GET /api/v1/legal-content
// @access Private
exports.getLegalContentList = async (req, res) => {
    try {
        const { search, is_active, type } = req.query;
        const filter = {};

        if (type && VALID_TYPES.includes(type)) {
            filter.type = type;
        }

        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: "i" } },
                { content: { $regex: search, $options: "i" } },
            ];
        }

        if (is_active !== undefined) {
            filter.is_active = is_active === "true" || is_active === true;
        }

        const legalContents = await LegalContent.find(filter)
            .populate("created_by", "fullName email username role")
            .populate("updated_by", "fullName email username role")
            .sort({ is_active: -1, updatedAt: -1, createdAt: -1 });

        return res.json({
            success: true,
            count: legalContents.length,
            data: legalContents,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get active legal content by type (privacy_policy | terms_conditions)
// @route GET /api/v1/legal-content/active?type=privacy_policy
// @access Public
exports.getActiveLegalContent = async (req, res) => {
    try {
        const { type } = req.query;

        if (!type || !VALID_TYPES.includes(type)) {
            return res.status(400).json({
                success: false,
                message: "A valid type is required (privacy_policy or terms_conditions)",
            });
        }

        const activeContent = await LegalContent.findOne({ type, is_active: true })
            .populate("created_by", "fullName email username role")
            .populate("updated_by", "fullName email username role");

        if (!activeContent) {
            return res.json({
                success: true,
                data: null,
                message: `No active ${type} configured`,
            });
        }

        return res.json({
            success: true,
            data: activeContent,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get single legal content by ID
// @route GET /api/v1/legal-content/:id
// @access Private
exports.getLegalContentById = async (req, res) => {
    try {
        const legalContent = await LegalContent.findById(req.params.id)
            .populate("created_by", "fullName email username role")
            .populate("updated_by", "fullName email username role");

        if (!legalContent) {
            return res.status(404).json({ success: false, message: "Legal content not found" });
        }

        return res.json({
            success: true,
            data: legalContent,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Create new legal content
// @route POST /api/v1/legal-content
// @access Admin
exports.createLegalContent = async (req, res) => {
    try {
        const { type, title, content, is_active } = req.body;

        if (!type || !VALID_TYPES.includes(type)) {
            return res.status(400).json({
                success: false,
                message: "A valid type is required (privacy_policy or terms_conditions)",
            });
        }

        if (!title || !content) {
            return res.status(400).json({
                success: false,
                message: "Title and content are required",
            });
        }

        const shouldBeActive = Boolean(is_active);

        // If activating this content, deactivate all other content of the SAME type
        if (shouldBeActive) {
            await LegalContent.updateMany({ type }, { is_active: false });
        }

        const legalContent = await LegalContent.create({
            type,
            title: title.trim(),
            content: content.trim(),
            is_active: shouldBeActive,
            created_by: req.user?._id || null,
            updated_by: req.user?._id || null,
        });

        return res.status(201).json({
            success: true,
            message: "Legal content created successfully",
            data: legalContent,
        });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// @desc Update legal content
// @route PUT /api/v1/legal-content/:id
// @access Admin
exports.updateLegalContent = async (req, res) => {
    try {
        const { type, title, content, is_active } = req.body;
        const legalContent = await LegalContent.findById(req.params.id);

        if (!legalContent) {
            return res.status(404).json({ success: false, message: "Legal content not found" });
        }

        if (type && !VALID_TYPES.includes(type)) {
            return res.status(400).json({
                success: false,
                message: "A valid type is required (privacy_policy or terms_conditions)",
            });
        }

        const finalType = type && VALID_TYPES.includes(type) ? type : legalContent.type;
        const shouldBeActive = is_active !== undefined ? Boolean(is_active) : legalContent.is_active;

        // If this document is (or will be) active, deactivate all other content of the SAME type.
        // Running unconditionally on activation keeps the invariant safe even when the type is
        // changed on an already-active document.
        if (shouldBeActive) {
            await LegalContent.updateMany(
                { type: finalType, _id: { $ne: legalContent._id } },
                { is_active: false }
            );
        }

        if (title) legalContent.title = title.trim();
        if (content) legalContent.content = content.trim();
        if (type && VALID_TYPES.includes(type)) legalContent.type = finalType;
        legalContent.is_active = shouldBeActive;
        legalContent.updated_by = req.user?._id || legalContent.updated_by;

        await legalContent.save();

        return res.json({
            success: true,
            message: "Legal content updated successfully",
            data: legalContent,
        });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// @desc Toggle legal content active status
// @route PATCH /api/v1/legal-content/:id/toggle-status
// @access Admin
exports.toggleLegalContentStatus = async (req, res) => {
    try {
        const legalContent = await LegalContent.findById(req.params.id);
        if (!legalContent) {
            return res.status(404).json({ success: false, message: "Legal content not found" });
        }

        const newActiveState = !legalContent.is_active;

        if (newActiveState) {
            // Activating this content: deactivate all others of the SAME type
            await LegalContent.updateMany(
                { type: legalContent.type, _id: { $ne: legalContent._id } },
                { is_active: false }
            );
            legalContent.is_active = true;
        } else {
            legalContent.is_active = false;
        }

        legalContent.updated_by = req.user?._id || legalContent.updated_by;
        await legalContent.save();

        return res.json({
            success: true,
            message: legalContent.is_active
                ? "Legal content activated successfully"
                : "Legal content deactivated successfully",
            data: legalContent,
        });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// @desc Delete legal content
// @route DELETE /api/v1/legal-content/:id
// @access Admin
exports.deleteLegalContent = async (req, res) => {
    try {
        const legalContent = await LegalContent.findById(req.params.id);
        if (!legalContent) {
            return res.status(404).json({ success: false, message: "Legal content not found" });
        }

        await LegalContent.findByIdAndDelete(req.params.id);

        return res.json({
            success: true,
            message: "Legal content deleted successfully",
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
