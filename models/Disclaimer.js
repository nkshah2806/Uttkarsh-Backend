const mongoose = require("mongoose");

const disclaimerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Disclaimer title is required"],
      trim: true,
    },
    content: {
      type: String,
      required: [true, "Disclaimer content is required"],
      trim: true,
    },
    content_hi: {
      type: String,
      default: "",
      trim: true,
    },
    is_active: {
      type: Boolean,
      default: false,
      index: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Disclaimer", disclaimerSchema);
