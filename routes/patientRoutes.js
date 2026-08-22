const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getPatients,
  createPatient,
  updatePatient,
  deletePatient,
} = require("../controllers/patientController");

router.use(protect);

router.route("/").get(getPatients).post(createPatient);
router.route("/:id").put(updatePatient).delete(deletePatient);

module.exports = router;
