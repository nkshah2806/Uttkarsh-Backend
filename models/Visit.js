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
    // Scan pricing applied when this scan (visit) was created. The name/amount
    // are snapshotted at creation time so previously completed scans keep their
    // original charged amount even if the pricing config is later edited,
    // deactivated or deleted. Optional payment fields keep the schema ready for
    // a future payment gateway without changing existing flows.
    scan_pricing: {
      pricing_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ScanPricing",
        default: null,
      },
      name: { type: String, default: "" },
      amount: { type: Number, default: 0 },
      payment_status: { type: String, default: "" },
      payment_method: { type: String, default: "" },
      transaction_id: { type: String, default: "" },
    },
    // Medicine selection (point-wise medicine selection). Each entry stores a
    // snapshot of the master medicine so previously generated reports remain
    // intact even if the master medicine is later edited or deactivated.
    medicines: [
      {
        medicine_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Medicine",
          required: true,
        },
        name_snapshot: { type: String, default: "" },
        details_snapshot: { type: String, default: "" },
        dosage_snapshot: { type: String, default: "" },
      },
    ],
    // Optional multiline note saved with the medicine selection and report
    medicine_note: { type: String, default: "" },
    // Point-wise medicine selection: each entry associates medicines + an
    // optional note with a specific parameter so the final report can show
    // medicines under the exact parameter/point they belong to.
    parameter_medicines: [
      {
        parameter_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Parameter",
          required: true,
        },
        medicines: [
          {
            medicine_id: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Medicine",
              required: true,
            },
            name_snapshot: { type: String, default: "" },
            details_snapshot: { type: String, default: "" },
            dosage_snapshot: { type: String, default: "" },
          },
        ],
        note: { type: String, default: "" },
      },
    ],
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
      medicines: [mongoose.Schema.Types.Mixed],
      medicine_note: { type: String },
      parameter_medicines: [mongoose.Schema.Types.Mixed],
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
