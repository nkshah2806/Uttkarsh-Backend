const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");
const {
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
} = require("../controllers/parameterCategoryController");

// All routes require a valid token; write operations require admin role
router.use(protect);

router
    .route("/")
    .get(getCategories)
    .post(adminOnly, createCategory);

router
    .route("/:id")
    .get(getCategoryById)
    .put(adminOnly, updateCategory)
    .delete(adminOnly, deleteCategory);

module.exports = router;
