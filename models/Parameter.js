const mongoose = require("mongoose");

const parameterSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name_hi: {
      type: String,
      required: true,
      trim: true,
    },
    name_en: {
      type: String,
      required: true,
      trim: true,
    },
    unit: {
      type: String,
      default: "",
      trim: true,
    },
    normal_min: {
      type: Number,
      required: true,
    },
    normal_max: {
      type: Number,
      required: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      default: "General",
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Parameter", parameterSchema);
