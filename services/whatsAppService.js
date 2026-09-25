/**
 * WhatsApp Business Cloud API Service
 *
 * Integrates directly with Meta WhatsApp Cloud API (Graph API) to send automated
 * message templates upon member registration.
 *
 * Requirements / Environment Variables:
 * - WHATSAPP_PHONE_NUMBER_ID          : Phone number ID from Meta WhatsApp Cloud API dashboard
 * - WHATSAPP_ACCESS_TOKEN             : System User or Permanent Access Token from Meta Developer Portal
 * - WHATSAPP_API_VERSION              : Meta Graph API Version (defaults to "v25.0")
 *
 * Registration welcome template (used in production):
 * - WHATSAPP_WELCOME_TEMPLATE_NAME    : Approved Meta message template name (e.g. "registration_welcome")
 * - WHATSAPP_WELCOME_TEMPLATE_LANGUAGE: Template language code (defaults to "en_US")
 * - WHATSAPP_WELCOME_TEMPLATE_PARAM_COUNT : Exact number of body {{variables}} the template expects (e.g. 1)
 *
 * Zero-parameter test template (used to verify Meta connectivity only):
 * - WHATSAPP_TEST_TEMPLATE_NAME       : Approved zero-param template (e.g. "3p_direct_integration_test_template")
 * - WHATSAPP_TEST_TEMPLATE_LANGUAGE   : Language code for the test template (defaults to "en_US")
 *
 * IMPORTANT: Never auto-guess the number of template parameters.
 *   - If WHATSAPP_WELCOME_TEMPLATE_PARAM_COUNT=0 or unset, no components block is sent.
 *   - If WHATSAPP_WELCOME_TEMPLATE_PARAM_COUNT=1, exactly one text parameter (userName) is sent.
 *   - The count MUST match the number of {{variables}} in the approved Meta template exactly.
 */

const DEFAULT_API_VERSION = "v25.0";
const DEFAULT_TEMPLATE_LANG = "en_US";
const DEFAULT_COUNTRY_CODE = "91"; // India country code

/**
 * Normalizes a raw phone number to Meta WhatsApp Cloud API compatible international format.
 * WhatsApp requires recipient numbers without leading '+', spaces, or hyphens (e.g. "919876543210").
 *
 * Rules:
 * - Strips all non-digit characters (+, spaces, dashes, parentheses).
 * - For 10-digit numbers (Indian mobile), prepends country code 91 -> 919876543210.
 * - For 11-digit numbers starting with 0 (e.g. 09876543210), strips leading 0 and prepends 91 -> 919876543210.
 * - For 12-digit numbers starting with 91, keeps 919876543210.
 * - For international numbers (10 to 15 digits), preserves the cleaned numeric digits.
 * - Validates length (must be between 10 and 15 digits).
 * - Does NOT silently convert invalid input; returns null if invalid.
 *
 * @param {string|number} phone
 * @param {string} [defaultCountryCode="91"]
 * @returns {string|null} WhatsApp-compatible numeric phone string, or null if invalid.
 */
function normalizeWhatsAppPhoneNumber(phone, defaultCountryCode = DEFAULT_COUNTRY_CODE) {
  if (!phone) return null;

  // Extract only digits
  let digits = String(phone).replace(/\D/g, "");
  if (!digits) return null;

  // If 11 digits starting with 0 (common domestic format in India, e.g. 09876543210), strip 0
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // If 10 digits, prepend default country code (91)
  if (digits.length === 10) {
    digits = `${defaultCountryCode}${digits}`;
  }

  // Validate E.164 length without +: must be between 10 and 15 digits
  if (digits.length < 10 || digits.length > 15) {
    return null;
  }

  return digits;
}

/**
 * Masks a phone number for logs when needed
 *
 * @param {string} phone
 * @returns {string} Masked phone number
 */
function maskPhoneNumber(phone) {
  if (!phone) return "unknown";
  const str = String(phone);
  if (str.length <= 4) return "****";
  return "*".repeat(str.length - 4) + str.slice(-4);
}

