const envConfig = require("./config/environment.json");
Object.entries(envConfig).forEach(([key, value]) => {
  if (key === "PORT" && process.env.PORT) {
    return;
  }
  process.env[key] = value;
});

require("dotenv").config();

process.env.JWT_SECRET = process.env.JWT_SECRET || "default-jwt-secret";
process.env.MEMBER_JWT_SECRET = process.env.MEMBER_JWT_SECRET || process.env.JWT_SECRET;
process.env.ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const User = require("./models/User");
const Category = require("./models/Category");
const Product = require("./models/Product");
const userRoutes = require("./routes/userRoutes");
const siteSettingsRoutes = require("./routes/siteSettingsRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", (req, res) => {
  res.send("Hello Backend");
});

// Unified API Routes
app.use("/api/user", userRoutes);
app.use("/api/auth", userRoutes);
app.use("/api/members", userRoutes);
app.use("/api/admin", userRoutes);
app.use("/api/site-settings", siteSettingsRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);

const DEFAULT_CATEGORIES = [
  {
    name: "Classical Medicines",
    slug: "classical-medicines",
    image: "https://images.unsplash.com/photo-1615485499958-69973683793c?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    description: "Time-tested formulations, Rasayanas, Bhasmas, and Kwaths crafted per Samhitas.",
    order: 1,
  },
  {
    name: "Herbal Supplements",
    slug: "herbal-supplements",
    image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    description: "Pure single herb extracts including Ashwagandha, Shatavari, and Giloy.",
    order: 2,
  },
  {
    name: "Digestion & Gut",
    slug: "digestion-and-gut",
    image: "https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    description: "Ayurvedic Churnas, Aristhas, and Digestive Syrups for daily gut vitality.",
    order: 3,
  },
  {
    name: "Immunity Boosters",
    slug: "immunity-boosters",
    image: "https://images.unsplash.com/photo-1577401239170-897942555fb3?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    description: "Chyawanprash, Kadha, and Vitamin-C enriched herbal formulas.",
    order: 4,
  },
  {
    name: "Hair & Skin Care",
    slug: "hair-and-skin-care",
    image: "https://images.unsplash.com/photo-1608248597263-00079e9603f2?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    description: "Nourishing oils, Kumkumadi gels, and natural herbal face cleansers.",
    order: 5,
  },
  {
    name: "Wellness Essentials",
    slug: "wellness-essentials",
    image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
    description: "Daily oils, massage churnas, pain relief tailams, and wellness teas.",
    order: 6,
  },
];

