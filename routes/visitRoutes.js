const express = require("express");
const router = express.Router();
const { protect, approvedMemberOnly } = require("../middleware/authMiddleware");
const {
  createVisit,
  getVisitById,
  getDetailedReport,
  saveVisitResults,
  importCSVResults,
  getAutoReport,
  updateSelectedContent,
  generatePDF,
  shareWhatsApp,
} = require("../controllers/visitController");

router.use(protect);
// Franchise members must be approved before accessing visits/reports
// (admins bypass this check).
router.use(approvedMemberOnly);

router.post("/", createVisit);
router.get("/:id", getVisitById);
router.get("/:id/detailed-report", getDetailedReport);
router.post("/:id/results", saveVisitResults);
router.post("/:id/results/import", importCSVResults);
router.get("/:id/auto-report", getAutoReport);
router.patch("/:id/selected-content", updateSelectedContent);
router.post("/:id/generate-pdf", generatePDF);
router.post("/reports/:id/share/whatsapp", shareWhatsApp);

module.exports = router;
