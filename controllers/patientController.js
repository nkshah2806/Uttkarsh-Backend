const Patient = require("../models/Patient");
const Franchise = require("../models/Franchise");

// @desc Get patients (scoped by role/franchise)
// @route GET /api/v1/patients
exports.getPatients = async (req, res) => {
  try {
    const { search } = req.query;
    let query = { ...req.franchiseFilter };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { patient_code: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
      ];
    }

    const patients = await Patient.find(query)
      .populate("franchise_id", "name franchise_code")
      .populate("registered_by", "fullName email")
      .sort({ createdAt: -1 });

    return res.json({ success: true, count: patients.length, data: patients });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Create new patient
// @route POST /api/v1/patients
exports.createPatient = async (req, res) => {
  try {
    const { name, age, gender, mobile, franchise_id } = req.body;

    const rawFranchiseId = franchise_id && franchise_id.trim() !== "" ? franchise_id : null;
    const targetFranchiseId = rawFranchiseId || req.user.franchise_id || null;

    let fCode = "HO";
    if (targetFranchiseId) {
      const fr = await Franchise.findById(targetFranchiseId);
      if (fr) fCode = fr.franchise_code;
    }

    const count = await Patient.countDocuments({ franchise_id: targetFranchiseId });
    const nextSeq = (count + 1).toString().padStart(4, "0");
    const patient_code = `${fCode}-P${nextSeq}`;

    const patient = await Patient.create({
      patient_code,
      franchise_id: targetFranchiseId,
      name,
      age: Number(age),
      gender,
      mobile,
      registered_by: req.user._id,
    });

    return res.status(201).json({ success: true, data: patient });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
