const Franchise = require("../models/Franchise");
const SubscriptionPlan = require("../models/SubscriptionPlan");
const User = require("../models/User");

// @desc Get all franchises
// @route GET /api/v1/admin/franchises
exports.getFranchises = async (req, res) => {
  try {
    const franchises = await Franchise.find().populate("plan_id").sort({ createdAt: -1 });
    return res.json({ success: true, count: franchises.length, data: franchises });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Create new franchise
// @route POST /api/v1/admin/franchises
exports.createFranchise = async (req, res) => {
  try {
    const { franchise_code, name, owner_name, address, phone, email, royalty_percent } = req.body;
    const existing = await Franchise.findOne({ franchise_code: franchise_code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: "Franchise code already exists" });
    }

    const franchise = await Franchise.create({
      franchise_code: franchise_code.toUpperCase(),
      name,
      owner_name,
      address,
      phone,
      email,
      royalty_percent: royalty_percent || 10,
    });

    return res.status(201).json({ success: true, data: franchise });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc Update franchise status
// @route PATCH /api/v1/admin/franchises/:id/status
exports.updateFranchiseStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const franchise = await Franchise.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!franchise) return res.status(404).json({ success: false, message: "Franchise not found" });
    return res.json({ success: true, data: franchise });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
