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
      required: true,
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
    registered_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Patient", patientSchema);
