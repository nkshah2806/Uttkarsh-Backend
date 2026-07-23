const jwt = require("jsonwebtoken");
const Member = require("../models/Member");

const createMemberToken = (member) => {
  return jwt.sign(
    { role: "member", memberId: member._id },
    process.env.MEMBER_JWT_SECRET,
    { expiresIn: "1d" }
  );
};

const sendMemberResponse = (res, statusCode, message, payload = {}) => {
  res.status(statusCode).json({ success: statusCode < 400, message, ...payload });
};

exports.registerMember = async (req, res) => {
  try {
    const { fullName, mobileNumber, email, address, city, state, pinCode, password } = req.body;

    if (!fullName || !mobileNumber || !email || !address || !city || !state || !pinCode || !password) {
      return sendMemberResponse(res, 400, "All fields are required");
    }

    if (!/^\d{10}$/.test(String(mobileNumber))) {
      return sendMemberResponse(res, 400, "Mobile number must be exactly 10 digits");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email))) {
      return sendMemberResponse(res, 400, "Enter a valid email address");
    }

    if (!/^\d{6}$/.test(String(pinCode))) {
      return sendMemberResponse(res, 400, "Pin code must be exactly 6 digits");
    }

    if (String(password).length < 8) {
      return sendMemberResponse(res, 400, "Password must be at least 8 characters");
    }

    const existingMember = await Member.findOne({ $or: [{ mobileNumber: String(mobileNumber) }, { email: String(email).toLowerCase() }] });
    if (existingMember) {
      return sendMemberResponse(res, 409, "Member with this mobile number or email already exists");
    }

    const member = await Member.create({
      fullName,
      mobileNumber: String(mobileNumber),
      email: String(email).toLowerCase(),
      address,
      city,
      state,
      pinCode: String(pinCode),
      password,
    });

    const token = createMemberToken(member);
    return sendMemberResponse(res, 201, "Registration successful", { token, member: { _id: member._id, fullName: member.fullName, mobileNumber: member.mobileNumber, email: member.email } });
  } catch (error) {
    return sendMemberResponse(res, 500, "Registration failed", { error: error.message });
  }
};

exports.loginMember = async (req, res) => {
  try {
    const { mobileNumber, password } = req.body;

    if (!mobileNumber || !password) {
      return sendMemberResponse(res, 400, "Mobile number and password are required");
    }

    const member = await Member.findOne({ mobileNumber: String(mobileNumber) }).select("+password");

    if (!member) {
      return sendMemberResponse(res, 401, "Invalid mobile number or password");
    }

    const isMatch = await member.comparePassword(password);
    if (!isMatch) {
      return sendMemberResponse(res, 401, "Invalid mobile number or password");
    }

    const token = createMemberToken(member);
    return sendMemberResponse(res, 200, "Login successful", { token, member: { _id: member._id, fullName: member.fullName, mobileNumber: member.mobileNumber, email: member.email } });
  } catch (error) {
    return sendMemberResponse(res, 500, "Login failed", { error: error.message });
  }
};

exports.getMembers = async (req, res) => {
  try {
    const members = await Member.find().sort({ createdAt: -1 });
    return sendMemberResponse(res, 200, "Members fetched successfully", { members });
  } catch (error) {
    return sendMemberResponse(res, 500, "Failed to fetch members", { error: error.message });
  }
};
