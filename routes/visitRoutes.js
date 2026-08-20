const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  createVisit,
  getVisitById,
  saveVisitResults,
  importCSVResults,
  getAutoReport,
  updateSelectedContent,
  generatePDF,
  shareWhatsApp,
} = require("../controllers/visitController");

router.use(protect);

router.post("/", createVisit);
router.get("/:id", getVisitById);
router.post("/:id/results", saveVisitResults);
router.post("/:id/results/import", importCSVResults);
router.get("/:id/auto-report", getAutoReport);
router.patch("/:id/selected-content", updateSelectedContent);
router.post("/:id/generate-pdf", generatePDF);
router.post("/reports/:id/share/whatsapp", shareWhatsApp);

module.exports = router;
