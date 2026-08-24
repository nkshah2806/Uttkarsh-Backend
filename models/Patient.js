const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    patient_code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    franchise_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Franchise",
      required: false,
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    age: {
      type: Number,
      required: true,
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      required: true,
    },
    mobile: {
      type: String,
      required: true,
      trim: true,
    },
    weight: {
      type: Number,
      default: null,
    },
    weight_unit: {
      type: String,
      default: "kg",
      trim: true,
    },
    height: {
      type: Number,
      default: null,
    },
    height_unit: {
      type: String,
      default: "cm",
      trim: true,
    },
    dob: {
      type: Date,
      default: null,
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    registered_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Patient", patientSchema);
