const express = require("express");
const {
  getUsers,
  getUserById,
  getMe,
  createUser,
  loginUser,
  registerUser,
  updateUser,
  deleteUser,
  approveUser,
  getMemberPortalPassword,
  uploadProfileImage,
} = require("../controllers/userController");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { uploadSingle } = require("../middleware/multer");

const router = express.Router();

// Public routes
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", protect, getMe);

// Profile picture upload (member or admin; validates image type/size via the
// shared multer pipeline and stores under /uploads/users/).
router.post("/uploadProfileImage", protect, uploadSingle("profileImage", { folder: "users" }), uploadProfileImage);

// User management routes.
// Listing, creating, approving and deleting users is admin-only.
// getUsers returns all users (admin) or only the current member (non-admin).
// getUserById and updateUser allow admins, or a member acting on their own
// record (e.g. language preference persistence in the member panel).
router.get("/", protect, getUsers);
// Admin-only: decrypt and return the member's portal login password.
// MUST be declared before the generic `/:id` route so `:id` does not match it.
router.get("/:id/portal-password", protect, adminOnly, getMemberPortalPassword);
router.get("/:id", protect, getUserById);
router.post("/", protect, adminOnly, createUser);
router.put("/update", protect, updateUser);
router.put("/:id", protect, updateUser);
router.patch("/:id/approve", protect, adminOnly, approveUser);
router.delete("/:id", protect, adminOnly, deleteUser);

module.exports = router;
