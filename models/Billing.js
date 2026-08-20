const mongoose = require("mongoose");

const billingSchema = new mongoose.Schema(
  {
    visit_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Visit",
      default: null,
    },
    franchise_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Franchise",
      default: null,
    },
    amount: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ["PATIENT_INVOICE", "FRANCHISE_FEE", "SUBSCRIPTION"],
      required: true,
    },
    status: {
      type: String,
      enum: ["PAID", "PENDING", "CANCELLED"],
      default: "PAID",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Billing", billingSchema);