const DEFAULT_PRODUCTS = [
  {
    name: "Premium Special Chyawanprash",
    slug: "premium-special-chyawanprash",
    category_slug: "immunity-boosters",
    price: 499,
    mrp: 650,
    short_description: "Fortified with 40+ authentic herbs & Amla for immunity, vitality & daily energy.",
    description: "Prepared according to traditional Ayurvedic methods using fresh Amla, Pure Desi Ghee, Saffron, and over 40 potent herbs. Recommended for daily consumption for all age groups.",
    images: ["https://images.unsplash.com/photo-1577401239170-897942555fb3?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"],
    is_bestseller: true,
    is_featured: true,
    rating: 4.9,
    review_count: 128,
    stock: 200,
    ailment: "Immunity & Cold Protection",
  },
  {
    name: "Ashwagandha Gold KSM-66 Capsules",
    slug: "ashwagandha-gold-ksm66-capsules",
    category_slug: "herbal-supplements",
    price: 380,
    mrp: 499,
    short_description: "High potency root extract for stress relief, stamina, and deep restorative sleep.",
    description: "Standardized organic Ashwagandha root extract capsules. Helps lower cortisol, improve energy, enhance focus, and support natural sleep cycles.",
    images: ["https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"],
    is_bestseller: true,
    is_featured: true,
    rating: 4.8,
    review_count: 94,
    stock: 150,
    ailment: "Stress & Sleep",
  },
  {
    name: "Organic Triphala Churna",
    slug: "organic-triphala-churna",
    category_slug: "digestion-and-gut",
    price: 249,
    mrp: 320,
    short_description: "Pure Haritaki, Bibhitaki & Amalaki powder for gentle daily colon detox.",
    description: "100% pure organic triphala powder. Promotes regular bowel movements, cleanses digestive tract, and supports nutrient absorption.",
    images: ["https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"],
    is_bestseller: true,
    is_featured: false,
    rating: 4.7,
    review_count: 76,
    stock: 180,
    ailment: "Constipation & Digestion",
  },
  {
    name: "Kumkumadi Glow Facial Oil",
    slug: "kumkumadi-glow-facial-oil",
    category_slug: "hair-and-skin-care",
    price: 599,
    mrp: 799,
    short_description: "Traditional Saffron & Chandan Ayurvedic oil for radiant skin tone.",
    description: "Luxurious blend of Kashmiri Saffron, Sandalwood, Lotus pollen, and 26 precious herbs infused in pure sesame oil. Brightens complexion and fades dark spots.",
    images: ["https://images.unsplash.com/photo-1608248597263-00079e9603f2?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"],
    is_bestseller: false,
    is_featured: true,
    rating: 4.9,
    review_count: 63,
    stock: 90,
    ailment: "Skin Brightening",
  },
  {
    name: "Mahabhringraj Hair Growth Oil",
    slug: "mahabhringraj-hair-growth-oil",
    category_slug: "hair-and-skin-care",
    price: 349,
    mrp: 450,
    short_description: "Cold-pressed sesame oil base with pure Bhringraj, Amla and Sesame for hair strength.",
    description: "Nourishes scalp roots, prevents premature greying, and reduces hair fall. Formulated per classical Kshirapaka Vidhi.",
    images: ["https://images.unsplash.com/photo-1526947425960-945c6e72858f?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"],
    is_bestseller: true,
    is_featured: true,
    rating: 4.8,
    review_count: 110,
    stock: 140,
    ailment: "Hair Fall",
  },
  {
    name: "Pure Shilajit Resin Gold",
    slug: "pure-shilajit-resin-gold",
    category_slug: "wellness-essentials",
    price: 899,
    mrp: 1200,
    short_description: "Purified Himalayan Shilajit rich in 80+ minerals & Fulvic Acid.",
    description: "Authentic soft resin Shilajit extracted from high-altitude Himalayan peaks. Enhances stamina, strength, and cellular metabolism.",
    images: ["https://images.unsplash.com/photo-1506126613408-eca07ce68773?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"],
    is_bestseller: true,
    is_featured: true,
    rating: 4.9,
    review_count: 85,
    stock: 80,
    ailment: "Stamina & Energy",
  },
];

const ensureDefaultAdmin = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@uttkarsh.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123456";

    const existingAdmin = await User.findOne({
      $or: [{ isAdmin: true }, { email: adminEmail }, { username: "admin" }],
    });

    if (existingAdmin) {
      if (!existingAdmin.isAdmin) {
        existingAdmin.isAdmin = true;
        await existingAdmin.save();
      }
      return;
    }

    await User.create({
      fullName: "System Admin",
      username: "admin",
      email: adminEmail,
      password: adminPassword,
      isAdmin: true,
      isActive: true,
    });

    console.log(`✅ Default admin created in users collection with email: ${adminEmail}`);
  } catch (error) {
    console.error("❌ Failed to create default admin:");
    console.error(error.message);
  }
};

const ensureDefaultCategoriesAndProducts = async () => {
  try {
    const countCat = await Category.countDocuments();
    if (countCat === 0) {
      await Category.insertMany(DEFAULT_CATEGORIES);
      console.log("✅ Default categories seeded into database.");
    }
    const countProd = await Product.countDocuments();
    if (countProd === 0) {
      await Product.insertMany(DEFAULT_PRODUCTS);
      console.log("✅ Default products seeded into database.");
    }
  } catch (error) {
    console.error("❌ Error seeding default categories and products:", error.message);
  }
};

// MongoDB Connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URL, {
      dbName: "uttkarsh_db",
    });

    console.log("==========================================");
    console.log("✅ MongoDB Connected Successfully!");
    console.log(`📌 Connected Database Name: "${conn.connection.name}"`);
    console.log(`🌐 Connected Host: "${conn.connection.host}"`);
    console.log(`🔗 Mongo URL: "${process.env.MONGO_URL}"`);
    console.log("==========================================");

    await ensureDefaultAdmin();
    await ensureDefaultCategoriesAndProducts();

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ MongoDB Connection Error:");
    console.error(error.message);
    process.exit(1);
  }
};

connectDB();