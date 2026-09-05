const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");
const {
    getHealthCamps,
    getHealthCampById,
    createHealthCamp,
    updateHealthCamp,
    deleteHealthCamp,
    registerForHealthCamp,
} = require("../controllers/healthCampController");

// Public website reads + registrations must stay OPEN (no token available on the
// public site), so protect/adminOnly is applied per-route instead of globally.
router.route("/").get(getHealthCamps).post(protect, adminOnly, createHealthCamp);

router.route("/:id").get(getHealthCampById);

router.put("/:id", protect, adminOnly, updateHealthCamp);
router.delete("/:id", protect, adminOnly, deleteHealthCamp);
router.post("/:id/register", registerForHealthCamp);

module.exports = router;
