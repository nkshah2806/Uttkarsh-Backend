const jwt = require("jsonwebtoken");
const User = require("../models/User");

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, isAdmin: user.isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

const normalizeUserForResponse = (user, token) => {
  const userResponse = user.toObject ? user.toObject() : { ...user };
  delete userResponse.password;

  const fullName = [userResponse.firstname, userResponse.lastname]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    ...userResponse,
    name: fullName || userResponse.email || "User",
    role: userResponse.isAdmin ? "admin" : "member",
    jwtToken: userResponse.jwtToken || token || "",
  };
};

exports.getUsers = async (req, res) => {
  try {
    const user = await User.find().select("-password");
    res.status(200).json({ success: true, count: user.length, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch users", error: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch user", error: error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    res.status(200).json({ success: true, data: normalizeUserForResponse(req.user) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch profile", error: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const {
      firstname,
      lastname,
      gender,
      birthDate,
      email,
      password,
      phoneNumber,
      image,
      deviceId,
      deviceName,
      fcmToken,
      isAdmin,
      jwtToken,
      otp,
      otpExpiresAt,
      isVerified,
      createdBy,
      updatedBy,
      isActive,
      age,
    } = req.body;

    if (!firstname || !email || !password || !phoneNumber) {
      return res.status(400).json({ success: false, message: "firstname, email, password and phoneNumber are required" });
    }

    const user = await User.create({
      firstname,
      lastname,
      gender,
      birthDate,
      email,
      password,
      phoneNumber,
      image,
      deviceId,
      deviceName,
      fcmToken,
      isAdmin,
      jwtToken,
      otp,
      otpExpiresAt,
      isVerified,
      createdBy,
      updatedBy,
      isActive,
      age,
    });

    const userResponse = normalizeUserForResponse(user);

    res.status(201).json({ success: true, data: userResponse });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Email already exists" });
    }

    res.status(500).json({ success: false, message: "Failed to create user", error: error.message });
  }
};

exports.registerUser = async (req, res) => {
  try {
    const { name, firstname, lastname, email, password, phone, phoneNumber, isAdmin, isActive } = req.body;

    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedPassword = String(password || "").trim();

    if (!normalizedEmail || !normalizedPassword) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const fullName = name || [firstname, lastname].filter(Boolean).join(" ").trim();
    const firstName = firstname || fullName.split(" ")[0] || "User";
    const lastName = lastname || fullName.split(" ").slice(1).join(" ") || "";

    const user = await User.create({
      firstname: firstName,
      lastname: lastName,
      email: normalizedEmail,
      password: normalizedPassword,
      phoneNumber: phoneNumber || phone || "0000000000",
      isAdmin: Boolean(isAdmin),
      isActive: isActive !== false,
    });

    const token = generateToken(user);
    const userResponse = normalizeUserForResponse(user, token);

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      jwtToken: token,
      user: userResponse,
      data: userResponse,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Email already exists" });
    }

    res.status(500).json({ success: false, message: "Registration failed", error: error.message });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password, emailOrPhone, phone, phoneNumber } = req.body;
    const loginIdentifier = emailOrPhone || email || phone || phoneNumber;

    if (!loginIdentifier || !password) {
      return res.status(400).json({ success: false, message: "Email or phone and password are required" });
    }

    const user = await User.findOne({
      $or: [
        { email: String(loginIdentifier).toLowerCase() },
        { phoneNumber: String(loginIdentifier) },
      ],
    }).select("+password");

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const isAdminRoute = req.baseUrl?.includes("/user") || req.originalUrl?.includes("/user/");

    if (isAdminRoute) {
      if (!user.isAdmin) {
        return res.status(403).json({ success: false, message: "Only admin users can login here" });
      }
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: "Account is inactive" });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const token = generateToken(user);
    const userResponse = normalizeUserForResponse(user, token);

    res.status(200).json({
      success: true,
      message: isAdminRoute ? "Admin login successful" : "Login successful",
      token,
      jwtToken: token,
      user: userResponse,
      data: userResponse,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Login failed", error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const updateFields = [
      "firstname",
      "lastname",
      "gender",
      "birthDate",
      "email",
      "password",
      "phoneNumber",
      "image",
      "deviceId",
      "deviceName",
      "fcmToken",
      "isAdmin",
      "jwtToken",
      "otp",
      "otpExpiresAt",
      "isVerified",
      "createdBy",
      "updatedBy",
      "isActive",
      "age",
    ];

    const updateData = {};
    updateFields.forEach((f) => {
      if (req.body[f] !== undefined) updateData[f] = req.body[f];
    });

    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Email already exists" });
    }

    res.status(500).json({ success: false, message: "Failed to update user", error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete user", error: error.message });
  }
};
