const express = require("express");
const { getSiteSettings, updateSiteSettings } = require("../controllers/siteSettingsController");

const router = express.Router();

router.get("/", getSiteSettings);
router.post("/", updateSiteSettings);
router.put("/", updateSiteSettings);

module.exports = router;
