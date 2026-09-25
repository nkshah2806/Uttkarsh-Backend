/**
 * WhatsApp Cloud API — Webhook Handler
 *
 * Handles two Meta webhook endpoints:
 *
 *   GET  /api/whatsapp/webhook  — Meta's one-time hub verification challenge
 *   POST /api/whatsapp/webhook  — Incoming delivery-status & message events
 *
 * ─── DELIVERY STATUS LOG FORMAT ───────────────────────────────────────────────
 *   [WhatsApp Delivery Status]
 *   Message ID : wamid.xxx
 *   Recipient  : 919XXXXXXXXX
 *   Status     : delivered   ← sent | delivered | read | failed
 *   Timestamp  : 2024-01-01T12:00:00.000Z
 *
 *   When failed:
 *   [WhatsApp Delivery FAILED]
 *   Message ID    : wamid.xxx
 *   Recipient     : 919XXXXXXXXX
 *   Error Code    : 131026
 *   Error Title   : Message Undeliverable
 *   Error Message : ...
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * SECURITY NOTES:
 *   - The WhatsApp access token is NEVER logged here.
 *   - Webhook payload signature verification is supported via X-Hub-Signature-256.
 *   - The verify token is read from WHATSAPP_WEBHOOK_VERIFY_TOKEN env var only.
 */

const crypto = require("crypto");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts a Unix epoch (seconds) to a human-readable ISO timestamp.
 * Falls back gracefully if the value is missing or unparseable.
 *
 * @param {string|number|undefined} epoch
 * @returns {string}
 */
function epochToISO(epoch) {
  if (!epoch) return "N/A";
  const ms = Number(epoch) * 1000;
  if (Number.isNaN(ms)) return String(epoch);
  return new Date(ms).toISOString();
}

/**
 * Verifies the X-Hub-Signature-256 header that Meta attaches to every POST.
 * Returns true when the app secret is not configured (skip verification),
 * or when the HMAC matches.
 *
 * @param {Buffer|string} rawBody  Raw request body bytes
 * @param {string|undefined} signature  Value of X-Hub-Signature-256 header
 * @returns {boolean}
 */
function verifySignature(rawBody, signature) {
  const appSecret = (process.env.WHATSAPP_APP_SECRET || "").trim();

  // If no app secret configured, skip HMAC verification
  if (!appSecret) return true;

  if (!signature || !signature.startsWith("sha256=")) return false;

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(signature, "utf8")
    );
  } catch {
    return false;
  }
}

// ─── Status logger ────────────────────────────────────────────────────────────

/**
 * Logs a WhatsApp delivery-status object to the console in a clean, readable format.
 *
 * @param {Object} status    A single status object from the Meta webhook payload
 * @param {string} recipient The recipient wa_id from the same webhook contact entry
 */
function logDeliveryStatus(status, recipient) {
  const msgId     = status.id      || "N/A";
  const statusVal = (status.status || "unknown").toLowerCase();
  const timestamp = epochToISO(status.timestamp);
  const errors    = status.errors  || [];

  const divider = "─".repeat(62);

  if (statusVal === "failed" || errors.length > 0) {
    // ── FAILED ────────────────────────────────────────────────────────────────
    console.error("\n" + divider);
    console.error("🔴 [WhatsApp Delivery FAILED]");
    console.error(divider);
    console.error(`  Message ID  : ${msgId}`);
    console.error(`  Recipient   : ${recipient || "N/A"}`);
    console.error(`  Status      : ${statusVal}`);
    console.error(`  Timestamp   : ${timestamp}`);

    if (errors.length > 0) {
      errors.forEach((err, i) => {
        const prefix = errors.length > 1 ? `  Error[${i + 1}]` : "  Error";
        console.error(`${prefix} Code    : ${err.code    ?? "N/A"}`);
        console.error(`${prefix} Title   : ${err.title   ?? "N/A"}`);
        console.error(
          `${prefix} Message : ${err.message ?? err.details ?? "N/A"}`
        );
        if (err.error_data && err.error_data.details) {
          console.error(`${prefix} Details : ${err.error_data.details}`);
        }
      });
    } else {
      console.error("  Error Code    : N/A");
      console.error("  Error Title   : N/A");
      console.error("  Error Message : N/A");
    }
    console.error(divider + "\n");
  } else {
    // ── DELIVERED / SENT / READ ───────────────────────────────────────────────
    const icon =
      statusVal === "read"      ? "👁️ " :
      statusVal === "delivered" ? "✅" :
      statusVal === "sent"      ? "📤" :
      "📋";

    console.log("\n" + divider);
    console.log(`${icon} [WhatsApp Delivery Status]`);
    console.log(divider);
    console.log(`  Message ID : ${msgId}`);
    console.log(`  Recipient  : ${recipient || "N/A"}`);
    console.log(`  Status     : ${statusVal}`);
    console.log(`  Timestamp  : ${timestamp}`);
    console.log(divider + "\n");
  }
}

// ─── GET: Meta hub.verify challenge ──────────────────────────────────────────

