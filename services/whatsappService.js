/**
 * whatsappService.js
 *
 * Sends WhatsApp messages via the Meta WhatsApp Business Cloud API (v19.0).
 *
 * Configuration (all via environment variables — never hard-code secrets):
 *
 *   WHATSAPP_ACCESS_TOKEN       — Meta permanent / system-user access token
 *   WHATSAPP_PHONE_NUMBER_ID    — Phone Number ID from Meta App > WhatsApp > API Setup
 *   WHATSAPP_BUSINESS_ACCOUNT_ID— Meta Business Account ID (used for logging only)
 *   WHATSAPP_TEMPLATE_NAME      — Approved template name (default: welcome_member)
 *   WHATSAPP_TEMPLATE_LANG      — Template language code (default: en)
 *   WHATSAPP_ENABLED            — Kill-switch: "false" disables all sends (default: true)
 *
 * IMPORTANT — Template approval:
 *   Meta requires business-initiated messages to use a pre-approved template.
 *   Submit your template in the Meta Business Manager before expecting delivery.
 *   Unapproved templates will cause API errors that are caught and logged here;
 *   registration itself is never affected.
 *
 * Usage:
 *   const whatsappService = require("../services/whatsappService");
 *   await whatsappService.sendWelcomeMessage({ memberName, mobileNumber });
 */

"use strict";

const https = require("https");

// ---------------------------------------------------------------------------
// Configuration helpers
// ---------------------------------------------------------------------------

const CONFIG = {
  get accessToken() {
    return process.env.WHATSAPP_ACCESS_TOKEN || "";
  },
  get phoneNumberId() {
    return process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  },
  get businessAccountId() {
    return process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "";
  },
  get templateName() {
    return process.env.WHATSAPP_TEMPLATE_NAME || "welcome_member";
  },
  get templateLang() {
    return process.env.WHATSAPP_TEMPLATE_LANG || "en";
  },
  get enabled() {
    const val = (process.env.WHATSAPP_ENABLED || "true").toLowerCase().trim();
    return val !== "false" && val !== "0" && val !== "no";
  },
};

// ---------------------------------------------------------------------------
// Phone number normalisation
// ---------------------------------------------------------------------------

/**
 * Normalises a raw phone number string to E.164 format for India (+91XXXXXXXXXX).
 *
 * Handles:
 *   "9876543210"     → "+919876543210"
 *   "09876543210"    → "+919876543210"  (leading 0 stripped)
 *   "+919876543210"  → "+919876543210"  (already correct)
 *   "919876543210"   → "+919876543210"  (country code without +)
 *   Anything < 7 digits or > 13 digits → null (invalid)
 *
 * @param {string} rawPhone
 * @returns {string|null}  E.164 string or null when invalid.
 */
const formatPhoneNumber = (rawPhone) => {
  if (!rawPhone) return null;

  // Strip everything except digits
  const digits = String(rawPhone).replace(/\D/g, "");

  if (digits.length < 7) return null; // Too short to be a real number

  // Already includes country code 91 (India) → 12 digits total
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  // 10-digit local number (Indian)
  if (digits.length === 10) {
    return `+91${digits}`;
  }

  // 11-digit: leading 0 before 10-digit Indian number
  if (digits.length === 11 && digits.startsWith("0")) {
    return `+91${digits.slice(1)}`;
  }

  // Already has + prefix stored as digits starting with 91 and > 12 chars
  // or international numbers — pass through with + prefix if plausible length
  if (digits.length >= 7 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null; // Unrecognisable format
};

// ---------------------------------------------------------------------------
// Meta API request builder
// ---------------------------------------------------------------------------

/**
 * Builds the WhatsApp Cloud API request payload for the welcome template.
 *
 * Template: welcome_member
 * Expected parameters (positional, matching your approved template body):
 *   {{1}} = memberName
 *   {{2}} = mobileNumber (display-friendly, not E.164)
 *
 * Adjust the `components` array to match your actual approved template structure.
 *
 * @param {string} toPhone     E.164 formatted recipient phone
 * @param {string} memberName  Full name of the new member
 * @param {string} mobileNumber  Display mobile number shown in the message body
 * @returns {object}  API request body
 */
const buildWelcomeTemplatePayload = (toPhone, memberName, mobileNumber) => {
  return {
    messaging_product: "whatsapp",
    to: toPhone,
    type: "template",
    template: {
      name: CONFIG.templateName,
      language: {
        code: CONFIG.templateLang,
      },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: memberName },
            { type: "text", text: mobileNumber },
          ],
        },
      ],
    },
  };
};

