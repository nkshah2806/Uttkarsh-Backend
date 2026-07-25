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
const userRoutes = require("./routes/userRoutes");
const siteSettingsRoutes = require("./routes/siteSettingsRoutes");

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