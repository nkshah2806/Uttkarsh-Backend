const MemberProfile = require("../models/MemberProfile");
const User = require("../models/User");
const bcrypt = require("bcryptjs");

// Generate helper codes
const generateDistributorId = (userId) => {
  const shortId = userId ? userId.toString().slice(-6).toUpperCase() : Math.floor(100000 + Math.random() * 900000);
  return `DIST-${shortId}`;
};

const generateFranchiseCode = () => {
  return `FR-${Math.floor(100000 + Math.random() * 900000)}`;
};

/**
 * GET /api/member/profile
 * Returns logged-in member's profile.
 */
exports.getMemberProfile = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    let profile = await MemberProfile.findOne({ user: userId });

    if (!profile) {
      // Draft pre-filled payload for first-time profile completion
      const defaultDistId = generateDistributorId(userId);
      const defaultFranchiseCode = generateFranchiseCode();

      return res.status(200).json({
        success: true,
        message: "Profile draft generated",
        data: {
          user: userId,
          member_id: userId.toString(),
          distributor_id: defaultDistId,
          member_name: req.user.fullName || req.user.name || "",
          branch_name: "",
          store_name: "",
          state: req.user.state || "",
          city: req.user.city || "",
          district: "",
          area: "",
          franchise_type: "Standard Distributor",
          under_group: "General Group",
          franchise_code: defaultFranchiseCode,
          contact_person: req.user.fullName || req.user.name || "",
          phone: req.user.mobileNumber || req.user.phoneNumber || "",
          email: req.user.email || "",
          address: req.user.address || "",
          pincode: req.user.pinCode || "",
          account_name: "",
          bank_name: "",
          account_number: "",
          account_type: "Savings",
          ifsc_code: "",
          branch_address: "",
          profile_completed: false,
          completion_percentage: 0,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error("Error fetching member profile:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch member profile",
    });
  }
};

/**
 * POST /api/member/profile or PUT /api/member/profile
 * Creates or updates member profile information.
 */
exports.createOrUpdateProfile = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const {
      member_name,
      branch_name,
      store_name,
      state,
      city,
      district,
      area,
      franchise_type,
      under_group,
      contact_person,
      phone,
      email,
      address,
      pincode,
      account_name,
      bank_name,
      account_number,
      account_type,
      ifsc_code,
      branch_address,
      password,
      confirm_password,
    } = req.body;

    // Server-side field validation
    if (!member_name || !state || !city || !district || !contact_person || !phone || !email || !address || !pincode) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all required Franchise & Personal details",
      });
    }

    if (!account_name || !bank_name || !account_number || !account_type || !ifsc_code) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all required Bank details",
      });
    }

    // Format validations
    if (!/^[0-9]{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Phone number must be exactly 10 digits",
      });
    }

    if (!/^[0-9]{6}$/.test(pincode)) {
      return res.status(400).json({
        success: false,
        message: "PIN Code must be exactly 6 digits",
      });
    }

    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(ifsc_code.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid IFSC Code format (e.g. SBIN0001234)",
      });
    }

    // Check duplicate email or phone for other profiles
    const existingPhone = await MemberProfile.findOne({
      phone,
      user: { $ne: userId },
    });
    if (existingPhone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is already associated with another member profile",
      });
    }

    const existingEmail = await MemberProfile.findOne({
      email: email.toLowerCase(),
      user: { $ne: userId },
    });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: "Email address is already associated with another member profile",
      });
    }

    // Optional Password update handling
    if (password && password.trim() !== "") {
      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 8 characters long",
        });
      }
      if (confirm_password && password !== confirm_password) {
        return res.status(400).json({
          success: false,
          message: "Password and Confirm Password do not match",
        });
      }

      // Hash & save on User model
      const user = await User.findById(userId);
      if (user) {
        user.password = password;
        await user.save();
      }
    }

    // Find existing or create codes
    let existingProfile = await MemberProfile.findOne({ user: userId });
    const distributor_id = existingProfile?.distributor_id || generateDistributorId(userId);
    const franchise_code = existingProfile?.franchise_code || generateFranchiseCode();

    // Required fields check for completion
    const requiredCheck = [
      member_name,
      state,
      city,
      district,
      contact_person,
      phone,
      email,
      address,
      pincode,
      account_name,
      bank_name,
      account_number,
      account_type,
      ifsc_code,
    ];

    const filledCount = requiredCheck.filter((val) => val && String(val).trim().length > 0).length;
    const completion_percentage = Math.round((filledCount / requiredCheck.length) * 100);
    const profile_completed = filledCount === requiredCheck.length;

    const updatePayload = {
      user: userId,
      member_id: userId.toString(),
      distributor_id,
      member_name,
      branch_name: branch_name || "",
      store_name: store_name || "",
      state,
      city,
      district,
      area: area || "",
      franchise_type: franchise_type || "Standard Distributor",
      under_group: under_group || "General Group",
      franchise_code,
      contact_person,
      phone,
      email: email.toLowerCase(),
      address,
      pincode,
      account_name,
      bank_name,
      account_number,
      account_type,
      ifsc_code: ifsc_code.toUpperCase(),
      branch_address: branch_address || "",
      profile_completed,
      completion_percentage,
    };

    const savedProfile = await MemberProfile.findOneAndUpdate(
      { user: userId },
      updatePayload,
      { new: true, upsert: true, runValidators: true }
    );

    // Sync basic details back to User model as well
    await User.findByIdAndUpdate(userId, {
      fullName: member_name,
      email: email.toLowerCase(),
      phoneNumber: phone,
      mobileNumber: phone,
      address,
      city,
      state,
      pinCode: pincode,
    });

    return res.status(200).json({
      success: true,
      message: "Member Profile completed and saved successfully!",
      data: savedProfile,
    });
  } catch (error) {
    console.error("Error saving member profile:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to save member profile",
    });
  }
};
