const jwt = require("jsonwebtoken");
const User = require("../models/User");

const getTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.split(" ")[1];
};

exports.protect = async (req, res, next) => {
  const token = getTokenFromHeader(req);
  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Not authorized, no token provided" });
  }

  try {
    let decoded;
    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "default-jwt-secret"
      );
    } catch (err) {
      try {
        decoded = jwt.verify(
          token,
          process.env.ADMIN_JWT_SECRET || "default-jwt-secret"
        );
      } catch (err2) {
        decoded = jwt.verify(
          token,
          process.env.MEMBER_JWT_SECRET || "default-jwt-secret"
        );
      }
    }

    const userId = decoded.id || decoded.adminId || decoded.memberId;
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    req.user = user;
    req.member = user;
    req.admin = user;

    // Set default data scope filter based on user role.
    // Admins see all records. Non-admin members (Franchise, Consultant,
    // Operator, Trainer, Patient) see ONLY the patients they personally
    // registered (via `registered_by`). This is enforced at the database
    // level so direct ID/URL manipulation cannot bypass it.
    const isAdminUser =
      user.isAdmin ||
      user.role === "SUPER_ADMIN" ||
      user.role === "ADMIN";

    if (isAdminUser) {
      req.franchiseFilter = {};
    } else {
      // Franchise members ONLY see patients registered by them
      req.franchiseFilter = { registered_by: user._id };
    }

    next();
  } catch (error) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }
};

exports.adminOnly = (req, res, next) => {
  if (
    !req.user ||
    (!req.user.isAdmin &&
      req.user.role !== "SUPER_ADMIN" &&
      req.user.role !== "ADMIN")
  ) {
    return res
      .status(403)
      .json({ success: false, message: "Admin access required" });
  }

  if (!req.user.isActive) {
    return res
      .status(403)
      .json({ success: false, message: "Admin account is inactive" });
  }

  next();
};

exports.requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
    }

    // Admins always pass role checks
    if (
      req.user.isAdmin ||
      req.user.role === "SUPER_ADMIN" ||
      req.user.role === "ADMIN"
    ) {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized for this route`,
      });
    }

    next();
  };
};

exports.verifyMemberToken = exports.protect;

exports.verifyAdminToken = (req, res, next) => {
  exports.protect(req, res, () => {
    exports.adminOnly(req, res, next);
  });
};

/**
 * approvedMemberOnly
 * Restricts non-admin members (Franchise, Consultant, Operator, Trainer,
 * Patient) from accessing business routes until their MemberProfile is
 * complete AND approved by an admin. Admins always pass.
 *
 * This is the backend guard for the "Profile completion & admin approval"
 * workflow: even if a member manually navigates to a protected URL or calls
 * the API directly with a valid token, they are blocked until approved.
 */
exports.approvedMemberOnly = async (req, res, next) => {
  if (exports.isAdminUser(req.user)) {
    return next();
  }

  try {
    const MemberProfile = require("../models/MemberProfile");
    const profile = await MemberProfile.findOne({ user: req.user._id }).lean();

    const profile_completed = Boolean(profile?.profile_completed);
    const approval_status = profile?.approval_status || "pending";

    if (!profile_completed || approval_status !== "approved") {
      return res.status(403).json({
        success: false,
        message:
          approval_status === "rejected"
            ? "Your member profile was rejected. Please review the rejection reason and resubmit your profile."
            : "Your member profile is pending admin approval. Please complete your profile and wait for approval.",
        code: "MEMBER_PROFILE_NOT_APPROVED",
        approval_status,
        profile_completed,
      });
    }

    next();
  } catch (error) {
    console.error("Error in approvedMemberOnly middleware:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to verify member profile approval status",
    });
  }
};

// Helper: returns true when the authenticated user is an admin (SUPER_ADMIN / ADMIN / isAdmin).
exports.isAdminUser = (user) => {
  if (!user) return false;
  return (
    Boolean(user.isAdmin) ||
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN"
  );
};
