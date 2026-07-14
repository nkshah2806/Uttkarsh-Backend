const jwt = require("jsonwebtoken");
const User = require("../models/User");

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
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
    res.status(200).json({ success: true, data: req.user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch profile", error: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, phone, status } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email, and password are required" });
    }

    const user = await User.create({ name, email, password, role, phone, status });
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({ success: true, data: userResponse });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Email already exists" });
    }

    res.status(500).json({ success: false, message: "Failed to create user", error: error.message });
  }
};

exports.loginAdmin = async (req, res) => {
  try {
    const { email, password, emailOrPhone, phone } = req.body;
    const loginIdentifier = emailOrPhone || email || phone;

    if (!loginIdentifier || !password) {
      return res.status(400).json({ success: false, message: "Email or phone and password are required" });
    }

    const user = await User.findOne({
      $or: [
        { email: String(loginIdentifier).toLowerCase() },
        { phone: String(loginIdentifier) },
      ],
    }).select("+password");

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    if (user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admin users can login here" });
    }

    if (user.status !== "active") {
      return res.status(403).json({ success: false, message: "Admin account is inactive" });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const token = generateToken(user);
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      success: true,
      message: "Admin login successful",
      token,
      jwtToken: token,
      data: {
        ...userResponse,
        jwtToken: token,
        isAdmin: user.role === "admin",
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Admin login failed", error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { name, email, password, role, phone, status } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) updateData.password = password;
    if (role) updateData.role = role;
    if (phone !== undefined) updateData.phone = phone;
    if (status) updateData.status = status;

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
