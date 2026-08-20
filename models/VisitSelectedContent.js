const mongoose = require("mongoose");

const visitSelectedContentSchema = new mongoose.Schema(
  {
    visit_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Visit",
      required: true,
    },
    parameter_master_content_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParameterMasterContent",
      required: true,
    },
    is_selected: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

visitSelectedContentSchema.index(
  { visit_id: 1, parameter_master_content_id: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "VisitSelectedContent",
  visitSelectedContentSchema
);
