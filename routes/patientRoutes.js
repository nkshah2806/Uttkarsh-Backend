const express = require("express");
const router = express.Router();
const { protect, approvedMemberOnly } = require("../middleware/authMiddleware");
const {
  getPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
} = require("../controllers/patientController");

router.use(protect);
// Franchise members must complete their profile and be approved by an admin
// before they can manage patients (admins bypass this check).
router.use(approvedMemberOnly);

router.route("/").get(getPatients).post(createPatient);
router.route("/:id").get(getPatientById).put(updatePatient).delete(deletePatient);

module.exports = router;
