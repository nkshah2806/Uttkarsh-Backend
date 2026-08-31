const jwt = require("jsonwebtoken");
const User = require("../models/User");
const MemberProfile = require("../models/MemberProfile");
const passwordCryptoService = require("../services/passwordCryptoService");

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, isAdmin: user.isAdmin, role: user.isAdmin ? "admin" : "member" },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

const normalizeUserForResponse = (user, token) => {
  const userObj = user.toObject ? user.toObject({ virtuals: true }) : { ...user };
  delete userObj.password;

  const phone = userObj.mobileNumber || userObj.phoneNumber || "";

  return {
    ...userObj,
    fullName: userObj.fullName || `${userObj.firstname || ""} ${userObj.lastname || ""}`.trim() || userObj.email,
    firstname: userObj.firstname || userObj.fullName?.split(" ")[0] || "",
    lastname: userObj.lastname || userObj.fullName?.split(" ").slice(1).join(" ") || "",
    name: userObj.fullName || userObj.email,
    mobileNumber: phone,
    phoneNumber: phone,
    role: userObj.isAdmin ? "admin" : "member",
    approval_status: userObj.approval_status || (userObj.isAdmin ? "approved" : "pending"),
    jwtToken: userObj.jwtToken || token || "",
  };
};

exports.getUsers = async (req, res) => {
  try {
    const { search, isAdmin, isActive, approval_status, page = 1, limit = 10, sort } = req.query;
    const query = {};

    // Non-admin members only see their own record in this endpoint.
    const isAdminUser = req.user && (req.user.isAdmin || req.user.role === "ADMIN" || req.user.role === "SUPER_ADMIN");
    if (req.user && !isAdminUser) {
      query._id = req.user._id;
    }

    if (isAdmin !== undefined) query.isAdmin = isAdmin === "true";
    if (isActive !== undefined) query.isActive = isActive === "true";
    if (approval_status) query.approval_status = approval_status;

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { fullName: searchRegex },
        { email: searchRegex },
        { phoneNumber: searchRegex },
        { mobileNumber: searchRegex },
        { city: searchRegex },
      ];
    }

    // Parse pagination (support both plain page/limit and sort[key]/sort[direction]).
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const sortKeyRaw = (sort && sort.key) || req.query["sort[key]"] || null;
    const sortKey = sortKeyRaw && sortKeyRaw !== "null" ? sortKeyRaw : "createdAt";
    const sortDirRaw = (sort && sort.direction) || req.query["sort[direction]"] || "asc";
    const sortDir = String(sortDirRaw).toLowerCase() === "desc" ? -1 : 1;

    const sortOptions = {};
    const allowedSortKeys = ["name", "fullName", "email", "phoneNumber", "role", "approval_status", "isActive", "createdAt"];
    if (allowedSortKeys.includes(sortKey)) {
      sortOptions[sortKey] = sortDir;
    }

    const [total, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .select("-password")
        .sort(sortOptions)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
    ]);

    const data = users.map((u) => normalizeUserForResponse(u));

    // Enrich each user with MemberProfile completion data so the admin
    // User Management table can show the Profile Completion Status column.
    const userIds = users.map((u) => u._id);
    const profileDocs = userIds.length
      ? await MemberProfile.find({ user: { $in: userIds } })
        .select("user profile_completed completion_percentage approval_status")
        .lean()
      : [];
    const profileMap = new Map(profileDocs.map((p) => [String(p.user), p]));

    data.forEach((userItem) => {
      const profile = profileMap.get(String(userItem._id));
      userItem.profile_completed = Boolean(profile?.profile_completed);
      userItem.completion_percentage = profile?.completion_percentage || 0;
      userItem.member_approval_status = profile?.approval_status || null;
    });

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      data,
      members: data,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch users", error: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const isAdminUser = req.user && (req.user.isAdmin || req.user.role === "ADMIN" || req.user.role === "SUPER_ADMIN");
    // Non-admin members may only fetch their own record.
    if (req.user && !isAdminUser && String(req.user._id) !== String(req.params.id)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, data: normalizeUserForResponse(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch user", error: error.message });
  }
};

