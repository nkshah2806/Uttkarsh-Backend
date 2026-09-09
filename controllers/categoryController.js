const Category = require("../models/Category");
const { deleteUploadedFile } = require("./uploadController");

// Image must be an uploaded file reference (never an external URL).
const isFileReference = (value) => {
  if (!value || typeof value !== "string" || !value.trim()) return true; // optional
  return /^\/uploads\/[a-z0-9-_]+\/[^/]+$/.test(value.trim());
};

// GET /api/categories
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ order: 1, createdAt: -1 });
    return res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(500).json({ message: "Failed to fetch categories", error: error.message });
  }
};

// GET /api/categories/:id
const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    return res.json(category);
  } catch (error) {
    console.error("Error fetching category:", error);
    return res.status(500).json({ message: "Failed to fetch category", error: error.message });
  }
};

// POST /api/categories
const createCategory = async (req, res) => {
  try {
    const { name, slug, image, description, order } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ message: "Name and Slug are required." });
    }
    if (image !== undefined && !isFileReference(image)) {
      return res.status(400).json({ message: "Category image must be an uploaded file reference. External URLs are not allowed." });
    }
    const existing = await Category.findOne({ slug });
    if (existing) {
      return res.status(400).json({ message: "Category with this slug already exists." });
    }
    const category = await Category.create({ name, slug, image, description, order: order || 0 });
    return res.status(201).json(category);
  } catch (error) {
    console.error("Error creating category:", error);
    return res.status(500).json({ message: "Failed to create category", error: error.message });
  }
};

// PUT /api/categories/:id
const updateCategory = async (req, res) => {
  try {
    if (req.body.image !== undefined && !isFileReference(req.body.image)) {
      return res.status(400).json({ message: "Category image must be an uploaded file reference. External URLs are not allowed." });
    }
    const existing = await Category.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Category not found" });
    }
    const updated = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    // Remove the replaced image only after the DB write succeeds.
    if (existing.image && req.body.image !== undefined && req.body.image !== existing.image) {
      deleteUploadedFile(existing.image);
    }
    return res.json(updated);
  } catch (error) {
    console.error("Error updating category:", error);
    return res.status(500).json({ message: "Failed to update category", error: error.message });
  }
};

// DELETE /api/categories/:id
const deleteCategory = async (req, res) => {
  try {
    const existing = await Category.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Category not found" });
    }
    await Category.findByIdAndDelete(req.params.id);
    if (existing.image) deleteUploadedFile(existing.image);
    return res.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting category:", error);
    return res.status(500).json({ message: "Failed to delete category", error: error.message });
  }
};

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
