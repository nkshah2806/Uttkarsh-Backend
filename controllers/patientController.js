const Patient = require("../models/Patient");
const User = require("../models/User");

// @desc Get patients (scoped by role/franchise or member filter)
// @route GET /api/v1/patients
exports.getPatients = async (req, res) => {
  try {
    const { search, registered_by } = req.query;
    let query = { ...req.franchiseFilter };

    if (registered_by) {
      query.registered_by = registered_by;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { patient_code: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
      ];
    }

    const patients = await Patient.find(query)
      .populate("registered_by", "fullName email username role")
      .sort({ createdAt: -1 });

    return res.json({ success: true, count: patients.length, data: patients });
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
    const parsedWeight = weight !== undefined && weight !== "" ? Number(weight) : null;
    const parsedHeight = height !== undefined && height !== "" ? Number(height) : null;

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
      name,
      age: Number(age),
      gender,
      mobile: String(mobile).trim(),
      weight: parsedWeight,
      weight_unit: weight_unit || "kg",
      height: parsedHeight,
      height_unit: height_unit || "cm",
      address: address ? String(address).trim() : "",
      registered_by: req.user._id,
    });

    const populatedPatient = await Patient.findById(patient._id).populate(
      "registered_by",
      "fullName email username role"
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

    const {
      name,
      age,
      gender,
      mobile,
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
    ).populate("registered_by", "fullName email username role");

    return res.json({ success: true, data: updatedPatient });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc Delete patient
// @route DELETE /api/v1/patients/:id
exports.deletePatient = async (req, res) => {
  try {
    const patient = await Patient.findByIdAndDelete(req.params.id);
    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }
    return res.json({ success: true, message: "Patient record deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


