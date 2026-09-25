"use strict";

const whatsAppService = require("../services/whatsAppService");

let ok = 0;
let fail = 0;

function assert(condition, message) {
  if (condition) {
    console.log(` PASS ${message}`);
    ok++;
  } else {
    console.error(` FAIL ${message}`);
    fail++;
  }
}

async function runTests() {
  console.log("--- Test Suite: WhatsApp Business Cloud API Integration ---\n");

  // 1. Phone number normalization
  const p1 = whatsAppService.normalizeWhatsAppPhoneNumber("9876543210");
  assert(p1 === "919876543210", "T1: 10-digit Indian number is prefixed with country code 91");

  const p2 = whatsAppService.normalizeWhatsAppPhoneNumber("+91 98765 43210");
  assert(p2 === "919876543210", "T2: Formatted number with '+' and spaces is sanitized to pure digits");

  const p3 = whatsAppService.normalizeWhatsAppPhoneNumber("09876543210");
  assert(p3 === "919876543210", "T3: 11-digit number with leading 0 is stripped and prefixed with 91");

  const p4 = whatsAppService.normalizeWhatsAppPhoneNumber("98765-43210");
  assert(p4 === "919876543210", "T4: Hyphenated 10-digit number is normalized to 919876543210");

  const p5 = whatsAppService.normalizeWhatsAppPhoneNumber("+1 (555) 123-4567");
  assert(p5 === "15551234567", "T5: International US number preserves country code without '+'");

  const p6 = whatsAppService.normalizeWhatsAppPhoneNumber("123");
  assert(p6 === null, "T6: Invalid short number returns null");

  const p7 = whatsAppService.normalizeWhatsAppPhoneNumber("");
  assert(p7 === null, "T7: Empty phone number returns null");

  // 2. Phone number masking
  const m1 = whatsAppService.maskPhoneNumber("919876543210");
  assert(m1 === "********3210", "T8: Phone number is properly masked for safe logs");

  // 3. Unconfigured behavior
  const savedToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const savedPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const savedTemplate = process.env.WHATSAPP_WELCOME_TEMPLATE_NAME;

  delete process.env.WHATSAPP_ACCESS_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_WELCOME_TEMPLATE_NAME;

  const configUnconfigured = whatsAppService.getConfig();
  assert(configUnconfigured.isConfigured === false, "T9: Missing credentials reports isConfigured=false");

  const unconfiguredSend = await whatsAppService.sendRegistrationWelcomeMessage({
    phoneNumber: "9876543210",
    userName: "Test User",
  });
  assert(
    unconfiguredSend.success === false && unconfiguredSend.error.missingCredentials === true,
    "T10: Message send gracefully fails when unconfigured without throwing"
  );

  // 4. Mocked Meta Graph API call
  process.env.WHATSAPP_ACCESS_TOKEN = "EAABmocktoken456";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "9988776655";
  process.env.WHATSAPP_WELCOME_TEMPLATE_NAME = "hello_world";
  process.env.WHATSAPP_WELCOME_TEMPLATE_LANGUAGE = "en_US";
  process.env.WHATSAPP_API_VERSION = "v25.0";

  const originalFetch = global.fetch;
  let interceptedUrl = null;
  let interceptedHeaders = null;
  let interceptedBody = null;

  global.fetch = async (url, options) => {
    interceptedUrl = url;
    interceptedHeaders = options.headers;
    interceptedBody = JSON.parse(options.body);

    return {
      ok: true,
      status: 200,
      json: async () => ({
        messaging_product: "whatsapp",
        contacts: [{ input: interceptedBody.to, wa_id: interceptedBody.to }],
        messages: [{ id: "wamid.HBgLMTIzNDU2Nzg5MA==" }],
      }),
    };
  };

  // Test template message sending
  const sendResult = await whatsAppService.sendRegistrationWelcomeMessage({
    phoneNumber: "9876543210",
    userName: "Rajesh Sharma",
  });

  assert(sendResult.success === true, "T11: Welcome template message dispatch succeeds");
  assert(sendResult.messageId === "wamid.HBgLMTIzNDU2Nzg5MA==", "T12: Meta message ID returned");
  assert(interceptedUrl === "https://graph.facebook.com/v25.0/9988776655/messages", "T13: Meta endpoint URL format matches v25.0 and Phone ID");
  assert(interceptedHeaders["Authorization"] === "Bearer EAABmocktoken456", "T14: Authorization Bearer header sent with token");
  assert(interceptedHeaders["Content-Type"] === "application/json", "T15: Content-Type is application/json");
  assert(interceptedBody.messaging_product === "whatsapp", "T16: messaging_product is whatsapp");
  assert(interceptedBody.to === "919876543210", "T17: Recipient number formatted as 919876543210");
  assert(interceptedBody.type === "template", "T18: Message type is strictly template (never free-text)");
  assert(interceptedBody.template.name === process.env.WHATSAPP_WELCOME_TEMPLATE_NAME, "T19: Template name matches configuration");
  assert(interceptedBody.template.language.code === "en_US", "T20: Language code is en_US");

  // 5. Test error response handling
  global.fetch = async (url, options) => {
    return {
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({
        error: {
          message: "(#100) Invalid parameter",
          type: "OAuthException",
          code: 100,
          fbtrace_id: "AmockTrace123",
        },
      }),
    };
  };

  const failResult = await whatsAppService.sendRegistrationWelcomeMessage({
    phoneNumber: "9876543210",
    userName: "Fail User",
  });

  assert(failResult.success === false, "T22: Error response correctly reports success=false");
  assert(failResult.status === 400, "T23: HTTP status 400 captured");
  assert(failResult.error.code === 100, "T24: Meta error code 100 captured");
  assert(failResult.error.fbtraceId === "AmockTrace123", "T25: Meta trace ID captured");

  // Restore fetch and env
  global.fetch = originalFetch;
  if (savedToken) process.env.WHATSAPP_ACCESS_TOKEN = savedToken;
  if (savedPhoneId) process.env.WHATSAPP_PHONE_NUMBER_ID = savedPhoneId;
  if (savedTemplate) process.env.WHATSAPP_WELCOME_TEMPLATE_NAME = savedTemplate;

  console.log(`\nResults: ${ok} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
