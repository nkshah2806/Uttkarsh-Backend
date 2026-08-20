const mongoose = require("mongoose");

const parameterMasterContentSchema = new mongoose.Schema(
  {
    parameter_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parameter",
      required: true,
    },
    result_type: {
      type: String,
      enum: ["LOW", "HIGH"],
      required: true,
    },
    content_type: {
      type: String,
      enum: [
        "REPORT",
        "PROBLEM",
        "CAUSE",
        "PRECAUTION",
        "PATHYA",
        "PARHEJ",
        "MEDICINE",
        "DIET",
      ],
      required: true,
    },
    text_hi: {
      type: String,
      required: true,
      trim: true,
    },
    text_en: {
      type: String,
      required: true,
      trim: true,
    },
    priority: {
      type: Number,
      default: 1,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

parameterMasterContentSchema.index(
  { parameter_id: 1, result_type: 1, content_type: 1 },
  { name: "param_lookup_idx" }
);

module.exports = mongoose.model(
  "ParameterMasterContent",
  parameterMasterContentSchema
);
