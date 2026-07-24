const envConfig = require("./config/environment.json");
Object.entries(envConfig).forEach(([key, value]) => {
  process.env[key] = value;
});

require("dotenv").config();

process.env.JWT_SECRET = process.env.JWT_SECRET || "default-jwt-secret";
process.env.MEMBER_JWT_SECRET = process.env.MEMBER_JWT_SECRET || "member-jwt-secret";
process.env.ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || "admin-jwt-secret";

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const User = require("./models/User");
const Admin = require("./models/Admin");
const userRoutes = require("./routes/userRoutes");
const memberRoutes = require("./routes/memberRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", (req, res) => {
  res.send("Hello Backend");
});

app.use("/api/user", userRoutes);
app.use("/api/auth", userRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/admin", adminRoutes);

const ensureDefaultAdmin = async () => {
  try {
    const existingAdmin = await Admin.findOne({ username: "admin" });
    if (existingAdmin) {
      return;
    }

    const adminEmail = process.env.ADMIN_EMAIL || "admin@uttkarsh.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123456";

    await Admin.create({
      username: "admin",
      email: adminEmail,
      password: adminPassword,
    });

    console.log(`✅ Default admin created with email: ${adminEmail}`);
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