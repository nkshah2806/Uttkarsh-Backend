const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    visit_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Visit",
      required: true,
    },
    pdf_url: {
      type: String,
      default: "",
    },
    language: {
      type: String,
      enum: ["hi", "en"],
      default: "en",
    },
    // Report price snapshotted at generation time (amount + payment status).
    // Stored here so each Report keeps the exact amount charged for that PDF.
    amount: { type: Number, default: 0 },
    payment_status: { type: String, default: "" },
    payment_method: { type: String, default: "" },
    transaction_id: { type: String, default: "" },
    generated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    generated_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Report", reportSchema);
