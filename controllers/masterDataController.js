const Parameter = require("../models/Parameter");
const ParameterMasterContent = require("../models/ParameterMasterContent");

// @desc    Get all parameters
// @route   GET /api/v1/admin/parameters
exports.getParameters = async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = {};
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: "i" } },
        { name_en: { $regex: search, $options: "i" } },
        { name_hi: { $regex: search, $options: "i" } },
      ];
    }

    const parameters = await Parameter.find(query).sort({ code: 1 });
    return res.json({ success: true, count: parameters.length, data: parameters });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new parameter
// @route   POST /api/v1/admin/parameters
exports.createParameter = async (req, res) => {
  try {
    const { code, name_hi, name_en, unit, normal_min, normal_max, category } = req.body;
    const existing = await Parameter.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: "Parameter code already exists" });
    }

    const parameter = await Parameter.create({
      code,
      name_hi,
      name_en,
      unit,
      normal_min,
      normal_max,
      category,
    });
    return res.status(201).json({ success: true, data: parameter });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update parameter
// @route   PUT /api/v1/admin/parameters/:id
exports.updateParameter = async (req, res) => {
  try {
    const parameter = await Parameter.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!parameter) {
      return res.status(404).json({ success: false, message: "Parameter not found" });
    }
    return res.json({ success: true, data: parameter });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete parameter
// @route   DELETE /api/v1/admin/parameters/:id
exports.deleteParameter = async (req, res) => {
  try {
    const parameter = await Parameter.findByIdAndDelete(req.params.id);
    if (!parameter) {
      return res.status(404).json({ success: false, message: "Parameter not found" });
    }
    await ParameterMasterContent.deleteMany({ parameter_id: req.params.id });
    return res.json({ success: true, message: "Parameter and associated content deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get master content for parameter
// @route   GET /api/v1/admin/parameters/:id/content
exports.getParameterContent = async (req, res) => {
  try {
    const { result_type, content_type } = req.query;
    let query = { parameter_id: req.params.id };
    if (result_type) query.result_type = result_type;
    if (content_type) query.content_type = content_type;

    const content = await ParameterMasterContent.find(query).sort({ priority: 1 });
    return res.json({ success: true, count: content.length, data: content });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add master content to parameter
// @route   POST /api/v1/admin/parameters/:id/content
exports.createParameterContent = async (req, res) => {
  try {
    const { result_type, content_type, text_hi, text_en, priority } = req.body;
    const content = await ParameterMasterContent.create({
      parameter_id: req.params.id,
      result_type,
      content_type,
      text_hi,
      text_en,
      priority: priority || 1,
    });
    return res.status(201).json({ success: true, data: content });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update master content
// @route   PUT /api/v1/admin/parameters/content/:contentId
exports.updateParameterContent = async (req, res) => {
  try {
    const content = await ParameterMasterContent.findByIdAndUpdate(
      req.params.contentId,
      req.body,
      { new: true, runValidators: true }
    );
    if (!content) {
      return res.status(404).json({ success: false, message: "Content item not found" });
    }
    return res.json({ success: true, data: content });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete master content
// @route   DELETE /api/v1/admin/parameters/content/:contentId
exports.deleteParameterContent = async (req, res) => {
  try {
    const content = await ParameterMasterContent.findByIdAndDelete(req.params.contentId);
    if (!content) {
      return res.status(404).json({ success: false, message: "Content item not found" });
    }
    return res.json({ success: true, message: "Content item deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
