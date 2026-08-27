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
} = require("../controllers/userController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

// Public routes
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", protect, getMe);

// User management routes.
// Listing, creating, approving and deleting users is admin-only.
// getUsers returns all users (admin) or only the current member (non-admin).
// getUserById and updateUser allow admins, or a member acting on their own
// record (e.g. language preference persistence in the member panel).
router.get("/", protect, getUsers);
router.get("/:id", protect, getUserById);
router.post("/", protect, adminOnly, createUser);
router.put("/update", protect, updateUser);
router.put("/:id", protect, updateUser);
router.patch("/:id/approve", protect, adminOnly, approveUser);
router.delete("/:id", protect, adminOnly, deleteUser);

module.exports = router;
