const Medicine = require("../models/Medicine");
const Visit = require("../models/Visit");

// @desc    Get all medicines
// @route   GET /api/v1/admin/medicines
// @access  Private (admin + authenticated users)
const getMedicines = async (req, res) => {
    try {
        const medicines = await Medicine.find({}).sort({ createdAt: -1 });
        return res.json({ success: true, count: medicines.length, data: medicines });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch medicines", error: error.message });
    }
};

// @desc    Get single medicine by ID
// @route   GET /api/v1/admin/medicines/:id
// @access  Private (admin + authenticated users)
const getMedicineById = async (req, res) => {
    try {
        const medicine = await Medicine.findById(req.params.id);
        if (!medicine) {
            return res.status(404).json({ success: false, message: "Medicine not found" });
        }
        return res.json({ success: true, data: medicine });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch medicine", error: error.message });
    }
};

// @desc    Create new medicine
// @route   POST /api/v1/admin/medicines
// @access  Admin only
const createMedicine = async (req, res) => {
    try {
        const { name, details, dosage } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: "Medicine name is required." });
        }

        const normalizedName = name.trim();
        const existing = await Medicine.findOne({
            name: { $regex: `^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
        });
        if (existing) {
            return res.status(400).json({ success: false, message: "Medicine with this name already exists." });
        }

        const medicine = await Medicine.create({
            name: normalizedName,
            details: details || "",
            dosage: dosage || "",
            is_active: true,
        });

        return res.status(201).json({ success: true, data: medicine });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to create medicine", error: error.message });
    }
};

// @desc    Update medicine
// @route   PUT /api/v1/admin/medicines/:id
// @access  Admin only
const updateMedicine = async (req, res) => {
    try {
        const { name, details, dosage, is_active } = req.body;

        if (name) {
            const normalizedName = name.trim();
            const existing = await Medicine.findOne({
                _id: { $ne: req.params.id },
                name: { $regex: `^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
            });
            if (existing) {
                return res.status(400).json({ success: false, message: "Medicine with this name already exists." });
            }
        }

        const updated = await Medicine.findByIdAndUpdate(
            req.params.id,
            {
                ...(name && { name: name.trim() }),
                ...(details !== undefined && { details: details || "" }),
                ...(dosage !== undefined && { dosage: dosage || "" }),
                ...(typeof is_active === "boolean" && { is_active }),
            },
            { new: true, runValidators: true }
        );

        if (!updated) {
            return res.status(404).json({ success: false, message: "Medicine not found" });
        }
        return res.json({ success: true, data: updated });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to update medicine", error: error.message });
    }
};

// @desc    Delete medicine (soft-delete via is_active flag)
// @route   DELETE /api/v1/admin/medicines/:id
// @access  Admin only
const deleteMedicine = async (req, res) => {
    try {
        const medicine = await Medicine.findById(req.params.id);
        if (!medicine) {
            return res.status(404).json({ success: false, message: "Medicine not found" });
        }

        // Prevent hard-delete if any report/visit still references this medicine
        const usedCount = await Visit.countDocuments({
            "medicines.medicine_id": medicine._id,
        });
        if (usedCount > 0) {
            // Soft-delete: deactivate so existing reports keep their snapshot data
            await Medicine.findByIdAndUpdate(req.params.id, { is_active: false });
            return res.json({
                success: true,
                message: `Medicine "${medicine.name}" is referenced by ${usedCount} report(s) and has been deactivated instead of deleted.`,
            });
        }

        await Medicine.findByIdAndDelete(req.params.id);
        return res.json({ success: true, message: "Medicine deleted successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to delete medicine", error: error.message });
    }
};

module.exports = {
    getMedicines,
    getMedicineById,
    createMedicine,
    updateMedicine,
    deleteMedicine,
};
