const mongoose = require("mongoose");

const siteSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "default_settings",
      unique: true,
    },
    header: { type: mongoose.Schema.Types.Mixed },
    hero: { type: mongoose.Schema.Types.Mixed },
    trustBadges: { type: mongoose.Schema.Types.Mixed },
    mission: { type: mongoose.Schema.Types.Mixed },
    testimonials: { type: mongoose.Schema.Types.Mixed },
    distributorCta: { type: mongoose.Schema.Types.Mixed },
    footer: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true, strict: false }
);

module.exports = mongoose.model("SiteSettings", siteSettingsSchema);
