require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const User = require("./models/User");
const userRoutes = require("./routes/userRoutes");

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

const ensureDefaultAdmin = async () => {
  try {
    const existingAdmin = await User.findOne({ isAdmin: true });

    if (existingAdmin) {
      return;
    }

    const adminEmail = process.env.ADMIN_EMAIL || "admin@uttkarsh.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123456";

    await User.create({
      firstname: "Admin",
      lastname: "User",
      email: adminEmail,
      password: adminPassword,
      phoneNumber: process.env.ADMIN_PHONE || "0000000000",
      isAdmin: true,
      isActive: true,
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
    await mongoose.connect(process.env.MONGO_URL);

    console.log("✅ MongoDB Connected");

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