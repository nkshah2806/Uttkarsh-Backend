/**
 * WhatsApp Business Cloud API Diagnostic & Test Script
 *
 * Verifies environment configuration, phone number normalization,
 * Meta Cloud API connectivity, and attempts to send a test message template.
 *
 * Usage:
 *   node scripts/testWhatsApp.js [phoneNumber] [userName]
 * Example:
 *   node scripts/testWhatsApp.js 919876543210 "Test User"
 */

require("dotenv").config();
const whatsAppService = require("../services/whatsAppService");

async function runDiagnostic() {
  console.log("\n=======================================================");
  console.log("   WhatsApp Business Cloud API Diagnostic Tool");
  console.log("=======================================================\n");

  // 1. Check Configuration
  console.log("1. Checking Environment Variables...");
  const config = whatsAppService.validateConfig();

  let hasErrors = false;
  if (!config.phoneNumberId) {
    console.error("❌ WHATSAPP_PHONE_NUMBER_ID is missing in .env");
    hasErrors = true;
  }
  if (!config.token) {
    console.error("❌ WHATSAPP_ACCESS_TOKEN is missing in .env");
    hasErrors = true;
  }
  if (!config.templateName) {
    console.error("❌ WHATSAPP_WELCOME_TEMPLATE_NAME is missing in .env");
    hasErrors = true;
  }

  // 2. Test Phone Number Normalization
  console.log("\n2. Testing Phone Number Normalization Functionality...");
  const testCases = [
    { input: "9876543210", expected: "919876543210", desc: "10-digit Indian number" },
    { input: "+91 98765 43210", expected: "919876543210", desc: "Formatted with +91 and spaces" },
    { input: "09876543210", expected: "919876543210", desc: "11-digit with leading 0" },
    { input: "98765-43210", expected: "919876543210", desc: "Hyphenated 10 digits" },
    { input: "+1 (555) 123-4567", expected: "15551234567", desc: "US international number" },
    { input: "123", expected: null, desc: "Invalid short number" },
    { input: "", expected: null, desc: "Empty input" },
  ];

  let normPassCount = 0;
  testCases.forEach(({ input, expected, desc }) => {
    const output = whatsAppService.normalizeWhatsAppPhoneNumber(input);
    const pass = output === expected;
    if (pass) {
      normPassCount++;
      console.log(`  ✅ [PASS] ${desc}: "${input}" -> "${output}"`);
    } else {
      console.error(`  ❌ [FAIL] ${desc}: input="${input}", expected="${expected}", got="${output}"`);
    }
  });

  if (normPassCount !== testCases.length) {
    console.error(`❌ Phone normalization tests failed (${normPassCount}/${testCases.length} passed).`);
  } else {
    console.log(`✅ All ${normPassCount} phone normalization test cases passed!`);
  }

  // 3. Test Meta Graph API Connectivity (Phone Node Info)
  if (config.phoneNumberId && config.token) {
    console.log("\n3. Testing Meta Graph API Connectivity to Phone Number Node...");
    try {
      const metaCheckUrl = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}?fields=verified_name,code_verification_status,display_phone_number,quality_rating,status`;
      const phoneRes = await fetch(metaCheckUrl, {
        headers: { Authorization: `Bearer ${config.token}` },
      });
      const phoneData = await phoneRes.json();

      if (phoneRes.ok) {
        console.log("  ✅ Successfully connected to Meta Graph API!");
        console.log(`  📌 Verified Name: "${phoneData.verified_name || "N/A"}"`);
        console.log(`  📌 Display Number: "${phoneData.display_phone_number || "N/A"}"`);
        console.log(`  📌 Verification Status: "${phoneData.code_verification_status || "N/A"}"`);
        console.log(`  📌 Status: "${phoneData.status || "N/A"}"`);
      } else {
        console.error("  ❌ Meta API Error when verifying Phone Number Node:");
        console.error("  Status:", phoneRes.status);
        console.error("  Error Details:", JSON.stringify(phoneData.error || phoneData, null, 2));
      }
    } catch (netErr) {
      console.error("  ❌ Network error connecting to Meta Graph API:", netErr.message);
    }
  }

  // 4. Phase 1: Zero-param connectivity test
  const cliPhone = process.argv[2];
  const cliName = process.argv[3] || "Test Registrant";

  if (!cliPhone) {
    console.log("\n4. Message Dispatch Tests: SKIPPED (No test phone number provided).");
    console.log("   To run live message tests, provide a phone number as an argument:");
    console.log("   npm run test:whatsapp -- 919876543210 \"Nakul Shah\"\n");
  } else {
    // ── PHASE 1: Zero-param template (verify Meta connectivity) ──────────────
    console.log(`\n4a. [PHASE 1] Zero-param connectivity test → template: "${config.testTemplateName || "(not set)"}"`);
    console.log(`    Recipient: ${whatsAppService.maskPhoneNumber(cliPhone)}`);
    console.log("    Sending with NO components/parameters...");

    if (!config.testTemplateName) {
      console.warn("    ⚠️  PHASE 1 SKIPPED: WHATSAPP_TEST_TEMPLATE_NAME is not set in .env");
    } else {
      const phase1Result = await whatsAppService.sendTestConnectivityMessage({
        phoneNumber: cliPhone,
      });

      if (phase1Result.success) {
        console.log("\n    🎉 PHASE 1 RESULT: ✅ SUCCESS");
        console.log(`       Message ID : ${phase1Result.messageId}`);
        console.log("       Meta integration confirmed working (zero-param template accepted).");
      } else {
        console.log("\n    ❌ PHASE 1 RESULT: FAILED");
        console.log("       Meta rejected the zero-param test template.");
        console.log("       Status Code :", phase1Result.status);
        console.log("       Error Info  :", JSON.stringify(phase1Result.error, null, 2));
      }
    }

    // ── PHASE 2: registration_welcome with userName parameter ────────────────
    console.log(`\n4b. [PHASE 2] Registration welcome test → template: "${config.templateName || "(not set)"}"`);
    console.log(`    Param count (explicit): ${config.templateParamCount}`);
    console.log(`    userName: "${cliName}"`);
    console.log(`    Recipient: ${whatsAppService.maskPhoneNumber(cliPhone)}`);

    if (!config.templateName) {
      console.error("    ❌ PHASE 2 SKIPPED: WHATSAPP_WELCOME_TEMPLATE_NAME is not set in .env");
    } else {
      const phase2Result = await whatsAppService.sendRegistrationWelcomeMessage({
        phoneNumber: cliPhone,
        userName: cliName,
      });

      if (phase2Result.success) {
        console.log("\n    🎉 PHASE 2 RESULT: ✅ SUCCESS");
        console.log(`       Message ID : ${phase2Result.messageId}`);
        console.log(`       Template "${config.templateName}" with ${config.templateParamCount} param(s) accepted by Meta.`);
      } else {
        console.log("\n    ❌ PHASE 2 RESULT: FAILED");
        console.log("       Meta rejected the registration welcome template.");
        console.log("       Status Code :", phase2Result.status);
        console.log("       Error Info  :", JSON.stringify(phase2Result.error, null, 2));
        if (phase2Result.error?.code === 132000) {
          console.log("\n    ⚙️  FIX: Adjust WHATSAPP_WELCOME_TEMPLATE_PARAM_COUNT in .env");
          console.log(`       Current value: ${config.templateParamCount}`);
          console.log("       Set it to the exact number of {{variables}} in your Meta-approved template.");
        }
      }
    }
  }

  console.log("\n=======================================================");
  console.log("   Diagnostic Complete");
  console.log("=======================================================\n");
}

runDiagnostic().catch((err) => {
  console.error("Unhandled diagnostic exception:", err);
  process.exit(1);
});
