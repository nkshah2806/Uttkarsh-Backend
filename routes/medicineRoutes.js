const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");
const {
    getMedicines,
    getMedicineById,
    createMedicine,
    updateMedicine,
    deleteMedicine,
} = require("../controllers/medicineController");

// All routes require a valid token; write operations require admin role
router.use(protect);

router
    .route("/")
    .get(getMedicines)
    .post(adminOnly, createMedicine);

router
    .route("/:id")
    .get(getMedicineById)
    .put(adminOnly, updateMedicine)
    .delete(adminOnly, deleteMedicine);

module.exports = router;
