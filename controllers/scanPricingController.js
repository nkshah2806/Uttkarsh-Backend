const ScanPricing = require("../models/ScanPricing");
const Visit = require("../models/Visit");

// Ensures at most one ACTIVE pricing is flagged as default, and that a default
// always exists whenever at least one active pricing is present:
//  - one active pricing  → it becomes the default
//  - multiple actives    → the existing default is kept, otherwise the
//    earliest-created active pricing is promoted
const ensureSingleDefault = async () => {
    const active = await ScanPricing.find({ is_active: true }).sort({ createdAt: 1 });
    if (active.length === 0) return;

    if (active.length === 1) {
        if (!active[0].is_default) {
            await ScanPricing.findByIdAndUpdate(active[0]._id, { $set: { is_default: true } });
        }
        return;
    }

    const defaultPricing = active.find((p) => p.is_default) || active[0];
    await ScanPricing.updateMany(
        { _id: { $ne: defaultPricing._id }, is_default: true },
        { $set: { is_default: false } }
    );
    if (!defaultPricing.is_default) {
        await ScanPricing.findByIdAndUpdate(defaultPricing._id, { $set: { is_default: true } });
    }
};

// @desc Get all scan pricings (admin listing)
// @route GET /api/v1/scan-pricing
const getScanPricings = async (req, res) => {
    try {
        const pricings = await ScanPricing.find({}).sort({ createdAt: -1 });
        return res.json({ success: true, count: pricings.length, data: pricings });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get a single scan pricing by ID
// @route GET /api/v1/scan-pricing/:id
const getScanPricingById = async (req, res) => {
    try {
        const pricing = await ScanPricing.findById(req.params.id);
        if (!pricing) {
            return res.status(404).json({ success: false, message: "Scan pricing not found" });
        }
        return res.json({ success: true, data: pricing });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get active scan pricings (used by members when starting a new scan)
// @route GET /api/v1/scan-pricing/active
const getActiveScanPricings = async (req, res) => {
    try {
        const pricings = await ScanPricing.find({ is_active: true }).sort({ createdAt: -1 });
        return res.json({ success: true, count: pricings.length, data: pricings });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Create a scan pricing (admin only)
// @route POST /api/v1/scan-pricing
const createScanPricing = async (req, res) => {
    try {
        const { name, amount } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: "Pricing name is required" });
        }
        if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) < 0) {
            return res.status(400).json({ success: false, message: "A valid pricing amount is required" });
        }

        const existing = await ScanPricing.findOne({
            name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
        });
        if (existing) {
            return res.status(400).json({ success: false, message: "A pricing with this name already exists" });
        }

        const requestedDefault = req.body.is_default === true;
        const requestedActive = req.body.is_active !== false;
        const activeCount = await ScanPricing.countDocuments({ is_active: true });

        // If this would be the first (or only) active pricing, force it active+default
        let isActive = requestedActive;
        let isDefault = requestedDefault;
        if (activeCount === 0) {
            isActive = true;
            isDefault = true;
        } else if (isDefault) {
            // New default → clear previous defaults
            await ScanPricing.updateMany({ is_default: true }, { $set: { is_default: false } });
        }

        const pricing = await ScanPricing.create({
            name: name.trim(),
            description: req.body.description || "",
            amount: Number(amount),
            is_active: isActive,
            is_default: isDefault,
        });

        if (isActive) await ensureSingleDefault(pricing._id);

        return res.status(201).json({ success: true, data: pricing });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// @desc Update a scan pricing (admin only)
// @route PUT /api/v1/scan-pricing/:id
const updateScanPricing = async (req, res) => {
    try {
        const pricing = await ScanPricing.findById(req.params.id);
        if (!pricing) {
            return res.status(404).json({ success: false, message: "Scan pricing not found" });
        }

        const payload = {};
        if (req.body.name !== undefined) {
            if (!req.body.name.trim()) {
                return res.status(400).json({ success: false, message: "Pricing name cannot be empty" });
            }
            const existing = await ScanPricing.findOne({
                _id: { $ne: req.params.id },
                name: { $regex: new RegExp(`^${req.body.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
            });
            if (existing) {
                return res.status(400).json({ success: false, message: "A pricing with this name already exists" });
            }
            payload.name = req.body.name.trim();
        }
        if (req.body.description !== undefined) payload.description = req.body.description;
        if (req.body.amount !== undefined) {
            if (isNaN(Number(req.body.amount)) || Number(req.body.amount) < 0) {
                return res.status(400).json({ success: false, message: "A valid pricing amount is required" });
            }
            payload.amount = Number(req.body.amount);
        }
        if (typeof req.body.is_active === "boolean") payload.is_active = req.body.is_active;
        if (typeof req.body.is_default === "boolean") payload.is_default = req.body.is_default;

        const updated = await ScanPricing.findByIdAndUpdate(
            req.params.id,
            payload,
            { new: true, runValidators: true }
        );

        if (updated.is_default) {
            // Only one default allowed → clear all others
            await ScanPricing.updateMany(
                { _id: { $ne: updated._id }, is_default: true },
                { $set: { is_default: false } }
            );
        } else {
            await ensureSingleDefault(updated._id);
        }

        return res.json({ success: true, data: updated });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// @desc Delete a scan pricing (admin only). When existing visits reference the
//       pricing the record is soft-deactivated so history amounts stay intact.
// @route DELETE /api/v1/scan-pricing/:id
const deleteScanPricing = async (req, res) => {
    try {
        const pricing = await ScanPricing.findById(req.params.id);
        if (!pricing) {
            return res.status(404).json({ success: false, message: "Scan pricing not found" });
        }

        const usedByVisits = await Visit.countDocuments({
            "scan_pricing.pricing_id": pricing._id,
        });

        if (usedByVisits > 0) {
            await ScanPricing.findByIdAndUpdate(pricing._id, { $set: { is_active: false, is_default: false } });
            await ensureSingleDefault(pricing._id);
            return res.json({
                success: true,
                message: "Scan pricing is in use by previous scans, so it was deactivated instead of deleted",
                data: { deactivated: true },
            });
        }

        await ScanPricing.findByIdAndDelete(pricing._id);
        await ensureSingleDefault(pricing._id);
        return res.json({ success: true, message: "Scan pricing deleted successfully", data: { deactivated: false } });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getScanPricings,
    getScanPricingById,
    getActiveScanPricings,
    createScanPricing,
    updateScanPricing,
    deleteScanPricing,
};
