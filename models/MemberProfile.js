const mongoose = require("mongoose");

const memberProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    member_id: {
      type: String,
      required: true,
      trim: true,
    },
    distributor_id: {
      type: String,
      required: true,
      trim: true,
    },
    member_name: {
      type: String,
      required: [true, "Member Name is required"],
      trim: true,
    },
    branch_name: {
      type: String,
      default: "",
      trim: true,
    },
    store_name: {
      type: String,
      default: "",
      trim: true,
    },
    state: {
      type: String,
      required: [true, "State is required"],
      trim: true,
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
    },
    district: {
      type: String,
      required: [true, "District is required"],
      trim: true,
    },
    area: {
      type: String,
      default: "",
      trim: true,
    },
    franchise_type: {
      type: String,
      enum: ["District Franchise", "State Franchise", "Panchayat Franchise", "Store Partner", "Standard Distributor"],
      default: "Standard Distributor",
    },
    under_group: {
      type: String,
      enum: ["Group A", "Group B", "Group C", "General Group"],
      default: "General Group",
    },
    franchise_code: {
      type: String,
      required: true,
      trim: true,
    },
    contact_person: {
      type: String,
      required: [true, "Contact Person Name is required"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone Number is required"],
      match: [/^[0-9]{10}$/, "Phone number must be exactly 10 digits"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email Address is required"],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please use a valid email address"],
    },
    address: {
      type: String,
      required: [true, "Full Address is required"],
      trim: true,
    },
    pincode: {
      type: String,
      required: [true, "PIN Code is required"],
      match: [/^[0-9]{6}$/, "PIN Code must be exactly 6 digits"],
      trim: true,
    },

    // Bank Information
    account_name: {
      type: String,
      required: [true, "Account Holder Name is required"],
      trim: true,
    },
    bank_name: {
      type: String,
      required: [true, "Bank Name is required"],
      trim: true,
    },
    account_number: {
      type: String,
      required: [true, "Account Number is required"],
      trim: true,
    },
    account_type: {
      type: String,
      enum: ["Savings", "Current", "Salary", "NRE/NRO"],
      default: "Savings",
    },
    ifsc_code: {
      type: String,
      required: [true, "IFSC Code is required"],
      uppercase: true,
      trim: true,
      match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, "Please enter a valid IFSC code (e.g. SBIN0001234)"],
    },
    branch_address: {
      type: String,
      default: "",
      trim: true,
    },

    // Profile Completion & Status
    profile_completed: {
      type: Boolean,
      default: false,
    },
    completion_percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("MemberProfile", memberProfileSchema);
