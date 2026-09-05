const HealthCamp = require("../models/HealthCamp");

// @desc Get all health camps (admin listing includes inactive camps)
// @route GET /api/v1/health-camps
const getHealthCamps = async (req, res) => {
    try {
        const camps = await HealthCamp.find({}).sort({ date: -1 });
        return res.json({ success: true, count: camps.length, data: camps });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Get a single health camp by ID
// @route GET /api/v1/health-camps/:id
const getHealthCampById = async (req, res) => {
    try {
        const camp = await HealthCamp.findById(req.params.id);
        if (!camp) {
            return res.status(404).json({ success: false, message: "Health camp not found" });
        }
        return res.json({ success: true, data: camp });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Create a health camp (admin only)
// @route POST /api/v1/health-camps
const createHealthCamp = async (req, res) => {
    try {
        const { name, date } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: "Camp name is required" });
        }
        if (!date) {
            return res.status(400).json({ success: false, message: "Camp date is required" });
        }

        const allowedFields = [
            "name",
            "description",
            "date",
            "start_time",
            "end_time",
            "venue",
            "address",
            "city",
            "state",
            "pincode",
            "contact_person",
            "contact_number",
            "contact_email",
            "image",
            "is_active",
            "registration_required",
            "registration_limit",
            "additional_notes",
        ];

        const payload = {};
        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) payload[field] = req.body[field];
        });
        // New camps start active unless explicitly disabled
        if (req.body.is_active === undefined) payload.is_active = true;
        if (req.body.registration_required === undefined) payload.registration_required = false;

        const camp = await HealthCamp.create(payload);
        return res.status(201).json({ success: true, data: camp });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// @desc Update a health camp (admin only)
// @route PUT /api/v1/health-camps/:id
const updateHealthCamp = async (req, res) => {
    try {
        const camp = await HealthCamp.findById(req.params.id);
        if (!camp) {
            return res.status(404).json({ success: false, message: "Health camp not found" });
        }

        const { name } = req.body;
        if (name !== undefined && !name.trim()) {
            return res.status(400).json({ success: false, message: "Camp name cannot be empty" });
        }

        const allowedFields = [
            "name",
            "description",
            "date",
            "start_time",
            "end_time",
            "venue",
            "address",
            "city",
            "state",
            "pincode",
            "contact_person",
            "contact_number",
            "contact_email",
            "image",
            "is_active",
            "registration_required",
            "registration_limit",
            "additional_notes",
        ];

        const payload = {};
        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) payload[field] = req.body[field];
        });

        const updated = await HealthCamp.findByIdAndUpdate(
            req.params.id,
            payload,
            { new: true, runValidators: true }
        );
        return res.json({ success: true, data: updated });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

// @desc Delete a health camp (admin only). Registration sub-documents are
//       stored on the camp itself, so a camp can always be hard-deleted safely.
// @route DELETE /api/v1/health-camps/:id
const deleteHealthCamp = async (req, res) => {
    try {
        const camp = await HealthCamp.findById(req.params.id);
        if (!camp) {
            return res.status(404).json({ success: false, message: "Health camp not found" });
        }

        await HealthCamp.findByIdAndDelete(req.params.id);
        return res.json({ success: true, message: "Health camp deleted successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc Submit a public registration for a health camp
// @route POST /api/v1/health-camps/:id/register
const registerForHealthCamp = async (req, res) => {
    try {
        const { name, email, phone, age, notes } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: "Name is required" });
        }
        if (!phone || !phone.trim()) {
            return res.status(400).json({ success: false, message: "Phone number is required" });
        }

        const camp = await HealthCamp.findById(req.params.id);
        if (!camp) {
            return res.status(404).json({ success: false, message: "Health camp not found" });
        }
        if (!camp.is_active) {
            return res.status(400).json({ success: false, message: "This health camp is not accepting registrations" });
        }
        if (!camp.registration_required) {
            return res.status(400).json({ success: false, message: "Registration is not required for this camp" });
        }
        if (
            camp.registration_limit &&
            camp.registrations &&
            camp.registrations.length >= camp.registration_limit
        ) {
            return res.status(400).json({ success: false, message: "Registration limit reached for this camp" });
        }

        camp.registrations.push({ name, email, phone, age, notes });
        await camp.save();
        return res.status(201).json({ success: true, data: camp });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

module.exports = {
    getHealthCamps,
    getHealthCampById,
    createHealthCamp,
    updateHealthCamp,
    deleteHealthCamp,
    registerForHealthCamp,
};
