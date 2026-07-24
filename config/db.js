const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URL, {
      dbName: "uttkarsh_db",
    });

    console.log("==========================================");
    console.log("✅ MongoDB Connected Successfully!");
    console.log(`📌 Database Name: "${conn.connection.name}"`);
    console.log(`🌐 Database Host: "${conn.connection.host}"`);
    console.log("==========================================");
    return conn;
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    process.exit(1);
  }
};

module.exports = connectDB;