const SiteSettings = require("../models/SiteSettings");

const DEFAULT_SETTINGS = {
  key: "default_settings",
  header: {
    announcement: "Free Shipping on Orders Over ₹499 · 100% Natural · GMP Certified",
    searchPlaceholder: "Search herbs, remedies...",
  },
  hero: {
    badge: "Local for Vocal · GMP Certified",
    titleLine1: "Ancient wisdom.",
    titleLine2: "Everyday wellness.",
    description: "Trusted Ayurvedic medicines and herbal essentials — crafted by local artisans, made for every Indian family's progress toward better health.",
    primaryCtaText: "Shop the Collection",
    primaryCtaLink: "/shop",
    secondaryCtaText: "Our Story",
    secondaryCtaLink: "/about",
    bgImage: "https://images.unsplash.com/photo-1492552085122-36706c238263?crop=entropy&cs=srgb&fm=jpg&q=85&w=1800",
  },
  trustBadges: [
    { id: 1, text: "GMP Certified", icon: "ShieldCheck" },
    { id: 2, text: "100% Natural", icon: "Leaf" },
    { id: 3, text: "Free Shipping ₹499+", icon: "Truck" },
    { id: 4, text: "COD Available", icon: "HeartHandshake" },
  ],
  mission: {
    badge: "Our Mission",
    title: "Progress for every family, through health.",
    paragraph1: "Utkarsh Corporation stands with India's small and domestic Ayurvedic manufacturers. Every jar and bottle you receive supports local artisans, farmers and doctors — a true Local for Vocal promise.",
    paragraph2: "We host free health camps in cities and villages, mentor budding distributors, and craft classical Ayurvedic products with modern quality controls — so wellness stays accessible, affordable, and authentic.",
    image: "https://images.unsplash.com/photo-1615485499958-69973683793c?crop=entropy&cs=srgb&fm=jpg&q=85&w=1400",
    stats: [
      { id: 1, number: "50+", label: "Health Camps" },
      { id: 2, number: "40k", label: "Families Served" },
      { id: 3, number: "120+", label: "Local Partners" },
    ]
  },
  testimonials: [
    { id: 1, name: "Anita R., Mumbai", body: "The Chyawanprash has become my daily ritual. My kids love it too — no cold this whole season.", stars: 5 },
    { id: 2, name: "Rajesh P., Pune", body: "Ashwagandha capsules genuinely helped with stress and sleep. Authentic, effective and reasonably priced.", stars: 5 },
    { id: 3, name: "Sonal M., Delhi", body: "Attended their free health camp — such warm, knowledgeable doctors. Trustworthy brand.", stars: 5 },
  ],
  distributorCta: {
    badge: "Business Opportunity",
    title: "Grow with us. Become a distributor.",
    description: "Join 120+ partners across India selling trusted Ayurvedic products. Attractive margins, full training, marketing support and a mission that matters.",
    ctaText: "Apply now",
    ctaLink: "/distributor",
  },
  footer: {
    brandDescription: "Rooted in ancient Ayurvedic wisdom, we craft trusted herbal products for the progress of every Indian family — from local hands to your home.",
    phone: "+91 99999 99999",
    email: "care@utkarshcorp.com",
    address: "Nashik, Maharashtra, India",
    instagramUrl: "https://instagram.com",
    facebookUrl: "https://facebook.com",
    youtubeUrl: "https://youtube.com",
    copyrightText: "Utkarsh Corporation. All rights reserved."
  },
  about: {
    heroTitleLine1: "Progress for every family,",
    heroTitleLine2: "through the science of Ayurveda.",
    heroDescription: "Utkarsh Corporation is more than a brand. It is a movement — supporting India's small Ayurvedic manufacturers, doctors and farmers to bring authentic wellness to every home.",
    heroImage: "https://images.unsplash.com/photo-1492552085122-36706c238263?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600",
    storyTitle: "Rooted in tradition. Driven by purpose.",
    values: [
      { icon: "Leaf", title: "Authenticity", body: "Classical formulations, verified ingredients, transparent sourcing." },
      { icon: "ShieldCheck", title: "Quality", body: "GMP-certified facilities, batch testing, AYUSH compliance." },
      { icon: "HeartHandshake", title: "Community", body: "Fair trade with small manufacturers, empowering local artisans." },
      { icon: "Sparkles", title: "Wellness", body: "Free camps, health education, and doctor-led awareness." },
    ],
    certifications: [
      { title: "GMP Certified", body: "All manufacturing units follow Good Manufacturing Practices." },
      { title: "AYUSH Compliant", body: "Approved by the Ministry of AYUSH, Government of India." },
      { title: "ISO 9001", body: "International quality management standards for consistency." },
      { title: "Lab Tested", body: "Every batch is independently tested for potency and safety." },
    ]
  },
  healthCamps: {
    badge: "Community Care",
    title: "Free Ayurvedic Health Camps",
    description: "Bringing expert Ayurvedic doctors, pulse diagnosis (Nadi Pariksha) and free medical consultations directly to your town.",
    camps: [
      { id: 1, title: "Nashik Mega Swasthya Shibir", location: "District Sports Complex, Nashik", date: "August 15, 2026", time: "9:00 AM - 4:00 PM", doctors: "Dr. K. Sharma (MD Ayur), Dr. V. Patil", capacity: "500+ Patients" },
      { id: 2, title: "Pune Preventive Health Camp", location: "Community Center, Kothrud, Pune", date: "September 05, 2026", time: "10:00 AM - 5:00 PM", doctors: "Dr. A. Joshi, Dr. R. Kulkarni", capacity: "350+ Patients" },
    ]
  },
  distributorPage: {
    heroTitle: "Join the Utkarsh Business Movement",
    heroSubtitle: "Become an authorized partner & distributor for classical Ayurvedic products in your district.",
    benefits: [
      { title: "High Margin Profits", description: "Direct partner margins with attractive volume incentives." },
      { title: "Marketing & POS Support", description: "Banners, product samples, doctor flyers & digital campaign assistance." },
      { title: "Zero Franchise Royalty", description: "100% transparent pricing without hidden royalty fees." },
    ],
    steps: [
      { step: "01", title: "Apply Online", description: "Submit your details using our distributor registration form." },
      { step: "02", title: "Verification", description: "Our regional manager reviews your location and business plan." },
      { step: "03", title: "Onboarding", description: "Receive starter stock, product manual, and sales training." },
    ]
  },
  policies: {
    privacyPolicy: "Utkarsh Corporation respects customer privacy. All personal data collected during checkout or account registration is protected under standard encryption protocol and never shared with third parties.",
    termsOfService: "By using our platform, you agree to buy products strictly for personal use or licensed distribution. Product efficacy may vary based on individual prakriti and lifestyle factors.",
    shippingPolicy: "Orders are processed within 24 hours. Free shipping applies on orders exceeding ₹499 across India via trusted express logistics.",
    returnPolicy: "We offer a hassle-free 7-day return policy for unopened and undamaged items. Refund will be credited within 3-5 business days."
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
