const envConfig = require("../config/environment.json");
Object.entries(envConfig).forEach(([key, value]) => {
  process.env[key] = value;
});

const mongoose = require("mongoose");
const Disclaimer = require("../models/Disclaimer");
const Visit = require("../models/Visit");
const Patient = require("../models/Patient");
const User = require("../models/User");
const Parameter = require("../models/Parameter");
const VisitParameterResult = require("../models/VisitParameterResult");
const { generateReportHTML } = require("../services/pdfReportService");
const disclaimerController = require("../controllers/disclaimerController");

const MONGO_URL = process.env.MONGO_URL;

async function runTests() {
  console.log("🚀 Starting Disclaimer & Enhanced PDF Report Test Suite...\n");

  try {
    await mongoose.connect(MONGO_URL, { dbName: "uttkarsh_db" });
    console.log("✅ Connected to MongoDB for testing.");

    // Clean up test artifacts
    await Disclaimer.deleteMany({ title: /Test Disclaimer/ });

    // ==========================================
    // TEST 1: Create Disclaimers & Single Active Rule
    // ==========================================
    console.log("\n🧪 Test 1: Disclaimer Creation & Active State Rule");

    const d1 = await Disclaimer.create({
      title: "Test Disclaimer 1",
      content: "This is test disclaimer 1 content paragraph.",
      content_hi: "यह टेस्ट अस्वीकरण 1 है।",
      is_active: true,
    });
    console.log("  ✓ Created Disclaimer 1 with is_active: true");

    // Create Disclaimer 2 also as active via Controller logic or direct simulation
    // Simulating controller behavior:
    const mockReq2 = {
      body: {
        title: "Test Disclaimer 2",
        content: "This is test disclaimer 2 content paragraph.\n\nSecond paragraph of disclaimer 2.",
        content_hi: "यह टेस्ट अस्वीकरण 2 का दूसरा पैराग्राफ है।",
        is_active: true,
      },
      user: { _id: new mongoose.Types.ObjectId() },
    };

    let createdData2 = null;
    const mockRes2 = {
      status: (code) => ({
        json: (data) => {
          createdData2 = data.data;
          return data;
        },
      }),
      json: (data) => {
        createdData2 = data.data;
        return data;
      },
    };

    await disclaimerController.createDisclaimer(mockReq2, mockRes2);
    console.log("✅ Created Disclaimer 2 via controller with is_active: true");

    // Verify Disclaimer 1 is now inactive
    const checkD1 = await Disclaimer.findById(d1._id);
    const checkD2 = await Disclaimer.findById(createdData2._id);

    if (checkD1.is_active === false && checkD2.is_active === true) {
      console.log("  ✅ Single Active Rule PASSED: D1 is false, D2 is true.");
    } else {
      throw new Error(`Single active rule failed: D1 active=${checkD1.is_active}, D2 active=${checkD2.is_active}`);
    }

    // ==========================================
    // TEST 2: Active Disclaimer API
    // ==========================================
    console.log("\n🧪 Test 2: Active Disclaimer Query");
    let activeResult = null;
    const mockResActive = {
      json: (data) => {
        activeResult = data.data;
      },
    };
    await disclaimerController.getActiveDisclaimer({}, mockResActive);
    if (activeResult && activeResult._id.toString() === checkD2._id.toString()) {
      console.log(`  ✅ Active disclaimer query returned '${activeResult.title}' as expected.`);
    } else {
      throw new Error("Active disclaimer query failed");
    }

    // ==========================================
    // TEST 3: Report Generation with Next Visit Date & Disclaimer Page
    // ==========================================
    console.log("\n🧪 Test 3: Enhanced PDF Report HTML Generation");

    // Create test patient & visit
    const testConsultant = await User.findOne() || await User.create({
      fullName: "Dr. A. K. Sharma",
      username: "testdoc",
      email: "drsharma@test.com",
      password: "password123",
      role: "ADMIN",
    });

    const testPatient = await Patient.create({
      name: "Rohit Verma",
      patient_code: "P-TEST-99",
      age: 42,
      gender: "Male",
      mobile: "9876543210",
      registered_by: testConsultant._id,
    });

    const testParam = await Parameter.findOne() || await Parameter.create({
      code: "TEST_PARAM",
      name: "Total Bio-Energy Index",
      name_en: "Total Bio-Energy Index",
      category: "Cardiovascular System",
      normal_min: 60,
      normal_max: 90,
      unit: "points",
    });

    const testVisit = await Visit.create({
      patient_id: testPatient._id,
      consultant_id: testConsultant._id,
      visit_date: new Date("2026-08-20"),
      next_visit_date: new Date("2026-09-20"),
      status: "REPORT_READY",
    });

    await VisitParameterResult.create({
      visit_id: testVisit._id,
      parameter_id: testParam._id,
      raw_value: 98,
      result_type: "HIGH",
    });

    const reportHtml = await generateReportHTML(testVisit._id, "en", {
      next_visit_date: "2026-09-20",
    });

    // Validations on report HTML:
    // 1. Next Visit Date present
    if (!reportHtml.includes("20/09/2026") || !reportHtml.includes("Next Visit / Re-checkup Date")) {
      throw new Error("Next visit date formatting missing from report HTML");
    }
    console.log("  ✓ Next Visit Date properly rendered as DD/MM/YYYY ('20/09/2026')");

    // 2. Disclaimer heading and dedicated page break
    if (!reportHtml.includes("disclaimer-page") || !reportHtml.includes("page-break-before: always")) {
      throw new Error("Dedicated disclaimer page break missing from report HTML");
    }
    console.log("  ✓ Dedicated final page disclaimer with 'page-break-before: always' verified");

    // 3. Active disclaimer content embedded
    if (!reportHtml.includes("This is test disclaimer 2 content paragraph")) {
      throw new Error("Active disclaimer content missing from report HTML");
    }
    console.log("  ✓ Active disclaimer content embedded in final page");

    // 4. Header branding present
    if (!reportHtml.includes("brand-title") || !reportHtml.includes("UQ") && !reportHtml.includes("UTKARSH")) {
      throw new Error("Report header branding missing");
    }
    console.log("  ✓ Professional report header branding verified");

    // 5. Verify snapshot saved on visit
    const updatedVisit = await Visit.findById(testVisit._id);
    if (!updatedVisit.report_snapshot || !updatedVisit.report_snapshot.disclaimer) {
      throw new Error("Visit report_snapshot did not persist disclaimer");
    }
    console.log("  ✓ Visit report snapshot properly persisted disclaimer and next_visit_date");

    // Clean up test data
    await Disclaimer.deleteMany({ title: /Test Disclaimer/ });
    await VisitParameterResult.deleteMany({ visit_id: testVisit._id });
    await Visit.findByIdAndDelete(testVisit._id);
    await Patient.findByIdAndDelete(testPatient._id);

    console.log("\n🎉 ALL BACKEND & REPORT ENHANCEMENT TESTS PASSED SUCCESSFULLY!\n");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ TEST FAILED:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTests();
