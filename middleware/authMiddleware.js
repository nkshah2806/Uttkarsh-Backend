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
    return res.status(401).json({ success: false, message: "Not authorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid token" });
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

exports.verifyMemberToken = (req, res, next) => {
  const token = getTokenFromHeader(req);
  if (!token) {
    return res.status(401).json({ success: false, message: "Not authorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.MEMBER_JWT_SECRET);
    if (decoded.role !== "member") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    req.member = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid member token" });
  }
};

exports.verifyAdminToken = (req, res, next) => {
  const token = getTokenFromHeader(req);
  if (!token) {
    return res.status(401).json({ success: false, message: "Not authorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    if (decoded.role !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid admin token" });
  }
};
