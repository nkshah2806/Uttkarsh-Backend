const express = require("express");
const {
    translateHandler,
    translationStatus,
} = require("../controllers/translationController");

const router = express.Router();

// Public (no auth) so the public website — which has no login — can translate
// dynamic content. Only opaque strings are accepted; no DB/business data is
// exposed. Rate/size limits are enforced inside the controller.
router.get("/status", translationStatus);
router.post("/", translateHandler);

module.exports = router;
