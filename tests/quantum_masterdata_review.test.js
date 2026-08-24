const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const envConfig = require("../config/environment.json");
Object.entries(envConfig).forEach(([key, value]) => {
  process.env[key] = value;
});

const User = require("../models/User");
const Patient = require("../models/Patient");
const Parameter = require("../models/Parameter");
const Visit = require("../models/Visit");
const VisitParameterResult = require("../models/VisitParameterResult");
const VisitSelectedContent = require("../models/VisitSelectedContent");
const { parseContent, validateContent } = require("../services/contentParser");
const masterDataController = require("../controllers/masterDataController");
const visitController = require("../controllers/visitController");
const { generateAutoAnalysis } = require("../services/analysisEngine");
const { generateReportHTML } = require("../services/pdfReportService");

async function runTests() {
  console.log("===============================================================");
  console.log("🧪 QUANTUM PARAMETER MASTER DATA & REPORT REVIEW TEST SUITE");
  console.log("===============================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  const createMockRes = () => {
    const res = {
      statusCode: 200,
      data: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.data = payload;
        return this;
      },
    };
    return res;
  };

  try {
    const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017/uttkarsh_db";
    await mongoose.connect(mongoUrl, { dbName: "uttkarsh_db" });
    console.log(" Connected to MongoDB");

    // Drop legacy index if exists on visitselectedcontents
    try {
      await mongoose.connection.collection("visitselectedcontents").dropIndex("visit_id_1_parameter_master_content_id_1");
      console.log(" Dropped obsolete legacy index visit_id_1_parameter_master_content_id_1");
    } catch (e) {
      // index might not exist
    }

    // Clean up past test artifacts if any
    await Parameter.deleteMany({ code: { $in: ["TEST_VISC_01", "TEST_VISC_01_COPY", "TEST_VISC_01_COPY2"] } });

    // Seed test admin & test member
    const testAdmin = await User.findOneAndUpdate(
      { email: "test_admin_quantum@uttkarsh.com" },
      {
        fullName: "Test Admin Quantum",
        username: "test_admin_quantum",
        email: "test_admin_quantum@uttkarsh.com",
        password: "password123",
        isAdmin: true,
        role: "ADMIN",
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // ---------------------------------------------------------------------------------
    // TEST 1: CONTENT PARSER AST GENERATION
    // ---------------------------------------------------------------------------------
    console.log("\n📌 Test 1: Content Parser AST generation & validation");
    const sampleRawText = `1. Definition & Overview
* Blood viscosity refers to the thickness of blood.
* High viscosity may affect blood flow.

2. Possible Factors
* Dehydration
* Smoking
  * Second-hand smoke exposure
* High blood sugar

3. Ayurvedic Recommendations
* Maintain adequate hydration.
* Follow a healthy lifestyle.`;

    const parsedNodes = parseContent(sampleRawText, "en");
    assert(parsedNodes.length > 0, `Parsed ${parsedNodes.length} nodes from raw text`);

    const sections = parsedNodes.filter((n) => n.level === 0);
    assert(sections.length === 3, `Identified 3 sections (Found: ${sections.length})`);
    assert(sections[0].content.includes("Definition"), `Section 1 title is "${sections[0].content}"`);

    const subBullets = parsedNodes.filter((n) => n.level === 2);
    assert(subBullets.length === 1, `Identified 1 indented sub-bullet (Found: ${subBullets.length})`);
    assert(subBullets[0].content.includes("Second-hand smoke"), `Sub-bullet text is: "${subBullets[0].content}"`);

    const diagnostics = validateContent(sampleRawText);
    assert(diagnostics.isValid === true, "Validation confirmed content is structurally valid");
    assert(diagnostics.bulletsCount === 7, `Counted ${diagnostics.bulletsCount} primary bullets`);

    // ---------------------------------------------------------------------------------
    // TEST 2: CREATE PARAMETER WITH PARSED CONTENT & VERSION 1
    // ---------------------------------------------------------------------------------
    console.log("\n📌 Test 2: Create Quantum Parameter with multi-line raw content & Version 1");
    const reqCreate = {
      user: testAdmin,
      body: {
        code: "TEST_VISC_01",
        name_en: "Test Blood Viscosity",
        name_hi: "टेस्ट रक्त चिपचिपाहट",
        unit: "mPa.s",
        normal_min: 4.1,
        normal_max: 5.2,
        category: "Cardiovascular System",
        description: "Measures internal resistance of blood flow.",
        raw_content_en: sampleRawText,
        raw_content_hi: `1. परिभाषा
* रक्त की चिपचिपाहट गाढ़ेपन को दर्शाती है।

2. सावधानियां
* पर्याप्त पानी पिएं।`,
        status: "PUBLISHED",
      },
    };
    const resCreate = createMockRes();
    await masterDataController.createParameter(reqCreate, resCreate);

    assert(resCreate.statusCode === 201, `Parameter created with status ${resCreate.statusCode}`);
    const createdParam = resCreate.data?.data;
    assert(createdParam?.version === 1, `Initial version is v${createdParam?.version}`);
    assert(createdParam?.parsed_nodes_en?.length > 0, `Stored ${createdParam?.parsed_nodes_en?.length} parsed English nodes`);
    assert(createdParam?.version_history?.length === 1, `Version history has 1 record`);

    // ---------------------------------------------------------------------------------
    // TEST 3: UPDATE PARAMETER CONTENT & INCREMENT VERSION TO v2
    // ---------------------------------------------------------------------------------
    console.log("\n📌 Test 3: Update Parameter content and verify Version increment to v2");
    const updatedRawText = sampleRawText + "\n* Avoid excessive refined sugar.";
    const reqUpdate = {
      user: testAdmin,
      params: { id: String(createdParam._id) },
      body: {
        raw_content_en: updatedRawText,
      },
    };
    const resUpdate = createMockRes();
    await masterDataController.updateParameter(reqUpdate, resUpdate);

    assert(resUpdate.statusCode === 200, `Parameter updated with status ${resUpdate.statusCode}`);
    const updatedParam = resUpdate.data?.data;
    assert(updatedParam?.version === 2, `Version incremented to v${updatedParam?.version} (Expected v2)`);
    assert(updatedParam?.version_history?.length === 2, `Version history contains ${updatedParam?.version_history?.length} records`);

    // ---------------------------------------------------------------------------------
    // TEST 4: DUPLICATE PARAMETER
    // ---------------------------------------------------------------------------------
    console.log("\n📌 Test 4: Duplicate Parameter");
    const reqDup = {
      user: testAdmin,
      params: { id: String(createdParam._id) },
    };
    const resDup = createMockRes();
    await masterDataController.duplicateParameter(reqDup, resDup);

    assert(resDup.statusCode === 201, `Duplicate returned status ${resDup.statusCode}`);
    const duplicatedParam = resDup.data?.data;
    assert(duplicatedParam?.code === "TEST_VISC_01_COPY", `Cloned code is ${duplicatedParam?.code}`);
    assert(duplicatedParam?.version === 1, `Clone reset to version 1`);

    // ---------------------------------------------------------------------------------
    // TEST 5: VISIT AUTO ANALYSIS WITH HIERARCHICAL NODES
    // ---------------------------------------------------------------------------------
    console.log("\n📌 Test 5: Visit Auto Analysis returns structured Sections & Bullets");
    // Create test patient and visit
    const testPatient = await Patient.create({
      patient_code: `PTEST_${Date.now().toString().slice(-4)}`,
      name: "Test Analysis Patient",
      age: 48,
      gender: "Male",
      mobile: "9876500000",
      weight: 72,
      height: 170,
      address: "Test Address, Jaipur",
      registered_by: testAdmin._id,
    });

    const testVisit = await Visit.create({
      patient_id: testPatient._id,
      consultant_id: testAdmin._id,
      status: "DATA_ENTRY",
    });

    // Enter abnormal result for TEST_VISC_01 (value 5.9 > normal_max 5.2 => HIGH)
    await VisitParameterResult.create({
      visit_id: testVisit._id,
      parameter_id: createdParam._id,
      raw_value: 5.9,
      result_type: "HIGH",
    });

    const analysis = await generateAutoAnalysis(testVisit._id);
    assert(analysis.analyzed_items.length === 1, `Analysis found 1 abnormal parameter`);
    const analyzedItem = analysis.analyzed_items[0];
    assert(analyzedItem.sections.length >= 3, `Parameter has ${analyzedItem.sections.length} structured sections`);
    assert(analyzedItem.sections[0].items.length > 0, `Section 1 has ${analyzedItem.sections[0].items.length} child items`);

    // ---------------------------------------------------------------------------------
    // TEST 6: MEMBER NODE SELECTIONS OVERRIDE
    // ---------------------------------------------------------------------------------
    console.log("\n📌 Test 6: Member selection overrides saving");
    const sec1Item1 = analyzedItem.sections[0].items[0];
    const sec1Item2 = analyzedItem.sections[0].items[1];

    // Select Item 1, Deselect Item 2
    const reqSelection = {
      params: { id: String(testVisit._id) },
      body: {
        selections: [
          { parameter_id: createdParam._id, node_id: sec1Item1.id, is_selected: true },
          { parameter_id: createdParam._id, node_id: sec1Item2.id, is_selected: false },
        ],
      },
    };
    const resSelection = createMockRes();
    await visitController.updateSelectedContent(reqSelection, resSelection);

    assert(resSelection.statusCode === 200, `Selections updated with status ${resSelection.statusCode} (${resSelection.data?.message || 'OK'})`);

    // Verify in re-analysis that selection state persisted
    const analysisAfter = await generateAutoAnalysis(testVisit._id);
    const item1After = analysisAfter.analyzed_items[0].sections[0].items.find((it) => it.id === sec1Item1.id);
    const item2After = analysisAfter.analyzed_items[0].sections[0].items.find((it) => it.id === sec1Item2.id);

    assert(item1After.is_selected === true, `Item 1 selection state is true`);
    assert(item2After.is_selected === false, `Item 2 selection state is false`);

    // ---------------------------------------------------------------------------------
    // TEST 7: FINAL REPORT GENERATION & FROZEN SNAPSHOT
    // ---------------------------------------------------------------------------------
    console.log("\n📌 Test 7: Final Report Generation only includes selected content & saves snapshot");
    const reportHtml = await generateReportHTML(testVisit._id, "en");

    assert(reportHtml.includes(item1After.text_en), `Report includes selected item: "${item1After.text_en}"`);
    assert(!reportHtml.includes(item2After.text_en), `Report EXCLUDES unselected item: "${item2After.text_en}"`);

    const finalizedVisit = await Visit.findById(testVisit._id);
    assert(finalizedVisit.report_snapshot?.report_html !== undefined, `Report snapshot saved in Visit record`);
    assert(finalizedVisit.report_snapshot?.parameters?.length > 0, `Snapshot contains parameter records`);

    // Clean up test data
    await Patient.findByIdAndDelete(testPatient._id);
    await Visit.findByIdAndDelete(testVisit._id);
    await VisitParameterResult.deleteMany({ visit_id: testVisit._id });
    await VisitSelectedContent.deleteMany({ visit_id: testVisit._id });
    await Parameter.deleteMany({ code: { $in: ["TEST_VISC_01", "TEST_VISC_01_COPY", "TEST_VISC_01_COPY2"] } });

  } catch (err) {
    console.error("Test execution error:", err);
    failed++;
  } finally {
    await mongoose.disconnect();
    console.log("\n===============================================================");
    console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("===============================================================");
    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runTests();