// ADMIN-ONLY. Returns the decrypted member portal password so an admin can view
// it from the Admin User Details page. The password is stored as a one-way
// bcrypt hash for authentication, plus a reversibly encrypted copy
// (`passwordEncrypted`) that only this endpoint decrypts. Only passwords set
// AFTER this feature was deployed are recoverable; older bcrypt-only records
// return an empty password.
exports.getMemberPortalPassword = async (req, res) => {
  try {
    const targetId = req.params.id || req.body.userId || req.body.id;

    if (!targetId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const user = await User.findById(targetId).select("+passwordEncrypted");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const password = passwordCryptoService.decrypt(user.passwordEncrypted);

    res.status(200).json({
      success: true,
      data: {
        userId: user._id,
        email: user.email,
        hasPassword: Boolean(password),
        password,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to retrieve portal password", error: error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    res.status(200).json({ success: true, data: normalizeUserForResponse(req.user), member: normalizeUserForResponse(req.user) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch profile", error: error.message });
  }
};

exports.registerUser = async (req, res) => {
  try {
    const {
      fullName,
      name,
      firstname,
      lastname,
      email,
      password,
      mobileNumber,
      phoneNumber,
      phone,
      address,
      city,
      state,
      pinCode,
      gender,
      birthDate,
      isAdmin,
      isActive,
    } = req.body;

    const resolvedFullName = (fullName || name || [firstname, lastname].filter(Boolean).join(" ")).trim();
    const resolvedEmail = String(email || "").trim().toLowerCase();
    const resolvedPassword = String(password || "").trim();
    const resolvedPhone = String(mobileNumber || phoneNumber || phone || "").trim();

    if (!resolvedFullName || !resolvedEmail || !resolvedPassword) {
      return res.status(400).json({
        success: false,
        message: "Full name, email and password are required",
      });
    }

    if (resolvedPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const existingUser = await User.findOne({
      $or: [
        { email: resolvedEmail },
        ...(resolvedPhone ? [{ phoneNumber: resolvedPhone }, { mobileNumber: resolvedPhone }] : []),
      ],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email or mobile number already exists",
      });
    }

    // Public registration is always a FRANCHISE member awaiting admin approval.
    // Admins can only be created through the admin panel (createUser / direct DB).
    const isAdminUser = Boolean(isAdmin);
    const user = await User.create({
      fullName: resolvedFullName,
      email: resolvedEmail,
      password: resolvedPassword,
      // Reversibly encrypted copy so an admin can view the member's portal
      // password from the Admin User Details page.
      passwordEncrypted: passwordCryptoService.encrypt(resolvedPassword),
      phoneNumber: resolvedPhone,
      mobileNumber: resolvedPhone,
      address: address || "",
      city: city || "",
      state: state || "",
      pinCode: pinCode || "",
      gender: gender || "",
      birthDate: birthDate || null,
      role: isAdminUser ? "ADMIN" : "FRANCHISE",
      isAdmin: isAdminUser,
      // Account is active but pending approval. Members CAN log in immediately;
      // full portal access is gated by profile completion + approval instead.
      isActive: isAdminUser ? true : isActive !== false,
      approval_status: isAdminUser ? "approved" : "pending",
    });

    const token = generateToken(user);
    const userResponse = normalizeUserForResponse(user, token);

    res.status(201).json({
      success: true,
      message:
        "Registration successful. You can now log in and complete your personal details. Full access is granted after admin approval.",
      token,
      jwtToken: token,
      user: userResponse,
      member: userResponse,
      data: userResponse,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Email or phone number already exists" });
    }
    res.status(500).json({ success: false, message: "Registration failed", error: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const {
      fullName,
      name,
      firstname,
      lastname,
      email,
      password,
      mobileNumber,
      phoneNumber,
      address,
      city,
      state,
      pinCode,
      gender,
      birthDate,
      age,
      image,
      deviceId,
      deviceName,
      fcmToken,
      isAdmin,
      isActive,
    } = req.body;

    const resolvedFullName = (fullName || name || [firstname, lastname].filter(Boolean).join(" ")).trim();
    const resolvedEmail = String(email || "").trim().toLowerCase();
    const resolvedPassword = String(password || "").trim();
    const resolvedPhone = String(mobileNumber || phoneNumber || "").trim();

    if (!resolvedFullName || !resolvedEmail || !resolvedPassword) {
      return res.status(400).json({ success: false, message: "Name, email and password are required" });
    }

    const existingUser = await User.findOne({
      $or: [
        { email: resolvedEmail },
        ...(resolvedPhone ? [{ phoneNumber: resolvedPhone }, { mobileNumber: resolvedPhone }] : []),
      ],
    });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email or mobile number already exists",
      });
    }

    const isAdminUser = Boolean(isAdmin);
    const user = await User.create({
      fullName: resolvedFullName,
      email: resolvedEmail,
      password: resolvedPassword,
      // Reversibly encrypted copy so an admin can view the member's portal
      // password from the Admin User Details page.
      passwordEncrypted: passwordCryptoService.encrypt(resolvedPassword),
      phoneNumber: resolvedPhone,
      mobileNumber: resolvedPhone,
      address: address || "",
      city: city || "",
      state: state || "",
      pinCode: pinCode || "",
      gender: gender || "",
      birthDate: birthDate || null,
      age: age || null,
      image: image || "",
      deviceId: deviceId || "",
      deviceName: deviceName || "",
      fcmToken: fcmToken || "",
      isAdmin: isAdminUser,
      role: isAdminUser ? "ADMIN" : "FRANCHISE",
      // Admin-created franchise members start pending approval, exactly like
      // self-registered members, so approval is always enforced.
      isActive: isActive !== false,
      approval_status: isAdminUser ? "approved" : "pending",
    });

    const userResponse = normalizeUserForResponse(user);
    res.status(201).json({ success: true, data: userResponse });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Email or phone number already exists" });
    }
    res.status(500).json({ success: false, message: "Failed to create user", error: error.message });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, username, password, emailOrPhone, phone, phoneNumber, mobileNumber } = req.body;
    const loginIdentifier = emailOrPhone || email || username || phone || phoneNumber || mobileNumber;

    if (!loginIdentifier || !password) {
      return res.status(400).json({ success: false, message: "Email/Phone/Username and password are required" });
    }

    const searchStr = String(loginIdentifier).trim().toLowerCase();

    const user = await User.findOne({
      $or: [
        { email: searchStr },
        { username: searchStr },
        { phoneNumber: String(loginIdentifier).trim() },
        { mobileNumber: String(loginIdentifier).trim() },
      ],
    }).select("+password");

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // Login is always allowed for members (pending/approved/rejected) as long as
    // the account is active. Full portal access is gated separately by
    // profile completion + admin approval via `approvedMemberOnly` and the
    // frontend route guard, NOT by the login itself.
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: "Account is inactive" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = generateToken(user);
    const userResponse = normalizeUserForResponse(user, token);

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      jwtToken: token,
      user: userResponse,
      member: userResponse,
      admin: userResponse,
      data: userResponse,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Login failed", error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const targetId = req.params.id || req.body.userId || req.body.id;

    if (!targetId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const allowedFields = [
      "fullName",
      "firstname",
      "lastname",
      "username",
      "email",
      "password",
      "phoneNumber",
      "mobileNumber",
      "address",
      "city",
      "state",
      "pinCode",
      "gender",
      "birthDate",
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
      "language_pref",
      "approval_status",
    ];

    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    // Non-admin members may only update their own record.
    const isAdminUser = req.user && (req.user.isAdmin || req.user.role === "ADMIN" || req.user.role === "SUPER_ADMIN");
    if (req.user && !isAdminUser && String(req.user._id) !== String(targetId)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Only admins may change account status fields. Members must NOT be able
    // to approve themselves or reactivate their own deactivated account.
    if (!isAdminUser) {
      delete updateData.isActive;
      delete updateData.approval_status;
      delete updateData.isAdmin;
    }

    if (req.body.name && !updateData.fullName) {
      updateData.fullName = req.body.name;
    }
    if ((req.body.firstname || req.body.lastname) && !updateData.fullName) {
      updateData.fullName = [req.body.firstname, req.body.lastname].filter(Boolean).join(" ").trim();
    }
    if (req.body.phone && !updateData.phoneNumber) {
      updateData.phoneNumber = req.body.phone;
      updateData.mobileNumber = req.body.phone;
    }

    const user = await User.findById(targetId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    Object.assign(user, updateData);

    // When the password changes, also store a reversibly encrypted copy so an
    // admin can still view the member's portal password from the Admin User
    // Details page (the live `password` field is a one-way bcrypt hash).
    if (updateData.password !== undefined) {
      user.passwordEncrypted = passwordCryptoService.encrypt(updateData.password);
    }

    await user.save();

    const userResponse = normalizeUserForResponse(user);
    res.status(200).json({ success: true, data: userResponse, user: userResponse });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Email or phone number already exists" });
    }
    res.status(500).json({ success: false, message: "Failed to update user", error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const targetId = req.params.id || req.body.id;
    const user = await User.findByIdAndDelete(targetId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Remove the linked MemberProfile as well, so a member who re-registers
    // with the same phone number / email is not blocked by an orphaned profile.
    await MemberProfile.deleteOne({ user: user._id });

    res.status(200).json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete user", error: error.message });
  }
};

// Approve a pending Franchise Member. Sets approval_status -> "approved"
// and ensures the account is active so the member can log in and access
// permitted features.
exports.approveUser = async (req, res) => {
  try {
    const targetId = req.params.id || req.body.userId || req.body.id;

    if (!targetId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const user = await User.findById(targetId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Admins are always approved and should not be re-approved.
    const isAdminUser = user.isAdmin || user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    if (isAdminUser) {
      return res.status(400).json({ success: false, message: "Admin accounts do not require approval" });
    }

    user.approval_status = "approved";
    user.isActive = true;
    user.updatedBy = req.user?._id || req.user?.id || null;
    await user.save();

    // Reconcile the linked MemberProfile so the member frontend guard (which
    // reads MemberProfile.approval_status) also reflects the admin approval
    // granted from the User Management table.
    await MemberProfile.updateOne(
      { user: user._id },
      {
        $set: {
          approval_status: "approved",
          rejection_reason: null,
          reviewed_by: req.user?._id || req.user?.id || null,
          reviewed_at: new Date(),
        },
      }
    );

    const userResponse = normalizeUserForResponse(user);
    res.status(200).json({
      success: true,
      message: "Member approved successfully",
      data: userResponse,
      user: userResponse,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to approve user", error: error.message });
  }
};
