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
    return res.status(401).json({ success: false, message: "Not authorized, no token provided" });
  }

  try {
    const secret = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET || process.env.MEMBER_JWT_SECRET;
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      try {
        decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
      } catch (err2) {
        decoded = jwt.verify(token, process.env.MEMBER_JWT_SECRET);
      }
    }

    const userId = decoded.id || decoded.adminId || decoded.memberId;
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    req.user = user;
    req.member = user;
    req.admin = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

exports.adminOnly = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }

  if (!req.user.isActive) {
    return res.status(403).json({ success: false, message: "Admin account is inactive" });
  }

  next();
};

exports.verifyMemberToken = exports.protect;

exports.verifyAdminToken = (req, res, next) => {
  exports.protect(req, res, () => {
    exports.adminOnly(req, res, next);
  });
};
