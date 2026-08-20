const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");
const {
  getParameters,
  createParameter,
  updateParameter,
  deleteParameter,
  getParameterContent,
  createParameterContent,
  updateParameterContent,
  deleteParameterContent,
} = require("../controllers/masterDataController");

router.use(protect);

router
  .route("/")
  .get(getParameters)
  .post(adminOnly, createParameter);

router
  .route("/:id")
  .put(adminOnly, updateParameter)
  .delete(adminOnly, deleteParameter);

router
  .route("/:id/content")
  .get(getParameterContent)
  .post(adminOnly, createParameterContent);

router
  .route("/content/:contentId")
  .put(adminOnly, updateParameterContent)
  .delete(adminOnly, deleteParameterContent);

module.exports = router;
