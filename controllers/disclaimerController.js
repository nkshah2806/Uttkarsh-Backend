const Disclaimer = require("../models/Disclaimer");

// @desc Get all disclaimers
// @route GET /api/v1/disclaimers
// @access Public / Private
exports.getDisclaimers = async (req, res) => {
  try {
    const { search, is_active } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
        { content_hi: { $regex: search, $options: "i" } },
      ];
    }

    if (is_active !== undefined) {
      filter.is_active = is_active === "true" || is_active === true;
    }

    const disclaimers = await Disclaimer.find(filter)
      .populate("created_by", "fullName email username role")
      .populate("updated_by", "fullName email username role")
      .sort({ is_active: -1, updatedAt: -1, createdAt: -1 });

    return res.json({
      success: true,
      count: disclaimers.length,
      data: disclaimers,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get active disclaimer
// @route GET /api/v1/disclaimers/active
// @access Public
exports.getActiveDisclaimer = async (req, res) => {
  try {
    const activeDisclaimer = await Disclaimer.findOne({ is_active: true })
      .populate("created_by", "fullName email username role")
      .populate("updated_by", "fullName email username role");

    if (!activeDisclaimer) {
      return res.json({
        success: true,
        data: null,
        message: "No active disclaimer configured",
      });
    }

    return res.json({
      success: true,
      data: activeDisclaimer,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get single disclaimer by ID
// @route GET /api/v1/disclaimers/:id
// @access Private
exports.getDisclaimerById = async (req, res) => {
  try {
    const disclaimer = await Disclaimer.findById(req.params.id)
      .populate("created_by", "fullName email username role")
      .populate("updated_by", "fullName email username role");

    if (!disclaimer) {
      return res.status(404).json({ success: false, message: "Disclaimer not found" });
    }

    return res.json({
      success: true,
      data: disclaimer,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Create new disclaimer
// @route POST /api/v1/disclaimers
// @access Admin
exports.createDisclaimer = async (req, res) => {
  try {
    const { title, content, content_hi, is_active } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: "Title and content are required",
      });
    }

    const shouldBeActive = Boolean(is_active);

    // If activating this disclaimer, deactivate all other disclaimers
    if (shouldBeActive) {
      await Disclaimer.updateMany({}, { is_active: false });
    }

    const disclaimer = await Disclaimer.create({
      title: title.trim(),
      content: content.trim(),
      content_hi: content_hi ? content_hi.trim() : "",
      is_active: shouldBeActive,
      created_by: req.user?._id || null,
      updated_by: req.user?._id || null,
    });

    return res.status(201).json({
      success: true,
      message: "Disclaimer created successfully",
      data: disclaimer,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc Update disclaimer
// @route PUT /api/v1/disclaimers/:id
// @access Admin
exports.updateDisclaimer = async (req, res) => {
  try {
    const { title, content, content_hi, is_active } = req.body;
    const disclaimer = await Disclaimer.findById(req.params.id);

    if (!disclaimer) {
      return res.status(404).json({ success: false, message: "Disclaimer not found" });
    }

    const shouldBeActive = is_active !== undefined ? Boolean(is_active) : disclaimer.is_active;

    // If setting active, deactivate all other disclaimers
    if (shouldBeActive && !disclaimer.is_active) {
      await Disclaimer.updateMany({ _id: { $ne: disclaimer._id } }, { is_active: false });
    }

    if (title) disclaimer.title = title.trim();
    if (content) disclaimer.content = content.trim();
    if (content_hi !== undefined) disclaimer.content_hi = content_hi.trim();
    disclaimer.is_active = shouldBeActive;
    disclaimer.updated_by = req.user?._id || disclaimer.updated_by;

    await disclaimer.save();

    return res.json({
      success: true,
      message: "Disclaimer updated successfully",
      data: disclaimer,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc Toggle disclaimer active status
// @route PATCH /api/v1/disclaimers/:id/toggle-status
// @access Admin
exports.toggleDisclaimerStatus = async (req, res) => {
  try {
    const disclaimer = await Disclaimer.findById(req.params.id);
    if (!disclaimer) {
      return res.status(404).json({ success: false, message: "Disclaimer not found" });
    }

    const newActiveState = !disclaimer.is_active;

    if (newActiveState) {
      // Activating this disclaimer: deactivate all others
      await Disclaimer.updateMany({ _id: { $ne: disclaimer._id } }, { is_active: false });
      disclaimer.is_active = true;
    } else {
      disclaimer.is_active = false;
    }

    disclaimer.updated_by = req.user?._id || disclaimer.updated_by;
    await disclaimer.save();

    return res.json({
      success: true,
      message: disclaimer.is_active
        ? "Disclaimer activated successfully"
        : "Disclaimer deactivated successfully",
      data: disclaimer,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc Delete disclaimer
// @route DELETE /api/v1/disclaimers/:id
// @access Admin
exports.deleteDisclaimer = async (req, res) => {
  try {
    const disclaimer = await Disclaimer.findById(req.params.id);
    if (!disclaimer) {
      return res.status(404).json({ success: false, message: "Disclaimer not found" });
    }

    await Disclaimer.findByIdAndDelete(req.params.id);

    return res.json({
      success: true,
      message: "Disclaimer deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
