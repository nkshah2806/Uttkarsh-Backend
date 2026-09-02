const mongoose = require("mongoose");

const medicineSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        details: {
            type: String,
            default: "",
        },
        dosage: {
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
