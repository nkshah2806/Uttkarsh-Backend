const mongoose = require("mongoose");

const visitParameterResultSchema = new mongoose.Schema(
  {
    visit_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Visit",
      required: true,
    },
    parameter_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parameter",
      required: true,
    },
    raw_value: {
      type: Number,
      required: true,
    },
    result_type: {
      type: String,
      enum: ["NORMAL", "LOW", "HIGH"],
      required: true,
    },
  },
  { timestamps: true }
);

visitParameterResultSchema.index({ visit_id: 1, parameter_id: 1 }, { unique: true });

module.exports = mongoose.model(
  "VisitParameterResult",
  visitParameterResultSchema
);
