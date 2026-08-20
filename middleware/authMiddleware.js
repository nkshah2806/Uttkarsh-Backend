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

    // Set default franchise scope filter based on user role
    const isAdminUser =
      user.isAdmin ||
      user.role === "SUPER_ADMIN" ||
      user.role === "ADMIN";

    if (isAdminUser) {
      req.franchiseFilter = {};
    } else if (user.franchise_id) {
      req.franchiseFilter = { franchise_id: user.franchise_id };
    } else {
      req.franchiseFilter = { _id: null }; // block unassigned non-admins
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