/**
 * @desc  Meta Webhook Verification (GET)
 * @route GET /api/whatsapp/webhook
 *
 * Meta sends three query params during webhook subscription:
 *   hub.mode          → must equal "subscribe"
 *   hub.verify_token  → must match WHATSAPP_WEBHOOK_VERIFY_TOKEN in .env
 *   hub.challenge     → echo this back to complete verification
 */
exports.verifyWebhook = (req, res) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const verifyToken = (process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "").trim();

  console.log(
    "\n══════════════════════════════════════════════════════════════"
  );
  console.log("📡 [WhatsApp Webhook] GET verification request received");
  console.log(`  hub.mode   : ${mode}`);
  console.log(
    `  Token OK   : ${
      verifyToken
        ? token === verifyToken
          ? "✅ MATCH"
          : "❌ MISMATCH"
        : "⚠️  WHATSAPP_WEBHOOK_VERIFY_TOKEN not set"
    }`
  );
  console.log(
    "══════════════════════════════════════════════════════════════\n"
  );

  if (!verifyToken) {
    console.error(
      "[WhatsApp Webhook] ❌ WHATSAPP_WEBHOOK_VERIFY_TOKEN is not set in .env. " +
        "Set it to any secret string, then add the same string in " +
        "Meta Developer Console → Webhooks → Verify Token."
    );
    return res.status(500).send("Server webhook verify token not configured");
  }

  if (mode === "subscribe" && token === verifyToken) {
    console.log(
      "[WhatsApp Webhook] ✅ Webhook verified successfully by Meta."
    );
    return res.status(200).send(challenge);
  }

  console.warn(
    "[WhatsApp Webhook] ⚠️  Verification FAILED — " +
      (mode !== "subscribe"
        ? `hub.mode is "${mode}", expected "subscribe".`
        : "hub.verify_token does not match WHATSAPP_WEBHOOK_VERIFY_TOKEN in .env.")
  );
  return res.status(403).send("Forbidden");
};

// ─── POST: Incoming webhook events ───────────────────────────────────────────

/**
 * @desc  Meta Webhook Event Handler (POST)
 * @route POST /api/whatsapp/webhook
 *
 * Meta posts webhook events here. This handler:
 *   1. Optionally verifies the X-Hub-Signature-256 HMAC signature.
 *   2. Iterates every statuses[] entry and logs it with logDeliveryStatus().
 *   3. Always responds 200 OK quickly so Meta does not retry.
 *
 * Payload shape (simplified):
 * {
 *   object: "whatsapp_business_account",
 *   entry: [{
 *     changes: [{
 *       value: {
 *         statuses: [{ id, status, timestamp, recipient_id, errors? }],
 *         messages: [{ ... }]   // inbound messages (logged briefly)
 *       }
 *     }]
 *   }]
 * }
 */
exports.handleWebhookEvent = (req, res) => {
  // ── Respond 200 IMMEDIATELY so Meta never retries due to timeout ──────────
  res.sendStatus(200);

  // ── Signature verification (optional but recommended) ─────────────────────
  const signature = req.headers["x-hub-signature-256"];
  const rawBody   = req.rawBody || JSON.stringify(req.body);

  if (!verifySignature(rawBody, signature)) {
    console.warn(
      "[WhatsApp Webhook] ⚠️  X-Hub-Signature-256 mismatch — payload ignored. " +
        "Check WHATSAPP_APP_SECRET in .env or leave it unset to skip HMAC check."
    );
    return;
  }

  const body = req.body;

  // ── Sanity check ─────────────────────────────────────────────────────────
  if (!body || body.object !== "whatsapp_business_account") {
    console.warn(
      "[WhatsApp Webhook] ⚠️  Unexpected webhook object type:",
      body ? body.object : "(empty body)"
    );
    return;
  }

  const entries = Array.isArray(body.entry) ? body.entry : [];
  let statusEventCount  = 0;
  let messageEventCount = 0;

  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];

    for (const change of changes) {
      if (change.field !== "messages") continue;

      const value    = change.value  || {};
      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      const messages = Array.isArray(value.messages) ? value.messages : [];

      // ── Delivery status updates ───────────────────────────────────────────
      for (const status of statuses) {
        const recipient = status.recipient_id || "N/A";
        logDeliveryStatus(status, recipient);
        statusEventCount++;
      }

      // ── Inbound messages (log briefly — not focus of this feature) ────────
      for (const msg of messages) {
        messageEventCount++;
        console.log(
          `[WhatsApp Webhook] 📩 Inbound message received` +
            ` | from: ${msg.from || "N/A"}` +
            ` | type: ${msg.type || "N/A"}` +
            ` | id: ${msg.id || "N/A"}`
        );
      }
    }
  }

  if (statusEventCount === 0 && messageEventCount === 0) {
    console.log(
      "[WhatsApp Webhook] ℹ️  POST received but contained no statuses or messages " +
        "(may be a subscription confirmation or unsupported event type)."
    );
  }
};
