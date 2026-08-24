const mongoose = require("mongoose");

const visitSelectedContentSchema = new mongoose.Schema(
  {
    visit_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Visit",
      required: true,
    },
    // New hierarchical node identification
    parameter_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parameter",
    },
    node_id: {
      type: String,
    },
    version: {
      type: Number,
      default: 1,
    },
    // Legacy support
    parameter_master_content_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParameterMasterContent",
    },
    is_selected: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

visitSelectedContentSchema.index(
  { visit_id: 1, parameter_id: 1, node_id: 1 },
  { name: "visit_node_selection_idx" }
);

module.exports = mongoose.model(
  "VisitSelectedContent",
  visitSelectedContentSchema
);
