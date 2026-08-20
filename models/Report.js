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
