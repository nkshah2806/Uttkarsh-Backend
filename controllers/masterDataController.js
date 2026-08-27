const Parameter = require("../models/Parameter");
const ParameterMasterContent = require("../models/ParameterMasterContent");
const { parseContent, validateContent } = require("../services/contentParser");

// @desc    Get all parameters
// @route   GET /api/v1/admin/parameters
exports.getParameters = async (req, res) => {
  try {
    const { category, search, status } = req.query;
    let query = {};
    if (category && category !== "All") query.category = category;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: "i" } },
        { name_en: { $regex: search, $options: "i" } },
        { name_hi: { $regex: search, $options: "i" } },
      ];
    }

    const parameters = await Parameter.find(query).sort({ code: 1 });

    // Format parameters with node counts
    const formatted = parameters.map((p) => {
      const pObj = p.toObject();
      const nodesCount = (pObj.parsed_nodes_en?.length || 0) + (pObj.parsed_nodes_hi?.length || 0);
      const selectableCount = (pObj.parsed_nodes_en?.filter((n) => n.isSelectable)?.length || 0);
      return {
        ...pObj,
        total_nodes_count: nodesCount,
        selectable_nodes_count: selectableCount,
      };
    });

    return res.json({ success: true, count: formatted.length, data: formatted });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single parameter by ID
