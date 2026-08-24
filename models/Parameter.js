const mongoose = require("mongoose");

const contentNodeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    parentId: { type: String, default: null },
    nodeType: { type: String, required: true }, // "section", "heading", "bullet", "subBullet", "paragraph", "recommendation", "precaution", "diet", etc.
    content: { type: String, required: true },
    orderIndex: { type: Number, default: 0 },
    level: { type: Number, default: 1 }, // 0 for section, 1 for bullet/para, 2 for sub-bullet
    isSelectable: { type: Boolean, default: true },
    defaultSelected: { type: Boolean, default: true },
    categoryType: { type: String, default: "GENERAL" },
  },
  { _id: false }
);

const versionSnapshotSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    raw_content_en: { type: String, default: "" },
    raw_content_hi: { type: String, default: "" },
    parsed_nodes_en: [contentNodeSchema],
    parsed_nodes_hi: [contentNodeSchema],
    updated_at: { type: Date, default: Date.now },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    change_summary: { type: String, default: "Updated parameter content" },
  },
  { _id: false }
);

const parameterSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name_hi: {
      type: String,
      required: true,
      trim: true,
    },
    name_en: {
      type: String,
      required: true,
      trim: true,
    },
    unit: {
      type: String,
      default: "",
      trim: true,
    },
    normal_min: {
      type: Number,
      required: true,
    },
    normal_max: {
      type: Number,
      required: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      default: "General",
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    raw_content_en: {
      type: String,
      default: "",
    },
    raw_content_hi: {
      type: String,
      default: "",
    },
    parsed_nodes_en: [contentNodeSchema],
    parsed_nodes_hi: [contentNodeSchema],
    version: {
      type: Number,
      default: 1,
    },
    version_history: [versionSnapshotSchema],
    status: {
      type: String,
      enum: ["PUBLISHED", "DRAFT"],
      default: "PUBLISHED",
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Parameter", parameterSchema);
