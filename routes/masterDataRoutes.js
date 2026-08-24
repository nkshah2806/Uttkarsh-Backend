const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");
const {
  getParameters,
  getParameterById,
  createParameter,
  updateParameter,
  duplicateParameter,
  getParameterVersions,
  parsePreview,
  deleteParameter,
  getParameterContent,
  createParameterContent,
  updateParameterContent,
  deleteParameterContent,
} = require("../controllers/masterDataController");

router.use(protect);

// Utility route for parsing raw text and validation diagnostics
router.post("/parse-preview", parsePreview);

router
  .route("/")
  .get(getParameters)
  .post(adminOnly, createParameter);

router
  .route("/:id")
  .get(getParameterById)
  .put(adminOnly, updateParameter)
  .delete(adminOnly, deleteParameter);

router.post("/:id/duplicate", adminOnly, duplicateParameter);
router.get("/:id/versions", adminOnly, getParameterVersions);

// Legacy content bullet endpoints for backward compatibility
router
  .route("/:id/content")
  .get(getParameterContent)
  .post(adminOnly, createParameterContent);

router
  .route("/content/:contentId")
  .put(adminOnly, updateParameterContent)
  .delete(adminOnly, deleteParameterContent);

module.exports = router;
