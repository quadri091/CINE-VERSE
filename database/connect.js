const mongoose = require("mongoose");

const connect = async () => {
  const mongoUri = process.env.MONGO_URI || process.env.LINK;
  if (!mongoUri) throw new Error("Missing MONGO_URI environment variable");

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("Database connected successfully");
  } catch (err) {
    console.error("Database connection failed:", err.message);
    throw err;
  }
};

module.exports = connect;
