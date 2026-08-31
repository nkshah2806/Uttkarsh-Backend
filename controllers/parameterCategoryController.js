const ParameterCategory = require("../models/ParameterCategory");
const Parameter = require("../models/Parameter");

// @desc    Get all quantum parameter categories
// @route   GET /api/v1/admin/parameter-categories
// @access  Private (admin + authenticated users)
const getCategories = async (req, res) => {
    try {
        const categories = await ParameterCategory.find({}).sort({ order: 1, createdAt: 1 });
        return res.json({ success: true, count: categories.length, data: categories });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch categories", error: error.message });
    }
};

// @desc    Get single quantum parameter category by ID
// @route   GET /api/v1/admin/parameter-categories/:id
// @access  Private (admin + authenticated users)
const getCategoryById = async (req, res) => {
    try {
        const category = await ParameterCategory.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }
        return res.json({ success: true, data: category });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch category", error: error.message });
    }
};

// @desc    Create new quantum parameter category
// @route   POST /api/v1/admin/parameter-categories
// @access  Admin only
const createCategory = async (req, res) => {
    try {
        const { name, slug, description, order } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: "Category name is required." });
        }

        const normalizedName = name.trim();
        const existing = await ParameterCategory.findOne({
            name: { $regex: `^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
        });
        if (existing) {
            return res.status(400).json({ success: false, message: "Category with this name already exists." });
        }

        const autoSlug = slug || normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        const category = await ParameterCategory.create({
            name: normalizedName,
            slug: autoSlug,
            description: description || "",
            order: order || 0,
            is_active: true,
        });

        return res.status(201).json({ success: true, data: category });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to create category", error: error.message });
    }
};

// @desc    Update quantum parameter category
// @route   PUT /api/v1/admin/parameter-categories/:id
// @access  Admin only
const updateCategory = async (req, res) => {
    try {
        const { name, slug, description, order, is_active } = req.body;

        if (name) {
            const normalizedName = name.trim();
            const existing = await ParameterCategory.findOne({
                _id: { $ne: req.params.id },
                name: { $regex: `^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
            });
            if (existing) {
                return res.status(400).json({ success: false, message: "Category with this name already exists." });
            }
        }

        const updated = await ParameterCategory.findByIdAndUpdate(
            req.params.id,
            {
                ...(name && { name: name.trim() }),
                ...(slug !== undefined && { slug: slug || "" }),
                ...(description !== undefined && { description: description || "" }),
                ...(order !== undefined && { order: order || 0 }),
                ...(typeof is_active === "boolean" && { is_active }),
            },
            { new: true, runValidators: true }
        );

        if (!updated) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }
        return res.json({ success: true, data: updated });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to update category", error: error.message });
    }
};

// @desc    Delete quantum parameter category
// @route   DELETE /api/v1/admin/parameter-categories/:id
// @access  Admin only
const deleteCategory = async (req, res) => {
    try {
        const category = await ParameterCategory.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }

        // Prevent deletion if parameters still reference this category
        const usedCount = await Parameter.countDocuments({ category: category.name });
        if (usedCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete category "${category.name}" because it is used by ${usedCount} parameter(s). Reassign or delete those parameters first.`,
            });
        }

        await ParameterCategory.findByIdAndDelete(req.params.id);
        return res.json({ success: true, message: "Category deleted successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to delete category", error: error.message });
    }
};

module.exports = {
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
};
