const Patient = require("../models/Patient");
const User = require("../models/User");
const Visit = require("../models/Visit");
const VisitParameterResult = require("../models/VisitParameterResult");
const VisitSelectedContent = require("../models/VisitSelectedContent");
const Report = require("../models/Report");
const { isAdminUser } = require("../middleware/authMiddleware");

// Returns true when the requesting user is allowed to access the given patient.
// Admins can access every patient; non-admin members may only access patients
// they personally registered (registered_by === user._id).
const canAccessPatient = (req, patient) => {
  if (!patient) return false;
  if (isAdminUser(req.user)) return true;
  const registeredById =
    patient.registered_by?._id?.toString() ||
    patient.registered_by?.toString();
  return registeredById === String(req.user._id);
};

// @desc Get patients (scoped by role/franchise or member filter) with latest visit stats
// @route GET /api/v1/patients
exports.getPatients = async (req, res) => {
  try {
    const { search, registered_by } = req.query;
    let query = { ...req.franchiseFilter };

    // Non-admin members can never override the scope with a registered_by
    // query param (prevents fetching other members' patients via URL/API).
    if (registered_by && isAdminUser(req.user)) {
      query.registered_by = registered_by;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { patient_code: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const patients = await Patient.find(query)
      .populate("registered_by", "fullName email username role phoneNumber mobileNumber")
      .sort({ createdAt: -1 });

    if (patients.length === 0) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const patientIds = patients.map((p) => p._id);
    const latestVisits = await Visit.aggregate([
      { $match: { patient_id: { $in: patientIds } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$patient_id",
          latest_status: { $first: "$status" },
          latest_visit_date: { $first: "$visit_date" },
          total_visits: { $sum: 1 },
          latest_visit_id: { $first: "$_id" },
        },
      },
    ]);
    const visitMap = new Map(latestVisits.map((v) => [v._id.toString(), v]));

    const enrichedPatients = patients.map((p) => {
      const vInfo = visitMap.get(p._id.toString());
      return {
        ...p.toObject(),
        latest_status: vInfo ? vInfo.latest_status : "REGISTERED",
        total_visits: vInfo ? vInfo.total_visits : 0,
        latest_visit_date: vInfo ? vInfo.latest_visit_date : null,
        latest_visit_id: vInfo ? vInfo.latest_visit_id : null,
      };
    });

    return res.json({ success: true, count: enrichedPatients.length, data: enrichedPatients });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get single patient details with complete visit & report history
// @route GET /api/v1/patients/:id
exports.getPatientById = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id).populate(
      "registered_by",
      "fullName email username role phoneNumber mobileNumber"
    );

    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    // Enforce ownership: non-admin members can only view their own patients
    if (!canAccessPatient(req, patient)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this patient",
      });
    }

    // Fetch all visits for this patient
    const visits = await Visit.find({ patient_id: patient._id })
      .populate("consultant_id", "fullName email username role")
      .sort({ createdAt: -1 });

    // Aggregate metrics for each visit in history
    const visitHistory = await Promise.all(
      visits.map(async (v) => {
        const results = await VisitParameterResult.find({ visit_id: v._id });
        const totalParams = results.length;
        const abnormalParams = results.filter(
          (r) => r.result_type === "LOW" || r.result_type === "HIGH"
        ).length;
        const normalParams = results.filter((r) => r.result_type === "NORMAL").length;

        const selectedContentCount = await VisitSelectedContent.countDocuments({
          visit_id: v._id,
          is_selected: true,
        });

        const reports = await Report.find({ visit_id: v._id }).sort({ createdAt: -1 });

        return {
          _id: v._id,
          visit_date: v.visit_date || v.createdAt,
          next_visit_date: v.next_visit_date || v.report_snapshot?.next_visit_date || null,
          createdAt: v.createdAt,
          status: v.status,
          consultant: v.consultant_id,
          report_type: "Quantum Full Body Resonance Analysis",
          total_parameters: totalParams,
          normal_parameters: normalParams,
          abnormal_parameters: abnormalParams,
          selected_content_count: selectedContentCount,
          reports: reports,
          latest_report_id: reports.length > 0 ? reports[0]._id : null,
          disclaimer: v.report_snapshot?.disclaimer || null,
        };
      })
    );

    return res.json({
      success: true,
      data: {
        patient,
        visits: visitHistory,
        stats: {
          total_scans: visitHistory.length,
          last_scan_date: visitHistory.length > 0 ? visitHistory[0].visit_date : null,
          latest_status: visitHistory.length > 0 ? visitHistory[0].status : "REGISTERED",
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Create new patient (Franchise Member only)
// @route POST /api/v1/patients
exports.createPatient = async (req, res) => {
  try {
    const {
      name,
      age,
      gender,
      mobile,
      dob,
      email,
      weight,
      weight_unit,
      height,
      height_unit,
      address,
    } = req.body;

    if (!name || !age || !gender || !mobile) {
      return res.status(400).json({
        success: false,
        message: "Name, age, gender, and mobile are required",
      });
    }

    // Weight and height validations if provided
    const parsedWeight = weight !== undefined && weight !== "" && weight !== null ? Number(weight) : null;
    const parsedHeight = height !== undefined && height !== "" && height !== null ? Number(height) : null;

    if (parsedWeight !== null && (isNaN(parsedWeight) || parsedWeight <= 0 || parsedWeight > 500)) {
      return res.status(400).json({
        success: false,
        message: "Weight must be a valid positive number up to 500",
      });
    }

    if (parsedHeight !== null && (isNaN(parsedHeight) || parsedHeight <= 0 || parsedHeight > 300)) {
      return res.status(400).json({
        success: false,
        message: "Height must be a valid positive number up to 300",
      });
    }

    const count = await Patient.countDocuments();
    const nextSeq = (count + 1).toString().padStart(4, "0");
    const patient_code = `P${nextSeq}`;

    const patient = await Patient.create({
      patient_code,
      name: String(name).trim(),
      age: Number(age),
      gender,
      mobile: String(mobile).trim(),
      dob: dob ? new Date(dob) : null,
      email: email ? String(email).trim().toLowerCase() : "",
      weight: parsedWeight,
      weight_unit: weight_unit || "kg",
      height: parsedHeight,
      height_unit: height_unit || "cm",
      address: address ? String(address).trim() : "",
      registered_by: req.user._id,
      franchise_id: req.user.franchise_id || null,
    });

    const populatedPatient = await Patient.findById(patient._id).populate(
      "registered_by",
      "fullName email username role phoneNumber mobileNumber"
    );

    return res.status(201).json({ success: true, data: populatedPatient });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc Update existing patient
// @route PUT /api/v1/patients/:id
exports.updatePatient = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    // Enforce ownership: non-admin members can only update their own patients
    if (!canAccessPatient(req, patient)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this patient",
      });
    }

    const {
      name,
      age,
      gender,
      mobile,
      dob,
      email,
      weight,
      weight_unit,
      height,
      height_unit,
      address,
    } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (age !== undefined) updates.age = Number(age);
    if (gender !== undefined) updates.gender = gender;
    if (mobile !== undefined) updates.mobile = String(mobile).trim();
    if (dob !== undefined) updates.dob = dob ? new Date(dob) : null;
    if (email !== undefined) updates.email = String(email).trim().toLowerCase();

    if (weight !== undefined) {
      const parsedWeight = weight !== "" && weight !== null ? Number(weight) : null;
      if (parsedWeight !== null && (isNaN(parsedWeight) || parsedWeight <= 0 || parsedWeight > 500)) {
        return res.status(400).json({ success: false, message: "Weight must be a valid positive number up to 500" });
      }
      updates.weight = parsedWeight;
    }
    if (weight_unit !== undefined) updates.weight_unit = weight_unit || "kg";

    if (height !== undefined) {
      const parsedHeight = height !== "" && height !== null ? Number(height) : null;
      if (parsedHeight !== null && (isNaN(parsedHeight) || parsedHeight <= 0 || parsedHeight > 300)) {
        return res.status(400).json({ success: false, message: "Height must be a valid positive number up to 300" });
      }
      updates.height = parsedHeight;
    }
    if (height_unit !== undefined) updates.height_unit = height_unit || "cm";

    if (address !== undefined) updates.address = String(address).trim();

    const updatedPatient = await Patient.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate("registered_by", "fullName email username role phoneNumber mobileNumber");

    return res.json({ success: true, data: updatedPatient });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc Delete patient
// @route DELETE /api/v1/patients/:id
exports.deletePatient = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    // Enforce ownership: non-admin members can only delete their own patients
    if (!canAccessPatient(req, patient)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this patient",
      });
    }

    await Patient.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: "Patient record deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};



