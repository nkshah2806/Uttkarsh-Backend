const express = require("express");
const { loginAdmin } = require("../controllers/adminController");
const { getMembers } = require("../controllers/memberController");
const { verifyAdminToken } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", loginAdmin);
router.get("/members", verifyAdminToken, getMembers);

module.exports = router;
