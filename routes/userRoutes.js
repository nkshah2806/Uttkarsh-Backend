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
} = require("../controllers/userController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", protect, getMe);
router.get("/", protect, adminOnly, getUsers);
router.get("/:id", protect, adminOnly, getUserById);
router.post("/", protect, adminOnly, createUser);
router.put("/:id", protect, adminOnly, updateUser);
router.delete("/:id", protect, adminOnly, deleteUser);

module.exports = router;
