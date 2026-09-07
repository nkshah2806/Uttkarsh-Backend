const envConfig = require("../config/environment.json");
Object.entries(envConfig).forEach(([key, value]) => {
    process.env[key] = value;
});

const mongoose = require("mongoose");
const LegalContent = require("../models/LegalContent");
const HealthCamp = require("../models/HealthCamp");
const User = require("../models/User");
const legalContentController = require("../controllers/legalContentController");
const healthCampController = require("../controllers/healthCampController");

const MONGO_URL = process.env.MONGO_URL;
const ADMIN_ID = new mongoose.Types.ObjectId();

// Express-like mock response that records status code + json body.
function makeRes() {
    const res = {
        statusCode: 200,
        body: null,
        status(code) {
            res.statusCode = code;
            return res;
        },
        json(data) {
            res.body = data;
            return res;
        },
    };
    return res;
}

// Marker prefixes used for cleanup (never collides with real data).
const LEGAL_PREFIX = "E2E Legal";
const CAMP_PREFIX = "E2E Health Camp";

async function runTests() {
    console.log("🚀 Starting Legal Content & Camp Details End-to-End Test Suite...\n");

    try {
        await mongoose.connect(MONGO_URL, { dbName: "uttkarsh_db" });
        console.log("✅ Connected to MongoDB for testing.");

        // Pre-clean any leftovers from an earlier interrupted run
        await LegalContent.deleteMany({ title: { $regex: LEGAL_PREFIX } });
        await HealthCamp.deleteMany({ name: { $regex: CAMP_PREFIX } });

        // ============================================================
        // LEGAL CONTENT — CREATE + SINGLE-ACTIVE-PER-TYPE (privacy)
        // ============================================================
        console.log("\n🧪 Test 1: Legal Content CRUD + single-active per type");

        // v1 privacy active
        const resCreateP1 = makeRes();
        await legalContentController.createLegalContent(
            {
                body: {
                    type: "privacy_policy",
                    title: `${LEGAL_PREFIX} Privacy v1`,
                    content: "**Privacy Policy v1**\n\nFirst privacy paragraph.",
                    is_active: true,
                },
                user: { _id: ADMIN_ID },
            },
            resCreateP1
        );
        if (resCreateP1.statusCode !== 201 || !resCreateP1.body?.success) {
            throw new Error("createLegalContent (privacy v1) failed");
        }
        const privacyV1 = resCreateP1.body.data;
        console.log("  ✓ Created privacy_policy v1 (active)");

        // v2 privacy active → v1 must become inactive (single-active enforcement)
        const resCreateP2 = makeRes();
        await legalContentController.createLegalContent(
            {
                body: {
                    type: "privacy_policy",
                    title: `${LEGAL_PREFIX} Privacy v2`,
                    content: "**Privacy Policy v2**\n\nSecond privacy paragraph.",
                    is_active: true,
                },
                user: { _id: ADMIN_ID },
            },
            resCreateP2
        );
        const privacyV2 = resCreateP2.body.data;

        const reloadP1 = await LegalContent.findById(privacyV1._id);
        if (reloadP1.is_active !== false || privacyV2.is_active !== true) {
            throw new Error("Single-active failed: activating privacy v2 did not deactivate privacy v1");
        }
        console.log("  ✓ Single-active PASSED for privacy_policy (v1 inactive, v2 active)");

        // ============================================================
        // LEGAL CONTENT — INDEPENDENCE ACROSS TYPES (terms created active
        // must NOT deactivate privacy)
        // ============================================================
        const resCreateT1 = makeRes();
        await legalContentController.createLegalContent(
            {
                body: {
                    type: "terms_conditions",
                    title: `${LEGAL_PREFIX} Terms v1`,
                    content: "**Terms & Conditions v1**\n\nFirst terms paragraph.",
                    is_active: true,
                },
                user: { _id: ADMIN_ID },
            },
            resCreateT1
        );
        const termsV1 = resCreateT1.body.data;

        const privacyCheck = await LegalContent.findById(privacyV2._id);
        if (privacyCheck.is_active !== true || termsV1.is_active !== true) {
            throw new Error("Type independence failed: terms activation affected privacy content");
        }
        console.log("  ✓ Type independence PASSED (terms activation left privacy active)");

        // ============================================================
        // LEGAL CONTENT — PUBLIC ACTIVE ENDPOINT
        // ============================================================
        console.log("\n🧪 Test 2: Public active-content endpoint");

        const resActivePrivacy = makeRes();
        await legalContentController.getActiveLegalContent(
            { query: { type: "privacy_policy" } },
            resActivePrivacy
        );
        if (
            resActivePrivacy.body?.success !== true ||
            !resActivePrivacy.body?.data ||
            resActivePrivacy.body.data._id.toString() !== privacyV2._id.toString()
        ) {
            throw new Error("getActiveLegalContent(privacy_policy) did not return v2");
        }
        console.log("  ✓ Active privacy_policy returned the current active doc (v2)");

        const resActiveTerms = makeRes();
        await legalContentController.getActiveLegalContent(
            { query: { type: "terms_conditions" } },
            resActiveTerms
        );
        if (resActiveTerms.body?.data?._id?.toString() !== termsV1._id.toString()) {
            throw new Error("getActiveLegalContent(terms_conditions) did not return terms v1");
        }
        console.log("  ✓ Active terms_conditions returned the current active doc (v1)");

        // Invalid type → 400
        const resBadType = makeRes();
        await legalContentController.getActiveLegalContent({ query: { type: "bogus" } }, resBadType);
        if (resBadType.statusCode !== 400) {
            throw new Error("getActiveLegalContent with invalid type should return 400");
        }
        console.log("  ✓ Invalid type rejected with 400");

        // No active content → data: null (empty/public state the frontend renders)
        await LegalContent.findByIdAndUpdate(termsV1._id, { is_active: false });
        const resNoActive = makeRes();
        await legalContentController.getActiveLegalContent(
            { query: { type: "terms_conditions" } },
            resNoActive
        );
        if (resNoActive.body?.success !== true || resNoActive.body?.data !== null) {
            throw new Error("Expected {success:true, data:null} when no active terms content");
        }
        console.log("  ✓ No-active state returns {success:true, data:null}");

        // Re-activate terms v1 for later tests
        await LegalContent.findByIdAndUpdate(termsV1._id, { is_active: true });

        // ============================================================
        // LEGAL CONTENT — LIST + BY-ID (view)
        // ============================================================
        console.log("\n🧪 Test 3: List & single-document read");

        const resList = makeRes();
        await legalContentController.getLegalContentList(
            { query: { type: "privacy_policy" } },
            resList
        );
        const privacyList = resList.body?.data || [];
        if (!privacyList.some((c) => c._id.toString() === privacyV2._id.toString())) {
            throw new Error("getLegalContentList(type=privacy_policy) missing v2");
        }
        console.log("  ✓ List filtered by type includes the privacy documents");

        const resById = makeRes();
        await legalContentController.getLegalContentById({ params: { id: privacyV2._id } }, resById);
        if (resById.body?.data?._id?.toString() !== privacyV2._id.toString()) {
            throw new Error("getLegalContentById(view) failed to return the document");
        }
        console.log("  ✓ View (get-by-id) returned the document");

        // ============================================================
        // LEGAL CONTENT — UPDATE (edit) + re-activation via update
        // ============================================================
        console.log("\n🧪 Test 4: Update (edit) keeps single-active invariant");

        const resUpdate = makeRes();
        await legalContentController.updateLegalContent(
            {
                params: { id: privacyV1._id },
                body: {
                    title: `${LEGAL_PREFIX} Privacy v1 (updated)`,
                    content: "**Privacy Policy v1**\n\nUpdated first paragraph.",
                    is_active: true,
                },
                user: { _id: ADMIN_ID },
            },
            resUpdate
        );
        const checkP1Again = await LegalContent.findById(privacyV1._id);
        const checkP2After = await LegalContent.findById(privacyV2._id);
        if (checkP1Again.is_active !== true || checkP2After.is_active !== false) {
            throw new Error("updateLegalContent failed single-active: activating v1 should deactivate v2");
        }
        if (resUpdate.body?.data?.title !== `${LEGAL_PREFIX} Privacy v1 (updated)`) {
            throw new Error("updateLegalContent did not persist the new title");
        }
        console.log("  ✓ Edit persisted; re-activating v1 correctly deactivated v2");

        // ============================================================
        // LEGAL CONTENT — TOGGLE STATUS
        // ============================================================
        console.log("\n🧪 Test 5: Toggle status");

        const resToggleOff = makeRes();
        await legalContentController.toggleLegalContentStatus(
            { params: { id: privacyV1._id }, user: { _id: ADMIN_ID } },
            resToggleOff
        );
        const offP1 = await LegalContent.findById(privacyV1._id);
        if (offP1.is_active !== false) {
            throw new Error("Toggle OFF failed");
        }
        console.log("  ✓ Toggle deactivated v1");

        const resToggleOn = makeRes();
        await legalContentController.toggleLegalContentStatus(
            { params: { id: privacyV1._id }, user: { _id: ADMIN_ID } },
            resToggleOn
        );
        const onP1 = await LegalContent.findById(privacyV1._id);
        const afterP2 = await LegalContent.findById(privacyV2._id);
        if (onP1.is_active !== true || afterP2.is_active !== false) {
            throw new Error("Toggle ON failed single-active invariant");
        }
        console.log("  ✓ Toggle re-activated v1 and kept v2 inactive");

        // ============================================================
        // LEGAL CONTENT — DELETE
        // ============================================================
        console.log("\n🧪 Test 6: Delete");

        const resDelete = makeRes();
        await legalContentController.deleteLegalContent(
            { params: { id: privacyV2._id } },
            resDelete
        );
        const gone = await LegalContent.findById(privacyV2._id);
        if (resDelete.body?.success !== true || gone) {
            throw new Error("deleteLegalContent failed to remove the document");
        }
        console.log("  ✓ Document deleted successfully");

        // Validation coverage
        const resInvalidCreate = makeRes();
        await legalContentController.createLegalContent(
            { body: { type: "bogus", title: "x", content: "y" }, user: { _id: ADMIN_ID } },
            resInvalidCreate
        );
        if (resInvalidCreate.statusCode !== 400) {
            throw new Error("create with invalid type should be 400");
        }
        console.log("  ✓ Invalid-type creation rejected with 400");

        // ============================================================
        // HEALTH CAMPS — PER-CAMP REGISTRATION SCOPING + DETAILS VIEW
        // ============================================================
        console.log("\n🧪 Test 7: Camp details view + per-camp registrations only");

        const campA = await HealthCamp.create({
            name: `${CAMP_PREFIX} Alpha`,
            description: "Alpha camp for e2e scoping",
            date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            start_time: "10:00 AM",
            end_time: "02:00 PM",
            venue: "Test Hall Alpha",
            address: "Alpha Street",
            city: "Test City",
            state: "Gujarat",
            pincode: "380001",
            contact_person: "Alpha Contact",
            contact_number: "9999999901",
            contact_email: "alpha@test.com",
            is_active: true,
            registration_required: true,
            registration_limit: 50,
        });

        const campB = await HealthCamp.create({
            name: `${CAMP_PREFIX} Beta`,
            date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
            venue: "Test Hall Beta",
            city: "Test City",
            state: "Gujarat",
            is_active: true,
            registration_required: true,
            registration_limit: 10,
        });

        // Register two people to Camp A
        const resRegA1 = makeRes();
        await healthCampController.registerForHealthCamp(
            { params: { id: campA._id }, body: { name: "E2E Person Alpha One", phone: "9000000001", age: 30 } },
            resRegA1
        );
        if (resRegA1.statusCode !== 201) {
            throw new Error("Registration A1 failed");
        }

        const resRegA2 = makeRes();
        await healthCampController.registerForHealthCamp(
            { params: { id: campA._id }, body: { name: "E2E Person Alpha Two", phone: "9000000002", email: "two@test.com", notes: "walk-in" } },
            resRegA2
        );
        if (resRegA2.statusCode !== 201) {
            throw new Error("Registration A2 failed");
        }

        // Register one person to Camp B
        const resRegB1 = makeRes();
        await healthCampController.registerForHealthCamp(
            { params: { id: campB._id }, body: { name: "E2E Person Beta One", phone: "9000000011", age: 25 } },
            resRegB1
        );
        if (resRegB1.statusCode !== 201) {
            throw new Error("Registration B1 failed");
        }

        // Camp A detail view must contain ONLY its 2 registrations
        const resDetailA = makeRes();
        await healthCampController.getHealthCampById({ params: { id: campA._id } }, resDetailA);
        const detailA = resDetailA.body?.data;
        if (!detailA || detailA.registrations.length !== 2) {
            throw new Error(`Camp A should have exactly 2 registrations, got ${detailA?.registrations?.length}`);
        }
        const namesA = detailA.registrations.map((r) => r.name).sort();
        if (namesA[0] !== "E2E Person Alpha One" || namesA[1] !== "E2E Person Alpha Two") {
            throw new Error("Camp A registrations content mismatch (bleed or wrong persons)");
        }
        if (detailA.registrations.some((r) => r.name.includes("Beta"))) {
            throw new Error("Camp A leaked registrations belonging to Camp B");
        }
        console.log("  ✓ Camp A detail shows exactly its own 2 registrations (no bleed)");

        // Camp B detail view must contain ONLY its 1 registration
        const resDetailB = makeRes();
        await healthCampController.getHealthCampById({ params: { id: campB._id } }, resDetailB);
        const detailB = resDetailB.body?.data;
        if (!detailB || detailB.registrations.length !== 1 || detailB.registrations[0].name !== "E2E Person Beta One") {
            throw new Error("Camp B registrations scoping failed");
        }
        console.log("  ✓ Camp B detail shows only its own 1 registration");

        // Empty registrations state (camp with no registrations yet)
        const campEmpty = await HealthCamp.create({
            name: `${CAMP_PREFIX} Empty`,
            date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            venue: "Test Hall Empty",
            city: "Test City",
            state: "Gujarat",
            is_active: true,
            registration_required: false,
        });
        const resDetailEmpty = makeRes();
        await healthCampController.getHealthCampById({ params: { id: campEmpty._id } }, resDetailEmpty);
        const registrationsEmpty = resDetailEmpty.body?.data?.registrations || [];
        if (registrationsEmpty.length !== 0) {
            throw new Error("Camp with no registrations should render empty state");
        }
        console.log("  ✓ Camp with no registrations returns an empty registrations array");

        // ============================================================
        // CLEANUP
        // ============================================================
        console.log("\n🧹 Cleaning up test data...");
        await LegalContent.deleteMany({ title: { $regex: LEGAL_PREFIX } });
        await HealthCamp.deleteMany({ name: { $regex: CAMP_PREFIX } });
        console.log("  ✓ Removed all test legal content and test camps");

        console.log("\n🎉 ALL LEGAL CONTENT & CAMP DETAILS TESTS PASSED SUCCESSFULLY!\n");
        process.exit(0);
    } catch (err) {
        console.error("\n❌ TEST FAILED:", err.message);
        console.error(err.stack);
        // Best-effort cleanup so a failed run never leaves test rows behind
        try {
            await LegalContent.deleteMany({ title: { $regex: LEGAL_PREFIX } });
            await HealthCamp.deleteMany({ name: { $regex: CAMP_PREFIX } });
        } catch (_) {
            /* ignore cleanup errors in the failure path */
        }
        process.exit(1);
    }
}

runTests();
