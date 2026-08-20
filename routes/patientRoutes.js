const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { getPatients, createPatient } = require("../controllers/patientController");

router.use(protect);

router.route("/").get(getPatients).post(createPatient);

module.exports = router;
