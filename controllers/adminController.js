const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

const createAdminToken = (admin) => {
  return jwt.sign(
    { role: "admin", adminId: admin._id },
    process.env.ADMIN_JWT_SECRET,
    { expiresIn: "1d" }
  );
};

const sendAdminResponse = (res, statusCode, message, payload = {}) => {
  res.status(statusCode).json({ success: statusCode < 400, message, ...payload });
};

exports.loginAdmin = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const loginIdentifier = username || email;

    if (!loginIdentifier || !password) {
      return sendAdminResponse(res, 400, "Username/email and password are required");
    }

    const admin = await Admin.findOne({ $or: [{ username: String(loginIdentifier).toLowerCase() }, { email: String(loginIdentifier).toLowerCase() }] }).select("+password");

    if (!admin) {
      return sendAdminResponse(res, 401, "Invalid credentials");
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return sendAdminResponse(res, 401, "Invalid credentials");
    }

    const token = createAdminToken(admin);
    return sendAdminResponse(res, 200, "Admin login successful", { token, admin: { _id: admin._id, username: admin.username, email: admin.email } });
  } catch (error) {
    return sendAdminResponse(res, 500, "Admin login failed", { error: error.message });
  }
};
