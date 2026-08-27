const SiteSettings = require("../models/SiteSettings");

const DEFAULT_SETTINGS = {
  key: "default_settings",
  header: {
    announcement: "",
    searchPlaceholder: "",
  },
  hero: {
    badge: "",
    titleLine1: "",
    titleLine2: "",
    description: "",
    primaryCtaText: "",
    primaryCtaLink: "",
    secondaryCtaText: "",
    secondaryCtaLink: "",
    bgImage: "",
  },
  trustBadges: [],
  mission: {
    badge: "",
    title: "",
    paragraph1: "",
    paragraph2: "",
    image: "",
    stats: []
  },
  testimonials: [],
  distributorCta: {
    badge: "",
    title: "",
    description: "",
    ctaText: "",
    ctaLink: "",
  },
  footer: {
    brandDescription: "",
    phone: "",
    email: "",
    address: "",
    instagramUrl: "",
    facebookUrl: "",
    youtubeUrl: "",
    copyrightText: ""
  },
  about: {
    heroTitleLine1: "",
    heroTitleLine2: "",
    heroDescription: "",
    heroImage: "",
    storyTitle: "",
    values: [],
    certifications: []
  },
  healthCamps: {
    badge: "",
    title: "",
    description: "",
    camps: []
  },
  distributorPage: {
    heroTitle: "",
    heroSubtitle: "",
    benefits: [],
    steps: []
  },
  policies: {
    privacyPolicy: "",
    termsOfService: "",
    shippingPolicy: "",
    returnPolicy: ""
  }
};

/**
 * GET /api/site-settings
 */
const getSiteSettings = async (req, res) => {
  try {
    let settings = await SiteSettings.findOne({ key: "default_settings" });
    if (!settings) {
      settings = await SiteSettings.create(DEFAULT_SETTINGS);
    }
    return res.json(settings);
  } catch (error) {
    console.error("Error fetching site settings:", error);
    return res.status(500).json({ message: "Failed to fetch site settings", error: error.message });
  }
};

/**
 * POST /api/site-settings
 */
const updateSiteSettings = async (req, res) => {
  try {
    const updateData = { ...req.body, key: "default_settings" };
    const updated = await SiteSettings.findOneAndUpdate(
      { key: "default_settings" },
      { $set: updateData },
      { new: true, upsert: true }
    );
    return res.json(updated);
  } catch (error) {
    console.error("Error updating site settings:", error);
    return res.status(500).json({ message: "Failed to update site settings", error: error.message });
  }
};

module.exports = {
  getSiteSettings,
  updateSiteSettings,
};