// @route   GET /api/v1/admin/parameters/:id
exports.getParameterById = async (req, res) => {
  try {
    const parameter = await Parameter.findById(req.params.id);
    if (!parameter) {
      return res.status(404).json({ success: false, message: "Parameter not found" });
    }
    return res.json({ success: true, data: parameter });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Parse raw text on the fly and return AST structure + validation
// @route   POST /api/v1/admin/parameters/parse-preview
exports.parsePreview = async (req, res) => {
  try {
    const { raw_content, language = "en" } = req.body;
    const diagnostics = validateContent(raw_content);
    return res.json({
      success: true,
      data: {
        ...diagnostics,
        language,
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Create new parameter with parsed content
// @route   POST /api/v1/admin/parameters
exports.createParameter = async (req, res) => {
  try {
    const {
      code,
      name_hi,
      name_en,
      unit,
      normal_min,
      normal_max,
      category,
      description,
      raw_content_en,
      raw_content_hi,
      status = "PUBLISHED",
    } = req.body;

    // If code not supplied, derive from English name
    const baseCode = (code || name_en.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, ""));

    // Ensure uniqueness — append numeric suffix when there's a collision
    let finalCode = baseCode.toUpperCase();
    let suffix = 2;
    while (await Parameter.findOne({ code: finalCode })) {
      finalCode = `${baseCode}_${suffix}`;
      suffix++;
    }

    // Auto-parse raw multi-line content into AST nodes
    const parsed_nodes_en = raw_content_en ? parseContent(raw_content_en, "en") : [];
    const parsed_nodes_hi = raw_content_hi ? parseContent(raw_content_hi, "hi") : [];

    const parameter = await Parameter.create({
      code: finalCode,
      name_hi,
      name_en,
      unit: unit || "",
      normal_min: Number(normal_min),
      normal_max: Number(normal_max),
      category: category || "General",
      description: description || "",
      raw_content_en: raw_content_en || "",
      raw_content_hi: raw_content_hi || "",
      parsed_nodes_en,
      parsed_nodes_hi,
      version: 1,
      version_history: [
        {
          version: 1,
          raw_content_en: raw_content_en || "",
          raw_content_hi: raw_content_hi || "",
          parsed_nodes_en,
          parsed_nodes_hi,
          updated_at: new Date(),
          updated_by: req.user?._id,
          change_summary: "Initial version created",
        },
      ],
      status,
      is_active: true,
    });

    return res.status(201).json({ success: true, data: parameter });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update parameter (with version increment / snapshotting)
// @route   PUT /api/v1/admin/parameters/:id
exports.updateParameter = async (req, res) => {
  try {
    const existing = await Parameter.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Parameter not found" });
    }

    const {
      code,
      name_hi,
      name_en,
      unit,
      normal_min,
      normal_max,
      category,
      description,
      raw_content_en,
      raw_content_hi,
      status,
      is_active,
    } = req.body;

    // Check if code is changing and already in use
    if (code && code.toUpperCase() !== existing.code) {
      const codeTaken = await Parameter.findOne({ code: code.toUpperCase(), _id: { $ne: existing._id } });
      if (codeTaken) {
        return res.status(400).json({ success: false, message: `Parameter code ${code.toUpperCase()} already in use` });
      }
      existing.code = code.toUpperCase();
    }

    if (name_hi !== undefined) existing.name_hi = name_hi;
    if (name_en !== undefined) existing.name_en = name_en;
    if (unit !== undefined) existing.unit = unit;
    if (normal_min !== undefined) existing.normal_min = Number(normal_min);
    if (normal_max !== undefined) existing.normal_max = Number(normal_max);
    if (category !== undefined) existing.category = category;
    if (description !== undefined) existing.description = description;
    if (status !== undefined) existing.status = status;
    if (is_active !== undefined) existing.is_active = is_active;

    // Check if content has changed
    const contentChanged =
      (raw_content_en !== undefined && raw_content_en !== existing.raw_content_en) ||
      (raw_content_hi !== undefined && raw_content_hi !== existing.raw_content_hi);

    if (contentChanged) {
      if (raw_content_en !== undefined) {
        existing.raw_content_en = raw_content_en;
        existing.parsed_nodes_en = parseContent(raw_content_en, "en");
      }
      if (raw_content_hi !== undefined) {
        existing.raw_content_hi = raw_content_hi;
        existing.parsed_nodes_hi = parseContent(raw_content_hi, "hi");
      }

      // If published, increment version and record in version history
      if (existing.status === "PUBLISHED") {
        existing.version = (existing.version || 1) + 1;
        existing.version_history.push({
          version: existing.version,
          raw_content_en: existing.raw_content_en,
          raw_content_hi: existing.raw_content_hi,
          parsed_nodes_en: existing.parsed_nodes_en,
          parsed_nodes_hi: existing.parsed_nodes_hi,
          updated_at: new Date(),
          updated_by: req.user?._id,
          change_summary: `Content updated to v${existing.version}`,
        });
      }
    }

    await existing.save();
    return res.json({ success: true, data: existing });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Duplicate an existing parameter
// @route   POST /api/v1/admin/parameters/:id/duplicate
exports.duplicateParameter = async (req, res) => {
  try {
    const source = await Parameter.findById(req.params.id);
    if (!source) {
      return res.status(404).json({ success: false, message: "Source parameter not found" });
    }

    // Generate unique code for clone
    let newCode = `${source.code}_COPY`;
    let counter = 1;
    while (await Parameter.findOne({ code: newCode })) {
      counter++;
      newCode = `${source.code}_COPY${counter}`;
    }

    const cloned = await Parameter.create({
      code: newCode,
      name_en: `${source.name_en} (Copy)`,
      name_hi: source.name_hi ? `${source.name_hi} (प्रति)` : "",
      unit: source.unit,
      normal_min: source.normal_min,
      normal_max: source.normal_max,
      category: source.category,
      description: source.description,
      raw_content_en: source.raw_content_en,
      raw_content_hi: source.raw_content_hi,
      parsed_nodes_en: source.parsed_nodes_en,
      parsed_nodes_hi: source.parsed_nodes_hi,
      version: 1,
      version_history: [
        {
          version: 1,
          raw_content_en: source.raw_content_en,
          raw_content_hi: source.raw_content_hi,
          parsed_nodes_en: source.parsed_nodes_en,
          parsed_nodes_hi: source.parsed_nodes_hi,
          updated_at: new Date(),
          updated_by: req.user?._id,
          change_summary: `Duplicated from ${source.code}`,
        },
      ],
      status: "DRAFT",
      is_active: true,
    });

    return res.status(201).json({ success: true, data: cloned });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get version history for a parameter
// @route   GET /api/v1/admin/parameters/:id/versions
exports.getParameterVersions = async (req, res) => {
  try {
    const parameter = await Parameter.findById(req.params.id).select("code name_en version version_history");
    if (!parameter) {
      return res.status(404).json({ success: false, message: "Parameter not found" });
    }
    return res.json({ success: true, data: parameter.version_history || [] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
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

// ----------------------------------------------------
// Legacy Content Item Support (Backward Compatibility)
// ----------------------------------------------------

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
