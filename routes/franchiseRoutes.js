const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");
const {
  getFranchises,
  createFranchise,
  updateFranchiseStatus,
} = require("../controllers/franchiseController");

router.use(protect);
router.use(adminOnly);

router.route("/").get(getFranchises).post(createFranchise);
router.route("/:id/status").patch(updateFranchiseStatus);

module.exports = router;
