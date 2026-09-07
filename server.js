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

const userRoutes = require("./routes/userRoutes");
const siteSettingsRoutes = require("./routes/siteSettingsRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const memberProfileRoutes = require("./routes/memberProfileRoutes");
const masterDataRoutes = require("./routes/masterDataRoutes");
const parameterCategoryRoutes = require("./routes/parameterCategoryRoutes");
const patientRoutes = require("./routes/patientRoutes");
const visitRoutes = require("./routes/visitRoutes");
const disclaimerRoutes = require("./routes/disclaimerRoutes");
const legalContentRoutes = require("./routes/legalContentRoutes");
const medicineRoutes = require("./routes/medicineRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const healthCampRoutes = require("./routes/healthCampRoutes");
const scanPricingRoutes = require("./routes/scanPricingRoutes");

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
app.use("/api/member/profile", memberProfileRoutes);

// Quantum Machine Health Analysis Module Routes
app.use("/api/v1/admin/parameters", masterDataRoutes);
app.use("/api/v1/admin/parameter-categories", parameterCategoryRoutes);
app.use("/api/v1/admin/medicines", medicineRoutes);
app.use("/api/v1/patients", patientRoutes);
app.use("/api/v1/visits", visitRoutes);
app.use("/api/v1/disclaimers", disclaimerRoutes);
app.use("/api/v1/legal-content", legalContentRoutes);
app.use("/api/v1/scan-pricing", scanPricingRoutes);
app.use("/api/health-camps", healthCampRoutes);

// Dashboard Routes
app.use("/api/dashboard", dashboardRoutes);

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