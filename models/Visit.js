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
    status: {
      type: String,
      enum: ["DATA_ENTRY", "REPORT_READY", "SHARED"],
      default: "DATA_ENTRY",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Visit", visitSchema);
