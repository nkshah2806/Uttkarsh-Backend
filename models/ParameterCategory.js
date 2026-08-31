const mongoose = require("mongoose");

const parameterCategorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        slug: {
            type: String,
            trim: true,
            lowercase: true,
            default: "",
        },
        description: {
            type: String,
            default: "",
        },
        order: {
            type: Number,
            default: 0,
        },
        is_active: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("ParameterCategory", parameterCategorySchema);
