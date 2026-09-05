const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");
const {
    getScanPricings,
    getScanPricingById,
    getActiveScanPricings,
    createScanPricing,
    updateScanPricing,
    deleteScanPricing,
} = require("../controllers/scanPricingController");

// Members need a valid token to read the active pricing list when starting a
// new scan; only admins may manage (create/update/delete) the pricing config.
router.use(protect);

router.route("/").get(getScanPricings).post(adminOnly, createScanPricing);

// IMPORTANT: /active must be declared before /:id so it is not swallowed by the
// param route.
router.get("/active", getActiveScanPricings);

router
    .route("/:id")
    .get(getScanPricingById)
    .put(adminOnly, updateScanPricing)
    .delete(adminOnly, deleteScanPricing);

module.exports = router;