// ---------------------------------------------------------------------------
// HTTPS helper (no axios dependency — uses Node built-in)
// ---------------------------------------------------------------------------

/**
 * Makes a POST request to the Meta Graph API.
 *
 * @param {string} path      API path (without host)
 * @param {object} payload   JSON body
 * @param {string} token     Bearer access token
 * @returns {Promise<{statusCode: number, body: object}>}
 */
const graphApiPost = (path, payload, token) => {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const options = {
      hostname: "graph.facebook.com",
      port: 443,
      path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        Authorization: `Bearer ${token}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ statusCode: res.statusCode, body: { raw: data } });
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy(new Error("WhatsApp API request timed out"));
    });

    req.write(body);
    req.end();
  });
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sends a WhatsApp welcome message to a newly registered member.
 *
 * This function is designed to be called fire-and-forget:
 *   sendWelcomeMessage(...).catch(() => {});
 *
 * It never throws. All errors are caught and logged server-side.
 *
 * @param {object} options
 * @param {string} options.memberName    Full name of the new member
 * @param {string} options.mobileNumber  Raw phone number from the registration form
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
const sendWelcomeMessage = async ({ memberName, mobileNumber }) => {
  // ---- Kill-switch check ------------------------------------------------
  if (!CONFIG.enabled) {
    console.log("[WhatsApp] Service disabled via WHATSAPP_ENABLED env var. Skipping.");
    return { success: false, error: "SERVICE_DISABLED" };
  }

  // ---- Credential check -------------------------------------------------
  if (!CONFIG.accessToken || !CONFIG.phoneNumberId) {
    console.warn(
      "[WhatsApp] Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID. " +
      "Set these environment variables to enable WhatsApp delivery."
    );
    return { success: false, error: "MISSING_CREDENTIALS" };
  }

  // ---- Phone validation -------------------------------------------------
  const formattedPhone = formatPhoneNumber(mobileNumber);
  if (!formattedPhone) {
    console.warn(`[WhatsApp] Invalid or missing phone number — skipping welcome message.`);
    return { success: false, error: "INVALID_PHONE" };
  }

  // ---- Build & send -----------------------------------------------------
  const payload = buildWelcomeTemplatePayload(formattedPhone, memberName || "Member", mobileNumber);
  const apiPath = `/v19.0/${CONFIG.phoneNumberId}/messages`;

  try {
    console.log(`[WhatsApp] Sending welcome message to recipient (***${formattedPhone.slice(-4)}) via template "${CONFIG.templateName}"`);

    const { statusCode, body } = await graphApiPost(apiPath, payload, CONFIG.accessToken);

    if (statusCode >= 200 && statusCode < 300 && body?.messages?.length > 0) {
      const messageId = body.messages[0]?.id || "";
      console.log(`[WhatsApp] ✅ Welcome message sent successfully. messageId=${messageId}`);
      return { success: true, messageId };
    }

    // API returned a non-2xx status or unexpected body
    const errCode = body?.error?.code;
    const errMsg = body?.error?.message || JSON.stringify(body);
    console.error(`[WhatsApp] ❌ API error (HTTP ${statusCode}): code=${errCode} — ${errMsg}`);

    // Provide actionable guidance for common error codes
    if (errCode === 131030) {
      console.error("[WhatsApp] → Phone number not in allowed list. Add test numbers in Meta App Dashboard or use a verified number.");
    } else if (errCode === 132001) {
      console.error(`[WhatsApp] → Template "${CONFIG.templateName}" not found or not approved. Submit it for review in Meta Business Manager.`);
    } else if (errCode === 190) {
      console.error("[WhatsApp] → Access token is invalid or expired. Refresh WHATSAPP_ACCESS_TOKEN.");
    }

    return { success: false, error: errMsg };
  } catch (err) {
    // Network errors, timeouts, etc.
    console.error(`[WhatsApp] ❌ Network/unexpected error: ${err.message}`);
    return { success: false, error: err.message };
  }
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  sendWelcomeMessage,
  formatPhoneNumber, // exported for unit testing
};
