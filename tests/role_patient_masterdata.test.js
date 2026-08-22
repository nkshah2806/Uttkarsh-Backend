const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();

const envConfig = require("../config/environment.json");
Object.entries(envConfig).forEach(([key, value]) => {
  process.env[key] = value;
});

const User = require("../models/User");
const Patient = require("../models/Patient");
const Parameter = require("../models/Parameter");
const ParameterMasterContent = require("../models/ParameterMasterContent");
const patientController = require("../controllers/patientController");
const masterDataController = require("../controllers/masterDataController");

async function runTests() {
  console.log("==================================================");
  console.log("🧪 STARTING ROLE-BASED & PATIENT / MASTER DATA TESTS");
  console.log("==================================================");

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

  try {
    const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017/uttkarsh_db";
    await mongoose.connect(mongoUrl, { dbName: "uttkarsh_db" });
    console.log(" Connected to test database");

    // Seed test users
    const testAdmin = await User.findOneAndUpdate(
      { email: "test_admin@uttkarsh.com" },
      {
        fullName: "Test Admin",
        username: "test_admin",
        email: "test_admin@uttkarsh.com",
        password: "password123",
        isAdmin: true,
        role: "ADMIN",
        isActive: true,
      },
      { upsert: true, new: true }
    );

    const testMember = await User.findOneAndUpdate(
      { email: "test_member@uttkarsh.com" },
      {
        fullName: "Test Franchise Member",
        username: "test_member",
        email: "test_member@uttkarsh.com",
        password: "password123",
        isAdmin: false,
        role: "FRANCHISE",
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // Mock Response Helper
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

    // TEST 1: Patient registration for any logged-in user
    console.log("\n📌 Test 1: Patient registration for logged-in user");
    const reqAdminCreate = {
      user: testAdmin,
      body: {
        name: "Admin Patient Registration",
        age: 30,
        gender: "Male",
        mobile: "9998887770",
      },
    };
    const resAdminCreate = createMockRes();
    await patientController.createPatient(reqAdminCreate, resAdminCreate);
    assert(
      resAdminCreate.statusCode === 201,
      `Patient registration returned HTTP ${resAdminCreate.statusCode} (Expected 201)`
    );
    assert(
      resAdminCreate.data?.success === true,
      "Response indicates success: true"
    );
    if (resAdminCreate.data?.data?._id) {
      await Patient.findByIdAndDelete(resAdminCreate.data.data._id);
    }

    // TEST 2: Franchise Member registration with Weight, Height, Address
    console.log("\n📌 Test 2: Member patient registration with Weight, Height, Address");
    const reqMemberCreate = {
      user: testMember,
      body: {
        name: "Test Patient Member Reg",
        age: 45,
        gender: "Female",
        mobile: "9876543210",
        weight: 68.5,
        weight_unit: "kg",
        height: 165,
        height_unit: "cm",
        address: "123 Healthcare Way, Jaipur",
      },
    };
    const resMemberCreate = createMockRes();
    await patientController.createPatient(reqMemberCreate, resMemberCreate);
    assert(
      resMemberCreate.statusCode === 201,
      `Member patient registration returned HTTP ${resMemberCreate.statusCode} (Expected 201)`
    );
    assert(
      resMemberCreate.data?.data?.weight === 68.5,
      `Weight saved as ${resMemberCreate.data?.data?.weight}`
    );
    assert(
      resMemberCreate.data?.data?.height === 165,
      `Height saved as ${resMemberCreate.data?.data?.height}`
    );
    assert(
      resMemberCreate.data?.data?.address === "123 Healthcare Way, Jaipur",
      `Address saved as ${resMemberCreate.data?.data?.address}`
    );
    assert(
      String(resMemberCreate.data?.data?.registered_by?._id || resMemberCreate.data?.data?.registered_by) === String(testMember._id),
      "Registered By correctly set to Member ID"
    );

    const createdPatientId = resMemberCreate.data?.data?._id;

    // TEST 3: Admin patient list shows "Registered By" details and supports filter
    console.log("\n📌 Test 3: Admin patient list view and member filter");
    const reqAdminGet = {
      user: testAdmin,
      query: { registered_by: String(testMember._id) },
    };
    const resAdminGet = createMockRes();
    await patientController.getPatients(reqAdminGet, resAdminGet);
    assert(
      resAdminGet.statusCode === 200,
      `Get patients returned HTTP ${resAdminGet.statusCode}`
    );
    assert(
      resAdminGet.data?.count > 0,
      `Found ${resAdminGet.data?.count} patients for member`
    );
    const foundPatient = resAdminGet.data?.data?.find(
      (p) => String(p._id) === String(createdPatientId)
    );
    assert(
      foundPatient && foundPatient.registered_by?.fullName === "Test Franchise Member",
      "Patient populated with registered_by member name"
    );

    // TEST 4: Master Data Edit & Delete controls
    console.log("\n📌 Test 4: Master Data Parameter & Content Edit & Delete");
    // Create temp test parameter
    const testParam = await Parameter.create({
      code: "TEST_P001",
      name_en: "Test Parameter EN",
      name_hi: "Test Parameter HI",
      unit: "mg/dL",
      normal_min: 10,
      normal_max: 50,
      category: "Test",
    });

    const testContent = await ParameterMasterContent.create({
      parameter_id: testParam._id,
      result_type: "HIGH",
      content_type: "PROBLEM",
      text_en: "High Test Problem",
      text_hi: "उच्च परीक्षण समस्या",
      priority: 1,
    });

    // Update Parameter
    const reqUpdateParam = {
      params: { id: String(testParam._id) },
      body: { name_en: "Updated Test Parameter EN", normal_max: 60 },
    };
    const resUpdateParam = createMockRes();
    await masterDataController.updateParameter(reqUpdateParam, resUpdateParam);
    assert(
      resUpdateParam.statusCode === 200 && resUpdateParam.data?.data?.normal_max === 60,
      "Parameter updated successfully"
    );

    // Update Content
    const reqUpdateContent = {
      params: { contentId: String(testContent._id) },
      body: { text_en: "Updated High Test Problem" },
    };
    const resUpdateContent = createMockRes();
    await masterDataController.updateParameterContent(reqUpdateContent, resUpdateContent);
    assert(
      resUpdateContent.statusCode === 200 && resUpdateContent.data?.data?.text_en === "Updated High Test Problem",
      "Master content bullet updated successfully"
    );

    // Delete Content
    const reqDeleteContent = {
      params: { contentId: String(testContent._id) },
    };
    const resDeleteContent = createMockRes();
    await masterDataController.deleteParameterContent(reqDeleteContent, resDeleteContent);
    assert(
      resDeleteContent.statusCode === 200,
      "Master content bullet deleted successfully"
    );

    // Delete Parameter
    const reqDeleteParam = {
      params: { id: String(testParam._id) },
    };
    const resDeleteParam = createMockRes();
    await masterDataController.deleteParameter(reqDeleteParam, resDeleteParam);
    assert(
      resDeleteParam.statusCode === 200,
      "Parameter deleted successfully"
    );

    // TEST 5: Member Patient Update & Delete
    console.log("\n📌 Test 5: Member Patient Edit & Delete");
    const reqUpdatePatient = {
      user: testMember,
      params: { id: String(createdPatientId) },
      body: {
        name: "Test Patient Member Reg (Updated)",
        weight: 70,
        height: 168,
        address: "456 Updated Address, Jaipur",
      },
    };
    const resUpdatePatient = createMockRes();
    await patientController.updatePatient(reqUpdatePatient, resUpdatePatient);
    assert(
      resUpdatePatient.statusCode === 200 && resUpdatePatient.data?.data?.name === "Test Patient Member Reg (Updated)",
      `Patient details updated successfully (Name: ${resUpdatePatient.data?.data?.name})`
    );
    assert(
      resUpdatePatient.data?.data?.weight === 70 && resUpdatePatient.data?.data?.height === 168,
      "Updated Weight and Height saved successfully"
    );

    const reqDeletePatient = {
      user: testMember,
      params: { id: String(createdPatientId) },
    };
    const resDeletePatient = createMockRes();
    await patientController.deletePatient(reqDeletePatient, resDeletePatient);
    assert(
      resDeletePatient.statusCode === 200 && resDeletePatient.data?.success === true,
      "Patient record deleted successfully"
    );

  } catch (err) {
    console.error("Test execution error:", err);
    failed++;
  } finally {
    await mongoose.disconnect();
    console.log("\n==================================================");
    console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");
    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runTests();