/**
 * Reads and returns the WhatsApp Cloud API configuration from environment variables.
 *
 * templateParamCount is the explicit number of body {{variables}} in the welcome template.
 * It must be set to match the approved Meta template exactly. Default: 0 (no components sent).
 */
function getConfig() {
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  const token = (process.env.WHATSAPP_ACCESS_TOKEN || "").trim();
  const apiVersion = (process.env.WHATSAPP_API_VERSION || DEFAULT_API_VERSION).trim();

  // Support both WHATSAPP_WELCOME_TEMPLATE_NAME and legacy WHATSAPP_REGISTRATION_TEMPLATE_NAME
  const templateName = (
    process.env.WHATSAPP_WELCOME_TEMPLATE_NAME ||
    process.env.WHATSAPP_REGISTRATION_TEMPLATE_NAME ||
    ""
  ).trim();

  // Support both WHATSAPP_WELCOME_TEMPLATE_LANGUAGE and legacy WHATSAPP_REGISTRATION_TEMPLATE_LANG
  const templateLang = (
    process.env.WHATSAPP_WELCOME_TEMPLATE_LANGUAGE ||
    process.env.WHATSAPP_REGISTRATION_TEMPLATE_LANG ||
    DEFAULT_TEMPLATE_LANG
  ).trim();

  // EXPLICIT param count — must match the number of {{variables}} in the Meta-approved template.
  // Set to 0 (or leave unset) for zero-variable templates. Set to 1 for single-variable templates.
  const templateParamCount = parseInt(
    process.env.WHATSAPP_WELCOME_TEMPLATE_PARAM_COUNT || "0",
    10
  );

  // Zero-parameter connectivity test template (separate from production welcome template)
  const testTemplateName = (process.env.WHATSAPP_TEST_TEMPLATE_NAME || "").trim();
  const testTemplateLang = (process.env.WHATSAPP_TEST_TEMPLATE_LANGUAGE || DEFAULT_TEMPLATE_LANG).trim();

  const isConfigured = Boolean(phoneNumberId && token && templateName);

  return {
    isConfigured,
    phoneNumberId,
    token,
    apiVersion,
    templateName,
    templateLang,
    templateParamCount,
    testTemplateName,
    testTemplateLang,
    endpoint: `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
  };
}

/**
 * Diagnostic check printed at server startup or on demand.
 */
function validateConfig() {
  const config = getConfig();

  console.log("======================================================================");
  console.log("📱 [WhatsApp Cloud API Configuration & Keys]");
  console.log("======================================================================");
  console.log(`📌 PHONE_NUMBER_ID        : ${config.phoneNumberId || "❌ MISSING"}`);
  console.log(`🔑 ACCESS_TOKEN           : ${config.token ? `${config.token.slice(0, 15)}...${config.token.slice(-10)} (Length: ${config.token.length})` : "❌ MISSING"}`);
  console.log(`🌐 API_VERSION            : ${config.apiVersion}`);
  console.log(`📄 WELCOME_TEMPLATE_NAME  : ${config.templateName || "❌ MISSING"}`);
  console.log(`🔢 WELCOME_PARAM_COUNT    : ${config.templateParamCount} (explicit — must match Meta template)`);
  console.log(`🌍 WELCOME_TEMPLATE_LANG  : ${config.templateLang}`);
  console.log(`🧪 TEST_TEMPLATE_NAME     : ${config.testTemplateName || "(not configured)"}`);
  console.log(`🌍 TEST_TEMPLATE_LANG     : ${config.testTemplateLang}`);
  console.log(`🔗 API_ENDPOINT           : ${config.endpoint}`);
  console.log(`⚙️  STATUS                 : ${config.isConfigured ? "✅ FULLY CONFIGURED" : "⚠️ INCOMPLETE CONFIGURATION"}`);
  console.log("======================================================================");

  if (!config.isConfigured) {
    const missing = [];
    if (!config.phoneNumberId) missing.push("WHATSAPP_PHONE_NUMBER_ID");
    if (!config.token) missing.push("WHATSAPP_ACCESS_TOKEN");
    if (!config.templateName) missing.push("WHATSAPP_WELCOME_TEMPLATE_NAME");
    console.warn(`[WhatsApp] WARNING: WhatsApp Cloud API is incomplete. Missing: ${missing.join(", ")}`);
  }

  return config;
}

/**
 * Sends an approved WhatsApp Template Message to a recipient.
 * Outputs full diagnostic information to console on every request.
 *
 * The components/parameters block is ONLY included when paramCount > 0.
 * Never auto-guess the number of parameters — it must be explicit.
 *
 * @param {Object} options
 * @param {string}   options.phoneNumber   Recipient mobile number
 * @param {string}   options.templateName  Approved Meta template name
 * @param {string}   [options.languageCode="en_US"] Approved template language code
 * @param {Array<string|Object>} [options.parameters=[]] Body parameters for {{1}}, {{2}}, etc.
 * @param {number}   [options.paramCount=0] Explicit expected parameter count for this template.
 *                   If 0, no components block is sent regardless of `parameters` array contents.
 * @returns {Promise<{success: boolean, messageId?: string, error?: Object}>}
 */
async function sendTemplateMessage({
  phoneNumber,
  templateName,
  languageCode = DEFAULT_TEMPLATE_LANG,
  parameters = [],
  paramCount = 0,
}) {
  const config = getConfig();
  const timestamp = new Date().toISOString();

  console.log("\n======================================================================");
  console.log(`📤 [WhatsApp Dispatch Request] - ${timestamp}`);
  console.log("======================================================================");

  if (!config.token || !config.phoneNumberId) {
    const err = {
      message: "WhatsApp Cloud API credentials (WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID) are missing",
      missingCredentials: true,
    };
    console.error("❌ FAILED: Missing credentials in environment (.env).");
    console.error("  WHATSAPP_PHONE_NUMBER_ID:", config.phoneNumberId || "NOT SET");
    console.error("  WHATSAPP_ACCESS_TOKEN   :", config.token ? "SET" : "NOT SET");
    console.log("======================================================================\n");
    return { success: false, error: err };
  }

  const normalizedPhone = normalizeWhatsAppPhoneNumber(phoneNumber);
  if (!normalizedPhone) {
    const err = {
      message: `Invalid recipient phone number format: "${phoneNumber}". Must be 10-15 digits.`,
      invalidPhone: true,
    };
    console.error(`❌ FAILED: Invalid recipient phone number format: "${phoneNumber}"`);
    console.log("======================================================================\n");
    return { success: false, error: err };
  }

  if (!templateName) {
    const err = {
      message: "WhatsApp template name is required (WHATSAPP_WELCOME_TEMPLATE_NAME is not configured)",
      missingTemplate: true,
    };
    console.error("❌ FAILED: Template name is not configured.");
    console.log("======================================================================\n");
    return { success: false, error: err };
  }

  // Build components block ONLY when paramCount > 0. Never guess.
  const components = [];
  if (paramCount > 0) {
    const bodyParams = parameters.slice(0, paramCount).map((param) => {
      if (typeof param === "object" && param !== null && param.type) {
        return param;
      }
      return {
        type: "text",
        text: String(param != null ? param : ""),
      };
    });

    if (bodyParams.length !== paramCount) {
      console.warn(
        `⚠️  WARNING: Template "${templateName}" expects ${paramCount} parameter(s) ` +
        `but only ${bodyParams.length} were provided. ` +
        `Check WHATSAPP_WELCOME_TEMPLATE_PARAM_COUNT in .env.`
      );
    }

    components.push({ type: "body", parameters: bodyParams });
  }

  const payload = {
    messaging_product: "whatsapp",
    to: normalizedPhone,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
      ...(components.length > 0 ? { components } : {}),
    },
  };

  // Detailed Request Console Log
  console.log("📋 Request Details:");
  console.log(`  • Recipient (Raw Input)  : ${phoneNumber}`);
  console.log(`  • Recipient (Normalized) : ${normalizedPhone}`);
  console.log(`  • Phone Number ID        : ${config.phoneNumberId}`);
  console.log(`  • Access Token           : ${config.token.slice(0, 15)}...${config.token.slice(-10)} (Length: ${config.token.length})`);
  console.log(`  • API Endpoint           : ${config.endpoint}`);
  console.log(`  • Template Name          : ${templateName}`);
  console.log(`  • Template Language      : ${languageCode}`);
  console.log(`  • Param Count (explicit) : ${paramCount}`);
  console.log(`  • Components Sent        : ${components.length > 0 ? "YES" : "NO (zero-parameter template)"}`);
  console.log("📦 Request JSON Payload Sent to Meta:");
  console.log(JSON.stringify(payload, null, 2));
  console.log("----------------------------------------------------------------------");

  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    console.log("📥 [Meta WhatsApp API Response Received]:");
    console.log(`  • HTTP Status Code : ${response.status} ${response.statusText}`);
    console.log("📄 Raw Meta Response Body:");
    console.log(JSON.stringify(data, null, 2));

    if (!response.ok) {
      const metaError = data?.error || {};
      const status = response.status;
      const code = metaError.code;
      const subcode = metaError.error_subcode;
      const type = metaError.type || "OAuthException";
      const message = metaError.message || response.statusText;
      const fbtraceId = metaError.fbtrace_id;
      const errorData = metaError.error_data || {};

      console.error("\n❌ DISPATCH FAILED: Meta rejected the message request.");
      console.error(`  • Template Name          : ${templateName}`);
      console.error(`  • Template Language      : ${languageCode}`);
      console.error(`  • Parameters Sent        : ${paramCount} (explicit count)`);
      if (components.length > 0) {
        console.error(`  • Parameters Content     : ${JSON.stringify(components[0]?.parameters)}`);
      }
      console.error(`  • Error Code             : ${code}`);
      if (subcode) console.error(`  • Error Subcode          : ${subcode}`);
      console.error(`  • Error Type             : ${type}`);
      console.error(`  • Error Message          : ${message}`);
      if (errorData.details) console.error(`  • Error Details          : ${errorData.details}`);
      if (fbtraceId) console.error(`  • FB Trace ID            : ${fbtraceId}`);

      // Detailed root-cause explanations on console
      console.error("\n💡 ROOT CAUSE DIAGNOSIS:");
      if (code === 132000) {
        console.error(`  → Error 132000: Parameter count mismatch for template "${templateName}" (lang: ${languageCode}).`);
        console.error(`    Your request sent ${paramCount} parameter(s).`);
        if (errorData.details) {
          console.error(`    Meta details: ${errorData.details}`);
        }
        console.error("    ACTIONS REQUIRED:");
        console.error(`    1. Open Meta WhatsApp Manager and check the exact number of {{variables}} in template "${templateName}".`);
        console.error("    2. Update WHATSAPP_WELCOME_TEMPLATE_PARAM_COUNT in .env to match that exact count.");
        console.error("    3. If the template has 0 variables → set WHATSAPP_WELCOME_TEMPLATE_PARAM_COUNT=0");
        console.error("    4. If the template has 1 variable  → set WHATSAPP_WELCOME_TEMPLATE_PARAM_COUNT=1");
        console.error("    5. Never send more or fewer parameters than the template defines.");
      } else if (code === 100 || code === 132001) {
        console.error(`  → Template "${templateName}" with language "${languageCode}" was rejected by Meta.`);
        console.error("    POSSIBLE REASONS:");
        console.error(`    1. The template "${templateName}" does not exist in your Meta WhatsApp Manager.`);
        console.error("    2. The template is not yet approved (still in PENDING or REJECTED status).");
        console.error(`    3. The template language in Meta is different (e.g., 'en' instead of 'en_US').`);
      } else if (code === 131058) {
        console.error("  → Template cannot be sent from this registered business number.");
        console.error("    ACTION: Ensure the approved template is used and the number is in Live Mode.");
      } else if (code === 190) {
        console.error("  → Meta Access Token is invalid or expired.");
        console.error("    ACTION: Generate a new permanent System User token in Meta Business Settings.");
      } else if (code === 131030) {
        console.error("  → Recipient number is not in the allowed list for Development Mode.");
        console.error("    ACTION: In Meta Developer Dashboard -> WhatsApp -> API Setup, add recipient phone to 'To' dropdown, or switch app to Live Mode.");
      }
      console.log("======================================================================\n");

      return {
        success: false,
        status,
        error: {
          status,
          code,
          subcode,
          type,
          message,
          fbtraceId,
          details: errorData.details || message,
          templateName,
          languageCode,
          paramCountSent: paramCount,
        },
      };
    }

    const messageId = data?.messages?.[0]?.id || "unknown";
    console.log("\n✅ DISPATCH SUCCESSFUL: Meta accepted the message for delivery!");
    console.log(`  • Message ID : ${messageId}`);
    console.log(`  • Recipient  : ${normalizedPhone}`);
    console.log("======================================================================\n");

    return {
      success: true,
      messageId,
      contacts: data?.contacts,
      raw: data,
    };
  } catch (error) {
    console.error("\n❌ NETWORK / REQUEST EXCEPTION:");
    console.error("  Exception Message:", error.message);
    console.log("======================================================================\n");
    return {
      success: false,
      error: {
        message: error.message,
        isNetworkError: true,
      },
    };
  }
}

/**
 * Sends a zero-parameter test template to verify Meta Cloud API connectivity.
 * Template must have NO body variables (e.g. "3p_direct_integration_test_template").
 * No components block is ever sent by this function.
 *
 * @param {Object} options
 * @param {string} options.phoneNumber Recipient mobile number
 * @returns {Promise<{success: boolean, messageId?: string, error?: Object}>}
 */
async function sendTestConnectivityMessage({ phoneNumber }) {
  const config = getConfig();

  if (!config.testTemplateName) {
    return {
      success: false,
      error: {
        message: "WHATSAPP_TEST_TEMPLATE_NAME is not configured in .env",
        missingTemplate: true,
      },
    };
  }

  console.log(`\n🧪 [Connectivity Test] Using zero-param template: "${config.testTemplateName}" (${config.testTemplateLang})`);

  return sendTemplateMessage({
    phoneNumber,
    templateName: config.testTemplateName,
    languageCode: config.testTemplateLang,
    parameters: [],
    paramCount: 0, // zero-param template — never send components
  });
}

/**
 * High-level service method to send the registration welcome template message.
 *
 * Uses WHATSAPP_WELCOME_TEMPLATE_NAME, WHATSAPP_WELCOME_TEMPLATE_LANGUAGE, and
 * WHATSAPP_WELCOME_TEMPLATE_PARAM_COUNT from environment.
 *
 * The param count MUST match the number of {{variables}} in the Meta-approved template.
 * - If templateParamCount === 0: sends no components (zero-variable template).
 * - If templateParamCount === 1: sends userName as the single body parameter.
 *
 * @param {Object} options
 * @param {string} options.phoneNumber Recipient mobile number
 * @param {string} options.userName    Full name of the user (used when templateParamCount >= 1)
 * @returns {Promise<{success: boolean, messageId?: string, error?: Object}>}
 */
async function sendRegistrationWelcomeMessage({ phoneNumber, userName }) {
  const config = getConfig();
  const name = (userName || "Member").trim();

  // Build parameter list based on explicit param count — never guess.
  const parameters = config.templateParamCount >= 1 ? [name] : [];

  return sendTemplateMessage({
    phoneNumber,
    templateName: config.templateName,
    languageCode: config.templateLang,
    parameters,
    paramCount: config.templateParamCount,
  });
}

module.exports = {
  normalizeWhatsAppPhoneNumber,
  formatPhoneNumber: normalizeWhatsAppPhoneNumber,
  maskPhoneNumber,
  getConfig,
  validateConfig,
  sendTemplateMessage,
  sendTestConnectivityMessage,
  sendRegistrationWelcomeMessage,
  sendRegistrationWelcome: ({ phone, name }) =>
    sendRegistrationWelcomeMessage({ phoneNumber: phone, userName: name }),
  sendWelcomeMessage: ({ memberName, mobileNumber }) =>
    sendRegistrationWelcomeMessage({ phoneNumber: mobileNumber, userName: memberName }),
};
