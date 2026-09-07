const mongoose = require("mongoose");

const LEGAL_CONTENT_TYPES = {
    PRIVACY_POLICY: "privacy_policy",
    TERMS_CONDITIONS: "terms_conditions",
};

const legalContentSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: {
                values: Object.values(LEGAL_CONTENT_TYPES),
                message: "Legal content type must be privacy_policy or terms_conditions",
            },
            required: [true, "Legal content type is required"],
            index: true,
        },
        title: {
            type: String,
            required: [true, "Legal content title is required"],
            trim: true,
        },
        content: {
            type: String,
            required: [true, "Legal content is required"],
            trim: true,
        },
        is_active: {
            type: Boolean,
            default: false,
            index: true,
        },
        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        updated_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    { timestamps: true }
);

// Ensure only one active document exists per type (index on type + is_active)
legalContentSchema.index({ type: 1, is_active: 1 });

module.exports = mongoose.model("LegalContent", legalContentSchema);
module.exports.LEGAL_CONTENT_TYPES = LEGAL_CONTENT_TYPES;
