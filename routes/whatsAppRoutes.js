const express = require("express");
const { getWhatsAppStatus, sendTestWhatsAppMessage } = require("../controllers/whatsAppController");
const { verifyWebhook, handleWebhookEvent } = require("../controllers/whatsAppWebhookController");

const router = express.Router();

// ── Existing routes (unchanged) ──────────────────────────────────────────────
router.get("/status", getWhatsAppStatus);
router.post("/test", sendTestWhatsAppMessage);

// ── Meta Webhook routes ───────────────────────────────────────────────────────
// GET  /api/whatsapp/webhook  — Meta one-time hub verification
// POST /api/whatsapp/webhook  — Delivery status & inbound message events
router.get("/webhook", verifyWebhook);
router.post("/webhook", handleWebhookEvent);

module.exports = router;
