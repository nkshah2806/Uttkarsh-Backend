const mongoose = require("mongoose");

// Configurable scan pricing used when a new client scan (Visit) is created.
// The selected pricing is snapshotted onto the Visit (scan_pricing) so a
// finalized history stays intact even when this master price is later edited,
// deactivated or deleted.
const scanPricingSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        description: { type: String, default: "" },
        amount: { type: Number, required: true, min: 0 },
        is_active: { type: Boolean, default: true },
        // Only one active pricing may be flagged as the default at a time. When
        // exactly one active pricing exists it is treated as the default.
        is_default: { type: Boolean, default: false },
    },
    { timestamps: true }
);

module.exports = mongoose.model("ScanPricing", scanPricingSchema);
