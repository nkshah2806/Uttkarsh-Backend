const mongoose = require("mongoose");

const visitSchema = new mongoose.Schema(
  {
    patient_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    franchise_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Franchise",
      default: null,
    },
    consultant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    visit_date: {
      type: Date,
      default: Date.now,
    },
    next_visit_date: {
      type: Date,
      default: null,
    },
    disclaimer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Disclaimer",
      default: null,
    },
    status: {
      type: String,
      enum: ["DATA_ENTRY", "REPORT_READY", "SHARED"],
      default: "DATA_ENTRY",
    },
    report_snapshot: {
      finalized_at: { type: Date },
      language: { type: String, default: "en" },
      parameters: [mongoose.Schema.Types.Mixed],
      selected_nodes: [mongoose.Schema.Types.Mixed],
      next_visit_date: { type: Date },
      disclaimer: {
        title: { type: String },
        content: { type: String },
        content_hi: { type: String },
      },
      report_html: { type: String },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Visit", visitSchema);
