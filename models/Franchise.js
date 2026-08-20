const mongoose = require("mongoose");
require("./SubscriptionPlan");

const franchiseSchema = new mongoose.Schema(
  {
    franchise_code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    owner_name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    plan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      default: null,
    },
    royalty_percent: {
      type: Number,
      default: 10,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED", "PENDING"],
      default: "ACTIVE",
    },
    logo_url: {
      type: String,
      default: "",
    },
    digital_signature_url: {
      type: String,
      default: "",
    },
    qr_code_url: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Franchise", franchiseSchema);
