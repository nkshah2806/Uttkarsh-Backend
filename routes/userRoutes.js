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
router.get("/", getUsers);
router.get("/:id", getUserById);
router.post("/", createUser);
router.put("/update", updateUser);
router.put("/:id", updateUser);
router.delete("/:id", protect, adminOnly, deleteUser);

module.exports = router;
