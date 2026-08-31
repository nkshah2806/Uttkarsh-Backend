const MemberProfile = require("../models/MemberProfile");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const passwordCryptoService = require("../services/passwordCryptoService");

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
          approval_status: "pending",
          rejection_reason: "",
          submitted_for_approval: false,
          submitted_at: null,
          reviewed_by: null,
          reviewed_at: null,
          is_active: req.user.isActive !== false,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...profile.toObject ? profile.toObject() : profile,
        is_active: req.user.isActive !== false,
      },
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

    // Check duplicate email or phone for other profiles.
    // A conflicting profile only blocks the save when its owner (the linked
    // User record) still exists. Profiles left behind by deleted users are
    // orphaned and must not prevent a new member from using their own phone
    // number / email address, so they are cleaned up automatically instead.
    const ownerStillExists = async (profile) =>
      Boolean(profile && (await User.exists({ _id: profile.user })));

    const existingPhone = await MemberProfile.findOne({
      phone,
      user: { $ne: userId },
    });
    if (existingPhone) {
      if (await ownerStillExists(existingPhone)) {
        return res.status(400).json({
          success: false,
          message: "Phone number is already associated with another member profile",
        });
      }
      // Owner no longer exists → orphaned profile, remove it and continue.
      await MemberProfile.deleteOne({ _id: existingPhone._id });
    }

    const existingEmail = await MemberProfile.findOne({
      email: email.toLowerCase(),
      user: { $ne: userId },
    });
    if (existingEmail) {
      if (await ownerStillExists(existingEmail)) {
        return res.status(400).json({
          success: false,
          message: "Email address is already associated with another member profile",
        });
      }
      // Owner no longer exists → orphaned profile, remove it and continue.
      await MemberProfile.deleteOne({ _id: existingEmail._id });
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
        // Reversibly encrypted copy so an admin can view the member's portal
        // password from the Admin User Details page.
        user.passwordEncrypted = passwordCryptoService.encrypt(password);
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

    // Approval workflow transitions:
    // - Saving profile details always (re)submits the profile for admin approval.
    // - A completed profile moves to "pending"; any edit (even to an approved or
    //   rejected profile) returns it to the approval workflow and clears the
    //   previous review outcome so the admin must review the latest submission.
    const approval_status = profile_completed ? "pending" : existingProfile?.approval_status || "pending";
    const submitted_for_approval = profile_completed;
    const submitted_at = profile_completed ? new Date() : existingProfile?.submitted_at || null;

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
      approval_status,
      submitted_for_approval,
      submitted_at,
      // Clear any previous review outcome whenever the member resubmits/edits the profile
      rejection_reason: profile_completed ? "" : (existingProfile?.rejection_reason || ""),
      reviewed_by: profile_completed ? null : (existingProfile?.reviewed_by || null),
      reviewed_at: profile_completed ? null : (existingProfile?.reviewed_at || null),
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

/**
 * GET /api/member/profile/admin/members
 * Admin only. Lists member profiles with approval status so the admin can
 * review submissions. Supports filtering by status via query param (?status=).
 */
exports.getMemberProfilesForAdmin = async (req, res) => {
  try {
    const { status } = req.query;

    const filter = {};
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      filter.approval_status = status;
    }

    const profiles = await MemberProfile.find(filter)
      .populate("user", "fullName email role isActive isAdmin")
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: profiles.length,
      data: profiles,
    });
  } catch (error) {
    console.error("Error listing member profiles for admin:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch member profiles",
    });
  }
};

/**
 * GET /api/member/profile/admin/members/:id
 * Admin only. Returns the full member profile (with user) for the review screen.
 */
exports.getMemberProfileForAdmin = async (req, res) => {
  try {
    const profile = await MemberProfile.findById(req.params.id)
      .populate("user", "fullName email role phoneNumber mobileNumber isActive isAdmin language_pref")
      .lean();

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Member profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error("Error fetching member profile for admin:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch member profile",
    });
  }
};

/**
 * PATCH /api/member/profile/admin/members/:id/review
 * Admin only. Approves or rejects a member's submitted profile.
 * Body: { action: "approved" | "rejected", rejection_reason?: string }
 */
exports.reviewMemberProfile = async (req, res) => {
  try {
    const { action, rejection_reason } = req.body;

    if (!action || !["approved", "rejected"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Use 'approved' or 'rejected'",
      });
    }

    const profile = await MemberProfile.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Member profile not found",
      });
    }

    if (!profile.submitted_for_approval && !profile.profile_completed) {
      return res.status(400).json({
        success: false,
        message: "This member profile is not complete and cannot be reviewed",
      });
    }

    const adminUserId = req.user._id || req.user.id;

    if (action === "rejected") {
      const reason = (rejection_reason || "").toString().trim();
      if (!reason) {
        return res.status(400).json({
          success: false,
          message: "A rejection reason is required when rejecting a profile",
        });
      }
      profile.approval_status = "rejected";
      profile.rejection_reason = reason;
    } else {
      profile.approval_status = "approved";
      profile.rejection_reason = "";
    }

    profile.reviewed_by = adminUserId;
    profile.reviewed_at = new Date();

    await profile.save();

    // Keep the User record's language preference flag consistent is not needed here,
    // but ensure the linked user remains active once approved.
    if (action === "approved") {
      await User.findByIdAndUpdate(profile.user, { isActive: true });
    }

    return res.status(200).json({
      success: true,
      message:
        action === "approved"
          ? "Member profile approved successfully"
          : "Member profile rejected",
      data: profile,
    });
  } catch (error) {
    console.error("Error reviewing member profile:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to review member profile",
    });
  }
};

/**
 * GET /api/member/profile/admin/user/:userId
 * Admin only. Returns the member profile linked to a given User record, or a
 * 404 when the user has not yet completed their franchise profile. Used by the
 * Admin User Details page to show Franchise Information.
 */
exports.getMemberProfileByUserForAdmin = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const profile = await MemberProfile.findOne({ user: userId })
      .populate("user", "fullName email role phoneNumber mobileNumber isActive isAdmin language_pref approval_status")
      .lean();

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "No franchise profile found for this user",
      });
    }

    return res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error("Error fetching member profile by user:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch member profile",
    });
  }
};
