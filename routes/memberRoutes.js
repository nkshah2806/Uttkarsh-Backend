const express = require("express");
const { registerMember, loginMember, getMembers } = require("../controllers/memberController");
const { verifyAdminToken, verifyMemberToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerMember);
router.post("/login", loginMember);
router.get("/", verifyAdminToken, getMembers);
router.get("/me", verifyMemberToken, (req, res) => res.json({ success: true, member: req.member }));

module.exports = router;
