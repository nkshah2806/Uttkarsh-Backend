const mongoose = require("mongoose");

const medicineSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        // Localized display name overlays. `name` remains the unique key.
        name_hi: {
            type: String,
            default: "",
            trim: true,
        },
        name_gu: {
            type: String,
            default: "",
            trim: true,
        },
        details: {
            type: String,
            default: "",
        },
        details_hi: {
            type: String,
            default: "",
        },
        details_gu: {
            type: String,
            default: "",
        },
        dosage: {
            type: String,
            default: "",
        },
        dosage_hi: {
            type: String,
            default: "",
        },
        dosage_gu: {
            type: String,
            default: "",
        },
        is_active: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Medicine", medicineSchema);
